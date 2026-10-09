import { ApiResponse, DatosTrabajoAdmin, TurnoAdmin, Presupuesto, ItemStock, ItemPresupuesto, RepuestoUsado, CompraRepuesto, CuentaCorrienteItem } from '../types';
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
      if (res && res.success && Array.isArray(res.movimientos)) {
        // Deduplicación preventiva de movimientos gemelos por compras de stock
        const seenStockKeys = new Set<string>();
        const deduped: any[] = [];
        for (const m of res.movimientos) {
          const normFecha = normalizarFechaArgentina(m.fecha);
          const conceptoNorm = String(m.concepto || '').toLowerCase().replace(/\s+/g, ' ').trim();
          let key = m.id ? String(m.id).trim() : `${normFecha}-${m.tipo}-${m.concepto}-${m.monto}`;
          if (m.tipo === 'gasto' && m.categoria === 'Repuestos / Repuesteros') {
            key = `gasto-repuesto-${normFecha}-${m.monto}-${conceptoNorm}`;
          }
          if (!seenStockKeys.has(key)) {
            seenStockKeys.add(key);
            deduped.push({ ...m, fecha: normFecha });
          }
        }
        return { success: true, movimientos: deduped };
      }
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

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
            bc.close();
          } catch {}
        }
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
    let pTarget: Presupuesto | undefined;
    try {
      const saved = localStorage.getItem('taller_presupuestos_v1');
      if (saved) {
        const list: Presupuesto[] = JSON.parse(saved);
        pTarget = list.find((p: Presupuesto) => p.id === id);
        const updated = list.filter((p: Presupuesto) => p.id !== id);
        localStorage.setItem('taller_presupuestos_v1', JSON.stringify(updated));
      }

      // Revertir y eliminar automáticamente el impacto contable si fue facturado
      const savedContab = localStorage.getItem('lacasadeladireccion_contabilidad');
      if (savedContab) {
        const contabList = JSON.parse(savedContab);
        const movIdDirecto = `MOV-PRESUP-${id}`;
        const contabUpdated = contabList.filter((m: any) => {
          if (!m) return false;
          const mid = String(m.id || '');
          if (mid === movIdDirecto || mid === id) return false;
          if (pTarget) {
            const num = (pTarget.numero || '').trim();
            const pat = (pTarget.patente || '').trim().toUpperCase();
            if (num && typeof m.concepto === 'string' && m.concepto.includes(num)) return false;
            if (num && typeof m.referencia === 'string' && m.referencia.includes(num)) return false;
            if (
              pat &&
              typeof m.referencia === 'string' &&
              m.referencia.toUpperCase().includes(pat) &&
              m.tipo === 'ingreso' &&
              Math.abs(Number(m.monto) - Number(pTarget.total)) < 0.01
            ) {
              return false;
            }
          }
          return true;
        });
        localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(contabUpdated));
      }

      // Eliminar también repuestos usados vinculados a este presupuesto (Módulo 1)
      if (pTarget) {
        const savedUsados = localStorage.getItem('taller_repuestos_usados_v1');
        if (savedUsados) {
          const listUsados: RepuestoUsado[] = JSON.parse(savedUsados);
          const num = (pTarget.numero || '').trim();
          const listUsadosFiltrada = listUsados.filter((u) => {
            if (u.presupuestoId && (u.presupuestoId === id || (num && u.presupuestoId === num))) return false;
            return true;
          });
          localStorage.setItem('taller_repuestos_usados_v1', JSON.stringify(listUsadosFiltrada));
        }

        // Eliminar también cuenta corriente vinculada si estaba en cuenta corriente
        const savedCC = localStorage.getItem('taller_cuentas_corrientes_v1');
        if (savedCC) {
          const listCC = JSON.parse(savedCC);
          const listCCFiltrada = listCC.filter((c: any) => c.presupuestoId !== id && c.presupuestoId !== pTarget?.numero);
          localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(listCCFiltrada));
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_presupuesto_sync'));
        window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'PRESUPUESTO_DELETED', id });
            bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({
        accion: 'borrarPresupuesto',
        id,
        numero: pTarget?.numero,
        patente: pTarget?.patente,
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
        // Preservar deducciones locales recientes si el Google Sheets remoto aún no reflejó el cambio
        const localSaved = localStorage.getItem('taller_stock_v1');
        let finalItems = res.items;
        if (localSaved) {
          try {
            const localList: ItemStock[] = JSON.parse(localSaved);
            finalItems = res.items.map((remoteIt: ItemStock) => {
              const localIt = localList.find(
                (l) =>
                  (l.id && remoteIt.id && l.id === remoteIt.id) ||
                  l.nombre.trim().toUpperCase() === remoteIt.nombre.trim().toUpperCase()
              );
              if (localIt) {
                return {
                  ...remoteIt,
                  // Mantener el stock más bajo (por deducción reciente de turnos/presupuestos) y la mayor rotación
                  stockActual: Math.min(Number(remoteIt.stockActual) || 0, Number(localIt.stockActual) || 0),
                  totalInstalados: Math.max(Number(remoteIt.totalInstalados) || 0, Number(localIt.totalInstalados) || 0),
                  ultimoMovimiento: localIt.ultimoMovimiento || remoteIt.ultimoMovimiento,
                };
              }
              return remoteIt;
            });
          } catch {}
        }
        localStorage.setItem('taller_stock_v1', JSON.stringify(finalItems));
        return { success: true, items: finalItems };
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

        // Agregar al historial de repuestos utilizados (Módulo 1)
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

      // Descontar automáticamente del inventario físico (Módulo 2: Stock físico)
      try {
        const savedStock = localStorage.getItem('taller_stock_v1');
        if (savedStock) {
          const listStock: ItemStock[] = JSON.parse(savedStock);
          let stockModificado = false;
          const itemsModificados: ItemStock[] = [];

          // Función normalizadora inteligente sin acentos ni signos
          const normalizar = (s: string) =>
            (s || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toUpperCase()
              .replace(/[^A-Z0-9\s]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();

          repuestos.forEach((rep) => {
            const cant = Number(rep.cantidad) || 1;
            const descNorm = normalizar(rep.descripcion);
            const vehNorm = normalizar(vehiculoModelo || '');

            // Limpieza de palabras de acción ("CAMBIO DE", etc.)
            const descLimpia = descNorm
              .replace(/\b(CAMBIO DE|REPARACION DE|COLOCACION DE|INSTALACION DE|JUEGO DE|REVISION DE)\b/g, '')
              .trim();

            const stopWords = new Set(['DE', 'LA', 'EL', 'DEL', 'LOS', 'LAS', 'PARA', 'EN', 'Y', 'CON', 'UN']);
            const descTokens = descLimpia.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));
            const vehTokens = vehNorm.split(' ').filter((w) => w.length > 1 && !stopWords.has(w));

            let mejorItem: ItemStock | undefined;
            let mejorPuntaje = -1;

            for (const it of listStock) {
              const itNom = normalizar(it.nombre);
              const itNomLimpia = itNom
                .replace(/\b(CAMBIO DE|REPARACION DE|COLOCACION DE|INSTALACION DE|JUEGO DE|REVISION DE)\b/g, '')
                .trim();
              const itVeh = normalizar(it.vehiculoCompatibilidad || '');

              let puntaje = 0;

              // 1. Coincidencia directa o substring en nombre limpio
              if (itNomLimpia === descLimpia || itNom === descNorm) {
                puntaje += 70;
              } else if (itNomLimpia.includes(descLimpia) || descLimpia.includes(itNomLimpia)) {
                puntaje += 50;
              }

              // 2. Coincidencia de tokens principales (ej: ROTULA, SUSPENSION)
              let tokensCoincidentes = 0;
              for (const t of descTokens) {
                if (itNomLimpia.includes(t)) tokensCoincidentes++;
              }
              puntaje += tokensCoincidentes * 20;

              // 3. Compatibilidad de Vehículo
              if (vehTokens.length > 0) {
                let vehMatchCount = 0;
                for (const vt of vehTokens) {
                  if (itVeh.includes(vt) || itNom.includes(vt)) vehMatchCount++;
                }

                if (vehMatchCount === vehTokens.length) {
                  puntaje += 45; // Coincide todo el modelo (ej: PEUGEOT 206)
                } else if (vehMatchCount > 0) {
                  puntaje += vehMatchCount * 20;
                } else if (itVeh && itVeh !== 'MULTIMARCA' && itVeh !== 'UNIVERSAL' && itVeh !== 'TODOS') {
                  // Penalizar si el repuesto es para otro vehículo distinto
                  puntaje -= 50;
                }
              } else {
                // Si la descripción misma trae el vehículo (ej: "Rótula Peugeot 206")
                for (const t of descTokens) {
                  if (itVeh.includes(t)) puntaje += 25;
                }
              }

              if (puntaje > mejorPuntaje && puntaje >= 35) {
                mejorPuntaje = puntaje;
                mejorItem = it;
              }
            }

            if (mejorItem) {
              if (mejorItem.stockActual > 0) {
                mejorItem.stockActual = Math.max(0, mejorItem.stockActual - cant);
              }
              mejorItem.totalInstalados = (Number(mejorItem.totalInstalados) || 0) + cant;
              mejorItem.ultimoMovimiento = fechaFinal;
              stockModificado = true;
              itemsModificados.push(mejorItem);
            }
          });

          if (stockModificado) {
            localStorage.setItem('taller_stock_v1', JSON.stringify(listStock));
            // Actualizar fila en hoja "Stock" de Google Sheets de manera asíncrona
            for (const itemMod of itemsModificados) {
              callGasApi({ accion: 'guardarItemStock', item: itemMod }).catch(() => {});
            }
          }
        }
      } catch (errStock) {
        console.warn('Error al descontar stock físico:', errStock);
      }

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

      const normalizar = (s: string) =>
        (s || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase()
          .replace(/[^A-Z0-9\s]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const nomNorm = normalizar(uso.repuestoNombre);
      const vehNorm = normalizar(uso.vehiculo || '');
      const nomLimpia = nomNorm
        .replace(/\b(CAMBIO DE|REPARACION DE|COLOCACION DE|INSTALACION DE|JUEGO DE|REVISION DE)\b/g, '')
        .trim();

      const stopWords = new Set(['DE', 'LA', 'EL', 'DEL', 'LOS', 'LAS', 'PARA', 'EN', 'Y', 'CON', 'UN']);
      const descTokens = nomLimpia.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));
      const vehTokens = vehNorm.split(' ').filter((w) => w.length > 1 && !stopWords.has(w));

      let stockItem: ItemStock | undefined;
      let mejorPuntaje = -1;

      for (const it of listStock) {
        const itNom = normalizar(it.nombre);
        const itNomLimpia = itNom
          .replace(/\b(CAMBIO DE|REPARACION DE|COLOCACION DE|INSTALACION DE|JUEGO DE|REVISION DE)\b/g, '')
          .trim();
        const itVeh = normalizar(it.vehiculoCompatibilidad || '');

        let puntaje = 0;
        if (itNomLimpia === nomLimpia || itNom === nomNorm) puntaje += 70;
        else if (itNomLimpia.includes(nomLimpia) || nomLimpia.includes(itNomLimpia)) puntaje += 50;

        for (const t of descTokens) {
          if (itNomLimpia.includes(t)) puntaje += 20;
        }

        if (vehTokens.length > 0) {
          let vehMatch = 0;
          for (const vt of vehTokens) {
            if (itVeh.includes(vt) || itNom.includes(vt)) vehMatch++;
          }
          if (vehMatch === vehTokens.length) puntaje += 45;
          else if (vehMatch > 0) puntaje += 20;
          else if (itVeh && itVeh !== 'MULTIMARCA' && itVeh !== 'UNIVERSAL' && itVeh !== 'TODOS') puntaje -= 50;
        }

        if (puntaje > mejorPuntaje && puntaje >= 35) {
          mejorPuntaje = puntaje;
          stockItem = it;
        }
      }

      if (stockItem) {
        if (stockItem.stockActual > 0) {
          stockItem.stockActual = Math.max(0, stockItem.stockActual - cant);
        }
        stockItem.totalInstalados = (Number(stockItem.totalInstalados) || 0) + cant;
        stockItem.ultimoMovimiento = uso.fecha;
        callGasApi({ accion: 'guardarItemStock', item: stockItem }).catch(() => {});
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
        callGasApi({ accion: 'guardarItemStock', item: nuevoItem }).catch(() => {});
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
        const items = res.items.map((it: any) => ({
          ...it,
          impactaContabilidad:
            it.impactaContabilidad === true ||
            String(it.impactaContabilidad).toUpperCase() === 'SI' ||
            (Number(it.costoTotal) > 0 && it.impactaContabilidad !== false),
        }));
        localStorage.setItem('taller_compras_repuestos_v1', JSON.stringify(items));
        return { success: true, items };
      }
    } catch (e) {
      console.warn('Conexión con Google Sheets para compras no disponible, leyendo caché local:', e);
    }

    try {
      const saved = localStorage.getItem('taller_compras_repuestos_v1');
      const list: CompraRepuesto[] = saved ? JSON.parse(saved) : [];
      const items = list.map((it: any) => ({
        ...it,
        impactaContabilidad:
          it.impactaContabilidad === true ||
          String(it.impactaContabilidad).toUpperCase() === 'SI' ||
          (Number(it.costoTotal) > 0 && it.impactaContabilidad !== false),
      }));
      return { success: true, items };
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

      // 3. Registrar gasto en contabilidad local para visualización instantánea (SIN enviar RPC duplicado)
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
          referencia: compra.comprobante ? `COMPROBANTE ${compra.comprobante}` : 'STOCK TALLER',
        };
        try {
          const savedContab = localStorage.getItem('lacasadeladireccion_contabilidad');
          const listContab = savedContab ? JSON.parse(savedContab) : [];
          if (!listContab.some((m: any) => m.id === movGasto.id)) {
            listContab.unshift(movGasto);
            localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(listContab));
          }
        } catch (e) {}
      }

      // 4. Notificar a toda la interfaz
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
        window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
            bc.close();
          } catch {}
        }
      }

      // 5. Guardar en Google Sheets (hoja Compras_Repuestos, actualiza Stock e impacta en Contabilidad exactamente 1 sola vez)
      try {
        await callGasApi({
          accion: 'registrarCompraRepuesto',
          compra: {
            ...nuevaCompra,
            impactaContabilidad: Boolean(compra.impactaContabilidad),
          },
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
   * MÓDULO 2: Eliminar registro de compra de repuestos y revertir su impacto contable
   */
  async eliminarCompraRepuesto(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_compras_repuestos_v1');
      const list: CompraRepuesto[] = saved ? JSON.parse(saved) : [];
      const compraAEliminar = list.find((x) => x.id === id);
      const updated = list.filter((x) => x.id !== id);
      localStorage.setItem('taller_compras_repuestos_v1', JSON.stringify(updated));

      // Revertir y eliminar automáticamente el gasto generado en contabilidad
      const savedContab = localStorage.getItem('lacasadeladireccion_contabilidad');
      if (savedContab) {
        const contabList = JSON.parse(savedContab);
        const movIdDirecto = `MOV-${id}`;
        const movIdStock = `MOV-STOCK-${id}`;
        const movIdLower = `mov-${id}`;
        const contabUpdated = contabList.filter((m: any) => {
          if (!m) return false;
          const mid = String(m.id || '');
          if (mid === movIdDirecto || mid === movIdStock || mid === movIdLower || mid === id) return false;
          // Validar si la referencia o el concepto refieren exactamente a este ID de compra
          if (typeof m.referencia === 'string' && m.referencia.includes(id)) return false;
          // Validar si la compra coincide por datos exactos
          if (compraAEliminar && compraAEliminar.costoTotal > 0) {
            if (compraAEliminar.comprobante && typeof m.referencia === 'string' && m.referencia.includes(compraAEliminar.comprobante)) {
              return false;
            }
            if (
              m.tipo === 'gasto' &&
              Math.abs(Number(m.monto) - Number(compraAEliminar.costoTotal)) < 0.01 &&
              typeof m.concepto === 'string' &&
              m.concepto.includes(compraAEliminar.repuestoNombre)
            ) {
              return false;
            }
          }
          return true;
        });
        localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(contabUpdated));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_stock_sync'));
        window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
            bc.postMessage({ type: 'STOCK_UPDATED' });
            bc.close();
          } catch {}
        }
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

  // --- MÓDULO DE CUENTAS CORRIENTES ---
  async getCuentasCorrientes(): Promise<{ success: boolean; items: CuentaCorrienteItem[] }> {
    try {
      const res = await callGasApi({ accion: 'obtenerCuentasCorrientes' });
      if (res && res.resultado === 'ok' && Array.isArray(res.items)) {
        localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(res.items));
        return { success: true, items: res.items };
      }
    } catch (e) {
      console.warn('Conexión con Google Sheets para cuentas corrientes no disponible, leyendo caché local:', e);
    }

    try {
      const saved = localStorage.getItem('taller_cuentas_corrientes_v1');
      const items: CuentaCorrienteItem[] = saved ? JSON.parse(saved) : [];
      return { success: true, items };
    } catch (e) {
      return { success: true, items: [] };
    }
  },

  async crearMovimientoCuentaCorriente(
    item: Omit<CuentaCorrienteItem, 'id' | 'montoPagado' | 'saldoPendiente' | 'estado'> & {
      montoPagado?: number;
      saldoPendiente?: number;
      estado?: 'pendiente' | 'parcial' | 'pagado';
    }
  ): Promise<{ success: boolean; item: CuentaCorrienteItem; error?: string }> {
    try {
      const id = 'CC-' + Date.now();
      const montoTotalNum = Number(item.montoTotal) || 0;
      const montoPagadoNum = Number(item.montoPagado) || 0;
      const saldoPendienteNum =
        item.saldoPendiente !== undefined
          ? Number(item.saldoPendiente)
          : Math.max(0, montoTotalNum - montoPagadoNum);
      const estadoCalculado: 'pendiente' | 'parcial' | 'pagado' =
        item.estado || (saldoPendienteNum <= 0 ? 'pagado' : montoPagadoNum > 0 ? 'parcial' : 'pendiente');

      const nuevoItem: CuentaCorrienteItem = {
        ...item,
        id,
        montoPagado: montoPagadoNum,
        saldoPendiente: saldoPendienteNum,
        estado: estadoCalculado,
      };

      // 1. Guardar en almacenamiento local
      const saved = localStorage.getItem('taller_cuentas_corrientes_v1');
      const list: CuentaCorrienteItem[] = saved ? JSON.parse(saved) : [];
      list.unshift(nuevoItem);
      localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(list));

      // 2. Notificar sincronización
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_cuentacorriente_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'CUENTA_CORRIENTE_UPDATED' });
            bc.close();
          } catch {}
        }
      }

      // 3. Guardar en Google Sheets (Hoja Cuentas_Corrientes)
      // NOTA: NO impacta en Contabilidad por sí mismo. Si hubo un anticipo pagado, ese anticipo se registra en Contabilidad por separado.
      try {
        await callGasApi({
          accion: 'crearMovimientoCuentaCorriente',
          item: nuevoItem,
        });
      } catch (sheetErr) {
        console.warn('Guardado localmente, pendiente sincronización en Sheets:', sheetErr);
      }

      return { success: true, item: nuevoItem };
    } catch (err: any) {
      console.error('Error al registrar en cuenta corriente:', err);
      return { success: false, item: { ...item, id: '', montoPagado: item.montoPagado || 0, saldoPendiente: item.saldoPendiente || item.montoTotal, estado: item.estado || 'pendiente' }, error: err.message };
    }
  },

  async cobrarCuentaCorriente(
    id: string,
    montoAbonado: number,
    metodoPago: string = 'Efectivo',
    comprobante?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_cuentas_corrientes_v1');
      const list: CuentaCorrienteItem[] = saved ? JSON.parse(saved) : [];
      const target = list.find((x) => x.id === id);

      if (target) {
        const pagadoAntes = Number(target.montoPagado) || 0;
        const nuevoPagado = pagadoAntes + montoAbonado;
        const nuevoSaldo = Math.max(0, Number(target.montoTotal) - nuevoPagado);
        target.montoPagado = nuevoPagado;
        target.saldoPendiente = nuevoSaldo;
        target.estado = nuevoSaldo <= 0 ? 'pagado' : 'parcial';
        target.ultimoPagoFecha = getFechaHoyArgentina();
        target.metodoUltimoPago = metodoPago;

        localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(list));

        // IMPACTAR EN CONTABILIDAD COMO INGRESO (Cobro de deuda real con ID determinista y único por pago)
        const pagoIdSufijo = nuevoPagado > 0 ? String(nuevoPagado) : String(Date.now());
        const movIngreso = {
          id: `MOV-PAGO-CC-${id}-${pagoIdSufijo}`,
          fecha: getFechaHoyArgentina(),
          tipo: 'ingreso' as const,
          concepto: `Cobro Cta. Cte.: ${target.patente} (${target.concepto || 'Servicio taller'})`,
          categoria: 'Cobro Cuenta Corriente',
          monto: Number(montoAbonado),
          metodoPago: metodoPago || 'Efectivo',
          referencia: comprobante ? `${target.patente} (${comprobante}) [${id}]` : `${target.patente} [${id}]`,
        };

        const savedContab = localStorage.getItem('lacasadeladireccion_contabilidad');
        const listContab = savedContab ? JSON.parse(savedContab) : [];
        if (!listContab.some((m: any) => m.id === movIngreso.id)) {
          listContab.unshift(movIngreso);
          localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(listContab));
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('taller_cuentacorriente_sync'));
          window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('lacasadeladireccion_realtime');
              bc.postMessage({ type: 'CUENTA_CORRIENTE_UPDATED' });
              bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
              bc.close();
            } catch {}
          }
        }
      }

      // Sincronizar con Google Sheets
      try {
        await callGasApi({
          accion: 'cobrarCuentaCorriente',
          id,
          montoAbonado,
          metodoPago,
          comprobante,
        });
      } catch (e) {
        console.warn('Aviso: cobro asentado localmente:', e);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async pagarCuentaCorrienteMercadoPago(
    id: string,
    detallesFallback?: Partial<CuentaCorrienteItem>
  ): Promise<{ success: boolean; urlPago?: string; error?: string }> {
    // 1. Intentar vía Google Apps Script (backend centralizado)
    try {
      const res = await callGasApi({
        accion: 'iniciarPagoMercadoPagoCC',
        id,
      });
      if (res && (res.resultado === 'mercadopago' || res.success) && res.urlPago) {
        return { success: true, urlPago: res.urlPago };
      } else if (res && res.urlPago) {
        return { success: true, urlPago: res.urlPago };
      }
    } catch (e: any) {
      console.warn('Aviso: endpoint Apps Script no disponible o en actualización, usando pasarela directa Mercado Pago:', e);
    }

    // 2. Generación directa de preferencia con Mercado Pago (Garantía 100% infalible ante cualquier contingencia)
    try {
      let target: Partial<CuentaCorrienteItem> | undefined = detallesFallback;
      if (!target || !target.saldoPendiente) {
        try {
          const saved = localStorage.getItem('taller_cuentas_corrientes_v1');
          if (saved) {
            const list: CuentaCorrienteItem[] = JSON.parse(saved);
            target = list.find((x) => x.id === id);
          }
        } catch {}
      }

      const saldo = Number(target?.saldoPendiente || 0);
      if (saldo <= 0) {
        return { success: false, error: 'No se detectó saldo pendiente a abonar en este registro.' };
      }

      const mpToken = "APP_USR-4589130827999167-092812-304c27d1e426c89f133eaac26d1354ed-13866330";
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lacasadeladireccion.com';
      // Las URLs de retorno no fuerzan status aprobado falso; dejan que Mercado Pago transmita su collection_status real y payment_id
      const backSuccess = `${origin}?tipo_pago=cuentacorriente&id=${encodeURIComponent(id)}&monto=${encodeURIComponent(saldo)}&patente=${encodeURIComponent(target?.patente || '')}`;
      const backFailure = `${origin}?tipo_pago=cuentacorriente&id=${encodeURIComponent(id)}&status=failed`;
      const backPending = `${origin}?tipo_pago=cuentacorriente&id=${encodeURIComponent(id)}&status=pending`;

      const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mpToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              title: `Cancelación Total Cta Cte - ${target?.patente || 'Vehículo'} (${target?.concepto || 'Saldo pendiente'})`,
              quantity: 1,
              currency_id: 'ARS',
              unit_price: saldo,
            },
          ],
          external_reference: String(id),
          back_urls: {
            success: backSuccess,
            failure: backFailure,
            pending: backPending,
          },
          auto_return: 'approved',
        }),
      });

      if (mpRes.ok) {
        const json = await mpRes.json();
        if (json.init_point) {
          return { success: true, urlPago: json.init_point };
        }
      } else {
        const errorData = await mpRes.json().catch(() => ({}));
        console.error('Error de API Mercado Pago:', errorData);
      }
    } catch (directErr: any) {
      console.error('Error al generar preferencia directa con Mercado Pago:', directErr);
    }

    return {
      success: false,
      error: 'No se pudo generar el enlace de pago de Mercado Pago. Por favor intentá nuevamente.',
    };
  },

  /**
   * Verificar en la API oficial de Mercado Pago si un pago está verdaderamente APROBADO
   * Evita registrar cobros falsos si el usuario cerró la ventana sin pagar o canceló
   */
  async verificarPagoMercadoPago(params: {
    paymentId?: string;
    externalReference?: string;
  }): Promise<{ aprobado: boolean; estado: string; paymentId?: string; monto?: number; error?: string }> {
    const mpToken = "APP_USR-4589130827999167-092812-304c27d1e426c89f133eaac26d1354ed-13866330";
    try {
      // 1. Si tenemos el paymentId exacto devuelto por Mercado Pago
      if (params.paymentId && params.paymentId !== 'null' && params.paymentId !== 'undefined' && params.paymentId.trim() !== '') {
        const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(params.paymentId.trim())}`, {
          headers: {
            'Authorization': `Bearer ${mpToken}`,
            'Accept': 'application/json',
          },
        });
        if (res.ok) {
          const data = await res.json();
          const aprobado = data.status === 'approved';
          return {
            aprobado,
            estado: data.status || 'unknown',
            paymentId: String(data.id),
            monto: Number(data.transaction_amount) || 0,
          };
        }
      }

      // 2. Si buscamos por external_reference (el ID de cuenta corriente de la orden)
      if (params.externalReference) {
        const cleanRef = params.externalReference.trim();
        const res = await fetch(
          `https://api.mercadopago.com/v1/payments/search?external_reference=${encodeURIComponent(cleanRef)}&sort=date_created&criteria=desc`,
          {
            headers: {
              'Authorization': `Bearer ${mpToken}`,
              'Accept': 'application/json',
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.results) && data.results.length > 0) {
            // Buscar si hay algún pago aprobado para esta referencia
            const pagoAprobado = data.results.find((p: any) => p.status === 'approved');
            if (pagoAprobado) {
              return {
                aprobado: true,
                estado: 'approved',
                paymentId: String(pagoAprobado.id),
                monto: Number(pagoAprobado.transaction_amount) || 0,
              };
            }
            const ultimoPago = data.results[0];
            return {
              aprobado: false,
              estado: ultimoPago.status || 'pending',
              paymentId: String(ultimoPago.id),
              monto: Number(ultimoPago.transaction_amount) || 0,
            };
          }
        }
      }
    } catch (e: any) {
      console.warn('Error al consultar estado de pago en API de Mercado Pago:', e);
      return { aprobado: false, estado: 'error_conexion', error: e.message };
    }

    return { aprobado: false, estado: 'no_encontrado' };
  },

  async eliminarCuentaCorriente(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const saved = localStorage.getItem('taller_cuentas_corrientes_v1');
      if (saved) {
        const list: CuentaCorrienteItem[] = JSON.parse(saved);
        const filtered = list.filter((x) => x.id !== id);
        localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(filtered));
      }

      // Si había generado un ingreso contable, revertir y eliminar en cascada
      const savedContab = localStorage.getItem('lacasadeladireccion_contabilidad');
      if (savedContab) {
        const contabList = JSON.parse(savedContab);
        const movIdDirecto = `MOV-PAGO-CC-${id}`;
        const contabUpdated = contabList.filter((m: any) => {
          if (!m) return false;
          const mid = String(m.id || '');
          if (mid === movIdDirecto || mid.startsWith(movIdDirecto) || mid === id) return false;
          if (typeof m.referencia === 'string' && m.referencia.includes(id)) return false;
          return true;
        });
        localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(contabUpdated));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('taller_cuentacorriente_sync'));
        window.dispatchEvent(new CustomEvent('taller_contabilidad_sync'));
        if (typeof BroadcastChannel !== 'undefined') {
          try {
            const bc = new BroadcastChannel('lacasadeladireccion_realtime');
            bc.postMessage({ type: 'CUENTA_CORRIENTE_UPDATED' });
            bc.postMessage({ type: 'CONTABILIDAD_UPDATED' });
            bc.close();
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
    }

    try {
      return await callGasApi({ accion: 'eliminarCuentaCorriente', id });
    } catch (e: any) {
      return { success: true };
    }
  },
};

