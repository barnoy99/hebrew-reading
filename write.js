/* write.js — כותבת אותיות.

   Coverage scoring is ported from Abigail's English app: the guide glyph she
   traces and the mask she is scored against are rendered from the SAME font
   call, so the target she sees and the target she is judged on cannot drift
   apart, and no per-letter outline data is needed.

   What is new here is the part the user actually asked for: checking that she
   forms the letter correctly — right number of strokes, right order, starting
   at the right end and moving the right way — so she cannot pass by drawing a
   ד from the bottom up. When she gets it wrong the correct way is animated
   over her attempt with numbered arrows, and she retries. */

const Write = (function () {
  const SIZE = 300;
  const TOL = 26;        // how far off the glyph her line may stray
  const PEN = 22;
  /* Tuned against a synthetic perfect trace of all 22 letters, which scores
     precision 0.90-1.00 and recall 0.47-0.95. A real five-year-old is far
     sloppier than that, so both thresholds sit well below the worst letter.
     A single dot still fails on recall and a box-filling scribble on precision. */
  const PASS = { precision: 0.55, recall: 0.38 };

  /* The 0..100 stroke coordinates were read off a grid where the glyph filled
     an inset BOX, so the glyph here must be drawn to exactly that same box or
     every skeleton sits in the wrong place. The inset also leaves room for the
     two letters that break the line: ל above it and ק below. */
  const BOX = SIZE * 0.78;
  const ORIGIN = (SIZE - BOX) / 2;

  function font(px) { return '500 ' + px + 'px Rubik, Arial, sans-serif'; }
  function glyphPx() { return BOX * 0.95; }

  const TRIES = 2;        // after this many, show her how and move on

  const MSG = {
    reversed:  'מתחילים מלמעלה ויורדים למטה',
    start:     'מתחילים מהעיגול הצהוב',
    direction: 'לכי לכיוון של החץ',
    count:     'בואי נראה איך כותבים את זה',
    coverage:  'צריך לצייר על כל האות'
  };
  /* Said on the last try instead of a correction: at this point she has had
     her two goes, so this is a demonstration, not another thing to fix. */
  const SHOW_ME = 'ככה כותבים את האות. בפעם הבאה תצליחי!';

  /* ---------- geometry ---------- */

  const toPx = p => ({ x: ORIGIN + p[0] / 100 * BOX, y: ORIGIN + p[1] / 100 * BOX });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* Walk a polyline at even spacing. Raw point density follows drawing speed,
     so comparing captured points directly would punish a child who slows down
     at a corner. */
  function resample(pts, N) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
    if (len === 0) return new Array(N).fill({ x: pts[0].x, y: pts[0].y });
    const out = [];
    let seg = 0, acc = 0;
    for (let k = 0; k < N; k++) {
      const want = len * k / (N - 1);
      while (seg < pts.length - 2 && acc + dist(pts[seg], pts[seg + 1]) < want) {
        acc += dist(pts[seg], pts[seg + 1]); seg++;
      }
      const d = dist(pts[seg], pts[seg + 1]) || 1;
      const t = Math.min(1, Math.max(0, (want - acc) / d));
      out.push({ x: pts[seg].x + (pts[seg + 1].x - pts[seg].x) * t,
                 y: pts[seg].y + (pts[seg + 1].y - pts[seg].y) * t });
    }
    return out;
  }

  function meanDist(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += dist(a[i], b[i]);
    return s / a.length;
  }

  /* A child lifts the pen mid-letter all the time. If a new stroke resumes
     where the last one stopped, treat it as the same stroke. Kept tight: ב's
     base legitimately starts close to where its descender ended, and merging
     those two would make a correctly written ב look like one stroke. */
  function mergeContinuations(strokes) {
    const tol = 0.045 * SIZE;
    const out = [];
    strokes.forEach(s => {
      if (!s || !s.length) return;
      const last = out[out.length - 1];
      if (last && dist(last[last.length - 1], s[0]) < tol) {
        last.push.apply(last, s);
        return;
      }
      out.push(s.slice());
    });
    return out;
  }

  /* Did she form it the right way, or just end up with the right shape? */
  function checkForm(letterId, drawn) {
    const ref = STROKES[letterId];
    if (!ref) return { ok: true };

    /* Prefer her strokes as drawn; only fall back to merging if the raw count
       is wrong, which is the case a mid-stroke pen lift produces. */
    const raw = (drawn || []).filter(s => s && s.length > 1);
    const merged = mergeContinuations(drawn).filter(s => s.length > 1);
    const strokes = (raw.length === ref.length) ? raw : merged;

    if (strokes.length !== ref.length) {
      return { ok: false, reason: 'count', expected: ref.length, got: strokes.length };
    }

    for (let i = 0; i < ref.length; i++) {
      const r = ref[i].map(toPx);
      const s = strokes[i];
      const rs = r[0], re = r[r.length - 1];
      const ss = s[0], se = s[s.length - 1];

      /* Compare the whole path, not just its ends. This is what catches a
         closed letter like ס drawn the wrong way round, where the start, the
         end and the centre are all identical whichever way you go. */
      const N = 24;
      const R = resample(r, N), D = resample(s, N);
      const fwd = meanDist(R, D);
      const bwd = meanDist(R, D.slice().reverse());

      if (bwd < fwd * 0.85) return { ok: false, reason: 'reversed', index: i };
      if (dist(ss, rs) > STROKE_RULES.startNear / 100 * BOX) {
        return { ok: false, reason: 'start', index: i };
      }
      if (fwd > STROKE_RULES.pathNear / 100 * BOX) {
        return { ok: false, reason: 'count', index: i };
      }
    }
    return { ok: true };
  }

  /* precision = how much of her ink landed on the letter.
     recall    = how much of the letter she covered.
     Both are needed: precision alone passes a dot, recall alone passes a
     scribble that fills the whole box. */
  function scoreCoverage(ch, strokes) {
    const N = SIZE;
    const mk = () => { const c = document.createElement('canvas'); c.width = N; c.height = N; return c; };

    const mc = mk().getContext('2d');
    mc.font = font(glyphPx()); mc.textAlign = 'center'; mc.textBaseline = 'middle';
    mc.fillStyle = '#000'; mc.fillText(ch, N / 2, N / 2);
    const ink = mc.getImageData(0, 0, N, N).data;

    const fc = mk().getContext('2d');           // the glyph fattened by TOL
    fc.font = font(glyphPx()); fc.textAlign = 'center'; fc.textBaseline = 'middle';
    fc.fillStyle = '#000'; fc.strokeStyle = '#000';
    fc.lineWidth = TOL * 2; fc.lineJoin = 'round';
    fc.strokeText(ch, N / 2, N / 2); fc.fillText(ch, N / 2, N / 2);
    const fat = fc.getImageData(0, 0, N, N).data;

    const dc = mk().getContext('2d');           // her strokes, rasterised thick
    dc.strokeStyle = '#000'; dc.fillStyle = '#000';
    dc.lineWidth = PEN + 14; dc.lineCap = 'round'; dc.lineJoin = 'round';
    strokes.forEach(st => {
      if (!st.length) return;
      if (st.length === 1) { dc.beginPath(); dc.arc(st[0].x, st[0].y, PEN, 0, 7); dc.fill(); return; }
      dc.beginPath(); dc.moveTo(st[0].x, st[0].y);
      for (let i = 1; i < st.length; i++) dc.lineTo(st[i].x, st[i].y);
      dc.stroke();
    });
    const drawn = dc.getImageData(0, 0, N, N).data;

    let inside = 0, points = 0;
    strokes.forEach(st => st.forEach(p => {
      const x = Math.round(p.x), y = Math.round(p.y);
      points++;
      if (x < 0 || y < 0 || x >= N || y >= N) return;
      if (fat[(y * N + x) * 4 + 3] > 10) inside++;
    }));

    let covered = 0, total = 0;
    for (let i = 0; i < N * N; i++) {
      if (ink[i * 4 + 3] > 40) { total++; if (drawn[i * 4 + 3] > 10) covered++; }
    }
    return {
      precision: points ? inside / points : 0,
      recall: total ? covered / total : 0
    };
  }

  /* ---------- the screen ---------- */

  function render(host, letterId, opts) {
    opts = opts || {};
    const letter = LETTERS.find(l => l.id === letterId);
    const ch = letter.ch;
    const ref = STROKES[letterId] || [];

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = document.createElement('canvas');
    cv.className = 'trace';
    cv.width = SIZE * dpr; cv.height = SIZE * dpr;
    cv.style.width = SIZE + 'px'; cv.style.height = SIZE + 'px';
    const ctx = cv.getContext('2d');
    ctx.scale(dpr, dpr);

    let strokes = [], cur = null, busy = false, settle = null, anim = null,
        attempts = 0, demoGuard = null;

    function drawGuide(showHints) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.save();
      ctx.font = font(glyphPx());
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(60,30,110,.13)';
      ctx.fillText(ch, SIZE / 2, SIZE / 2);
      ctx.restore();
      if (showHints !== false) hints();
    }

    /* numbered start dots + an arrowhead so she knows where to begin */
    function hints() {
      ref.forEach((st, i) => {
        const a = toPx(st[0]);
        ctx.save();
        ctx.fillStyle = '#ffd257';
        ctx.strokeStyle = '#a07b00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(a.x, a.y, 14, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a4200'; ctx.font = 'bold 16px Rubik, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), a.x, a.y);
        const b = toPx(st[1] || st[0]);
        arrowHead(a, b, '#a07b00');
        ctx.restore();
      });
    }

    function arrowHead(from, to, colour) {
      const ang = Math.atan2(to.y - from.y, to.x - from.x);
      const L = 30;
      const tip = { x: from.x + Math.cos(ang) * L, y: from.y + Math.sin(ang) * L };
      ctx.save();
      ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x - Math.cos(ang - 0.45) * 12, tip.y - Math.sin(ang - 0.45) * 12);
      ctx.lineTo(tip.x - Math.cos(ang + 0.45) * 12, tip.y - Math.sin(ang + 0.45) * 12);
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

    function pos(ev) {
      const r = cv.getBoundingClientRect();
      return { x: (ev.clientX - r.left) * (SIZE / r.width),
               y: (ev.clientY - r.top) * (SIZE / r.height) };
    }

    cv.addEventListener('pointerdown', ev => {
      if (busy) return;
      ev.preventDefault();
      // capture is a nicety; if the browser refuses it the stroke must still
      // be recorded, so never let it abort the handler
      try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
      clearTimeout(settle);
      cur = [pos(ev)]; strokes.push(cur); repaint();
    });
    cv.addEventListener('pointermove', ev => {
      if (!cur || busy) return;
      ev.preventDefault();
      cur.push(pos(ev)); repaint();
    });
    function lift() {
      if (!cur) return;
      cur = null;
      clearTimeout(settle);
      settle = setTimeout(() => check(false), 1000);
    }
    cv.addEventListener('pointerup', lift);
    cv.addEventListener('pointercancel', lift);

    function check(forced) {
      if (busy) return;
      const cov = scoreCoverage(ch, strokes);
      const covOk = cov.precision >= PASS.precision && cov.recall >= PASS.recall;
      const form = checkForm(letterId, strokes);

      if (covOk && form.ok) return finish(true, null);
      if (!forced && !covOk) return;               // still drawing, let her carry on
      finish(false, !covOk ? { reason: 'coverage' } : form);
    }

    function finish(ok, problem) {
      busy = true;
      cv.style.pointerEvents = 'none';
      if (ok) {
        Audio2.speak(SAY.wasRight, { key: 'wasRight', rate: 0.95, interrupt: true });
        setTimeout(() => opts.onDone && opts.onDone(true), 900);
        return;
      }

      attempts++;
      const last = attempts >= TRIES;
      const msg = last ? SHOW_ME : (MSG[problem.reason] || MSG.count);
      note.textContent = msg;
      note.classList.remove('hidden');
      Audio2.speak(msg, { rate: 0.9, interrupt: true });

      demo(() => {
        if (last) {
          // two goes is enough — she has seen it done, now move on rather than
          // grinding on one letter until she gives up
          if (opts.onDone) opts.onDone(false);
          return;
        }
        note.classList.add('hidden');
        strokes = []; busy = false;
        cv.style.pointerEvents = '';
        repaint();
      });
    }

    /* Animate the correct way: each stroke drawn in order by a moving dot.
       requestAnimationFrame stops when the tab is hidden or not compositing,
       so `done` is also armed on a timer — without it, switching away mid-demo
       would strand her on a frozen screen the round could never leave. */
    function demo(done) {
      cancelAnimationFrame(anim);
      clearTimeout(demoGuard);
      let i = 0, t = 0, ended = false;
      const speed = 0.022;
      const trail = [];

      const finishDemo = () => {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(anim);
        clearTimeout(demoGuard);
        done();
      };
      const expected = ref.length * (1 / speed) * 17 + 900;
      demoGuard = setTimeout(finishDemo, expected + 2500);

      function frame() {
        if (ended) return;
        t += speed;
        if (t >= 1) { trail.push(ref[i].map(toPx)); i++; t = 0; }
        if (i >= ref.length) {
          setTimeout(finishDemo, 700);
          return;
        }
        drawGuide(false);
        // strokes already demonstrated
        ctx.save();
        ctx.strokeStyle = '#37c07a'; ctx.lineWidth = 14;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        trail.forEach(pts => {
          ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
          pts.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
          ctx.stroke();
        });
        // the stroke being drawn now
        const pts = ref[i].map(toPx);
        const at = along(pts, t);
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        at.upto.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(at.p.x, at.p.y);
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

    /* point at fraction f along a polyline, plus the vertices passed so far */
    function along(pts, f) {
      let total = 0;
      const segs = [];
      for (let i = 1; i < pts.length; i++) {
        const d = dist(pts[i - 1], pts[i]);
        segs.push(d); total += d;
      }
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

    /* ---------- layout ---------- */
    const wrap = document.createElement('div');
    wrap.className = 'trace-wrap';

    const title = document.createElement('div');
    title.className = 'prompt';
    title.textContent = 'כתבי את האות ' + letter.name;
    host.appendChild(title);

    const note = document.createElement('div');
    note.className = 'trace-note hidden';

    wrap.appendChild(cv);
    host.appendChild(wrap);
    host.appendChild(note);

    const bar = document.createElement('div');
    bar.className = 'trace-bar';
    const clear = document.createElement('button');
    clear.className = 'ghost'; clear.textContent = '↺ מחיקה';
    clear.onclick = () => { if (busy) return; strokes = []; clearTimeout(settle); repaint(); };
    const done = document.createElement('button');
    done.className = 'ghost'; done.textContent = '✓ סיימתי';
    done.onclick = () => { clearTimeout(settle); check(true); };
    const hear = document.createElement('button');
    hear.className = 'ghost'; hear.textContent = '👂';
    hear.onclick = () => Audio2.speak(Engine.letterSay(letterId),
                                      { key: 'name_' + letterId, interrupt: true });
    bar.appendChild(clear); bar.appendChild(done); bar.appendChild(hear);
    host.appendChild(bar);

    repaint();
    Audio2.speak('כתבי את האות ' + Engine.letterSay(letterId), { rate: 0.9, interrupt: true });

    const api = { strokes, check, repaint, demo, letterId, ch,
                  setStrokes: s => { strokes = s; repaint(); },
                  score: () => scoreCoverage(ch, strokes),
                  form: () => checkForm(letterId, strokes) };
    window.__write = api;
    return api;
  }

  return { render, checkForm, scoreCoverage, mergeContinuations, SIZE, PASS, MSG };
})();
