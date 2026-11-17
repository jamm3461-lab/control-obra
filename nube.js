// Sincronización automática entre dispositivos con Supabase (plan gratuito).
// Cada usuario solo ve sus propios datos (reglas RLS en la base de datos).
// Un registro está pendiente de subir cuando su "modificado" no coincide con "nubeMod".
const Nube = (() => {
  let sb = null;
  const configurada = () => !!(APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_KEY);

  function cliente() {
    if (!configurada()) return Promise.resolve(null);
    if (!sb) sb = cargarLib('supabase').then(() => supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'co-auth' }
    })).catch(e => { sb = null; throw e; });
    return sb;
  }

  async function usuario() {
    const c = await cliente(); if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session ? data.session.user : null;
  }

  const ERRORES = {
    'Invalid login credentials': 'Correo o contraseña incorrectos',
    'Email not confirmed': 'Primero confirma tu correo: abre el enlace que te llegó',
    'User already registered': 'Ese correo ya tiene cuenta: usa "Entrar"',
    'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres'
  };
  const err = e => new Error(ERRORES[e.message] || e.message);

  async function entrar(email, pass) {
    const { error } = await (await cliente()).auth.signInWithPassword({ email, password: pass });
    if (error) throw err(error);
  }
  async function crearCuenta(email, pass) {
    const { data, error } = await (await cliente()).auth.signUp({
      email, password: pass, options: { emailRedirectTo: location.origin + location.pathname }
    });
    if (error) throw err(error);
    return !data.session; // true = debe confirmar el correo
  }
  async function recuperar(email) {
    const { error } = await (await cliente()).auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw err(error);
  }
  async function salir() { await (await cliente()).auth.signOut(); }

  const limpio = r => { const x = { ...r }; delete x.nubeMod; delete x.nubeArchivo; delete x.sync; return x; };

  async function aplicarRemotos(tabla, filas) {
    const lista = tabla === 'registros' ? S.registros : S.comp;
    const mapa = new Map(lista.map(r => [r.id, r]));
    for (const f of filas) {
      const l = mapa.get(f.id);
      if (!l || (f.modificado || 0) > (l.modificado || 0)) {
        const nuevo = { ...f.data, nubeMod: f.modificado, nubeArchivo: true, sync: l ? l.sync : true };
        if (l && l.archivo === nuevo.archivo) nuevo.archivoSubido = l.archivoSubido;
        mapa.set(f.id, nuevo);
        if (tabla === 'registros') await DB.put('registros', nuevo);
      } else if ((f.modificado || 0) === (l.modificado || 0)) {
        l.nubeMod = l.modificado;
      }
    }
    if (tabla === 'registros') S.registros = [...mapa.values()];
    else { S.comp = [...mapa.values()]; await DB.setCfg('compromisos', S.comp); }
  }

  async function subirFilas(c, tabla, lista) {
    const pend = lista.filter(r => r.nubeMod !== r.modificado);
    for (let i = 0; i < pend.length; i += 200) {
      const lote = pend.slice(i, i + 200);
      const { error } = await c.from(tabla).upsert(lote.map(r => ({
        id: r.id, data: limpio(r), modificado: r.modificado || 0, eliminado: !!r.eliminado
      })), { onConflict: 'id' });
      if (error) throw new Error('Subiendo ' + tabla + ': ' + error.message);
      lote.forEach(r => { r.nubeMod = r.modificado; });
    }
    return pend.length;
  }

  async function sincronizar() {
    const c = await cliente();
    const u = await usuario();
    if (!u) throw new Error('NO_SESION');
    const desde = await DB.getCfg('nubeDesde', '1970-01-01T00:00:00Z');
    let maxT = desde;

    // 1) Bajar cambios hechos en otros dispositivos
    for (const tabla of ['registros', 'compromisos']) {
      let pagina = 0;
      for (;;) {
        const { data, error } = await c.from(tabla).select('id,data,modificado,actualizado')
          .gt('actualizado', desde).order('actualizado').range(pagina * 500, pagina * 500 + 499);
        if (error) throw new Error('Bajando ' + tabla + ': ' + error.message);
        if (!data.length) break;
        await aplicarRemotos(tabla, data);
        data.forEach(f => { if (f.actualizado > maxT) maxT = f.actualizado; });
        if (data.length < 500) break;
        pagina++;
      }
    }
    const { data: cfgRem, error: e1 } = await c.from('config').select('data,modificado').maybeSingle();
    if (e1) throw new Error('Bajando ajustes: ' + e1.message);
    if (cfgRem && cfgRem.modificado > (S.cfg.actualizado || 0)) {
      const ter = { ...(cfgRem.data.terceros || {}), ...S.cfg.terceros };
      const consec = Math.max(cfgRem.data.consecRecibo || 0, S.cfg.consecRecibo || 0);
      Object.assign(S.cfg, cfgRem.data, { terceros: ter, consecRecibo: consec, actualizado: cfgRem.modificado });
      await DB.setCfg('cfg', S.cfg);
      await DB.setCfg('nubeCfgMod', cfgRem.modificado);
    }

    // 2) Subir soportes (fotos / PDF) nuevos
    for (const r of S.registros.filter(r => r.archivo && !r.nubeArchivo && !r.eliminado)) {
      const a = await DB.get('archivos', r.id);
      if (a) {
        const { error } = await c.storage.from('soportes').upload(u.id + '/' + r.archivo, a.blob, { upsert: true, contentType: a.tipo || a.blob.type });
        if (error) throw new Error('Subiendo soporte: ' + error.message);
      }
      r.nubeArchivo = true;
      await DB.put('registros', r);
    }

    // 3) Subir cambios hechos en este dispositivo
    const n = await subirFilas(c, 'registros', S.registros) + await subirFilas(c, 'compromisos', S.comp);
    for (const r of S.registros) await DB.put('registros', r);
    await DB.setCfg('compromisos', S.comp);
    if ((S.cfg.actualizado || 0) !== await DB.getCfg('nubeCfgMod', 0)) {
      const { error } = await c.from('config').upsert({ user_id: u.id, data: S.cfg, modificado: S.cfg.actualizado || Date.now() }, { onConflict: 'user_id' });
      if (error) throw new Error('Subiendo ajustes: ' + error.message);
      await DB.setCfg('nubeCfgMod', S.cfg.actualizado || 0);
    }

    // Próxima bajada: desde lo último recibido, retrocediendo 1 s por seguridad.
    // Lo que este dispositivo acaba de subir se vuelve a bajar una vez, sin efecto (mismo "modificado").
    const seguro = new Date(Date.parse(maxT) - 1000).toISOString();
    await DB.setCfg('nubeDesde', seguro > desde ? seguro : desde);
    await DB.setCfg('nubeUltima', Date.now());
    return n;
  }

  async function bajarArchivo(ruta) {
    const c = await cliente(); const u = await usuario();
    if (!u) throw new Error('Inicia sesión para ver el soporte');
    const { data, error } = await c.storage.from('soportes').download(u.id + '/' + ruta);
    if (error) throw new Error(error.message);
    return data;
  }

  const pendientes = () => S.registros.filter(r => r.nubeMod !== r.modificado).length + (S.comp || []).filter(c => c.nubeMod !== c.modificado).length;

  return { configurada, cliente, usuario, entrar, crearCuenta, recuperar, salir, sincronizar, bajarArchivo, pendientes };
})();
