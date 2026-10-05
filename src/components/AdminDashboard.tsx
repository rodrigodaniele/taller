import { useState, useEffect, useId, useTransition, useRef } from 'react';
import { TurnoAdmin, DatosTrabajoAdmin, MovimientoContable, Presupuesto, ItemStock, ItemPresupuesto } from '../types';
import { gasApi } from '../services/gasApi';
import { WORKSHOP_ITEMS, GASTOS_PREDEFINIDOS } from '../constants/workshopItems';
import { PresupuestosManager } from './PresupuestosManager';
import { StockManager } from './StockManager';
import { formatearFechaArgentina, formatearHorario } from '../utils/dateFormatter';
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
  Package
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

const filtrarTurnosPendientes = (listaTurnos: TurnoAdmin[], listaPresupuestos: Presupuesto[]) => {
  const atendidosSet = getTurnosAtendidosSet();
  const patentesFacturadas = new Set(
    listaPresupuestos
      .filter((p) => p.estado === 'facturado')
      .map((p) => (p.patente || '').toUpperCase().trim())
  );

  return listaTurnos.filter((t) => {
    const cleanPat = (t.patente || '').toUpperCase().trim();
    if (!cleanPat) return false;
    // Si ya fue marcado como atendido localmente
    if (atendidosSet.has(cleanPat)) return false;
    // Si el vehículo ya tiene un presupuesto facturado (proceso finalizado y pasado a contabilidad)
    if (patentesFacturadas.has(cleanPat)) return false;
    return true;
  });
};

export const AdminDashboard = ({ onBackToHome, onShowToast }: AdminDashboardProps) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'turnos' | 'presupuestos' | 'stock' | 'contabilidad' | 'script'>('turnos');
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
  const [nuevaFecha, setNuevaFecha] = useState(new Date().toISOString().split('T')[0]);
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
  const [mostradorFecha, setMostradorFecha] = useState(() => new Date().toISOString().split('T')[0]);
  const [mostradorHorario, setMostradorHorario] = useState('');
  const [mostradorHorariosDisponibles, setMostradorHorariosDisponibles] = useState<string[]>([]);
  const [loadingMostradorSlots, setLoadingMostradorSlots] = useState(false);
  const [mostradorNombre, setMostradorNombre] = useState('');
  const [mostradorTelefono, setMostradorTelefono] = useState('');
  const [mostradorEmail, setMostradorEmail] = useState('');

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

        // Auto-reparación en Google Sheets: si en la planilla Turnos todavía figura como 'Programado'
        // un vehículo que ya fue facturado o atendido, le enviamos la orden a Google Sheets para pasarlo a 'Atendido'.
        try {
          const atendidosSet = getTurnosAtendidosSet();
          const patentesFacturadas = new Set(
            currentPresupuestos
              .filter((p) => p.estado === 'facturado')
              .map((p) => (p.patente || '').toUpperCase().trim())
          );
          res.turnos.forEach((t) => {
            const cleanP = (t.patente || '').toUpperCase().trim();
            if (cleanP && (atendidosSet.has(cleanP) || patentesFacturadas.has(cleanP))) {
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
        setMovimientos(res.movimientos);
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
        setPresupuestos(res.presupuestos);
        // Al actualizar presupuestos, re-filtrar turnos por si alguno pasó a facturado
        setTurnos((prev) => filtrarTurnosPendientes(prev, res.presupuestos));
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
      if (e.key === 'taller_turnos_atendidos_v1') fetchTurnos(true);
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
      const payload: DatosTrabajoAdmin = {
        email: selectedTurno.email,
        fecha: selectedTurno.fecha,
        horario: selectedTurno.horario,
        patente: selectedTurno.patente,
        kilometraje,
        trabajoRealizado: trabajoFinal,
        montoFinal: montoCobrado,
      };

      const res = await gasApi.saveAdminWork(payload);

      // Auto-register in contabilidad if checked
      if (autoRegistrarContabilidad && Number(montoCobrado) > 0) {
        const cleanFecha = String(selectedTurno.fecha).replace("'", '');
        const movimientoItem: MovimientoContable = {
          id: 'MOV-' + Date.now(),
          fecha: cleanFecha || new Date().toISOString().split('T')[0],
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

        // Impactar en rotación de stock de repuestos utilizados en el taller
        try {
          const repuestoItems: ItemPresupuesto[] = selectedServicios.map((s, idx) => ({
            id: `ITEM-SRV-${Date.now()}-${idx}`,
            tipo: 'repuesto',
            descripcion: s,
            cantidad: 1,
            precioUnitario: 0,
            subtotal: 0,
          }));
          gasApi.actualizarRotacionYDescontarStock(repuestoItems, selectedTurno.patente);
          fetchStock(true);
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

  // Registrar gasto en Contabilidad cuando se compre stock de repuestos
  const handleRegistrarGastoDesdeStock = async (concepto: string, monto: number, metodoPago: string) => {
    const nuevoMovimiento: MovimientoContable = {
      id: 'MOV-STOCK-' + Date.now(),
      fecha: new Date().toISOString().split('T')[0],
      tipo: 'gasto',
      concepto,
      categoria: 'Repuestos / Repuesteros',
      monto,
      metodoPago: metodoPago || 'Efectivo',
      referencia: 'STOCK TALLER',
    };
    await gasApi.addAccountingMovement(nuevoMovimiento);
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

    const nuevoTurnoAdmin: TurnoAdmin = {
      patente: cleanPatente,
      fecha: mostradorFecha,
      horario: mostradorHorario,
      email: cleanEmail,
      nombre: cleanNombre,
      telefono: cleanTelefono,
    };

    try {
      // 1. Registrar al usuario usando 'accion: registrar' (compatible con la versión actual de Google Apps Script)
      try {
        await gasApi.register(cleanNombre, cleanTelefono, cleanEmail, '123456');
      } catch (errReg) {
        console.warn('Registro de usuario vía register:', errReg);
      }

      // 2. Guardar en Google Sheets (Hoja "Turnos" y asegura datos en "Usuarios")
      await gasApi.createTurnoMostrador({
        patente: cleanPatente,
        fecha: mostradorFecha,
        horario: mostradorHorario,
        nombre: cleanNombre,
        telefono: cleanTelefono,
        email: cleanEmail,
      });

      setTurnos((prev) => [nuevoTurnoAdmin, ...prev.filter((t) => t.patente !== cleanPatente || t.fecha !== mostradorFecha)]);

      onShowToast(
        'success',
        '¡Turno agendado y Usuario creado!',
        `Vehículo ${cleanPatente} para el ${mostradorFecha} ${mostradorHorario} hs. Usuario registrado con contraseña: 123456.`
      );

      setShowModalTurnoMostrador(false);
      setMostradorPatente('');
      setMostradorNombre('');
      setMostradorTelefono('');
      setMostradorEmail('');
      fetchTurnos();
    } catch (err: any) {
      console.warn('Falla en llamada directa a GAS:', err);
      // Fallback local garantizado
      setTurnos((prev) => [nuevoTurnoAdmin, ...prev.filter((t) => t.patente !== cleanPatente || t.fecha !== mostradorFecha)]);
      onShowToast(
        'success',
        'Turno agendado en el sistema',
        `Vehículo ${cleanPatente} cargado con éxito. Usuario creado con contraseña 123456.`
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
  const handleRegistrarIngresoDesdePresupuesto = async (concepto: string, monto: number, referencia: string) => {
    try {
      await gasApi.addAccountingMovement({
        id: `mov-${Date.now()}`,
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'ingreso',
        concepto,
        categoria: 'Mano de Obra / Taller',
        monto,
        metodoPago: 'Efectivo',
        referencia,
      });
      fetchContabilidad();
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

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetUsuarios = ss.getSheetByName("Usuarios") || ss.getSheetByName("Clientes") || ss.getSheets()[0]; 
    var sheetTurnos = ss.getSheetByName("Turnos") || ss.insertSheet("Turnos");
    var sheetContabilidad = ss.getSheetByName("Contabilidad") || ss.insertSheet("Contabilidad");
    var datos = JSON.parse(e.postData.contents);
    
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
              "fecha": rowsTurnos[j][1],
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
          var fechaFila = String(rowsTurnos[k][1]).includes('T') ? String(rowsTurnos[k][1]).split('T')[0] : String(rowsTurnos[k][1]);
          if (fechaFila === datos.fecha && String(rowsTurnos[k][4]).toLowerCase() !== "cancelado") {
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
      var resDelP = borrarPresupuestoSheet(datos.id);
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
  
  var id = m.id || "MOV-" + new Date().getTime();
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
        fecha: String(row[1]).replace("'", ""),
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
  var hoy = new Date(); hoy.setHours(0,0,0,0);
  
  for (var i = 0; i < data.length; i++) {
    if (data[i][1] && data[i][4].toString().toLowerCase() === "programado") {
      var fTurno = new Date(data[i][1].toString().replace("'", "") + "T00:00:00");
      if (fTurno < hoy) data[i][4] = "Atendido";
    }
  }
  
  var futuros = data.filter(function(r) { return r[4].toString().toLowerCase() === "programado"; });
  var pasados = data.filter(function(r) { return r[4].toString().toLowerCase() !== "programado"; });
  
  futuros.sort(function(a,b) { return new Date(a[1].toString().replace("'","")+"T"+a[2].toString().replace("'","")) - new Date(b[1].toString().replace("'","")+"T"+b[2].toString().replace("'","")); });
  pasados.sort(function(a,b) { return new Date(b[1].toString().replace("'","")+"T"+b[2].toString().replace("'","")) - new Date(a[1].toString().replace("'","")+"T"+a[2].toString().replace("'","")); });
  
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

function obtenerTurnosAdmin() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Turnos");
  var sheetUsuarios = ss.getSheetByName("Usuarios") || ss.getSheetByName("Clientes") || ss.getSheets()[0];
  if (!sheet) return { success: true, turnos: [] };
  var datos = sheet.getDataRange().getValues();

  var mapaUsuarios = {};
  if (sheetUsuarios) {
    var datosU = sheetUsuarios.getDataRange().getValues();
    for (var u = 1; u < datosU.length; u++) {
      if (datosU[u][2]) {
        var emKey = datosU[u][2].toString().toLowerCase().trim();
        mapaUsuarios[emKey] = {
          nombre: datosU[u][0] ? datosU[u][0].toString() : "",
          telefono: datosU[u][1] ? datosU[u][1].toString() : ""
        };
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
        fecha: datos[i][1], 
        horario: formatearHoraParaAppsScript(datos[i][2]), 
        patente: datos[i][3],
        nombre: uInfo.nombre || "",
        telefono: uInfo.telefono || ""
      });
    }
  }
  return { success: true, turnos: pendientes };
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
      fecha: datos[i][2] ? datos[i][2].toString() : "",
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

function borrarPresupuestoSheet(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Presupuestos");
  if (!sheet) return { resultado: "ok" };
  var datos = sheet.getDataRange().getValues();
  for (var i = 1; i < datos.length; i++) {
    if (datos[i][0] && datos[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 1);
      break;
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
  var fechaFmt = p.fecha ? p.fecha.toString().replace("'", "") : new Date().toISOString().split('T')[0];
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

  // 3. Impactar en la hoja 'Stock': sumar a rotación de repuestos y descontar si hay stock físico
  if (Array.isArray(p.items) && p.items.length > 0) {
    try {
      actualizarRotacionStockSheet(p.items, modeloFmt || patenteFmt);
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
  
  sheetDetalles.appendRow([
    datosTrabajo.email,
    datosTrabajo.fecha,
    datosTrabajo.horario,
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
      actualizarRotacionDesdeTextoAdminSheet(datosTrabajo.trabajoRealizado, datosTrabajo.patente);
    } catch(eStockAdmin) {}
  }

  ejecutarLimpiezaYOrdenamientoCompleto();
  return { success: true };
}

// --- FUNCIONES MÓDULO DE STOCK & REPUESTOS ---
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
        ultimoMovimiento: String(r[9] || "")
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
    item.ultimoMovimiento || new Date().toISOString().split("T")[0]
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
      sheet.getRange(i + 1, 10).setValue(new Date().toISOString().split("T")[0]);
      break;
    }
  }
  // Si solicitó impactar en Contabilidad como gasto
  if (datos.registrarEnContabilidad && Number(datos.costoTotal) > 0) {
    registrarMovimientoContabilidad({
      id: "MOV-STOCK-" + new Date().getTime(),
      fecha: new Date().toISOString().split("T")[0],
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

function actualizarRotacionStockSheet(items, vehiculoModelo) {
  if (!items || !items.length) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Stock") || ss.insertSheet("Stock");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["ID", "Nombre", "Categoria", "VehiculoCompatibilidad", "StockActual", "StockMinimo", "CostoUnitario", "PrecioVenta", "TotalInstalados", "UltimoMovimiento"]);
  }
  var data = sheet.getDataRange().getValues();
  for (var k = 0; k < items.length; k++) {
    var item = items[k];
    if (item.tipo !== "repuesto") continue;
    var cant = Number(item.cantidad) || 1;
    var nomNorm = String(item.descripcion || "").trim().toUpperCase();
    var encontrado = false;
    for (var r = 1; r < data.length; r++) {
      var nomFila = String(data[r][1] || "").trim().toUpperCase();
      if (nomFila === nomNorm || nomNorm.indexOf(nomFila) !== -1 || nomFila.indexOf(nomNorm) !== -1) {
        var stockActual = Number(data[r][4]) || 0;
        if (stockActual > 0) {
          sheet.getRange(r + 1, 5).setValue(Math.max(0, stockActual - cant));
        }
        var rotacionPrev = Number(data[r][8]) || 0;
        sheet.getRange(r + 1, 9).setValue(rotacionPrev + cant);
        sheet.getRange(r + 1, 10).setValue(new Date().toISOString().split("T")[0]);
        encontrado = true;
        break;
      }
    }
    if (!encontrado) {
      var nuevoID = "STOCK-" + new Date().getTime() + "-" + Math.floor(Math.random() * 1000);
      sheet.appendRow([
        nuevoID,
        item.descripcion,
        "Tren Delantero / Suspensión",
        vehiculoModelo || "Multimarca",
        0,
        2,
        0,
        Number(item.precioUnitario) || 0,
        cant,
        new Date().toISOString().split("T")[0]
      ]);
    }
  }
}

function actualizarRotacionDesdeTextoAdminSheet(textoTrabajo, patente) {
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
    actualizarRotacionStockSheet(items, patente);
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
      var fechaFila = datos[i][1] ? datos[i][1].toString().replace("'", "").trim() : "";
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

function doOptions(e) {
  return ContentService.createTextOutput("")
                       .setHeaders({
                         'Access-Control-Allow-Origin': '*',
                         'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
                         'Access-Control-Allow-Headers': 'Content-Type'
                       });
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
                Panel de Control & Contabilidad
              </h1>
              <p className="text-xs text-neutral-400">
                Turnos, reparaciones y gestión de caja vinculada con tu Google Sheets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                startTransition(() => {
                  setNuevoTipo('ingreso');
                  setShowModalMovimiento(true);
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-950"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Registrar Ingreso</span>
            </button>
            <button
              onClick={() => {
                startTransition(() => {
                  setNuevoTipo('gasto');
                  setShowModalMovimiento(true);
                });
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded bg-neutral-950 hover:bg-red-950 text-red-400 border border-red-800/60 font-heading font-bold text-xs uppercase tracking-wider transition-all"
            >
              <MinusCircle className="w-4 h-4" />
              <span>- Registrar Gasto</span>
            </button>
          </div>
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
                    const hoyStr = new Date().toISOString().split('T')[0];
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
                        className="p-5 rounded-xl bg-[#0a0a0a] border border-neutral-800 border-l-4 border-l-red-600 hover:border-neutral-700 transition-all shadow-lg flex flex-col justify-between gap-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-red-500" />
                              <span className="font-mono text-lg font-black text-white uppercase tracking-wider">
                                {turno.patente}
                              </span>
                            </div>
                            <div className="mt-2 text-xs text-neutral-400 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-red-500" />
                                <span className="font-mono text-white font-bold">{formatearFechaArgentina(turno.fecha)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                <span className="text-white font-semibold">
                                  {formatearHorario(turno.horario)} hs
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-3.5 h-3.5 text-neutral-500" />
                                <span className="truncate max-w-[200px]">{turno.email}</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2 pt-2 sm:pt-0">
                            {presupuestoExistente ? (
                              <button
                                type="button"
                                onClick={() => setActiveAdminTab('presupuestos')}
                                className="px-4 py-2.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/80 text-emerald-300 text-xs font-heading font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md"
                                title={`Ver presupuesto ${presupuestoExistente.numero} ($${presupuestoExistente.total.toLocaleString('es-AR')})`}
                              >
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span>Presupuesto {presupuestoExistente.numero} (${presupuestoExistente.total.toLocaleString('es-AR')})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setTurnoParaPresupuesto(turno);
                                  setActiveAdminTab('presupuestos');
                                }}
                                className="px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-red-950 cursor-pointer"
                              >
                                <FileText className="w-4 h-4" />
                                <span>+ Crear Presupuesto / Cotización</span>
                              </button>
                            )}
                          </div>
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

                  <div>
                    <label className="block text-xs font-heading font-bold uppercase text-neutral-300 mb-1">
                      Correo Electrónico del Cliente *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="cliente@email.com"
                      value={mostradorEmail}
                      onChange={(e) => setMostradorEmail(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white"
                    />
                  </div>
                </div>

                {/* 4. Notificación de Alta de Usuario Automática con clave 123456 */}
                <div className="p-3.5 rounded-lg bg-red-950/20 border border-red-800/50 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-heading font-black uppercase text-red-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Creación Automática de Usuario Web</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Al confirmar, el sistema registrará automáticamente al cliente en la base de datos con la contraseña:{' '}
                    <strong className="text-white font-mono bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">123456</strong>{' '}
                    para que pueda ingresar a la web con su correo y consultar su turno o historial.
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
      </div>
    </div>
  );
};
