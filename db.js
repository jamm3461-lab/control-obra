// Almacenamiento local (IndexedDB). Funciona en la página y en el service worker.
(function () {
  const NOMBRE = 'control-obra';
  const VERSION = 1;
  let _db = null;

  function abrir() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(NOMBRE, VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('registros')) d.createObjectStore('registros', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('archivos')) d.createObjectStore('archivos', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('config')) d.createObjectStore('config', { keyPath: 'clave' });
        if (!d.objectStoreNames.contains('compartidos')) d.createObjectStore('compartidos', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function tx(store, modo, fn) {
    _db = _db || await abrir();
    return new Promise((res, rej) => {
      const t = _db.transaction(store, modo);
      const req = fn(t.objectStore(store));
      let out;
      if (req) req.onsuccess = () => { out = req.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
  }

  self.DB = {
    put: (st, v) => tx(st, 'readwrite', s => s.put(v)),
    get: (st, k) => tx(st, 'readonly', s => s.get(k)),
    all: (st) => tx(st, 'readonly', s => s.getAll()),
    del: (st, k) => tx(st, 'readwrite', s => s.delete(k)),
    clear: (st) => tx(st, 'readwrite', s => s.clear()),
    async getCfg(k, def) { const r = await this.get('config', k); return r ? r.valor : def; },
    setCfg(k, v) { return this.put('config', { clave: k, valor: v }); }
  };
})();
