# Control de Obra: guía de instalación

App para el celular (Android) que controla los desembolsos del proyecto de construcción.
Funciona sin mensualidades. Los datos se guardan en el celular y se respaldan en tu OneDrive personal con un toque.

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

## Paso 2: Guardar en OneDrive (sin registros en Microsoft)

La app no se conecta directamente a OneDrive (eso exige un registro en Microsoft que con cuentas Hotmail falla).
En su lugar usa el menú **Compartir** de Android junto con la app de **OneDrive** instalada en el celular:

1. Toca **☁️** (arriba a la derecha), o ve a **Ajustes → Guardar en OneDrive**.
2. En el menú Compartir elige **OneDrive** y navega a **Proyectos › ControlObra › Datos**.
3. Toca **Subir**. Si OneDrive pregunta por archivos repetidos, elige **Reemplazar**.

Se envían: `Control_Obra.xlsx`, `Control_Obra_copia_seguridad.txt` y los soportes nuevos (facturas, fotos y recibos).
La app avisa en el inicio cuando llevas más de 2 días con cambios sin respaldar.

Para pasar los datos a otro celular: instala la app y en **Ajustes → Restaurar** elige el archivo `Control_Obra_copia_seguridad.txt` desde OneDrive.

> Opción avanzada (no necesaria): si algún día se registra la app en Microsoft, se pone el "Client ID" en `config.js` y la sincronización pasa a ser automática.

## Paso 3: Instalar en el celular Android

1. Abre la URL del paso 1 en **Chrome**.
2. En el menú ⋮, toca **Agregar a la pantalla principal** y luego **Instalar**.
3. Abre la app. Para respaldar, toca **☁️** (ver paso 2).
4. Desde ese momento, "Control Obra" aparece en el menú **Compartir** de WhatsApp.

## Paso 4 (opcional): Usar tu suscripción de Claude

1. En la app de Claude, crea un **Proyecto** llamado "Control de obra".
2. Copia las instrucciones que aparecen en **Ajustes → Usar con Claude** y pégalas como instrucciones del proyecto.
3. Comparte la factura de WhatsApp con Claude dentro de ese proyecto. Claude responde con una línea que empieza por `OBRA|`.
4. Copia esa línea y en la app toca **📋 Pegar de Claude**. También puedes compartirla directamente a Control Obra.

## Notas

- Sin internet, la app sigue funcionando; los datos quedan en el celular hasta que hagas el respaldo.
  El OCR necesita internet solo la primera vez, para descargar el idioma español.
- **Importante:** si borras los datos de Chrome o desinstalas la app, se borra lo guardado en el celular. Por eso conviene respaldar seguido.
- En **Ajustes** puedes descargar el Excel y hacer o restaurar una copia de seguridad.
