/*
 * ボタン操作アニメーション機構
 * 設計書: docs/設計書20260929.md
 *
 * 公開 API:
 *   ButtonMotion.init(root = document)
 *   ButtonMotion.setLoading(element, isLoading)
 *   ButtonMotion.destroy(root = document)
 *
 * <head> 内で同期読み込みすること（登場前の非表示を JS 有効時だけ適用するため）。
 */
(function (global) {
  'use strict';

  var doc = global.document;
  var html = doc.documentElement;

  var BTN = '.motion-btn';
  var GROUP = '[data-motion-group]';
  var INIT_ATTR = 'data-motion-initialized';

  var ENTER_MS = 600;
  var STAGGER_MS = 120;
  var BURST_INTERVAL_MS = 300;
  var PARTICLE_LIMIT = 40;
  var PARTICLE_TTL_MS = 1000;
  var SMALL_VIEWPORT = 700;

  var FIREWORKS_INTERVAL_MS = 500;
  var FIREWORKS_SPARK_LIMIT = 1200;
  var FIREWORKS_COLORS = ['#ff3b3b', '#ffd23f', '#ff7a3d', '#3ddcff', '#7cff6b', '#ff5ce1', '#b18cff', '#ffffff'];

  html.classList.add('motion-js');

  var reduceQuery = global.matchMedia
    ? global.matchMedia('(prefers-reduced-motion: reduce)')
    : null;

  var records = new WeakMap(); // button -> { onClick, onAnimationEnd, lastBurst, fallbackTimer }
  var loadingStash = new WeakMap(); // button -> 処理中にする前の disabled 状態
  var observers = new Map(); // root -> IntersectionObserver
  var particles = new Set();

  function prefersReducedMotion() {
    return !!(reduceQuery && reduceQuery.matches);
  }

  function queryAll(root, selector) {
    var list = Array.prototype.slice.call(root.querySelectorAll(selector));
    if (root.matches && root.matches(selector)) list.unshift(root);
    return list;
  }

  function isGroupChild(btn) {
    var parent = btn.parentElement;
    return !!(parent && parent.hasAttribute('data-motion-group'));
  }

  function isInactive(btn) {
    return (
      btn.disabled === true ||
      btn.getAttribute('aria-disabled') === 'true' ||
      btn.classList.contains('is-loading')
    );
  }

  function canPulse(btn) {
    return (
      btn.classList.contains('motion-btn--primary') &&
      btn.getAttribute('data-motion-pulse') !== 'off'
    );
  }

  /* ---------- 登場アニメーション ---------- */

  function finishEnter(btn) {
    var rec = records.get(btn);
    if (rec && rec.fallbackTimer) {
      clearTimeout(rec.fallbackTimer);
      rec.fallbackTimer = 0;
    }
    if (btn.classList.contains('is-enter-done')) return;
    // animation プロパティの競合を避けるため、登場完了後に発光へ引き継ぐ
    btn.classList.add('is-entered', 'is-enter-done');
    if (canPulse(btn)) btn.classList.add('is-pulse-ready');
  }

  function enterGroup(group) {
    var buttons = Array.prototype.filter.call(group.children, function (el) {
      return el.matches(BTN);
    });

    buttons.forEach(function (btn, index) {
      if (btn.classList.contains('is-entered')) return;

      if (prefersReducedMotion()) {
        finishEnter(btn);
        return;
      }

      btn.style.setProperty('--motion-index', String(index));
      btn.classList.add('is-entered');

      // 非表示要素などで animationend が来ない場合の保険
      var rec = records.get(btn);
      if (rec) {
        rec.fallbackTimer = setTimeout(function () {
          finishEnter(btn);
        }, index * STAGGER_MS + ENTER_MS + 500);
      }
    });
  }

  function getObserver(root) {
    if (!('IntersectionObserver' in global)) return null;
    var io = observers.get(root);
    if (!io) {
      io = new IntersectionObserver(function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          enterGroup(entry.target);
        });
      }, { threshold: 0.2 });
      observers.set(root, io);
    }
    return io;
  }

  /* ---------- burst 演出 ---------- */

  function random(min, max) {
    return min + Math.random() * (max - min);
  }

  function removeParticle(particle) {
    if (!particles.delete(particle)) return;
    if (particle.parentNode) particle.parentNode.removeChild(particle);
  }

  function clearParticles() {
    Array.from(particles).forEach(removeParticle);
    stopFireworks();
  }

  function burst(btn, event) {
    if (isInactive(btn) || prefersReducedMotion()) return;

    var rec = records.get(btn);
    var now = Date.now();
    if (rec.lastBurst && now - rec.lastBurst < BURST_INTERVAL_MS) return;
    rec.lastBurst = now;

    var rect = btn.getBoundingClientRect();
    var fromPointer = event.detail > 0 && (event.clientX || event.clientY);
    var x = fromPointer ? event.clientX : rect.left + rect.width / 2;
    var y = fromPointer ? event.clientY : rect.top + rect.height / 2;

    var wanted = global.innerWidth < SMALL_VIEWPORT ? 10 : 16;
    var count = Math.min(wanted, PARTICLE_LIMIT - particles.size);
    if (count <= 0) return;

    var style = global.getComputedStyle(btn);
    var colors = ['--motion-particle-1', '--motion-particle-2', '--motion-particle-3']
      .map(function (name) { return style.getPropertyValue(name).trim(); })
      .filter(Boolean);
    if (!colors.length) colors = ['currentColor'];

    var fragment = doc.createDocumentFragment();
    for (var i = 0; i < count; i++) {
      var angle = (i / count) * Math.PI * 2 + random(-0.25, 0.25);
      var distance = random(24, 72);
      var particle = doc.createElement('span');

      particle.className = 'motion-particle';
      particle.setAttribute('aria-hidden', 'true');
      particle.style.setProperty('--x', x + 'px');
      particle.style.setProperty('--y', y + 'px');
      particle.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(1) + 'px');
      particle.style.setProperty('--dy', (Math.sin(angle) * distance).toFixed(1) + 'px');
      particle.style.setProperty('--size', random(3, 7).toFixed(1) + 'px');
      particle.style.setProperty('--duration', Math.round(random(450, 750)) + 'ms');
      particle.style.setProperty('--color', colors[i % colors.length]);

      particle.addEventListener('animationend', removeParticle.bind(null, particle));
      setTimeout(removeParticle.bind(null, particle), PARTICLE_TTL_MS);

      particles.add(particle);
      fragment.appendChild(particle);
    }
    doc.body.appendChild(fragment);
  }

  /* ---------- fireworks 演出 ---------- */

  // 1枚の canvas に描画し、描くものがなくなったら canvas ごと削除する
  var fw = null; // { canvas, ctx, width, height, dpr, rockets, sparks, flashes, timers, raf, onResize }

  function resizeFireworks() {
    if (!fw) return;
    fw.dpr = Math.min(global.devicePixelRatio || 1, 2);
    fw.width = global.innerWidth;
    fw.height = global.innerHeight;
    fw.canvas.width = Math.round(fw.width * fw.dpr);
    fw.canvas.height = Math.round(fw.height * fw.dpr);
    fw.ctx.setTransform(fw.dpr, 0, 0, fw.dpr, 0, 0);
  }

  function ensureFireworks() {
    if (fw) return fw;
    var canvas = doc.createElement('canvas');
    canvas.className = 'motion-fireworks';
    canvas.setAttribute('aria-hidden', 'true');
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    fw = { canvas: canvas, ctx: ctx, rockets: [], sparks: [], flashes: [], timers: [], raf: 0, last: 0 };
    fw.onResize = resizeFireworks;
    global.addEventListener('resize', fw.onResize);
    resizeFireworks();
    doc.body.appendChild(canvas);
    return fw;
  }

  function stopFireworks() {
    if (!fw) return;
    if (fw.raf) global.cancelAnimationFrame(fw.raf);
    fw.timers.forEach(clearTimeout);
    global.removeEventListener('resize', fw.onResize);
    if (fw.canvas.parentNode) fw.canvas.parentNode.removeChild(fw.canvas);
    fw = null;
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function addSpark(x, y, vx, vy, color, opts) {
    if (fw.sparks.length >= FIREWORKS_SPARK_LIMIT) return;
    fw.sparks.push({
      x: x, y: y, px: x, py: y, vx: vx, vy: vy,
      color: color,
      life: 0,
      ttl: opts.ttl,
      size: opts.size,
      drag: opts.drag,
      gravity: opts.gravity,
      twinkle: opts.twinkle
    });
  }

  function explode(x, y, scale) {
    var type = pick(['peony', 'peony', 'ring', 'willow', 'double']);
    var c1 = pick(FIREWORKS_COLORS);
    var c2 = pick(FIREWORKS_COLORS);
    var count = Math.round((type === 'ring' ? 70 : 110) * scale);
    var speed = random(4.5, 6.5) * (0.75 + scale * 0.25);
    var i, angle, v;

    fw.flashes.push({ x: x, y: y, life: 0, ttl: 260, radius: 90 * scale, color: c1 });

    for (i = 0; i < count; i++) {
      angle = (i / count) * Math.PI * 2 + random(-0.05, 0.05);
      if (type === 'ring') {
        v = speed;
      } else {
        // 球状に見えるよう速度を散らす
        v = speed * Math.sqrt(Math.random()) * random(0.85, 1.1);
      }
      var color = type === 'double' ? (i % 2 ? c1 : c2) : (Math.random() < 0.85 ? c1 : c2);
      addSpark(x, y, Math.cos(angle) * v, Math.sin(angle) * v, color, {
        ttl: type === 'willow' ? random(1600, 2200) : random(1000, 1500),
        size: random(1.6, 2.8),
        drag: type === 'willow' ? 0.965 : 0.955,
        gravity: type === 'willow' ? 0.05 : 0.07,
        twinkle: Math.random() < 0.35
      });
    }

    if (type === 'double') {
      // 内側にもう一段小さな輪を重ねる
      for (i = 0; i < count / 2; i++) {
        angle = (i / (count / 2)) * Math.PI * 2;
        addSpark(x, y, Math.cos(angle) * speed * 0.45, Math.sin(angle) * speed * 0.45, '#ffffff', {
          ttl: random(700, 1000), size: 1.6, drag: 0.95, gravity: 0.05, twinkle: true
        });
      }
    }
  }

  function launchRocket(fromX, fromY, scale) {
    var tx = random(fw.width * 0.12, fw.width * 0.88);
    var ty = random(fw.height * 0.1, fw.height * 0.42);
    // 打ち上げ位置が画面上部に近い場合でも少しは上昇させる
    if (ty > fromY - 80) ty = Math.max(40, fromY - random(120, 220));
    var frames = random(38, 52);
    fw.rockets.push({
      x: fromX, y: fromY, px: fromX, py: fromY,
      vx: (tx - fromX) / frames,
      vy: (ty - fromY) / frames,
      tx: tx, ty: ty, frames: frames, age: 0, scale: scale
    });
  }

  function drawFireworks(now) {
    if (!fw) return;
    var ctx = fw.ctx;
    var dt = fw.last ? Math.min((now - fw.last) / 16.67, 3) : 1;
    fw.last = now;

    ctx.clearRect(0, 0, fw.width, fw.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    // 打ち上げ
    fw.rockets = fw.rockets.filter(function (r) {
      r.px = r.x;
      r.py = r.y;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.age += dt;
      ctx.strokeStyle = 'rgba(255, 220, 160, .9)';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(r.px - r.vx * 2, r.py - r.vy * 2);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      if (Math.random() < 0.6) {
        addSpark(r.x, r.y, random(-0.4, 0.4), random(0.2, 0.8), '#ffcf7a', {
          ttl: random(250, 450), size: 1.2, drag: 0.94, gravity: 0.03, twinkle: false
        });
      }
      if (r.age >= r.frames) {
        explode(r.x, r.y, r.scale);
        return false;
      }
      return true;
    });

    // 閃光
    fw.flashes = fw.flashes.filter(function (f) {
      f.life += 16.67 * dt;
      var t = f.life / f.ttl;
      if (t >= 1) return false;
      var g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * (0.6 + t * 0.6));
      g.addColorStop(0, 'rgba(255, 255, 255, ' + (0.85 * (1 - t)).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 1.2, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });

    // 火花
    fw.sparks = fw.sparks.filter(function (s) {
      s.life += 16.67 * dt;
      if (s.life >= s.ttl) return false;
      s.px = s.x;
      s.py = s.y;
      var drag = Math.pow(s.drag, dt);
      s.vx *= drag;
      s.vy = s.vy * drag + s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      var alpha = 1 - s.life / s.ttl;
      if (s.twinkle && Math.random() < 0.3) alpha *= 0.2;
      ctx.globalAlpha = Math.max(alpha, 0);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.beginPath();
      ctx.moveTo(s.px - s.vx * 1.5, s.py - s.vy * 1.5);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      return true;
    });
    ctx.globalAlpha = 1;

    if (fw.rockets.length || fw.sparks.length || fw.flashes.length || fw.timers.length) {
      fw.raf = global.requestAnimationFrame(drawFireworks);
    } else {
      stopFireworks();
    }
  }

  function fireworks(btn, event) {
    if (isInactive(btn) || prefersReducedMotion()) return;
    if (!global.requestAnimationFrame) return;

    var rec = records.get(btn);
    var now = Date.now();
    if (rec.lastBurst && now - rec.lastBurst < FIREWORKS_INTERVAL_MS) return;
    rec.lastBurst = now;

    if (!ensureFireworks()) return;

    var rect = btn.getBoundingClientRect();
    var fromPointer = event.detail > 0 && (event.clientX || event.clientY);
    var x = fromPointer ? event.clientX : rect.left + rect.width / 2;
    var y = fromPointer ? event.clientY : rect.top + rect.height / 2;

    var small = global.innerWidth < SMALL_VIEWPORT;
    var shells = small ? 5 : 8;
    var scale = small ? 0.7 : 1;

    // 押した瞬間にボタン位置でも弾ける
    explode(x, y, scale * 0.5);

    for (var i = 0; i < shells; i++) {
      (function (delay) {
        var timer = setTimeout(function () {
          if (!fw) return;
          fw.timers.splice(fw.timers.indexOf(timer), 1);
          launchRocket(x, y, scale * random(0.85, 1.2));
        }, delay);
        fw.timers.push(timer);
      })(i * random(110, 190));
    }

    if (!fw.raf) {
      fw.last = 0;
      fw.raf = global.requestAnimationFrame(drawFireworks);
    }
  }

  /* ---------- イベント ---------- */

  function handleClick(event) {
    var btn = event.currentTarget;

    // リンク型ボタンの無効化・処理中は CSS だけでなく遷移も止める
    if (btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('is-loading')) {
      event.preventDefault();
      return;
    }

    var effect = btn.getAttribute('data-motion-effect');
    if (effect === 'burst' || effect === 'fireworks') {
      // 演出の失敗で本来の操作を妨げない
      try {
        if (effect === 'fireworks') fireworks(btn, event);
        else burst(btn, event);
      } catch (err) {
        if (global.console) console.error(err);
      }
    }
  }

  function handleAnimationEnd(event) {
    if (event.target === event.currentTarget && event.animationName === 'motion-enter') {
      finishEnter(event.currentTarget);
    }
  }

  /* ---------- 公開 API ---------- */

  function init(root) {
    root = root || doc;
    if (!root.querySelectorAll) return;

    queryAll(root, BTN).forEach(function (btn) {
      if (btn.getAttribute(INIT_ATTR) === 'true') return;
      btn.setAttribute(INIT_ATTR, 'true');

      var rec = { onClick: handleClick, onAnimationEnd: null, lastBurst: 0, fallbackTimer: 0 };
      btn.addEventListener('click', rec.onClick);

      if (isGroupChild(btn)) {
        rec.onAnimationEnd = handleAnimationEnd;
        btn.addEventListener('animationend', rec.onAnimationEnd);
      } else if (canPulse(btn)) {
        btn.classList.add('is-pulse-ready');
      }
      records.set(btn, rec);
    });

    queryAll(root, GROUP).forEach(function (group) {
      if (group.getAttribute(INIT_ATTR) === 'true') return;
      group.setAttribute(INIT_ATTR, 'true');

      var io = prefersReducedMotion() ? null : getObserver(root);
      if (io) io.observe(group);
      else enterGroup(group);
    });
  }

  function destroy(root) {
    root = root || doc;
    if (!root.querySelectorAll) return;

    queryAll(root, GROUP).forEach(function (group) {
      observers.forEach(function (io) { io.unobserve(group); });
      group.removeAttribute(INIT_ATTR);
    });

    var io = observers.get(root);
    if (io) {
      io.disconnect();
      observers.delete(root);
    }

    queryAll(root, BTN).forEach(function (btn) {
      var rec = records.get(btn);
      if (rec) {
        btn.removeEventListener('click', rec.onClick);
        if (rec.onAnimationEnd) btn.removeEventListener('animationend', rec.onAnimationEnd);
        if (rec.fallbackTimer) clearTimeout(rec.fallbackTimer);
        records.delete(btn);
      }
      btn.removeAttribute(INIT_ATTR);
      // 未登場のまま非表示で残らないようにする
      if (isGroupChild(btn)) btn.classList.add('is-entered', 'is-enter-done');
    });

    clearParticles();
  }

  function setLoading(element, isLoading) {
    if (!element) return;
    var loading = !!isLoading;
    var isNativeControl = 'disabled' in element;

    if (loading && !loadingStash.has(element)) {
      loadingStash.set(element, isNativeControl
        ? element.disabled
        : element.getAttribute('aria-disabled'));
    }

    element.classList.toggle('is-loading', loading);

    if (loading) {
      element.setAttribute('aria-busy', 'true');
      if (isNativeControl) element.disabled = true;
      else element.setAttribute('aria-disabled', 'true');
      return;
    }

    element.removeAttribute('aria-busy');
    var previous = loadingStash.get(element);
    loadingStash.delete(element);
    if (isNativeControl) {
      element.disabled = !!previous;
    } else if (previous == null) {
      element.removeAttribute('aria-disabled');
    } else {
      element.setAttribute('aria-disabled', previous);
    }
  }

  /* ---------- 起動 ---------- */

  if (reduceQuery) {
    var onReduceChange = function () {
      if (reduceQuery.matches) clearParticles();
    };
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', onReduceChange);
    else if (reduceQuery.addListener) reduceQuery.addListener(onReduceChange);
  }

  // iOS Safari で :active を有効にする
  doc.addEventListener('touchstart', function () {}, { passive: true });

  function boot() {
    try {
      init(doc);
    } catch (err) {
      // 失敗時はボタンを非表示のまま残さない
      html.classList.remove('motion-js');
      if (global.console) console.error(err);
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.ButtonMotion = { init: init, setLoading: setLoading, destroy: destroy };
})(window);
