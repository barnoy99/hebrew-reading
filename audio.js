/* audio.js — speaks Hebrew.
   Always prefers a recorded clip when one exists, otherwise falls back to TTS.

   Everything goes through a FIFO queue. Nothing is ever cut off mid-sentence
   unless stop() is called explicitly (leaving a screen), because the round loop
   waits for onend instead of guessing with a timer.

   To use your own voice: record e.g. "bet_kamatz.mp3", drop it in audio/, and
   add its name to CLIPS below. No other code changes needed.
   Clip keys: syllables are "<letterId>_<vowelId>" (e.g. "bet_kamatz"),
   letter names are "name_<letterId>", prompts are the SAY key. */

const CLIPS = new Set([
  // 'bet_kamatz', 'bet_hirik', ...
]);

/* Filled from audio/clips.json at startup, which the recording studio's export
   generates. key -> filename inside audio/. */
const CLIP_FILES = new Map();

const Audio2 = (function () {
  let voice = null;
  let ready = false;
  let unlocked = false;

  const queue = [];
  let playing = false;
  let current = null;      // the HTMLAudioElement or utterance in flight
  let guard = null;        // fallback timer, see runTTS

  function pickVoice() {
    const all = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    voice = all.find(v => /^he/i.test(v.lang) || /^iw/i.test(v.lang)) || null;
    ready = true;
    return voice;
  }

  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  /* Mobile browsers refuse audio until a real user gesture. Call once on first tap. */
  function unlock() {
    if (unlocked || !window.speechSynthesis) return;
    unlocked = true;
    if (!voice) pickVoice();
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    } catch (e) { /* nothing to do */ }
  }

  /* ---------- queue ---------- */

  function stop() {
    queue.length = 0;
    clearTimeout(guard);
    if (current && current.pause) { current.onended = null; current.onerror = null; current.pause(); }
    current = null;
    playing = false;
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  function pump() {
    if (playing) return;
    const item = queue.shift();
    if (!item) return;
    playing = true;
    run(item, () => {
      playing = false;
      current = null;
      if (item.onend) { try { item.onend(); } catch (e) {} }
      pump();
    });
  }

  /* Three tiers, best first: a recording made on this device, a clip committed
     to audio/, then the speech engine. */
  function clipSrc(key) {
    if (!key) return null;
    if (typeof ClipStore !== 'undefined' && ClipStore.has(key)) return ClipStore.url(key);
    if (CLIP_FILES.has(key)) return 'audio/' + CLIP_FILES.get(key);
    if (CLIPS.has(key)) return 'audio/' + key + '.mp3';
    return null;
  }

  function run(item, done) {
    let finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(guard); done(); };

    const src = clipSrc(item.key);
    if (src) {
      const a = new window.Audio(src);
      current = a;
      a.onended = finish;
      a.onerror = () => runTTS(item, finish);
      a.play().catch(() => runTTS(item, finish));
      return;
    }
    runTTS(item, finish);
  }

  function runTTS(item, finish) {
    if (!window.speechSynthesis) return finish();
    if (!voice) pickVoice();
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'he-IL';
    if (voice) u.voice = voice;
    u.rate = item.rate || 0.85;
    u.pitch = item.pitch || 1.05;
    u.onend = finish;
    u.onerror = finish;
    current = u;

    /* speechSynthesis.onend is genuinely unreliable — it can simply never fire.
       Without this the round would freeze, since advancing now waits on it.
       Erring short is safe: the browser serialises utterances itself, so a
       premature finish only advances the screen, it never cuts the audio. */
    clearTimeout(guard);
    const est = 700 + item.text.length * 150 / (u.rate || 1);
    guard = setTimeout(finish, Math.min(6000, est));

    speechSynthesis.speak(u);
  }

  /* text: Hebrew to speak.  opts: { key, rate, pitch, onend, interrupt } */
  function speak(text, opts) {
    opts = opts || {};
    if (opts.interrupt) stop();
    queue.push({
      text: text, key: opts.key, rate: opts.rate,
      pitch: opts.pitch, onend: opts.onend
    });
    pump();
  }

  /* Speak, then run cb once it has actually finished. */
  function speakThen(text, opts, cb) {
    if (typeof opts === 'function') { cb = opts; opts = {}; }
    opts = Object.assign({}, opts, { onend: cb });
    speak(text, opts);
  }

  /* Committed recordings, if any have been exported into the project. */
  const manifestReady = fetch('audio/clips.json', { cache: 'no-cache' })
    .then(r => r.ok ? r.json() : null)
    .then(m => { if (m) Object.keys(m).forEach(k => CLIP_FILES.set(k, m[k])); })
    .catch(() => { /* no manifest yet — TTS covers everything */ });

  return {
    unlock, speak, speakThen, stop, clipSrc, manifestReady,
    isBusy: () => playing || queue.length > 0,
    hasRecording: k => !!clipSrc(k),
    hasHebrew: () => { if (!ready) pickVoice(); return !!voice; },
    voiceName: () => voice ? voice.name : '(none)'
  };
})();
