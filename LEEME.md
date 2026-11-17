# Control de Obra: guía de instalación

App para el celular (Android) que controla los desembolsos del proyecto de construcción.
Funciona sin mensualidades. Los datos se guardan en el celular y se sincronizan con tu OneDrive personal.

## Qué hace

- **Registrar pagos** de tres formas:
  - Desde WhatsApp: mantén presionada la factura o el mensaje, toca **Compartir** y elige **Control Obra**.
  - Con una foto o un archivo PDF.
  - A mano. Para los pagos frecuentes (por ejemplo, el maestro cada semana) hay botones de un toque.
- **Lectura automática y gratuita** de los soportes:
  - Facturas electrónicas DIAN: se lee el código QR (número de factura, fecha, NIT, valor y CUFE).
  - PDF con texto: se lee el texto directamente.
  - Fotos y capturas: lectura de texto (OCR) en el propio celular.
  - Opcional: con "📋 Pegar de Claude", usando tu suscripción de Claude.
- **Pagos sin soporte** (maestros, ayudantes): se marcan como "Sin soporte", o la app genera un **recibo de pago en PDF** numerado (RC-0001, RC-0002…).
- **Estados de pago:** Pagado o Por pagar, con un botón para "Marcar pagado".
- **Alerta de duplicados:** avisa si registras dos veces la misma factura (por CUFE, o por número de factura y NIT).
- **Tablero:** total pagado, total por pagar, gasto por concepto, gasto por mes y pagos sin soporte.
- **Excel** `Control_Obra.xlsx` con tres hojas: Movimientos, Resumen por concepto y Por mes.

## Dónde quedan los datos (OneDrive)

```
OneDrive/Proyectos/ControlObra/
├── app/                ← código de la app (esta carpeta)
└── Datos/              ← lo crea la app al sincronizar
    ├── Control_Obra.xlsx   (se regenera en cada sincronización; no editarlo a mano)
    ├── datos.json          (base de datos de la app)
    └── Soportes/AAAA-MM/   (facturas, fotos y recibos)
```

---

## Paso 1: Publicar la app (GitHub Pages, gratis)

La app tiene que estar publicada en internet para poder instalarla en el celular.
Solo se publica el **código**. Tus datos y facturas **no** se publican: quedan en tu celular y en tu OneDrive.

1. Crea un repositorio **público** en github.com llamado `control-obra`.
2. Sube el contenido de esta carpeta `app/`.
3. En el repositorio, ve a **Settings → Pages → Source: Deploy from a branch → main / (root)**.
4. La app quedará en: `https://TU-USUARIO.github.io/control-obra/`

## Paso 2: Conectar OneDrive (registro gratuito en Microsoft)

1. Entra a https://portal.azure.com con tu cuenta Hotmail.
   Si te pide crear una "cuenta gratuita de Azure" o un "directorio", sigue el asistente.
   No se usa ningún servicio pago.
2. Busca **"Registros de aplicaciones" (App registrations)** y toca **Nuevo registro**.
   - Nombre: `Control de Obra`
   - Tipos de cuenta: **Solo cuentas personales de Microsoft**
   - URI de redirección: plataforma **Aplicación de página única (SPA)**, con la URL del paso 1
     (`https://TU-USUARIO.github.io/control-obra/`, incluida la barra final).
3. Copia el **Id. de aplicación (cliente)** y pégalo en `config.js`, en `MS_CLIENT_ID: '...'`.
4. Vuelve a subir `config.js` a GitHub.

## Paso 3: Instalar en el celular Android

1. Abre la URL del paso 1 en **Chrome**.
2. En el menú ⋮, toca **Agregar a la pantalla principal** y luego **Instalar**.
3. Abre la app, ve a **Ajustes** y toca **Conectar OneDrive**.
4. Desde ese momento, "Control Obra" aparece en el menú **Compartir** de WhatsApp.

## Paso 4 (opcional): Usar tu suscripción de Claude

1. En la app de Claude, crea un **Proyecto** llamado "Control de obra".
2. Copia las instrucciones que aparecen en **Ajustes → Usar con Claude** y pégalas como instrucciones del proyecto.
3. Comparte la factura de WhatsApp con Claude dentro de ese proyecto. Claude responde con una línea que empieza por `OBRA|`.
4. Copia esa línea y en la app toca **📋 Pegar de Claude**. También puedes compartirla directamente a Control Obra.

## Notas

- Sin internet, la app sigue funcionando y sincroniza cuando vuelve la conexión.
  El OCR necesita internet solo la primera vez, para descargar el idioma español.
- Si pasa más de un día sin abrir la app, Microsoft puede pedir que vuelvas a tocar **Conectar OneDrive**.
- En **Ajustes** puedes descargar el Excel y hacer o restaurar una copia de seguridad.
