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

/**
 * Formatea el horario recibido desde Google Sheets o formularios.
 * Corrige el error común de Google Sheets cuando una celda de hora se serializa
 * como fecha base 1899 (ej: "1899-12-30T12:16:48.000Z") y lo convierte en "12:16".
 */
export const formatearHorario = (horarioRaw: any): string => {
  if (!horarioRaw) return '';
  const str = String(horarioRaw).replace(/['"]/g, '').trim();
  if (!str) return '';

  // Caso 1: String ISO con 'T' (ej: "1899-12-30T12:16:48.000Z")
  if (str.includes('T')) {
    const timePart = str.split('T')[1];
    if (timePart) {
      const match = timePart.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
      }
    }
  }

  // Caso 2: Formato estándar con dos puntos (ej: "09:00", "9:30", "12:16:48")
  if (str.includes(':')) {
    const match = str.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      return `${match[1].padStart(2, '0')}:${match[2]}`;
    }
  }

  // Caso 3: Solo número de hora (ej: "9" o "16")
  if (/^\d{1,2}$/.test(str)) {
    return `${str.padStart(2, '0')}:00`;
  }

  return str;
};
