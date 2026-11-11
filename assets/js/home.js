/* ============================================================
   Home page: GitHub stats, projects, timeline canvas, particles
   ============================================================ */
(function () {
  "use strict";

  var GITHUB_USERNAME = "Totgocpro";
  var API_BASE = "https://api.github.com";
  var SESSION_ID =
    "05e05acc5c28666c84902e1723cff73018364d19d4f8e02ae9d5ea2451c823710e";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(id) { return document.getElementById(id); }

  /* ---------- Toast ---------- */
  var toastEl = $("toast");
  var toastTimeout;
  function showToast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2200);
  }

  /* ---------- Session ID copy ---------- */
  var sessionBtn = $("sessionBtn");
  if (sessionBtn) {
    sessionBtn.addEventListener("click", function () {
      var ok = function () {
        sessionBtn.classList.add("copied");
        showToast("✓ Session ID copied to clipboard");
        setTimeout(function () { sessionBtn.classList.remove("copied"); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(SESSION_ID).then(ok).catch(function () {
          showToast("Failed to copy Session ID");
        });
      } else {
        showToast("Failed to copy Session ID");
      }
    });
  }

  /* ---------- Helpers ---------- */
  function formatDate(iso) {
    var d = new Date(iso);
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m[d.getMonth()] + " " + d.getFullYear();
  }

  function animateValue(el, end, duration) {
    duration = duration || 800;
    var startTime = performance.now();
    function step(ts) {
      var p = Math.min((ts - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = end.toLocaleString();
    }
    requestAnimationFrame(step);
  }

  function ghFetch(path) {
    return fetch(API_BASE + path, {
      headers: { Accept: "application/vnd.github.v3+json" }
    }).then(function (res) {
      if (!res.ok) throw new Error("GitHub request failed: " + path);
      return res.json();
    });
  }

  /* ---------- Stats + profile ---------- */
  function fetchStats() {
    var statRepos = $("stat-repos");
    if (!statRepos) return;
    var statFollowers = $("stat-followers");
    var statFollowing = $("stat-following");
    var statStars = $("stat-stars");
    var statForks = $("stat-forks");
    var statJoined = $("stat-joined");
    var statCommits = $("stat-commits");
    var errorMsg = $("error-msg");
    var displayNameEl = $("displayName");
    var handleEl = $("handle");
    var bioEl = $("bio");

    ghFetch("/users/" + GITHUB_USERNAME)
      .then(function (userData) {
        if (displayNameEl && userData.name) displayNameEl.textContent = userData.name;
        if (handleEl) handleEl.textContent = "@" + userData.login;
        if (bioEl && userData.bio) bioEl.textContent = userData.bio;
        if (userData.name) {
          document.title = userData.name + " ; C++ / Fullstack Developer";
        }

        animateValue(statRepos, userData.public_repos || 0);
        if (statFollowers) animateValue(statFollowers, userData.followers || 0);
        if (statFollowing) animateValue(statFollowing, userData.following || 0);
        if (statJoined) statJoined.textContent = formatDate(userData.created_at);

        return ghFetch(
          "/users/" + GITHUB_USERNAME + "/repos?per_page=100&sort=updated"
        );
      })
      .then(function (repos) {
        var stars = 0, forks = 0;
        repos.forEach(function (r) {
          stars += r.stargazers_count || 0;
          forks += r.forks_count || 0;
        });
        if (statStars) animateValue(statStars, stars, 1000);
        if (statForks) animateValue(statForks, forks, 1000);

        var toCheck = repos.slice(0, 12);
        var proms = toCheck.map(function (repo) {
          return ghFetch(
            "/repos/" + GITHUB_USERNAME + "/" + repo.name + "/commits?per_page=1"
          )
            .then(function (data) { return Array.isArray(data) ? data.length : 0; })
            .catch(function () { return 0; });
        });
        return Promise.all(proms);
      })
      .then(function (counts) {
        if (!statCommits) return;
        var total = counts.reduce(function (a, b) { return a + b; }, 0);
        animateValue(statCommits, total, 1000);
      })
      .catch(function (err) {
        console.error(err);
        if (errorMsg) {
          errorMsg.style.display = "block";
          errorMsg.textContent = "⚠️ Could not load live stats.";
        }
        ["repos", "followers", "following", "stars", "forks", "joined", "commits"].forEach(
          function (id) {
            var el = $("stat-" + id);
            if (el) el.textContent = ";";
          }
        );
      });
  }

  /* ---------- Projects grid ---------- */
  function fetchProjects() {
    var grid = $("projects-grid");
    if (!grid) return;

    ghFetch("/users/" + GITHUB_USERNAME + "/repos?per_page=100&sort=updated")
      .then(function (repos) {
        var picked = repos
          .filter(function (r) { return !r.fork && !r.archived; })
          .sort(function (a, b) {
            if (b.stargazers_count !== a.stargazers_count) {
              return b.stargazers_count - a.stargazers_count;
            }
            return new Date(b.pushed_at) - new Date(a.pushed_at);
          })
          .slice(0, 6);

        if (!picked.length) {
          grid.innerHTML =
            '<p class="error-badge" style="display:block">No public repositories found.</p>';
          return;
        }

        grid.innerHTML = picked
          .map(function (r) {
            var desc = r.description
              ? r.description
              : "A project by " + GITHUB_USERNAME + ".";
            return (
              '<a class="project-card reveal visible" href="' +
              r.html_url +
              '" target="_blank" rel="noopener noreferrer">' +
              '<div class="project-head">' +
              "<h3>" +
              escapeHtml(r.name) +
              "</h3>" +
              '<span class="project-link"><i class="fas fa-arrow-up-right-from-square"></i></span>' +
              "</div>" +
              "<p>" +
              escapeHtml(desc) +
              "</p>" +
              '<div class="project-meta">' +
              (r.language
                ? '<span><i class="fas fa-code"></i> ' + escapeHtml(r.language) + "</span>"
                : "") +
              '<span><i class="fas fa-star"></i> ' + (r.stargazers_count || 0) + "</span>" +
              '<span><i class="fas fa-code-branch"></i> ' + (r.forks_count || 0) + "</span>" +
              "</div>" +
              "</a>"
            );
          })
          .join("");
      })
      .catch(function (err) {
        console.error(err);
        grid.innerHTML =
          '<p class="error-badge" style="display:block">⚠️ Could not load projects.</p>';
      });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ---------- Timeline: connecting line + travelling dot ---------- */
  var canvas = $("timeline-canvas");
  var timelineWrapper = $("timeline-wrapper");
  var slides = document.querySelectorAll(".timeline-slide");
  var ctx = canvas ? canvas.getContext("2d") : null;
  var circles = [];
  var snapTimeout;
  var isSnapping = false;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function updateCircles() {
    var circleEls = document.querySelectorAll(".timeline-circle");
    circles = Array.prototype.map.call(circleEls, function (el, i) {
      var rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2 + window.scrollY,
        index: i
      };
    });
  }

  function getDotPosition(progress) {
    if (!circles.length) return { x: 0, y: 0 };
    if (progress <= 0) return { x: circles[0].x, y: circles[0].y - window.scrollY };
    if (progress >= 1) {
      var last = circles[circles.length - 1];
      return { x: last.x, y: last.y - window.scrollY };
    }
    var totalSeg = circles.length - 1;
    var segFloat = progress * totalSeg;
    var segIdx = Math.min(Math.floor(segFloat), totalSeg - 1);
    var t = segFloat - segIdx;
    var c1 = circles[segIdx], c2 = circles[segIdx + 1];
    return {
      x: c1.x + (c2.x - c1.x) * t,
      y: c1.y + (c2.y - c1.y) * t - window.scrollY
    };
  }

  function drawCanvas() {
    if (!ctx || !timelineWrapper || !circles.length) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var scrollY = window.scrollY;
    var wrapperTop = timelineWrapper.getBoundingClientRect().top + scrollY;
    var viewH = window.innerHeight;
    var wrapperHeight = timelineWrapper.offsetHeight;

    if (circles.length > 1) {
      ctx.strokeStyle = "rgba(34, 211, 238, 0.4)";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      for (var i = 0; i < circles.length - 1; i++) {
        ctx.moveTo(circles[i].x, circles[i].y - scrollY);
        ctx.lineTo(circles[i + 1].x, circles[i + 1].y - scrollY);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    var progressStart = wrapperTop;
    var progressEnd = wrapperTop + wrapperHeight - viewH;
    var progress = (scrollY - progressStart) / (progressEnd - progressStart);
    progress = Math.max(0, Math.min(1, progress));

    var trailSteps = 6;
    for (var s = trailSteps; s > 0; s--) {
      var tp = Math.max(0, progress - s * 0.015);
      var pos = getDotPosition(tp);
      var alpha = 0.2 * (1 - s / (trailSteps + 1));
      var radius = 8 * (1 - s / (trailSteps + 1));
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(34, 211, 238, " + alpha + ")";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 10 * (1 - s / (trailSteps + 1));
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    var main = getDotPosition(progress);
    ctx.beginPath();
    ctx.arc(main.x, main.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(34, 211, 238, 0.28)";
    ctx.fill();
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 25;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  function getCurrentSlideIndex() {
    var closest = 0;
    var minDist = Infinity;
    var viewCenter = window.innerHeight / 2;
    Array.prototype.forEach.call(slides, function (slide, idx) {
      var rect = slide.getBoundingClientRect();
      var dist = Math.abs(rect.top + rect.height / 2 - viewCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });
    return closest;
  }

  function snapToSlide(index) {
    if (isSnapping || !timelineWrapper) return;
    var slide = slides[index];
    if (!slide) return;
    var wrapperRect = timelineWrapper.getBoundingClientRect();
    var onTimeline =
      wrapperRect.top < window.innerHeight && wrapperRect.bottom > 0;
    if (!onTimeline) return;
    isSnapping = true;
    slide.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(function () { isSnapping = false; }, 550);
  }

  function bindTimeline() {
    if (!timelineWrapper || !slides.length) return;

    window.addEventListener(
      "wheel",
      function (e) {
        if (reduceMotion) return;
        if (isSnapping) isSnapping = false;
        var wrapperRect = timelineWrapper.getBoundingClientRect();
        var onTimeline =
          wrapperRect.top < window.innerHeight && wrapperRect.bottom > 0;
        if (!onTimeline) return;
        clearTimeout(snapTimeout);
        var dir = e.deltaY > 0 ? 1 : -1;
        var viewH = window.innerHeight;
        var enteringFromTop = wrapperRect.top > 0 && dir > 0;
        var enteringFromBottom = wrapperRect.bottom < viewH && dir < 0;
        var target;
        if (enteringFromTop) {
          target = 0;
        } else if (enteringFromBottom) {
          target = slides.length - 1;
        } else {
          var current = getCurrentSlideIndex();
          target = Math.max(0, Math.min(slides.length - 1, current + dir));
        }
        var now = getCurrentSlideIndex();
        if (target !== now) {
          snapTimeout = setTimeout(function () { snapToSlide(target); }, 50);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "scroll",
      function () {
        updateCircles();
        drawCanvas();
      },
      { passive: true }
    );
  }

  /* ---------- Particle network background ---------- */
  function initParticles() {
    var net = $("network-canvas");
    if (!net) return;
    var nctx = net.getContext("2d");
    var particles = [];
    var mouse = { x: -1000, y: -1000 };
    var COUNT = window.innerWidth < 768 ? 40 : 80;
    var CONNECT_DIST = 150;
    var MOUSE_CONNECT_DIST = 200;

    function resize() {
      net.width = window.innerWidth;
      net.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function Particle() {
      this.x = Math.random() * net.width;
      this.y = Math.random() * net.height;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = 1.5 + Math.random() * 2;
    }
    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > net.width) this.vx *= -1;
      if (this.y < 0 || this.y > net.height) this.vy *= -1;
    };
    Particle.prototype.draw = function () {
      nctx.beginPath();
      nctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      nctx.fillStyle = "rgba(34, 211, 238, 0.6)";
      nctx.shadowColor = "#22d3ee";
      nctx.shadowBlur = 6;
      nctx.fill();
      nctx.shadowBlur = 0;
    };

    for (var i = 0; i < COUNT; i++) particles.push(new Particle());

    function drawLines() {
      for (var i = 0; i < particles.length; i++) {
        for (var j = i + 1; j < particles.length; j++) {
          var dx = particles[i].x - particles[j].x;
          var dy = particles[i].y - particles[j].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            nctx.beginPath();
            nctx.moveTo(particles[i].x, particles[i].y);
            nctx.lineTo(particles[j].x, particles[j].y);
            nctx.strokeStyle =
              "rgba(34, 211, 238, " + (1 - dist / CONNECT_DIST) * 0.3 + ")";
            nctx.lineWidth = 0.8;
            nctx.stroke();
          }
        }
        var mdx = particles[i].x - mouse.x;
        var mdy = particles[i].y - mouse.y;
        var mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < MOUSE_CONNECT_DIST) {
          nctx.beginPath();
          nctx.moveTo(particles[i].x, particles[i].y);
          nctx.lineTo(mouse.x, mouse.y);
          nctx.strokeStyle =
            "rgba(56, 189, 248, " + (1 - mdist / MOUSE_CONNECT_DIST) * 0.6 + ")";
          nctx.lineWidth = 1.2;
          nctx.shadowColor = "#38bdf8";
          nctx.shadowBlur = 10;
          nctx.stroke();
          nctx.shadowBlur = 0;
        }
      }
    }

    function animate() {
      nctx.clearRect(0, 0, net.width, net.height);
      particles.forEach(function (p) {
        p.update();
        p.draw();
      });
      drawLines();
      requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    document.addEventListener("mouseleave", function () {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    if (reduceMotion) {
      nctx.clearRect(0, 0, net.width, net.height);
      particles.forEach(function (p) { p.draw(); });
      drawLines();
    } else {
      animate();
    }
  }

  /* ---------- Boot ---------- */
  window.addEventListener("load", function () {
    resizeCanvas();
    updateCircles();
    drawCanvas();
    fetchStats();
    fetchProjects();
  });

  window.addEventListener("resize", function () {
    resizeCanvas();
    updateCircles();
    drawCanvas();
  });

  bindTimeline();
  initParticles();
})();
