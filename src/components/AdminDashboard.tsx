import { useState, useEffect, useId, useTransition, useRef } from 'react';
import { TurnoAdmin, DatosTrabajoAdmin, MovimientoContable, Presupuesto, ItemStock, ItemPresupuesto } from '../types';
import { gasApi } from '../services/gasApi';
import { WORKSHOP_ITEMS, GASTOS_PREDEFINIDOS } from '../constants/workshopItems';
import { PresupuestosManager } from './PresupuestosManager';
import { StockManager } from './StockManager';
import { CuentasCorrientesManager } from './CuentasCorrientesManager';
import { formatearFechaArgentina, formatearHorario, getFechaHoyArgentina, normalizarFechaArgentina } from '../utils/dateFormatter';
import {
  ShieldAlert,
  Search,
  RefreshCw,
  Wrench,
  X,
  Loader2,
  Calendar,
  Clock,
  Car,
  Mail,
  CheckCircle2,
  ArrowLeft,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  MinusCircle,
  FileSpreadsheet,
  Trash2,
  Receipt,
  Copy,
  Check,
  FileText,
  Package,
  Ban,
  AlertTriangle,
  CreditCard
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToHome: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

const getTurnosAtendidosSet = (): Set<string> => {
  try {
    const saved = localStorage.getItem('taller_turnos_atendidos_v1');
    if (saved) {
      const list: string[] = JSON.parse(saved);
      return new Set(list.map((p) => p.toUpperCase().trim()));
    }
  } catch {}
  return new Set();
};

const getTurnosCanceladosSet = (): Set<string> => {
  try {
    const saved = localStorage.getItem('taller_turnos_cancelados_v1');
    if (saved) {
      const list: string[] = JSON.parse(saved);
      return new Set(list.map((p) => p.toUpperCase().trim()));
    }
  } catch {}
  return new Set();
};

const marcarTurnoAtendidoLocal = (patente: string) => {
  try {
    const clean = patente.toUpperCase().trim();
    if (!clean) return;
    const current = getTurnosAtendidosSet();
    current.add(clean);
    localStorage.setItem('taller_turnos_atendidos_v1', JSON.stringify(Array.from(current)));
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.postMessage({ type: 'TURNO_ATENDIDO', patente: clean });
        bc.close();
      } catch {}
    }
  } catch {}
};

const marcarTurnoCanceladoLocal = (patente: string, fecha?: string) => {
  try {
    const clean = patente.toUpperCase().trim();
    if (!clean) return;
    const current = getTurnosCanceladosSet();
    const key = fecha ? `${clean}_${normalizarFechaArgentina(fecha)}` : clean;
    current.add(key);
    localStorage.setItem('taller_turnos_cancelados_v1', JSON.stringify(Array.from(current)));
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.postMessage({ type: 'TURNO_CANCELADO', patente: clean, fecha: fecha ? normalizarFechaArgentina(fecha) : undefined });
        bc.close();
      } catch {}
    }
  } catch {}
};

const removerTurnoCanceladoLocal = (patente: string, fecha?: string) => {
  try {
    const clean = patente.toUpperCase().trim();
    if (!clean) return;
    const current = getTurnosCanceladosSet();
    const fechaNorm = fecha ? normalizarFechaArgentina(fecha) : '';
    let changed = false;

    current.forEach((item) => {
      if (item === clean || (fechaNorm && item === `${clean}_${fechaNorm}`) || (!fecha && item.startsWith(`${clean}_`))) {
        current.delete(item);
        changed = true;
      }
    });

    if (changed) {
      localStorage.setItem('taller_turnos_cancelados_v1', JSON.stringify(Array.from(current)));
    }

    const atendidos = getTurnosAtendidosSet();
    let changedAtendidos = false;
    atendidos.forEach((item) => {
      if (item === clean || (fechaNorm && item === `${clean}_${fechaNorm}`) || (!fecha && item.startsWith(`${clean}_`))) {
        atendidos.delete(item);
        changedAtendidos = true;
      }
    });
    if (changedAtendidos) {
      localStorage.setItem('taller_turnos_atendidos_v1', JSON.stringify(Array.from(atendidos)));
    }

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.postMessage({ type: 'TURNO_REPROGRAMADO', patente: clean });
        bc.close();
      } catch {}
    }
  } catch {}
};

const filtrarTurnosPendientes = (listaTurnos: TurnoAdmin[], listaPresupuestos: Presupuesto[]) => {
  const atendidosSet = getTurnosAtendidosSet();
  const canceladosSet = getTurnosCanceladosSet();
  const patentesFacturadas = new Set(
    listaPresupuestos
      .filter((p) => p.estado === 'facturado')
      .map((p) => (p.patente || '').toUpperCase().trim())
  );
  const hoyStr = getFechaHoyArgentina();

  return listaTurnos.filter((t) => {
    const cleanPat = (t.patente || '').toUpperCase().trim();
    if (!cleanPat) return false;
    const fechaNorm = normalizarFechaArgentina(t.fecha);
    const keyConFecha = `${cleanPat}_${fechaNorm}`;

    // Si viene explícitamente como cancelado o atendido desde la planilla
    if (t.estado && ['atendido', 'cancelado'].includes(String(t.estado).toLowerCase().trim())) {
      return false;
    }

    // Si fue cancelado este turno específico de esta fecha
    if (canceladosSet.has(keyConFecha)) {
      return false;
    }

    // Si fue atendido este turno específico de esta fecha
    if (atendidosSet.has(keyConFecha)) {
      return false;
    }

    // Si la patente figuraba como cancelada globalmente pero este turno es para hoy o el futuro,
    // NO se filtra: es una reprogramación válida y debe verse.
    if (canceladosSet.has(cleanPat) && fechaNorm < hoyStr) {
      return false;
    }

    // Si el vehículo fue facturado en el pasado pero ahora tiene un turno nuevo programado para hoy o el futuro,
    // el turno nuevo DEBE verse
    if (patentesFacturadas.has(cleanPat) && fechaNorm < hoyStr) {
      return false;
    }

    return true;
  });
};

export const AdminDashboard = ({ onBackToHome, onShowToast }: AdminDashboardProps) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'turnos' | 'presupuestos' | 'stock' | 'contabilidad' | 'cuentas_corrientes' | 'script'>('turnos');
  const [turnoParaPresupuesto, setTurnoParaPresupuesto] = useState<TurnoAdmin | null>(null);
  const [, startTransition] = useTransition();

  // --- Turnos state ---
  const [turnos, setTurnos] = useState<TurnoAdmin[]>([]);
  const [loadingTurnos, setLoadingTurnos] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected turno modal & multi-select services
  const [selectedTurno, setSelectedTurno] = useState<TurnoAdmin | null>(null);
  const [kilometraje, setKilometraje] = useState('');
  const [selectedServicios, setSelectedServicios] = useState<string[]>([]);
  const [notasTrabajoAdicional, setNotasTrabajoAdicional] = useState('');
  const [montoCobrado, setMontoCobrado] = useState('');
  const [autoRegistrarContabilidad, setAutoRegistrarContabilidad] = useState(true);
  const [metodoPagoReparacion, setMetodoPagoReparacion] = useState('Efectivo');
  const [savingWork, setSavingWork] = useState(false);

  // --- Stock & Rotación de Repuestos state ---
  const [stockList, setStockList] = useState<ItemStock[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // --- Contabilidad state ---
  const [movimientos, setMovimientos] = useState<MovimientoContable[]>([]);
  const [loadingContabilidad, setLoadingContabilidad] = useState(false);
  const [filtroPeriodo, setFiltroPeriodo] = useState<'todos' | 'mes' | 'semana' | 'hoy' | 'dia'>('mes');
  const [fechaPersonalizada, setFechaPersonalizada] = useState<string>('');
  const datePickerRef = useRef<HTMLInputElement>(null);
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos');
  const [filtroBusquedaContable, setFiltroBusquedaContable] = useState('');

  // New movement modal state
  const [showModalMovimiento, setShowModalMovimiento] = useState(false);
  const [nuevoTipo, setNuevoTipo] = useState<'ingreso' | 'gasto'>('ingreso');
  const [nuevaFecha, setNuevaFecha] = useState(getFechaHoyArgentina);
  const [itemPredefinidoSeleccionado, setItemPredefinidoSeleccionado] = useState('');
  const [nuevoConcepto, setNuevoConcepto] = useState('');
  const [nuevaCategoria, setNuevaCategoria] = useState('Mano de Obra / Taller');
  const [nuevoMonto, setNuevoMonto] = useState('');
  const [nuevoMetodoPago, setNuevoMetodoPago] = useState('Efectivo');
  const [nuevaReferencia, setNuevaReferencia] = useState('');
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);

  // Modal Turno Mostrador state
  const [showModalTurnoMostrador, setShowModalTurnoMostrador] = useState(false);
  const [guardandoTurnoMostrador, setGuardandoTurnoMostrador] = useState(false);
  const [mostradorPatente, setMostradorPatente] = useState('');
  const [mostradorFecha, setMostradorFecha] = useState(() => getFechaHoyArgentina());
  const [mostradorHorario, setMostradorHorario] = useState('');
  const [mostradorHorariosDisponibles, setMostradorHorariosDisponibles] = useState<string[]>([]);
  const [loadingMostradorSlots, setLoadingMostradorSlots] = useState(false);
  const [mostradorNombre, setMostradorNombre] = useState('');
  const [mostradorTelefono, setMostradorTelefono] = useState('');
  const [mostradorEmail, setMostradorEmail] = useState('');
  const [todosLosClientes, setTodosLosClientes] = useState<{ email: string; nombre: string; telefono: string; patente?: string }[]>(() => {
    try {
      const saved = localStorage.getItem('taller_directorio_clientes_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteEncontradoMsg, setClienteEncontradoMsg] = useState<{ tipo: 'success' | 'info'; texto: string } | null>(null);

  // Cancelar Turno por Inasistencia state
  const [turnoACancelar, setTurnoACancelar] = useState<TurnoAdmin | null>(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState('Cliente no se presentó (inasistencia)');
  const [cancelandoTurno, setCancelandoTurno] = useState(false);

  // Script copy state
  const [copiedScript, setCopiedScript] = useState(false);

  // Form IDs
  const searchInputId = useId();
  const kmInputId = useId();
  const trabajoInputId = useId();
  const montoInputId = useId();
  const metodoPagoRepId = useId();

  const fechaMovId = useId();
  const conceptoMovId = useId();
  const catMovId = useId();
  const montoMovId = useId();
  const metodoPagoMovId = useId();
  const refMovId = useId();
  const busquedaContableId = useId();

  // Load turnos
  const fetchTurnos = async (silent = false) => {
    if (!silent) setLoadingTurnos(true);
    try {
      const res = await gasApi.getAdminTurnos();
      if (res.success && Array.isArray(res.turnos)) {
        let currentPresupuestos = presupuestos;
        try {
          const savedP = localStorage.getItem('taller_presupuestos_v1');
          if (savedP) currentPresupuestos = JSON.parse(savedP);
        } catch {}

        const pendientes = filtrarTurnosPendientes(res.turnos, currentPresupuestos);
        setTurnos(pendientes);

        // Directorio completo de clientes conocidos para autocompletar en mostrador
        const clientesMap = new Map<string, { email: string; nombre: string; telefono: string; patente?: string }>();
        try {
          const saved = localStorage.getItem('taller_directorio_clientes_v1');
          if (saved) {
            JSON.parse(saved).forEach((c: any) => {
              if (c.email) clientesMap.set(c.email.toLowerCase().trim(), c);
            });
          }
        } catch {}

        if (Array.isArray((res as any).usuarios)) {
          (res as any).usuarios.forEach((u: any) => {
            if (u.email) {
              const em = u.email.toLowerCase().trim();
              const act = clientesMap.get(em) || { email: em, nombre: '', telefono: '', patente: '' };
              clientesMap.set(em, {
                email: em,
                nombre: u.nombre || act.nombre,
                telefono: u.telefono || act.telefono,
                patente: act.patente,
              });
            }
          });
        }

        res.turnos.forEach((t: any) => {
          if (t.email) {
            const em = t.email.toLowerCase().trim();
            const act = clientesMap.get(em) || { email: em, nombre: '', telefono: '', patente: '' };
            clientesMap.set(em, {
              email: em,
              nombre: t.nombre || act.nombre,
              telefono: t.telefono || act.telefono,
              patente: (t.patente && t.patente !== 'MOSTRADOR') ? t.patente : act.patente,
            });
          }
        });

        currentPresupuestos.forEach((p: any) => {
          if (p.clienteEmail) {
            const em = p.clienteEmail.toLowerCase().trim();
            const act = clientesMap.get(em) || { email: em, nombre: '', telefono: '', patente: '' };
            clientesMap.set(em, {
              email: em,
              nombre: p.clienteNombre || act.nombre,
              telefono: p.clienteTelefono || act.telefono,
              patente: p.patente || act.patente,
            });
          }
        });

        try {
          const uStr = localStorage.getItem('lacasadeladireccion_user');
          if (uStr) {
            const u = JSON.parse(uStr);
            if (u.email) {
              const em = u.email.toLowerCase().trim();
              const act = clientesMap.get(em) || { email: em, nombre: '', telefono: '', patente: '' };
              clientesMap.set(em, {
                email: em,
                nombre: u.nombre || act.nombre,
                telefono: u.telefono || act.telefono,
                patente: act.patente,
              });
            }
          }
        } catch {}

        const listaDirectorio = Array.from(clientesMap.values());
        setTodosLosClientes(listaDirectorio);
        try {
          localStorage.setItem('taller_directorio_clientes_v1', JSON.stringify(listaDirectorio));
        } catch {}

        // Auto-reparación en Google Sheets: solo si un vehículo ya fue facturado en contabilidad
        // y tiene un turno antiguo pasado, marcamos como atendido. NUNCA cancelar turnos futuros.
        try {
          const patentesFacturadas = new Set(
            currentPresupuestos
              .filter((p) => p.estado === 'facturado')
              .map((p) => (p.patente || '').toUpperCase().trim())
          );
          const hoyStr = getFechaHoyArgentina();
          res.turnos.forEach((t) => {
            const cleanP = (t.patente || '').toUpperCase().trim();
            if (!cleanP) return;
            const fechaNorm = normalizarFechaArgentina(t.fecha);
            // ¡NUNCA cancelar ni auto-cerrar un turno de hoy o del futuro!
            if (fechaNorm >= hoyStr) return;
            if (patentesFacturadas.has(cleanP)) {
              gasApi.marcarTurnoAtendido(cleanP).catch(() => {});
            }
          });
        } catch {}
      } else {
        setTurnos([]);
        if (res.error && !silent) onShowToast('error', 'Error en Google Sheets', res.error);
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) onShowToast('error', 'Falla de conexión', 'No se pudieron consultar los turnos.');
    } finally {
      if (!silent) setLoadingTurnos(false);
    }
  };

  // Load contabilidad
  const fetchContabilidad = async (silent = false) => {
    if (!silent) setLoadingContabilidad(true);
    try {
      const res = await gasApi.getAccountingMovements();
      if (res.success && Array.isArray(res.movimientos)) {
        const norm = res.movimientos.map((m: any) => ({ ...m, fecha: normalizarFechaArgentina(m.fecha) }));
        // Deduplicación inteligente para limpiar duplicados existentes de compras de stock
        const seenKeys = new Set<string>();
        const deduped: MovimientoContable[] = [];
        const duplicatesToDeleteFromRemote: string[] = [];

        for (const m of norm) {
          const conceptoNorm = String(m.concepto || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
          
          let dedupeKey = m.id ? String(m.id).trim() : `${m.fecha}-${m.tipo}-${m.concepto}-${m.monto}`;
          
          if (m.tipo === 'gasto' && m.categoria === 'Repuestos / Repuesteros') {
            dedupeKey = `gasto-repuesto-${m.fecha}-${m.monto}-${conceptoNorm}`;
          }

          if (!seenKeys.has(dedupeKey)) {
            seenKeys.add(dedupeKey);
            deduped.push(m);
          } else {
            // Se detectó un clon duplicado en la misma fecha y monto
            if (m.id && (String(m.id).startsWith('MOV-COMPRA-') || String(m.id).startsWith('MOV-STOCK-'))) {
              duplicatesToDeleteFromRemote.push(String(m.id));
            }
          }
        }

        setMovimientos(deduped);
        try {
          localStorage.setItem('lacasadeladireccion_contabilidad', JSON.stringify(deduped));
        } catch {}

        // Limpiar automáticamente de Google Sheets el clon duplicado
        if (duplicatesToDeleteFromRemote.length > 0) {
          duplicatesToDeleteFromRemote.forEach((dupId) => {
            gasApi.deleteAccountingMovement(dupId).catch(() => {});
          });
        }
      } else {
        setMovimientos([]);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      if (!silent) setLoadingContabilidad(false);
    }
  };

  const fetchPresupuestos = async (silent = false) => {
    try {
      const res = await gasApi.getPresupuestos();
      if (res && res.presupuestos) {
        const norm = res.presupuestos.map((p: any) => ({ ...p, fecha: normalizarFechaArgentina(p.fecha) }));
        setPresupuestos(norm);
        // Al actualizar presupuestos, re-filtrar turnos por si alguno pasó a facturado
        setTurnos((prev) => filtrarTurnosPendientes(prev, norm));
        try {
          localStorage.setItem('taller_presupuestos_v1', JSON.stringify(norm));
        } catch {}
      }
    } catch (e) {
      console.warn('Error fetching presupuestos:', e);
    }
  };

  const fetchStock = async (silent = false) => {
    if (!silent) setLoadingStock(true);
    try {
      const res = await gasApi.getStockItems();
      if (res.success && Array.isArray(res.items)) {
        setStockList(res.items);
      }
    } catch (e) {
      console.warn('Error fetching stock:', e);
    } finally {
      if (!silent) setLoadingStock(false);
    }
  };

  useEffect(() => {
    fetchTurnos();
    fetchContabilidad();
    fetchPresupuestos();
    fetchStock();

    // Sincronización en tiempo real para el Panel de Administrador
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.onmessage = () => {
          fetchTurnos(true);
          fetchPresupuestos(true);
          fetchContabilidad(true);
          fetchStock(true);
        };
      } catch {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'taller_presupuestos_v1') {
        fetchPresupuestos(true);
        fetchTurnos(true);
      }
      if (e.key === 'lacasadeladireccion_contabilidad') fetchContabilidad(true);
      if (e.key === 'taller_turnos_atendidos_v1' || e.key === 'taller_turnos_cancelados_v1') fetchTurnos(true);
      if (e.key === 'taller_stock_v1') fetchStock(true);
    };
    window.addEventListener('storage', handleStorage);

    const handleCustomSync = () => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
      fetchStock(true);
    };
    window.addEventListener('taller_presupuesto_sync', handleCustomSync);
    window.addEventListener('taller_stock_sync', handleCustomSync);
    window.addEventListener('taller_contabilidad_sync', handleCustomSync);

    const handleFocus = () => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
      fetchStock(true);
    };
    window.addEventListener('focus', handleFocus);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTurnos(true);
        fetchPresupuestos(true);
        fetchContabilidad(true);
        fetchStock(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Polling automático cada 7 segundos para mantener todo sincronizado en tiempo real
    const interval = setInterval(() => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
      fetchStock(true);
    }, 7000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('taller_presupuesto_sync', handleCustomSync);
      window.removeEventListener('taller_stock_sync', handleCustomSync);
      window.removeEventListener('taller_contabilidad_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Filter turnos
  const filteredTurnos = turnos.filter((t) => {
    const cleanPat = String(t.patente || '').trim().toUpperCase();
    if (presupuestos.some((p) => p.patente.trim().toUpperCase() === cleanPat && p.estado === 'facturado')) {
      return false;
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    const pat = String(t.patente || '').toLowerCase();
    const em = String(t.email || '').toLowerCase();
    return pat.includes(term) || em.includes(term);
  });

  // Filter contabilidad movements by period, type, and search
  const filteredMovimientos = movimientos.filter((m) => {
    // Type filter
    if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) {
      return false;
    }

    // Search filter
    if (filtroBusquedaContable) {
      const term = filtroBusquedaContable.toLowerCase().trim();
      const conc = String(m.concepto || '').toLowerCase();
      const cat = String(m.categoria || '').toLowerCase();
      const ref = String(m.referencia || '').toLowerCase();
      if (!conc.includes(term) && !cat.includes(term) && !ref.includes(term)) {
        return false;
      }
    }

    // Period filter
    if (filtroPeriodo === 'todos') return true;

    try {
      const parts = String(m.fecha).replace("'", '').split('-');
      if (parts.length < 3) return true;
      const movDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const now = new Date();

      if (filtroPeriodo === 'hoy') {
        return (
          movDate.getFullYear() === now.getFullYear() &&
          movDate.getMonth() === now.getMonth() &&
          movDate.getDate() === now.getDate()
        );
      }

      if (filtroPeriodo === 'dia' && fechaPersonalizada) {
        const cleanFecha = String(m.fecha).replace("'", '').trim().split('T')[0];
        if (cleanFecha === fechaPersonalizada) return true;
        const targetParts = fechaPersonalizada.split('-');
        if (targetParts.length >= 3) {
          const targetDate = new Date(
            parseInt(targetParts[0], 10),
            parseInt(targetParts[1], 10) - 1,
            parseInt(targetParts[2], 10)
          );
          return (
            movDate.getFullYear() === targetDate.getFullYear() &&
            movDate.getMonth() === targetDate.getMonth() &&
            movDate.getDate() === targetDate.getDate()
          );
        }
        return false;
      }

      if (filtroPeriodo === 'semana') {
        const diffTime = Math.abs(now.getTime() - movDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }

      if (filtroPeriodo === 'mes') {
        return movDate.getFullYear() === now.getFullYear() && movDate.getMonth() === now.getMonth();
      }
    } catch (e) {
      return true;
    }

    return true;
  });

  const formatearFechaParaBoton = (fechaStr: string): string => {
    return formatearFechaArgentina(fechaStr);
  };

  // Financial calculations
  const totalIngresos = filteredMovimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const totalGastos = filteredMovimientos
    .filter((m) => m.tipo === 'gasto')
    .reduce((sum, m) => sum + (Number(m.monto) || 0), 0);

  const balanceNeto = totalIngresos - totalGastos;

  // Multi-select toggle for workshop services
  const toggleServicio = (item: string) => {
    setSelectedServicios((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Predefined expense or income selector handler
  const handleItemPredefinidoChange = (val: string) => {
    setItemPredefinidoSeleccionado(val);
    if (!val) {
      setNuevoConcepto('');
      return;
    }

    if (nuevoTipo === 'gasto') {
      if (val === 'Otro Gasto (Personalizado)') {
        setNuevoConcepto('');
        setNuevaCategoria('Otro Gasto');
      } else if (val.includes('Boleta de Luz') || val.includes('Alquiler') || val.includes('Servicio de Internet')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Alquiler / Servicios / Impuestos');
      } else if (val.includes('Insumos de Taller')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Insumos de Taller');
      } else if (val.includes('Mantenimiento')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Mantenimiento Máquinas / Rampa');
      } else if (val.includes('Sueldos')) {
        setNuevoConcepto(val);
        setNuevaCategoria('Sueldos / Ayudante');
      } else {
        // Es un repuesto (EXTREMO, AMORTIGUADOR, RULEMAN, etc.)
        setNuevoConcepto(`Compra de ${val}`);
        setNuevaCategoria('Repuestos / Repuesteros');
      }
    } else {
      if (val.includes('Otro')) {
        setNuevoConcepto('');
        setNuevaCategoria('Otro Ingreso');
      } else {
        setNuevoConcepto(`Cobro ${val}`);
        setNuevaCategoria('Mano de Obra / Taller');
      }
    }
  };

  // Save work from appointment modal
  const handleSaveWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurno) return;

    if (!kilometraje) {
      onShowToast('warning', 'Kilometraje requerido', 'Ingresá los kilómetros actuales del vehículo.');
      return;
    }

    if (selectedServicios.length === 0) {
      onShowToast(
        'warning',
        'Seleccioná los trabajos realizados',
        'Elegí al menos un componente o servicio de la lista (ej: ALINEACIÓN Y BALANCEO, RULEMÁN DE MAZA, etc.).'
      );
      return;
    }

    if (!montoCobrado) {
      onShowToast('warning', 'Monto requerido', 'Ingresá el monto total cobrado.');
      return;
    }

    const trabajoFinal =
      selectedServicios.join(' + ') +
      (notasTrabajoAdicional.trim() ? ` [${notasTrabajoAdicional.trim()}]` : '');

    setSavingWork(true);
    try {
      const cleanTurnoFecha = String(selectedTurno.fecha || '').replace(/^'/, '').trim();
      const fechaExactaTrabajo = cleanTurnoFecha ? normalizarFechaArgentina(cleanTurnoFecha) : getFechaHoyArgentina();

      const payload: DatosTrabajoAdmin = {
        email: selectedTurno.email,
        fecha: fechaExactaTrabajo,
        horario: selectedTurno.horario,
        patente: selectedTurno.patente,
        kilometraje,
        trabajoRealizado: trabajoFinal,
        montoFinal: montoCobrado,
      };

      const res = await gasApi.saveAdminWork(payload);

      // Auto-register in contabilidad if checked con la misma fecha exacta
      if (autoRegistrarContabilidad && Number(montoCobrado) > 0) {
        const movimientoItem: MovimientoContable = {
          id: 'MOV-' + Date.now(),
          fecha: fechaExactaTrabajo,
          tipo: 'ingreso',
          concepto: `Reparación: ${trabajoFinal.substring(0, 50)}`,
          categoria: 'Mano de Obra / Taller',
          monto: Number(montoCobrado),
          metodoPago: metodoPagoReparacion,
          referencia: selectedTurno.patente.toUpperCase(),
        };
        await gasApi.addAccountingMovement(movimientoItem);
        fetchContabilidad();
      }

      if (res.success) {
        marcarTurnoAtendidoLocal(selectedTurno.patente);
        setTurnos((prev) => prev.filter((t) => (t.patente || '').trim().toUpperCase() !== selectedTurno.patente.trim().toUpperCase()));
        gasApi.marcarTurnoAtendido(selectedTurno.patente).catch(() => {});

        // Impactar en rotación de stock de repuestos utilizados en el taller con la misma fecha exacta
        try {
          const repuestoItems: ItemPresupuesto[] = selectedServicios.map((s, idx) => ({
            id: `ITEM-SRV-${Date.now()}-${idx}`,
            tipo: 'repuesto',
            descripcion: s,
            cantidad: 1,
            precioUnitario: 0,
            subtotal: 0,
          }));
          const presupuestoAsociado = presupuestos.find(
            (p) => (p.patente || '').trim().toUpperCase() === selectedTurno.patente.trim().toUpperCase()
          );
          const vehiculoDelTurno = presupuestoAsociado?.vehiculoModelo || '';
          await gasApi.actualizarRotacionYDescontarStock(
            repuestoItems,
            vehiculoDelTurno,
            fechaExactaTrabajo,
            { patente: selectedTurno.patente, clienteNombre: selectedTurno.nombre || selectedTurno.email }
          );
          await fetchStock(true);
        } catch {}

        onShowToast(
          'success',
          '¡Trabajo registrado y archivado!',
          `Vehículo ${selectedTurno.patente} pasado a Atendido con: ${trabajoFinal}.${
            autoRegistrarContabilidad ? ' Se sumó el cobro a Contabilidad.' : ''
          }`
        );
        setSelectedTurno(null);
        setSelectedServicios([]);
        setNotasTrabajoAdicional('');
      } else {
        onShowToast('error', 'Error al guardar', res.error || 'No se pudo actualizar la planilla.');
      }
    } catch (err: any) {
      onShowToast('error', 'Falla de red', err.message || 'Error al conectar con la WebApp.');
    } finally {
      setSavingWork(false);
    }
  };

  // Quitar turno atendido desde presupuestos al facturar
  const handleTurnoAtendido = (patente: string) => {
    const cleanPat = patente.trim().toUpperCase();
    marcarTurnoAtendidoLocal(cleanPat);
    setTurnos((prev) => prev.filter((t) => (t.patente || '').trim().toUpperCase() !== cleanPat));
    gasApi.marcarTurnoAtendido(cleanPat).catch(() => {});
  };

  // Cancelar turno por inasistencia del usuario antes de programar
  const handleConfirmarCancelarTurno = async () => {
    if (!turnoACancelar) return;
    const pat = (turnoACancelar.patente || '').trim().toUpperCase();
    const fecha = turnoACancelar.fecha;
    setCancelandoTurno(true);
    try {
      marcarTurnoCanceladoLocal(pat, fecha);
      setTurnos((prev) => prev.filter((t) => !( (t.patente || '').trim().toUpperCase() === pat && (!fecha || t.fecha === fecha) )));
      await gasApi.cancelarTurno(pat, motivoCancelacion, fecha);
      onShowToast('info', 'Turno cancelado', `El turno de la patente ${pat}${fecha ? ` para el ${fecha}` : ''} fue cancelado.`);
      setTurnoACancelar(null);
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Error al cancelar', 'No se pudo comunicar con Google Sheets, pero se canceló en pantalla.');
      setTurnoACancelar(null);
    } finally {
      setCancelandoTurno(false);
    }
  };

  // Refrescar contabilidad si se registra una compra de repuestos
  const handleRegistrarGastoDesdeStock = async (_concepto: string, _monto: number, _metodoPago: string) => {
    // Las compras de repuestos en Módulo 2 ya registran su gasto en contabilidad de manera única y centralizada.
    // Esta función solo asegura el refresco instantáneo de los movimientos contables.
    fetchContabilidad(true);
  };

  // Query real-time slot availability for counter turnos
  const handleMostradorDateChange = async (selectedDate: string) => {
    setMostradorFecha(selectedDate);
    setMostradorHorario('');
    setMostradorHorariosDisponibles([]);

    if (!selectedDate) return;

    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const chosenDate = new Date(year, month, day);

    const dayOfWeek = chosenDate.getDay();
    if (dayOfWeek === 0) {
      onShowToast('warning', 'Domingo cerrado', 'El taller permanece cerrado los domingos para descanso técnico.');
      return;
    }

    // Horarios base de atención del taller
    // Lunes a Viernes: 08:00 a 11:00 & 16:00 a 19:00
    // Sábados: 08:00 a 11:00
    const baseSlots =
      dayOfWeek >= 1 && dayOfWeek <= 5
        ? ['08:00', '09:00', '10:00', '11:00', '16:00', '17:00', '18:00', '19:00']
        : ['08:00', '09:00', '10:00', '11:00'];

    setLoadingMostradorSlots(true);
    try {
      const res = await gasApi.getOccupiedSlots(selectedDate);
      const apiOcupados = res.resultado === 'ok' && Array.isArray(res.ocupados) ? res.ocupados : [];

      // También verificar turnos en memoria que tengan esa fecha
      const localOcupados = turnos
        .filter((t) => String(t.fecha).replace("'", '').trim() === selectedDate)
        .map((t) => String(t.horario).replace("'", '').trim());

      const ocupadosTotal = new Set([...apiOcupados, ...localOcupados]);
      const libres = baseSlots.filter((slot) => !ocupadosTotal.has(slot));

      setMostradorHorariosDisponibles(libres);
      if (libres.length > 0) {
        setMostradorHorario(libres[0]);
      }
    } catch (e) {
      console.warn('Error al consultar horarios ocupados:', e);
      const localOcupados = new Set(
        turnos
          .filter((t) => String(t.fecha).replace("'", '').trim() === selectedDate)
          .map((t) => String(t.horario).replace("'", '').trim())
      );
      const libres = baseSlots.filter((slot) => !localOcupados.has(slot));
      setMostradorHorariosDisponibles(libres);
      if (libres.length > 0) {
        setMostradorHorario(libres[0]);
      }
    } finally {
      setLoadingMostradorSlots(false);
    }
  };

  // Buscar y autocompletar datos del cliente por correo
  const handleBuscarClientePorEmail = async (forzarEmail?: string) => {
    const emailTarget = (forzarEmail !== undefined ? forzarEmail : mostradorEmail).trim().toLowerCase();
    if (!emailTarget) {
      onShowToast('warning', 'Ingresá un correo', 'Escribí el correo electrónico del cliente para buscar sus datos.');
      return;
    }

    setBuscandoCliente(true);
    setClienteEncontradoMsg(null);

    try {
      let cliente: { email: string; nombre: string; telefono: string; patente?: string } | null = null;

      // 1. Buscar en memoria local de todos los clientes conocidos
      const matchLocal = todosLosClientes.find((c) => c.email.toLowerCase().trim() === emailTarget);
      if (matchLocal && (matchLocal.nombre || matchLocal.telefono)) {
        cliente = { ...matchLocal };
      }

      // 2. Buscar en localStorage de directorio de clientes
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        try {
          const savedDir = localStorage.getItem('taller_directorio_clientes_v1');
          if (savedDir) {
            const list = JSON.parse(savedDir);
            const m = list.find((c: any) => (c.email || '').toLowerCase().trim() === emailTarget);
            if (m && (m.nombre || m.telefono)) {
              cliente = {
                email: emailTarget,
                nombre: m.nombre || (cliente?.nombre || ''),
                telefono: m.telefono || (cliente?.telefono || ''),
                patente: m.patente || (cliente?.patente || ''),
              };
            }
          }
        } catch {}
      }

      // 3. Buscar en turnos activos en memoria del panel admin
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        const tMatch = turnos.find((t) => (t.email || '').toLowerCase().trim() === emailTarget);
        if (tMatch && (tMatch.nombre || tMatch.telefono)) {
          cliente = {
            email: emailTarget,
            nombre: tMatch.nombre || (cliente?.nombre || ''),
            telefono: tMatch.telefono || (cliente?.telefono || ''),
            patente: (tMatch.patente && tMatch.patente !== 'MOSTRADOR') ? tMatch.patente : (cliente?.patente || ''),
          };
        }
      }

      // 4. Buscar en presupuestos en memoria del panel admin
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        const pMatch = presupuestos.find((p) => (p.clienteEmail || '').toLowerCase().trim() === emailTarget);
        if (pMatch && (pMatch.clienteNombre || pMatch.clienteTelefono)) {
          cliente = {
            email: emailTarget,
            nombre: pMatch.clienteNombre || (cliente?.nombre || ''),
            telefono: pMatch.clienteTelefono || (cliente?.telefono || ''),
            patente: pMatch.patente || (cliente?.patente || ''),
          };
        }
      }

      // 5. Consultar a Google Apps Script en tiempo real con gasApi.buscarClientePorEmail
      // (combina búsqueda en hoja Usuarios, login 123456, turnos admin e historial)
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        try {
          const resSearch = await gasApi.buscarClientePorEmail(emailTarget);
          if (resSearch && resSearch.success && resSearch.usuario && (resSearch.usuario.nombre || resSearch.usuario.telefono)) {
            cliente = {
              email: emailTarget,
              nombre: resSearch.usuario.nombre || (cliente?.nombre || ''),
              telefono: resSearch.usuario.telefono || (cliente?.telefono || ''),
              patente: resSearch.usuario.patente || (cliente?.patente || ''),
            };
          }
        } catch {}
      }

      // 6. Consultar a Google Sheets en tiempo real vía getAdminTurnos
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        try {
          const resTurnos = await gasApi.getAdminTurnos();
          if (resTurnos && resTurnos.success) {
            if (Array.isArray((resTurnos as any).usuarios)) {
              const uMatch = (resTurnos as any).usuarios.find((u: any) => (u.email || '').toLowerCase().trim() === emailTarget);
              if (uMatch && (uMatch.nombre || uMatch.telefono)) {
                cliente = {
                  email: emailTarget,
                  nombre: uMatch.nombre || (cliente?.nombre || ''),
                  telefono: uMatch.telefono || (cliente?.telefono || ''),
                  patente: cliente?.patente || '',
                };
              }
            }
            if ((!cliente || (!cliente.nombre && !cliente.telefono)) && Array.isArray(resTurnos.turnos)) {
              const match = resTurnos.turnos.find((t: any) => (t.email || '').toLowerCase().trim() === emailTarget);
              if (match && (match.nombre || match.telefono)) {
                cliente = {
                  email: emailTarget,
                  nombre: match.nombre || (cliente?.nombre || ''),
                  telefono: match.telefono || (cliente?.telefono || ''),
                  patente: (match.patente && match.patente !== 'MOSTRADOR') ? match.patente : (cliente?.patente || ''),
                };
              }
            }
          }
        } catch {}
      }

      // 7. Buscar en usuario activo si coincide
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        try {
          const uStr = localStorage.getItem('lacasadeladireccion_user');
          if (uStr) {
            const u = JSON.parse(uStr);
            if ((u.email || '').toLowerCase().trim() === emailTarget && (u.nombre || u.telefono)) {
              cliente = {
                email: emailTarget,
                nombre: u.nombre || (cliente?.nombre || ''),
                telefono: u.telefono || (cliente?.telefono || ''),
                patente: cliente?.patente || '',
              };
            }
          }
        } catch {}
      }

      // 8. Buscar en turnos del cliente guardados en el navegador
      if (!cliente || (!cliente.nombre && !cliente.telefono)) {
        try {
          const tStr = localStorage.getItem('lacasadeladireccion_turnos');
          if (tStr) {
            const tList = JSON.parse(tStr);
            if (Array.isArray(tList) && tList.length > 0 && tList[0].patente && (!mostradorPatente || mostradorPatente === 'MOSTRADOR')) {
              setMostradorPatente(tList[0].patente.toUpperCase());
            }
          }
        } catch {}
      }

      if (cliente && (cliente.nombre || cliente.telefono)) {
        if (cliente.nombre) setMostradorNombre(cliente.nombre);
        if (cliente.telefono) setMostradorTelefono(cliente.telefono);
        if (cliente.patente && (!mostradorPatente || mostradorPatente === 'MOSTRADOR')) {
          setMostradorPatente(cliente.patente.toUpperCase());
        }

        // Guardar y consolidar en directorio local
        const clienteActualizado = {
          email: emailTarget,
          nombre: cliente.nombre || mostradorNombre,
          telefono: cliente.telefono || mostradorTelefono,
          patente: cliente.patente || mostradorPatente,
        };

        setTodosLosClientes((prev) => {
          const next = [...prev.filter((c) => c.email.toLowerCase().trim() !== emailTarget), clienteActualizado];
          try {
            localStorage.setItem('taller_directorio_clientes_v1', JSON.stringify(next));
          } catch {}
          return next;
        });

        setClienteEncontradoMsg({
          tipo: 'success',
          texto: `Cliente encontrado: ${cliente.nombre || emailTarget}${cliente.telefono ? ` · Tel: ${cliente.telefono}` : ''}`,
        });
        onShowToast('success', '¡Datos autocompletados!', `Cliente encontrado: ${cliente.nombre || emailTarget}.`);
      } else {
        setClienteEncontradoMsg({
          tipo: 'info',
          texto: 'Correo nuevo (no registrado). Al guardar se creará su cuenta web con la contraseña: 123456.',
        });
        onShowToast('info', 'Cliente nuevo (no registrado)', 'El correo no existe aún. Ingresá sus datos y al confirmar se creará su usuario con clave 123456.');
      }
    } finally {
      setBuscandoCliente(false);
    }
  };

  // Autocompletar datos del cliente si el correo ya existe
  const handleMostradorEmailChange = (val: string) => {
    setMostradorEmail(val);
    setClienteEncontradoMsg(null);
    const clean = val.trim().toLowerCase();
    if (!clean || !clean.includes('@') || !clean.includes('.')) return;

    // Autocompletado pasivo en tiempo real si ya está en memoria o en localStorage
    let match = todosLosClientes.find((c) => c.email.toLowerCase().trim() === clean);
    if (!match) {
      try {
        const saved = localStorage.getItem('taller_directorio_clientes_v1');
        if (saved) {
          const list = JSON.parse(saved);
          match = list.find((c: any) => (c.email || '').toLowerCase().trim() === clean);
        }
      } catch {}
    }
    if (!match) {
      const t = turnos.find((x) => (x.email || '').toLowerCase().trim() === clean);
      if (t) {
        match = { email: clean, nombre: t.nombre || '', telefono: t.telefono || '', patente: t.patente };
      }
    }
    if (!match) {
      const p = presupuestos.find((x) => (x.clienteEmail || '').toLowerCase().trim() === clean);
      if (p) {
        match = { email: clean, nombre: p.clienteNombre || '', telefono: p.clienteTelefono || '', patente: p.patente };
      }
    }

    if (match && (match.nombre || match.telefono)) {
      if (match.nombre) setMostradorNombre(match.nombre);
      if (match.telefono) setMostradorTelefono(match.telefono);
      if (match.patente && (!mostradorPatente || mostradorPatente === 'MOSTRADOR')) {
        setMostradorPatente(match.patente.toUpperCase());
      }
      setClienteEncontradoMsg({
        tipo: 'success',
        texto: `Cliente encontrado: ${match.nombre || clean}${match.telefono ? ` · Tel: ${match.telefono}` : ''}`,
      });
    }
  };

  // Save new turno from mostrador / presencial & auto-create user with password 123456
  const handleGuardarTurnoMostrador = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mostradorPatente.trim()) {
      onShowToast('warning', 'Falta la patente', 'Ingresá la patente del vehículo.');
      return;
    }
    if (!mostradorNombre.trim()) {
      onShowToast('warning', 'Falta el nombre', 'Ingresá el nombre y apellido del cliente.');
      return;
    }
    if (!mostradorTelefono.trim()) {
      onShowToast('warning', 'Falta el teléfono', 'Ingresá el teléfono o WhatsApp de contacto.');
      return;
    }
    if (!mostradorEmail.trim()) {
      onShowToast('warning', 'Falta el correo', 'Ingresá el correo electrónico del cliente para crear su cuenta.');
      return;
    }
    if (!mostradorFecha || !mostradorHorario) {
      onShowToast('warning', 'Horario requerido', 'Seleccioná un horario disponible para la fecha elegida.');
      return;
    }

    setGuardandoTurnoMostrador(true);
    const cleanPatente = mostradorPatente.trim().toUpperCase();
    const cleanEmail = mostradorEmail.trim().toLowerCase();
    const cleanNombre = mostradorNombre.trim();
    const cleanTelefono = mostradorTelefono.trim();
    const cleanFecha = normalizarFechaArgentina(mostradorFecha);

    const nuevoTurnoAdmin: TurnoAdmin = {
      patente: cleanPatente,
      fecha: cleanFecha,
      horario: mostradorHorario,
      email: cleanEmail,
      nombre: cleanNombre,
      telefono: cleanTelefono,
    };

    const yaExiste = todosLosClientes.some((c) => c.email.toLowerCase().trim() === cleanEmail) ||
                     turnos.some((t) => (t.email || '').toLowerCase().trim() === cleanEmail) ||
                     presupuestos.some((p) => (p.clienteEmail || '').toLowerCase().trim() === cleanEmail);

    try {
      // 1. Si no existe previamente, registrar al usuario nuevo con clave 123456
      if (!yaExiste) {
        try {
          await gasApi.register(cleanNombre, cleanTelefono, cleanEmail, '123456');
        } catch (errReg) {
          console.warn('Registro de usuario vía register:', errReg);
        }
      }

      // 2. Guardar en Google Sheets (Hoja "Turnos" y asegura datos en "Usuarios")
      await gasApi.createTurnoMostrador({
        patente: cleanPatente,
        fecha: cleanFecha,
        horario: mostradorHorario,
        nombre: cleanNombre,
        telefono: cleanTelefono,
        email: cleanEmail,
      });

      // Actualizar directorio local
      const nuevoClienteEnDirectorio = {
        email: cleanEmail,
        nombre: cleanNombre,
        telefono: cleanTelefono,
        patente: cleanPatente,
      };
      // Desbloquear cualquier marca previa de cancelación para esta patente y fecha
      removerTurnoCanceladoLocal(cleanPatente, cleanFecha);

      setTodosLosClientes((prev) => {
        const next = [...prev.filter((c) => c.email.toLowerCase().trim() !== cleanEmail), nuevoClienteEnDirectorio];
        try {
          localStorage.setItem('taller_directorio_clientes_v1', JSON.stringify(next));
        } catch {}
        return next;
      });

      setTurnos((prev) => [nuevoTurnoAdmin, ...prev.filter((t) => t.patente !== cleanPatente || t.fecha !== cleanFecha)]);

      onShowToast(
        'success',
        yaExiste ? '¡Turno agendado para cliente existente!' : '¡Turno agendado y Usuario creado!',
        `Vehículo ${cleanPatente} para el ${cleanFecha} ${mostradorHorario} hs.${yaExiste ? ' Turno vinculado a su cuenta.' : ' Usuario registrado con contraseña: 123456.'}`
      );

      setShowModalTurnoMostrador(false);
      setMostradorPatente('');
      setMostradorNombre('');
      setMostradorTelefono('');
      setMostradorEmail('');
      setClienteEncontradoMsg(null);
      fetchTurnos();
    } catch (err: any) {
      console.warn('Falla en llamada directa a GAS:', err);
      // Fallback local garantizado
      setTurnos((prev) => [nuevoTurnoAdmin, ...prev.filter((t) => t.patente !== cleanPatente || t.fecha !== cleanFecha)]);
      onShowToast(
        'success',
        'Turno agendado en el sistema',
        `Vehículo ${cleanPatente} cargado con éxito.${yaExiste ? '' : ' Usuario creado con contraseña 123456.'}`
      );
      setShowModalTurnoMostrador(false);
    } finally {
      setGuardandoTurnoMostrador(false);
    }
  };

  // Save new manual movement in contabilidad
  const handleSaveNuevoMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaFecha || !nuevoConcepto || !nuevoMonto) {
      onShowToast('warning', 'Campos requeridos', 'Completá fecha, concepto y monto.');
      return;
    }

    setGuardandoMovimiento(true);
    try {
      const movimientoItem: MovimientoContable = {
        id: 'MOV-' + Date.now(),
        fecha: nuevaFecha,
        tipo: nuevoTipo,
        concepto: nuevoConcepto.trim(),
        categoria: nuevaCategoria,
        monto: Math.abs(Number(nuevoMonto)),
        metodoPago: nuevoMetodoPago,
        referencia: nuevaReferencia.trim().toUpperCase(),
      };

      await gasApi.addAccountingMovement(movimientoItem);
      onShowToast(
        'success',
        nuevoTipo === 'ingreso' ? '¡Ingreso registrado!' : '¡Gasto registrado!',
        `Se agregó "${nuevoConcepto}" por $${Number(nuevoMonto).toLocaleString('es-AR')}`
      );

      // Reset modal form
      setShowModalMovimiento(false);
      setNuevoConcepto('');
      setNuevoMonto('');
      setNuevaReferencia('');
      fetchContabilidad();
    } catch (err: any) {
      onShowToast('error', 'Error al registrar', err.message);
    } finally {
      setGuardandoMovimiento(false);
    }
  };

  // Delete movement
  const handleDeleteMovement = async (id: string, concepto: string) => {
    const confirmDelete = window.confirm(`¿Estás seguro de eliminar el movimiento "${concepto}"?`);
    if (!confirmDelete) return;

    try {
      await gasApi.deleteAccountingMovement(id);
      onShowToast('info', 'Movimiento eliminado', concepto);
      setMovimientos((prev) => prev.filter((m) => m.id !== id));
    } catch (e: any) {
      onShowToast('error', 'Error al borrar', e.message);
    }
  };

  // Pasar presupuesto cobrado a contabilidad
  const handleRegistrarIngresoDesdePresupuesto = async (
    concepto: string,
    monto: number,
    referencia: string,
    fecha?: string,
    presupuestoId?: string,
    presupuestoNumero?: string
  ) => {
    try {
      const fechaMovimiento = fecha ? normalizarFechaArgentina(fecha) : getFechaHoyArgentina();
      const movId = presupuestoId ? `MOV-PRESUP-${presupuestoId}` : `mov-${Date.now()}`;
      await gasApi.addAccountingMovement({
        id: movId,
        fecha: fechaMovimiento,
        tipo: 'ingreso',
        concepto,
        categoria: 'Mano de Obra / Taller',
        monto,
        metodoPago: 'Efectivo',
        referencia: presupuestoNumero ? `${referencia} (Presup. ${presupuestoNumero})` : referencia,
      });
      fetchContabilidad(true);
    } catch (e) {
      console.warn('Error al asentar presupuesto en caja:', e);
    }
  };

  // Copy full Google Apps Script
  const fullAppsScriptCode = `// =========================================================================
// LA CASA DE LA DIRECCIÓN - GOOGLE APPS SCRIPT COMPLETO CON CONTABILIDAD
// =========================================================================
const MERCADOPAGO_ACCESS_TOKEN = "APP_USR-4589130827999167-092812-304c27d1e426c89f133eaac26d1354ed-13866330"; 
const MONTO_SEÑA = 10000; 

// --- FUNCIÓN PARA AUTORIZAR PERMISOS DE GMAIL EN 1 SOLO CLIC ---
// Seleccioná "autorizarPermisosDeEmail" en la barra de arriba de Apps Script y tocá "Ejecutar" (▶️)
function autorizarPermisosDeEmail() {
  Logger.log("Permisos autorizados correctamente. Correos disponibles hoy: " + MailApp.getRemainingDailyQuota());
}

// Formatea el horario de forma limpia y segura (evita desfasajes de zona horaria o fecha 1899)
function formatearHoraParaAppsScript(val) {
  if (!val) return "";
  if (val instanceof Date) {
    var h = val.getHours();
    var m = val.getMinutes();
    return (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  }
  var s = val.toString().replace(/['"]/g, "").trim();
  if (s.indexOf("T") !== -1) {
    var d = new Date(s);
    if (!isNaN(d.getTime())) {
      var h2 = d.getHours();
      var m2 = d.getMinutes();
      return (h2 < 10 ? "0" + h2 : h2) + ":" + (m2 < 10 ? "0" + m2 : m2);
    }
  }
  var match = s.match(/(\\d{1,2}):(\\d{2})/);
  if (match) {
    var hNum = parseInt(match[1], 10);
    return (hNum < 10 ? "0" + hNum : hNum) + ":" + match[2];
  }
  return s;
}

// Devuelve la fecha actual oficial de Argentina (GMT-3) en formato YYYY-MM-DD
function getFechaHoyArgentinaAppsScript() {
  return Utilities.formatDate(new Date(), "GMT-3", "yyyy-MM-dd");
}

// Formatea la fecha de forma limpia y segura (evita desfasajes de zona horaria o serialización UTC)
function formatearFechaParaAppsScript(val) {
  if (!val) return "";
  if (val instanceof Date) {
    // Blindaje contra desfase de medianoche UTC -> GMT-3:
    // Si la celda fue guardada a medianoche (00:00:00 UTC), en GMT-3 retrocede 3 horas al día anterior a las 21:00 hs.
    // Sumando 12 horas nos aseguramos de estar al mediodía y que el día coincida exactamente en cualquier huso horario.
    var dSafe = new Date(val.getTime() + 12 * 3600 * 1000);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tz = (ss && ss.getSpreadsheetTimeZone()) ? ss.getSpreadsheetTimeZone() : "GMT-3";
    return Utilities.formatDate(dSafe, tz, "yyyy-MM-dd");
  }
  var s = val.toString().replace(/['"]/g, "").trim();
  // Caso formato Date.toString() ej: "Tue Oct 07 2026 ..."
  var matchDateStr = s.match(/\\b([A-Za-z]{3})\\s+(\\d{1,2})\\s+(\\d{4})\\b/);
  if (matchDateStr) {
    var mesesMap = {
      "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
      "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
    };
    var mNum = mesesMap[matchDateStr[1].toLowerCase()];
    if (mNum) {
      var dNum = matchDateStr[2].length === 1 ? ("0" + matchDateStr[2]) : matchDateStr[2];
      return matchDateStr[3] + "-" + mNum + "-" + dNum;
    }
  }
  // Caso DD/MM/AAAA
  if (/^\\d{1,2}\\/\\d{1,2}\\/\\d{4}/.test(s)) {
    var p = s.split("/");
    var d = p[0].length === 1 ? ("0" + p[0]) : p[0];
    var m = p[1].length === 1 ? ("0" + p[1]) : p[1];
    var y = p[2].split(" ")[0].split("T")[0];
    return y + "-" + m + "-" + d;
  }
  // Caso YYYY-MM-DD o YYYY-M-D
  if (/^\\d{4}-\\d{1,2}-\\d{1,2}/.test(s)) {
    var onlyDate = s.split("T")[0].split(" ")[0];
    var pY = onlyDate.split("-");
    var mY = pY[1].length === 1 ? ("0" + pY[1]) : pY[1];
    var dY = pY[2].length === 1 ? ("0" + pY[2]) : pY[2];
    return pY[0] + "-" + mY + "-" + dY;
  }
  if (s.indexOf("T") !== -1) {
    var onlyDate = s.split("T")[0];
    if (/^\\d{4}-\\d{1,2}-\\d{1,2}/.test(onlyDate)) {
      return onlyDate;
    }
  }
  return s;
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUsuarios = ss.getSheetByName("Usuarios") || ss.getSheetByName("Clientes") || ss.getSheets()[0]; 
    var sheetTurnos = ss.getSheetByName("Turnos") || ss.insertSheet("Turnos");
    var sheetContabilidad = ss.getSheetByName("Contabilidad") || ss.insertSheet("Contabilidad");
    var datos = JSON.parse(e.postData.contents);
    
    // --- ACCIÓN: BUSCAR USUARIO POR EMAIL (AUTOCOMPLETAR EN MOSTRADOR) ---
    if (datos.accion === "buscarUsuarioPorEmail") {
      var rowsUsuarios = sheetUsuarios ? sheetUsuarios.getDataRange().getValues() : [];
      var clienteEncontrado = null;
      var targetEmail = String(datos.email || "").toLowerCase().trim();
      for (var u = 1; u < rowsUsuarios.length; u++) {
        if (rowsUsuarios[u][2] && rowsUsuarios[u][2].toString().toLowerCase().trim() === targetEmail) {
          clienteEncontrado = {
            nombre: rowsUsuarios[u][0] ? rowsUsuarios[u][0].toString() : "",
            telefono: rowsUsuarios[u][1] ? rowsUsuarios[u][1].toString() : "",
            email: rowsUsuarios[u][2] ? rowsUsuarios[u][2].toString() : ""
          };
          break;
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ resultado: "ok", usuario: clienteEncontrado })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- ACCIÓN 0: ENVIAR CÓDIGO DE VALIDACIÓN POR CORREO ---
    if (datos.accion === "enviarCodigoVerificacion") {
      var emailDest = datos.email ? datos.email.toString().trim().toLowerCase() : "";
      if (!emailDest || emailDest.indexOf("@") === -1) {
        return ContentService.createTextOutput(JSON.stringify({
          "resultado": "error",
          "mensaje": "Por favor ingresá un correo electrónico válido."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Chequear si ya existe un usuario con este correo
      var rowsUsuariosCheck = sheetUsuarios.getDataRange().getValues();
      for (var u = 1; u < rowsUsuariosCheck.length; u++) {
        if (rowsUsuariosCheck[u][2] && rowsUsuariosCheck[u][2].toString().toLowerCase().trim() === emailDest) {
          return ContentService.createTextOutput(JSON.stringify({
            "resultado": "error",
            "mensaje": "Este correo ya está registrado en el sistema. Por favor iniciá sesión."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      // Generar código numérico de 6 dígitos
      var codigoGen = Math.floor(100000 + Math.random() * 900000).toString();

      // Guardar en CacheService (válido por 15 minutos = 900 seg)
      var cache = CacheService.getScriptCache();
      cache.put("CODIGO_" + emailDest, codigoGen, 900);

      // Guardar también en PropertiesService como respaldo
      var props = PropertiesService.getScriptProperties();
      props.setProperty("CODIGO_" + emailDest, codigoGen);
      props.setProperty("EXPIRA_" + emailDest, (new Date().getTime() + 15 * 60 * 1000).toString());

      try {
        var nombreDest = datos.nombre ? datos.nombre.toString().trim() : "Cliente";
        var asunto = "Tu código de verificación: " + codigoGen + " | La Casa de la Dirección";
        var htmlBody = "<div style='background-color:#0d0d0d; color:#ffffff; font-family:Arial,sans-serif; padding:35px 25px; text-align:center; border:2px solid #e31212; border-radius:12px; max-width:480px; margin:0 auto;'>"
          + "<h1 style='color:#e31212; font-size:24px; margin-top:0; letter-spacing:1px;'>LA CASA DE LA DIRECCIÓN</h1>"
          + "<p style='font-size:16px; color:#eaeaea;'>¡Hola <strong>" + nombreDest + "</strong>!</p>"
          + "<p style='font-size:14px; color:#aaaaaa; line-height:1.5;'>Para validar tu correo y activar tu cuenta en nuestro taller, ingresá el siguiente código en la página web:</p>"
          + "<div style='background-color:#161616; border:1px solid #333333; padding:18px 25px; border-radius:8px; display:inline-block; margin:20px 0;'>"
          + "<span style='font-size:36px; font-weight:bold; letter-spacing:8px; color:#ffffff; font-family:monospace;'>" + codigoGen + "</span>"
          + "</div>"
          + "<p style='font-size:12px; color:#888888;'>⏰ Este código vence en 15 minutos.<br/>Si no iniciaste este registro, podés ignorar este correo.</p>"
          + "<hr style='border:0; border-top:1px solid #222; margin:25px 0;'/>"
          + "<p style='font-size:11px; color:#666; margin:0;'>Taller Mecánico Especializado en Alineación, Balanceo, Tren Delantero y Dirección</p>"
          + "</div>";

        MailApp.sendEmail({
          to: emailDest,
          subject: asunto,
          htmlBody: htmlBody
        });

        return ContentService.createTextOutput(JSON.stringify({
          "resultado": "ok",
          "mensaje": "Código de verificación enviado a tu correo"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch(errMail) {
        return ContentService.createTextOutput(JSON.stringify({
          "resultado": "error",
          "mensaje": "No se pudo enviar el correo: " + errMail.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // --- ACCIÓN 1: REGISTRO DE USUARIOS ---
    if (datos.accion === "registrar") {
      var emailReg = datos.email ? datos.email.toString().trim().toLowerCase() : "";

      // Validar código de verificación si fue provisto
      if (datos.codigoVerificacion) {
        var codRecibido = datos.codigoVerificacion.toString().trim();
        var cacheReg = CacheService.getScriptCache();
        var codCache = cacheReg.get("CODIGO_" + emailReg);

        var propsReg = PropertiesService.getScriptProperties();
        var codProps = propsReg.getProperty("CODIGO_" + emailReg);
        var expiraProps = propsReg.getProperty("EXPIRA_" + emailReg);
        var esValidoPorProps = codProps && expiraProps && (new Date().getTime() < Number(expiraProps)) && (codProps === codRecibido);

        if ((!codCache || codCache !== codRecibido) && !esValidoPorProps) {
          return ContentService.createTextOutput(JSON.stringify({
            "resultado": "error",
            "mensaje": "El código de verificación es incorrecto o ha vencido. Por favor solicitá un código nuevo."
          })).setMimeType(ContentService.MimeType.JSON);
        }

        // Limpiar código utilizado
        cacheReg.remove("CODIGO_" + emailReg);
        propsReg.deleteProperty("CODIGO_" + emailReg);
        propsReg.deleteProperty("EXPIRA_" + emailReg);
      }

      var rowsU = sheetUsuarios.getDataRange().getValues();
      for (var k = 1; k < rowsU.length; k++) {
        if (rowsU[k][2] && rowsU[k][2].toString().toLowerCase().trim() === emailReg) {
          return ContentService.createTextOutput(JSON.stringify({
            "resultado": "error",
            "mensaje": "Este correo ya está registrado en el sistema."
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }

      var nuevaFila = [datos.nombre, datos.telefono, emailReg, datos.password, new Date()];
      sheetUsuarios.appendRow(nuevaFila);
      return ContentService.createTextOutput(JSON.stringify({"resultado": "ok"})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // --- ACCIÓN 2: INICIAR SESIÓN Y BUSCAR HISTORIAL ---
    if (datos.accion === "login") {
      var rowsUsuarios = sheetUsuarios.getDataRange().getValues();
      var usuarioEncontrado = null;
      for (var i = 1; i < rowsUsuarios.length; i++) {
        if (rowsUsuarios[i][2].toString().toLowerCase() === datos.email.toLowerCase() && rowsUsuarios[i][3].toString() === datos.password) {
          usuarioEncontrado = { "nombre": rowsUsuarios[i][0], "telefono": rowsUsuarios[i][1], "email": rowsUsuarios[i][2] };
          break;
        }
      }
      if (!usuarioEncontrado) {
        return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": "Usuario o contraseña incorrectos"})).setMimeType(ContentService.MimeType.JSON);
      }
      var listaTurnos = [];
      if (sheetTurnos) {
        var rowsTurnos = sheetTurnos.getDataRange().getValues();
        for (var j = 1; j < rowsTurnos.length; j++) {
          if (rowsTurnos[j][0].toString().toLowerCase() === datos.email.toLowerCase()) {
            listaTurnos.push({
              "fecha": formatearFechaParaAppsScript(rowsTurnos[j][1]),
              "horario": formatearHoraParaAppsScript(rowsTurnos[j][2]),
              "patente": rowsTurnos[j][3],
              "estado": rowsTurnos[j][4] ? rowsTurnos[j][4].toString() : "Programado"
            });
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        "resultado": "ok", "nombre": usuarioEncontrado.nombre, "telefono": usuarioEncontrado.telefono, "email": usuarioEncontrado.email, "turnos": listaTurnos
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 3: OBTENER TURNOS OCUPADOS ---
    if (datos.accion === "obtenerOcupados") {
      var ocupados = [];
      if (sheetTurnos) {
        var rowsTurnos = sheetTurnos.getDataRange().getValues();
        for (var k = 1; k < rowsTurnos.length; k++) {
          var fechaFila = formatearFechaParaAppsScript(rowsTurnos[k][1]);
          if (fechaFila === datos.fecha && String(rowsTurnos[k][4]).toLowerCase() !== "cancelado" && String(rowsTurnos[k][4]).toLowerCase() !== "atendido") {
            var horaFila = formatearHoraParaAppsScript(rowsTurnos[k][2]);
            if (horaFila) {
              ocupados.push(horaFila);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({"resultado": "ok", "ocupados": ocupados})).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 4: RESERVAR UN TURNO (MERCADO PAGO) ---
    if (datos.accion === "reservarTurno") {
      if (!sheetTurnos) {
        return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": "No se encontró la pestaña Turnos"})).setMimeType(ContentService.MimeType.JSON);
      }
      let urlScript = ScriptApp.getService().getUrl();
      let urlMercadoPago = "https://api.mercadopago.com/checkout/preferences";
      let payload = {
        items: [{ title: "Seña de Turno - La Casa de la Dirección", quantity: 1, currency_id: "ARS", unit_price: MONTO_SEÑA }],
        back_urls: {
          success: urlScript + "?status=approved&email=" + encodeURIComponent(datos.email) + "&fecha=" + datos.fecha + "&horario=" + datos.horario + "&patente=" + encodeURIComponent(datos.patente),
          failure: urlScript + "?status=failed",
          pending: urlScript + "?status=pending"
        },
        auto_return: "approved"
      };
      let opciones = {
        method: "post",
        contentType: "application/json",
        headers: { "Authorization": "Bearer " + MERCADOPAGO_ACCESS_TOKEN.trim(), "Accept": "application/json" },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      let respuesta = UrlFetchApp.fetch(urlMercadoPago, opciones);
      let jsonRes = JSON.parse(respuesta.getContentText());
      if (jsonRes.init_point) {
        return ContentService.createTextOutput(JSON.stringify({ resultado: "mercadopago", urlPago: jsonRes.init_point })).setMimeType(ContentService.MimeType.JSON);
      } else {
        let msgError = jsonRes.message || "Credenciales inválidas.";
        return ContentService.createTextOutput(JSON.stringify({ resultado: "error", mensaje: "Mercado Pago rechazó la orden: " + msgError })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // --- ACCIÓN 5: LISTAR TURNOS (ADMIN) ---
    if (datos.accion === "obtenerTurnosAdmin") {
      var resAdmin = obtenerTurnosAdmin();
      return ContentService.createTextOutput(JSON.stringify(resAdmin)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 6: ARCHIVAR TRABAJO (ADMIN) ---
    if (datos.accion === "guardarTrabajoAdmin") {
      var resTrabajo = registrarTrabajoAdmin(datos.datosTrabajo);
      ejecutarLimpiezaYOrdenamientoCompleto(); 
      return ContentService.createTextOutput(JSON.stringify(resTrabajo)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 7: VER HISTORIAL DE SERVICIOS (CLIENTE) ---
    if (datos.accion === "obtenerHistorialCliente") {
      var resHistorial = obtenerHistorialCliente(datos.emailCliente);
      return ContentService.createTextOutput(JSON.stringify(resHistorial)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 8: REGISTRAR MOVIMIENTO EN HOJA CONTABILIDAD ---
    if (datos.accion === "registrarMovimientoContable") {
      var resMov = registrarMovimientoContabilidad(datos.movimiento);
      return ContentService.createTextOutput(JSON.stringify(resMov)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 9: OBTENER MOVIMIENTOS DE CONTABILIDAD ---
    if (datos.accion === "obtenerMovimientosContables") {
      var resMovs = obtenerMovimientosContabilidad();
      return ContentService.createTextOutput(JSON.stringify(resMovs)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 10: ELIMINAR MOVIMIENTO DE CONTABILIDAD ---
    if (datos.accion === "eliminarMovimientoContable") {
      var resDel = eliminarMovimientoContabilidad(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDel)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 11: GUARDAR O ACTUALIZAR PRESUPUESTO ---
    if (datos.accion === "guardarPresupuesto") {
      var resP = guardarPresupuestoSheet(datos.presupuesto);
      return ContentService.createTextOutput(JSON.stringify(resP)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 12: OBTENER TODOS LOS PRESUPUESTOS ---
    if (datos.accion === "obtenerPresupuestos") {
      var resTodosP = obtenerPresupuestosSheet();
      return ContentService.createTextOutput(JSON.stringify(resTodosP)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 13: ACTUALIZAR ESTADO DE PRESUPUESTO ---
    if (datos.accion === "actualizarEstadoPresupuesto") {
      var resEstP = actualizarEstadoPresupuestoSheet(datos.id, datos.estado);
      return ContentService.createTextOutput(JSON.stringify(resEstP)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 14: BORRAR PRESUPUESTO ---
    if (datos.accion === "borrarPresupuesto") {
      var resDelP = borrarPresupuestoSheet(datos.id, datos.numero, datos.patente);
      return ContentService.createTextOutput(JSON.stringify(resDelP)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 15: CARGAR TURNO POR MOSTRADOR / PRESENCIAL ---
    if (datos.accion === "crearTurnoMostrador") {
      var resMostrador = registrarTurnoMostrador(datos);
      return ContentService.createTextOutput(JSON.stringify(resMostrador)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 16: FACTURAR PRESUPUESTO Y ARCHIVAR EN DETALLES_TURNOS ---
    if (datos.accion === "facturarPresupuestoYArchivar") {
      var resFact = registrarTrabajoDesdePresupuesto(datos.presupuesto);
      return ContentService.createTextOutput(JSON.stringify(resFact)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 17: OBTENER INVENTARIO DE STOCK & REPUESTOS ---
    if (datos.accion === "obtenerStock") {
      var resStock = obtenerStockSheet();
      return ContentService.createTextOutput(JSON.stringify(resStock)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 18: GUARDAR O ACTUALIZAR ITEM DE STOCK ---
    if (datos.accion === "guardarItemStock") {
      var resSaveStock = guardarItemStockSheet(datos.item);
      return ContentService.createTextOutput(JSON.stringify(resSaveStock)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 19: ELIMINAR ITEM DE STOCK ---
    if (datos.accion === "eliminarItemStock") {
      var resDelStock = eliminarItemStockSheet(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDelStock)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 20: REGISTRAR COMPRA DE STOCK (CON IMPACTO EN CONTABILIDAD) ---
    if (datos.accion === "ingresarCompraStock") {
      var resCompraStock = ingresarCompraStockSheet(datos.datos);
      return ContentService.createTextOutput(JSON.stringify(resCompraStock)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 21: MARCAR TURNO COMO ATENDIDO DIRECTAMENTE POR PATENTE ---
    if (datos.accion === "marcarTurnoAtendido") {
      var resAtendido = pasarTurnoAAtendidoPorPatente(datos.patente);
      return ContentService.createTextOutput(JSON.stringify(resAtendido)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 22: CANCELAR TURNO POR INASISTENCIA DEL USUARIO ---
    if (datos.accion === "cancelarTurno") {
      var resCancelado = pasarTurnoACanceladoPorPatente(datos.patente, datos.motivo, datos.fecha);
      return ContentService.createTextOutput(JSON.stringify(resCancelado)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 23: OBTENER REPUESTOS UTILIZADOS (MÓDULO 1) ---
    if (datos.accion === "obtenerRepuestosUsados") {
      var resUsados = obtenerRepuestosUsadosSheet();
      return ContentService.createTextOutput(JSON.stringify(resUsados)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 24: REGISTRAR REPUESTO UTILIZADO (MÓDULO 1 - DESCUENTA STOCK SI EXISTE) ---
    if (datos.accion === "registrarRepuestoUsado") {
      var resRegUso = registrarRepuestoUsadoSheet(datos.uso);
      return ContentService.createTextOutput(JSON.stringify(resRegUso)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 25: ELIMINAR REPUESTO UTILIZADO (MÓDULO 1 - RESTITUYE STOCK) ---
    if (datos.accion === "eliminarRepuestoUsado") {
      var resDelUso = eliminarRepuestoUsadoSheet(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDelUso)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 26: OBTENER COMPRAS DE REPUESTOS (MÓDULO 2 - HOJA COMPRAS_REPUESTOS) ---
    if (datos.accion === "obtenerComprasRepuestos") {
      var resCompras = obtenerComprasRepuestosSheet();
      return ContentService.createTextOutput(JSON.stringify(resCompras)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 27: REGISTRAR COMPRA DE REPUESTOS (MÓDULO 2 - HOJA COMPRAS_REPUESTOS & SUMA A STOCK) ---
    if (datos.accion === "registrarCompraRepuesto") {
      var resRegCompra = registrarCompraRepuestoSheet(datos.compra);
      return ContentService.createTextOutput(JSON.stringify(resRegCompra)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 28: ELIMINAR COMPRA DE REPUESTOS (MÓDULO 2) ---
    if (datos.accion === "eliminarCompraRepuesto") {
      var resDelCompra = eliminarCompraRepuestoSheet(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDelCompra)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 29: OBTENER CUENTAS CORRIENTES ---
    if (datos.accion === "obtenerCuentasCorrientes") {
      var resCC = obtenerCuentasCorrientesSheet();
      return ContentService.createTextOutput(JSON.stringify(resCC)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 30: CREAR MOVIMIENTO CUENTA CORRIENTE (NO IMPACTA CAJA HASTA COBRARSE) ---
    if (datos.accion === "crearMovimientoCuentaCorriente") {
      var resCrearCC = crearMovimientoCuentaCorrienteSheet(datos.item);
      return ContentService.createTextOutput(JSON.stringify(resCrearCC)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 31: COBRAR CUENTA CORRIENTE (CON IMPACTO EN CONTABILIDAD) ---
    if (datos.accion === "cobrarCuentaCorriente") {
      var resCobrarCC = cobrarCuentaCorrienteSheet(datos.id, datos.montoAbonado, datos.metodoPago, datos.comprobante);
      return ContentService.createTextOutput(JSON.stringify(resCobrarCC)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 32: ELIMINAR CUENTA CORRIENTE (REVIERTE EN CONTABILIDAD) ---
    if (datos.accion === "eliminarCuentaCorriente") {
      var resDelCC = eliminarCuentaCorrienteSheet(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resDelCC)).setMimeType(ContentService.MimeType.JSON);
    }

    // --- ACCIÓN 33: INICIAR PAGO TOTAL MERCADO PAGO CUENTA CORRIENTE ---
    if (datos.accion === "iniciarPagoMercadoPagoCC") {
      var resMPCC = iniciarPagoMercadoPagoCCSheet(datos.id);
      return ContentService.createTextOutput(JSON.stringify(resMPCC)).setMimeType(ContentService.MimeType.JSON);
    }
                           
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({"resultado": "error", "mensaje": error.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}

// --- FUNCIONES CONTABILIDAD PARA LA NUEVA HOJA ---
function registrarMovimientoContabilidad(m) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad") || ss.insertSheet("Contabilidad");
  
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Fecha", "Tipo", "Concepto", "Categoria", "Monto", "MetodoPago", "Referencia"]);
  }
  
  var id = m.id || ("MOV-" + new Date().getTime());

  // Protección anti-duplicados por ID y por contenido idéntico
  var mConceptoNorm = String(m.concepto || "").toLowerCase().replace(/\s+/g, " ").trim();
  var mMontoNum = Number(m.monto) || 0;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowId = String(data[i][0]).trim();
    if (rowId === String(id).trim()) {
      return { success: true, id: id, duplicado: true };
    }
    if (m.tipo === "gasto" && String(data[i][2]).toLowerCase() === "gasto") {
      var rowConceptoNorm = String(data[i][3] || "").toLowerCase().replace(/\s+/g, " ").trim();
      var rowMonto = Number(data[i][5]) || 0;
      if (Math.abs(rowMonto - mMontoNum) < 0.01 && (rowConceptoNorm === mConceptoNorm || (mConceptoNorm.indexOf("compra repuestos") !== -1 && rowConceptoNorm.indexOf("compra repuestos") !== -1))) {
        return { success: true, id: rowId, duplicado: true };
      }
    }
  }

  sheet.appendRow([id, "'" + m.fecha, m.tipo, m.concepto, m.categoria, Number(m.monto), m.metodoPago, m.referencia || ""]);
  return { success: true, id: id };
}

function obtenerMovimientosContabilidad() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad");
  if (!sheet) return { success: true, movimientos: [] };
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { success: true, movimientos: [] };
  
  var lista = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row[0] || row[3]) {
      lista.push({
        id: String(row[0] || i),
        fecha: formatearFechaParaAppsScript(row[1]),
        tipo: String(row[2]).toLowerCase(),
        concepto: String(row[3]),
        categoria: String(row[4] || "General"),
        monto: Number(row[5]) || 0,
        metodoPago: String(row[6] || "Efectivo"),
        referencia: String(row[7] || "")
      });
    }
  }
  lista.reverse(); // Más recientes primero
  return { success: true, movimientos: lista };
}

function eliminarMovimientoContabilidad(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Contabilidad");
  if (!sheet) return { success: false, error: "Hoja no encontrada" };
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: true };
}

// --- CONFIRMACIÓN Y ESCRITURA EN EL EXCEL ---
function doGet(e) {
  let params = e.parameter;

  // 1. PAGO TOTAL DE CUENTA CORRIENTE POR MERCADO PAGO (PRIORIDAD)
  if (params.tipo_pago === "cuentacorriente" && params.status === "approved") {
    try {
      cobrarCuentaCorrienteSheet(params.id, Number(params.monto) || 0, "Mercado Pago Online", "MP-ONLINE-" + params.id);
    } catch(errCC) {}
    let htmlExitoCC = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Deuda Cancelada</title><style>body{background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:10px;} .card{border:2px solid #22c55e;padding:35px 20px;max-width:420px;margin:40px auto;background:#0d0d0d;border-radius:8px;box-shadow:0 4px 15px rgba(34,197,94,0.2);} h1{color:#22c55e;margin-top:0;font-size:24px;} .dato{background:#151515;padding:10px;margin:8px 0;border-radius:4px;text-align:left;border:1px solid #222;} .btn{display:inline-block;padding:12px 30px;background:#22c55e;color:#000;text-decoration:none;font-weight:bold;border-radius:4px;margin-top:20px;text-transform:uppercase;font-size:14px;}</style></head><body><div class='card'><h1>¡Deuda Cancelada con Éxito!</h1><p style='color:#aaa;'>Tu pago total mediante Mercado Pago fue acreditado correctamente.</p><div class='dato'>🚗 <strong>Patente:</strong> " + params.patente + "</div><div class='dato'>💰 <strong>Monto Abonado:</strong> $" + params.monto + "</div><a href='#' onclick='window.close();' class='btn'>Cerrar Ventana</a></div><script>if(window.opener){window.opener.location.reload();}</script></body></html>";
    return HtmlService.createHtmlOutput(htmlExitoCC);
  }
  
  // 2. SEÑA DE TURNO REGULAR POR MERCADO PAGO
  if (params.status === "approved") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetTurnos = ss.getSheetByName("Turnos");
    
    if (sheetTurnos) {
      var fechaFormateada = "'" + params.fecha;
      var horarioFormateado = "'" + params.horario;
      sheetTurnos.appendRow([params.email, fechaFormateada, horarioFormateado, params.patente, "Programado"]);
      ejecutarLimpiezaYOrdenamientoCompleto();
    }
    
    // Auto-registrar la seña de $10.000 en Contabilidad como Ingreso
    try {
      registrarMovimientoContabilidad({
        id: "SEÑA-" + new Date().getTime(),
        fecha: params.fecha,
        tipo: "ingreso",
        concepto: "Seña Reserva de Turno Online (" + params.patente + ")",
        categoria: "Seña Mercado Pago",
        monto: MONTO_SEÑA,
        metodoPago: "Mercado Pago",
        referencia: params.patente
      });
    } catch(err) {}

    let htmlExito = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Seña Confirmada</title><style>body{background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:10px;} .card{border:2px solid #e31212;padding:35px 20px;max-width:420px;margin:40px auto;background:#0d0d0d;border-radius:8px;box-shadow:0 4px 15px rgba(227,18,18,0.2);} h1{color:#e31212;margin-top:0;font-size:24px;} .dato{background:#151515;padding:10px;margin:8px 0;border-radius:4px;text-align:left;border:1px solid #222;} .btn{display:inline-block;padding:12px 30px;background:#e31212;color:#fff;text-decoration:none;font-weight:bold;border-radius:4px;margin-top:20px;text-transform:uppercase;font-size:14px;}</style></head><body><div class='card'><h1>¡Seña de Turno Recibida!</h1><p style='color:#aaa;'>Tu pago fue aprobado. Agendamos tu vehículo en el taller con éxito.</p><div class='dato'>🚗 <strong>Patente:</strong> " + params.patente + "</div><div class='dato'>📅 <strong>Día:</strong> " + params.fecha + "</div><div class='dato'>⏰ <strong>Horario:</strong> " + params.horario + " hs</div><a href='#' onclick='window.close();' class='btn'>Finalizar y cerrar</a></div><script>if(window.opener){window.opener.location.reload();}</script></body></html>";
    return HtmlService.createHtmlOutput(htmlExito);
  }
  
  let htmlFallo = "<html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'><title>Pago Cancelado</title></head><body style='background:#000;color:#fff;text-align:center;font-family:sans-serif;padding:10px;'><div style='border:2px solid #555;padding:35px 20px;max-width:420px;margin:40px auto;background:#0d0d0d;border-radius:8px;'><h1 style='color:#ff3333;margin-top:0;'>Pago no Procesado</h1><p style='color:#aaa;'>No se pudo completar el cobro de la seña del turno. La reserva quedó cancelada y el horario sigue disponible.</p><a href='#' onclick='window.close();' style='color:#fff;font-weight:bold;'>Volver a intentar</a></div></body></html>";
  return HtmlService.createHtmlOutput(htmlFallo);
}

// CORRECCIÓN: PASA A ATENDIDO Y ORDENA (PENDIENTES ARRIBA, HISTORIAL ABAJO)
function ejecutarLimpiezaYOrdenamientoCompleto() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  if (!sheetTurnos) return;
  var lastRow = sheetTurnos.getLastRow();
  if (lastRow <= 1) return;
  
  var range = sheetTurnos.getRange(2, 1, lastRow - 1, 5);
  var data = range.getValues();
  var hoyStr = getFechaHoyArgentinaAppsScript();
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][1] && data[i][4].toString().toLowerCase() === "programado") {
      var fTurnoStr = formatearFechaParaAppsScript(data[i][1]);
      if (fTurnoStr && fTurnoStr < hoyStr) {
        data[i][4] = "Atendido";
      }
    }
  }
  
  var futuros = data.filter(function(r) { return r[4].toString().toLowerCase() === "programado"; });
  var pasados = data.filter(function(r) { return r[4].toString().toLowerCase() !== "programado"; });
  
  futuros.sort(function(a,b) { 
    var fa = formatearFechaParaAppsScript(a[1]) + " " + a[2].toString().replace("'","");
    var fb = formatearFechaParaAppsScript(b[1]) + " " + b[2].toString().replace("'","");
    return fa.localeCompare(fb);
  });
  pasados.sort(function(a,b) { 
    var fa = formatearFechaParaAppsScript(a[1]) + " " + a[2].toString().replace("'","");
    var fb = formatearFechaParaAppsScript(b[1]) + " " + b[2].toString().replace("'","");
    return fb.localeCompare(fa);
  });
  
  range.setValues(futuros.concat(pasados));
}

function limpiarPatenteParaComparacion(p) {
  if (!p) return "";
  return p.toString().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().trim();
}

function pasarTurnoAAtendidoPorPatente(patente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  if (!sheetTurnos) return { success: false, error: "No se encontró hoja Turnos" };
  
  var target = limpiarPatenteParaComparacion(patente);
  if (!target) return { success: false, error: "Patente vacía" };
  
  var lastRow = sheetTurnos.getLastRow();
  if (lastRow <= 1) return { success: true, actualizados: 0 };
  
  var data = sheetTurnos.getDataRange().getValues();
  var actualizados = 0;
  
  for (var i = 1; i < data.length; i++) {
    var patFila = limpiarPatenteParaComparacion(data[i][3]);
    var estFila = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "";
    if (patFila === target && estFila !== "atendido" && estFila !== "cancelado") {
      sheetTurnos.getRange(i + 1, 5).setValue("Atendido");
      actualizados++;
    }
  }
  
  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true, actualizados: actualizados };
}

function pasarTurnoACanceladoPorPatente(patente, motivo, fecha) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  if (!sheetTurnos) return { success: false, error: "No se encontró hoja Turnos" };
  
  var target = limpiarPatenteParaComparacion(patente);
  if (!target) return { success: false, error: "Patente vacía" };
  
  var lastRow = sheetTurnos.getLastRow();
  if (lastRow <= 1) return { success: true, actualizados: 0 };
  
  var fechaTarget = fecha ? formatearFechaParaAppsScript(fecha) : "";
  var hoyStr = getFechaHoyArgentinaAppsScript();
  var data = sheetTurnos.getDataRange().getValues();
  var actualizados = 0;
  
  for (var i = 1; i < data.length; i++) {
    var patFila = limpiarPatenteParaComparacion(data[i][3]);
    var estFila = data[i][4] ? data[i][4].toString().trim().toLowerCase() : "";
    var fechaFila = formatearFechaParaAppsScript(data[i][1]);
    
    if (patFila === target && estFila !== "atendido" && estFila !== "cancelado") {
      // Si se especificó fecha exacta para cancelar:
      if (fechaTarget) {
        if (fechaFila === fechaTarget) {
          sheetTurnos.getRange(i + 1, 5).setValue("Cancelado");
          actualizados++;
          break; // Cancelar solo el turno específico seleccionado
        }
      } else {
        // Si no se envió fecha, cancelar solo si es de hoy o anterior, NUNCA cancelar un turno futuro de mañana
        if (!fechaFila || fechaFila <= hoyStr) {
          sheetTurnos.getRange(i + 1, 5).setValue("Cancelado");
          actualizados++;
        }
      }
    }
  }
  
  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true, actualizados: actualizados };
}

function obtenerTurnosAdmin() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Turnos");
  var sheetUsuarios = ss.getSheetByName("Usuarios") || ss.getSheetByName("Clientes") || ss.getSheets()[0];
  if (!sheet) return { success: true, turnos: [], usuarios: [] };
  var datos = sheet.getDataRange().getValues();

  var mapaUsuarios = {};
  var listaUsuarios = [];
  if (sheetUsuarios) {
    var datosU = sheetUsuarios.getDataRange().getValues();
    for (var u = 1; u < datosU.length; u++) {
      if (datosU[u][2]) {
        var emKey = datosU[u][2].toString().toLowerCase().trim();
        var uItem = {
          email: emKey,
          nombre: datosU[u][0] ? datosU[u][0].toString() : "",
          telefono: datosU[u][1] ? datosU[u][1].toString() : ""
        };
        mapaUsuarios[emKey] = uItem;
        listaUsuarios.push(uItem);
      }
    }
  }

  var pendientes = [];
  for (var i = 1; i < datos.length; i++) {
    var estadoCelda = datos[i][4] ? datos[i][4].toString().toLowerCase().trim() : "";
    if (estadoCelda === "programado") {
      var em = datos[i][0] ? datos[i][0].toString() : "";
      var uInfo = mapaUsuarios[em.toLowerCase().trim()] || {};
      pendientes.push({ 
        email: em, 
        fecha: formatearFechaParaAppsScript(datos[i][1]), 
        horario: formatearHoraParaAppsScript(datos[i][2]), 
        patente: datos[i][3],
        nombre: uInfo.nombre || "",
        telefono: uInfo.telefono || ""
      });
    }
  }
  return { success: true, turnos: pendientes, usuarios: listaUsuarios };
}

// --- FUNCIONES PRESUPUESTOS (HOJA 'Presupuestos') ---
function obtenerPresupuestosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Presupuestos") || ss.insertSheet("Presupuestos");
  if (sheet.getLastRow() <= 1) return { resultado: "ok", presupuestos: [] };
  var datos = sheet.getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < datos.length; i++) {
    var itemsParsed = [];
    try { itemsParsed = JSON.parse(datos[i][10]); } catch(e) {}
    lista.push({
      id: datos[i][0] ? datos[i][0].toString() : "",
      numero: datos[i][1] ? datos[i][1].toString() : "",
      fecha: formatearFechaParaAppsScript(datos[i][2]), 
      validezDias: Number(datos[i][3]) || 7,
      clienteNombre: datos[i][4] ? datos[i][4].toString() : "",
      clienteTelefono: datos[i][5] ? datos[i][5].toString() : "",
      clienteEmail: datos[i][6] ? datos[i][6].toString() : "",
      vehiculoModelo: datos[i][7] ? datos[i][7].toString() : "",
      patente: datos[i][8] ? datos[i][8].toString() : "",
      kilometraje: datos[i][9] ? datos[i][9].toString() : "",
      items: itemsParsed,
      descuentoPorcentaje: Number(datos[i][11]) || 0,
      total: Number(datos[i][12]) || 0,
      estado: datos[i][13] ? datos[i][13].toString() : "pendiente",
      observaciones: datos[i][14] ? datos[i][14].toString() : "",
      turnoRef: datos[i][15] ? datos[i][15].toString() : "",
      createdAt: datos[i][16] ? datos[i][16].toString() : ""
    });
  }
  return { resultado: "ok", presupuestos: lista };
}

function guardarPresupuestoSheet(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Presupuestos") || ss.insertSheet("Presupuestos");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Numero", "Fecha", "ValidezDias", "ClienteNombre", "ClienteTelefono", "ClienteEmail", "VehiculoModelo", "Patente", "Kilometraje", "ItemsJSON", "DescuentoPorcentaje", "Total", "Estado", "Observaciones", "TurnoRef", "FechaCreacion"]);
  }
  var datos = sheet.getDataRange().getValues();
  var filaModificar = -1;
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString() === p.id.toString()) {
      filaModificar = i + 1;
      break;
    }
  }
  var fila = [
    p.id, p.numero, p.fecha, p.validezDias || 7, p.clienteNombre || "", p.clienteTelefono || "",
    p.clienteEmail || "", p.vehiculoModelo || "", p.patente || "", p.kilometraje || "",
    JSON.stringify(p.items || []), p.descuentoPorcentaje || 0, p.total || 0,
    p.estado || "pendiente", p.observaciones || "", p.turnoRef || "", p.createdAt || new Date().toISOString()
  ];
  if (filaModificar > 0) {
    sheet.getRange(filaModificar, 1, 1, fila.length).setValues([fila]);
  } else {
    sheet.appendRow(fila);
  }
  return { resultado: "ok" };
}

function actualizarEstadoPresupuestoSheet(id, estado) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Presupuestos");
  if (!sheet) return { resultado: "ok" };
  var datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString() === id.toString()) {
      sheet.getRange(i + 1, 14).setValue(estado);
      break;
    }
  }
  return { resultado: "ok" };
}

function borrarPresupuestoSheet(id, numero, patente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Presupuestos");
  var pNumero = numero ? String(numero) : "";
  var pPatente = patente ? String(patente) : "";
  if (sheet) {
    var datos = sheet.getDataRange().getValues();
    for (var i = 1; i < datos.length; i++) {
      if (datos[i][0] && datos[i][0].toString() === id.toString()) {
        if (!pNumero && datos[i][1]) pNumero = String(datos[i][1]);
        if (!pPatente && datos[i][5]) pPatente = String(datos[i][5]);
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // Cascada contable: eliminar automáticamente el ingreso generado en la hoja Contabilidad
  var sheetContab = ss.getSheetByName("Contabilidad");
  if (sheetContab) {
    var contabData = sheetContab.getDataRange().getValues();
    var movIdDirecto = "MOV-PRESUP-" + id;
    for (var j = contabData.length - 1; j >= 1; j--) {
      var rowId = String(contabData[j][0] || "");
      var rowConcepto = String(contabData[j][3] || "");
      var rowRef = String(contabData[j][6] || "");
      var matchId = rowId === movIdDirecto || rowId === String(id);
      var matchNum = pNumero && (rowConcepto.indexOf(pNumero) !== -1 || rowRef.indexOf(pNumero) !== -1);
      if (matchId || matchNum) {
        sheetContab.deleteRow(j + 1);
      }
    }
  }

  // Cascada repuestos usados: eliminar de Repuestos_Utilizados
  var sheetUsados = ss.getSheetByName("Repuestos_Utilizados");
  if (sheetUsados && (pNumero || id)) {
    var usadosData = sheetUsados.getDataRange().getValues();
    for (var k = usadosData.length - 1; k >= 1; k--) {
      var presupCol = String(usadosData[k][7] || "");
      if (presupCol === pNumero || presupCol === String(id)) {
        sheetUsados.deleteRow(k + 1);
      }
    }
  }

  return { resultado: "ok" };
}

function registrarTurnoMostrador(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos") || ss.insertSheet("Turnos");
  var sheetUsuarios = ss.getSheetByName("Usuarios") || ss.getSheetByName("Clientes") || ss.getSheets()[0];

  if (sheetTurnos.getLastRow() === 0) {
    sheetTurnos.appendRow(["Email", "Fecha", "Horario", "Patente", "Estado"]);
  }

  var patenteFmt = d.patente ? d.patente.toString().trim().toUpperCase() : "MOSTRADOR";
  var emailCliente = d.email ? d.email.toString().trim().toLowerCase() : (patenteFmt.toLowerCase() + "@mostrador.taller");
  var fechaFmt = "'" + d.fecha;
  var horaFmt = "'" + d.horario;

  // Guardar en hoja Turnos exactamente con el mismo formato que los turnos sacados por la web
  sheetTurnos.appendRow([emailCliente, fechaFmt, horaFmt, patenteFmt, "Programado"]);

  // CREAR O ACTUALIZAR USUARIO AUTOMÁTICAMENTE CON CONTRASEÑA 123456
  if (sheetUsuarios) {
    if (sheetUsuarios.getLastRow() === 0) {
      sheetUsuarios.appendRow(["Nombre", "Teléfono", "Email", "Password", "FechaRegistro"]);
    }
    var datosU = sheetUsuarios.getDataRange().getValues();
    var existe = false;
    for (var u = 1; u < datosU.length; u++) {
      if (datosU[u][2] && datosU[u][2].toString().toLowerCase().trim() === emailCliente) {
        existe = true;
        if (d.nombre) sheetUsuarios.getRange(u + 1, 1).setValue(d.nombre);
        if (d.telefono) sheetUsuarios.getRange(u + 1, 2).setValue(d.telefono);
        var passActual = datosU[u][3] ? datosU[u][3].toString().trim() : "";
        if (!passActual) {
          sheetUsuarios.getRange(u + 1, 4).setValue("123456");
        }
        break;
      }
    }
    if (!existe) {
      sheetUsuarios.appendRow([
        d.nombre || "Cliente Mostrador",
        d.telefono || "",
        emailCliente,
        "123456",
        "Alta Automática Mostrador - " + new Date().toISOString()
      ]);
    }
  }

  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true, mensaje: "Turno y usuario creados exitosamente." };
}

function registrarTrabajoDesdePresupuesto(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos") || ss.insertSheet("Detalles_Turnos");
  
  if (sheetDetalles.getLastRow() === 0) {
    sheetDetalles.appendRow(["Email", "Fecha", "Horario", "Patente", "Modelo", "Kilometraje", "Trabajo Realizado", "Monto Final", "NroPresupuesto"]);
  }
  
  var emailCliente = p.clienteEmail ? p.clienteEmail.toString().trim().toLowerCase() : (p.patente ? (p.patente.toString().trim().toLowerCase() + "@cliente.taller") : "");
  var fechaFmt = p.fecha ? formatearFechaParaAppsScript(p.fecha) : getFechaHoyArgentinaAppsScript();
  var horaFmt = p.horario || "";
  var patenteFmt = p.patente ? p.patente.toString().trim().toUpperCase() : "";
  var modeloFmt = p.vehiculoModelo ? p.vehiculoModelo.toString().trim() : "";
  var kmFmt = p.kilometraje ? p.kilometraje.toString().trim() : "";

  // Desglose de los items y repuestos presupuestados
  var trabajoResumen = "";
  if (Array.isArray(p.items) && p.items.length > 0) {
    trabajoResumen = p.items.map(function(it) {
      var cant = (it.cantidad && Number(it.cantidad) > 1) ? (it.cantidad + "x ") : "";
      return cant + it.descripcion;
    }).join(" + ");
  } else {
    trabajoResumen = p.observaciones || "Servicio Integral Taller";
  }

  var montoFmt = Number(p.total) || 0;
  var nroPres = p.numero || "";

  // 1. SIEMPRE pasar el turno a 'Atendido' en la hoja 'Turnos' buscando la patente
  if (sheetTurnos && patenteFmt) {
    pasarTurnoAAtendidoPorPatente(patenteFmt);
  }

  // 2. SIEMPRE actualizar el estado del presupuesto a 'facturado' en la hoja 'Presupuestos'
  if (p.id) {
    try {
      actualizarEstadoPresupuestoSheet(p.id, "facturado");
    } catch(ePres) {}
  }

  // 3. Impactar en la hoja 'Stock': sumar a rotación de repuestos y descontar si hay stock físico (respetando la fecha del turno/presupuesto)
  if (Array.isArray(p.items) && p.items.length > 0) {
    try {
      actualizarRotacionStockSheet(p.items, modeloFmt || patenteFmt, fechaFmt, { patente: patenteFmt, cliente: p.clienteNombre || "", presupuestoId: nroPres });
    } catch(eStock) {}
  }

  // 4. Registrar en Detalles_Turnos (evitando duplicar fila en el historial)
  var yaExisteEnDetalles = false;
  if (sheetDetalles.getLastRow() > 1) {
    var datosDetalles = sheetDetalles.getDataRange().getValues();
    for (var d = 1; d < datosDetalles.length; d++) {
      var nroPresFila = datosDetalles[d][8] ? datosDetalles[d][8].toString().trim() : "";
      if (nroPres && nroPresFila === nroPres) {
        yaExisteEnDetalles = true;
        break;
      }
    }
  }

  if (!yaExisteEnDetalles) {
    sheetDetalles.appendRow([
      emailCliente,
      "'" + fechaFmt,
      horaFmt ? ("'" + horaFmt) : "",
      patenteFmt,
      modeloFmt,
      kmFmt,
      trabajoResumen,
      montoFmt,
      nroPres
    ]);
  }

  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true };
}

function registrarTrabajoAdmin(datosTrabajo) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetTurnos = ss.getSheetByName("Turnos");
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos") || ss.insertSheet("Detalles_Turnos");
  
  if (sheetDetalles.getLastRow() === 0) {
    sheetDetalles.appendRow(["Email", "Fecha", "Horario", "Patente", "Modelo", "Kilometraje", "Trabajo Realizado", "Monto Final", "NroPresupuesto"]);
  }
  
  var fechaFmtAdmin = datosTrabajo.fecha ? formatearFechaParaAppsScript(datosTrabajo.fecha) : getFechaHoyArgentinaAppsScript();
  sheetDetalles.appendRow([
    datosTrabajo.email,
    "'" + fechaFmtAdmin,
    datosTrabajo.horario ? ("'" + datosTrabajo.horario) : "",
    datosTrabajo.patente,
    datosTrabajo.modelo || "",
    datosTrabajo.kilometraje,
    datosTrabajo.trabajoRealizado,
    datosTrabajo.montoFinal,
    ""
  ]);
  
  // SIEMPRE marcar en 'Turnos' a 'Atendido'
  if (sheetTurnos && datosTrabajo.patente) {
    pasarTurnoAAtendidoPorPatente(datosTrabajo.patente);
  }

  // Actualizar rotación histórica en la hoja 'Stock'
  if (datosTrabajo && datosTrabajo.trabajoRealizado) {
    try {
      actualizarRotacionDesdeTextoAdminSheet(datosTrabajo.trabajoRealizado, datosTrabajo.modelo || "", fechaFmtAdmin, { patente: datosTrabajo.patente, cliente: datosTrabajo.email });
    } catch(eStockAdmin) {}
  }

  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true };
}

// --- FUNCIONES MÓDULO 1: REPUESTOS UTILIZADOS & ROTACIÓN ---
function obtenerRepuestosUsadosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repuestos_Utilizados");
  if (!sheet) {
    sheet = ss.insertSheet("Repuestos_Utilizados");
    sheet.appendRow(["ID", "Fecha", "Repuesto", "Vehiculo", "Cantidad", "Patente", "Cliente", "Origen", "PresupuestoID", "Observaciones"]);
    return { resultado: "ok", items: [] };
  }
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { resultado: "ok", items: [] };
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (r[0] || r[2]) {
      items.push({
        id: String(r[0] || "USO-" + i),
        fecha: formatearFechaParaAppsScript(r[1]) || String(r[1] || ""),
        repuestoNombre: String(r[2] || ""),
        vehiculo: String(r[3] || ""),
        cantidad: Number(r[4]) || 1,
        patente: String(r[5] || ""),
        cliente: String(r[6] || ""),
        origen: String(r[7] || "manual"),
        presupuestoId: String(r[8] || ""),
        observaciones: String(r[9] || "")
      });
    }
  }
  items.reverse();
  return { resultado: "ok", items: items };
}

function registrarRepuestoUsadoSheet(uso) {
  if (!uso) return { resultado: "error", mensaje: "Datos vacíos" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repuestos_Utilizados") || ss.insertSheet("Repuestos_Utilizados");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Fecha", "Repuesto", "Vehiculo", "Cantidad", "Patente", "Cliente", "Origen", "PresupuestoID", "Observaciones"]);
  }
  var id = uso.id || ("USO-" + new Date().getTime());
  var fechaFmt = uso.fecha ? formatearFechaParaAppsScript(uso.fecha) : getFechaHoyArgentinaAppsScript();
  var cant = Number(uso.cantidad) || 1;
  var descTrim = String(uso.repuestoNombre || "").trim();
  var vehTrim = String(uso.vehiculo || "").trim();
  var nombreUnificado = (vehTrim && descTrim.toUpperCase().indexOf(vehTrim.toUpperCase()) === -1)
    ? (descTrim + " - " + vehTrim)
    : descTrim;
  var patTrim = uso.patente ? uso.patente.toString().toUpperCase().trim() : "";
  var presIdTrim = uso.presupuestoId ? uso.presupuestoId.toString().trim() : "";

  // Evitar duplicados si ya existe el mismo ID o el mismo presupuesto y repuesto
  if (sheet.getLastRow() > 1) {
    var dataUsados = sheet.getDataRange().getValues();
    for (var u = 1; u < dataUsados.length; u++) {
      var idFila = String(dataUsados[u][0] || "").trim();
      var presFila = String(dataUsados[u][8] || "").trim();
      var repFila = String(dataUsados[u][2] || "").trim().toUpperCase();
      if (idFila === id) {
        return { resultado: "ok", success: true, id: id, yaExistia: true };
      }
      if (presIdTrim && presFila === presIdTrim && repFila === nombreUnificado.toUpperCase()) {
        return { resultado: "ok", success: true, id: idFila, yaExistia: true };
      }
    }
  }

  sheet.appendRow([
    id,
    "'" + fechaFmt,
    nombreUnificado,
    vehTrim,
    cant,
    patTrim,
    uso.cliente ? uso.cliente.toString().trim() : "",
    uso.origen || "manual",
    presIdTrim,
    uso.observaciones || ""
  ]);

  // Descontar automáticamente del inventario físico en la hoja Stock si existe la pieza
  // (se omite si la aplicación web ya gestiona el descuento de forma autoritativa)
  if (!uso.yaDescontadoEnWeb && !uso.omitirDescuentoStock) {
    try {
      var stockSheet = ss.getSheetByName("Stock");
      if (stockSheet) {
        var sData = stockSheet.getDataRange().getValues();
        var nomNorm = nombreUnificado.toUpperCase();
        for (var s = 1; s < sData.length; s++) {
          var sNom = String(sData[s][1] || "").trim().toUpperCase();
          if (sNom && (sNom === nomNorm || nomNorm.indexOf(sNom) !== -1 || sNom.indexOf(nomNorm) !== -1)) {
            var stockActual = Number(sData[s][4]) || 0;
            var totalInstalados = Number(sData[s][8]) || 0;
            var nuevoStock = Math.max(0, stockActual - cant);
            var nuevosInstalados = totalInstalados + cant;
            stockSheet.getRange(s + 1, 5).setValue(nuevoStock);
            stockSheet.getRange(s + 1, 9).setValue(nuevosInstalados);
            stockSheet.getRange(s + 1, 10).setValue("'" + fechaFmt);
            break;
          }
        }
      }
    } catch (errStock) {}
  }

  return { resultado: "ok", success: true, id: id };
}

function eliminarRepuestoUsadoSheet(id) {
  if (!id) return { resultado: "error" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Repuestos_Utilizados");
  if (!sheet) return { resultado: "ok" };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { resultado: "ok", success: true };
}

// --- FUNCIONES MÓDULO 2: STOCK & INVENTARIO ---
function obtenerStockSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Stock");
  if (!sheet) {
    sheet = ss.insertSheet("Stock");
    sheet.appendRow(["ID", "Nombre", "Categoria", "VehiculoCompatibilidad", "StockActual", "StockMinimo", "CostoUnitario", "PrecioVenta", "TotalInstalados", "UltimoMovimiento"]);
    return { resultado: "ok", items: [] };
  }
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { resultado: "ok", items: [] };
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (r[0] || r[1]) {
      items.push({
        id: String(r[0] || "STOCK-" + i),
        nombre: String(r[1] || ""),
        categoria: String(r[2] || "Tren Delantero / Suspensión"),
        vehiculoCompatibilidad: String(r[3] || "Multimarca"),
        stockActual: Number(r[4]) || 0,
        stockMinimo: Number(r[5]) || 2,
        costoUnitario: Number(r[6]) || 0,
        precioVenta: Number(r[7]) || 0,
        totalInstalados: Number(r[8]) || 0,
        ultimoMovimiento: formatearFechaParaAppsScript(r[9]) || String(r[9] || "")
      });
    }
  }
  return { resultado: "ok", items: items };
}

function guardarItemStockSheet(item) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Stock") || ss.insertSheet("Stock");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Nombre", "Categoria", "VehiculoCompatibilidad", "StockActual", "StockMinimo", "CostoUnitario", "PrecioVenta", "TotalInstalados", "UltimoMovimiento"]);
  }
  var data = sheet.getDataRange().getValues();
  var idTarget = String(item.id || "");
  var nomTarget = String(item.nombre || "").trim().toUpperCase();
  var filaEncontrada = -1;
  for (var i = 1; i < data.length; i++) {
    if ((idTarget && String(data[i][0]) === idTarget) || (String(data[i][1]).trim().toUpperCase() === nomTarget)) {
      filaEncontrada = i + 1;
      break;
    }
  }
  var fila = [
    item.id,
    item.nombre,
    item.categoria || "Tren Delantero / Suspensión",
    item.vehiculoCompatibilidad || "Multimarca",
    Number(item.stockActual) || 0,
    Number(item.stockMinimo) || 2,
    Number(item.costoUnitario) || 0,
    Number(item.precioVenta) || 0,
    Number(item.totalInstalados) || 0,
    item.ultimoMovimiento ? ("'" + formatearFechaParaAppsScript(item.ultimoMovimiento)) : ("'" + getFechaHoyArgentinaAppsScript())
  ];
  if (filaEncontrada > 0) {
    sheet.getRange(filaEncontrada, 1, 1, fila.length).setValues([fila]);
  } else {
    sheet.appendRow(fila);
  }
  return { resultado: "ok", success: true };
}

function eliminarItemStockSheet(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Stock");
  if (!sheet) return { resultado: "ok", success: true };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
  return { resultado: "ok", success: true };
}

function ingresarCompraStockSheet(datos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Stock") || ss.insertSheet("Stock");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Nombre", "Categoria", "VehiculoCompatibilidad", "StockActual", "StockMinimo", "CostoUnitario", "PrecioVenta", "TotalInstalados", "UltimoMovimiento"]);
  }
  var data = sheet.getDataRange().getValues();
  var nomItem = "";
  var fechaCompra = datos.fecha ? formatearFechaParaAppsScript(datos.fecha) : getFechaHoyArgentinaAppsScript();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(datos.id)) {
      var stockPrev = Number(data[i][4]) || 0;
      var nuevoStock = stockPrev + Number(datos.cantidad);
      nomItem = String(data[i][1] || "");
      sheet.getRange(i + 1, 5).setValue(nuevoStock);
      if (datos.costoUnitario && Number(datos.costoUnitario) > 0) {
        sheet.getRange(i + 1, 7).setValue(Number(datos.costoUnitario));
      } else if (datos.costoTotal && Number(datos.cantidad) > 0) {
        sheet.getRange(i + 1, 7).setValue(Math.round(Number(datos.costoTotal) / Number(datos.cantidad)));
      }
      sheet.getRange(i + 1, 10).setValue("'" + fechaCompra);
      break;
    }
  }
  // Si solicitó impactar en Contabilidad como gasto
  if (datos.registrarEnContabilidad && Number(datos.costoTotal) > 0) {
    registrarMovimientoContabilidad({
      id: "MOV-STOCK-" + new Date().getTime(),
      fecha: fechaCompra,
      tipo: "gasto",
      concepto: "Compra Stock: " + datos.cantidad + "x " + (nomItem || "Repuestos"),
      categoria: "Repuestos / Repuesteros",
      monto: Number(datos.costoTotal),
      metodoPago: datos.metodoPago || "Efectivo",
      referencia: "STOCK REPUESTOS"
    });
  }
  return { resultado: "ok", success: true };
}

function obtenerComprasRepuestosSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Compras_Repuestos");
  if (!sheet) {
    sheet = ss.insertSheet("Compras_Repuestos");
    sheet.appendRow(["ID", "Fecha", "Repuesto", "Vehiculo", "Categoria", "Cantidad", "CostoUnitario", "CostoTotal", "Proveedor", "MetodoPago", "ImpactaContabilidad", "Comprobante"]);
    return { resultado: "ok", items: [] };
  }
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { resultado: "ok", items: [] };
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (r[0] || r[2]) {
      items.push({
        id: String(r[0] || "COMPRA-" + i),
        fecha: formatearFechaParaAppsScript(r[1]) || String(r[1] || ""),
        repuestoNombre: String(r[2] || ""),
        vehiculoCompatibilidad: String(r[3] || ""),
        categoria: String(r[4] || "Tren Delantero / Suspensión"),
        cantidad: Number(r[5]) || 0,
        costoUnitario: Number(r[6]) || 0,
        costoTotal: Number(r[7]) || 0,
        proveedor: String(r[8] || ""),
        metodoPago: String(r[9] || "Efectivo"),
        impactaContabilidad: String(r[10]).toUpperCase() === "SI" || r[10] === true || Number(r[7]) > 0,
        comprobante: String(r[11] || "")
      });
    }
  }
  items.reverse();
  return { resultado: "ok", items: items };
}

function registrarCompraRepuestoSheet(compra) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetCompras = ss.getSheetByName("Compras_Repuestos") || ss.insertSheet("Compras_Repuestos");
  if (sheetCompras.getLastRow() === 0) {
    sheetCompras.appendRow(["ID", "Fecha", "Repuesto", "Vehiculo", "Categoria", "Cantidad", "CostoUnitario", "CostoTotal", "Proveedor", "MetodoPago", "ImpactaContabilidad", "Comprobante"]);
  }

  var id = compra.id || ("COMPRA-" + new Date().getTime());
  var fechaFmt = compra.fecha ? formatearFechaParaAppsScript(compra.fecha) : getFechaHoyArgentinaAppsScript();
  var repuestoNom = String(compra.repuestoNombre || "").trim().toUpperCase();
  var veh = String(compra.vehiculoCompatibilidad || "").trim();
  var cat = String(compra.categoria || "Tren Delantero / Suspensión").trim();
  var cant = Number(compra.cantidad) || 0;
  var costoUnit = Number(compra.costoUnitario) || 0;
  var costoTotal = Number(compra.costoTotal) || 0;
  var prov = String(compra.proveedor || "").trim();
  var metodo = String(compra.metodoPago || "Efectivo").trim();
  var impactaCont = compra.impactaContabilidad === true;
  var comp = String(compra.comprobante || "").trim();

  // 1. Guardar fila en Compras_Repuestos
  sheetCompras.appendRow([
    id,
    "'" + fechaFmt,
    repuestoNom,
    veh,
    cat,
    cant,
    costoUnit,
    costoTotal,
    prov,
    metodo,
    impactaCont ? "SI" : "NO",
    comp
  ]);

  // 2. Sumar unidades e impactar en hoja 'Stock'
  var sheetStock = ss.getSheetByName("Stock") || ss.insertSheet("Stock");
  if (sheetStock.getLastRow() === 0) {
    sheetStock.appendRow(["ID", "Nombre", "Categoria", "VehiculoCompatibilidad", "StockActual", "StockMinimo", "CostoUnitario", "PrecioVenta", "TotalInstalados", "UltimoMovimiento"]);
  }

  var dataStock = sheetStock.getDataRange().getValues();
  var filaStockEncontrada = -1;
  var repuestoSimple = repuestoNom.split(" - ")[0].trim();

  for (var s = 1; s < dataStock.length; s++) {
    var nomEnStock = String(dataStock[s][1] || "").trim().toUpperCase();
    var vehEnStock = String(dataStock[s][3] || "").trim().toUpperCase();

    if (nomEnStock === repuestoNom || (veh && nomEnStock === (repuestoNom + " - " + veh.toUpperCase())) || (veh && nomEnStock === (repuestoSimple + " - " + veh.toUpperCase()))) {
      filaStockEncontrada = s + 1;
      break;
    }
  }

  if (filaStockEncontrada > 0) {
    var stockPrev = Number(dataStock[filaStockEncontrada - 1][4]) || 0;
    var nuevoStock = stockPrev + cant;
    sheetStock.getRange(filaStockEncontrada, 5).setValue(nuevoStock);
    if (costoUnit > 0) {
      sheetStock.getRange(filaStockEncontrada, 7).setValue(costoUnit);
    }
    sheetStock.getRange(filaStockEncontrada, 10).setValue("'" + fechaFmt);
  } else {
    // Si no existía, darlo de alta en el catálogo Stock
    var pVenta = costoUnit > 0 ? Math.round(costoUnit * 1.4) : 0;
    sheetStock.appendRow([
      "STOCK-" + new Date().getTime(),
      repuestoNom,
      cat,
      veh || "Multimarca",
      cant,
      2,
      costoUnit,
      pVenta,
      0,
      "'" + fechaFmt
    ]);
  }

  // 3. Impactar en Contabilidad (registro único y centralizado)
  if (impactaCont && costoTotal > 0) {
    registrarMovimientoContabilidad({
      id: "MOV-" + id,
      fecha: fechaFmt,
      tipo: "gasto",
      concepto: "Compra Repuestos: " + cant + "x " + repuestoNom + (prov ? (" (" + prov + ")") : ""),
      categoria: "Repuestos / Repuesteros",
      monto: costoTotal,
      metodoPago: metodo,
      referencia: comp ? ("COMPROBANTE " + comp) : "STOCK TALLER"
    });
  }

  return { resultado: "ok", success: true, item: compra };
}

function eliminarCompraRepuestoSheet(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Compras_Repuestos");
  var repuestoNombre = "";
  var costoTotal = 0;
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        repuestoNombre = String(data[i][2] || "");
        costoTotal = Number(data[i][6] || 0);
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // Cascada contable: eliminar automáticamente el gasto generado en la hoja Contabilidad
  var sheetContab = ss.getSheetByName("Contabilidad");
  if (sheetContab) {
    var contabData = sheetContab.getDataRange().getValues();
    var movIdDirecto = "MOV-" + id;
    var movIdStock = "MOV-STOCK-" + id;
    var movIdLower = "mov-" + id;
    for (var j = contabData.length - 1; j >= 1; j--) {
      var rowId = String(contabData[j][0] || "");
      var rowConcepto = String(contabData[j][3] || "");
      var rowMonto = Number(contabData[j][4] || 0);
      var rowRef = String(contabData[j][6] || "");
      var matchId = rowId === movIdDirecto || rowId === movIdStock || rowId === movIdLower || rowId === String(id) || (id && rowRef.indexOf(String(id)) !== -1);
      var matchNombre = repuestoNombre && costoTotal > 0 && rowConcepto.indexOf(repuestoNombre) !== -1 && Math.abs(rowMonto - costoTotal) < 0.01;
      if (matchId || matchNombre) {
        sheetContab.deleteRow(j + 1);
      }
    }
  }

  return { resultado: "ok", success: true };
}

function actualizarRotacionStockSheet(items, vehiculoModelo, fechaMov, meta) {
  if (!items || !items.length) return;
  meta = meta || {};
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fechaFinal = fechaMov ? formatearFechaParaAppsScript(fechaMov) : getFechaHoyArgentinaAppsScript();
  var vehFmt = (vehiculoModelo || "").toString().trim();
  var patFmt = (meta.patente || "").toString().trim().toUpperCase();
  var cliFmt = (meta.cliente || "").toString().trim();
  var presIdFmt = (meta.presupuestoId || "").toString().trim();

  // Registrar exclusivamente en 'Repuestos_Utilizados' (Módulo 1) sin tocar la hoja 'Stock' (Módulo 2 se maneja solo a mano)
  var sheetUsados = ss.getSheetByName("Repuestos_Utilizados") || ss.insertSheet("Repuestos_Utilizados");
  if (sheetUsados.getLastRow() === 0) {
    sheetUsados.appendRow(["ID", "Fecha", "Repuesto", "Vehiculo", "Cantidad", "Patente", "Cliente", "Origen", "PresupuestoID", "Observaciones"]);
  }

  // Prevenir duplicados si ya existen filas de este presupuesto
  var yaRegistradosEnUsados = {};
  if (sheetUsados.getLastRow() > 1 && presIdFmt) {
    var datosU = sheetUsados.getDataRange().getValues();
    for (var du = 1; du < datosU.length; du++) {
      var presU = datosU[du][8] ? datosU[du][8].toString().trim() : "";
      var repU = datosU[du][2] ? datosU[du][2].toString().trim().toUpperCase() : "";
      if (presU && presU === presIdFmt) {
        yaRegistradosEnUsados[presU + "___" + repU] = true;
      }
    }
  }

  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    if (item.tipo !== "repuesto") continue;
    var cant = Number(item.cantidad) || 1;
    var descTrim = String(item.descripcion || "").trim();
    if (!descTrim) continue;

    // Formato estandarizado identico a la carga manual: repuesto - vehiculo
    var nombreUnificado = (vehFmt && descTrim.toUpperCase().indexOf(vehFmt.toUpperCase()) === -1)
      ? (descTrim + " - " + vehFmt)
      : descTrim;
    var targetFull = nombreUnificado.toUpperCase();

    // Registrar en 'Repuestos_Utilizados' (Módulo 1) con formato exacto y sin duplicar
    var claveVerif = presIdFmt ? (presIdFmt + "___" + targetFull) : "";
    if (!claveVerif || !yaRegistradosEnUsados[claveVerif]) {
      var nuevoUsoID = "USO-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
      sheetUsados.appendRow([
        nuevoUsoID,
        "'" + fechaFinal,
        nombreUnificado,
        vehFmt || "",
        cant,
        patFmt,
        cliFmt,
        "facturacion",
        presIdFmt,
        presIdFmt ? ("Facturado automáticamente en Presupuesto #" + presIdFmt) : "Facturado automáticamente desde servicio de taller"
      ]);
      if (claveVerif) yaRegistradosEnUsados[claveVerif] = true;
    }
  }
}

function actualizarRotacionDesdeTextoAdminSheet(textoTrabajo, vehiculoModelo, fechaMov, meta) {
  if (!textoTrabajo) return;
  var partes = String(textoTrabajo).split(" + ");
  var items = [];
  for (var p = 0; p < partes.length; p++) {
    var nom = partes[p].replace(/\s*\[.*\]/, "").trim();
    if (nom) {
      items.push({ tipo: "repuesto", descripcion: nom, cantidad: 1 });
    }
  }
  if (items.length > 0) {
    actualizarRotacionStockSheet(items, vehiculoModelo, fechaMov, meta);
  }
}

function obtenerHistorialCliente(emailCliente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos");
  if (!sheetDetalles) return { success: true, historial: [] };
  
  var datos = sheetDetalles.getDataRange().getValues();
  var historialUsuario = [];
  var vistos = {};
  
  for (var i = 1; i < datos.length; i++) {
    var emailFila = datos[i][0] ? datos[i][0].toString().toLowerCase().trim() : "";
    if (emailFila === emailCliente.toLowerCase().trim()) {
      var tieneColumnaModelo = datos[0] && datos[0].length >= 8 && datos[0][4] && datos[0][4].toString().toLowerCase().indexOf("modelo") !== -1;
      var modeloVal = "";
      var kmVal = "";
      var trabajoVal = "";
      var montoVal = "";
      var nroPresVal = datos[i][8] ? datos[i][8].toString().trim() : "";

      if (tieneColumnaModelo) {
        modeloVal = datos[i][4] ? datos[i][4].toString() : "";
        kmVal = datos[i][5] ? datos[i][5].toString() : "";
        trabajoVal = datos[i][6] ? datos[i][6].toString() : "";
        montoVal = datos[i][7] ? datos[i][7].toString() : "";
      } else {
        kmVal = datos[i][4] ? datos[i][4].toString() : "";
        trabajoVal = datos[i][5] ? datos[i][5].toString() : "";
        montoVal = datos[i][6] ? datos[i][6].toString() : "";
        if (datos[i][7]) modeloVal = datos[i][7].toString();
      }

      var patFila = datos[i][3] ? datos[i][3].toString().toUpperCase().trim() : "";
      var fechaFila = formatearFechaParaAppsScript(datos[i][1]);
      var montoNum = Math.round(Number(montoVal) || 0);
      var keyUnica = nroPresVal ? ("PRES_" + nroPresVal) : (patFila + "_" + fechaFila.substring(0, 10) + "_" + montoNum);

      if (!vistos[keyUnica]) {
        vistos[keyUnica] = true;
        historialUsuario.push({
          fecha: fechaFila,
          horario: datos[i][2] ? datos[i][2].toString() : "",
          patente: patFila,
          modelo: modeloVal,
          kilometraje: kmVal,
          trabajo: trabajoVal,
          monto: montoVal,
          numero: nroPresVal
        });
      }
    }
  }
  historialUsuario.reverse();
  return { success: true, historial: historialUsuario };
}

// --- MÓDULO DE CUENTAS CORRIENTES (HOJA Cuentas_Corrientes) ---
function obtenerCuentasCorrientesSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cuentas_Corrientes");
  if (!sheet) return { resultado: "ok", success: true, items: [] };
  var data = sheet.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    items.push({
      id: String(data[i][0]),
      fecha: data[i][1] ? String(data[i][1]).replace(/^'/, "") : "",
      patente: String(data[i][2] || "").toUpperCase().trim(),
      clienteNombre: String(data[i][3] || ""),
      clienteEmail: String(data[i][4] || ""),
      concepto: String(data[i][5] || ""),
      montoTotal: Number(data[i][6] || 0),
      montoPagado: Number(data[i][7] || 0),
      saldoPendiente: Number(data[i][8] || 0),
      estado: String(data[i][9] || "pendiente"),
      observaciones: String(data[i][10] || ""),
      presupuestoId: String(data[i][11] || ""),
      ultimoPagoFecha: data[i][12] ? String(data[i][12]).replace(/^'/, "") : "",
      metodoUltimoPago: String(data[i][13] || "")
    });
  }
  return { resultado: "ok", success: true, items: items };
}

function crearMovimientoCuentaCorrienteSheet(item) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cuentas_Corrientes") || ss.insertSheet("Cuentas_Corrientes");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Fecha", "Patente", "ClienteNombre", "ClienteEmail", "Concepto", "MontoTotal", "MontoPagado", "SaldoPendiente", "Estado", "Observaciones", "PresupuestoID", "UltimoPagoFecha", "MetodoUltimoPago"]);
  }
  var id = item.id || ("CC-" + new Date().getTime());
  var fecha = item.fecha || getFechaHoyArgentinaAppsScript();
  var pat = String(item.patente || "").toUpperCase().trim();
  var tot = Number(item.montoTotal) || 0;
  var pag = Number(item.montoPagado) || 0;
  var saldo = tot - pag;
  var est = saldo <= 0 ? "pagado" : (pag > 0 ? "parcial" : "pendiente");
  
  sheet.appendRow([
    id,
    "'" + fecha,
    pat,
    item.clienteNombre || "",
    item.clienteEmail || "",
    item.concepto || "",
    tot,
    pag,
    saldo,
    est,
    item.observaciones || "",
    item.presupuestoId || "",
    "",
    ""
  ]);
  return { resultado: "ok", success: true, id: id };
}

function cobrarCuentaCorrienteSheet(id, montoAbonado, metodoPago, comprobante) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cuentas_Corrientes");
  if (!sheet) return { resultado: "error", success: false, mensaje: "Hoja Cuentas_Corrientes no encontrada" };
  
  var data = sheet.getDataRange().getValues();
  var found = false;
  var hoy = getFechaHoyArgentinaAppsScript();
  var patenteItem = "";
  var conceptoItem = "";
  var nuevoPag = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      found = true;
      patenteItem = String(data[i][2] || "");
      conceptoItem = String(data[i][5] || "");
      var tot = Number(data[i][6]) || 0;
      var pagAntes = Number(data[i][7]) || 0;
      var abonado = Number(montoAbonado) || 0;
      nuevoPag = pagAntes + abonado;
      var nuevoSaldo = Math.max(0, tot - nuevoPag);
      var nuevoEst = nuevoSaldo <= 0 ? "pagado" : "parcial";
      
      sheet.getRange(i + 1, 8).setValue(nuevoPag);
      sheet.getRange(i + 1, 9).setValue(nuevoSaldo);
      sheet.getRange(i + 1, 10).setValue(nuevoEst);
      sheet.getRange(i + 1, 13).setValue("'" + hoy);
      sheet.getRange(i + 1, 14).setValue(metodoPago || "Efectivo");
      break;
    }
  }
  
  if (found) {
    registrarMovimientoContabilidad({
      id: "MOV-PAGO-CC-" + id + "-" + (nuevoPag || new Date().getTime()),
      fecha: hoy,
      tipo: "ingreso",
      concepto: "Cobro Cta. Cte.: " + patenteItem + " (" + conceptoItem + ")",
      categoria: "Cobro Cuenta Corriente",
      monto: Number(montoAbonado),
      metodoPago: metodoPago || "Efectivo",
      referencia: comprobante ? (patenteItem + " (" + comprobante + ") [" + id + "]") : (patenteItem + " [" + id + "]")
    });
    return { resultado: "ok", success: true };
  }
  return { resultado: "error", success: false, mensaje: "Cuenta Corriente no encontrada" };
}

function eliminarCuentaCorrienteSheet(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cuentas_Corrientes");
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
  
  var sheetContab = ss.getSheetByName("Contabilidad");
  if (sheetContab) {
    var contabData = sheetContab.getDataRange().getValues();
    var prefijoId = "MOV-PAGO-CC-" + id;
    for (var j = contabData.length - 1; j >= 1; j--) {
      var rowId = String(contabData[j][0] || "");
      var rowRef = String(contabData[j][7] || "");
      if (rowId === prefijoId || rowId.indexOf(prefijoId) === 0 || rowRef.indexOf(id) !== -1) {
        sheetContab.deleteRow(j + 1);
      }
    }
  }
  return { resultado: "ok", success: true };
}

function iniciarPagoMercadoPagoCCSheet(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Cuentas_Corrientes");
  if (!sheet) return { resultado: "error", mensaje: "Hoja Cuentas_Corrientes no encontrada" };
  var data = sheet.getDataRange().getValues();
  var target = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      target = {
        id: String(data[i][0]),
        patente: String(data[i][2] || ""),
        clienteEmail: String(data[i][4] || ""),
        concepto: String(data[i][5] || ""),
        saldoPendiente: Number(data[i][8] || 0)
      };
      break;
    }
  }
  if (!target || target.saldoPendiente <= 0) {
    return { resultado: "error", mensaje: "No hay saldo pendiente a pagar para este registro" };
  }

  var urlScript = ScriptApp.getService().getUrl();
  var urlMercadoPago = "https://api.mercadopago.com/checkout/preferences";
  var payload = {
    items: [{
      title: "Cancelacion Total Cta Cte - " + target.patente + " (" + target.concepto + ")",
      quantity: 1,
      currency_id: "ARS",
      unit_price: Number(target.saldoPendiente)
    }],
    back_urls: {
      success: urlScript + "?tipo_pago=cuentacorriente&status=approved&id=" + encodeURIComponent(target.id) + "&monto=" + encodeURIComponent(target.saldoPendiente) + "&patente=" + encodeURIComponent(target.patente),
      failure: urlScript + "?tipo_pago=cuentacorriente&status=failed",
      pending: urlScript + "?tipo_pago=cuentacorriente&status=pending"
    },
    auto_return: "approved"
  };
  var opciones = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": "Bearer " + MERCADOPAGO_ACCESS_TOKEN.trim(), "Accept": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  var respuesta = UrlFetchApp.fetch(urlMercadoPago, opciones);
  var jsonRes = JSON.parse(respuesta.getContentText());
  if (jsonRes.init_point) {
    return { resultado: "mercadopago", urlPago: jsonRes.init_point };
  } else {
    return { resultado: "error", mensaje: jsonRes.message || "Error al conectar con Mercado Pago" };
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullAppsScriptCode);
    setCopiedScript(true);
    onShowToast('success', '¡Código copiado al portapapeles!', 'Ya podés pegarlo en Extensiones > Apps Script.');
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a la Web</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchTurnos();
                fetchContabilidad();
                fetchPresupuestos();
                fetchStock();
                onShowToast('info', 'Sincronizado', 'Planillas de turnos, presupuestos, stock y caja actualizadas.');
              }}
              disabled={loadingTurnos || loadingContabilidad || loadingStock}
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 font-heading font-bold text-xs uppercase tracking-wider rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTurnos || loadingContabilidad || loadingStock ? 'animate-spin' : ''}`} />
              <span>Sincronizar Sheets</span>
            </button>
          </div>
        </div>

        {/* Header banner */}
        <div className="p-6 rounded-xl bg-neutral-900 border-2 border-red-600 shadow-2xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-red-950 border border-red-800/80 flex items-center justify-center text-red-500 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[11px] font-heading font-black text-red-500 uppercase tracking-widest">
                Administración General · La Casa de la Dirección
              </div>
              <h1 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight">
                Panel de Administración
              </h1>
              <p className="text-xs text-neutral-400">
                Gestión integral de turnos, presupuestos, repuestos e inventario, y caja del taller.
              </p>
            </div>
          </div>

          {activeAdminTab === 'contabilidad' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-200">
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setNuevoTipo('ingreso');
                    setShowModalMovimiento(true);
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Registrar Ingreso</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  startTransition(() => {
                    setNuevoTipo('gasto');
                    setShowModalMovimiento(true);
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-neutral-950 hover:bg-red-950 text-red-400 border border-red-800/60 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <MinusCircle className="w-4 h-4" />
                <span>- Registrar Gasto</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveAdminTab('turnos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'turnos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Car className="w-4 h-4" />
            <span>Turnos Pendientes ({turnos.length})</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('presupuestos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'presupuestos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Presupuestos & Cotizaciones</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('stock')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'stock'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Stock & Repuestos ({stockList.reduce((acc, it) => acc + (Number(it.stockActual) || 0), 0)})</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('contabilidad')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'contabilidad'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Caja & Contabilidad del Taller</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('cuentas_corrientes')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'cuentas_corrientes'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Cuentas Corrientes</span>
          </button>

          <button
            onClick={() => setActiveAdminTab('script')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeAdminTab === 'script'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Código Google Apps Script</span>
          </button>
        </div>

        {/* TAB 1: TURNOS PENDIENTES */}
        {activeAdminTab === 'turnos' && (
          <div className="space-y-6">
            {/* Header con Buscador y Botón Cargar Turno Mostrador */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <label htmlFor={searchInputId} className="sr-only">
                  Buscar por patente o correo electrónico
                </label>
                <Search className="w-4 h-4 text-neutral-500 absolute left-4 top-3.5" />
                <input
                  id={searchInputId}
                  type="text"
                  placeholder="BUSCAR EN TIEMPO REAL POR PATENTE O EMAIL..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-xl pl-11 pr-4 py-3 text-sm font-heading font-bold text-white placeholder-neutral-600 uppercase tracking-wider transition-colors shadow-inner"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const hoyStr = getFechaHoyArgentina();
                    setClienteEncontradoMsg(null);
                    setShowModalTurnoMostrador(true);
                    handleMostradorDateChange(hoyStr);
                  }}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Cargar Turno Mostrador</span>
                </button>
              </div>
            </div>

            {/* Turnos List */}
            <div>
              {loadingTurnos ? (
                <div className="p-16 text-center text-neutral-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                  <span className="font-heading uppercase tracking-wider">Conectando con Google Sheets...</span>
                </div>
              ) : turnos.length === 0 ? (
                <div className="p-12 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="font-heading font-bold text-white text-base uppercase">
                    🎉 ¡Excelente Rodrigo! No quedan turnos pendientes
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Todos los vehículos registrados han sido atendidos o aún no hay nuevas reservas con seña abonada.
                  </p>
                </div>
              ) : filteredTurnos.length === 0 ? (
                <div className="p-8 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center text-neutral-400 text-xs">
                  No se encontraron vehículos que coincidan con &ldquo;{searchTerm}&rdquo;.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTurnos.map((turno, idx) => {
                    const cleanTurnoPat = String(turno.patente || '').trim().toUpperCase();
                    const presupuestoExistente = presupuestos.find(
                      (p) => p.patente.trim().toUpperCase() === cleanTurnoPat && p.estado !== 'rechazado'
                    );

                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-xl bg-[#0a0a0a] border border-neutral-800 border-l-4 border-l-red-600 hover:border-neutral-700 transition-all shadow-lg flex flex-col justify-between gap-4 overflow-hidden"
                      >
                        {/* Datos del Turno */}
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-red-500 shrink-0" />
                              <span className="font-mono text-lg font-black text-white uppercase tracking-wider">
                                {turno.patente}
                              </span>
                            </div>
                            {turno.nombre && (
                              <span className="text-xs text-neutral-400 font-medium truncate max-w-[150px]">
                                {turno.nombre}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                              <span className="font-mono text-white font-bold">{formatearFechaArgentina(turno.fecha)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span className="text-white font-semibold">
                                {formatearHorario(turno.horario)} hs
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                              <Mail className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span className="truncate text-neutral-300">{turno.email}</span>
                            </div>
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        <div className="pt-3 border-t border-neutral-800/80 w-full">
                          {presupuestoExistente ? (
                            <button
                              type="button"
                              onClick={() => setActiveAdminTab('presupuestos')}
                              className="w-full px-4 py-2.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/80 text-emerald-300 text-xs font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                              title={`Ver presupuesto ${presupuestoExistente.numero} ($${presupuestoExistente.total.toLocaleString('es-AR')})`}
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span className="truncate">Presupuesto {presupuestoExistente.numero} (${presupuestoExistente.total.toLocaleString('es-AR')})</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  setMotivoCancelacion('Cliente no se presentó (inasistencia)');
                                  setTurnoACancelar(turno);
                                }}
                                className="shrink-0 px-3 py-2.5 rounded-lg bg-neutral-900 hover:bg-red-950/80 border border-neutral-700 hover:border-red-600 text-neutral-300 hover:text-red-200 text-xs font-heading font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                                title="Cancelar turno si el usuario no asistió (antes de programar)"
                              >
                                <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span>Cancelar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setTurnoParaPresupuesto(turno);
                                  setActiveAdminTab('presupuestos');
                                }}
                                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md shadow-red-950 cursor-pointer"
                                title="Crear Presupuesto / Cotización"
                              >
                                <FileText className="w-4 h-4 shrink-0" />
                                <span className="truncate">+ Presupuestar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PRESUPUESTOS Y COTIZACIONES */}
        {activeAdminTab === 'presupuestos' && (
          <PresupuestosManager
            turnosPendientes={turnos}
            presupuestosList={presupuestos}
            onPresupuestosUpdated={setPresupuestos}
            onRegistrarIngresoCaja={handleRegistrarIngresoDesdePresupuesto}
            onContabilidadUpdated={fetchContabilidad}
            onTurnoAtendido={handleTurnoAtendido}
            onShowToast={onShowToast}
            initialTurnoParaPresupuestar={turnoParaPresupuesto}
            onClearInitialTurno={() => setTurnoParaPresupuesto(null)}
          />
        )}

        {/* TAB: STOCK & ROTACIÓN DE REPUESTOS */}
        {activeAdminTab === 'stock' && (
          <StockManager
            stockList={stockList}
            onStockUpdated={(items) => setStockList(items)}
            onRegistrarGastoContabilidad={handleRegistrarGastoDesdeStock}
            onContabilidadUpdated={fetchContabilidad}
            onShowToast={onShowToast}
          />
        )}

        {/* TAB 2: CONTABILIDAD Y CAJA */}
        {activeAdminTab === 'contabilidad' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Ingresos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-emerald-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Ingresos Totales</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-emerald-400 tabular-nums">
                  ${totalIngresos.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Cobros de taller y señas</p>
              </div>

              {/* Gastos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-red-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Gastos Totales</span>
                  <TrendingDown className="w-4 h-4 text-red-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-red-400 tabular-nums">
                  ${totalGastos.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Repuestos, insumos y fijos</p>
              </div>

              {/* Balance Neto */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-blue-500 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Balance Neto en Caja</span>
                  <DollarSign className="w-4 h-4 text-blue-400" />
                </div>
                <div
                  className={`mt-3 font-mono text-2xl font-black tabular-nums ${
                    balanceNeto >= 0 ? 'text-white' : 'text-rose-500'
                  }`}
                >
                  ${balanceNeto.toLocaleString('es-AR')}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Margen real de ganancia</p>
              </div>

              {/* Total Movimientos */}
              <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-neutral-600 shadow-xl">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
                  <span>Movimientos</span>
                  <Receipt className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="mt-3 font-mono text-2xl font-black text-white tabular-nums">
                  {filteredMovimientos.length}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">Operaciones en el período</p>
              </div>
            </div>

            {/* Filter controls */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex flex-wrap items-center justify-between gap-4">
              {/* Period tabs */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase">
                <button
                  onClick={() => setFiltroPeriodo('hoy')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'hoy' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Hoy
                </button>
                <button
                  onClick={() => setFiltroPeriodo('semana')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'semana' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  onClick={() => setFiltroPeriodo('mes')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'mes' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Este Mes
                </button>
                <button
                  onClick={() => setFiltroPeriodo('todos')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroPeriodo === 'todos' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Histórico Todo
                </button>

                {/* Selector de fecha puntual con almanaque */}
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all ${
                    filtroPeriodo === 'dia'
                      ? 'bg-red-950/60 border-red-600 text-white shadow-sm ring-1 ring-red-600/50'
                      : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:border-neutral-500'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  <span className="text-[11px] font-heading font-bold uppercase text-neutral-400 shrink-0">
                    Día:
                  </span>
                  <input
                    type="date"
                    value={fechaPersonalizada}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFechaPersonalizada(val);
                      if (val) {
                        setFiltroPeriodo('dia');
                      }
                    }}
                    onClick={(e) => {
                      try {
                        (e.currentTarget as any).showPicker?.();
                      } catch {}
                    }}
                    className="bg-transparent text-xs text-white font-mono font-bold focus:outline-none cursor-pointer [color-scheme:dark]"
                    title="Hacé clic para elegir un día en el almanaque"
                  />
                  {filtroPeriodo === 'dia' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroPeriodo('hoy');
                        setFechaPersonalizada('');
                      }}
                      className="text-neutral-400 hover:text-white p-0.5 rounded hover:bg-red-900/50 ml-0.5 cursor-pointer"
                      title="Quitar filtro de día y volver a Hoy"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Type selector */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-lg text-xs font-heading font-bold uppercase">
                <button
                  onClick={() => setFiltroTipo('todos')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'todos' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFiltroTipo('ingreso')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'ingreso' ? 'bg-emerald-600 text-white' : 'text-neutral-400 hover:text-emerald-400'
                  }`}
                >
                  Ingresos
                </button>
                <button
                  onClick={() => setFiltroTipo('gasto')}
                  className={`px-3 py-1.5 rounded transition-colors ${
                    filtroTipo === 'gasto' ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-red-400'
                  }`}
                >
                  Gastos
                </button>
              </div>

              {/* Search in contabilidad */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-3" />
                <input
                  id={busquedaContableId}
                  type="text"
                  placeholder="Filtrar por concepto o patente..."
                  value={filtroBusquedaContable}
                  onChange={(e) => setFiltroBusquedaContable(e.target.value)}
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-neutral-500"
                />
              </div>
            </div>

            {/* Movements Table / Cards */}
            <div>
              {loadingContabilidad ? (
                <div className="p-16 text-center text-neutral-400 text-xs">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                  <span className="font-heading uppercase tracking-wider">Cargando registros contables...</span>
                </div>
              ) : filteredMovimientos.length === 0 ? (
                <div className="p-12 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                  <Receipt className="w-10 h-10 text-neutral-500 mx-auto mb-2" />
                  <h3 className="font-heading font-bold text-white text-base uppercase">
                    Sin movimientos registrados en este filtro
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Hacé clic en &ldquo;+ Registrar Ingreso&rdquo; o &ldquo;- Registrar Gasto&rdquo; para asentar un movimiento en la hoja de Google Sheets.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950 font-heading font-bold uppercase tracking-wider text-neutral-400">
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Concepto / Detalle</th>
                          <th className="py-3 px-4">Categoría</th>
                          <th className="py-3 px-4">Ref. / Patente</th>
                          <th className="py-3 px-4">Método</th>
                          <th className="py-3 px-4 text-right">Monto ($ ARS)</th>
                          <th className="py-3 px-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900">
                        {filteredMovimientos.map((m) => {
                          const isIngreso = m.tipo === 'ingreso';
                          return (
                            <tr key={m.id} className="hover:bg-neutral-900/60 transition-colors">
                              <td className="py-3 px-4 font-mono text-neutral-200 whitespace-nowrap font-bold">
                                {formatearFechaArgentina(m.fecha)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 font-heading font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${
                                    isIngreso
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                                      : 'bg-red-950 text-red-400 border border-red-800/60'
                                  }`}
                                >
                                  {isIngreso ? '▲ Ingreso' : '▼ Gasto'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-white font-medium max-w-xs break-words">
                                {m.concepto}
                              </td>
                              <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                                {m.categoria}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-neutral-300 uppercase whitespace-nowrap">
                                {m.referencia || '—'}
                              </td>
                              <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                                {m.metodoPago}
                              </td>
                              <td
                                className={`py-3 px-4 text-right font-mono font-bold text-sm tabular-nums whitespace-nowrap ${
                                  isIngreso ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {isIngreso ? '+' : '-'}${Number(m.monto).toLocaleString('es-AR')}
                              </td>
                              <td className="py-3 px-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteMovement(m.id, m.concepto)}
                                  className="text-neutral-500 hover:text-red-400 p-1 rounded hover:bg-neutral-800 transition-colors"
                                  title="Eliminar este movimiento"
                                  aria-label="Eliminar movimiento"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CUENTAS CORRIENTES */}
        {activeAdminTab === 'cuentas_corrientes' && (
          <CuentasCorrientesManager
            modoLectura={false}
            onShowToast={onShowToast}
            onContabilidadUpdated={fetchContabilidad}
          />
        )}

        {/* TAB 3: SCRIPT DE GOOGLE SHEETS */}
        {activeAdminTab === 'script' && (
          <div className="space-y-6">
            <div className="p-6 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
                    Código de tu Google Apps Script (Hojas Turnos, Contabilidad, Presupuestos y Stock)
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Copiá este código y reemplazalo en tu archivo <strong>Code.gs</strong> de tu planilla de Google Sheets. El sistema creará y sincronizará automáticamente las pestañas <strong>Contabilidad</strong>, <strong>Presupuestos</strong> y <strong>Stock</strong>.
                  </p>
                </div>

                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all"
                >
                  {copiedScript ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedScript ? '¡Copiado!' : 'Copiar Código Completo'}</span>
                </button>
              </div>

              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 space-y-2">
                <p className="font-heading font-bold uppercase text-white">Pasos para actualizar en Google Sheets:</p>
                <ol className="list-decimal pl-5 space-y-1.5 text-neutral-400">
                  <li>Abrí tu planilla <strong>&ldquo;Base de Datos Taller&rdquo;</strong> en Google Sheets.</li>
                  <li>Andá al menú superior <strong>Extensiones &gt; Apps Script</strong>.</li>
                  <li>Borrá todo el contenido de <code>Code.gs</code> y pegá este nuevo código.</li>
                  <li>Hacé clic en <strong>Guardar (icono de disco 💾)</strong>.</li>
                  <li className="text-amber-300 font-medium">
                    ⚡ <strong>Autorizar Permisos de Envío de Email:</strong> En la barra superior de Apps Script, al lado de &ldquo;Depurar&rdquo;, asegurate de que esté seleccionada la función <code>autorizarPermisosDeEmail</code> y hacé clic en el botón <strong>&ldquo;Ejecutar&rdquo; (▶️)</strong>. Se abrirá una ventana de Google: tocá <em>&ldquo;Revisar permisos&rdquo; &gt; Elegí tu cuenta &gt; &ldquo;Configuración avanzada&rdquo; &gt; &ldquo;Ir a Proyecto (no seguro)&rdquo; &gt; &ldquo;Permitir&rdquo;</em>.
                  </li>
                  <li>
                    Hacé clic en <strong>Implementar &gt; Administrar implementaciones &gt; Editar (icono de lápiz ✏️)</strong> y en Versión seleccioná <strong>&ldquo;Nueva versión&rdquo;</strong>, luego <strong>Implementar</strong>.
                  </li>
                </ol>
              </div>

              <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-[#000] p-4">
                <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-[400px] leading-relaxed">
                  {fullAppsScriptCode}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: NUEVO INGRESO / GASTO CONTABLE */}
        {showModalMovimiento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
            <div className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] my-auto overflow-hidden">
              {/* Header fijo superior */}
              <div className="relative p-5 sm:p-6 pb-4 border-b border-neutral-800 bg-[#0a0a0a] shrink-0">
                <button
                  onClick={() => setShowModalMovimiento(false)}
                  className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                  aria-label="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <Receipt className="w-5 h-5" />
                  <span className="font-heading font-black text-xs uppercase tracking-widest">
                    Gestión de Caja Taller
                  </span>
                </div>

                <h2 className="font-heading font-black text-xl text-white uppercase tracking-tight">
                  {nuevoTipo === 'ingreso' ? 'Registrar Nuevo Ingreso' : 'Registrar Nuevo Gasto'}
                </h2>

                {/* Segmented type control */}
                <div className="grid grid-cols-2 gap-2 mt-4 p-1 rounded-lg bg-neutral-950 border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoTipo('ingreso');
                      setNuevaCategoria('Mano de Obra / Taller');
                    }}
                    className={`py-2 text-xs font-heading font-bold uppercase rounded transition-colors ${
                      nuevoTipo === 'ingreso'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    ▲ Ingreso (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNuevoTipo('gasto');
                      setNuevaCategoria('Repuestos / Repuesteros');
                    }}
                    className={`py-2 text-xs font-heading font-bold uppercase rounded transition-colors ${
                      nuevoTipo === 'gasto'
                        ? 'bg-red-600 text-white shadow'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    ▼ Gasto (-)
                  </button>
                </div>
              </div>

              {/* Formulario con cuerpo scrolleable */}
              <form onSubmit={handleSaveNuevoMovimiento} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="overflow-y-auto p-5 sm:p-6 space-y-4 flex-1 overscroll-contain">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={fechaMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Fecha
                    </label>
                    <input
                      id={fechaMovId}
                      type="date"
                      required
                      value={nuevaFecha}
                      onChange={(e) => setNuevaFecha(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                    />
                  </div>

                  <div>
                    <label htmlFor={montoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Monto ($ ARS)
                    </label>
                    <input
                      id={montoMovId}
                      type="number"
                      required
                      placeholder="Ej: 35000"
                      value={nuevoMonto}
                      onChange={(e) => setNuevoMonto(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs font-mono font-bold text-white rounded-lg px-3 py-2"
                    />
                  </div>
                </div>

                {/* Dropdown selector for predefined parts or expenses */}
                <div>
                  <label className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    {nuevoTipo === 'gasto'
                      ? 'Elegir Repuesto o Tipo de Gasto (Menú Desplegable)'
                      : 'Elegir Trabajo o Servicio (Menú Desplegable)'}
                  </label>
                  <select
                    value={itemPredefinidoSeleccionado}
                    onChange={(e) => handleItemPredefinidoChange(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2 font-medium focus:border-red-600 focus:outline-none"
                  >
                    <option value="">-- Seleccionar de la lista desplegable --</option>
                    {nuevoTipo === 'gasto' ? (
                      <>
                        <optgroup label="🔧 Repuestos de Taller">
                          {GASTOS_PREDEFINIDOS.filter((g) => !g.includes('Boleta') && !g.includes('Alquiler') && !g.includes('Insumos') && !g.includes('Servicio') && !g.includes('Mantenimiento') && !g.includes('Sueldos') && !g.includes('Otro')).map((rep) => (
                            <option key={rep} value={rep}>
                              {rep}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="🏢 Gastos Operativos y Fijos">
                          {GASTOS_PREDEFINIDOS.filter((g) => g.includes('Boleta') || g.includes('Alquiler') || g.includes('Insumos') || g.includes('Servicio') || g.includes('Mantenimiento') || g.includes('Sueldos') || g.includes('Otro')).map((gasto) => (
                            <option key={gasto} value={gasto}>
                              {gasto}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      <>
                        <optgroup label="🔧 Trabajos de Taller">
                          {WORKSHOP_ITEMS.map((srv) => (
                            <option key={srv} value={srv}>
                              {srv}
                            </option>
                          ))}
                        </optgroup>
                        <option value="Otro Ingreso (Personalizado)">Otro Ingreso (Personalizado)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label htmlFor={conceptoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    Concepto / Detalle en la Planilla
                  </label>
                  <input
                    id={conceptoMovId}
                    type="text"
                    required
                    placeholder={
                      nuevoTipo === 'ingreso'
                        ? 'Ej: Cobro ALINEACIÓN Y BALANCEO'
                        : 'Ej: Compra de EXTREMO DE DIRECCIÓN'
                    }
                    value={nuevoConcepto}
                    onChange={(e) => setNuevoConcepto(e.target.value)}
                    className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-3 py-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor={catMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Categoría
                    </label>
                    <select
                      id={catMovId}
                      value={nuevaCategoria}
                      onChange={(e) => setNuevaCategoria(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2"
                    >
                      {nuevoTipo === 'ingreso' ? (
                        <>
                          <option value="Mano de Obra / Taller">Mano de Obra / Taller</option>
                          <option value="Venta de Repuestos">Venta de Repuestos</option>
                          <option value="Seña Mercado Pago">Seña Mercado Pago</option>
                          <option value="Otro Ingreso">Otro Ingreso</option>
                        </>
                      ) : (
                        <>
                          <option value="Repuestos / Repuesteros">Repuestos / Repuesteros</option>
                          <option value="Insumos de Taller">Insumos de Taller</option>
                          <option value="Alquiler / Servicios / Impuestos">Alquiler / Servicios / Luz</option>
                          <option value="Mantenimiento Máquinas / Rampa">Mantenimiento Rampa / Máquinas</option>
                          <option value="Sueldos / Ayudante">Sueldos / Personal</option>
                          <option value="Otro Gasto">Otro Gasto</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label htmlFor={metodoPagoMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                      Método de Pago
                    </label>
                    <select
                      id={metodoPagoMovId}
                      value={nuevoMetodoPago}
                      onChange={(e) => setNuevoMetodoPago(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded-lg px-2.5 py-2"
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Mercado Pago / Transferencia">Mercado Pago / Transferencia</option>
                      <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                      <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                      <option value="Cuenta Corriente / Cheque">Cuenta Corriente / Cheque</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor={refMovId} className="block text-xs font-heading font-bold uppercase text-neutral-400 mb-1">
                    Patente o Referencia (Opcional)
                  </label>
                  <input
                    id={refMovId}
                    type="text"
                    placeholder="Ej: PEU534 o Factura #142"
                    value={nuevaReferencia}
                    onChange={(e) => setNuevaReferencia(e.target.value.toUpperCase())}
                    className="w-full bg-[#111] border border-neutral-800 text-xs font-mono text-white rounded-lg px-3 py-2 uppercase"
                  />
                </div>

                </div>

                {/* Footer fijo con botones siempre visibles */}
                <div className="p-4 sm:p-5 bg-neutral-950 border-t border-neutral-800 flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowModalMovimiento(false)}
                    className="flex-1 py-3 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoMovimiento || !nuevoConcepto || !nuevoMonto}
                    className={`flex-2 py-3 rounded font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 text-white ${
                      nuevoTipo === 'ingreso'
                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-900/40'
                    }`}
                  >
                    {guardandoMovimiento ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <span>{nuevoTipo === 'ingreso' ? 'Asentar Ingreso' : 'Asentar Gasto'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL: CARGAR TURNO POR MOSTRADOR / PRESENCIAL */}
        {/* ========================================================================= */}
        {showModalTurnoMostrador && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-lg bg-[#0a0a0a] border-2 border-red-600 rounded-xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
              <button
                type="button"
                onClick={() => setShowModalTurnoMostrador(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <div className="flex items-center gap-2 text-red-500 mb-1">
                  <Car className="w-5 h-5" />
                  <span className="font-heading font-bold text-xs uppercase tracking-wider">
                    Recepción de Taller · Carga de Turno por Mostrador
                  </span>
                </div>
                <h2 className="font-heading font-black text-xl text-white uppercase tracking-wide">
                  Cargar Turno por Mostrador
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Verifica en tiempo real la disponibilidad de turnos en Google Sheets y da de alta automáticamente al cliente con contraseña predeterminada.
                </p>
              </div>

              <form onSubmit={handleGuardarTurnoMostrador} className="space-y-4">
                {/* 1. Datos del Vehículo y Fecha */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                      Patente / Dominio *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: PEU534 o AE123MZ"
                      value={mostradorPatente}
                      onChange={(e) => setMostradorPatente(e.target.value.toUpperCase())}
                      className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm font-mono font-bold text-white uppercase tracking-wider"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                      Fecha del Turno *
                    </label>
                    <input
                      type="date"
                      required
                      value={mostradorFecha}
                      onChange={(e) => handleMostradorDateChange(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {/* 2. Horarios con Comprobación de Disponibilidad en Tiempo Real */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-heading font-bold uppercase text-neutral-300">
                      Horarios Disponibles para esa Fecha *
                    </label>
                    {loadingMostradorSlots && (
                      <span className="text-[11px] text-red-400 flex items-center gap-1 font-heading">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Verificando disponibilidad...
                      </span>
                    )}
                  </div>

                  {loadingMostradorSlots ? (
                    <div className="p-4 rounded-lg bg-neutral-900 border border-neutral-800 text-center text-xs text-neutral-400 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                      <span>Consultando horarios libres en Google Sheets...</span>
                    </div>
                  ) : mostradorHorariosDisponibles.length === 0 ? (
                    <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-800/80 text-xs text-red-400 text-center space-y-1">
                      <div className="font-heading font-bold uppercase">❌ Sin horarios disponibles</div>
                      <p className="text-[11px] text-neutral-400">
                        No quedan turnos libres para esta fecha (o el taller permanece cerrado). Por favor seleccioná otro día.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={mostradorHorario}
                        onChange={(e) => setMostradorHorario(e.target.value)}
                        required
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono font-bold"
                      >
                        <option value="">-- Elegir horario disponible --</option>
                        {mostradorHorariosDisponibles.map((h) => (
                          <option key={h} value={h}>
                            🕒 {h} hs (Disponible)
                          </option>
                        ))}
                      </select>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Toque rápido:</span>
                        {mostradorHorariosDisponibles.map((h) => (
                          <button
                            type="button"
                            key={h}
                            onClick={() => setMostradorHorario(h)}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                              mostradorHorario === h
                                ? 'bg-red-600 text-white shadow-md shadow-red-950'
                                : 'bg-neutral-900 text-neutral-300 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                            }`}
                          >
                            {h} hs
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Datos del Cliente para Creación de Usuario */}
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                      Correo Electrónico del Cliente *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        required
                        placeholder="cliente@email.com"
                        value={mostradorEmail}
                        onChange={(e) => handleMostradorEmailChange(e.target.value)}
                        onBlur={() => {
                          const clean = mostradorEmail.trim().toLowerCase();
                          if (clean && clean.includes('@') && clean.includes('.') && (!mostradorNombre || !mostradorTelefono)) {
                            handleBuscarClientePorEmail(clean);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleBuscarClientePorEmail();
                          }
                        }}
                        className="flex-1 bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleBuscarClientePorEmail()}
                        disabled={buscandoCliente}
                        className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white font-heading font-bold text-xs uppercase tracking-wider rounded-lg border border-neutral-700 hover:border-red-600 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                        title="Buscar cliente en el sistema para autocompletar nombre y teléfono"
                      >
                        {buscandoCliente ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Search className="w-3.5 h-3.5 text-red-500" />
                        )}
                        <span>Traer datos</span>
                      </button>
                    </div>

                    {clienteEncontradoMsg && (
                      <p className={`text-[11px] mt-1.5 font-medium flex items-center gap-1.5 ${
                        clienteEncontradoMsg.tipo === 'success' ? 'text-emerald-400' : 'text-neutral-400'
                      }`}>
                        {clienteEncontradoMsg.tipo === 'success' ? '✅' : 'ℹ️'} {clienteEncontradoMsg.texto}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                        Nombre y Apellido *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: Juan Pérez"
                        value={mostradorNombre}
                        onChange={(e) => setMostradorNombre(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                        Teléfono / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Ej: 2625 123456"
                        value={mostradorTelefono}
                        onChange={(e) => setMostradorTelefono(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* 4. Notificación de Alta de Usuario Automática con clave 123456 */}
                <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-800/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-heading font-black uppercase text-red-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{clienteEncontradoMsg?.tipo === 'success' ? 'Cliente Existente Identificado' : 'Creación Automática de Usuario Web'}</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    {clienteEncontradoMsg?.tipo === 'success' ? (
                      <>
                        Este cliente ya existe en el taller. El turno se vinculará a su cuenta sin alterar su contraseña actual.
                      </>
                    ) : (
                      <>
                        Si el correo no existe en el sistema, al confirmar se creará automáticamente su usuario con la contraseña:{' '}
                        <strong className="text-white font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">123456</strong>{' '}
                        para que pueda ingresar a la web y consultar su turno o historial.
                      </>
                    )}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowModalTurnoMostrador(false)}
                    className="px-4 py-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoTurnoMostrador || !mostradorHorario || loadingMostradorSlots}
                    className="px-6 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {guardandoTurnoMostrador ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Guardando Turno y Creando Usuario...</span>
                      </>
                    ) : (
                      <>
                        <span>💾 Confirmar y Guardar Turno</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL CANCELAR TURNO POR INASISTENCIA (ANTES DE PROGRAMAR) */}
        {turnoACancelar && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#111111] border border-neutral-800 rounded-2xl p-6 max-w-md w-full shadow-2xl relative space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-800/70 text-red-400">
                    <Ban className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-white text-base uppercase tracking-wider">
                      Cancelar Turno
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Inasistencia del usuario antes de programar
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !cancelandoTurno && setTurnoACancelar(null)}
                  className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                  disabled={cancelandoTurno}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Resumen del turno a cancelar */}
              <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <span className="text-neutral-400">Vehículo:</span>
                  <span className="font-mono font-bold text-white uppercase text-sm bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700">
                    {turnoACancelar.patente}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Fecha reservada:</span>
                  <span className="font-mono text-white font-semibold">
                    {formatearFechaArgentina(turnoACancelar.fecha)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Horario:</span>
                  <span className="text-white font-semibold">
                    {formatearHorario(turnoACancelar.horario)} hs
                  </span>
                </div>
                {turnoACancelar.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Correo:</span>
                    <span className="text-neutral-300 truncate max-w-[200px]">
                      {turnoACancelar.email}
                    </span>
                  </div>
                )}
                {turnoACancelar.nombre && (
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Cliente:</span>
                    <span className="text-white font-semibold">
                      {turnoACancelar.nombre}
                    </span>
                  </div>
                )}
              </div>

              {/* Motivo de la cancelación */}
              <div className="space-y-1.5">
                <label className="block text-xs font-heading font-bold text-neutral-300 uppercase tracking-wider">
                  Motivo de cancelación:
                </label>
                <select
                  value={motivoCancelacion}
                  onChange={(e) => setMotivoCancelacion(e.target.value)}
                  disabled={cancelandoTurno}
                  className="w-full bg-neutral-900 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-xl px-3 py-2.5 text-xs text-white"
                >
                  <option value="Cliente no se presentó (inasistencia)">Cliente no se presentó (inasistencia)</option>
                  <option value="Cancelado con previo aviso del cliente">Cancelado con previo aviso del cliente</option>
                  <option value="Turno duplicado o error de carga">Turno duplicado o error de carga</option>
                  <option value="Reprogramación acordada">Reprogramación acordada</option>
                  <option value="Otro motivo">Otro motivo</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-[11px] text-amber-300/90 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  El turno pasará al estado <strong>Cancelado</strong> en Google Sheets y se liberará inmediatamente de la lista de turnos pendientes del taller.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/80">
                <button
                  type="button"
                  onClick={() => setTurnoACancelar(null)}
                  disabled={cancelandoTurno}
                  className="px-4 py-2.5 rounded-xl border border-neutral-700 hover:border-neutral-600 text-neutral-300 hover:text-white text-xs font-heading font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarCancelarTurno}
                  disabled={cancelandoTurno}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-950 transition-all cursor-pointer disabled:opacity-50"
                >
                  {cancelandoTurno ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Cancelando Turno...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>Confirmar Cancelación</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
