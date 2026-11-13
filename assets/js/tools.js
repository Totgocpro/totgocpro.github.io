(function () {
  "use strict";

  var TOOLS = [
    {
      id: "json-formatter",
      name: "JSON Formatter",
      icon: "fas fa-brackets-curly",
      tag: "Dev",
      description: "Pretty-print or minify JSON, with live error reporting.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-field">' +
          '<label class="tool-label" for="jf-input">Input</label>' +
          '<textarea class="tool-textarea" id="jf-input" spellcheck="false" placeholder=\'{"hello":"world"}\'></textarea>' +
          '<p class="tool-error" id="jf-error"></p>' +
          "</div>" +
          '<div class="tool-row">' +
          '<button class="btn btn-primary btn-sm" id="jf-format" type="button"><i class="fas fa-align-left" aria-hidden="true"></i> Format</button>' +
          '<button class="btn btn-outline btn-sm" id="jf-minify" type="button">Minify</button>' +
          '<button class="btn btn-ghost btn-sm" id="jf-clear" type="button">Clear</button>' +
          "</div>" +
          '<div class="tool-field"><span class="tool-label">Output</span><div class="tool-output" id="jf-output"></div></div>';

        var input = root.querySelector("#jf-input");
        var output = root.querySelector("#jf-output");
        var error = root.querySelector("#jf-error");

        function parse() {
          error.classList.remove("show");
          error.textContent = "";
          try {
            return JSON.parse(input.value);
          } catch (e) {
            error.textContent = e.message;
            error.classList.add("show");
            return undefined;
          }
        }

        function run(spacing) {
          var data = parse();
          if (data === undefined) return;
          output.textContent = JSON.stringify(data, null, spacing);
        }

        root.querySelector("#jf-format").addEventListener("click", function () { run(2); });
        root.querySelector("#jf-minify").addEventListener("click", function () { run(0); });
        root.querySelector("#jf-clear").addEventListener("click", function () {
          input.value = "";
          output.textContent = "";
          error.classList.remove("show");
        });
      }
    },
    {
      id: "base64",
      name: "Base64 Codec",
      icon: "fas fa-layer-group",
      tag: "Dev",
      description: "Encode text to Base64 or decode it back, Unicode-safe.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-field">' +
          '<label class="tool-label" for="b64-input">Input</label>' +
          '<textarea class="tool-textarea" id="b64-input" spellcheck="false"></textarea>' +
          '<p class="tool-error" id="b64-error"></p>' +
          "</div>" +
          '<div class="tool-row">' +
          '<button class="btn btn-primary btn-sm" id="b64-enc" type="button"><i class="fas fa-lock" aria-hidden="true"></i> Encode</button>' +
          '<button class="btn btn-outline btn-sm" id="b64-dec" type="button"><i class="fas fa-unlock" aria-hidden="true"></i> Decode</button>' +
          "</div>" +
          '<div class="tool-field"><span class="tool-label">Output</span><div class="tool-output" id="b64-output"></div></div>';

        var input = root.querySelector("#b64-input");
        var output = root.querySelector("#b64-output");
        var error = root.querySelector("#b64-error");

        function fail(msg) {
          error.textContent = msg;
          error.classList.add("show");
        }

        root.querySelector("#b64-enc").addEventListener("click", function () {
          error.classList.remove("show");
          var bytes = new TextEncoder().encode(input.value);
          var binary = "";
          for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          output.textContent = btoa(binary);
        });

        root.querySelector("#b64-dec").addEventListener("click", function () {
          error.classList.remove("show");
          try {
            var binary = atob(input.value.trim());
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            output.textContent = new TextDecoder().decode(bytes);
          } catch (e) {
            fail("Invalid Base64 string.");
            output.textContent = "";
          }
        });
      }
    },
    {
      id: "password",
      name: "Password Generator",
      icon: "fas fa-key",
      tag: "Security",
      description: "Generate strong random passwords right in your browser.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-row">' +
          '<div><label class="tool-label" for="pw-length">Length: <span id="pw-length-val">16</span></label>' +
          '<input type="range" id="pw-length" min="4" max="64" value="16" style="accent-color: var(--cyan);"></div>' +
          "</div>" +
          '<div class="tool-row">' +
          '<label class="tool-choice"><input type="checkbox" id="pw-upper" checked> A-Z</label>' +
          '<label class="tool-choice"><input type="checkbox" id="pw-lower" checked> a-z</label>' +
          '<label class="tool-choice"><input type="checkbox" id="pw-digits" checked> 0-9</label>' +
          '<label class="tool-choice"><input type="checkbox" id="pw-symbols" checked> Symbols</label>' +
          "</div>" +
          '<div class="tool-row">' +
          '<button class="btn btn-primary btn-sm" id="pw-gen" type="button"><i class="fas fa-dice" aria-hidden="true"></i> Generate</button>' +
          '<button class="btn btn-outline btn-sm" id="pw-copy" type="button"><i class="fas fa-copy" aria-hidden="true"></i> Copy</button>' +
          "</div>" +
          '<div class="tool-output" id="pw-output" style="font-size:1.05rem; letter-spacing:0.05em;"></div>' +
          '<p class="tool-hint" id="pw-entropy"></p>';

        var length = root.querySelector("#pw-length");
        var lengthVal = root.querySelector("#pw-length-val");
        var output = root.querySelector("#pw-output");
        var entropy = root.querySelector("#pw-entropy");
        var lastPassword = "";

        var SETS = {
          upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
          lower: "abcdefghijklmnopqrstuvwxyz",
          digits: "0123456789",
          symbols: "!@#$%^&*()-_=+[]{};:,.<>?"
        };

        length.addEventListener("input", function () { lengthVal.textContent = length.value; });

        function generate() {
          var pool = "";
          Object.keys(SETS).forEach(function (key) {
            if (root.querySelector("#pw-" + key).checked) pool += SETS[key];
          });
          if (!pool) {
            output.textContent = "Select at least one character set.";
            lastPassword = "";
            return;
          }
          var chars = new Uint32Array(Number(length.value));
          crypto.getRandomValues(chars);
          var pw = "";
          for (var i = 0; i < chars.length; i++) pw += pool[chars[i] % pool.length];
          lastPassword = pw;
          output.textContent = pw;
          var bits = Math.floor(Math.log2(pool.length) * chars.length);
          entropy.textContent = "~" + bits + " bits of entropy (" + pool.length + " possible characters).";
        }

        root.querySelector("#pw-gen").addEventListener("click", generate);

        root.querySelector("#pw-copy").addEventListener("click", function () {
          if (!lastPassword) return;
          var btn = this;
          function done() {
            var original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
            setTimeout(function () { btn.innerHTML = original; }, 1500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(lastPassword).then(done).catch(done);
          } else { done(); }
        });

        generate();
      }
    },
    {
      id: "uuid",
      name: "UUID Generator",
      icon: "fas fa-fingerprint",
      tag: "Dev",
      description: "Batch-generate RFC 4122 v4 UUIDs with one click.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-row">' +
          '<div><label class="tool-label" for="uuid-count">Count</label>' +
          '<input class="tool-input" id="uuid-count" type="number" min="1" max="100" value="5" style="width:110px;"></div>' +
          '<button class="btn btn-primary btn-sm" id="uuid-gen" type="button" style="align-self:flex-end;"><i class="fas fa-plus" aria-hidden="true"></i> Generate</button>' +
          '<button class="btn btn-outline btn-sm" id="uuid-copy" type="button" style="align-self:flex-end;"><i class="fas fa-copy" aria-hidden="true"></i> Copy all</button>' +
          "</div>" +
          '<ul class="tool-list" id="uuid-list"></ul>';

        var list = root.querySelector("#uuid-list");

        function generate() {
          var count = Math.min(Math.max(Number(root.querySelector("#uuid-count").value) || 1, 1), 100);
          list.innerHTML = "";
          for (var i = 0; i < count; i++) {
            var li = document.createElement("li");
            li.textContent = crypto.randomUUID();
            list.appendChild(li);
          }
        }

        root.querySelector("#uuid-gen").addEventListener("click", generate);

        root.querySelector("#uuid-copy").addEventListener("click", function () {
          var values = Array.prototype.map.call(list.children, function (li) { return li.textContent; });
          if (!values.length) return;
          var btn = this;
          function done() {
            var original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
            setTimeout(function () { btn.innerHTML = original; }, 1500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(values.join("\n")).then(done).catch(done);
          } else { done(); }
        });

        generate();
      }
    },
    {
      id: "text-stats",
      name: "Text Statistics",
      icon: "fas fa-chart-simple",
      tag: "Text",
      description: "Count characters, words, lines and reading time as you type.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-field">' +
          '<label class="tool-label" for="ts-input">Text</label>' +
          '<textarea class="tool-textarea" id="ts-input" placeholder="Paste or type anything…"></textarea>' +
          "</div>" +
          '<div class="tool-stat-grid">' +
          '<div class="tool-stat"><strong id="ts-chars">0</strong><span>Chars</span></div>' +
          '<div class="tool-stat"><strong id="ts-chars-nospace">0</strong><span>No spaces</span></div>' +
          '<div class="tool-stat"><strong id="ts-words">0</strong><span>Words</span></div>' +
          '<div class="tool-stat"><strong id="ts-lines">0</strong><span>Lines</span></div>' +
          '<div class="tool-stat"><strong id="ts-read">0s</strong><span>Read time</span></div>' +
          "</div>";

        var input = root.querySelector("#ts-input");

        function update() {
          var text = input.value;
          var words = text.trim() ? text.trim().split(/\s+/).length : 0;
          var seconds = Math.round((words / 200) * 60);
          root.querySelector("#ts-chars").textContent = text.length;
          root.querySelector("#ts-chars-nospace").textContent = text.replace(/\s/g, "").length;
          root.querySelector("#ts-words").textContent = words;
          root.querySelector("#ts-lines").textContent = text ? text.split("\n").length : 0;
          root.querySelector("#ts-read").textContent = seconds < 60 ? seconds + "s" : Math.round(seconds / 60) + "min";
        }

        input.addEventListener("input", update);
        update();
      }
    },
    {
      id: "lorem",
      name: "Lorem Ipsum",
      icon: "fas fa-feather",
      tag: "Text",
      description: "Spit out placeholder paragraphs for mockups and wireframes.",
      render: function (root) {
        root.innerHTML =
          '<div class="tool-row">' +
          '<div><label class="tool-label" for="li-count">Paragraphs</label>' +
          '<input class="tool-input" id="li-count" type="number" min="1" max="20" value="3" style="width:110px;"></div>' +
          '<button class="btn btn-primary btn-sm" id="li-gen" type="button" style="align-self:flex-end;"><i class="fas fa-rotate" aria-hidden="true"></i> Generate</button>' +
          '<button class="btn btn-outline btn-sm" id="li-copy" type="button" style="align-self:flex-end;"><i class="fas fa-copy" aria-hidden="true"></i> Copy</button>' +
          "</div>" +
          '<div class="tool-output" id="li-output" style="max-height:400px;"></div>';

        var output = root.querySelector("#li-output");
        var sentences = [
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
          "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
          "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
          "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
          "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.",
          "Curabitur pretium tincidunt lacus, nulla gravida orci a odio.",
          "Nullam varius, turpis et commodo pharetra, est eros bibendum elit.",
          "Nunc luctus in metus eget fringilla, vitae interdum nunc blandit."
        ];

        function generate() {
          var count = Math.min(Math.max(Number(root.querySelector("#li-count").value) || 1, 1), 20);
          var paragraphs = [];
          for (var p = 0; p < count; p++) {
            var n = 4 + Math.floor(Math.random() * 4);
            var parts = [];
            for (var i = 0; i < n; i++) {
              parts.push(sentences[Math.floor(Math.random() * sentences.length)]);
            }
            paragraphs.push(parts.join(" "));
          }
          output.textContent = paragraphs.join("\n\n");
        }

        root.querySelector("#li-gen").addEventListener("click", generate);

        root.querySelector("#li-copy").addEventListener("click", function () {
          if (!output.textContent) return;
          var btn = this;
          function done() {
            var original = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copied!';
            setTimeout(function () { btn.innerHTML = original; }, 1500);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(output.textContent).then(done).catch(done);
          } else { done(); }
        });

        generate();
      }
    }
  ];

  var grid = document.getElementById("tool-grid");
  var empty = document.getElementById("tool-empty");
  var search = document.getElementById("tool-search");
  var tagBar = document.getElementById("tool-tags");
  var workbench = document.getElementById("workbench");
  var body = document.getElementById("workbench-body");
  var currentTag = "all";

  if (!grid) return;

  var stats = document.getElementById("tools-stats");
  if (stats) {
    var tags = TOOLS.map(function (t) { return t.tag; }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    stats.textContent = TOOLS.length + " tools · " + tags.join(" · ");
  }

  TOOLS.forEach(function (tool) {
    var card = document.createElement("button");
    card.type = "button";
    card.className = "tool-card reveal";
    card.dataset.id = tool.id;
    card.dataset.tag = tool.tag.toLowerCase();
    card.dataset.search = (tool.name + " " + tool.description + " " + tool.tag).toLowerCase();
    card.innerHTML =
      '<div class="tool-card-top">' +
      '<span class="tool-card-icon"><i class="' + tool.icon + '" aria-hidden="true"></i></span>' +
      '<span class="tag">' + tool.tag + "</span>" +
      "</div>" +
      "<h2>" + tool.name + "</h2>" +
      "<p>" + tool.description + "</p>" +
      '<span class="tool-card-open">Open <i class="fas fa-arrow-right" aria-hidden="true"></i></span>';
    card.addEventListener("click", function () { openTool(tool.id); });
    grid.appendChild(card);
    if (card.classList.contains("reveal")) card.classList.add("visible");
  });

  var uniqueTags = TOOLS.map(function (t) { return t.tag; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
  tagBar.innerHTML = '<button class="filter-btn active" type="button" data-tag="all" aria-pressed="true">All</button>';
  uniqueTags.forEach(function (tag) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "filter-btn";
    btn.dataset.tag = tag.toLowerCase();
    btn.setAttribute("aria-pressed", "false");
    btn.textContent = tag;
    tagBar.appendChild(btn);
  });

  tagBar.addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-btn");
    if (!btn) return;
    currentTag = btn.dataset.tag;
    Array.prototype.forEach.call(tagBar.children, function (b) {
      var active = b === btn;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    applyFilters();
  });

  search.addEventListener("input", applyFilters);

  function applyFilters() {
    var query = search.value.trim().toLowerCase();
    var visible = 0;
    Array.prototype.forEach.call(grid.children, function (card) {
      var matchTag = currentTag === "all" || card.dataset.tag === currentTag;
      var matchQuery = !query || card.dataset.search.indexOf(query) !== -1;
      var show = matchTag && matchQuery;
      card.hidden = !show;
      if (show) visible++;
    });
    empty.classList.toggle("show", visible === 0);
    grid.hidden = visible === 0;
  }

  function openTool(id) {
    var tool = TOOLS.filter(function (t) { return t.id === id; })[0];
    if (!tool) return;
    document.getElementById("workbench-name").textContent = tool.name;
    document.getElementById("workbench-icon").innerHTML = '<i class="' + tool.icon + '" aria-hidden="true"></i>';
    document.getElementById("workbench-tag").textContent = tool.tag;
    body.innerHTML = "";
    tool.render(body);
    workbench.hidden = false;
    grid.hidden = true;
    empty.classList.remove("show");
    document.querySelector(".tool-controls").hidden = true;
    if (history.replaceState) history.replaceState(null, "", "#" + id);
    workbench.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeTool() {
    workbench.hidden = true;
    body.innerHTML = "";
    document.querySelector(".tool-controls").hidden = false;
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    applyFilters();
    grid.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.getElementById("workbench-back").addEventListener("click", closeTool);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !workbench.hidden) closeTool();
  });

  applyFilters();

  var hash = location.hash.replace("#", "");
  if (hash && TOOLS.some(function (t) { return t.id === hash; })) openTool(hash);
})();
