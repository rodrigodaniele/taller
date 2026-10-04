import { ApiResponse, DatosTrabajoAdmin, TurnoAdmin } from '../types';

export const DEFAULT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbziaELEqc9K1IKN2iXdEZ6bDN-GRUEJUUneEWfGM2VFg60uunAq_vb7gOIsxaDJEL08FA/exec";
export const EMAIL_ADMIN_OFICIAL = "rodrigodanieleaset@gmail.com";
export const WHATSAPP_PHONE = "5492625532070";
export const WHATSAPP_LINK = "https://wa.me/5492625532070/?text=Hola!%20Quiero%20consultar%20por%20un%20turno%20en%20La%20Casa%20de%20la%20Dirección";
export const GOOGLE_MAPS_LINK = "https://maps.app.goo.gl/dEzUXy5uZspWS7Tr8";

/**
 * Performs a POST request to Google Apps Script WebApp
 */
async function callGasApi<T = any>(payload: Record<string, any>): Promise<T> {
  try {
    const response = await fetch(DEFAULT_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error('Error al conectar con Google Apps Script:', err);
    throw new Error(err.message || 'Error de conexión con el servidor de base de datos.');
  }
}

export const gasApi = {
  async login(email: string, password: string): Promise<ApiResponse> {
    return callGasApi({
      accion: 'login',
      email: email.trim().toLowerCase(),
      password,
    });
  },

  async register(nombre: string, telefono: string, email: string, password: string): Promise<ApiResponse> {
    return callGasApi({
      accion: 'registrar',
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
  },

  async getOccupiedSlots(fecha: string): Promise<{ resultado: string; ocupados: string[] }> {
    return callGasApi({
      accion: 'obtenerOcupados',
      fecha,
    });
  },

  async reserveTurno(email: string, fecha: string, horario: string, patente: string): Promise<ApiResponse> {
    return callGasApi({
      accion: 'reservarTurno',
      email: email.trim().toLowerCase(),
      fecha,
      horario,
      patente: patente.trim().toUpperCase(),
    });
  },

  async getAdminTurnos(): Promise<{ success: boolean; turnos: TurnoAdmin[]; error?: string }> {
    return callGasApi({
      accion: 'obtenerTurnosAdmin',
    });
  },

  async saveAdminWork(datosTrabajo: DatosTrabajoAdmin): Promise<{ success: boolean; error?: string }> {
    return callGasApi({
      accion: 'guardarTrabajoAdmin',
      datosTrabajo,
    });
  },

  async getClientHistory(emailCliente: string): Promise<{ success: boolean; historial: any[]; error?: string }> {
    return callGasApi({
      accion: 'obtenerHistorialCliente',
      emailCliente: emailCliente.trim().toLowerCase(),
    });
  },

  async getAccountingMovements(): Promise<{ success: boolean; movimientos: any[]; error?: string }> {
    try {
      const res = await callGasApi({
        accion: 'obtenerMovimientosContables',
      });
      return res;
    } catch (e: any) {
      console.warn('Google Apps Script no soporta obtenerMovimientosContables aún, leyendo desde almacenamiento local:', e);
      const saved = localStorage.getItem('lacasadeladireccion_contabilidad');
      const list = saved ? JSON.parse(saved) : [];
      return { success: true, movimientos: list };
    }
  },

  async addAccountingMovement(movimiento: any): Promise<{ success: boolean; error?: string }> {
    // Save to local storage as instant backup
    try {
      const saved = localStorage.getItem('lacasadeladireccion_contabilidad');
      const list = saved ? JSON.parse(saved) : [];
      list.unshift(movimiento);
      localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(list));
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({
        accion: 'registrarMovimientoContable',
        movimiento,
      });
    } catch (err: any) {
      console.warn('Aviso: Guardado en almacenamiento local. Si aún no actualizaste el script de Google Sheets, recordá pegar la nueva versión.', err);
      return { success: true };
    }
  },

  async deleteAccountingMovement(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('lacasadeladireccion_contabilidad');
      if (saved) {
        const list = JSON.parse(saved).filter((m: any) => m.id !== id);
        localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(list));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({
        accion: 'eliminarMovimientoContable',
        id,
      });
    } catch (err: any) {
      return { success: true };
    }
  },
};

