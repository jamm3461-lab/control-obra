// Control de Obra – lógica principal
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const fmt = n => COP.format(n || 0);
const miles = n => Number(n || 0).toLocaleString('es-CO');
const num = s => parseInt(String(s || '').replace(/\D/g, ''), 10) || 0;
const hoy = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';
const suma = rs => rs.reduce((n, r) => n + (r.valor || 0), 0);
const mesTxt = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }); };
const fechaCorta = f => { if (!f) return ''; const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }); };

function toast(msg) {
  const d = document.createElement('div');
  d.textContent = msg;
  $('#toast').appendChild(d);
  setTimeout(() => d.remove(), 3600);
}

// ---------- Datos base ----------
const CONCEPTOS_BASE = [
  'Lote y gastos de compra', 'Licencias, permisos e impuestos', 'Diseños y estudios', 'Preliminares',
  'Movimiento de tierras y cimentación', 'Estructura', 'Mampostería', 'Cubierta',
  'Instalaciones hidrosanitarias y gas', 'Instalaciones eléctricas', 'Pañetes, estucos y pintura', 'Pisos y enchapes',
  'Carpintería, ventanería y vidrios', 'Aparatos sanitarios, cocina y accesorios', 'Mano de obra', 'Seguridad social y ARL',
  'Alquiler de equipos y herramienta', 'Transporte, acarreos y escombros', 'Servicios públicos de obra',
  'Honorarios profesionales', 'Vigilancia', 'Imprevistos y otros'
];
const PALABRAS = {
  'Lote y gastos de compra': ['notar', 'escritura', 'registro de instrumentos', 'beneficencia', 'boleta fiscal', 'lote'],
  'Licencias, permisos e impuestos': ['curadur', 'licencia', 'delineaci', 'predial', 'planeaci', 'impuesto'],
  'Diseños y estudios': ['diseño', 'plano', 'estudio de suelo', 'topograf', 'calculo estructural', 'cálculo estructural'],
  'Preliminares': ['cerramiento', 'polisombra', 'demolici', 'campamento', 'descapote'],
  'Movimiento de tierras y cimentación': ['excavaci', 'zapata', 'ciment', 'relleno', 'recebo', 'retroexcavadora', 'pilote'],
  'Estructura': ['cemento', 'concreto', 'varilla', 'acero', 'hierro', 'alambre negro', 'formaleta', 'triturado', 'arena', 'gravilla', 'mixer', 'malla electro', 'argos', 'cemex'],
  'Mampostería': ['ladrillo', 'bloque', 'mortero', 'mamposter'],
  'Cubierta': ['teja', 'cubierta', 'canal', 'impermeabiliz', 'eternit', 'cercha', 'manto'],
  'Instalaciones hidrosanitarias y gas': ['pvc', 'tubo', 'tuberia', 'tubería', 'codo', 'hidraul', 'hidrául', 'pavco', 'tanque', 'gas', 'sifon', 'sifón', 'llave de paso'],
  'Instalaciones eléctricas': ['cable', 'breaker', 'toma', 'interruptor', 'electric', 'eléctric', 'tablero', 'luminaria', 'bombillo', 'conduit', 'thhn'],
  'Pañetes, estucos y pintura': ['estuco', 'pintura', 'pañete', 'vinilo', 'drywall', 'yeso', 'sellador', 'lija', 'pintuco'],
  'Pisos y enchapes': ['ceramica', 'cerámica', 'porcelanato', 'piso', 'enchape', 'baldosa', 'pegacor', 'boquilla', 'guardaescoba', 'corona'],
  'Carpintería, ventanería y vidrios': ['puerta', 'ventana', 'vidrio', 'aluminio', 'closet', 'mueble', 'carpinter', 'cerradura', 'reja'],
  'Aparatos sanitarios, cocina y accesorios': ['sanitario', 'lavamanos', 'grifer', 'ducha', 'lavaplatos', 'mesón', 'meson', 'cocina', 'calentador'],
  'Mano de obra': ['maestro', 'oficial', 'ayudante', 'mano de obra', 'jornal', 'quincena', 'obrero', 'semana'],
  'Seguridad social y ARL': ['pila', 'planilla', 'arl', 'eps', 'aportes', 'seguridad social', 'pension', 'pensión', 'parafiscal', 'mi planilla', 'aportes en linea'],
  'Alquiler de equipos y herramienta': ['alquiler', 'andamio', 'mezcladora', 'vibrador', 'herramienta', 'pulidora', 'taladro', 'equipo'],
  'Transporte, acarreos y escombros': ['transporte', 'flete', 'acarreo', 'volqueta', 'escombro', 'viaje'],
  'Servicios públicos de obra': ['epm', 'energia', 'energía', 'acueducto', 'provisional de obra', 'codensa', 'enel'],
  'Honorarios profesionales': ['honorario', 'interventor', 'ingenier', 'arquitect', 'abogad', 'contador', 'director de obra'],
  'Vigilancia': ['vigilan', 'celador', 'seguridad privada']
};
const MEDIOS = ['Transferencia', 'Efectivo', 'Nequi', 'Daviplata', 'Tarjeta', 'Cheque', 'Otro'];
const SOPORTES = ['Factura electrónica', 'Cuenta de cobro', 'Recibo generado', 'Planilla PILA', 'Comprobante de pago', 'Sin soporte'];

const S = {
  registros: [],
  cfg: { proyecto: 'Mi proyecto', conceptos: CONCEPTOS_BASE.slice(), plantillas: [], terceros: {}, consecRecibo: 0, actualizado: 0 },
  cola: [],
  form: null,
  filtro: { q: '', concepto: '', estado: '', soporte: '' }
};
const activos = () => S.registros.filter(r => !r.eliminado);

async function cargar() {
  S.registros = await DB.all('registros');
  Object.assign(S.cfg, await DB.getCfg('cfg', {}));
}
async function guardarCfg(tocar = true) {
  if (tocar) S.cfg.actualizado = Date.now();
  await DB.setCfg('cfg', S.cfg);
}

// ---------- Sugerencias ----------
function sugerirConcepto(texto, docId) {
  const ter = docId && S.cfg.terceros[docId];
  if (ter && S.cfg.conceptos.includes(ter.concepto)) return ter.concepto;
  const t = norm(texto);
  let mejor = null, pts = 0;
  for (const [c, pal] of Object.entries(PALABRAS)) {
    if (!S.cfg.conceptos.includes(c)) continue;
    const p = pal.reduce((n, w) => n + (t.split(norm(w)).length - 1), 0);
    if (p > pts) { pts = p; mejor = c; }
  }
  return mejor;
}
function matchConcepto(s) {
  const n = norm(s);
  if (!n) return null;
  return S.cfg.conceptos.find(c => norm(c) === n)
    || S.cfg.conceptos.find(c => norm(c).startsWith(n) || n.startsWith(norm(c)))
    || S.cfg.conceptos.find(c => norm(c).includes(n.split(/[ ,]/)[0]));
}
function parseClaude(t) {
  const l = String(t || '').split(/\r?\n/).map(x => x.replace(/[`*]/g, '').trim()).find(x => /^OBRA\s*\|/i.test(x));
  if (!l) return null;
  const p = l.split('|').map(x => x.trim());
  const c = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(p[1])) c.fecha = p[1];
  const v = Extractor.parseMonto(p[2]); if (v) c.valor = v;
  if (p[3]) c.tercero = p[3];
  if (p[4]) c.docId = p[4].replace(/\D/g, '');
  if (p[5]) c.factura = p[5];
  const cc = matchConcepto(p[6]); if (cc) c.concepto = cc;
  const st = SOPORTES.find(s => norm(s) === norm(p[7])); if (st) c.soporteTipo = st;
  if (p[8]) c.observaciones = p[8];
  return c;
}
function promptClaude() {
  return `Eres mi asistente para el control de pagos de una obra de construcción. Cada vez que te envíe una factura, cuenta de cobro, comprobante de transferencia, planilla o instrucción de pago (imagen, PDF o texto), responde ÚNICAMENTE con una línea en este formato exacto, sin explicaciones ni texto adicional:

OBRA|AAAA-MM-DD|VALOR|PROVEEDOR O PERSONA|NIT O CÉDULA|NÚMERO DE FACTURA|CONCEPTO|TIPO DE SOPORTE|DESCRIPCIÓN BREVE

Reglas:
- FECHA: fecha de emisión del documento (o del pago).
- VALOR: valor total a pagar, solo números enteros, sin puntos, comas ni signo $.
- PROVEEDOR O PERSONA: quien emite la factura o recibe el pago (no el cliente).
- NIT O CÉDULA: solo números, sin dígito de verificación.
- CONCEPTO: exactamente uno de esta lista: ${S.cfg.conceptos.join('; ')}.
- TIPO DE SOPORTE: uno de: ${SOPORTES.filter(s => s !== 'Recibo generado').join('; ')}.
- DESCRIPCIÓN BREVE: máximo 10 palabras (ej. "20 bultos de cemento").
- Si un dato no aparece, déjalo vacío pero conserva las barras |.`;
}

// ---------- Navegación ----------
function render() {
  const v = (location.hash.slice(1) || 'inicio').split('/')[0];
  $$('.vista').forEach(s => { s.hidden = s.id !== 'v-' + v; });
  $$('nav.bottom a').forEach(a => a.classList.toggle('activo', a.dataset.v === v));
  ({ inicio: vInicio, nuevo: vNuevo, movimientos: vMovimientos, ajustes: vAjustes }[v] || vInicio)();
  $('#tituloProyecto').textContent = S.cfg.proyecto || 'Control de Obra';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

// ---------- Inicio (tablero) ----------
function vInicio() {
  const rs = activos();
  const el = $('#v-inicio');
  if (!rs.length) {
    el.innerHTML = `<div class="vacio"><div style="font-size:48px">🏗️</div><p>Aún no hay pagos registrados.</p>
      <p class="mini">Toca <b>＋ Registrar</b>, o desde WhatsApp mantén presionada una factura → <b>Compartir</b> → <b>Control Obra</b>.</p>
      <a class="btn" href="#nuevo">Registrar el primer pago</a></div>`;
    return;
  }
  const pag = rs.filter(r => r.estado === 'Pagado'), pp = rs.filter(r => r.estado === 'Por pagar');
  const sinSop = rs.filter(r => r.soporteTipo === 'Sin soporte' && !r.archivo);
  const porC = {};
  rs.forEach(r => { const o = porC[r.concepto] || (porC[r.concepto] = { p: 0, x: 0 }); if (r.estado === 'Pagado') o.p += r.valor; else o.x += r.valor; });
  const filasC = Object.entries(porC).sort((a, b) => (b[1].p + b[1].x) - (a[1].p + a[1].x));
  const maxC = Math.max(...filasC.map(([, o]) => o.p + o.x), 1);
  const totalComp = suma(rs);

  const meses = [];
  const d = new Date(); d.setDate(1);
  for (let i = 0; i < 8; i++) { meses.unshift(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
  const porM = meses.map(m => suma(pag.filter(r => r.fecha.startsWith(m))));
  const maxM = Math.max(...porM, 1);
  const proximos = pp.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 5);

  el.innerHTML = `
    <div class="kpis">
      <div class="kpi"><small>Total pagado</small><b>${fmt(suma(pag))}</b></div>
      <div class="kpi ${pp.length ? 'warn' : ''}"><small>Por pagar (${pp.length})</small><b>${fmt(suma(pp))}</b></div>
      <div class="kpi"><small>Total comprometido</small><b>${fmt(totalComp)}</b></div>
      <div class="kpi ${sinSop.length ? 'warn' : ''}"><small>Sin soporte (${sinSop.length})</small><b>${fmt(suma(sinSop))}</b></div>
    </div>
    <div class="card"><h3>Por concepto</h3>
      ${filasC.map(([c, o]) => `<div class="barra"><div class="lbl"><span>${esc(c)}</span><span>${fmt(o.p + o.x)} · ${Math.round((o.p + o.x) * 100 / totalComp)}%</span></div>
        <div class="pista"><i style="width:${o.p * 100 / maxC}%"></i><i class="pp" style="width:${o.x * 100 / maxC}%"></i></div></div>`).join('')}
      <p class="mini"><span class="ley"></span> Pagado &nbsp; <span class="ley pp"></span> Por pagar</p>
    </div>
    <div class="card"><h3>Pagado por mes</h3>
      <div class="meses">${meses.map((m, i) => `<div class="mes" title="${fmt(porM[i])}"><span class="mv">${porM[i] ? (porM[i] / 1e6).toFixed(1) + 'M' : ''}</span><i style="height:${porM[i] * 100 / maxM}%"></i>${mesTxt(m).slice(0, 3)}</div>`).join('')}</div>
    </div>
    ${proximos.length ? `<div class="card"><h3>Pendientes por pagar</h3>${proximos.map(itemHTML).join('')}</div>` : ''}`;
  enlazarItems(el);
}

function itemHTML(r) {
  const tags = [];
  if (r.estado === 'Por pagar') tags.push('<span class="tag pp">Por pagar</span>');
  if (r.soporteTipo === 'Sin soporte' && !r.archivo) tags.push('<span class="tag ss">Sin soporte</span>');
  else if (r.archivo) tags.push(`<span class="tag">📎 ${esc(r.soporteTipo)}</span>`);
  if (!r.sync && OD.configurado()) tags.push('<span class="tag">⏳ sin sincronizar</span>');
  return `<div class="item" data-id="${r.id}">
    <div><div class="t">${esc(r.tercero || r.concepto)}</div>
      <small>${fechaCorta(r.fecha)} · ${esc(r.concepto)}${r.factura ? ' · Fact. ' + esc(r.factura) : ''}</small>${tags.join(' ')}</div>
    <div class="v">${fmt(r.valor)}${r.estado === 'Por pagar' ? `<br><button class="mini-btn" data-pagar="${r.id}">Marcar pagado</button>` : ''}</div>
  </div>`;
}
function enlazarItems(el) {
  $$('.item', el).forEach(it => it.addEventListener('click', e => {
    const b = e.target.closest('[data-pagar]');
    if (b) { e.stopPropagation(); marcarPagado(b.dataset.pagar); return; }
    location.hash = '#nuevo/' + it.dataset.id;
  }));
}
async function marcarPagado(id) {
  const r = S.registros.find(x => x.id === id);
  if (!r) return;
  r.estado = 'Pagado'; r.modificado = Date.now(); r.sync = false;
  await DB.put('registros', r);
  toast('Marcado como pagado');
  render(); sincronizar();
}

// ---------- Movimientos ----------
function vMovimientos() {
  const f = S.filtro;
  const el = $('#v-movimientos');
  el.innerHTML = `
    <h2>Pagos</h2>
    <div class="filtros">
      <input id="fq" type="search" placeholder="Buscar proveedor, factura, nota…" value="${esc(f.q)}">
      <select id="fc"><option value="">Todos los conceptos</option>${S.cfg.conceptos.map(c => `<option ${c === f.concepto ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      <select id="fe"><option value="">Todos los estados</option>${['Pagado', 'Por pagar'].map(c => `<option ${c === f.estado ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select id="fs" style="grid-column:1/-1"><option value="">Cualquier soporte</option>${SOPORTES.map(c => `<option ${c === f.soporte ? 'selected' : ''}>${c}</option>`).join('')}</select>
    </div>
    <div id="lista"></div>`;
  const upd = () => { f.q = $('#fq').value; f.concepto = $('#fc').value; f.estado = $('#fe').value; f.soporte = $('#fs').value; pintarLista(); };
  $('#fq').addEventListener('input', upd);
  ['#fc', '#fe', '#fs'].forEach(s => $(s).addEventListener('change', upd));
  pintarLista();
}
function pintarLista() {
  const f = S.filtro, q = norm(f.q);
  const rs = activos().filter(r =>
    (!f.concepto || r.concepto === f.concepto) && (!f.estado || r.estado === f.estado) && (!f.soporte || r.soporteTipo === f.soporte) &&
    (!q || norm([r.tercero, r.factura, r.observaciones, r.concepto, r.docId, r.periodo].join(' ')).includes(q))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado || 0) - (a.creado || 0));
  const el = $('#lista');
  if (!rs.length) { el.innerHTML = '<div class="vacio">No hay pagos con esos filtros.</div>'; return; }
  const grupos = {};
  rs.forEach(r => (grupos[r.fecha.slice(0, 7)] = grupos[r.fecha.slice(0, 7)] || []).push(r));
  el.innerHTML = `<p class="mini">${rs.length} pagos · ${fmt(suma(rs))}</p>` +
    Object.entries(grupos).map(([m, g]) => `<div class="grupo-mes"><span>${mesTxt(m)}</span><span>${fmt(suma(g))}</span></div>
      <div class="card lista">${g.map(itemHTML).join('')}</div>`).join('');
  enlazarItems(el);
}

// ---------- Registrar / editar ----------
function vNuevo() {
  const id = location.hash.split('/')[1];
  const r = id ? S.registros.find(x => x.id === id) : null;
  const d = r ? { ...r } : { fecha: hoy(), estado: 'Pagado', medioPago: 'Transferencia', soporteTipo: 'Sin soporte', concepto: S.cfg.conceptos[0] };
  S.form = { reg: d, editId: r ? r.id : null, archivo: null, archivoCambiado: false };
  const el = $('#v-nuevo');
  el.innerHTML = `
    <h2>${r ? 'Editar pago' : 'Registrar pago'}</h2>
    ${S.cola.length ? `<div class="aviso">Hay ${S.cola.length} archivo(s) compartido(s) en espera. Se cargarán al guardar este.</div>` : ''}
    <div class="card">
      <div class="fila-btns">
        <label class="btn sec">📷 Foto<input type="file" accept="image/*" capture="environment" hidden id="inFoto"></label>
        <label class="btn sec">📎 Archivo<input type="file" accept="image/*,application/pdf" hidden id="inArch"></label>
        <button type="button" class="btn sec" id="btnClaude">📋 Pegar de Claude</button>
      </div>
      <div id="preview"></div>
      <div id="progreso" class="progreso" hidden></div>
    </div>
    ${!r && S.cfg.plantillas.length ? `<p class="mini">Pagos frecuentes:</p><div class="chips">${S.cfg.plantillas.map((p, i) => `<button type="button" class="chip" data-pl="${i}">${esc(p.nombre)}</button>`).join('')}</div>` : ''}
    <form id="frm" class="card form" autocomplete="off">
      <div class="dos">
        <label>Fecha<input type="date" name="fecha" required></label>
        <label>Valor<input name="valor" inputmode="numeric" required placeholder="0"></label>
      </div>
      <label>Proveedor / persona<input name="tercero" list="dlTerceros"></label>
      <datalist id="dlTerceros">${Object.values(S.cfg.terceros).map(t => `<option value="${esc(t.nombre)}">`).join('')}</datalist>
      <div class="dos">
        <label>NIT / Cédula<input name="docId" inputmode="numeric"></label>
        <label>N° factura<input name="factura"></label>
      </div>
      <label>Concepto<select name="concepto" required>${S.cfg.conceptos.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      <div class="seg" id="segEstado"><button type="button" data-e="Pagado">✔ Pagado</button><button type="button" data-e="Por pagar">⏳ Por pagar</button></div>
      <div class="dos">
        <label>Medio de pago<select name="medioPago">${MEDIOS.map(m => `<option>${m}</option>`).join('')}</select></label>
        <label>Soporte<select name="soporteTipo">${SOPORTES.map(m => `<option>${m}</option>`).join('')}</select></label>
      </div>
      <label class="check" id="lblRecibo"><input type="checkbox" name="generarRecibo"> Generar recibo de pago en PDF</label>
      <label id="lblPeriodo">Período trabajado (ej. semana 10 al 15 nov)<input name="periodo"></label>
      <label>Observaciones<textarea name="observaciones" rows="2"></textarea></label>
      <input type="hidden" name="cufe">
      <div class="cufe" id="cufeInfo"></div>
      <div class="fila-btns">
        <button class="btn" type="submit" id="btnGuardar">Guardar</button>
        ${r ? '<button type="button" class="btn peligro" id="btnEliminar">Eliminar</button>' : ''}
      </div>
    </form>
    <dialog id="dlgClaude">
      <h3>Pegar respuesta de Claude</h3>
      <p class="mini">Pega la línea que empieza con <b>OBRA|</b></p>
      <textarea id="txtClaude" rows="4" class="inp"></textarea>
      <div class="fila-btns" style="margin-top:10px"><button class="btn sec" id="clCancel" type="button">Cancelar</button><button class="btn" id="clUsar" type="button">Usar datos</button></div>
    </dialog>`;

  const frm = $('#frm');
  llenarForm(d);
  frm.elements.valor.addEventListener('input', e => { const v = num(e.target.value); e.target.value = v ? miles(v) : ''; });
  $$('#segEstado button').forEach(b => b.addEventListener('click', () => setEstado(b.dataset.e)));
  frm.elements.concepto.addEventListener('change', actualizarVisibilidad);
  frm.elements.soporteTipo.addEventListener('change', actualizarVisibilidad);
  frm.elements.generarRecibo.addEventListener('change', () => {
    if (frm.elements.generarRecibo.checked) frm.elements.soporteTipo.value = 'Recibo generado';
    actualizarVisibilidad();
  });
  frm.elements.tercero.addEventListener('change', () => {
    const t = Object.values(S.cfg.terceros).find(x => x.nombre === frm.elements.tercero.value);
    if (t) {
      if (!frm.elements.docId.value && t.docId) frm.elements.docId.value = t.docId;
      if (t.concepto && S.cfg.conceptos.includes(t.concepto)) frm.elements.concepto.value = t.concepto;
      actualizarVisibilidad();
    }
  });
  $$('input,select,textarea', frm).forEach(i => i.addEventListener('input', () => i.classList.remove('auto')));
  frm.addEventListener('submit', guardar);
  ['#inFoto', '#inArch'].forEach(s => $(s).addEventListener('change', e => { const f = e.target.files[0]; if (f) setArchivo(f); e.target.value = ''; }));
  $$('[data-pl]').forEach(b => b.addEventListener('click', () => usarPlantilla(S.cfg.plantillas[b.dataset.pl])));

  const dlg = $('#dlgClaude');
  $('#btnClaude').addEventListener('click', async () => {
    $('#txtClaude').value = '';
    dlg.showModal();
    try { const t = await navigator.clipboard.readText(); if (/OBRA\s*\|/i.test(t)) $('#txtClaude').value = t; } catch { }
  });
  $('#clCancel').addEventListener('click', () => dlg.close());
  $('#clUsar').addEventListener('click', () => {
    const c = parseClaude($('#txtClaude').value);
    if (!c) { toast('No encontré una línea que empiece con OBRA|'); return; }
    dlg.close();
    const n = aplicarCampos(c);
    mostrarProgreso(`✔ Se llenaron ${n} campos con la respuesta de Claude. Revisa los resaltados.`);
  });

  if (r) {
    $('#btnEliminar').addEventListener('click', () => eliminar(r.id));
    if (r.archivo) mostrarSoporteExistente(r);
  }
  if (!r && S.cola.length) {
    const it = S.cola.shift();
    setTimeout(async () => {
      if (it.blob) await setArchivo(it.blob, it.nombre);
      if (it.texto) aplicarTexto(it.texto, !!it.blob);
    }, 50);
  }
}

function llenarForm(d) {
  const frm = $('#frm');
  for (const k of ['fecha', 'tercero', 'docId', 'factura', 'concepto', 'medioPago', 'soporteTipo', 'periodo', 'observaciones', 'cufe'])
    if (d[k] != null) frm.elements[k].value = d[k];
  frm.elements.valor.value = d.valor ? miles(d.valor) : '';
  setEstado(d.estado || 'Pagado');
  mostrarCufe(d.cufe);
  actualizarVisibilidad();
}
function setEstado(e) {
  S.form.reg.estado = e;
  $$('#segEstado button').forEach(b => b.classList.toggle('on', b.dataset.e === e));
}
function mostrarCufe(cufe) {
  $('#cufeInfo').innerHTML = cufe ? `CUFE: ${esc(cufe.slice(0, 24))}… · <a href="https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${encodeURIComponent(cufe)}" target="_blank" rel="noopener">Verificar en la DIAN</a>` : '';
}
function actualizarVisibilidad() {
  const frm = $('#frm'); if (!frm) return;
  const tieneArch = S.form.archivo || (S.form.editId && S.registros.find(x => x.id === S.form.editId)?.archivo);
  $('#lblRecibo').hidden = !!tieneArch;
  if (tieneArch) frm.elements.generarRecibo.checked = false;
  $('#lblPeriodo').hidden = !(frm.elements.concepto.value === 'Mano de obra' || frm.elements.generarRecibo.checked ||
    frm.elements.soporteTipo.value === 'Recibo generado' || frm.elements.periodo.value);
}
function mostrarProgreso(msg) { const p = $('#progreso'); if (p) { p.hidden = false; p.textContent = msg; } }

function aplicarCampos(c, { soloVacios = false } = {}) {
  const frm = $('#frm'); if (!frm) return 0;
  if (c.docId && S.cfg.terceros[c.docId]) c.tercero = S.cfg.terceros[c.docId].nombre;
  if (!c.concepto && (c.docId || c.tercero)) { const s = sugerirConcepto(c.tercero || '', c.docId); if (s) c.concepto = s; }
  let n = 0;
  for (const k of ['fecha', 'valor', 'tercero', 'docId', 'factura', 'concepto', 'medioPago', 'soporteTipo', 'periodo', 'observaciones', 'cufe']) {
    const v = c[k];
    if (v == null || v === '') continue;
    const el = frm.elements[k];
    if (soloVacios && el.value && !['fecha', 'concepto', 'medioPago', 'soporteTipo'].includes(k)) continue;
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === v)) continue;
    el.value = k === 'valor' ? miles(v) : v;
    if (el.type !== 'hidden') { el.classList.add('auto'); n++; }
  }
  if (c.estado) setEstado(c.estado);
  if (c.cufe) mostrarCufe(c.cufe);
  actualizarVisibilidad();
  return n;
}

function aplicarTexto(texto, soloVacios) {
  const c = parseClaude(texto) || Extractor.parseTexto(texto);
  if (!c.concepto) { const s = sugerirConcepto(texto, c.docId); if (s) c.concepto = s; }
  if (!soloVacios && !c.observaciones) c.observaciones = texto.replace(/\s+/g, ' ').slice(0, 200);
  const n = aplicarCampos(c, { soloVacios });
  if (!soloVacios) mostrarProgreso(n ? `✔ Se llenaron ${n} campos con el texto compartido. Revisa los resaltados.` : 'Texto recibido. Completa los datos a mano.');
}

async function setArchivo(blob, nombre) {
  if (nombre && !blob.name) { try { blob = new File([blob], nombre, { type: blob.type }); } catch { } }
  const prev = $('#preview');
  prev.innerHTML = Extractor.esPDF(blob) ? `<div class="pdf-prev">📄 ${esc(blob.name || 'documento.pdf')}</div>`
    : `<img src="${URL.createObjectURL(blob)}" alt="Soporte">`;
  S.form.archivo = await Extractor.comprimirImagen(blob);
  S.form.archivoCambiado = true;
  actualizarVisibilidad();
  mostrarProgreso('Analizando soporte…');
  const form = S.form;
  try {
    const res = await Extractor.procesar(blob, mostrarProgreso);
    if (S.form !== form) return;
    const c = res.campos;
    if (!c.concepto) { const s = sugerirConcepto(res.texto + ' ' + (c.tercero || ''), c.docId); if (s) c.concepto = s; }
    if (!c.soporteTipo) c.soporteTipo = c.factura ? 'Factura electrónica' : 'Comprobante de pago';
    const n = aplicarCampos(c);
    mostrarProgreso(n > 1 ? `✔ Se llenaron ${n} campos automáticamente (${res.fuente.join(' + ')}). Revisa los resaltados.`
      : 'No pude leer bien el documento. Llena los datos a mano o usa "Pegar de Claude".');
  } catch (e) {
    console.error(e);
    mostrarProgreso('No se pudo leer automáticamente: ' + e.message);
  }
}

async function mostrarSoporteExistente(r) {
  const prev = $('#preview');
  const loc = await DB.get('archivos', r.id);
  const pintar = blob => {
    const url = URL.createObjectURL(blob);
    prev.innerHTML = blob.type.startsWith('image/') ? `<img src="${url}" alt="Soporte">`
      : `<div class="pdf-prev">📄 <a href="${url}" download="${esc(r.archivo.split('/').pop())}">Abrir soporte PDF</a></div>`;
  };
  if (loc) { pintar(loc.blob); return; }
  prev.innerHTML = `<div class="pdf-prev">📎 Soporte guardado en OneDrive <button type="button" class="mini-btn" id="btnBajar">Ver</button></div>`;
  $('#btnBajar').addEventListener('click', async () => {
    try { pintar(await OD.bajarBlob(r.archivo)); } catch (e) { toast('No disponible: ' + e.message); }
  });
}

function usarPlantilla(p) {
  if (!p) return;
  aplicarCampos({ tercero: p.tercero, docId: p.docId, valor: p.valor, concepto: p.concepto, medioPago: p.medioPago, soporteTipo: p.soporteTipo, fecha: hoy() });
  const frm = $('#frm');
  frm.elements.generarRecibo.checked = !!p.generarRecibo && !S.form.archivo;
  if (frm.elements.generarRecibo.checked) frm.elements.soporteTipo.value = 'Recibo generado';
  actualizarVisibilidad();
  frm.elements.periodo.focus();
}

async function guardar(e) {
  e.preventDefault();
  const frm = $('#frm'), f = frm.elements;
  const valor = num(f.valor.value);
  if (!valor) { toast('Ingresa el valor'); f.valor.focus(); return; }
  const btn = $('#btnGuardar'); btn.disabled = true;
  try {
    const ahora = Date.now();
    const id = S.form.editId || uid();
    const prev = S.registros.find(x => x.id === id) || {};
    const reg = {
      ...prev, id,
      fecha: f.fecha.value || hoy(), valor,
      tercero: f.tercero.value.trim(), docId: f.docId.value.replace(/\D/g, ''), factura: f.factura.value.trim(),
      concepto: f.concepto.value, estado: S.form.reg.estado, medioPago: f.medioPago.value, soporteTipo: f.soporteTipo.value,
      periodo: f.periodo.value.trim(), observaciones: f.observaciones.value.trim(), cufe: f.cufe.value,
      creado: prev.creado || ahora, modificado: ahora, sync: false
    };
    if (!prev.id) {
      const dup = activos().find(x => (reg.cufe && x.cufe === reg.cufe) || (reg.factura && reg.docId && x.factura === reg.factura && x.docId === reg.docId));
      if (dup && !confirm(`Parece duplicado: ya existe la factura ${dup.factura || ''} de ${dup.tercero || ''} por ${fmt(dup.valor)} (${dup.fecha}). ¿Guardar de todas formas?`)) return;
    }
    if (f.generarRecibo.checked && !S.form.archivo && !prev.archivo) {
      S.cfg.consecRecibo = (S.cfg.consecRecibo || 0) + 1;
      reg.reciboNo = 'RC-' + String(S.cfg.consecRecibo).padStart(4, '0');
      reg.soporteTipo = 'Recibo generado';
      S.form.archivo = await Recibo.generar({ ...reg, numero: reg.reciboNo, proyecto: S.cfg.proyecto });
      S.form.archivoCambiado = true;
    }
    if (S.form.archivoCambiado && S.form.archivo) {
      const a = S.form.archivo;
      const ext = Extractor.esPDF(a) ? 'pdf' : (a.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      reg.archivo = `Soportes/${reg.fecha.slice(0, 7)}/${reg.fecha}_${slug(reg.concepto)}_${slug(reg.tercero || 'sin-nombre')}_${id}.${ext}`;
      reg.archivoSubido = false;
      await DB.put('archivos', { id, blob: a, tipo: a.type || 'application/octet-stream' });
    }
    if (reg.tercero) S.cfg.terceros[reg.docId || norm(reg.tercero)] = { nombre: reg.tercero, docId: reg.docId, concepto: reg.concepto };
    await DB.put('registros', reg);
    const i = S.registros.findIndex(x => x.id === id);
    if (i >= 0) S.registros[i] = reg; else S.registros.push(reg);
    await guardarCfg();
    toast(reg.reciboNo && !prev.reciboNo ? `Pago guardado con recibo ${reg.reciboNo}` : 'Pago guardado ✔');
    sincronizar();
    if (S.cola.length) { if (location.hash === '#nuevo') render(); else location.hash = '#nuevo'; }
    else location.hash = '#movimientos';
  } catch (err) {
    console.error(err); toast('Error al guardar: ' + err.message);
  } finally { btn.disabled = false; }
}

async function eliminar(id) {
  const r = S.registros.find(x => x.id === id);
  if (!r || !confirm(`¿Eliminar el pago de ${fmt(r.valor)} a ${r.tercero || r.concepto}?`)) return;
  r.eliminado = true; r.modificado = Date.now(); r.sync = false;
  await DB.put('registros', r);
  toast('Pago eliminado');
  location.hash = '#movimientos';
  sincronizar();
}

// ---------- Ajustes ----------
async function vAjustes() {
  const el = $('#v-ajustes');
  const con = await OD.conectado();
  const ult = await DB.getCfg('ultimaSync');
  el.innerHTML = `
    <h2>Ajustes</h2>
    <div class="card form"><label>Nombre del proyecto<input id="aProy" value="${esc(S.cfg.proyecto)}"></label></div>

    <div class="card"><h3>OneDrive</h3>
      <p class="mini">${!OD.configurado() ? '⚠️ Falta configurar la conexión (ver LEEME.md, paso 2). Mientras tanto, todo se guarda en este celular.'
        : con ? '✔ Conectado' + (ult ? ' · última sincronización: ' + new Date(ult).toLocaleString('es-CO') : '') : 'No conectado'}</p>
      <div class="fila-btns">
        ${con ? '<button class="btn sec" id="odSync">⟳ Sincronizar ahora</button><button class="btn sec" id="odOut">Desconectar</button>'
        : `<button class="btn" id="odIn" ${OD.configurado() ? '' : 'disabled'}>Conectar OneDrive</button>`}
      </div>
      <p class="mini">Ubicación: OneDrive › ${esc(APP_CONFIG.CARPETA_ONEDRIVE.replace(/\//g, ' › '))} (Control_Obra.xlsx, datos.json y carpeta Soportes).
      El Excel se regenera en cada sincronización: haz los cambios en la app, no en el Excel.</p>
    </div>

    <div class="card"><h3>Exportar y copias</h3>
      <div class="fila-btns">
        <button class="btn sec" id="xExcel">⬇ Descargar Excel</button>
        <button class="btn sec" id="xJson">⬇ Copia de seguridad</button>
        <label class="btn sec">⬆ Restaurar<input type="file" accept="application/json,.json" hidden id="xRest"></label>
      </div>
    </div>

    <div class="card form"><h3>Conceptos</h3>
      <p class="mini">Uno por línea. Cambiar el nombre de un concepto no modifica los pagos ya registrados.</p>
      <textarea id="aConc" rows="10"></textarea>
      <div class="fila-btns" style="margin-top:8px"><button class="btn" id="aConcG">Guardar conceptos</button></div>
    </div>

    <div class="card"><h3>Pagos frecuentes</h3>
      <p class="mini">Ej.: "Pago semanal maestro". Aparecen como botones al registrar.</p>
      <div id="plList">${S.cfg.plantillas.map((p, i) => `<div class="item"><div><div class="t">${esc(p.nombre)}</div><small>${esc(p.tercero || '')} · ${esc(p.concepto)} · ${fmt(p.valor)}</small></div>
        <div class="v"><button class="mini-btn" data-del="${i}">Quitar</button></div></div>`).join('') || '<p class="mini">Aún no hay.</p>'}</div>
      <details><summary>➕ Agregar pago frecuente</summary>
        <form id="plForm" class="form" style="margin-top:10px">
          <label>Nombre del botón<input name="nombre" required placeholder="Pago semanal maestro"></label>
          <div class="dos"><label>Persona<input name="tercero"></label><label>Cédula<input name="docId" inputmode="numeric"></label></div>
          <div class="dos"><label>Valor<input name="valor" inputmode="numeric"></label>
            <label>Medio<select name="medioPago">${MEDIOS.map(m => `<option>${m}</option>`).join('')}</select></label></div>
          <label>Concepto<select name="concepto">${S.cfg.conceptos.map(c => `<option ${c === 'Mano de obra' ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label>Soporte<select name="soporteTipo">${SOPORTES.map(m => `<option ${m === 'Sin soporte' ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
          <label class="check"><input type="checkbox" name="generarRecibo" checked> Generar recibo PDF al registrar</label>
          <button class="btn" type="submit">Agregar</button>
        </form>
      </details>
    </div>

    <div class="card"><h3>Usar con Claude (opcional, sin costo extra)</h3>
      <p class="mini">1) En la app de Claude crea un <b>Proyecto</b> llamado "Control de obra" y pega estas instrucciones.
      2) Desde WhatsApp comparte la factura a Claude dentro de ese proyecto.
      3) Copia la respuesta (empieza con <b>OBRA|</b>) y aquí toca <b>📋 Pegar de Claude</b>, o compártela directo a Control Obra.</p>
      <pre class="prompt" id="prompt"></pre>
      <button class="btn sec" id="cpPrompt">Copiar instrucciones</button>
    </div>
    <p class="mini" style="text-align:center">Control de Obra · versión 1.0</p>`;

  $('#aConc').value = S.cfg.conceptos.join('\n');
  $('#prompt').textContent = promptClaude();
  $('#aProy').addEventListener('change', async e => { S.cfg.proyecto = e.target.value.trim() || 'Mi proyecto'; await guardarCfg(); $('#tituloProyecto').textContent = S.cfg.proyecto; toast('Nombre guardado'); });
  $('#aConcG').addEventListener('click', async () => {
    const l = [...new Set($('#aConc').value.split('\n').map(x => x.trim()).filter(Boolean))];
    if (!l.length) { toast('Debe haber al menos un concepto'); return; }
    S.cfg.conceptos = l; await guardarCfg(); toast('Conceptos guardados'); vAjustes(); sincronizar();
  });
  $('#cpPrompt').addEventListener('click', async () => { try { await navigator.clipboard.writeText(promptClaude()); toast('Instrucciones copiadas'); } catch { toast('No se pudo copiar; selecciónalas a mano'); } });
  $('#xExcel').addEventListener('click', async () => { try { descargar(await Exportar.excel(), 'Control_Obra.xlsx'); } catch (e) { toast(e.message); } });
  $('#xJson').addEventListener('click', () => descargar(new Blob([JSON.stringify(paquete(), null, 1)], { type: 'application/json' }), `control-obra-copia-${hoy()}.json`));
  $('#xRest').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      if (!Array.isArray(j.registros)) throw new Error('El archivo no es una copia válida');
      if (!confirm(`La copia tiene ${j.registros.length} registros. Se combinarán con los actuales. ¿Continuar?`)) return;
      await fusionar(j, true); toast('Copia restaurada'); render(); sincronizar();
    } catch (err) { toast('Error: ' + err.message); }
  });
  const odIn = $('#odIn'); if (odIn) odIn.addEventListener('click', () => OD.login().catch(e => toast(e.message)));
  const odSync = $('#odSync'); if (odSync) odSync.addEventListener('click', () => sincronizar(true).then(vAjustes));
  const odOut = $('#odOut'); if (odOut) odOut.addEventListener('click', async () => { await OD.cerrar(); toast('OneDrive desconectado'); vAjustes(); actualizarEstado(); });
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => { S.cfg.plantillas.splice(+b.dataset.del, 1); await guardarCfg(); vAjustes(); }));
  const pf = $('#plForm');
  pf.elements.valor.addEventListener('input', e => { const v = num(e.target.value); e.target.value = v ? miles(v) : ''; });
  pf.addEventListener('submit', async e => {
    e.preventDefault();
    const x = pf.elements;
    S.cfg.plantillas.push({ nombre: x.nombre.value.trim(), tercero: x.tercero.value.trim(), docId: x.docId.value.replace(/\D/g, ''),
      valor: num(x.valor.value), medioPago: x.medioPago.value, concepto: x.concepto.value, soporteTipo: x.soporteTipo.value, generarRecibo: x.generarRecibo.checked });
    await guardarCfg(); toast('Pago frecuente agregado'); vAjustes();
  });
}

function descargar(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Excel ----------
const Exportar = {
  async excel() {
    await cargarLib('xlsx');
    const rs = activos().slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
    const aFecha = f => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d, 12); };
    const H = ['Fecha', 'Concepto', 'Proveedor / persona', 'NIT / CC', 'N° factura', 'Valor', 'Estado', 'Medio de pago',
      'Tipo de soporte', 'Período', 'Observaciones', 'Recibo N°', 'CUFE', 'Archivo soporte'];
    const filas = rs.map(r => [aFecha(r.fecha), r.concepto, r.tercero, r.docId, r.factura, r.valor, r.estado, r.medioPago,
      r.soporteTipo, r.periodo, r.observaciones, r.reciboNo || '', r.cufe || '', r.archivo || '']);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([H, ...filas], { cellDates: true });
    for (let i = 1; i <= filas.length; i++) {
      const cf = ws[XLSX.utils.encode_cell({ r: i, c: 0 })]; if (cf) cf.z = 'dd/mm/yyyy';
      const cv = ws[XLSX.utils.encode_cell({ r: i, c: 5 })]; if (cv) cv.z = '#,##0';
    }
    ws['!cols'] = [11, 30, 28, 13, 13, 14, 10, 14, 18, 20, 34, 10, 20, 50].map(w => ({ wch: w }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(filas.length, 1), c: H.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');

    const total = suma(rs);
    const conceptos = [...new Set([...S.cfg.conceptos, ...rs.map(r => r.concepto)])];
    const res = [['Concepto', 'Pagado', 'Por pagar', 'Total', '% del total', 'N° pagos', 'Sin soporte']];
    conceptos.forEach(c => {
      const g = rs.filter(r => r.concepto === c); if (!g.length) return;
      const t = suma(g);
      res.push([c, suma(g.filter(r => r.estado === 'Pagado')), suma(g.filter(r => r.estado === 'Por pagar')), t, total ? t / total : 0, g.length,
        suma(g.filter(r => r.soporteTipo === 'Sin soporte' && !r.archivo))]);
    });
    res.push(['TOTAL', suma(rs.filter(r => r.estado === 'Pagado')), suma(rs.filter(r => r.estado === 'Por pagar')), total, total ? 1 : 0, rs.length,
      suma(rs.filter(r => r.soporteTipo === 'Sin soporte' && !r.archivo))]);
    const ws2 = XLSX.utils.aoa_to_sheet(res);
    for (let i = 1; i < res.length; i++) {
      [1, 2, 3, 6].forEach(c => { const x = ws2[XLSX.utils.encode_cell({ r: i, c })]; if (x) x.z = '#,##0'; });
      const p = ws2[XLSX.utils.encode_cell({ r: i, c: 4 })]; if (p) p.z = '0.0%';
    }
    ws2['!cols'] = [38, 15, 15, 15, 11, 9, 14].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws2, 'Resumen por concepto');

    const meses = [...new Set(rs.map(r => r.fecha.slice(0, 7)))].sort();
    const rm = [['Mes', 'Pagado', 'Por pagar', 'Total', 'Acumulado']];
    let acum = 0;
    meses.forEach(m => {
      const g = rs.filter(r => r.fecha.startsWith(m)); const t = suma(g); acum += t;
      rm.push([m, suma(g.filter(r => r.estado === 'Pagado')), suma(g.filter(r => r.estado === 'Por pagar')), t, acum]);
    });
    const ws3 = XLSX.utils.aoa_to_sheet(rm);
    for (let i = 1; i < rm.length; i++) [1, 2, 3, 4].forEach(c => { const x = ws3[XLSX.utils.encode_cell({ r: i, c })]; if (x) x.z = '#,##0'; });
    ws3['!cols'] = [10, 15, 15, 15, 16].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws3, 'Por mes');

    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
};

// ---------- Sincronización con OneDrive ----------
const paquete = () => ({ app: 'ControlObra', version: 1, exportado: new Date().toISOString(), cfg: S.cfg, registros: S.registros });

async function fusionar(rem, desdeCopia = false) {
  if (!rem || !Array.isArray(rem.registros)) return;
  const mapa = new Map(S.registros.map(r => [r.id, r]));
  for (const r of rem.registros) {
    const l = mapa.get(r.id);
    if (!l || (r.modificado || 0) > (l.modificado || 0)) {
      const nuevo = { ...r, sync: !desdeCopia };
      if (l && l.archivo === r.archivo) nuevo.archivoSubido = l.archivoSubido || r.archivoSubido;
      mapa.set(r.id, nuevo);
      await DB.put('registros', nuevo);
    }
  }
  S.registros = [...mapa.values()];
  if (rem.cfg) {
    const ter = { ...(rem.cfg.terceros || {}), ...S.cfg.terceros };
    const consec = Math.max(rem.cfg.consecRecibo || 0, S.cfg.consecRecibo || 0);
    if ((rem.cfg.actualizado || 0) > (S.cfg.actualizado || 0)) Object.assign(S.cfg, rem.cfg);
    S.cfg.terceros = ter; S.cfg.consecRecibo = consec;
    await guardarCfg(false);
  }
}

let sincronizando = false;
async function sincronizar(manual = false) {
  if (sincronizando) return;
  if (!OD.configurado() || !(await OD.conectado())) { if (manual) toast('Primero conecta OneDrive en Ajustes'); actualizarEstado(); return; }
  if (!navigator.onLine) { actualizarEstado('Sin internet · se sincronizará después'); return; }
  sincronizando = true;
  let pendientes = [];
  actualizarEstado('Sincronizando…');
  $('#btnSync').classList.add('girando');
  try {
    for (const r of S.registros.filter(r => r.archivo && !r.archivoSubido && !r.eliminado)) {
      const a = await DB.get('archivos', r.id);
      if (a) await OD.subir(r.archivo, a.blob, a.tipo);
      r.archivoSubido = true;
      await DB.put('registros', r);
    }
    const txt = await OD.bajarTexto('datos.json');
    if (txt) { try { await fusionar(JSON.parse(txt)); } catch (e) { console.warn('datos.json remoto inválido', e); } }
    pendientes = S.registros.filter(r => !r.sync);
    S.registros.forEach(r => { r.sync = true; });
    await OD.subir('datos.json', new Blob([JSON.stringify(paquete())], { type: 'application/json' }), 'application/json');
    try {
      await OD.subir('Control_Obra.xlsx', await Exportar.excel());
    } catch (e) {
      if (/423|locked/i.test(e.message)) toast('El Excel está abierto en otro lado; se actualizará en la próxima sincronización');
      else throw e;
    }
    for (const r of S.registros) await DB.put('registros', r);
    await DB.setCfg('ultimaSync', Date.now());
    if (manual) toast('Sincronizado con OneDrive ✔');
    const v = (location.hash.slice(1) || 'inicio').split('/')[0];
    if (v === 'inicio' || v === 'movimientos') render();
  } catch (e) {
    console.error(e);
    pendientes.forEach(r => { r.sync = false; });
    if (e.message === 'NO_SESION') { toast('La sesión de OneDrive venció. Vuelve a conectar en Ajustes.'); }
    else if (manual) toast('Error al sincronizar: ' + e.message);
  } finally {
    sincronizando = false;
    $('#btnSync').classList.remove('girando');
    actualizarEstado();
  }
}

async function actualizarEstado(msg) {
  const el = $('#estadoSync');
  if (msg) { el.textContent = msg; return; }
  const pend = S.registros.filter(r => !r.sync).length;
  if (!OD.configurado()) { el.textContent = 'Guardado en este celular'; return; }
  if (!(await OD.conectado())) { el.textContent = 'OneDrive sin conectar' + (pend ? ` · ${pend} pendientes` : ''); return; }
  const ult = await DB.getCfg('ultimaSync');
  el.textContent = pend ? `${pend} cambio(s) por sincronizar` : 'OneDrive ✔' + (ult ? ' · ' + new Date(ult).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '');
}

// ---------- Archivos compartidos desde WhatsApp ----------
async function cargarCompartidos() {
  const items = await DB.all('compartidos');
  for (const it of items.sort((a, b) => a.id.localeCompare(b.id))) {
    if (it.archivos && it.archivos.length) it.archivos.forEach((a, i) => S.cola.push({ blob: a.blob, nombre: a.nombre, texto: i === 0 ? it.texto : '' }));
    else if (it.texto) S.cola.push({ texto: it.texto });
  }
  await DB.clear('compartidos');
}

// ---------- Inicio de la app ----------
(async () => {
  try { if (await OD.manejarRetorno()) toast('OneDrive conectado ✔'); }
  catch (e) { toast('OneDrive: ' + e.message); }
  await cargar();
  if (new URLSearchParams(location.search).has('compartido')) {
    history.replaceState(null, '', location.pathname + '#nuevo');
    await cargarCompartidos();
  }
  render();
  actualizarEstado();
  $('#btnSync').addEventListener('click', () => sincronizar(true));
  window.addEventListener('online', () => sincronizar());
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    const antes = S.cola.length;
    await cargarCompartidos();
    if (S.cola.length > antes && !location.hash.startsWith('#nuevo/')) { if (location.hash === '#nuevo') render(); else location.hash = '#nuevo'; }
  });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW', e));
  sincronizar();
})();
