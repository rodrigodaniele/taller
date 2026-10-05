import { ApiResponse, DatosTrabajoAdmin, TurnoAdmin, Presupuesto } from '../types';

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

// Cache temporal para evitar que el polling sobreescriba cambios optimistas recientes antes de que Google Sheets termine de guardar
const recentPresupuestoStateUpdates: Record<string, { estado: Presupuesto['estado']; timestamp: number }> = {};

export const gasApi = {
  async login(email: string, password: string): Promise<ApiResponse> {
    return callGasApi({
      accion: 'login',
      email: email.trim().toLowerCase(),
      password,
    });
  },

  async register(
    nombre: string,
    telefono: string,
    email: string,
    password: string,
    codigoVerificacion?: string
  ): Promise<ApiResponse> {
    return callGasApi({
      accion: 'registrar',
      nombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim().toLowerCase(),
      password,
      codigoVerificacion: codigoVerificacion?.trim(),
    });
  },

  async sendVerificationCode(email: string, nombre: string): Promise<ApiResponse> {
    return callGasApi({
      accion: 'enviarCodigoVerificacion',
      email: email.trim().toLowerCase(),
      nombre: nombre.trim(),
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

  async createTurnoMostrador(datos: {
    patente: string;
    fecha: string;
    horario: string;
    nombre: string;
    telefono: string;
    email: string;
  }): Promise<{ success: boolean; error?: string }> {
    return callGasApi({
      accion: 'crearTurnoMostrador',
      ...datos,
      password: '123456',
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

  // --- MÓDULO DE PRESUPUESTOS & COTIZACIONES ---
  async getPresupuestos(): Promise<{ success: boolean; presupuestos: Presupuesto[]; error?: string }> {
    try {
      const res = await callGasApi({
        accion: 'obtenerPresupuestos',
      });
      if (res && res.resultado === 'ok' && Array.isArray(res.presupuestos)) {
        // Preservamos las actualizaciones de estado recientes hechas localmente para evitar sobrescrituras prematuras
        const merged = res.presupuestos.map((p: Presupuesto) => {
          const recent = recentPresupuestoStateUpdates[p.id];
          if (recent && Date.now() - recent.timestamp < 20000) {
            return { ...p, estado: recent.estado };
          }
          return p;
        });

        localStorage.setItem('taller_presupuestos_v1', JSON.stringify(merged));
        return { success: true, presupuestos: merged };
      }
    } catch (e: any) {
      console.warn('Conexión con Google Sheets para presupuestos no disponible o script previo, leyendo caché local:', e);
    }
    const saved = localStorage.getItem('taller_presupuestos_v1');
    const list: Presupuesto[] = saved ? JSON.parse(saved) : [];
    const merged = list.map((p) => {
      const recent = recentPresupuestoStateUpdates[p.id];
      if (recent && Date.now() - recent.timestamp < 20000) {
        return { ...p, estado: recent.estado };
      }
      return p;
    });
    return { success: true, presupuestos: merged };
  },

  async savePresupuesto(presupuesto: Presupuesto): Promise<{ success: boolean; error?: string }> {
    // 1. Guardar en almacenamiento local inmediato
    try {
      const saved = localStorage.getItem('taller_presupuestos_v1');
      const list: Presupuesto[] = saved ? JSON.parse(saved) : [];
      const idx = list.findIndex((p) => p.id === presupuesto.id);
      if (idx >= 0) {
        list[idx] = presupuesto;
      } else {
        list.unshift(presupuesto);
      }
      localStorage.setItem('taller_presupuestos_v1', JSON.stringify(list));

      // Broadcast update across open tabs/windows in real time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_presupuesto_sync', { detail: { presupuesto } }));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'PRESUPUESTO_SAVED', presupuesto });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    // 2. Enviar a Google Sheets
    try {
      return await callGasApi({
        accion: 'guardarPresupuesto',
        presupuesto,
      });
    } catch (err: any) {
      console.warn('Guardado en caché local. Recordá actualizar el script de Google Sheets para sincronizar.', err);
      return { success: true };
    }
  },

  async updatePresupuestoEstado(id: string, estado: Presupuesto['estado']): Promise<{ success: boolean; error?: string }> {
    try {
      recentPresupuestoStateUpdates[id] = { estado, timestamp: Date.now() };

      const saved = localStorage.getItem('taller_presupuestos_v1');
      if (saved) {
        const list: Presupuesto[] = JSON.parse(saved);
        const updated = list.map((p) => (p.id === id ? { ...p, estado } : p));
        localStorage.setItem('taller_presupuestos_v1', JSON.stringify(updated));
      }

      // Broadcast update across open tabs/windows in real time
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_presupuesto_sync', { detail: { id, estado } }));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'PRESUPUESTO_ESTADO_CHANGED', id, estado });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({
        accion: 'actualizarEstadoPresupuesto',
        id,
        estado,
      });
    } catch (err: any) {
      return { success: true };
    }
  },

  async deletePresupuesto(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_presupuestos_v1');
      if (saved) {
        const list: Presupuesto[] = JSON.parse(saved).filter((p: Presupuesto) => p.id !== id);
        localStorage.setItem('taller_presupuestos_v1', JSON.stringify(list));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({
        accion: 'borrarPresupuesto',
        id,
      });
    } catch (err: any) {
      return { success: true };
    }
  },

  async facturarPresupuestoYArchivar(presupuesto: any): Promise<{ success: boolean; error?: string }> {
    return callGasApi({
      accion: 'facturarPresupuestoYArchivar',
      presupuesto,
    });
  },
};

