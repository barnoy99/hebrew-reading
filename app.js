/* app.js — screens, modes and the round loop. */

(function () {
  /* Must match version.json. Asset URLs carry ?v=N, but nothing versions
     index.html itself — and a page added to the home screen can hold on to it
     for a very long time. That is how the tablet ended up running a build from
     before sync existed, quietly playing TTS while 46 recordings sat in the
     cloud. So the app checks for a newer build and reloads itself. */
  const APP_VERSION = 8;

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

  /* ---------- speech helper ---------- */

  function sayLetter(id, opts) {
    say(Engine.letterSay(id), Object.assign({ key: 'name_' + id, rate: 0.85 }, opts || {}));
  }

  /* ---------- round scaffolding ---------- */

  /* Wraps a continuation so it runs a beat AFTER the current utterance ends,
     and only if she is still on the same item — otherwise a late onend from a
     screen she already left would advance the wrong round. */
  function after(fn, pause) {
    const r = round, i = round ? round.idx : -1;
    return () => setTimeout(() => {
      if (round !== r || round.idx !== i) return;
      fn();
    }, pause === undefined ? 350 : pause);
  }

  const LEN = { listen: 8, hunt: 6, read: 6, write: 4 };

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
    } else if (mode === 'write') {
      // weakest-written letters first, never the same letter twice in a round
      const pool = Engine.writeQueue(LEN.write);
      pool.forEach(id => items.push({ kind: 'write', letterId: id }));
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
    if (item.kind === 'write')  return renderWrite(body, item.letterId);
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

    body.appendChild(el('div', 'prompt', SAY.pickHeard));

    const ear = el('button', 'ear big', '👂');
    ear.onclick = () => speakTarget(target, true);
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
          // advance only once the praise has actually finished speaking
          say(SAY.wasRight, { key: 'wasRight', rate: 0.95, interrupt: true, onend: after(next) });
        } else {
          b.classList.add('dim');
          Engine.record(target.key, false);
          const right = [...row.children].find(c => c.textContent === target.text);
          if (right) right.classList.add('reveal');
          speakTarget(target, true);
          round.locked = true;
          setTimeout(() => { round.locked = false; }, 400);
          // from now on only the correct card advances
          [...row.children].forEach(c => {
            if (c !== right) c.onclick = null;
          });
          if (right) right.onclick = () => {
            if (round.locked) return;
            round.locked = true;
            right.classList.remove('reveal');
            right.classList.add('right');
            sparkleAt(right, 12);
            say(SAY.wasRight, { key: 'wasRight', rate: 0.95, interrupt: true, onend: after(next) });
          };
        }
      };
      row.appendChild(b);
    });
    body.appendChild(row);

    speakTarget(target);
  }

  function speakTarget(t, interrupt) {
    say(t.say, { key: t.letterId + '_' + t.vowelId, rate: 0.65, interrupt: !!interrupt });
  }

  /* ---------- ציד אותיות ---------- */

  function renderHunt(body) {
    const g = Engine.huntGrid(12);
    let left = g.cells.filter(c => c.hit).length;

    body.appendChild(el('div', 'prompt', SAY.findLetter));
    const badge = el('div', 'target-badge', g.target.ch);
    badge.onclick = () => sayLetter(g.targetId, { interrupt: true });
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
            say(SAY.wasRight, { key: 'wasRight', rate: 0.95, interrupt: true, onend: after(next) });
          }
        } else {
          b.classList.add('miss');
          setTimeout(() => b.classList.remove('miss'), 400);
          Engine.recordLetter(c.id, false);
          sayLetter(c.id, { interrupt: true });
        }
      };
      grid.appendChild(b);
    });
    body.appendChild(grid);

    say('מצאי את כל האות ' + Engine.letterSay(g.targetId), { rate: 0.85 });
  }

  /* ---------- קוראת בקול ---------- */

  /* Nothing may hint at the answer before she commits: no picture, no gold
     "real word" styling, and the same prompt for real and nonsense words —
     otherwise she reads the picture instead of the letters. All of it is the
     reward for having answered. */
  function renderRead(body, isReal) {
    const rw = isReal ? Engine.randomRealWord() : null;
    const pw = rw ? null : Engine.pseudoWord();
    const text = rw ? rw.w : pw.text;
    const spoken = rw ? Engine.sayOf(rw.tts || rw.w) : pw.say;

    body.appendChild(el('div', 'prompt', SAY.readAloud));

    const w = el('div', 'word', text);
    body.appendChild(w);

    const ear = el('button', 'ear big', '👂');
    const judge = el('div', 'judge');
    judge.classList.add('hidden');

    ear.onclick = () => {
      say(spoken, { rate: 0.6, interrupt: true });
      judge.classList.remove('hidden');
    };
    body.appendChild(ear);

    [['😊', true], ['🤔', false]].forEach(([icon, ok]) => {
      const b = el('button', null, icon);
      b.onclick = () => {
        if (round.locked) return;
        round.locked = true;
        if (pw) pw.syllables.forEach(sy => Engine.record(sy.key, ok));
        else if (rw) rw.letters.forEach(id => Engine.recordLetter(id, ok));

        if (rw) {                       // now she may see what it meant
          w.classList.add('real');
          const pic = el('div', 'word-pic', rw.pic);
          w.parentNode.insertBefore(pic, w);
          sparkleAt(w, 16);
          say(SAY.realWord, { key: 'realWord', rate: 0.9, interrupt: true, onend: after(next, 500) });
        } else {
          if (ok) sparkleAt(w, 14);
          setTimeout(next, 650);
        }
      };
      judge.appendChild(b);
    });
    body.appendChild(judge);

    say(SAY.readAloud, { key: 'readAloud', rate: 0.9 });
  }

  /* ---------- כותבת אותיות ---------- */

  function renderWrite(body, letterId) {
    // two tries; after that she is shown how and the round moves on
    Write.render(body, letterId, {
      onDone: ok => { Engine.recordWrite(letterId, ok); next(); }
    });
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
    const lines = ['App build: v' + APP_VERSION,
      'Hebrew voice: ' +
      (Audio2.hasHebrew() ? Audio2.voiceName() : 'NONE — install a Hebrew TTS pack')];
    if (typeof Sync !== 'undefined') {
      const c = Sync.clips;
      lines.push('Sync: ' + (Sync.isDev ? 'off (localhost dev copy)' : Sync.status) +
                 '  ·  ' + Sync.path);
      lines.push('Clips: ' + ClipStore.count() + ' here, ' + c.remote +
                 ' in the cloud (' + c.pulled + ' pulled, ' + c.pushed + ' pushed)');
    }
    $('#parent-voice').textContent = lines.join('\n');

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

  /* ---------- אולפן הקלטות ---------- */

  let rec = null;   // { key, recorder, chunks, btn }

  function openStudio() {
    const items = Engine.audioManifest();
    const list = $('#studio-list');
    list.innerHTML = '';

    let group = null;
    items.forEach(it => {
      if (it.group !== group) {
        group = it.group;
        list.appendChild(el('div', 'sgroup', group));
      }
      const row = el('div', 'srow');
      row.dataset.key = it.key;

      const txt = el('div', 'stext' + (it.small ? ' small' : ''), it.text);
      row.appendChild(txt);

      const play = el('button', 'sbtn', '▶');
      play.title = 'השמעה';
      play.onclick = () => say(it.say, { key: it.key, rate: 0.7, interrupt: true });
      row.appendChild(play);

      const recBtn = el('button', 'sbtn rec', '●');
      recBtn.title = 'הקלטה';
      recBtn.onclick = () => toggleRecord(it.key, recBtn, row);
      row.appendChild(recBtn);

      const del = el('button', 'sbtn del', '✕');
      del.title = 'מחיקה';
      del.onclick = async () => {
        await ClipStore.del(it.key);
        if (typeof Sync !== 'undefined') Sync.pushClip(it.key);   // remove remotely too
        markRow(row, it.key); studioCount();
      };
      row.appendChild(del);

      markRow(row, it.key);
      list.appendChild(row);
    });

    studioCount();
    $('#studio').classList.remove('hidden');
  }

  function markRow(row, key) {
    const has = ClipStore.has(key);
    row.classList.toggle('has-clip', has);
    row.querySelector('.del').style.visibility = has ? 'visible' : 'hidden';
  }

  function studioCount() {
    const items = Engine.audioManifest();
    const done = items.filter(i => ClipStore.has(i.key)).length;
    let txt = done + ' מתוך ' + items.length + ' הוקלטו';
    if (typeof Sync !== 'undefined') {
      if (Sync.isDev) txt += ' · מקומי בלבד (localhost)';
      else if (Sync.status === 'synced') txt += ' · מסונכרן ☁';
      else if (Sync.status === 'off') txt += ' · ללא סנכרון';
      else if (Sync.status === 'local') txt += ' · אין חיבור';
    }
    $('#studio-count').textContent = txt;
  }

  function studioCountIfOpen() {
    if (!$('#studio').classList.contains('hidden')) { openStudio(); }
  }

  async function toggleRecord(key, btn, row) {
    if (rec && rec.key === key) return stopRecord();
    if (rec) stopRecord();

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert('אין גישה למיקרופון: ' + e.message);
      return;
    }
    Audio2.stop();
    const mr = new MediaRecorder(stream);
    const chunks = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      if (blob.size > 0) {
        await ClipStore.put(key, blob);
        // straight to the other devices, without waiting for an export
        if (typeof Sync !== 'undefined') Sync.pushClip(key);
      }
      btn.textContent = '●';
      btn.classList.remove('recording');
      markRow(row, key);
      studioCount();
      rec = null;
      // play it straight back so he can hear the take
      say('', { key: key });
    };
    rec = { key, recorder: mr, chunks, btn };
    mr.start();
    btn.textContent = '■';
    btn.classList.add('recording');
    // safety stop — a forgotten recording would run until the tab closes
    setTimeout(() => { if (rec && rec.key === key) stopRecord(); }, 6000);
  }

  function stopRecord() {
    if (!rec) return;
    try { rec.recorder.stop(); } catch (e) { rec = null; }
  }

  async function exportClips() {
    const keys = ClipStore.keys();
    if (!keys.length) { alert('עוד לא הוקלט כלום'); return; }

    const manifest = {};
    const files = [];
    for (const k of keys) {
      const blob = ClipStore.blob(k);
      const ext = (blob.type.indexOf('ogg') >= 0) ? 'ogg' : 'webm';
      const name = k.replace(/[^\w\-]/g, '_') + '.' + ext;
      manifest[k] = name;
      files.push({ name: 'audio/' + name, data: new Uint8Array(await blob.arrayBuffer()) });
    }
    files.push({
      name: 'audio/clips.json',
      data: new TextEncoder().encode(JSON.stringify(manifest, null, 2))
    });

    const zip = Zip.build(files);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(zip);
    a.download = 'eliya-clips.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
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

  /* Reload onto a fresh index.html when a newer build is published. The query
     string is what defeats the cache — reloading the same path would just be
     served from it again. Guarded by sessionStorage so it can never loop. */
  async function checkForUpdate() {
    try {
      const r = await fetch('version.json', { cache: 'no-store' });
      if (!r.ok) return;
      const v = (await r.json()).v;
      if (!v || v === APP_VERSION) return;
      if (sessionStorage.getItem('eliyaReading_updateTo') === String(v)) return;
      sessionStorage.setItem('eliyaReading_updateTo', String(v));
      location.replace(location.pathname + '?v=' + v);
    } catch (e) { /* offline — carry on with what we have */ }
  }

  async function init() {
    checkForUpdate();
    Engine.load();
    // recordings and the committed-clip manifest must be known before the
    // first sound plays, or she would hear TTS for something already recorded
    try { await Promise.all([ClipStore.ready, Audio2.manifestReady]); } catch (e) {}

    /* Cross-device sync. Never mid-round, so nothing shifts under her feet. */
    if (typeof Sync !== 'undefined') {
      Sync.setBusyCheck(() => round !== null);
      Sync.init((mergedProgress, newClips) => {
        if (mergedProgress && round === null) renderHome();
        if (newClips) studioCountIfOpen();
      });
    }

    // audio needs a real gesture before it will play on mobile
    const unlockOnce = () => {
      Audio2.unlock();
      window.removeEventListener('pointerdown', unlockOnce);
    };
    window.addEventListener('pointerdown', unlockOnce);

    document.querySelectorAll('.mode').forEach(b => {
      b.onclick = () => {
        startRound(b.dataset.mode);
      };
    });

    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => { Audio2.stop(); renderHome(); };
    });

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
    $('#parent-studio').onclick = openStudio;
    $('#studio-close').onclick = () => { stopRecord(); Audio2.stop(); $('#studio').classList.add('hidden'); };
    $('#studio-export').onclick = exportClips;
    $('#parent-reset').onclick = () => {
      if (confirm('לאפס את כל ההתקדמות?')) { Engine.reset(); $('#parent').classList.add('hidden'); renderHome(); }
    };

    renderHome();
    checkVoice();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.__app = { show, startRound, renderHome, openParent, openStudio,
                   get round() { return round; } };
})();
