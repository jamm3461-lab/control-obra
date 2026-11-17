// Configuración de la app.
window.APP_CONFIG = {
  // Sincronización entre dispositivos (Supabase, plan gratuito).
  // SUPABASE_KEY es la "publishable key": es pública por diseño (va dentro de la app);
  // la seguridad la dan las reglas RLS de la base de datos (cada usuario solo ve lo suyo).
  // NUNCA poner aquí la clave "secret" / "service_role".
  SUPABASE_URL: 'https://fxpizuenjzdfxmwedqah.supabase.co',
  SUPABASE_KEY: 'sb_publishable_eUJMFk9VgoaDotWUgQaYww_9s4TGegE',

  // Conexión directa con OneDrive (no se usa: el registro en Microsoft falló). Dejar vacío.
  MS_CLIENT_ID: '',
  CARPETA_ONEDRIVE: 'Proyectos/ControlObra/Datos'
};
