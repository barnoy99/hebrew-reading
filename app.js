/* app.js — screens, modes and the round loop. */

(function () {
  const $  = (sel) => document.querySelector(sel);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  };

  let round = null;

  /* ---------- screens ---------- */

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('#' + id).classList.add('active');
  }

  function say(text, opts) { Audio2.speak(text, opts); }

  function sparkle(x, y, n) {
    const chars = ['✨', '⭐', '💫', '🌟'];
    for (let i = 0; i < (n || 10); i++) {
      const s = el('div', 'spark', chars[Math.floor(Math.random() * chars.length)]);
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 130;
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', Math.cos(a) * d + 'px');
      s.style.setProperty('--dy', (Math.sin(a) * d - 40) + 'px');
      $('#sparkles').appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }

  function sparkleAt(node, n) {
    const r = node.getBoundingClientRect();
    sparkle(r.left + r.width / 2, r.top + r.height / 2, n);
  }

  /* ---------- home ---------- */

  function renderHome() {
    const s = Engine.state();
    $('#hello-text').textContent = 'שלום ' + CHILD.name + '!';
    document.querySelector('.mascot').textContent = THEME.mascot;

    const g = $('#garden');
    g.innerHTML = '';
    if (!s.garden.length) {
      g.appendChild(el('div', 'empty', 'הגן הקסום שלך עוד ריק — כל סבב מביא מתנה'));
    } else {
      s.garden.forEach((idx, i) => {
        const item = el('div', 'item', GARDEN[idx]);
        item.style.animationDelay = Math.min(i * 25, 600) + 'ms';
        g.appendChild(item);
      });
    }
    // the warning is controlled only by checkVoice(), so it never flashes
    // during the moment before Chrome has finished loading its voice list
    show('screen-home');
  }

  /* ---------- מעבדת הקסם (sandbox) ---------- */

  let lab = { letterId: null, vowelId: null };

  function renderSandbox() {
    const s = Engine.state();
    lab = { letterId: s.letters[0], vowelId: null };

    const lrow = $('#lab-letters'); lrow.innerHTML = '';
    s.letters.forEach(id => {
      const b = el('button', 'chip', Engine.L[id].ch);
      b.dataset.letter = id;
      b.onclick = () => { lab.letterId = id; renderLabVowels(); labUpdate(b); };
      lrow.appendChild(b);
    });

    renderLabVowels();
    labUpdate(lrow.firstChild);
    show('screen-sandbox');
    setTimeout(() => say(SAY.sandbox, { key: 'sandbox', rate: 0.9 }), 350);
  }

  /* A bare נקודה is nearly invisible on its own, so each vowel button carries
     the letter she has currently selected — she sees the exact result before
     committing, and there is no stray placeholder letter to confuse her. */
  function renderLabVowels() {
    const s = Engine.state();
    const vrow = $('#lab-vowels');
    vrow.innerHTML = '';
    s.vowels.forEach(id => {
      const b = el('button', 'chip', lab.letterId
        ? Engine.sylText(lab.letterId, id)
        : 'ב' + Engine.V[id].mark);
      b.dataset.vowel = id;
      if (id === lab.vowelId) b.classList.add('on');
      b.onclick = () => { lab.vowelId = id; labUpdate(b); };
      vrow.appendChild(b);
    });
  }

  function labUpdate(activeBtn) {
    if (activeBtn) {
      const row = activeBtn.parentElement;
      row.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      activeBtn.classList.add('on');
    }
    const out = $('#lab-out');
    if (lab.letterId && lab.vowelId) {
      const t = Engine.sylText(lab.letterId, lab.vowelId);
      out.textContent = t;
      labSay();
      sparkleAt(out, 6);
    } else if (lab.letterId) {
      out.textContent = Engine.L[lab.letterId].ch;
      say(Engine.L[lab.letterId].name, { key: 'name_' + lab.letterId, rate: 0.85 });
    } else {
      out.textContent = '?';
    }
  }

  function labSay() {
    if (!(lab.letterId && lab.vowelId)) {
      if (lab.letterId) say(Engine.L[lab.letterId].name, { key: 'name_' + lab.letterId });
      return;
    }
    const t = Engine.sylText(lab.letterId, lab.vowelId);
    say(Engine.ttsText(t), { key: lab.letterId + '_' + lab.vowelId, rate: 0.7 });
  }

  /* ---------- round scaffolding ---------- */

  const LEN = { listen: 8, hunt: 6, read: 6 };

  function startRound(mode) {
    round = { mode, idx: 0, total: LEN[mode], items: buildItems(mode), locked: false };
    show('screen-round');
    renderItem();
  }

  function buildItems(mode) {
    const items = [];
    if (mode === 'listen') {
      for (let i = 0; i < LEN.listen; i++) items.push({ kind: 'listen' });
    } else if (mode === 'hunt') {
      for (let i = 0; i < LEN.hunt; i++) items.push({ kind: 'hunt' });
    } else {
      const words = Engine.availableRealWords();
      const nReal = Math.min(2, words.length);
      for (let i = 0; i < LEN.read - nReal; i++) items.push({ kind: 'pseudo' });
      for (let i = 0; i < nReal; i++) items.push({ kind: 'real' });
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    }
    return items;
  }

  function renderProgress() {
    const p = $('#progress'); p.innerHTML = '';
    for (let i = 0; i < round.total; i++) {
      const d = el('div', 'dot');
      if (i < round.idx) d.classList.add('done');
      if (i === round.idx) d.classList.add('now');
      p.appendChild(d);
    }
  }

  function next() {
    round.idx++;
    if (round.idx >= round.total) return celebrate();
    renderItem();
  }

  function renderItem() {
    renderProgress();
    round.locked = false;
    const body = $('#round-body'); body.innerHTML = '';
    const item = round.items[round.idx];
    if (item.kind === 'listen') return renderListen(body);
    if (item.kind === 'hunt')   return renderHunt(body);
    return renderRead(body, item.kind === 'real');
  }

  /* ---------- שומעת ובוחרת ---------- */

  function renderListen(body) {
    const target = Engine.pickSyllable();
    const opts = Engine.makeDistractors(target, 2).concat([target]);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }

    body.appendChild(el('div', 'prompt', SAY.pickHeard.replace(/[֑-ׇ]/g, '')));

    const ear = el('button', 'ear big', '👂');
    ear.onclick = () => speakTarget(target);
    body.appendChild(ear);

    const row = el('div', 'options');
    opts.forEach(o => {
      const b = el('button', 'opt', o.text);
      b.onclick = () => {
        if (round.locked) return;
        if (o.phon === target.phon) {
          round.locked = true;
          b.classList.add('right');
          sparkleAt(b, 16);
          Engine.record(target.key, true);
          say(SAY.wasRight, { key: 'wasRight', rate: 0.95 });
          setTimeout(next, 1100);
        } else {
          b.classList.add('dim');
          Engine.record(target.key, false);
          const right = [...row.children].find(c => c.textContent === target.text);
          if (right) right.classList.add('reveal');
          say(Engine.ttsText(target.text), { key: target.letterId + '_' + target.vowelId, rate: 0.65 });
          round.locked = true;
          setTimeout(() => { round.locked = false; }, 400);
          // from now on only the correct card advances
          [...row.children].forEach(c => {
            if (c !== right) c.onclick = null;
          });
          if (right) right.onclick = () => {
            right.classList.remove('reveal');
            right.classList.add('right');
            sparkleAt(right, 12);
            setTimeout(next, 800);
          };
        }
      };
      row.appendChild(b);
    });
    body.appendChild(row);

    setTimeout(() => speakTarget(target), 450);
  }

  function speakTarget(t) {
    say(Engine.ttsText(t.text), { key: t.letterId + '_' + t.vowelId, rate: 0.65 });
  }

  /* ---------- ציד אותיות ---------- */

  function renderHunt(body) {
    const g = Engine.huntGrid(12);
    let left = g.cells.filter(c => c.hit).length;

    body.appendChild(el('div', 'prompt', 'מצאי את כל האותיות'));
    const badge = el('div', 'target-badge', g.target.ch);
    badge.onclick = () => say(g.target.name, { key: 'name_' + g.targetId });
    body.appendChild(badge);

    const grid = el('div', 'hunt-grid');
    g.cells.forEach(c => {
      const b = el('button', 'cell', Engine.L[c.id].ch);
      b.onclick = () => {
        if (b.classList.contains('found')) return;
        if (c.hit) {
          b.classList.add('found');
          sparkleAt(b, 8);
          Engine.recordLetter(g.targetId, true);
          if (--left === 0) {
            say(SAY.wasRight, { key: 'wasRight', rate: 0.95 });
            setTimeout(next, 900);
          }
        } else {
          b.classList.add('miss');
          setTimeout(() => b.classList.remove('miss'), 400);
          Engine.recordLetter(c.id, false);
          say(Engine.L[c.id].name, { key: 'name_' + c.id, rate: 0.85 });
        }
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);

    setTimeout(() => say('מצאי את כל ה' + g.target.name, { rate: 0.85 }), 350);
  }

  /* ---------- קוראת בקול ---------- */

  function renderRead(body, isReal) {
    const rw = isReal ? Engine.randomRealWord() : null;
    const pw = rw ? null : Engine.pseudoWord();
    const text = rw ? rw.w : pw.text;

    body.appendChild(el('div', 'prompt', isReal ? 'זאת מילה אמיתית! קראי אותה' : 'קראי בקול רם'));
    if (rw) body.appendChild(el('div', 'word-pic', rw.pic));

    const w = el('div', rw ? 'word real' : 'word', text);
    body.appendChild(w);

    const ear = el('button', 'ear big', '👂');
    const judge = el('div', 'judge');
    judge.classList.add('hidden');

    ear.onclick = () => {
      say(Engine.ttsText(text), { rate: 0.6 });
      judge.classList.remove('hidden');
    };
    body.appendChild(ear);

    [['😊', true], ['🤔', false]].forEach(([icon, ok]) => {
      const b = el('button', null, icon);
      b.onclick = () => {
        if (round.locked) return;
        round.locked = true;
        if (ok) sparkleAt(w, 14);
        if (pw) pw.syllables.forEach(sy => Engine.record(sy.key, ok));
        else if (rw) rw.letters.forEach(id => Engine.recordLetter(id, ok));
        setTimeout(next, 650);
      };
      judge.appendChild(b);
    });
    body.appendChild(judge);

    setTimeout(() => say(isReal ? SAY.realWord : SAY.readAloud, { rate: 0.9 }), 350);
  }

  /* ---------- חגיגה ---------- */

  function celebrate() {
    const res = Engine.finishRound();
    $('#celebrate-gift').textContent = res.gift;
    $('#celebrate-text').textContent = 'כל הכבוד! קיבלת מתנה לגן';

    const note = $('#celebrate-unlock');
    if (res.unlocked) {
      note.innerHTML = '';
      if (res.unlocked.type === 'letter') {
        const l = res.unlocked.items[0];
        note.appendChild(el('span', 'big', l.ch));
        note.appendChild(document.createTextNode('אות חדשה נפתחה!'));
      } else {
        note.appendChild(el('span', 'big', res.unlocked.items.map(v => 'ב' + (v.after ? '' : v.mark)).join(' ')));
        note.appendChild(document.createTextNode('ניקוד חדש נפתח!'));
      }
      note.classList.remove('hidden');
    } else {
      note.classList.add('hidden');
    }

    $('#celebrate').classList.remove('hidden');
    setTimeout(() => {
      sparkle(window.innerWidth / 2, window.innerHeight / 2, 26);
      say(SAY.roundDone, { key: 'roundDone', rate: 0.95 });
    }, 250);
  }

  /* ---------- מסך הורים ---------- */

  function openParent() {
    $('#parent-voice').textContent =
      'Hebrew voice: ' + (Audio2.hasHebrew() ? Audio2.voiceName() : 'NONE — install a Hebrew TTS pack');

    const mg = $('#parent-mastery'); mg.innerHTML = '';
    Engine.masteryReport().forEach(r => {
      const c = el('div', 'mcell');
      c.appendChild(el('div', 'ch', r.ch));
      const bar = el('div', 'bar');
      const fill = el('span'); fill.style.width = Math.round(r.score * 100) + '%';
      bar.appendChild(fill); c.appendChild(bar);
      c.appendChild(el('div', 'n', r.seen + ' תרגולים'));
      mg.appendChild(c);
    });

    const lg = $('#parent-letters'); lg.innerHTML = '';
    LETTERS.forEach(l => {
      const on = Engine.state().letters.indexOf(l.id) >= 0;
      const b = el('button', 'tg' + (on ? ' on' : ''), l.ch);
      b.onclick = () => { Engine.setLetterUnlocked(l.id, !on); openParent(); };
      lg.appendChild(b);
    });

    const vg = $('#parent-vowels'); vg.innerHTML = '';
    VOWELS.forEach(v => {
      const on = Engine.state().vowels.indexOf(v.id) >= 0;
      const b = el('button', 'tg' + (on ? ' on' : ''), 'ב' + v.mark);
      b.onclick = () => { Engine.setVowelUnlocked(v.id, !on); openParent(); };
      vg.appendChild(b);
    });

    $('#parent').classList.remove('hidden');
  }

  /* ---------- wiring ---------- */

  /* Chrome populates its voice list asynchronously, so poll briefly before
     telling the user there is no Hebrew voice. On Android this warning is
     real: the device needs a Hebrew TTS pack installed. */
  function checkVoice(tries) {
    tries = tries || 0;
    if (Audio2.hasHebrew()) { $('#no-voice').classList.add('hidden'); return; }
    if (tries < 10) return void setTimeout(() => checkVoice(tries + 1), 300);
    $('#no-voice').classList.remove('hidden');
  }

  function init() {
    Engine.load();

    // audio needs a real gesture before it will play on mobile
    const unlockOnce = () => {
      Audio2.unlock();
      window.removeEventListener('pointerdown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);

    document.querySelectorAll('.mode').forEach(b => {
      b.onclick = () => {
        const m = b.dataset.mode;
        if (m === 'sandbox') renderSandbox(); else startRound(m);
      };
    });

    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => { Audio2.stop(); renderHome(); };
    });

    $('#lab-say').onclick = labSay;

    $('#celebrate-ok').onclick = () => {
      $('#celebrate').classList.add('hidden');
      renderHome();
    };

    // parent panel: 3-second long-press, so random tapping can't reach it
    const gate = $('#parent-gate');
    let timer = null;
    const down = () => { timer = setTimeout(openParent, 3000); };
    const up   = () => { clearTimeout(timer); };
    gate.addEventListener('pointerdown', down);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => gate.addEventListener(e, up));

    $('#parent-close').onclick = () => { $('#parent').classList.add('hidden'); renderHome(); };
    $('#parent-reset').onclick = () => {
      if (confirm('לאפס את כל ההתקדמות?')) { Engine.reset(); $('#parent').classList.add('hidden'); renderHome(); }
    };

    renderHome();
    checkVoice();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.__app = { show, startRound, renderSandbox, renderHome, openParent, get round() { return round; } };
})();
