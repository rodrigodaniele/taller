/**
 * Utilidades de fecha para La Casa de la Dirección
 * Garantiza formato estándar argentino (DD/MM/AAAA) sin desfasaje horario.
 */

export const formatearFechaArgentina = (fechaRaw: any): string => {
  if (!fechaRaw) return '';
  const str = String(fechaRaw).replace(/['"]/g, '').trim();
  if (!str) return '';

  // Caso 1: Ya en formato DD/MM/AAAA o D/M/AAAA
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const [d, m, rest] = str.split('/');
    const y = rest.split(' ')[0];
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Caso 2: Formato ISO AAAA-MM-DD o AAAA-MM-DDTHH:mm:ss
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(str)) {
    const onlyDate = str.split('T')[0].split(' ')[0];
    const [y, m, d] = onlyDate.split('-');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }

  // Caso 3: String de fecha de JavaScript (ej: Sun Oct 04 2026 ...) o fecha completa
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    }
  } catch {}

  return str;
};

/**
 * Calcula la fecha de vencimiento a partir de una fecha base y los días de validez.
 * Devuelve siempre formato argentino DD/MM/AAAA.
 */
export const calcularFechaVencimiento = (fechaStr?: string, validezDias = 7): string => {
  if (!fechaStr) return '';
  try {
    const clean = String(fechaStr).replace(/['"]/g, '').trim();
    let baseDate: Date;

    if (/^\d{4}-\d{1,2}-\d{1,2}/.test(clean)) {
      const [y, m, d] = clean.split('T')[0].split(' ')[0].split('-');
      baseDate = new Date(Number(y), Number(m) - 1, Number(d));
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(clean)) {
      const [d, m, y] = clean.split('/');
      baseDate = new Date(Number(y), Number(m) - 1, Number(d));
    } else {
      const parsed = new Date(clean);
      baseDate = !isNaN(parsed.getTime()) ? parsed : new Date();
    }

    baseDate.setDate(baseDate.getDate() + (Number(validezDias) || 7));
    const dia = String(baseDate.getDate()).padStart(2, '0');
    const mes = String(baseDate.getMonth() + 1).padStart(2, '0');
    const anio = baseDate.getFullYear();
    return `${dia}/${mes}/${anio}`;
  } catch (e) {
    return '';
  }
};
