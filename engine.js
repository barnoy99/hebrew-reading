/* engine.js — content generation, mastery tracking and progression.
   Knows nothing about the DOM. Inspect it live via window.__engine. */

const Engine = (function () {
  const KEY = 'eliyaReading_state';
  const L = {}; LETTERS.forEach(l => L[l.id] = l);
  const V = {}; VOWELS.forEach(v => V[v.id] = v);

  let s = null;

  /* ---------- state ---------- */

  function fresh() {
    return {
      letters: START_LETTERS.slice(),
      vowels: START_VOWELS.slice(),
      mastery: {},        // "letterId|vowelId" -> 0..1
      seen: {},           // "letterId|vowelId" -> count
      garden: [],         // indices into GARDEN
      rounds: 0,
      unlockCount: 0,
      newestLetter: null
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      s = raw ? JSON.parse(raw) : fresh();
    } catch (e) { s = fresh(); }
    // guard against a stale save referencing content that no longer exists
    s.letters = (s.letters || []).filter(id => L[id]);
    s.vowels  = (s.vowels  || []).filter(id => V[id]);
    if (!s.letters.length) s.letters = START_LETTERS.slice();
    if (!s.vowels.length)  s.vowels  = START_VOWELS.slice();
    return s;
  }

  function save() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function reset() { s = fresh(); save(); return s; }

  /* ---------- text building ---------- */

  function sylText(letterId, vowelId) {
    const l = L[letterId], v = V[vowelId];
    let t = l.ch;
    if (l.dagesh) t += 'ּ';   // v1 always uses the plosive form
    return t + v.mark;
  }

  /* The distinct SPOKEN form. Two options may never share one, or the
     question would have two correct answers (בָּ/בַּ, אָ/עָ, כָּ/קָ, טָ/תָ). */
  function phon(letterId, vowelId) {
    return L[letterId].sound + V[vowelId].sound;
  }

  /* What actually gets sent to the speech engine.
     An earlier version appended a silent ה here to stop TTS reading a bare
     syllable as a letter name. It was wrong: it also hit whole words, so
     בַּד was spoken "bade", גַּג "gaga" and גָּמָל "gamala". Text now goes to the
     engine exactly as written, and anything it still mangles gets a `tts`
     override in data.js — or a recording, which is the real fix. */
  function ttsText(text, override) {
    return override || text;
  }

  /* ---------- mastery ---------- */

  const key = (l, v) => l + '|' + v;
  function m(k) { return s.mastery[k] || 0; }

  function record(k, correct) {
    const cur = m(k);
    s.mastery[k] = correct
      ? Math.min(1, cur + 0.25 * (1 - cur) + 0.06)
      : Math.max(0, cur - 0.30);
    s.seen[k] = (s.seen[k] || 0) + 1;
    save();
  }

  /* Letter-recognition evidence (hunt mode, real words) is weaker than a
     decoded syllable, so it nudges every pair of that letter a little. */
  function recordLetter(letterId, correct) {
    s.vowels.forEach(v => {
      const k = key(letterId, v);
      const cur = m(k);
      s.mastery[k] = correct
        ? Math.min(1, cur + 0.08 * (1 - cur))
        : Math.max(0, cur - 0.10);
    });
    save();
  }

  function letterMastery(letterId) {
    let sum = 0;
    s.vowels.forEach(v => sum += m(key(letterId, v)));
    return s.vowels.length ? sum / s.vowels.length : 0;
  }

  function avgMastery() {
    let sum = 0;
    s.letters.forEach(l => sum += letterMastery(l));
    return s.letters.length ? sum / s.letters.length : 0;
  }

  function coverage() {   // fraction of pairs practised at least twice
    let ok = 0, total = 0;
    s.letters.forEach(l => s.vowels.forEach(v => {
      total++; if ((s.seen[key(l, v)] || 0) >= 2) ok++;
    }));
    return total ? ok / total : 0;
  }

  /* ---------- selection ---------- */

  function weightedPick(list) {
    const total = list.reduce((a, x) => a + x.w, 0);
    let r = Math.random() * total;
    for (const x of list) { r -= x.w; if (r <= 0) return x; }
    return list[list.length - 1];
  }

  function allPairs() {
    const out = [];
    s.letters.forEach(li => s.vowels.forEach(vi => {
      out.push({ letterId: li, vowelId: vi, key: key(li, vi) });
    }));
    return out;
  }

  /* Favours weak pairs, unseen pairs, and the most recently unlocked letter. */
  function pickSyllable(exclude) {
    const cands = allPairs()
      .filter(p => !exclude || p.key !== exclude)
      .map(p => {
        let w = 1 + 4 * (1 - m(p.key));
        if (!s.seen[p.key]) w += 3;
        if (p.letterId === s.newestLetter) w *= 2.5;
        return Object.assign({ w }, p);
      });
    const pick = weightedPick(cands);
    return decorate(pick);
  }

  function decorate(p) {
    const text = sylText(p.letterId, p.vowelId);
    return {
      letterId: p.letterId, vowelId: p.vowelId, key: p.key,
      text: text,
      say: TTS_FIX[p.key] || text,     // what the engine is asked to pronounce
      phon: phon(p.letterId, p.vowelId)
    };
  }

  /* Spoken form of any display text: a word, a letter name, a syllable. */
  function sayOf(text) { return TTS_FIX[text] || text; }
  function letterSay(letterId) {
    const l = L[letterId];
    return l.say || l.name;
  }

  /* Early on, a distractor differs from the target in exactly ONE dimension,
     so each question tests one idea. Once the pair is solid, distractors are
     drawn from the visually confusable letters instead. */
  function makeDistractors(target, n) {
    n = n || 2;
    const hard = m(target.key) > 0.6;
    const conf = L[target.letterId].confuse || [];
    const taken = new Set([target.phon]);

    const scored = allPairs()
      .map(decorate)
      .filter(p => !taken.has(p.phon))
      .map(p => {
        const sameLetter = p.letterId === target.letterId;
        const sameVowel  = V[p.vowelId].sound === V[target.vowelId].sound;
        const isConf     = conf.indexOf(p.letterId) >= 0;
        let sc = Math.random();
        if (sameLetter || sameVowel) sc += 3;          // one dimension only
        if (isConf) sc += hard ? 5 : -2.5;             // drill or avoid look-alikes
        return { p, sc };
      })
      .sort((a, b) => b.sc - a.sc);

    const out = [];
    for (const c of scored) {
      if (out.length >= n) break;
      if (taken.has(c.p.phon)) continue;               // never two same-sounding options
      taken.add(c.p.phon);
      out.push(c.p);
    }
    return out;
  }

  /* ---------- items ---------- */

  function pseudoWord(nSyl) {
    if (!nSyl) nSyl = avgMastery() > 0.65 ? 3 : 2;
    const syls = [];
    let guard = 0;
    while (syls.length < nSyl && guard++ < 120) {
      const nx = pickSyllable();
      if (syls.length) {
        // no immediate repeat of the same letter
        if (syls[syls.length - 1].letterId === nx.letterId) continue;
        // א and ע are silent, so mid-word they produce an unreadable
        // vowel-vowel run ("רַאָ"). They may only open a word.
        if (L[nx.letterId].silent) continue;
      }
      syls.push(nx);
    }
    const text = syls.map(x => x.text).join('');
    return { syllables: syls, text: text, say: TTS_FIX[text] || syls.map(x => x.say).join('') };
  }

  function availableRealWords() {
    return REAL_WORDS.filter(w =>
      w.letters.every(l => s.letters.indexOf(l) >= 0) &&
      w.vowels.every(v => s.vowels.indexOf(v) >= 0));
  }

  function randomRealWord() {
    const pool = availableRealWords();
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  /* Grid for the letter-hunt mode: `count` copies of the target hidden among
     look-alikes where possible. */
  function huntGrid(size) {
    size = size || 12;
    const targetId = weightedPick(s.letters.map(id => ({
      id, w: 1 + 3 * (1 - letterMastery(id))
    }))).id;
    const hits = Math.min(4, Math.max(2, Math.round(size / 4)));
    const cells = [];
    for (let i = 0; i < hits; i++) cells.push({ id: targetId, hit: true });

    const others = s.letters.filter(id => id !== targetId);
    const conf = (L[targetId].confuse || []).filter(id => others.indexOf(id) >= 0);
    while (cells.length < size) {
      const pool = (conf.length && Math.random() < 0.45) ? conf : others;
      if (!pool.length) break;
      cells.push({ id: pool[Math.floor(Math.random() * pool.length)], hit: false });
    }
    for (let i = cells.length - 1; i > 0; i--) {         // shuffle
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    return { targetId, target: L[targetId], cells };
  }

  /* ---------- progression ---------- */

  function nextVowelGroup() {
    const orders = [...new Set(VOWELS.map(v => v.order))].sort((a, b) => a - b);
    for (const o of orders) {
      const grp = VOWELS.filter(v => v.order === o);
      if (grp.some(v => s.vowels.indexOf(v.id) < 0)) return grp;
    }
    return null;
  }

  /* Called after a round. Returns {type,items} when something new opened up. */
  function tryUnlock() {
    if (avgMastery() < 0.72 || coverage() < 0.6) return null;
    const n = s.unlockCount || 0;
    const wantVowel = (n % 3 === 2);

    const openVowels = () => {
      const g = nextVowelGroup();
      if (!g) return null;
      g.forEach(v => { if (s.vowels.indexOf(v.id) < 0) s.vowels.push(v.id); });
      s.unlockCount = n + 1; save();
      return { type: 'vowels', items: g };
    };
    const openLetter = () => {
      const id = LETTER_ORDER.find(x => s.letters.indexOf(x) < 0);
      if (!id) return null;
      s.letters.push(id); s.newestLetter = id;
      s.unlockCount = n + 1; save();
      return { type: 'letter', items: [L[id]] };
    };

    return wantVowel ? (openVowels() || openLetter())
                     : (openLetter() || openVowels());
  }

  function finishRound() {
    s.rounds++;
    const idx = s.garden.length % GARDEN.length;
    s.garden.push(idx);
    save();
    return { gift: GARDEN[idx], unlocked: tryUnlock() };
  }

  /* ---------- parent panel ---------- */

  function masteryReport() {
    return s.letters.map(id => ({
      id, ch: L[id].ch, name: L[id].name,
      score: letterMastery(id),
      seen: s.vowels.reduce((a, v) => a + (s.seen[key(id, v)] || 0), 0)
    })).sort((a, b) => a.score - b.score);
  }

  function setLetterUnlocked(id, on) {
    const i = s.letters.indexOf(id);
    if (on && i < 0) s.letters.push(id);
    if (!on && i >= 0 && s.letters.length > 2) s.letters.splice(i, 1);
    save();
  }
  function setVowelUnlocked(id, on) {
    const i = s.vowels.indexOf(id);
    if (on && i < 0) s.vowels.push(id);
    if (!on && i >= 0 && s.vowels.length > 1) s.vowels.splice(i, 1);
    save();
  }

  return {
    load, save, reset,
    state: () => s,
    L, V, sylText, phon, ttsText, sayOf, letterSay, key,
    pickSyllable, makeDistractors, pseudoWord, huntGrid,
    randomRealWord, availableRealWords,
    record, recordLetter, letterMastery, avgMastery, coverage,
    finishRound, tryUnlock,
    masteryReport, setLetterUnlocked, setVowelUnlocked
  };
})();

window.__engine = Engine;
