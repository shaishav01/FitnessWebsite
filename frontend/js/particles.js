// Interactive 3D particle field for the hero. Particles live in 3D space, are projected with
// perspective, tilt with the cursor, get pushed away by it and link up with it like a constellation.
// Pauses when off-screen / tab hidden; renders one still frame under prefers-reduced-motion.
(function () {
  'use strict';
  var canvas = document.getElementById('particles');
  if (!canvas || !canvas.getContext) return;
  var hero = canvas.parentElement;
  var ctx = canvas.getContext('2d');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');

  var COLORS = ['#ff3d9a', '#a78bfa', '#ff8a3d', '#c6ff3d', '#22d3ee'];
  var DEPTH = 900, FOCAL = 650;
  var W = 0, H = 0, dpr = 1;
  var parts = [];
  var mouse = { x: 0, y: 0, active: false };
  var rot = { x: 0, y: 0, tx: 0, ty: 0 };
  var raf = 0, visible = true, last = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function targetCount() {
    var n = Math.round((W * H) / 11000);
    return Math.max(28, Math.min(W < 700 ? 55 : 130, n));
  }

  function spawn() {
    return {
      x: rand(-W * 0.9, W * 0.9), y: rand(-H * 0.9, H * 0.9), z: rand(0, DEPTH),
      vx: rand(-0.12, 0.12), vy: rand(-0.1, 0.1), vz: rand(0.15, 0.5),
      r: rand(1.4, 3.2), c: COLORS[(Math.random() * COLORS.length) | 0],
      ox: 0, oy: 0, // screen-space offset from cursor push
      sx: 0, sy: 0, sc: 1
    };
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var want = targetCount();
    while (parts.length < want) parts.push(spawn());
    if (parts.length > want) parts.length = want;
    if (!running()) draw(0);
  }

  function project(p) {
    var cy = Math.cos(rot.y), sy = Math.sin(rot.y), cx = Math.cos(rot.x), sx = Math.sin(rot.x);
    var zc = p.z - DEPTH / 2;
    var x1 = p.x * cy + zc * sy;
    var z1 = -p.x * sy + zc * cy;
    var y1 = p.y * cx - z1 * sx;
    var z2 = p.y * sx + z1 * cx;
    var sc = FOCAL / (FOCAL + z2 + DEPTH / 2);
    p.sc = sc;
    p.sx = W / 2 + x1 * sc;
    p.sy = H / 2 + y1 * sc;
  }

  function step(dt) {
    rot.x += (rot.tx - rot.x) * 0.05;
    rot.y += (rot.ty - rot.y) * 0.05;
    var push = 130;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.z > DEPTH) { p.z -= DEPTH; p.x = rand(-W * 0.9, W * 0.9); p.y = rand(-H * 0.9, H * 0.9); }
      if (p.x > W) p.x = -W; else if (p.x < -W) p.x = W;
      if (p.y > H) p.y = -H; else if (p.y < -H) p.y = H;
      project(p);
      if (mouse.active) {
        var dx = p.sx + p.ox - mouse.x, dy = p.sy + p.oy - mouse.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < push * push && d2 > 0.01) {
          var d = Math.sqrt(d2), f = (1 - d / push) * 5.5;
          p.ox += (dx / d) * f; p.oy += (dy / d) * f;
        }
      }
      p.ox *= 0.92; p.oy *= 0.92; // spring back
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    var n = parts.length, i, j, a, b;
    var link = W < 700 ? 90 : 120, link2 = link * link, mlink = 170, mlink2 = mlink * mlink;

    ctx.lineWidth = 1;
    for (i = 0; i < n; i++) {
      a = parts[i];
      var ax = a.sx + a.ox, ay = a.sy + a.oy;
      for (j = i + 1; j < n; j++) {
        b = parts[j];
        var dx = ax - (b.sx + b.ox), dy = ay - (b.sy + b.oy), d2 = dx * dx + dy * dy;
        if (d2 < link2) {
          ctx.strokeStyle = 'rgba(167,139,250,' + ((1 - d2 / link2) * 0.42 * Math.min(a.sc, b.sc) * 1.5).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.sx + b.ox, b.sy + b.oy); ctx.stroke();
        }
      }
      if (mouse.active) {
        var mx = ax - mouse.x, my = ay - mouse.y, md2 = mx * mx + my * my;
        if (md2 < mlink2) {
          ctx.strokeStyle = 'rgba(255,61,154,' + ((1 - md2 / mlink2) * 0.55).toFixed(3) + ')';
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }
    for (i = 0; i < n; i++) {
      a = parts[i];
      ctx.globalAlpha = Math.min(1, 0.5 + a.sc * 0.6);
      ctx.fillStyle = a.c;
      ctx.beginPath(); ctx.arc(a.sx + a.ox, a.sy + a.oy, a.r * a.sc * 1.4, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (mouse.active) { // soft glow at the cursor
      var g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 90);
      g.addColorStop(0, 'rgba(255,61,154,.28)'); g.addColorStop(1, 'rgba(255,61,154,0)');
      ctx.fillStyle = g; ctx.fillRect(mouse.x - 90, mouse.y - 90, 180, 180);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function frame(t) {
    raf = 0;
    var dt = Math.min(48, t - last) / 16.67; last = t;
    step(dt); draw();
    if (running()) raf = requestAnimationFrame(frame);
  }

  function running() { return visible && !document.hidden && !reduce.matches; }
  function start() { if (!raf && running()) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function onMove(e) {
    if (reduce.matches) return;
    var r = hero.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; mouse.active = true;
    rot.ty = (mouse.x / W - 0.5) * 0.7;
    rot.tx = -(mouse.y / H - 0.5) * 0.5;
  }
  function onLeave() { mouse.active = false; rot.tx = 0; rot.ty = 0; }

  hero.addEventListener('pointermove', onMove, { passive: true });
  hero.addEventListener('pointerdown', onMove, { passive: true });
  hero.addEventListener('pointerleave', onLeave);
  hero.addEventListener('pointerup', function (e) { if (e.pointerType !== 'mouse') onLeave(); });

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero); else window.addEventListener('resize', resize);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; visible ? start() : stop(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  reduce.addEventListener('change', function () { if (reduce.matches) { stop(); onLeave(); step(0); draw(); } else start(); });

  resize();
  if (reduce.matches) { step(0); draw(); } else start();
})();
