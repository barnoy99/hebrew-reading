/* write.js — כותבת אותיות.

   The letter, shown faint so she can trace it, and a board to draw on. That is
   the whole feature. There is no stroke animation and no guidance about how to
   form the letter — Abba teaches that himself — and nothing here scores,
   corrects, or moves her on. The only thing reported outward is "she drew on
   this letter", so the garden can still reward her for turning up. */

const Write = (function () {
  const SIZE = 300;
  const PEN  = 20;
  const BOX  = SIZE * 0.78;                 // keeps ל above and ק below in frame

  const font = px => '500 ' + px + 'px Rubik, Arial, sans-serif';

  function board(host, opts) {
    opts = opts || {};
    let letterId = null;
    let strokes = [], cur = null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.className = 'trace';
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    cv.style.width = SIZE + 'px'; cv.style.height = SIZE + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    function drawGuide() {
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (!letterId) return;
      ctx.save();
      ctx.font = font(BOX * 0.95);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(60,30,110,.15)';
      ctx.fillText(Engine.L[letterId].ch, SIZE / 2, SIZE / 2);
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

    function repaint() { drawGuide(); drawInk(); }

    function pos(ev) {
      const r = cv.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (SIZE / r.width),
               y: (ev.clientY - r.top) * (SIZE / r.height) };
    }

    cv.addEventListener('pointerdown', ev => {
      if (!letterId) return;
      ev.preventDefault();
      // capture is a nicety; never let a refusal abort the stroke
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      cur = [pos(ev)];
      strokes.push(cur);
      repaint();
      if (opts.onPractised) opts.onPractised(letterId);
    });
    cv.addEventListener('pointermove', ev => {
      if (!cur) return;
      ev.preventDefault();
      cur.push(pos(ev)); repaint();
    });
    const lift = () => { cur = null; };
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);

    function setLetter(id) { letterId = id; strokes = []; repaint(); }
    function clear() { strokes = []; repaint(); }

    host.appendChild(cv);

    const api = {
      el: cv, setLetter, clear, repaint,
      get letterId() { return letterId; },
      get strokeCount() { return strokes.length; }
    };
    window.__write = api;
    return api;
  }

  return { board, SIZE };
})();
