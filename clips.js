/* clips.js — storage for Abba's own recordings.

   Recordings live in IndexedDB on the device that made them, and are used in
   preference to TTS immediately. To get them onto every device, use Export in
   the recording studio: it produces a zip containing an audio/ folder and a
   clips.json manifest. Drop both into the project and commit — audio.js reads
   the manifest at startup, so no code edit is needed. */

const ClipStore = (function () {
  const DB = 'eliyaReadingClips', STORE = 'clips';
  const mem = new Map();          // key -> { blob, url }  (kept in memory so lookup is sync)
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => {
        if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
      };
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }

  function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }

  /* Load every recording into memory up front, so has()/url() can stay
     synchronous — the audio path is called from click handlers. */
  const ready = (async () => {
    try {
      db = await open();
      const all = await new Promise((res, rej) => {
        const out = [];
        const rq = tx('readonly').openCursor();
        rq.onsuccess = () => {
          const c = rq.result;
          if (!c) return res(out);
          out.push({ key: c.key, blob: c.value });
          c.continue();
        };
        rq.onerror = () => rej(rq.error);
      });
      all.forEach(r => mem.set(r.key, { blob: r.blob, url: URL.createObjectURL(r.blob) }));
    } catch (e) {
      console.warn('ClipStore unavailable:', e);
    }
    return true;
  })();

  async function put(key, blob) {
    const old = mem.get(key);
    if (old) URL.revokeObjectURL(old.url);
    mem.set(key, { blob: blob, url: URL.createObjectURL(blob) });
    if (!db) return;
    await new Promise((res, rej) => {
      const rq = tx('readwrite').put(blob, key);
      rq.onsuccess = res; rq.onerror = () => rej(rq.error);
    });
  }

  async function del(key) {
    const old = mem.get(key);
    if (old) URL.revokeObjectURL(old.url);
    mem.delete(key);
    if (!db) return;
    await new Promise((res, rej) => {
      const rq = tx('readwrite').delete(key);
      rq.onsuccess = res; rq.onerror = () => rej(rq.error);
    });
  }

  /* base64 <-> Blob, for carrying recordings through the database.
     btoa on a whole file blows the argument limit, so chunk it. */
  async function toBase64(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function fromBase64(b64, mime) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'audio/webm' });
  }

  return {
    ready,
    has: k => mem.has(k),
    url: k => { const e = mem.get(k); return e ? e.url : null; },
    blob: k => { const e = mem.get(k); return e ? e.blob : null; },
    keys: () => [...mem.keys()],
    count: () => mem.size,
    put, del, toBase64, fromBase64
  };
})();

/* ---------- minimal STORE-method zip writer ----------
   Audio is already compressed, so there is nothing to gain from deflate and
   this avoids pulling in a library. */
const Zip = (function () {
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function enc(s) { return new TextEncoder().encode(s); }

  /* files: [{ name, data: Uint8Array }] -> Blob */
  function build(files) {
    const chunks = [], central = [];
    let offset = 0;
    const DOSTIME = 0, DOSDATE = ((2024 - 1980) << 9) | (1 << 5) | 1;

    files.forEach(f => {
      const name = enc(f.name), data = f.data, crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true); lh.setUint16(6, 0, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, DOSTIME, true); lh.setUint16(12, DOSDATE, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true); cd.setUint16(6, 20, true);
      cd.setUint16(8, 0, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, DOSTIME, true); cd.setUint16(14, DOSDATE, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint16(30, 0, true); cd.setUint16(32, 0, true);
      cd.setUint16(34, 0, true); cd.setUint16(36, 0, true);
      cd.setUint32(38, 0, true); cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    });

    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    end.setUint16(20, 0, true);

    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)],
                    { type: 'application/zip' });
  }

  return { build, crc32 };
})();
