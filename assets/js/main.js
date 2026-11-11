/* ============================================================
   Shared site behaviour: theme, nav, reveal, filters, code blocks
   ============================================================ */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById("theme-toggle");

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch (e) {}
    if (!themeBtn) return;
    var icon = themeBtn.querySelector("i");
    var isDark = theme === "dark";
    if (icon) icon.className = isDark ? "fas fa-moon" : "fas fa-sun";
    themeBtn.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  if (themeBtn) {
    applyTheme(root.getAttribute("data-theme") || "dark");
    themeBtn.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      applyTheme(next);
    });
  }

  /* ---------- Topbar scroll state ---------- */
  var topbar = document.getElementById("topbar");
  function onScroll() {
    if (!topbar) return;
    topbar.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  var navToggle = document.getElementById("nav-toggle");
  var nav = document.getElementById("site-nav");

  function closeNav() {
    if (!nav || !navToggle) return;
    nav.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
    navToggle.setAttribute("aria-label", "Open menu");
    var icon = navToggle.querySelector("i");
    if (icon) icon.className = "fas fa-bars";
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      var icon = navToggle.querySelector("i");
      if (icon) icon.className = open ? "fas fa-xmark" : "fas fa-bars";
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeNav();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) closeNav();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("visible"); });
    } else {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              io.unobserve(entry.target);
            }
          });
        },
        {         threshold: 0, rootMargin: "0px 0px -40px 0px" }
      );
      revealEls.forEach(function (el) { io.observe(el); });
    }
  }

  /* ---------- Blog tag filter ---------- */
  var filterBar = document.getElementById("tag-filter");
  var postGrid = document.getElementById("post-grid");
  if (filterBar && postGrid) {
    var buttons = filterBar.querySelectorAll(".filter-btn");
    var cards = postGrid.querySelectorAll(".post-card");
    var empty = document.getElementById("empty-state");

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tag = btn.getAttribute("data-tag");
        buttons.forEach(function (b) {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });

        var visible = 0;
        cards.forEach(function (card) {
          var tags = (card.getAttribute("data-tags") || "").split("|");
          var show = tag === "all" || tags.indexOf(tag) !== -1;
          card.style.display = show ? "" : "none";
          if (show) visible++;
        });
        if (empty) empty.classList.toggle("show", visible === 0);
      });
    });
  }

  /* ---------- Code blocks: header, line numbers, wrap, copy ---------- */
  var LANG_NAMES = {
    text: "Text", plaintext: "Text", plain: "Text",
    py: "Python", python: "Python",
    bash: "Bash", sh: "Shell", shell: "Shell", zsh: "Shell",
    c: "C", cpp: "C++", "c++": "C++", h: "C", hpp: "C++",
    js: "JavaScript", javascript: "JavaScript",
    ts: "TypeScript", typescript: "TypeScript",
    json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", ini: "INI",
    xml: "XML", html: "HTML", css: "CSS",
    go: "Go", rust: "Rust", rs: "Rust", java: "Java",
    rb: "Ruby", ruby: "Ruby", php: "PHP",
    cs: "C#", csharp: "C#", sql: "SQL", diff: "Diff",
    md: "Markdown", markdown: "Markdown",
    lua: "Lua", kt: "Kotlin", swift: "Swift", dart: "Dart",
    r: "R", perl: "Perl", make: "Makefile", dockerfile: "Dockerfile"
  };

  function splitLines(pre) {
    var code = pre.querySelector("code") || pre;
    var raw = code.textContent;
    if (code.dataset.split === "1") return;

    var lines = raw.split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    if (!lines.length) return;

    code.dataset.raw = raw;
    code.dataset.split = "1";
    code.textContent = "";

    lines.forEach(function (line) {
      var span = document.createElement("span");
      span.className = "cl";
      span.textContent = line || " ";
      code.appendChild(span);
    });
  }

  function detectLang(pre) {
    var cls = pre.closest(".highlighter-rouge");
    var m = null;
    if (cls) m = cls.className.match(/language-([\w+#-]+)/);
    if (!m) m = (pre.querySelector("code") || pre).className.match(/language-([\w+#-]+)/);
    return m ? m[1].toLowerCase() : "";
  }

  function enhanceCodeBlock(pre) {
    if (pre.closest(".code-head")) return;
    if (pre.dataset.enhanced === "1") return;
    pre.dataset.enhanced = "1";

    splitLines(pre);

    var code = pre.querySelector("code") || pre;
    var lineCount = code.querySelectorAll(".cl").length ||
      (code.textContent.split("\n").length);
    if (lineCount >= 10) pre.classList.add("numbered");

    var lang = detectLang(pre);
    var langName = LANG_NAMES[lang] || (lang ? lang : "Code");

    var head = document.createElement("div");
    head.className = "code-head";

    var langEl = document.createElement("span");
    langEl.className = "code-lang";
    langEl.textContent = langName;
    head.appendChild(langEl);

    if (lineCount > 1) {
      var count = document.createElement("span");
      count.className = "code-count";
      count.textContent = lineCount + (lineCount === 1 ? " line" : " lines");
      head.appendChild(count);
    }

    var actions = document.createElement("div");
    actions.className = "code-actions";

    if (lineCount >= 5) {
      var wrapBtn = document.createElement("button");
      wrapBtn.type = "button";
      wrapBtn.className = "code-btn";
      wrapBtn.textContent = "Wrap";
      wrapBtn.setAttribute("aria-label", "Toggle line wrapping");
      wrapBtn.setAttribute("aria-pressed", "false");
      wrapBtn.addEventListener("click", function () {
        var on = pre.classList.toggle("wrapped");
        wrapBtn.classList.toggle("active", on);
        wrapBtn.setAttribute("aria-pressed", on ? "true" : "false");
      });
      actions.appendChild(wrapBtn);
    }

    var copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-btn";
    copyBtn.textContent = "Copy";
    copyBtn.setAttribute("aria-label", "Copy code to clipboard");
    copyBtn.addEventListener("click", function () {
      var text = code.dataset.raw != null ? code.dataset.raw : code.textContent;
      var done = function () {
        copyBtn.textContent = "Copied!";
        copyBtn.classList.add("copied");
        setTimeout(function () {
          copyBtn.textContent = "Copy";
          copyBtn.classList.remove("copied");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () {
          fallbackCopy(text, done);
        });
      } else {
        fallbackCopy(text, done);
      }
    });
    actions.appendChild(copyBtn);
    head.appendChild(actions);

    var host = pre.closest("div.highlighter-rouge");
    if (host) {
      host.insertBefore(head, host.firstChild);
    } else {
      var wrapDiv = document.createElement("div");
      wrapDiv.className = "code-block";
      pre.parentNode.insertBefore(wrapDiv, pre);
      wrapDiv.appendChild(head);
      wrapDiv.appendChild(pre);
    }
  }

  document.querySelectorAll(".post-body pre").forEach(enhanceCodeBlock);

  /* ---------- GitHub alerts: > [!NOTE] etc. ---------- */
  document.querySelectorAll(".post-body blockquote").forEach(function (bq) {
    var first = bq.querySelector("p");
    if (!first) return;
    var node = first.firstChild;
    if (!node || node.nodeType !== 3) return;
    var m = node.nodeValue.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);
    if (!m) return;

    var type = m[1].toLowerCase();
    node.nodeValue = node.nodeValue.slice(m[0].length);

    if (node.nodeType === 3 && !node.nodeValue.trim()) {
      first.removeChild(node);
    }
    if (first.hasChildNodes()) {
      var bodyP = document.createElement("p");
      while (first.lastChild) bodyP.insertBefore(first.lastChild, bodyP.firstChild);
      first.parentNode.insertBefore(bodyP, first.nextSibling);
    }

    first.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    first.classList.add("alert-title");
    bq.classList.add("alert", "alert-" + type);
  });

  /* ---------- Heading anchors ---------- */
  document.querySelectorAll(".post-body h2, .post-body h3, .post-body h4").forEach(function (h) {
    if (h.dataset.anchor === "1") return;
    h.dataset.anchor = "1";
    var id = h.id || (h.textContent || "").toLowerCase().replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
    if (!id) return;
    if (!h.id) h.id = id;
    var a = document.createElement("a");
    a.className = "anchor";
    a.href = "#" + id;
    a.textContent = "#";
    a.setAttribute("aria-label", "Link to this section");
    h.appendChild(a);
  });

  function fallbackCopy(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }
})();
