---
title: "Splatoon 3 reverse, the save format"
date: 2026-11-11
permalink: /blog/save-format/
description: "What I understand about the save format"
tags: [reverse, Splatoon3]
---

## EDITED : the old article was too explicit, Send me your save file if you want to decrypt it

## Important stuff

- The game handles save I/O on a dedicated thread named `"SaveDataThread"` (both reading and writing).
- It commits changes via `nn::fs::Commit` rather than `nn::fs::CommitSaveData`.
- The main file of interest is `save.dat`.
- Existing web editors like [Flexlion's save editor](https://flexlion.github.io/saveeditor.html) process files server-side without publishing their implementation.
- **Disclaimer:** This documentation is strictly for offline interoperability and format research (e.g., studying single-player data on an emulator or offline EmuMMC). **Never** use modified save files online—doing so will result in an immediate ban.

## File Layout & Headers

Before looking at encryption, here is the binary layout of `save.dat` (observed on v11.3.0):

| Offset | Size | Field | Description |
| :--- | :--- | :--- | :--- |
| `0x00` | 4 bytes | `Seed` (`u32` LE) | Random 32-bit PRNG seed used to derive the session key, IV, and integrity mask |
| `0x04` | 4 bytes | `Checksum` (`u32` LE) | Masked `MurmurHash3_x86_32` digest computed over the encrypted payload |
| `0x08` | *N* bytes | `Ciphertext` | AES-256-CTR encrypted stream |

Once decrypted, the plaintext starts with an 8-byte **Nintendo EPD v4** container header:

- `0x00..0x03`: Magic bytes `4D 53 00 04` (`MS\x00\x04`)
- `0x04..0x07`: Buffer allocation size (`u32` LE, e.g. `0x00030B00` = `199,424` bytes)
- `0x08..EOF`: Raw MessagePack stream

## Encryption & Key Derivation

The payload is encrypted using **AES-256-CTR** (32-byte key, 16-byte initial counter/IV).

### How to locate the lookup table in your own dump
To avoid distributing proprietary binary assets extracted from the game, the 128-byte lookup table (`32 x uint32` little-endian) is omitted below. You can easily locate it in your own `main` NSO binary using a disassembler (such as Ghidra or IDA):

1. Search `.text` for immediate references to the standard Mersenne Twister initialization multiplier `0x6C078965` (`1812433253`).
2. Look for the routine that runs a 4-step seeding loop, shifts the mixed state right by `27` bits (`>> 0x1B`, yielding an index `0..31`), and loads a 32-bit word from a table in `.rodata`.
3. Dump the 32 consecutive `uint32` values (128 bytes) at that `.rodata` pointer to populate `TABLE_HEX`.

### Decryption Script

```python
import struct
import sys

from Crypto.Cipher import AES
from Crypto.Util import Counter


# Populate with the 128-byte (32 x uint32 LE) lookup table extracted from your own main binary.
TABLE_HEX = ""

if len(TABLE_HEX) != 256:
    raise ValueError("Please provide your 128-byte (256 hex chars) lookup table in TABLE_HEX.")

TABLE = [
    struct.unpack("<I", bytes.fromhex(TABLE_HEX[i * 8 : (i + 1) * 8]))[0]
    for i in range(32)
]


def u32(val: int) -> int:
    """Truncate an integer to 32 bits (unsigned)."""
    return val & 0xFFFFFFFF


def derive_key_and_iv(seed: int) -> tuple[bytes, bytes]:
    """
    Derive the 32-byte AES-256 key and 16-byte CTR IV from the 32-bit file seed.

    Uses a custom PRNG state machine initialized with the standard MT19937
    multiplier (0x6C078965) combined with a 32-entry lookup table.
    """
    # Initial PRNG seeding
    s_a = u32(u32(seed ^ (seed >> 30)) * 0x6C078965 + 1)
    s_b = u32(u32(s_a ^ (s_a >> 30)) * 0x6C078965 + 2)
    s_b = u32(u32(s_b ^ (s_b >> 30)) * 0x6C078965 + 3)

    # Table index selection (5-bit index: 0..31)
    step = u32(u32(s_b ^ (s_b >> 30)) * 0x6C078965 + 4)
    tbl_idx = (step ^ u32(s_a * 0x800) ^ s_a) >> 27
    tbl_val = TABLE[tbl_idx]

    # Re-seed internal 8-word state from table entry
    s_b = u32(u32(tbl_val ^ (tbl_val >> 30)) * 0x6C078965 + 1)
    s_a = s_b ^ u32(s_b * 0x800)

    s_c = u32(u32(s_b ^ (s_b >> 30)) * 0x6C078965 + 2)
    s_b = s_c ^ u32(s_c * 0x800)

    s_d = u32(u32(s_c ^ (s_c >> 30)) * 0x6C078965 + 3)
    s_c = s_d ^ u32(s_d * 0x800)

    s_e = u32(u32(s_d ^ (s_d >> 30)) * 0x6C078965 + 4)
    s_d = s_a ^ s_e
    w_1 = s_e ^ u32(s_e * 0x800)

    s_e = (s_a >> 8) ^ (s_e >> 19) ^ s_d
    s_a = s_b ^ s_e
    w_2 = (s_b >> 8) ^ (s_e >> 19) ^ s_a
    s_b = s_c ^ w_2
    s_c = (s_c >> 8) ^ (w_2 >> 19) ^ s_b
    s_e = s_e ^ u32(s_e << 11)
    w_3 = w_1 ^ s_c

    key_bytes = bytearray(32)
    iv_bytes = bytearray(16)

    # Key bytes 0..7 (interleaved emission order: 0, 2, 1, 3, 4..7)
    key_bytes[0] = (s_d >> 24) & 0xFF
    s_d = s_c ^ u32(s_c << 11)
    key_bytes[2] = (s_b >> 24) & 0xFF
    s_b = (w_1 >> 8) ^ (s_c >> 19) ^ w_3
    w_2 = w_2 ^ u32(w_2 << 11)
    s_c = s_e ^ s_b
    key_bytes[1] = (s_a >> 24) & 0xFF
    s_a = s_b ^ u32(s_b << 11)
    key_bytes[3] = (w_3 >> 24) & 0xFF
    s_b = (s_e >> 8) ^ (s_b >> 19) ^ s_c
    w_1 = w_2 ^ s_b
    s_e = s_b ^ u32(s_b << 11)
    key_bytes[4] = (s_c >> 24) & 0xFF
    s_b = (w_2 >> 8) ^ (s_b >> 19) ^ w_1
    s_c = s_d ^ s_b
    w_3 = s_b ^ u32(s_b << 11)
    key_bytes[5] = (w_1 >> 24) & 0xFF
    s_b = (s_d >> 8) ^ (s_b >> 19) ^ s_c
    s_d = s_a ^ s_b
    w_1 = s_b ^ u32(s_b << 11)
    key_bytes[6] = (s_c >> 24) & 0xFF
    s_a = (s_a >> 8) ^ (s_b >> 19) ^ s_d
    s_b = s_e ^ s_a
    s_c = s_a ^ u32(s_a << 11)
    key_bytes[7] = (s_d >> 24) & 0xFF

    # Key bytes 8..31 (six 4-byte rounds)
    for i in range(8, 32, 4):
        s_a = (s_e >> 8) ^ (s_a >> 19) ^ s_b
        s_d = w_3 ^ s_a
        s_e = s_a ^ u32(s_a << 11)
        key_bytes[i + 0] = (s_b >> 24) & 0xFF

        s_a = (w_3 >> 8) ^ (s_a >> 19) ^ s_d
        s_b = w_1 ^ s_a
        w_3 = s_a ^ u32(s_a << 11)
        key_bytes[i + 1] = (s_d >> 24) & 0xFF

        s_a = (w_1 >> 8) ^ (s_a >> 19) ^ s_b
        s_d = s_c ^ s_a
        w_1 = s_a ^ u32(s_a << 11)
        key_bytes[i + 2] = (s_b >> 24) & 0xFF

        s_a = (s_c >> 8) ^ (s_a >> 19) ^ s_d
        s_b = s_e ^ s_a
        s_c = s_a ^ u32(s_a << 11)
        key_bytes[i + 3] = (s_d >> 24) & 0xFF

    # IV bytes 0..7
    s_a = (s_e >> 8) ^ (s_a >> 19) ^ s_b
    s_d = w_3 ^ s_a
    s_e = s_a ^ u32(s_a << 11)
    iv_bytes[0] = (s_b >> 24) & 0xFF

    s_a = (w_3 >> 8) ^ (s_a >> 19) ^ s_d
    s_b = w_1 ^ s_a
    w_3 = s_a ^ u32(s_a << 11)
    iv_bytes[1] = (s_d >> 24) & 0xFF

    s_d = (w_1 >> 8) ^ (s_a >> 19) ^ s_b
    s_a = s_c ^ s_d
    s_c = (s_c >> 8) ^ (s_d >> 19) ^ s_a
    s_d = s_d ^ u32(s_d << 11)
    w_1 = s_e ^ s_c
    iv_bytes[2] = (s_b >> 24) & 0xFF

    s_b = s_c ^ u32(s_c << 11)
    iv_bytes[3] = (s_a >> 24) & 0xFF

    s_a = (s_e >> 8) ^ (s_c >> 19) ^ w_1
    s_c = w_3 ^ s_a
    s_e = s_a ^ u32(s_a << 11)
    iv_bytes[4] = (w_1 >> 24) & 0xFF

    s_a = (w_3 >> 8) ^ (s_a >> 19) ^ s_c
    w_1 = s_d ^ s_a
    w_3 = s_a ^ u32(s_a << 11)
    iv_bytes[5] = (s_c >> 24) & 0xFF

    s_a = (s_d >> 8) ^ (s_a >> 19) ^ w_1
    s_c = s_b ^ s_a
    s_d = s_a ^ u32(s_a << 11)
    iv_bytes[6] = (w_1 >> 24) & 0xFF

    s_b = (s_b >> 8) ^ (s_a >> 19) ^ s_c
    s_a = s_b ^ u32(s_b << 11)
    s_b = s_e ^ (s_e >> 8) ^ s_b
    w_1 = w_3 ^ (w_3 >> 8) ^ s_b
    iv_bytes[7] = (s_c >> 24) & 0xFF

    # IV bytes 8..15 (byte-level cross-mixing)
    m_c = (s_b >> 24) & 0xFF
    iv_bytes[8] = m_c

    s_c = s_d ^ (s_d >> 8) ^ w_1
    m_b = (w_1 >> 24) & 0xFF
    iv_bytes[9] = m_b

    m_a = (s_c >> 24) & 0xFF
    iv_bytes[10] = m_a

    s_a = s_a ^ (s_a >> 8) ^ s_c
    m_d = (s_a >> 24) & 0xFF
    m_c = (m_c ^ (((s_b << 11) >> 24) & 0xFF) ^ m_d) & 0xFF
    iv_bytes[11] = m_d

    m_b = (m_b ^ (((w_1 << 11) >> 24) & 0xFF) ^ m_c) & 0xFF
    iv_bytes[12] = m_c
    iv_bytes[13] = m_b

    m_b = (m_a ^ (((s_c << 11) >> 24) & 0xFF) ^ m_b) & 0xFF
    iv_bytes[14] = m_b
    iv_bytes[15] = (m_d ^ (((s_a << 11) >> 24) & 0xFF) ^ m_b) & 0xFF

    return bytes(key_bytes), bytes(iv_bytes)


def decrypt_splatoon3_save(input_path: str, output_path: str = None) -> bool:
    """Decrypt a Splatoon 3 save file and write the plaintext container to disk."""
    if output_path is None:
        output_path = input_path + ".dec"

    with open(input_path, "rb") as f:
        data = f.read()

    if len(data) < 8:
        print("[-] Invalid file.")
        return False

    seed, checksum = struct.unpack("<II", data[:8])
    ciphertext = data[8:]

    print(f"[*] Input file       : {input_path} ({len(data)} bytes)")
    print(f"[*] Seed             : 0x{seed:08X}")
    print(f"[*] Stored Checksum  : 0x{checksum:08X}")

    key, iv = derive_key_and_iv(seed)
    print(f"[*] Derived Key      : {key.hex().upper()}")
    print(f"[*] Derived IV       : {iv.hex().upper()}")

    # AES-256-CTR decryption using the 128-bit IV as initial counter value
    ctr = Counter.new(128, initial_value=int.from_bytes(iv, byteorder="big"))
    cipher = AES.new(key, AES.MODE_CTR, counter=ctr)
    plaintext = cipher.decrypt(ciphertext)

    magic = plaintext[:4]
    print(f"[*] Decrypted header : {magic.hex().upper()} ({plaintext[:2]})")

    if magic == b"MS\x00\x04":
        print("[+] SUCCESS: MsgPack EPD v4 format confirmed!")
    else:
        print("[-] Error: unexpected header (check your TABLE_HEX).")

    with open(output_path, "wb") as f:
        f.write(plaintext)
    print(f"[+] Decrypted save written to: {output_path}")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python splat3_decrypt.py <save.dat> [save.dat.dec]")
    else:
        out = sys.argv[2] if len(sys.argv) > 2 else None
        decrypt_splatoon3_save(sys.argv[1], out)

```

## Container Format After Decryption

After stripping the 8-byte `MS\x00\x04` container header, the payload uses the public **MessagePack** serialization format. You can unpack it to JSON using standard `msgpack`:

```python
import base64
import json
import sys
from pathlib import Path

import msgpack


class EPDJsonEncoder(json.JSONEncoder):
    """Encode binary objects (bytes) as Base64 for JSON output."""

    def default(self, obj):
        if isinstance(obj, bytes):
            return {"__b64__": base64.b64encode(obj).decode("ascii")}
        return super().default(obj)


def _try_unpack(raw_data: bytes, offset: int, raw_mode: bool):
    """Attempt to unpack one MsgPack object starting at offset."""
    if offset >= len(raw_data):
        return None
    try:
        unpacker = msgpack.Unpacker(raw=raw_mode, strict_map_key=False)
        unpacker.feed(raw_data[offset:])
        obj = unpacker.unpack()
        return obj, unpacker.tell()
    except Exception:
        return None


def ms_to_json(input_path: str, output_path: str = None) -> bool:
    in_file = Path(input_path)
    if not in_file.exists():
        print(f"[-] File not found: {input_path}")
        return False

    out_file = in_file.with_suffix(".json") if output_path is None else Path(output_path)

    with open(in_file, "rb") as f:
        raw_data = f.read()

    if len(raw_data) < 8 or raw_data[:2] != b"MS":
        print(f"[-] Invalid MS header: {raw_data[:4].hex().upper()}")
        return False

    version = int.from_bytes(raw_data[2:4], byteorder="big")
    meta_val = int.from_bytes(raw_data[4:8], byteorder="little")
    print(f"[*] Header: MS (version {version}) | alloc size: 0x{meta_val:08X}")

    candidate_offsets = [8, 12, 4]
    unpacked_data = None
    consumed_bytes = 0

    for raw_mode, label in ((False, "text"), (True, "raw")):
        for offset in candidate_offsets:
            result = _try_unpack(raw_data, offset, raw_mode)
            if result is None:
                continue
            unpacked_data, consumed_bytes = result
            print(
                f"[+] MsgPack detected ({label} mode) at offset 0x{offset:02X} "
                f"({consumed_bytes} bytes consumed)"
            )
            break
        if unpacked_data is not None:
            break

    if unpacked_data is None:
        print("[-] Could not locate a valid MessagePack stream in the decrypted file.")
        return False

    with open(out_file, "w", encoding="utf-8") as out:
        json.dump(unpacked_data, out, indent=2, ensure_ascii=False, cls=EPDJsonEncoder)

    print(f"[+] JSON file written: {out_file} ({out_file.stat().st_size} bytes)")
    return True


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ms_to_json.py <save.dat.dec> [save.json]")
        sys.exit(1)

    target_out = sys.argv[2] if len(sys.argv) > 2 else None
    ms_to_json(sys.argv[1], target_out)

```

## Key Name Hashing (MurmurHash3)

In the unpacked JSON, all dictionary keys appear as 32-bit integers rather than strings. To save space and speed up lookups, the engine hashes parameter names using standard **MurmurHash3_x86_32** (with `seed = 0`).

You can resolve these hashes back to readable field names by building a dictionary from strings extracted from your own binary dump:

```python
import json
import struct
import sys
from pathlib import Path


def murmurhash3_32(key: str, seed: int = 0) -> int:
    """Standard MurmurHash3_x86_32 implementation."""
    data = key.encode("utf-8")
    length = len(data)
    nblocks = length // 4

    h1 = seed
    c1 = 0xCC9E2D51
    c2 = 0x1B873593

    for i in range(nblocks):
        k1 = struct.unpack_from("<I", data, i * 4)[0]
        k1 = (k1 * c1) & 0xFFFFFFFF
        k1 = ((k1 << 15) | (k1 >> 17)) & 0xFFFFFFFF
        k1 = (k1 * c2) & 0xFFFFFFFF

        h1 ^= k1
        h1 = ((h1 << 13) | (h1 >> 19)) & 0xFFFFFFFF
        h1 = (h1 * 5 + 0xE6546B64) & 0xFFFFFFFF

    tail_index = nblocks * 4
    k1 = 0
    tail_size = length & 3

    if tail_size == 3:
        k1 ^= data[tail_index + 2] << 16
    if tail_size >= 2:
        k1 ^= data[tail_index + 1] << 8
    if tail_size >= 1:
        k1 ^= data[tail_index]
        k1 = (k1 * c1) & 0xFFFFFFFF
        k1 = ((k1 << 15) | (k1 >> 17)) & 0xFFFFFFFF
        k1 = (k1 * c2) & 0xFFFFFFFF
        h1 ^= k1

    h1 ^= length
    h1 ^= h1 >> 16
    h1 = (h1 * 0x85EBCA6B) & 0xFFFFFFFF
    h1 ^= h1 >> 13
    h1 = (h1 * 0xC2B2AE35) & 0xFFFFFFFF
    h1 ^= h1 >> 16

    return h1


KNOWN_WORDS = [
    # Core SaveData keys
    "SaveDataLocalUniqueId", "NplnUserId", "Version", "PlayTime",
    "LastPlayTime", "PlayerName", "PlayerId", "Rank", "Exp",
    "Money", "SuperSeaSnail", "Gold",
    # Inventory & Gear
    "Weapon", "HeadGear", "ClothesGear", "ShoesGear", "GearSkill",
    "MainSkill", "SubSkill0", "SubSkill1", "SubSkill2", "Favorite", "HaveList",
    # Single Player & Misc
    "World", "Stage", "Clear", "Score", "CollectedItem",
    "PowerCore", "SalmonRun", "Locker", "LockerInfo", "Coordinates",
    "BootCount", "Common",
]
HASH_MAP = {str(murmurhash3_32(word)): word for word in KNOWN_WORDS}


def translate_tree(node, hash_dict):
    if isinstance(node, dict):
        return {
            hash_dict.get(str(k), str(k)): translate_tree(v, hash_dict)
            for k, v in node.items()
        }
    elif isinstance(node, list):
        return [translate_tree(elem, hash_dict) for elem in node]
    return node


def load_custom_wordlist(wordlist_path: str):
    if Path(wordlist_path).exists():
        with open(wordlist_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                word = line.strip()
                if word:
                    HASH_MAP[str(murmurhash3_32(word))] = word
        print(f"[*] Loaded {len(HASH_MAP)} strings.")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python unhash_json.py <file.json> [wordlist.txt]")
        sys.exit(1)

    json_file = Path(sys.argv[1])
    if len(sys.argv) > 2:
        load_custom_wordlist(sys.argv[2])

    with open(json_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    translated = translate_tree(data, HASH_MAP)

    out_file = json_file.with_name(json_file.stem + "_named.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(translated, f, indent=2, ensure_ascii=False)

    print(f"[+] Generated: {out_file}")

```

## Integrity Verification Overview

At offset `0x04`, the file stores a 32-bit integrity check (`Checksum`) validated before the MessagePack stream is parsed. Rather than providing a re-signing tool, here is how the verification is structured conceptually:

* **Digest algorithm:** The game computes a standard `MurmurHash3_x86_32` over the entire encrypted `Ciphertext` block (`0x08..EOF`), using the file's `Seed` (`0x00`) as the hash seed.
* **PRNG masking:** The resulting 32-bit digest is masked by adding (`u32` wrap-around) a 32-bit value derived from the initial 4-step PRNG state and lookup table entry (prior to generating the AES key/IV schedule).

And you are done 🔥🦑

Feel free to inspect and datamine the resulting JSON structure to see what is stored locally.
