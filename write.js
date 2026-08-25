/* write.js — כותבת אותיות.

   A demonstration and a blank board. Nothing here scores, corrects, or moves
   her on: she picks a letter, watches how it is written as many times as she
   likes, and practises. The only thing reported outward is "she drew on this
   letter", so the garden can still give her something.

   The 0..100 coordinates in strokes.js line up with the glyph ONLY at
   BOX = SIZE*0.78 with the glyph at BOX*0.95 — they were read off a reference
   grid at that scale, and any other glyph size silently misaligns every
   skeleton. */

const Write = (function () {
  const SIZE = 300;
  const PEN  = 20;
  const BOX = SIZE * 0.78;
  const ORIGIN = (SIZE - BOX) / 2;

  function font(px) { return '500 ' + px + 'px Rubik, Arial, sans-serif'; }
  const glyphPx = () => BOX * 0.95;

  const toPx = p => ({ x: ORIGIN + p[0] / 100 * BOX, y: ORIGIN + p[1] / 100 * BOX });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* point at fraction f along a polyline, plus the vertices already passed */
  function along(pts, f) {
    const segs = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = dist(pts[i - 1], pts[i]); segs.push(d); total += d; }
    let want = total * Math.min(1, f), acc = 0;
    const upto = [];
    for (let i = 0; i < segs.length; i++) {
      if (acc + segs[i] >= want) {
        const k = segs[i] ? (want - acc) / segs[i] : 0;
        return { p: { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k,
                      y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }, upto: upto };
      }
      acc += segs[i]; upto.push(pts[i + 1]);
    }
    return { p: pts[pts.length - 1], upto: upto.slice(0, -1) };
  }

  /* ---------- the board ---------- */

  function board(host, opts) {
    opts = opts || {};
    let letterId = null, ref = [];
    let strokes = [], cur = null, anim = null, demoGuard = null, demoing = false;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.className = 'trace';
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    cv.style.width = SIZE + 'px'; cv.style.height = SIZE + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    function drawGuide(showDots) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (!letterId) return;
      ctx.save();
      ctx.font = font(glyphPx());
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(60,30,110,.13)';
      ctx.fillText(Engine.L[letterId].ch, SIZE / 2, SIZE / 2);
      ctx.restore();
      if (showDots !== false) startDots();
    }

    /* numbered start dots + an arrow, so the beginning is obvious at a glance */
    function startDots() {
      ref.forEach((st, i) => {
        const a = toPx(st[0]);
        ctx.save();
        ctx.fillStyle = '#ffd257';
        ctx.strokeStyle = '#a07b00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.x, a.y, 13, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a4200'; ctx.font = 'bold 15px Rubik, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), a.x, a.y);
        arrowHead(a, toPx(st[1] || st[0]), '#a07b00');
        ctx.restore();
      });
    }

    function arrowHead(from, to, colour) {
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const tip = { x: from.x + Math.cos(ang) * 28, y: from.y + Math.sin(ang) * 28 };
      ctx.save();
      ctx.fillStyle = colour;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - Math.cos(ang - 0.45) * 11, tip.y - Math.sin(ang - 0.45) * 11);
      ctx.lineTo(tip.x - Math.cos(ang + 0.45) * 11, tip.y - Math.sin(ang + 0.45) * 11);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function drawInk() {
      ctx.save();
      ctx.strokeStyle = '#ff7ab8'; ctx.lineWidth = PEN;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      strokes.forEach(st => {
        if (!st.length) return;
        if (st.length === 1) {
          ctx.beginPath(); ctx.arc(st[0].x, st[0].y, PEN / 2, 0, 7);
          ctx.fillStyle = '#ff7ab8'; ctx.fill(); return;
        }
        ctx.beginPath(); ctx.moveTo(st[0].x, st[0].y);
        for (let i = 1; i < st.length; i++) ctx.lineTo(st[i].x, st[i].y);
        ctx.stroke();
      });
      ctx.restore();
    }

    function repaint() { drawGuide(strokes.length === 0); drawInk(); }

    /* ---------- her drawing ---------- */

    function pos(ev) {
      const r = cv.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (SIZE / r.width),
               y: (ev.clientY - r.top) * (SIZE / r.height) };
    }

    cv.addEventListener('pointerdown', ev => {
      if (demoing || !letterId) return;
      ev.preventDefault();
      // capture is a nicety; never let a refusal abort the stroke
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      cur = [pos(ev)];
      strokes.push(cur);
      repaint();
      if (opts.onPractised) opts.onPractised(letterId);
    });
    cv.addEventListener('pointermove', ev => {
      if (!cur || demoing) return;
      ev.preventDefault();
      cur.push(pos(ev)); repaint();
    });
    const lift = () => { cur = null; };
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);

    /* ---------- the demonstration ---------- */

    function demo(done) {
      if (!letterId || !ref.length) { if (done) done(); return; }
      cancelAnimationFrame(anim); clearTimeout(demoGuard);
      demoing = true;
      let i = 0, t = 0, ended = false;
      const speed = 0.022;
      const trail = [];

      const finish = () => {
        if (ended) return;
        ended = true; demoing = false;
        cancelAnimationFrame(anim); clearTimeout(demoGuard);
        repaint();
        if (done) done();
      };
      /* rAF stops when the tab is hidden or not compositing, so `finish` is
         armed on a timer too — otherwise the board would stay locked. */
      demoGuard = setTimeout(finish, ref.length * (1 / speed) * 17 + 3400);

      function frame() {
        if (ended) return;
        t += speed;
        if (t >= 1) { trail.push(ref[i].map(toPx)); i++; t = 0; }
        if (i >= ref.length) { setTimeout(finish, 650); return; }

        drawGuide(false);
        drawInk();                       // her own work stays visible underneath
        ctx.save();
        ctx.strokeStyle = '#37c07a'; ctx.lineWidth = 13;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        trail.forEach(pts => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
        });
        const pts = ref[i].map(toPx);
        const at = along(pts, t);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        at.upto.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(at.p.x, at.p.y);
        ctx.stroke();
        ctx.fillStyle = '#1e7a4a';
        ctx.beginPath(); ctx.arc(at.p.x, at.p.y, 11, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Rubik, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), at.p.x, at.p.y);
        ctx.restore();
        anim = requestAnimationFrame(frame);
      }
      frame();
    }

    /* ---------- api ---------- */

    function setLetter(id, autoDemo) {
      cancelAnimationFrame(anim); clearTimeout(demoGuard);
      demoing = false;
      letterId = id;
      ref = STROKES[id] || [];
      strokes = [];
      repaint();
      if (autoDemo !== false) demo();
    }

    function clear() {
      if (demoing) return;
      strokes = [];
      repaint();
    }

    host.appendChild(cv);

    const api = {
      el: cv, setLetter, clear, demo, repaint,
      get letterId() { return letterId; },
      get strokeCount() { return strokes.length; },
      get isDemoing() { return demoing; }
    };
    window.__write = api;
    return api;
  }

  return { board, SIZE, BOX, ORIGIN, toPx };
})();
