// Conexión con OneDrive personal (Microsoft Graph) usando inicio de sesión OAuth con PKCE.
// No requiere servidor ni tiene costo.
const OD = (() => {
  const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
  const SCOPE = 'Files.ReadWrite offline_access';
  const GRAPH = 'https://graph.microsoft.com/v1.0';
  const redirect = () => location.origin + location.pathname;
  const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const rnd = (n = 48) => { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a); };
  const ruta = p => (APP_CONFIG.CARPETA_ONEDRIVE + '/' + p).split('/').map(encodeURIComponent).join('/');

  const configurado = () => !!APP_CONFIG.MS_CLIENT_ID;

  async function login() {
    if (!configurado()) throw new Error('Falta configurar el "Client ID" de Microsoft en config.js (ver LEEME.md, paso 2).');
    const v = rnd();
    const ch = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
    const st = rnd(16);
    localStorage.setItem('od_pkce', JSON.stringify({ v, st }));
    location.href = AUTH + '/authorize?' + new URLSearchParams({
      client_id: APP_CONFIG.MS_CLIENT_ID, response_type: 'code', redirect_uri: redirect(),
      scope: SCOPE, code_challenge: ch, code_challenge_method: 'S256', state: st
    });
  }

  async function manejarRetorno() {
    if (!configurado()) return false;
    const p = new URLSearchParams(location.search);
    if (!p.get('code') && !p.get('error')) return false;
    history.replaceState(null, '', redirect());
    if (p.get('error')) throw new Error(p.get('error_description') || p.get('error'));
    const saved = JSON.parse(localStorage.getItem('od_pkce') || '{}');
    if (p.get('state') !== saved.st) throw new Error('El inicio de sesión no coincide, inténtalo de nuevo.');
    await token({ grant_type: 'authorization_code', code: p.get('code'), code_verifier: saved.v, redirect_uri: redirect() });
    localStorage.removeItem('od_pkce');
    return true;
  }

  async function token(params) {
    const r = await fetch(AUTH + '/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: APP_CONFIG.MS_CLIENT_ID, scope: SCOPE, ...params })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || 'No se pudo obtener acceso a OneDrive');
    const t = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in - 120) * 1000 };
    await DB.setCfg('od_token', t);
    return t;
  }

  async function accessToken() {
    let t = await DB.getCfg('od_token');
    if (!t) return null;
    if (Date.now() < t.exp) return t.access;
    try { t = await token({ grant_type: 'refresh_token', refresh_token: t.refresh }); return t.access; }
    catch (e) { await DB.setCfg('od_token', null); return null; }
  }

  async function api(path, opts = {}) {
    const at = await accessToken();
    if (!at) throw new Error('NO_SESION');
    const r = await fetch(GRAPH + path, { ...opts, headers: { Authorization: 'Bearer ' + at, ...(opts.headers || {}) } });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error('OneDrive ' + r.status + ': ' + (await r.text()).slice(0, 200));
    return r;
  }

  async function subir(rel, blob, tipo) {
    if (blob.size < 4 * 1024 * 1024) {
      const r = await api(`/me/drive/root:/${ruta(rel)}:/content`, {
        method: 'PUT', headers: { 'Content-Type': tipo || blob.type || 'application/octet-stream' }, body: blob
      });
      return r && r.json();
    }
    // Archivos grandes: sesión de carga por partes
    const s = await (await api(`/me/drive/root:/${ruta(rel)}:/createUploadSession`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } })
    })).json();
    const PARTE = 320 * 1024 * 16; // 5 MB (múltiplo de 320 KB)
    let pos = 0, ult;
    while (pos < blob.size) {
      const fin = Math.min(pos + PARTE, blob.size);
      ult = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${pos}-${fin - 1}/${blob.size}` }, body: blob.slice(pos, fin) });
      if (!ult.ok) throw new Error('Error subiendo archivo grande (' + ult.status + ')');
      pos = fin;
    }
    return ult.json();
  }

  async function bajarTexto(rel) { const r = await api(`/me/drive/root:/${ruta(rel)}:/content`); return r ? r.text() : null; }
  async function bajarBlob(rel) { const r = await api(`/me/drive/root:/${ruta(rel)}:/content`); if (!r) throw new Error('No se encontró en OneDrive'); return r.blob(); }
  async function conectado() { return !!(await DB.getCfg('od_token')); }
  async function cerrar() { await DB.setCfg('od_token', null); }

  return { configurado, login, manejarRetorno, conectado, subir, bajarTexto, bajarBlob, cerrar };
})();
