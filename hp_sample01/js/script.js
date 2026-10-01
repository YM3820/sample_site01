(function () {
  "use strict";

  // 設定値は function/settings.php から index4.php 経由で受け取る。
  var settings = JSON.parse(
    document.getElementById("app-settings").textContent,
  );

  var MAX_CLICKS = settings.maxClicks;
  var particleImages = settings.particles;

  var clickArea = document.getElementById("click-area");
  var burstLayer = document.getElementById("burst-layer");
  var clickStatus = document.getElementById("click-status");
  var clickCount = 0;
  var redirecting = false;

  // 初回操作時の表示遅れを抑えるため、花火画像を先読みする。
  particleImages.forEach(function (item) {
    var image = new Image();
    image.src = item.src;
  });

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function isMobile() {
    return window.innerWidth < settings.mobileBreakpoint;
  }

  function remainingText(count) {
    return settings.text.remaining.replace("{count}", count);
  }

  function createBurst(x, y, options) {
    options = options || {};
    var countScale = options.countScale || 1;
    var travelScale = options.travelScale || 1;
    var sizeScale = options.sizeScale || 1;
    var particleCount = Math.round(
      (isMobile() ? settings.burst.count_mobile : settings.burst.count_pc) *
        countScale,
    );
    var travel =
      Math.min(Math.max(window.innerWidth, window.innerHeight) * 0.36, 440) *
      travelScale;

    for (var i = 0; i < particleCount; i += 1) {
      var image = particleImages[i % particleImages.length];
      var angle =
        (Math.PI * 2 * i) / particleCount + randomBetween(-0.16, 0.16);
      var distance = travel * randomBetween(0.5, 1.08);
      var particle = document.createElement("img");

      particle.className = "particle";
      particle.src = image.src;
      particle.alt = "";
      particle.draggable = false;
      particle.style.left = x + "px";
      particle.style.top = y + "px";
      particle.style.setProperty(
        "--size",
        randomBetween(image.size[0], image.size[1]) * sizeScale + "px",
      );
      particle.style.setProperty("--move-x", Math.cos(angle) * distance + "px");
      particle.style.setProperty("--move-y", Math.sin(angle) * distance + "px");
      particle.style.setProperty("--drop", randomBetween(20, 90) + "px");
      particle.style.setProperty("--rotate", randomBetween(-540, 540) + "deg");
      particle.style.setProperty("--end-scale", randomBetween(0.72, 1.18));
      particle.style.setProperty(
        "--duration",
        randomBetween(780, 1250) + "ms",
      );
      particle.style.animationDelay = randomBetween(0, 80) + "ms";

      particle.addEventListener("animationend", function (event) {
        event.currentTarget.remove();
      });
      burstLayer.appendChild(particle);
    }
  }

  // 上から降り注ぐキャラクター（フィナーレ用）。
  function createRain(count) {
    var width = window.innerWidth;
    var height = window.innerHeight;

    for (var i = 0; i < count; i += 1) {
      var image = particleImages[i % particleImages.length];
      var particle = document.createElement("img");

      particle.className = "particle-rain";
      particle.src = image.src;
      particle.alt = "";
      particle.draggable = false;
      particle.style.left = randomBetween(-5, 100) + "%";
      particle.style.setProperty(
        "--size",
        randomBetween(image.size[0], image.size[1]) * 1.2 + "px",
      );
      particle.style.setProperty("--fall", height + 260 + "px");
      particle.style.setProperty(
        "--sway",
        randomBetween(-0.25, 0.25) * width + "px",
      );
      particle.style.setProperty("--rotate", randomBetween(-900, 900) + "deg");
      particle.style.setProperty(
        "--duration",
        randomBetween(1100, 1900) + "ms",
      );
      particle.style.animationDelay = randomBetween(0, 1400) + "ms";

      particle.addEventListener("animationend", function (event) {
        event.currentTarget.remove();
      });
      burstLayer.appendChild(particle);
    }
  }

  // 最後のクリック：画面全体にキャラクターを激しくばらまく。
  function finale(x, y) {
    var width = window.innerWidth;
    var height = window.innerHeight;
    var mobile = isMobile();
    var config = settings.finale;

    clickArea.classList.add("is-finale");

    // 中心から特大の爆発。
    createBurst(x, y, { countScale: 3, travelScale: 2.6, sizeScale: 1.4 });
    createBurst(width / 2, height / 2, {
      countScale: 2.5,
      travelScale: 3,
      sizeScale: 1.6,
    });

    // 画面のあちこちで連続爆発。
    var waves = mobile ? config.waves_mobile : config.waves_pc;
    for (var i = 0; i < waves; i += 1) {
      window.setTimeout(function () {
        createBurst(
          randomBetween(0.05, 0.95) * width,
          randomBetween(0.05, 0.95) * height,
          {
            countScale: randomBetween(0.9, 1.4),
            travelScale: randomBetween(1.2, 2),
            sizeScale: randomBetween(1, 1.5),
          },
        );
      }, 90 + i * config.wave_interval);
    }

    // 上からキャラクターの雨。
    createRain(mobile ? config.rain_mobile : config.rain_pc);
  }

  function activate(x, y) {
    if (redirecting) return;

    clickCount += 1;

    var remaining = MAX_CLICKS - clickCount;
    clickStatus.textContent =
      remaining > 0 ? remainingText(remaining) : settings.text.redirecting;

    if (clickCount >= MAX_CLICKS) {
      redirecting = true;
      if (settings.finale.enabled) {
        finale(x, y);
      } else {
        createBurst(x, y);
      }
      window.setTimeout(function () {
        window.location.href = settings.redirectUrl;
      }, settings.redirectDelay);
    } else {
      createBurst(x, y);
    }
  }

  clickArea.addEventListener("click", function (event) {
    activate(event.clientX, event.clientY);
  });

  clickArea.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    var rect = clickArea.getBoundingClientRect();
    activate(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  // Chromeの「戻る」でBFCacheから復元された場合も、もう一度遊べる状態に戻す。
  window.addEventListener("pageshow", function () {
    clickCount = 0;
    redirecting = false;
    clickArea.classList.remove("is-finale");
    clickStatus.textContent = remainingText(MAX_CLICKS);
    burstLayer.replaceChildren();
  });
})();
