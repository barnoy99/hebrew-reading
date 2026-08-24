/* sync.js — makes the device she happens to pick up irrelevant.

   Two things travel:
     progress   — merged via Engine.mergeState, never assigned over the top,
                  and pushed back debounced so a round of 8 answers costs one
                  round trip rather than eight.
     recordings — Abba's voice clips, so a syllable recorded on the tablet is
                  heard on the PC. A small index is read first and only clips
                  this device is missing are downloaded, in the background,
                  after the app is already usable.

   Local storage stays the source of truth and the app is fully usable offline.
   If Firebase is unreachable, blocked, or not configured, every function here
   quietly does nothing. */

const Sync = (function () {
  const PATH  = 'progress/eliyaReading';
  const CLIPS = 'progress/eliyaReadingClips';
  const PUSH_DELAY = 1500;
  const MAX_CLIP = 400 * 1024;     // refuse to upload a runaway recording

  let ref = null, clipRef = null;
  let ready = false;               // a first successful read happened
  let timer = null, onChange = null;
  let status = 'off';              // off | connecting | synced | local
  let clipInfo = { pulled: 0, pushed: 0, remote: 0 };

  /* A page served from localhost is a development copy and must never write to
     the live record — a test run here would otherwise overwrite her real
     progress, and the merge rules are designed so that cannot be undone. */
  const IS_DEV = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

  function configured() {
    return !IS_DEV
        && typeof FIREBASE_CONFIG !== 'undefined'
        && FIREBASE_CONFIG.apiKey
        && FIREBASE_CONFIG.apiKey.indexOf('YOUR_') !== 0
        && typeof firebase !== 'undefined';
  }

  /* Firebase keys may not contain . $ # [ ] / — none of ours do today, but a
     future prompt key might, and a rejected write is a silent data loss. */
  function safeKey(k) {
    return k.replace(/[.$#\[\]\/]/g, c => '~' + c.charCodeAt(0).toString(16));
  }

  function init(cb) {
    onChange = cb;
    if (!configured()) { status = 'off'; return false; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      ref = firebase.database().ref(PATH);
      clipRef = firebase.database().ref(CLIPS);
    } catch (e) { status = 'local'; return false; }

    status = 'connecting';
    Engine.setOnSave(push);
    pull();

    /* Coming back to the app is exactly when another device may have moved on.
       Mid-round is left alone so nothing shifts under her feet. */
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !busyRound()) pull();
    });
    return true;
  }

  let busyRound = () => false;
  function setBusyCheck(fn) { busyRound = fn; }

  /* ---------- progress ---------- */

  function pull() {
    if (!ref) return Promise.resolve(false);
    return ref.once('value').then(function (snap) {
      const merged = snap.val() ? Engine.mergeState(snap.val()) : false;
      ready = true;
      status = 'synced';
      push(true);                       // publish the merged result
      pullClips();                      // background, never blocks
      if (onChange) onChange(merged);
      return merged;
    }).catch(function () {
      status = 'local';
      if (onChange) onChange(false);
      return false;
    });
  }

  function push(now) {
    if (!ref || !ready) return;
    clearTimeout(timer);
    const write = function () {
      try {
        // Firebase rejects undefined; a JSON round trip also drops functions
        ref.set(JSON.parse(JSON.stringify(Engine.state())))
           .then(function () { status = 'synced'; })
           .catch(function () { status = 'local'; });
      } catch (e) { status = 'local'; }
    };
    if (now === true) write(); else timer = setTimeout(write, PUSH_DELAY);
  }

  /* ---------- recordings ---------- */

  /* Read the small index, then fetch only what this device lacks. Downloading
     every clip on every start would make the app slow to open for no reason. */
  function pullClips() {
    if (!clipRef || typeof ClipStore === 'undefined') return Promise.resolve(0);
    return clipRef.child('index').once('value').then(async function (snap) {
      const index = snap.val() || {};
      const entries = Object.keys(index).map(sk => ({ sk, meta: index[sk] }))
                            .filter(e => e.meta && e.meta.k);
      clipInfo.remote = entries.length;
      let got = 0;
      for (const e of entries) {
        if (ClipStore.has(e.meta.k)) continue;
        try {
          const d = await clipRef.child('data/' + e.sk).once('value');
          const b64 = d.val();
          if (!b64) continue;
          await ClipStore.put(e.meta.k, ClipStore.fromBase64(b64, e.meta.m));
          got++;
        } catch (err) { /* one bad clip must not stop the rest */ }
      }
      clipInfo.pulled += got;
      if (got && onChange) onChange(false, got);
      return got;
    }).catch(function () { return 0; });
  }

  /* Called after a recording is made or deleted in the studio. */
  async function pushClip(key) {
    if (!clipRef || typeof ClipStore === 'undefined') return false;
    const blob = ClipStore.blob(key);
    const sk = safeKey(key);
    try {
      if (!blob) {                                  // deleted locally
        await clipRef.child('data/' + sk).remove();
        await clipRef.child('index/' + sk).remove();
        return true;
      }
      if (blob.size > MAX_CLIP) return false;
      const b64 = await ClipStore.toBase64(blob);
      await clipRef.child('data/' + sk).set(b64);
      await clipRef.child('index/' + sk).set({
        k: key, m: blob.type || 'audio/webm', n: blob.size, t: Date.now()
      });
      clipInfo.pushed++;
      return true;
    } catch (e) { return false; }
  }

  /* Send anything recorded while offline or before sync was configured. */
  async function pushAllClips() {
    if (!clipRef || typeof ClipStore === 'undefined') return 0;
    let n = 0;
    for (const k of ClipStore.keys()) { if (await pushClip(k)) n++; }
    return n;
  }

  return {
    init, pull, push, pullClips, pushClip, pushAllClips, configured, setBusyCheck,
    get isDev() { return IS_DEV; },
    get status() { return status; },
    get clips() { return clipInfo; },
    get path() { return PATH; }
  };
})();

window.__sync = Sync;
