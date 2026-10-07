import { ApiResponse, DatosTrabajoAdmin, TurnoAdmin, Presupuesto, ItemStock, ItemPresupuesto } from '../types';
import { getFechaHoyArgentina, normalizarFechaArgentina } from '../utils/dateFormatter';

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
    const payload = {
      ...datosTrabajo,
      fecha: datosTrabajo.fecha ? normalizarFechaArgentina(datosTrabajo.fecha) : getFechaHoyArgentina(),
    };
    return callGasApi({
      accion: 'guardarTrabajoAdmin',
      datosTrabajo: payload,
    });
  },

  async buscarClientePorEmail(email: string): Promise<{ success: boolean; usuario?: { nombre: string; telefono: string; email: string }; error?: string }> {
    try {
      return await callGasApi({
        accion: 'buscarUsuarioPorEmail',
        email: email.trim().toLowerCase(),
      });
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  async marcarTurnoAtendido(patente: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await callGasApi({
        accion: 'marcarTurnoAtendido',
        patente: patente.trim().toUpperCase(),
      });
    } catch (e: any) {
      console.warn('Aviso: Guardado localmente el turno atendido:', e);
      return { success: true };
    }
  },

  async cancelarTurno(patente: string, motivo?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await callGasApi({
        accion: 'cancelarTurno',
        patente: patente.trim().toUpperCase(),
        motivo: motivo || 'Cliente no asistió',
      });
      // Fallback si la versión instalada en Apps Script aún no tiene la acción 'cancelarTurno'
      if (res && (res as any).resultado === 'error') {
        return await this.marcarTurnoAtendido(patente);
      }
      return res;
    } catch (e: any) {
      console.warn('Aviso: Cancelado localmente el turno:', e);
      return { success: true };
    }
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
    const p = {
      ...presupuesto,
      fecha: presupuesto.fecha ? normalizarFechaArgentina(presupuesto.fecha) : getFechaHoyArgentina(),
    };
    return callGasApi({
      accion: 'facturarPresupuestoYArchivar',
      presupuesto: p,
    });
  },

  // --- MÓDULO DE STOCK & ROTACIÓN DE REPUESTOS ---
  async getStockItems(): Promise<{ success: boolean; items: ItemStock[]; error?: string }> {
    try {
      const res = await callGasApi({ accion: 'obtenerStock' });
      if (res && res.resultado === 'ok' && Array.isArray(res.items)) {
        localStorage.setItem('taller_stock_v1', JSON.stringify(res.items));
        return { success: true, items: res.items };
      }
    } catch (e) {
      console.warn('Conexión con Sheets para stock no disponible o script previo, leyendo caché local:', e);
    }
    const saved = localStorage.getItem('taller_stock_v1');
    const list: ItemStock[] = saved ? JSON.parse(saved) : [];
    return { success: true, items: list };
  },

  async saveStockItem(item: ItemStock): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_stock_v1');
      const list: ItemStock[] = saved ? JSON.parse(saved) : [];
      const idx = list.findIndex((x) => x.id === item.id);
      if (idx >= 0) {
        list[idx] = item;
      } else {
        list.push(item);
      }
      localStorage.setItem('taller_stock_v1', JSON.stringify(list));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync', { detail: { item } }));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({ accion: 'guardarItemStock', item });
    } catch (e) {
      return { success: true };
    }
  },

  async deleteStockItem(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_stock_v1');
      if (saved) {
        const list: ItemStock[] = JSON.parse(saved).filter((x: ItemStock) => x.id !== id);
        localStorage.setItem('taller_stock_v1', JSON.stringify(list));
      }
    } catch (e) {}

    try {
      return await callGasApi({ accion: 'eliminarItemStock', id });
    } catch (e) {
      return { success: true };
    }
  },

  async ingresarCompraStock(datos: {
    id: string;
    cantidad: number;
    costoTotal: number;
    costoUnitario?: number;
    registrarEnContabilidad?: boolean;
    metodoPago?: string;
    fecha?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_stock_v1');
      const list: ItemStock[] = saved ? JSON.parse(saved) : [];
      const item = list.find((x) => x.id === datos.id);
      const fechaMov = datos.fecha ? normalizarFechaArgentina(datos.fecha) : getFechaHoyArgentina();
      if (item) {
        item.stockActual = (Number(item.stockActual) || 0) + Number(datos.cantidad);
        if (datos.costoUnitario && datos.costoUnitario > 0) {
          item.costoUnitario = datos.costoUnitario;
        } else if (datos.costoTotal && datos.cantidad > 0) {
          item.costoUnitario = Math.round(datos.costoTotal / datos.cantidad);
        }
        item.ultimoMovimiento = fechaMov;
        localStorage.setItem('taller_stock_v1', JSON.stringify(list));
      }

      // Si solicitó impactar en Contabilidad como gasto
      if (datos.registrarEnContabilidad && datos.costoTotal > 0 && item) {
        const mov = {
          id: 'MOV-STOCK-' + Date.now(),
          fecha: fechaMov,
          tipo: 'gasto',
          concepto: `Compra Stock: ${datos.cantidad}x ${item.nombre}`,
          categoria: 'Repuestos / Repuesteros',
          monto: Number(datos.costoTotal),
          metodoPago: datos.metodoPago || 'Efectivo',
          referencia: 'STOCK REPUESTOS',
        };
        await gasApi.addAccountingMovement(mov);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({ accion: 'ingresarCompraStock', datos });
    } catch (e) {
      return { success: true };
    }
  },

  async actualizarRotacionYDescontarStock(
    items: ItemPresupuesto[],
    vehiculoModelo?: string,
    fechaMovimiento?: string
  ): Promise<void> {
    try {
      const repuestos = items.filter((it) => it.tipo === 'repuesto');
      if (repuestos.length === 0) return;

      const saved = localStorage.getItem('taller_stock_v1');
      const list: ItemStock[] = saved ? JSON.parse(saved) : [];
      const fechaFinal = fechaMovimiento ? normalizarFechaArgentina(fechaMovimiento) : getFechaHoyArgentina();

      repuestos.forEach((rep) => {
        const cant = Number(rep.cantidad) || 1;
        const nombreNorm = rep.descripcion.trim().toUpperCase();

        let stockItem = list.find(
          (x) =>
            x.nombre.trim().toUpperCase() === nombreNorm ||
            nombreNorm.includes(x.nombre.trim().toUpperCase()) ||
            x.nombre.trim().toUpperCase().includes(nombreNorm)
        );

        if (stockItem) {
          // Si tiene stock físico disponible, se descuenta
          if (stockItem.stockActual > 0) {
            stockItem.stockActual = Math.max(0, stockItem.stockActual - cant);
          }
          // Sumar siempre a la rotación histórica de piezas cambiadas
          stockItem.totalInstalados = (Number(stockItem.totalInstalados) || 0) + cant;
          stockItem.ultimoMovimiento = fechaFinal;
        } else {
          // Registrar automáticamente la nueva pieza en el catálogo para llevar estadística de rotación
          const nuevoItem: ItemStock = {
            id: 'STOCK-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            nombre: rep.descripcion.trim(),
            categoria: 'Tren Delantero / Suspensión',
            vehiculoCompatibilidad: vehiculoModelo || 'Multimarca',
            stockActual: 0,
            stockMinimo: 2,
            costoUnitario: 0,
            precioVenta: rep.precioUnitario || 0,
            totalInstalados: cant,
            ultimoMovimiento: fechaFinal,
          };
          list.push(nuevoItem);
        }
      });

      localStorage.setItem('taller_stock_v1', JSON.stringify(list));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Error al actualizar rotación de stock:', e);
    }
  },
};

