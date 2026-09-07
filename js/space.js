(function () {
  "use strict";

  /* ============================================================
     STARFIELD — canvas with twinkle + subtle mouse parallax
     ============================================================ */

  var canvas = document.getElementById("starfield");
  var ctx = canvas.getContext("2d");
  var stars = [];
  var STAR_COUNT = window.innerWidth < 700 ? 110 : 220;
  var mouseX = 0;
  var mouseY = 0;
  var targetParallaxX = 0;
  var targetParallaxY = 0;
  var parallaxX = 0;
  var parallaxY = 0;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  // Soft drifting nebula clouds — positions are fractions of the canvas size
  // so they scale with the window, colors are "r,g,b" for use in rgba().
  var nebulae = [
    { x: 0.16, y: 0.22, r: 260, color: "99,102,241", phase: 0 },   // indigo
    { x: 0.82, y: 0.16, r: 220, color: "219,80,150", phase: 2.1 }, // magenta
    { x: 0.68, y: 0.72, r: 300, color: "45,190,180", phase: 4.4 }, // teal
    { x: 0.22, y: 0.78, r: 240, color: "129,140,248", phase: 6.2 } // violet
  ];

  function drawNebulae(t) {
    for (var i = 0; i < nebulae.length; i++) {
      var n = nebulae[i];
      var driftX = reduceMotion ? 0 : Math.sin(t * 0.00006 + n.phase) * 70;
      var driftY = reduceMotion ? 0 : Math.cos(t * 0.00005 + n.phase) * 46;
      var cx = n.x * canvas.width + driftX;
      var cy = n.y * canvas.height + driftY;
      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r);
      grad.addColorStop(0, "rgba(" + n.color + ", 0.16)");
      grad.addColorStop(1, "rgba(" + n.color + ", 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(cx - n.r, cy - n.r, n.r * 2, n.r * 2);
    }
  }

  function initStars() {
    stars = [];
    for (var i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.4 + 0.3,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: Math.random() * 0.015 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2,
        depth: Math.random() * 0.6 + 0.4, // 0.4 - 1.0, affects parallax strength
        drift: (Math.random() * 0.25 + 0.05) // constant slow downward drift, scaled by depth below
      });
    }
  }

  function drawStars(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawNebulae(t);

    if (!reduceMotion) {
      parallaxX += (targetParallaxX - parallaxX) * 0.04;
      parallaxY += (targetParallaxY - parallaxY) * 0.04;
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      var alpha = reduceMotion
        ? s.baseAlpha
        : s.baseAlpha + Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.25;
      alpha = Math.max(0.05, Math.min(1, alpha));

      if (!reduceMotion) {
        // stars nearer the "camera" (higher depth) drift faster — a cheap
        // but effective parallax depth cue, like flying slowly through them
        s.y += s.drift * s.depth;
        if (s.y > canvas.height + 10) {
          s.y = -10;
          s.x = Math.random() * canvas.width;
        }
      }

      var dx = parallaxX * s.depth;
      var dy = parallaxY * s.depth;

      ctx.beginPath();
      ctx.arc(s.x + dx, s.y + dy, s.r * (0.7 + s.depth * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = "rgba(220, 232, 255, " + alpha + ")";
      ctx.fill();
    }

    requestAnimationFrame(drawStars);
  }

  window.addEventListener("resize", function () {
    resizeCanvas();
    initStars();
  });

  if (!isCoarsePointer) {
    window.addEventListener("mousemove", function (e) {
      var cx = window.innerWidth / 2;
      var cy = window.innerHeight / 2;
      targetParallaxX = ((e.clientX - cx) / cx) * -14;
      targetParallaxY = ((e.clientY - cy) / cy) * -14;
    });
  }

  resizeCanvas();
  initStars();
  requestAnimationFrame(drawStars);

  /* ============================================================
     AUDIO — background ambient music (looping track) plus
     synthesized whoosh and UI blips generated in code
     ============================================================ */

  var audioCtx = null;
  var masterGain = null;
  var soundEnabled = false;
  var ambientAudio = document.getElementById("ambientMusic");
  var AMBIENT_MUSIC_VOLUME = 0.45;

  if (ambientAudio) {
    ambientAudio.loop = true;
    ambientAudio.volume = 0;
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0;
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Smoothly ramps the background music's volume — <audio>.volume has no
  // built-in scheduling like a Web Audio GainNode, so this fades it by hand.
  function fadeAmbientMusic(target, durationMs) {
    if (!ambientAudio) return;
    var start = ambientAudio.volume;
    var startTime = null;

    function step(ts) {
      if (startTime === null) startTime = ts;
      var progress = Math.min((ts - startTime) / durationMs, 1);
      ambientAudio.volume = start + (target - start) * progress;
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }

  function startAmbient() {
    if (!ambientAudio) return;
    if (ambientAudio.paused) {
      // Browsers block autoplay until a user gesture; this only ever runs
      // from the sound-toggle click handler, so the gesture requirement
      // is already satisfied.
      ambientAudio.play().catch(function () {
        /* Playback will retry on the next click if it was blocked. */
      });
    }
  }

  function playBlip() {
    if (!soundEnabled) return;
    var ac = ensureAudioContext();
    var now = ac.currentTime;

    var osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);

    var gain = ac.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  function playWhoosh() {
    if (!soundEnabled) return;
    var ac = ensureAudioContext();
    var now = ac.currentTime;
    var duration = 0.9;

    var bufferSize = ac.sampleRate * duration;
    var buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    var src = ac.createBufferSource();
    src.buffer = buffer;

    var filter = ac.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.9;
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    var gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    src.start(now);
    src.stop(now + duration);
  }

  var soundToggle = document.getElementById("soundToggle");
  soundToggle.addEventListener("click", function () {
    soundEnabled = !soundEnabled;
    ensureAudioContext();
    startAmbient();

    var now = audioCtx.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(soundEnabled ? 0.7 : 0, now, 0.25);
    fadeAmbientMusic(soundEnabled ? AMBIENT_MUSIC_VOLUME : 0, 900);

    soundToggle.setAttribute("aria-pressed", String(soundEnabled));
    soundToggle.querySelector(".hud-btn-label").textContent = soundEnabled
      ? "Sound On"
      : "Enable Sound";
    soundToggle.querySelector(".hud-btn-icon").textContent = soundEnabled ? "🔊" : "🔈";

    if (soundEnabled) playBlip();
  });

  /* ============================================================
     CHAPTER SCROLL OBSERVER — reveal cards, sync dot-nav,
     move flight ship, play whoosh on chapter change
     ============================================================ */

  var chapters = Array.prototype.slice.call(document.querySelectorAll(".chapter"));
  var dotLinks = Array.prototype.slice.call(document.querySelectorAll(".dot-link"));
  var lastActiveId = null;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");

          if (entry.intersectionRatio > 0.5) {
            var id = entry.target.id;
            if (id !== lastActiveId) {
              if (lastActiveId !== null) playWhoosh();
              lastActiveId = id;
              dotLinks.forEach(function (link) {
                link.classList.toggle("active", link.dataset.target === id);
              });
            }
          }
        }
      });
    },
    { threshold: [0, 0.5, 0.75] }
  );

  chapters.forEach(function (ch) {
    observer.observe(ch);
  });

  dotLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var target = document.getElementById(link.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth" });
      playBlip();
    });
  });

  // The ship now flies on its own free-running CSS loop (see .flight-ship
  // in space.css) instead of tracking scroll position — no JS needed here.

  /* ============================================================
     LAUNCH / REPLAY BUTTONS
     ============================================================ */

  var launchBtn = document.getElementById("launchBtn");
  if (launchBtn) {
    launchBtn.addEventListener("click", function () {
      playBlip();
      var next = document.getElementById("planet-analyst");
      if (next) next.scrollIntoView({ behavior: "smooth" });
    });
  }

  var replayBtn = document.getElementById("replayBtn");
  if (replayBtn) {
    replayBtn.addEventListener("click", function () {
      playBlip();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ============================================================
     DETAIL MODAL — planets & satellites
     ============================================================ */

  var modal = document.getElementById("detailModal");
  var modalTitle = document.getElementById("detailTitle");
  var modalMeta = document.getElementById("detailMeta");
  var modalDesc = document.getElementById("detailDesc");
  var modalClose = document.getElementById("detailClose");

  function openDetail(el) {
    modalTitle.textContent = el.dataset.title || "";
    modalMeta.textContent = el.dataset.meta || "";
    modalDesc.textContent = el.dataset.desc || "";
    modal.hidden = false;
    playBlip();
  }

  function closeDetail() {
    modal.hidden = true;
  }

  Array.prototype.slice.call(document.querySelectorAll(".planet, .satellite")).forEach(function (el) {
    el.addEventListener("click", function () {
      openDetail(el);
    });
  });

  modalClose.addEventListener("click", closeDetail);
  modal.addEventListener("click", function (e) {
    if (e.target === modal) closeDetail();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeDetail();
  });
})();
