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
     AUDIO — synthesized ambient hum, whoosh, and UI blips
     (Web Audio API — no external audio files)
     ============================================================ */

  var audioCtx = null;
  var masterGain = null;
  var ambientNodes = null;
  var soundEnabled = false;

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

  function startAmbient() {
    var ac = ensureAudioContext();
    if (ambientNodes) return;

    var droneGain = ac.createGain();
    droneGain.gain.value = 0.5;
    droneGain.connect(masterGain);

    var lowpass = ac.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 500;
    lowpass.connect(droneGain);

    var osc1 = ac.createOscillator();
    osc1.type = "sine";
    osc1.frequency.value = 55;
    osc1.connect(lowpass);

    var osc2 = ac.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 82.5; // perfect fifth-ish above osc1 for a spacey drone
    osc2.connect(lowpass);

    // slow LFO breathing the drone's volume
    var lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.08;
    var lfoGain = ac.createGain();
    lfoGain.gain.value = 0.15;
    lfo.connect(lfoGain);
    lfoGain.connect(droneGain.gain);

    // filtered noise for a soft "cosmic static" bed
    var bufferSize = 2 * ac.sampleRate;
    var noiseBuffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    var output = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    var noise = ac.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;

    var noiseFilter = ac.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 700;
    noiseFilter.Q.value = 0.6;

    var noiseGain = ac.createGain();
    noiseGain.gain.value = 0.035;

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);

    osc1.start();
    osc2.start();
    lfo.start();
    noise.start();

    ambientNodes = { osc1: osc1, osc2: osc2, lfo: lfo, noise: noise, droneGain: droneGain };
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

  var flightShip = document.getElementById("flightShip");
  function updateShipPosition() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = docHeight > 0 ? window.scrollY / docHeight : 0;
    var pathHeight = flightShip.parentElement.clientHeight;
    flightShip.style.top = (progress * pathHeight) + "px";
  }
  window.addEventListener("scroll", updateShipPosition, { passive: true });
  window.addEventListener("resize", updateShipPosition);
  updateShipPosition();

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
