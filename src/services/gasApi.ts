import { ApiResponse, DatosTrabajoAdmin, TurnoAdmin, Presupuesto, ItemStock, ItemPresupuesto, RepuestoUsado, CompraRepuesto } from '../types';
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

  async buscarClientePorEmail(email: string): Promise<{ success: boolean; usuario?: { nombre: string; telefono: string; email: string; patente?: string }; error?: string }> {
    const clean = email.trim().toLowerCase();
    if (!clean) return { success: false, error: 'Email vacío' };

    // 1. Intentar acción directa en Apps Script (buscarUsuarioPorEmail)
    try {
      const res = await callGasApi({
        accion: 'buscarUsuarioPorEmail',
        email: clean,
      });
      if (res && (res.resultado === 'ok' || res.success) && res.usuario && (res.usuario.nombre || res.usuario.telefono)) {
        return {
          success: true,
          usuario: {
            email: clean,
            nombre: res.usuario.nombre || '',
            telefono: res.usuario.telefono || '',
            patente: res.usuario.patente || '',
          },
        };
      }
    } catch {}

    // 2. Intentar login con clave predeterminada de mostrador (123456)
    // Esto funciona con la versión actual desplegada en Google Apps Script, leyendo directo de la hoja Usuarios
    try {
      const loginRes = await this.login(clean, '123456');
      if (loginRes && loginRes.resultado === 'ok' && (loginRes.nombre || loginRes.telefono)) {
        let patente = '';
        if (Array.isArray(loginRes.turnos) && loginRes.turnos.length > 0) {
          const tMatch = loginRes.turnos.find((t: any) => t.patente && t.patente !== 'MOSTRADOR');
          if (tMatch) patente = tMatch.patente;
        }
        return {
          success: true,
          usuario: {
            email: clean,
            nombre: loginRes.nombre || '',
            telefono: loginRes.telefono || '',
            patente,
          },
        };
      }
    } catch {}

    // 3. Consultar la lista de turnos de admin para ver si el correo figura con nombre y teléfono
    try {
      const turnosRes = await this.getAdminTurnos();
      if (turnosRes && turnosRes.success) {
        if (Array.isArray((turnosRes as any).usuarios)) {
          const u = (turnosRes as any).usuarios.find((x: any) => (x.email || '').toLowerCase().trim() === clean);
          if (u && (u.nombre || u.telefono)) {
            return {
              success: true,
              usuario: {
                email: clean,
                nombre: u.nombre || '',
                telefono: u.telefono || '',
              },
            };
          }
        }
        if (Array.isArray(turnosRes.turnos)) {
          const t = turnosRes.turnos.find((x: any) => (x.email || '').toLowerCase().trim() === clean);
          if (t && (t.nombre || t.telefono)) {
            return {
              success: true,
              usuario: {
                email: clean,
                nombre: t.nombre || '',
                telefono: t.telefono || '',
                patente: t.patente && t.patente !== 'MOSTRADOR' ? t.patente : '',
              },
            };
          }
        }
      }
    } catch {}

    // 4. Consultar historial de servicios por email para ver si existe y traer su patente
    try {
      const histRes = await this.getClientHistory(clean);
      if (histRes && histRes.success && Array.isArray(histRes.historial) && histRes.historial.length > 0) {
        const item = histRes.historial[0];
        return {
          success: true,
          usuario: {
            email: clean,
            nombre: '',
            telefono: '',
            patente: item.patente && item.patente !== 'MOSTRADOR' ? item.patente : '',
          },
        };
      }
    } catch {}

    return { success: false, error: 'Usuario no encontrado' };
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

  async cancelarTurno(patente: string, motivo?: string, fecha?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await callGasApi({
        accion: 'cancelarTurno',
        patente: patente.trim().toUpperCase(),
        fecha: fecha ? normalizarFechaArgentina(fecha) : undefined,
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
    fechaMovimiento?: string,
    meta?: { patente?: string; clienteNombre?: string; presupuestoNumero?: string },
    options?: { syncWithRemote?: boolean }
  ): Promise<void> {
    try {
      const repuestos = items.filter((it) => it.tipo === 'repuesto');
      if (repuestos.length === 0) return;

      const fechaFinal = fechaMovimiento ? normalizarFechaArgentina(fechaMovimiento) : getFechaHoyArgentina();

      // Registro de repuestos usados para el Módulo 1 (Rotación y consumos del taller)
      const savedUsados = localStorage.getItem('taller_repuestos_usados_v1');
      const listaUsados: RepuestoUsado[] = savedUsados ? JSON.parse(savedUsados) : [];

      repuestos.forEach((rep) => {
        const cant = Number(rep.cantidad) || 1;
        const descTrim = rep.descripcion.trim();
        const vehTrim = (vehiculoModelo || '').trim();
        const claveUnificada = vehTrim ? `${descTrim} - ${vehTrim}` : descTrim;

        // Agregar exclusivamente al historial de repuestos utilizados (Módulo 1) sin alterar el inventario físico del Panel 2
        const nuevoUso: RepuestoUsado = {
          id: 'USO-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          fecha: fechaFinal,
          repuestoNombre: claveUnificada,
          cantidad: cant,
          vehiculo: vehTrim || '',
          patente: meta?.patente || '',
          cliente: meta?.clienteNombre || '',
          origen: 'facturacion',
          presupuestoId: meta?.presupuestoNumero || '',
          observaciones: meta?.presupuestoNumero
            ? `Facturado automáticamente en Presupuesto #${meta.presupuestoNumero}`
            : 'Facturado automáticamente desde servicio de taller',
        };
        listaUsados.unshift(nuevoUso);
      });

      localStorage.setItem('taller_repuestos_usados_v1', JSON.stringify(listaUsados));

      // Solo si se solicita explícitamente sincronización remota individual (no cuando ya se envía a Google Apps Script por facturación o turno)
      if (options?.syncWithRemote) {
        for (const repUso of listaUsados.slice(0, repuestos.length)) {
          try {
            await callGasApi({ accion: 'registrarRepuestoUsado', uso: repUso });
          } catch {}
        }
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
      console.warn('Error al actualizar rotación de stock:', e);
    }
  },

  /**
   * MÓDULO 1: Obtener lista de repuestos utilizados / consumidos en taller (desde Google Sheets hoja Repuestos_Utilizados)
   */
  async getRepuestosUsados(): Promise<{ success: boolean; items: RepuestoUsado[] }> {
    try {
      const res = await callGasApi({ accion: 'obtenerRepuestosUsados' });
      if (res && res.resultado === 'ok' && Array.isArray(res.items)) {
        localStorage.setItem('taller_repuestos_usados_v1', JSON.stringify(res.items));
        return { success: true, items: res.items };
      }
    } catch (e) {
      console.warn('Conexión con Google Sheets para repuestos usados no disponible, leyendo caché local:', e);
    }

    try {
      const saved = localStorage.getItem('taller_repuestos_usados_v1');
      const list: RepuestoUsado[] = saved ? JSON.parse(saved) : [];
      return { success: true, items: list };
    } catch (e) {
      console.warn('Error al obtener repuestos usados:', e);
      return { success: true, items: [] };
    }
  },

  /**
   * MÓDULO 1: Registrar manualmente un repuesto utilizado (descuenta stock físico si existe, NO impacta en contabilidad)
   */
  async registrarRepuestoUsado(
    uso: Omit<RepuestoUsado, 'id'>
  ): Promise<{ success: boolean; item: RepuestoUsado; error?: string }> {
    try {
      const id = 'USO-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
      const nuevoUso: RepuestoUsado = { ...uso, id };

      // 1. Guardar en lista de consumos/rotación local
      const savedUsados = localStorage.getItem('taller_repuestos_usados_v1');
      const listaUsados: RepuestoUsado[] = savedUsados ? JSON.parse(savedUsados) : [];
      listaUsados.unshift(nuevoUso);
      localStorage.setItem('taller_repuestos_usados_v1', JSON.stringify(listaUsados));

      // 2. Descontar del inventario físico si existe stock y sumar a rotación
      const savedStock = localStorage.getItem('taller_stock_v1');
      const listStock: ItemStock[] = savedStock ? JSON.parse(savedStock) : [];
      const cant = Number(uso.cantidad) || 1;
      const nomNorm = uso.repuestoNombre.trim().toUpperCase();

      let stockItem = listStock.find(
        (x) =>
          x.nombre.trim().toUpperCase() === nomNorm ||
          nomNorm.includes(x.nombre.trim().toUpperCase()) ||
          x.nombre.trim().toUpperCase().includes(nomNorm)
      );

      if (stockItem) {
        if (stockItem.stockActual > 0) {
          stockItem.stockActual = Math.max(0, stockItem.stockActual - cant);
        }
        stockItem.totalInstalados = (Number(stockItem.totalInstalados) || 0) + cant;
        stockItem.ultimoMovimiento = uso.fecha;
      } else {
        // Si no existía en el inventario, agregarlo con stock actual 0
        const nuevoItem: ItemStock = {
          id: 'STOCK-' + Date.now(),
          nombre: uso.repuestoNombre.trim().toUpperCase(),
          categoria: 'Tren Delantero / Suspensión',
          vehiculoCompatibilidad: uso.vehiculo || 'Multimarca',
          stockActual: 0,
          stockMinimo: 2,
          costoUnitario: 0,
          precioVenta: 0,
          totalInstalados: cant,
          ultimoMovimiento: uso.fecha,
        };
        listStock.push(nuevoItem);
      }
      localStorage.setItem('taller_stock_v1', JSON.stringify(listStock));

      // 3. Notificar en vivo a toda la app
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

      // 4. Guardar en Google Sheets (hoja Repuestos_Utilizados y actualizar hoja Stock)
      try {
        await callGasApi({ accion: 'registrarRepuestoUsado', uso: nuevoUso });
      } catch (sheetErr) {
        console.warn('Guardado en caché local, se sincronizará al conectar con Google Sheets:', sheetErr);
      }

      return { success: true, item: nuevoUso };
    } catch (err: any) {
      console.error('Error al registrar repuesto usado:', err);
      return { success: false, item: { ...uso, id: '' }, error: err.message };
    }
  },

  /**
   * MÓDULO 1: Eliminar o anular un registro de repuesto usado (restituye el stock físico)
   */
  async eliminarRepuestoUsado(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const savedUsados = localStorage.getItem('taller_repuestos_usados_v1');
      if (!savedUsados) return { success: true };
      const listaUsados: RepuestoUsado[] = JSON.parse(savedUsados);
      const target = listaUsados.find((x) => x.id === id);

      if (target) {
        // Restituir cantidad al stock físico
        const savedStock = localStorage.getItem('taller_stock_v1');
        if (savedStock) {
          const listStock: ItemStock[] = JSON.parse(savedStock);
          const nomNorm = target.repuestoNombre.trim().toUpperCase();
          const stockItem = listStock.find(
            (x) =>
              x.nombre.trim().toUpperCase() === nomNorm ||
              nomNorm.includes(x.nombre.trim().toUpperCase()) ||
              x.nombre.trim().toUpperCase().includes(nomNorm)
          );
          if (stockItem) {
            stockItem.stockActual = (Number(stockItem.stockActual) || 0) + (Number(target.cantidad) || 1);
            stockItem.totalInstalados = Math.max(0, (Number(stockItem.totalInstalados) || 0) - (Number(target.cantidad) || 1));
            localStorage.setItem('taller_stock_v1', JSON.stringify(listStock));
          }
        }

        const filtered = listaUsados.filter((x) => x.id !== id);
        localStorage.setItem('taller_repuestos_usados_v1', JSON.stringify(filtered));
      }

      // Sincronizar borrado con Google Sheets
      try {
        await callGasApi({ accion: 'eliminarRepuestoUsado', id });
      } catch {}

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

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * MÓDULO 2: Obtener historial de compras de repuestos realizadas para el taller
   */
  async getComprasRepuestos(): Promise<{ success: boolean; items: CompraRepuesto[] }> {
    try {
      const res = await callGasApi({ accion: 'obtenerComprasRepuestos' });
      if (res && res.resultado === 'ok' && Array.isArray(res.items)) {
        localStorage.setItem('taller_compras_repuestos_v1', JSON.stringify(res.items));
        return { success: true, items: res.items };
      }
    } catch (e) {
      console.warn('Conexión con Google Sheets para compras no disponible, leyendo caché local:', e);
    }

    try {
      const saved = localStorage.getItem('taller_compras_repuestos_v1');
      const list: CompraRepuesto[] = saved ? JSON.parse(saved) : [];
      return { success: true, items: list };
    } catch (e) {
      console.warn('Error al obtener compras de repuestos:', e);
      return { success: true, items: [] };
    }
  },

  /**
   * MÓDULO 2: Registrar compra de repuestos (hoja Compras_Repuestos, suma unidades al stock, e IMPACTA EN CONTABILIDAD)
   */
  async registrarCompraRepuesto(
    compra: Omit<CompraRepuesto, 'id'>
  ): Promise<{ success: boolean; item: CompraRepuesto; error?: string }> {
    try {
      const id = 'COMPRA-' + Date.now();
      const nuevaCompra: CompraRepuesto = { ...compra, id };

      // 1. Guardar en historial de compras de repuestos local
      const savedCompras = localStorage.getItem('taller_compras_repuestos_v1');
      const listaCompras: CompraRepuesto[] = savedCompras ? JSON.parse(savedCompras) : [];
      listaCompras.unshift(nuevaCompra);
      localStorage.setItem('taller_compras_repuestos_v1', JSON.stringify(listaCompras));

      // 2. Sumar unidades al inventario físico de repuestos local
      const savedStock = localStorage.getItem('taller_stock_v1');
      const listStock: ItemStock[] = savedStock ? JSON.parse(savedStock) : [];
      const nomNorm = compra.repuestoNombre.trim().toUpperCase();

      let stockItem = listStock.find(
        (x) =>
          x.nombre.trim().toUpperCase() === nomNorm ||
          nomNorm.includes(x.nombre.trim().toUpperCase()) ||
          x.nombre.trim().toUpperCase().includes(nomNorm)
      );

      if (stockItem) {
        stockItem.stockActual = (Number(stockItem.stockActual) || 0) + Number(compra.cantidad);
        if (compra.costoUnitario > 0) {
          stockItem.costoUnitario = compra.costoUnitario;
        }
        stockItem.ultimoMovimiento = compra.fecha;
      } else {
        // Dar de alta nuevo ítem en inventario
        const nuevoItem: ItemStock = {
          id: 'STOCK-' + Date.now(),
          nombre: compra.repuestoNombre.trim().toUpperCase(),
          categoria: compra.categoria || 'Tren Delantero / Suspensión',
          vehiculoCompatibilidad: compra.vehiculoCompatibilidad || 'Multimarca',
          stockActual: Number(compra.cantidad),
          stockMinimo: 2,
          costoUnitario: compra.costoUnitario || (compra.cantidad > 0 ? Math.round(compra.costoTotal / compra.cantidad) : 0),
          precioVenta: compra.costoUnitario ? Math.round(compra.costoUnitario * 1.4) : 0,
          totalInstalados: 0,
          ultimoMovimiento: compra.fecha,
        };
        listStock.push(nuevoItem);
      }
      localStorage.setItem('taller_stock_v1', JSON.stringify(listStock));

      // 3. IMPACTAR EN CONTABILIDAD COMO GASTO NEGATIVO (REGISTRO ÚNICO Y CENTRALIZADO)
      if (compra.impactaContabilidad && compra.costoTotal > 0) {
        const provTxt = compra.proveedor ? ` (${compra.proveedor})` : '';
        const movGasto = {
          id: `MOV-${id}`,
          fecha: compra.fecha ? normalizarFechaArgentina(compra.fecha) : getFechaHoyArgentina(),
          tipo: 'gasto' as const,
          concepto: `Compra Repuestos: ${compra.cantidad}x ${compra.repuestoNombre}${provTxt}`,
          categoria: 'Repuestos / Repuesteros',
          monto: Number(compra.costoTotal),
          metodoPago: compra.metodoPago || 'Efectivo',
          referencia: compra.comprobante ? `COMPROBANTE ${compra.comprobante}` : 'COMPRA STOCK TALLER',
        };
        await gasApi.addAccountingMovement(movGasto);
      }

      // 4. Notificar a toda la interfaz
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

      // 5. Guardar en Google Sheets (hoja Compras_Repuestos y actualizar hoja Stock)
      // NOTA: Pasamos impactaContabilidad: false en la llamada de registrarCompraRepuesto porque
      // el movimiento contable ya fue enviado a Google Sheets de manera unificada mediante
      // addAccountingMovement (acción 'registrarMovimientoContable'). Esto evita duplicar o triplicar el gasto.
      try {
        await callGasApi({
          accion: 'registrarCompraRepuesto',
          compra: { ...nuevaCompra, impactaContabilidad: false, yaImpactoContabilidad: true },
        });
      } catch (sheetErr) {
        console.warn('Guardado en caché local, se sincronizará al conectar con Google Sheets:', sheetErr);
      }

      return { success: true, item: nuevaCompra };
    } catch (err: any) {
      console.error('Error al registrar compra de repuestos:', err);
      return { success: false, item: { ...compra, id: '' }, error: err.message };
    }
  },

  /**
   * MÓDULO 2: Eliminar registro de compra de repuestos
   */
  async eliminarCompraRepuesto(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_compras_repuestos_v1');
      const list: CompraRepuesto[] = saved ? JSON.parse(saved) : [];
      const updated = list.filter((x) => x.id !== id);
      localStorage.setItem('taller_compras_repuestos_v1', JSON.stringify(updated));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({ accion: 'eliminarCompraRepuesto', id });
    } catch (e: any) {
      return { success: true };
    }
  },
};

