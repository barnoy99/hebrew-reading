/* audio.js — speaks Hebrew.
   Always prefers a recorded clip when one exists, otherwise falls back to TTS.

   To use your own voice: record e.g. "ba.mp3", drop it in audio/, and add its
   name to CLIPS below. No other code changes needed.
   Clip keys: syllables are "<letterId>_<vowelId>" (e.g. "bet_kamatz"),
   letter names are "name_<letterId>", prompts are the SAY key (e.g. "pickHeard"). */

const CLIPS = new Set([
  // 'bet_kamatz', 'bet_hirik', ...
]);

const Audio2 = (function () {
  let voice = null;
  let ready = false;
  let unlocked = false;
  let current = null;

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

  function stop() {
    if (current) { current.onended = null; current.pause(); current = null; }
    if (window.speechSynthesis) speechSynthesis.cancel();
  }

  /* text: Hebrew to speak.  opts: { key, rate, onend } */
  function speak(text, opts) {
    opts = opts || {};
    stop();

    if (opts.key && CLIPS.has(opts.key)) {
      current = new window.Audio('audio/' + opts.key + '.mp3');
      current.onended = () => { current = null; if (opts.onend) opts.onend(); };
      current.onerror = () => { current = null; tts(text, opts); };
      current.play().catch(() => { current = null; tts(text, opts); });
      return;
    }
    tts(text, opts);
  }

  function tts(text, opts) {
    if (!window.speechSynthesis) { if (opts.onend) opts.onend(); return; }
    if (!voice) pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'he-IL';
    if (voice) u.voice = voice;
    u.rate = opts.rate || 0.85;
    u.pitch = opts.pitch || 1.05;
    u.onend = () => { if (opts.onend) opts.onend(); };
    u.onerror = () => { if (opts.onend) opts.onend(); };
    speechSynthesis.speak(u);
  }

  return {
    unlock, speak, stop,
    hasHebrew: () => { if (!ready) pickVoice(); return !!voice; },
    voiceName: () => voice ? voice.name : '(none)'
  };
})();
