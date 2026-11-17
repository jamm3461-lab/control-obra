// Compromisos: deudas y contratos con cuotas (ej. compra del lote, contrato del maestro).
// Los pagos registrados como "abono" a un compromiso descuentan el saldo.
// La primera parte (Comp y revisarVencimientos) también corre en el service worker.

const Comp = (() => {
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

  function estado(c, registros, hoy = hoyISO()) {
    const abonos = registros.filter(r => !r.eliminado && r.compromisoId === c.id && r.estado === 'Pagado')
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pagado = abonos.reduce((n, r) => n + (r.valor || 0), 0);
    let resto = pagado;
    const cuotas = (c.cuotas || []).filter(q => q.valor > 0).slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(q => {
      const cubierto = Math.min(q.valor, Math.max(resto, 0));
      resto -= cubierto;
      const pendiente = q.valor - cubierto;
      const est = pendiente <= 0 ? 'Pagada' : q.fecha < hoy ? 'Vencida' : cubierto > 0 ? 'Parcial' : 'Pendiente';
      return { ...q, cubierto, pendiente, estado: est, dias: dias(hoy, q.fecha) };
    });
    const programado = cuotas.reduce((n, q) => n + q.valor, 0);
    const saldo = Math.max((c.total || 0) - pagado, 0);
    return {
      abonos, pagado, saldo, cuotas,
      proxima: cuotas.find(q => q.pendiente > 0) || null,
      sinProgramar: (c.total || 0) - programado,
      pct: c.total ? Math.min(100, pagado * 100 / c.total) : 0,
      cerrado: saldo <= 0
    };
  }

  // Cuotas con saldo pendiente que vencen dentro de `dentroDe` días (o ya vencidas)
  function alertas(comps, registros, dentroDe = 30) {
    const out = [];
    comps.filter(c => !c.eliminado).forEach(c => {
      estado(c, registros).cuotas.forEach(q => { if (q.pendiente > 0 && q.dias <= dentroDe) out.push({ c, q }); });
    });
    return out.sort((a, b) => a.q.fecha.localeCompare(b.q.fecha));
  }

  return { estado, alertas, hoyISO };
})();

// Muestra notificaciones de vencimientos (máximo una por cuota al día). Funciona en la página y en el service worker.
async function revisarVencimientos(reg) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return 0;
  const comps = (await DB.getCfg('compromisos', [])).filter(c => !c.eliminado);
  const registros = await DB.all('registros');
  const avisados = await DB.getCfg('avisados', {});
  const hoy = Comp.hoyISO();
  const m = v => '$ ' + Number(v || 0).toLocaleString('es-CO');
  let n = 0;
  for (const { c, q } of Comp.alertas(comps, registros, 3)) {
    const k = c.id + '|' + q.id;
    if (avisados[k] === hoy) continue;
    const titulo = q.dias < 0 ? `⚠️ Vencido: ${c.nombre}` : q.dias === 0 ? `⏰ Vence hoy: ${c.nombre}` : `📅 Vence en ${q.dias} día(s): ${c.nombre}`;
    await reg.showNotification(titulo, {
      body: `Pendiente ${m(q.pendiente)} · fecha ${q.fecha.split('-').reverse().join('/')}${c.tercero ? ' · ' + c.tercero : ''}`,
      tag: k, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './#compromisos/' + c.id }
    });
    avisados[k] = hoy; n++;
  }
  await DB.setCfg('avisados', avisados);
  return n;
}

// ======================= Interfaz (solo en la página) =======================
const compsActivos = () => S.comp.filter(c => !c.eliminado);
async function guardarComps() { await DB.setCfg('compromisos', S.comp); }

function vCompromisos() {
  const p = location.hash.slice(1).split('/');
  const el = $('#v-compromisos');
  if (p[1] === 'nuevo') return formCompromiso(el, null);
  if (p[1]) {
    const c = S.comp.find(x => x.id === p[1] && !x.eliminado);
    if (!c) { location.hash = '#compromisos'; return; }
    return p[2] === 'editar' ? formCompromiso(el, c) : detalleCompromiso(el, c);
  }
  listaCompromisos(el);
}

function textoVence(q) {
  return q.dias < 0 ? `Vencida hace ${-q.dias} día(s)` : q.dias === 0 ? 'Vence hoy' : `Vence en ${q.dias} día(s)`;
}

function tarjetaComp(c, e) {
  const q = e.proxima;
  const venc = q ? `<div class="venc ${q.dias < 0 ? 'rojo' : q.dias <= 7 ? 'amarillo' : ''}">${textoVence(q)} · ${fechaCorta(q.fecha)} · ${fmt(q.pendiente)}</div>`
    : e.cerrado ? '<div class="venc ok">✔ Pagado completo</div>'
    : e.sinProgramar > 0 ? '<div class="venc">Saldo sin fecha programada</div>' : '';
  return `<div class="card comp" data-comp="${c.id}">
    <div class="comp-top"><div><div class="t">${esc(c.nombre)}</div><small class="mini">${esc(c.tercero || '')}${c.tercero ? ' · ' : ''}${esc(c.concepto)}</small></div>
      <div class="v">${fmt(e.saldo)}<small class="mini">saldo</small></div></div>
    <div class="pista"><i style="width:${e.pct}%"></i></div>
    <div class="mini">Pagado ${fmt(e.pagado)} de ${fmt(c.total)} (${Math.round(e.pct)}%)</div>${venc}</div>`;
}

function notifBanner() {
  if (!('Notification' in window)) return '';
  if (Notification.permission === 'granted') return '';
  if (Notification.permission === 'denied') return '<p class="mini">🔕 Las notificaciones están bloqueadas. Actívalas en Android: Ajustes › Apps › Control Obra › Notificaciones.</p>';
  return `<div class="aviso">🔔 Activa los recordatorios para que te avise antes de cada vencimiento.
    <button class="btn" data-notif style="width:100%;margin-top:8px">Activar recordatorios</button></div>`;
}
function enlazarComp(el) {
  $$('[data-comp]', el).forEach(x => x.addEventListener('click', () => { location.hash = '#compromisos/' + x.dataset.comp; }));
  $$('[data-notif]', el).forEach(b => b.addEventListener('click', activarAvisos));
}

function listaCompromisos(el) {
  const cs = compsActivos().map(c => ({ c, e: Comp.estado(c, S.registros) }))
    .sort((a, b) => (a.e.cerrado - b.e.cerrado) || (a.e.proxima?.fecha || '9').localeCompare(b.e.proxima?.fecha || '9'));
  const saldo = cs.reduce((n, x) => n + x.e.saldo, 0);
  el.innerHTML = `
    <h2>Compromisos</h2>
    <p class="mini">Deudas y contratos que pagas por partes: compra del lote, contrato del maestro, créditos…</p>
    ${cs.length ? notifBanner() : ''}
    <a class="btn" href="#compromisos/nuevo" style="width:100%;margin-bottom:12px">＋ Nuevo compromiso</a>
    ${cs.length ? `<div class="kpis"><div class="kpi warn"><small>Saldo total por pagar</small><b>${fmt(saldo)}</b></div>
      <div class="kpi"><small>Abiertos</small><b>${cs.filter(x => !x.e.cerrado).length}</b></div></div>` : ''}
    ${cs.map(({ c, e }) => tarjetaComp(c, e)).join('') ||
      '<div class="vacio">Aún no hay compromisos.<br><span class="mini">Ej.: "Compra del lote", total $120.000.000, abono de $5.000.000 y saldo de $115.000.000 en diciembre.</span></div>'}`;
  enlazarComp(el);
}

function detalleCompromiso(el, c) {
  const e = Comp.estado(c, S.registros);
  const tagQ = { Pagada: 'ok', Parcial: 'pp', Pendiente: '', Vencida: 'ss' };
  el.innerHTML = `
    <p><a href="#compromisos">← Compromisos</a></p>
    ${tarjetaComp(c, e)}
    <div class="fila-btns" style="margin-bottom:12px">
      ${e.saldo > 0 ? '<button class="btn" id="cAbono">＋ Registrar abono</button>' : ''}
      <a class="btn sec" href="#compromisos/${c.id}/editar">✏️ Editar</a>
    </div>
    ${notifBanner()}
    <div class="card"><h3>Cuotas programadas</h3>
      ${e.cuotas.map(q => `<div class="item quieto"><div><div class="t">${fechaCorta(q.fecha)} ${q.fecha.slice(0, 4)}</div>
        <span class="tag ${tagQ[q.estado]}">${q.estado}</span>${q.pendiente > 0 && q.estado !== 'Pagada' ? ` <small class="mini">${textoVence(q)}</small>` : ''}</div>
        <div class="v">${fmt(q.valor)}${q.cubierto > 0 && q.pendiente > 0 ? `<br><small class="mini">falta ${fmt(q.pendiente)}</small>` : ''}</div></div>`).join('') || '<p class="mini">Sin cuotas.</p>'}
      ${e.sinProgramar > 0 ? `<div class="aviso">Hay ${fmt(e.sinProgramar)} del total sin fecha programada. Toca Editar para agregar la cuota.</div>` : ''}
    </div>
    <div class="card lista"><h3 style="padding-top:14px">Abonos realizados (${e.abonos.length})</h3>
      ${e.abonos.length ? e.abonos.slice().reverse().map(itemHTML).join('') : '<p class="mini" style="padding-bottom:14px">Aún no hay abonos.</p>'}</div>
    ${c.observaciones ? `<div class="card"><h3>Notas</h3><p class="mini">${esc(c.observaciones)}</p></div>` : ''}`;
  enlazarItems(el);
  $$('[data-notif]', el).forEach(b => b.addEventListener('click', activarAvisos));
  const b = $('#cAbono');
  if (b) b.addEventListener('click', () => {
    S.prefill = { compromisoId: c.id, tercero: c.tercero, docId: c.docId, concepto: c.concepto, estado: 'Pagado',
      valor: e.proxima ? e.proxima.pendiente : e.saldo, observaciones: 'Abono a ' + c.nombre };
    location.hash = '#nuevo';
  });
}

function formCompromiso(el, c) {
  const d = c ? JSON.parse(JSON.stringify(c))
    : { nombre: '', tercero: '', docId: '', concepto: S.cfg.conceptos[0], total: 0, cuotas: [{ id: uid(), fecha: hoy(), valor: 0 }], observaciones: '' };
  el.innerHTML = `
    <p><a href="${c ? '#compromisos/' + c.id : '#compromisos'}">← Volver</a></p>
    <h2>${c ? 'Editar' : 'Nuevo'} compromiso</h2>
    <form id="frmC" class="card form" autocomplete="off">
      <label>Nombre<input name="nombre" required placeholder="Ej.: Compra del lote" value="${esc(d.nombre)}"></label>
      <div class="dos">
        <label>Proveedor / persona<input name="tercero" list="dlT2" value="${esc(d.tercero)}"></label>
        <label>NIT / Cédula<input name="docId" inputmode="numeric" value="${esc(d.docId)}"></label>
      </div>
      <datalist id="dlT2">${Object.values(S.cfg.terceros).map(t => `<option value="${esc(t.nombre)}">`).join('')}</datalist>
      <label>Concepto<select name="concepto">${S.cfg.conceptos.map(x => `<option ${x === d.concepto ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Valor total pactado<input name="total" inputmode="numeric" required placeholder="0" value="${d.total ? miles(d.total) : ''}"></label>
      ${!c ? `<label class="check"><input type="checkbox" name="abonoIni"> Ya hice un abono (se registra como pago)</label>
        <div id="abonoBox" class="dos" hidden>
          <label>Valor abonado<input name="abonoValor" inputmode="numeric" placeholder="0"></label>
          <label>Fecha del abono<input type="date" name="abonoFecha" value="${hoy()}"></label>
        </div>` : ''}
      <h3 style="margin-top:6px">Fechas de pago (cuotas)</h3>
      <p class="mini">Deben sumar el total. Incluye lo que ya abonaste: ej. abono $5.000.000 (hoy) + saldo $115.000.000 (diciembre).</p>
      <div id="cuotas"></div>
      <div class="fila-btns"><button type="button" class="btn sec" id="addQ">＋ Agregar cuota</button></div>
      <p class="mini" id="cuadre"></p>
      <label>Notas<textarea name="observaciones" rows="2">${esc(d.observaciones || '')}</textarea></label>
      <div class="fila-btns">
        <button class="btn" type="submit">Guardar</button>
        ${c ? '<button type="button" class="btn peligro" id="delC">Eliminar</button>' : ''}
      </div>
    </form>`;

  const frm = $('#frmC'), f = frm.elements;
  const fmtInput = i => i.addEventListener('input', () => { const v = num(i.value); i.value = v ? miles(v) : ''; });
  fmtInput(f.total);
  const suma = () => d.cuotas.reduce((n, q) => n + (q.valor || 0), 0);
  const cuadre = () => {
    const t = num(f.total.value), s = suma(), dif = t - s;
    $('#cuadre').innerHTML = !t ? '' : dif === 0 ? '✔ Las cuotas suman el total.'
      : dif > 0 ? `Faltan <b>${fmt(dif)}</b> por programar. <button type="button" class="mini-btn" id="fillQ">Agregar cuota con el faltante</button>`
      : `⚠️ Las cuotas superan el total en <b>${fmt(-dif)}</b>.`;
    const fb = $('#fillQ');
    if (fb) fb.onclick = () => { const ult = d.cuotas[d.cuotas.length - 1]; d.cuotas.push({ id: uid(), fecha: sumarMes(ult ? ult.fecha : hoy()), valor: dif }); pintar(); };
  };
  const pintar = () => {
    $('#cuotas').innerHTML = d.cuotas.map((q, i) => `<div class="cuota-fila">
      <input type="date" data-i="${i}" data-k="fecha" value="${q.fecha}" ${q.abonoIni ? 'disabled' : ''}>
      <input inputmode="numeric" data-i="${i}" data-k="valor" value="${q.valor ? miles(q.valor) : ''}" placeholder="Valor" ${q.abonoIni ? 'disabled' : ''}>
      ${q.abonoIni ? '<span class="tag ok">abono</span>' : `<button type="button" class="mini-btn" data-rm="${i}" aria-label="Quitar">✕</button>`}</div>`).join('');
    $$('#cuotas input').forEach(inp => inp.addEventListener('input', () => {
      const q = d.cuotas[inp.dataset.i];
      if (inp.dataset.k === 'valor') { const v = num(inp.value); inp.value = v ? miles(v) : ''; q.valor = v; } else q.fecha = inp.value;
      cuadre();
    }));
    $$('#cuotas [data-rm]').forEach(b => b.addEventListener('click', () => { d.cuotas.splice(+b.dataset.rm, 1); pintar(); }));
    cuadre();
  };
  pintar();
  f.total.addEventListener('input', cuadre);
  $('#addQ').addEventListener('click', () => {
    const ult = d.cuotas[d.cuotas.length - 1];
    d.cuotas.push({ id: uid(), fecha: sumarMes(ult ? ult.fecha : hoy()), valor: Math.max(num(f.total.value) - suma(), 0) });
    pintar();
  });
  if (f.tercero) f.tercero.addEventListener('change', () => {
    const t = Object.values(S.cfg.terceros).find(x => x.nombre === f.tercero.value);
    if (t && !f.docId.value) f.docId.value = t.docId || '';
  });

  // Abono inicial: se refleja como una cuota "abono" y se registra como pago
  if (f.abonoIni) {
    fmtInput(f.abonoValor);
    const syncAbono = () => {
      d.cuotas = d.cuotas.filter(q => !q.abonoIni);
      const v = num(f.abonoValor.value);
      if (f.abonoIni.checked && v) {
        d.cuotas.unshift({ id: uid(), fecha: f.abonoFecha.value || hoy(), valor: v, abonoIni: true });
        // si solo había una cuota vacía, la convertimos en el saldo
        const resto = d.cuotas.filter(q => !q.abonoIni);
        if (resto.length === 1 && !resto[0].valor && num(f.total.value) > v) resto[0].valor = num(f.total.value) - v;
      }
      pintar();
    };
    f.abonoIni.addEventListener('change', () => { $('#abonoBox').hidden = !f.abonoIni.checked; syncAbono(); });
    f.abonoValor.addEventListener('change', syncAbono);
    f.abonoFecha.addEventListener('change', syncAbono);
  }

  frm.addEventListener('submit', async ev => {
    ev.preventDefault();
    const total = num(f.total.value);
    if (!total) { toast('Ingresa el valor total'); return; }
    const cuotas = d.cuotas.filter(q => q.valor > 0 && q.fecha).map(q => ({ id: q.id, fecha: q.fecha, valor: q.valor }));
    if (!cuotas.length) { toast('Agrega al menos una fecha de pago'); return; }
    const s = cuotas.reduce((n, q) => n + q.valor, 0);
    if (s !== total && !confirm(`Las cuotas suman ${fmt(s)} y el total es ${fmt(total)}. ¿Guardar así?`)) return;
    const ahora = Date.now();
    const comp = {
      ...d, id: d.id || uid(), nombre: f.nombre.value.trim(), tercero: f.tercero.value.trim(), docId: f.docId.value.replace(/\D/g, ''),
      concepto: f.concepto.value, total, cuotas, observaciones: f.observaciones.value.trim(),
      creado: d.creado || ahora, modificado: ahora, sync: false
    };
    const i = S.comp.findIndex(x => x.id === comp.id);
    if (i >= 0) S.comp[i] = comp; else S.comp.push(comp);
    await guardarComps();
    if (comp.tercero) S.cfg.terceros[comp.docId || norm(comp.tercero)] = { nombre: comp.tercero, docId: comp.docId, concepto: comp.concepto };
    if (f.abonoIni && f.abonoIni.checked && num(f.abonoValor.value)) {
      const reg = { id: uid(), fecha: f.abonoFecha.value || hoy(), valor: num(f.abonoValor.value), tercero: comp.tercero, docId: comp.docId,
        factura: '', concepto: comp.concepto, estado: 'Pagado', medioPago: 'Transferencia', soporteTipo: 'Sin soporte', periodo: '',
        observaciones: 'Abono a ' + comp.nombre, cufe: '', compromisoId: comp.id, creado: ahora, modificado: ahora, sync: false };
      await DB.put('registros', reg);
      S.registros.push(reg);
    }
    await guardarCfg();
    toast('Compromiso guardado ✔');
    programarAvisos();
    location.hash = '#compromisos/' + comp.id;
  });

  const del = $('#delC');
  if (del) del.addEventListener('click', async () => {
    if (!confirm(`¿Eliminar el compromiso "${c.nombre}"? Los abonos ya registrados quedan como pagos normales.`)) return;
    c.eliminado = true; c.modificado = Date.now(); c.sync = false;
    S.registros.filter(r => r.compromisoId === c.id).forEach(r => { r.compromisoId = ''; r.modificado = Date.now(); r.sync = false; DB.put('registros', r); });
    await guardarComps();
    toast('Compromiso eliminado');
    location.hash = '#compromisos';
  });
}

function sumarMes(f) {
  const [y, m, d] = f.split('-').map(Number);
  const x = new Date(y, m, Math.min(d, 28));
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

// ---------- Recordatorios ----------
async function activarAvisos() {
  if (!('Notification' in window)) { toast('Este navegador no permite notificaciones'); return; }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { toast('No se activaron los recordatorios'); render(); return; }
  await programarAvisos(true);
  toast('Recordatorios activados 🔔');
  render();
}

async function programarAvisos(prueba = false) {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  try {
    if ('periodicSync' in reg) {
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('vencimientos', { minInterval: 12 * 3600 * 1000 });
    }
  } catch (e) { console.warn('periodicSync', e); }
  const n = await revisarVencimientos(reg);
  if (prueba && !n) reg.showNotification('🔔 Recordatorios activados', {
    body: 'Te avisaré desde 3 días antes de cada vencimiento de tus compromisos.', icon: 'icon-192.png', tag: 'prueba'
  });
}
