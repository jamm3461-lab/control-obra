// Lectura automática de soportes: QR de factura electrónica DIAN, texto de PDF y OCR de imágenes.
// Todo corre en el celular, sin costo.

const LIBS = {
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  jsqr: 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfworker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  jspdf: 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
};

const _libs = {};
function cargarLib(n) {
  if (!_libs[n]) {
    _libs[n] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = LIBS[n];
      s.onload = res;
      s.onerror = () => { delete _libs[n]; rej(new Error('No se pudo cargar el componente "' + n + '". ¿Hay internet?')); };
      document.head.appendChild(s);
    });
  }
  return _libs[n];
}

const Extractor = (() => {
  const esPDF = b => b && (b.type === 'application/pdf' || /\.pdf$/i.test(b.name || ''));

  // ---------- Montos ----------
  function parseMonto(s) {
    s = String(s == null ? '' : s).replace(/[^\d.,]/g, '');
    if (!s) return 0;
    if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/\.\d{1,2}$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(/[.,]/g, '');
    return Math.round(parseFloat(s) || 0);
  }

  const RE_MONTO = /\$\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\$\s?\d{3,}(?:[.,]\d{1,2})?|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?\b|\b\d{4,9}[.,]\d{2}\b/g;
  function montos(linea) {
    return (linea.match(RE_MONTO) || []).map(parseMonto).filter(v => v >= 1000 && v < 1e11);
  }

  function buscarValor(L) {
    const niveles = [
      /(total|neto|valor)\s*(a\s*)?pagar|total\s*factura|valor\s*total|gran\s*total|total\s*general/i,
      /^(?!.*sub\s*-?\s*total).*\btotal\b/i,
      /valor|monto|pagar|pago|transfer|enviaste|consigna|abono|anticipo|cobro/i
    ];
    for (const re of niveles) {
      const cands = [];
      L.forEach((l, i) => {
        if (!re.test(l)) return;
        let m = montos(l);
        if (!m.length && L[i + 1]) m = montos(L[i + 1]);
        cands.push(...m);
      });
      if (cands.length) return Math.max(...cands);
    }
    const todos = L.filter(l => !/nit|c\.?\s?c\b|c[eé]dula|tel|cel|cuenta|resoluci|autoriza/i.test(l)).flatMap(montos);
    return todos.length ? Math.max(...todos) : 0;
  }

  // ---------- Fechas ----------
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
  function valida(y, mo, d) {
    if (y < 2015 || y > 2040 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function fechaDe(l) {
    let m;
    if ((m = l.match(/\b(20\d{2})[-\/.](\d{1,2})[-\/.](\d{1,2})\b/))) return valida(+m[1], +m[2], +m[3]);
    if ((m = l.match(/\b(\d{1,2})[-\/.](\d{1,2})[-\/.](20\d{2}|\d{2})\b/))) {
      let y = +m[3]; if (y < 100) y += 2000;
      return valida(y, +m[2], +m[1]);
    }
    if ((m = l.match(/\b(\d{1,2})\s*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-záéíóú]*\.?\s*(?:de\s+|del\s+|[-\/]\s*)?(20\d{2})/i)))
      return valida(+m[3], MESES[m[2].toLowerCase()], +m[1]);
    return null;
  }
  function buscarFecha(L) {
    const prio = [/fecha.*(emisi|factura|expedici|generaci|pago)/i, /fecha/i];
    for (const re of prio) {
      for (let i = 0; i < L.length; i++) {
        if (!re.test(L[i])) continue;
        const f = fechaDe(L[i]) || (L[i + 1] ? fechaDe(L[i + 1]) : null);
        if (f) return f;
      }
    }
    for (const l of L) { const f = fechaDe(l); if (f) return f; }
    return null;
  }

  // ---------- Proveedor ----------
  function limpiarNombre(s) {
    return s.replace(/\s*\b(nit|c\.?\s?c\.?)\b.*$/i, '').replace(/[|_*"]+/g, ' ').replace(/\s{2,}/g, ' ').replace(/[:.,\-\s]+$/, '').trim().slice(0, 80);
  }
  function buscarProveedor(L) {
    const ETIQ = /^(?:beneficiario|titular|a nombre de|pagar a|proveedor|emisor|vendedor|destinatario|para|nombre)\s*[:.?]?$/i;
    for (let i = 0; i < L.length - 1; i++) {
      if (ETIQ.test(L[i]) && /[a-záéíóúñ]{3}/i.test(L[i + 1]) && !/\d{4,}/.test(L[i + 1])) return limpiarNombre(L[i + 1]);
    }
    for (const l of L) {
      if (/cliente|adquir|comprador/i.test(l)) continue;
      const m = l.match(/(?:beneficiario|titular|a nombre de|pagar a|proveedor|emisor|vendedor|destinatario|para)\s*[:.]?\s+(.{4,60})/i);
      if (m && /[a-záéíóúñ]{3}/i.test(m[1])) return limpiarNombre(m[1]);
    }
    const top = L.slice(0, 10);
    const emp = top.find(l => /\b(S\.?\s?A\.?\s?S\.?|LTDA|S\.\s?A\.|E\.\s?U\.|& ?C[IÍ]A|SOCIEDAD|FERRETER[IÍ]A|DEP[OÓ]SITO|DISTRIBU\w*|MATERIALES|CONSTRUC\w*|ALMAC[EÉ]N|COMERCIALIZ\w*|INVERSIONES)\b/i.test(l)
      && !/factura|cliente|señor/i.test(l));
    if (emp) return limpiarNombre(emp);
    const cand = top.find(l => {
      const letras = (l.match(/[a-záéíóúñ]/gi) || []).length;
      return letras >= 5 && letras / l.length > 0.6 &&
        !/factura|fecha|nit|direcci|tel|cel|www|http|@|r[eé]gimen|responsable|resoluci|p[aá]gina|original|copia|cliente|señor|iva|whatsapp|exitos|env[ií]o|transacci|comprobante|cu[aá]nto|buenas|hola/i.test(l);
    });
    return cand ? limpiarNombre(cand) : null;
  }

  // ---------- Texto general ----------
  function parseTexto(t) {
    const c = {};
    if (!t) return c;
    const L = t.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const T = L.join('\n');

    const nit = T.match(/N\.?\s?I\.?\s?T\.?\s*(?:No\.?)?\s*[:.#]?\s*(\d{1,3}(?:[.\s]?\d{3}){2,3})/i);
    if (nit) c.docId = nit[1].replace(/\D/g, '');
    else {
      const cc = T.match(/(?:\bC\.?\s?C\.?|c[ée]dula)\s*(?:de\s+ciudadan[ií]a)?\s*(?:No\.?|N[°º])?\s*[:.]?\s*(\d{1,3}(?:[.\s]?\d{3}){1,3})/i);
      if (cc) c.docId = cc[1].replace(/\D/g, '');
    }

    const f = T.match(/(?:factura(?:\s+electr[oó]nica)?(?:\s+de\s+venta)?(?:\s+electr[oó]nica)?|fact\.|cuenta\s+de\s+cobro)\s*(?:No\.?|N[°ºo]\.?|#|n[uú]mero)?\s*[:.]?\s*([A-Z]{0,6}[\s-]?\d{1,12})/i);
    if (f && /\d/.test(f[1])) c.factura = f[1].replace(/\s+/g, '').toUpperCase();

    const fecha = buscarFecha(L); if (fecha) c.fecha = fecha;
    const valor = buscarValor(L); if (valor) c.valor = valor;
    const prov = buscarProveedor(L); if (prov) c.tercero = prov;

    if (/planilla|\bpila\b|aportes|seguridad social/i.test(T)) c.soporteTipo = 'Planilla PILA';
    else if (/cuenta\s+de\s+cobro/i.test(T)) c.soporteTipo = 'Cuenta de cobro';
    else if (/factura\s+electr|cufe/i.test(T)) c.soporteTipo = 'Factura electrónica';
    else if (/transferencia|comprobante|nequi|daviplata|bancolombia|\bpse\b|consignaci/i.test(T)) c.soporteTipo = 'Comprobante de pago';

    if (/nequi/i.test(T)) c.medioPago = 'Nequi';
    else if (/daviplata/i.test(T)) c.medioPago = 'Daviplata';
    else if (/transferencia|\bpse\b|bancolombia|davivienda|bbva|banco de bogot/i.test(T)) c.medioPago = 'Transferencia';

    const cufe = T.match(/\b[0-9a-f]{96}\b/i); if (cufe) c.cufe = cufe[0];
    return c;
  }

  // ---------- QR factura electrónica DIAN ----------
  function parseQRDian(s) {
    const c = {}, m = {};
    s.replace(/([A-Za-z]+)\s*[:=]\s*([^\r\n]*)/g, (_, k, v) => { if (!(k.toLowerCase() in m)) m[k.toLowerCase()] = v.trim(); return ''; });
    const pick = re => { for (const k in m) if (re.test(k) && m[k]) return m[k]; };
    const num = pick(/^num(fac|ds|nc|nd)$/) || pick(/^num/); if (num) c.factura = num;
    const fec = pick(/^fec/); if (fec && /\d{4}-\d{2}-\d{2}/.test(fec)) c.fecha = fec.match(/\d{4}-\d{2}-\d{2}/)[0];
    const nit = pick(/^nit/); if (nit) c.docId = nit.replace(/\D/g, '');
    const tot = pick(/^valto[lt]/) || pick(/^valtot/); if (tot) c.valor = Math.round(parseFloat(tot.replace(/,/g, '')) || 0) || undefined;
    let cufe = pick(/^(cufe|cude|cuds)$/);
    if (!cufe) { const u = s.match(/documentkey=([0-9a-f]{40,})/i); if (u) cufe = u[1]; }
    if (!cufe) { const h = s.match(/\b[0-9a-f]{96}\b/i); if (h) cufe = h[0]; }
    if (cufe) c.cufe = cufe;
    Object.keys(c).forEach(k => c[k] === undefined && delete c[k]);
    if (Object.keys(c).length) c.soporteTipo = 'Factura electrónica';
    return c;
  }

  // ---------- Imagen / PDF ----------
  async function imagenACanvas(blob, max) {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    return c;
  }

  async function comprimirImagen(blob) {
    if (!blob.type.startsWith('image/') || blob.size < 900 * 1024) return blob;
    try {
      const c = await imagenACanvas(blob, 1800);
      return await new Promise(res => c.toBlob(b => res(b || blob), 'image/jpeg', 0.85));
    } catch { return blob; }
  }

  async function buscarQR(canvas) {
    await cargarLib('jsqr');
    const W = canvas.width, H = canvas.height;
    const intentos = [[0, 0, W, H, 1000], [0, 0, W, H, 1700],
      [W / 2, 0, W / 2, H / 2, 1000], [0, 0, W / 2, H / 2, 1000], [W / 2, H / 2, W / 2, H / 2, 1000],
      [0, H / 2, W / 2, H / 2, 1000], [W / 4, H / 4, W / 2, H / 2, 1000]];
    for (const [x, y, w, h, max] of intentos) {
      const k = Math.min(1, max / Math.max(w, h));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      const r = jsQR(d.data, c.width, c.height, { inversionAttempts: 'dontInvert' });
      if (r && r.data) return r.data;
      await new Promise(r => setTimeout(r, 0));
    }
    return null;
  }

  async function ocr(canvas, prog) {
    await cargarLib('tesseract');
    const worker = await Tesseract.createWorker('spa', 1, {
      logger: m => { if (m.status === 'recognizing text') prog(`Leyendo texto de la imagen… ${Math.round(m.progress * 100)}%`); }
    });
    try {
      const { data } = await worker.recognize(canvas);
      return data.text || '';
    } finally { await worker.terminate(); }
  }

  function lineasPDF(tc) {
    const filas = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      let f = filas.find(r => Math.abs(r.y - y) <= 3);
      if (!f) { f = { y, items: [] }; filas.push(f); }
      f.items.push({ x: it.transform[4], s: it.str });
    }
    filas.sort((a, b) => b.y - a.y);
    return filas.map(f => f.items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ')).join('\n');
  }

  async function procesar(blob, prog = () => {}) {
    const res = { campos: {}, texto: '', fuente: [] };
    let canvas;
    if (esPDF(blob)) {
      prog('Leyendo PDF…');
      await cargarLib('pdfjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = LIBS.pdfworker;
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
      for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
        const p = await pdf.getPage(i);
        res.texto += lineasPDF(await p.getTextContent()) + '\n';
      }
      const p1 = await pdf.getPage(1);
      const vp = p1.getViewport({ scale: 2.5 });
      canvas = document.createElement('canvas');
      canvas.width = vp.width; canvas.height = vp.height;
      await p1.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    } else {
      canvas = await imagenACanvas(blob, 2200);
    }

    prog('Buscando código QR de factura electrónica…');
    try {
      const qr = await buscarQR(canvas);
      if (qr) { res.qr = qr; Object.assign(res.campos, parseQRDian(qr)); res.fuente.push('QR DIAN'); }
    } catch (e) { console.warn('QR', e); }

    if (res.texto.trim().length > 30) res.fuente.push('texto del PDF');
    else { res.texto = await ocr(canvas, prog); res.fuente.push('lectura de imagen'); }

    const t = parseTexto(res.texto);
    for (const k in t) if (res.campos[k] == null || res.campos[k] === '') res.campos[k] = t[k];
    return res;
  }

  return { procesar, parseTexto, parseQRDian, parseMonto, comprimirImagen, esPDF };
})();

if (typeof module !== 'undefined') module.exports = { Extractor };
