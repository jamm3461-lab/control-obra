// Recibo de pago en PDF para pagos sin soporte (maestros, ayudantes, etc.) y número en letras.

function numeroALetras(n) {
  n = Math.floor(Math.abs(n || 0));
  if (n === 0) return 'CERO PESOS M/CTE';
  const U = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
    'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS',
    'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const c999 = x => {
    if (x === 0) return '';
    if (x === 100) return 'CIEN';
    const c = Math.floor(x / 100), r = x % 100;
    let s = C[c];
    if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : ''));
    return s;
  };
  const hastaMillon = x => {
    const m = Math.floor(x / 1000), r = x % 1000;
    let s = m ? (m === 1 ? 'MIL' : c999(m) + ' MIL') : '';
    if (r) s += (s ? ' ' : '') + c999(r);
    return s;
  };
  const mill = Math.floor(n / 1e6), r = n % 1e6;
  let s = mill ? (mill === 1 ? 'UN MILLÓN' : hastaMillon(mill) + ' MILLONES') : '';
  if (r) s += (s ? ' ' : '') + hastaMillon(r);
  s = s.replace(/VEINTIUNO (MIL|MILLONES)/g, 'VEINTIÚN $1').replace(/\bUNO (MIL|MILLONES)/g, 'UN $1');
  return s + (mill && !r ? ' DE PESOS' : ' PESOS') + ' M/CTE';
}

const Recibo = {
  async generar(d) {
    await cargarLib('jspdf');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const fmt = v => '$ ' + Number(v || 0).toLocaleString('es-CO');
    const [y0, m0, d0] = (d.fecha || '').split('-').map(Number);
    const fechaTxt = y0 ? new Date(y0, m0 - 1, d0).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    let y = 22;
    doc.setDrawColor(31, 58, 95); doc.setLineWidth(0.6);
    doc.rect(15, 12, 186, 128);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
    doc.text('RECIBO DE PAGO', 108, y, { align: 'center' });
    doc.setFontSize(11); doc.text('No. ' + (d.numero || ''), 195, y, { align: 'right' });
    y += 7;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Proyecto: ' + (d.proyecto || ''), 108, y, { align: 'center' });
    y += 5; doc.line(20, y, 196, y); y += 10;
    const fila = (k, v) => {
      doc.setFont('helvetica', 'bold'); doc.text(k, 22, y);
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(String(v || '-'), 128);
      doc.text(lines, 65, y);
      y += 6 * lines.length + 2;
    };
    fila('Fecha:', fechaTxt);
    fila('Pagado a:', d.tercero);
    fila('Identificación:', d.docId ? Number(d.docId).toLocaleString('es-CO') : '');
    fila('Valor:', fmt(d.valor));
    fila('Son:', numeroALetras(d.valor));
    fila('Concepto:', d.concepto);
    if (d.periodo) fila('Período:', d.periodo);
    fila('Medio de pago:', d.medioPago);
    if (d.observaciones) fila('Detalle:', d.observaciones);
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Generado con Control de Obra el ' + new Date().toLocaleString('es-CO'), 22, 135);
    return doc.output('blob');
  }
};

if (typeof module !== 'undefined') module.exports = { numeroALetras };
