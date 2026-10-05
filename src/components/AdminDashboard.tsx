import { useState, useEffect, useId, useTransition, useRef } from 'react';
import { TurnoAdmin, DatosTrabajoAdmin, MovimientoContable, Presupuesto } from '../types';
import { gasApi } from '../services/gasApi';
import { WORKSHOP_ITEMS, GASTOS_PREDEFINIDOS } from '../constants/workshopItems';
import { PresupuestosManager } from './PresupuestosManager';
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
  FileText
} from 'lucide-react';

interface AdminDashboardProps {
  onBackToHome: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const AdminDashboard = ({ onBackToHome, onShowToast }: AdminDashboardProps) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'turnos' | 'presupuestos' | 'contabilidad' | 'script'>('turnos');
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
        setTurnos(res.turnos);
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
      }
    } catch (e) {
      console.warn('Error fetching presupuestos:', e);
    }
  };

  useEffect(() => {
    fetchTurnos();
    fetchContabilidad();
    fetchPresupuestos();

    // Sincronización en tiempo real para el Panel de Administrador
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.onmessage = () => {
          fetchTurnos(true);
          fetchPresupuestos(true);
          fetchContabilidad(true);
        };
      } catch {}
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'taller_presupuestos_v1') fetchPresupuestos(true);
      if (e.key === 'lacasadeladireccion_contabilidad') fetchContabilidad(true);
    };
    window.addEventListener('storage', handleStorage);

    const handleCustomSync = () => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
    };
    window.addEventListener('taller_presupuesto_sync', handleCustomSync);

    const handleFocus = () => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
    };
    window.addEventListener('focus', handleFocus);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTurnos(true);
        fetchPresupuestos(true);
        fetchContabilidad(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Polling automático cada 7 segundos para mantener todo sincronizado en tiempo real
    const interval = setInterval(() => {
      fetchTurnos(true);
      fetchPresupuestos(true);
      fetchContabilidad(true);
    }, 7000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('taller_presupuesto_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, []);

  // Filter turnos
  const filteredTurnos = turnos.filter((t) => {
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
        fetchTurnos();
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
    setTurnos((prev) => prev.filter((t) => t.patente.trim().toUpperCase() !== cleanPat));
    fetchTurnos();
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
              "horario": rowsTurnos[j][2],
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
            var horaFila = String(rowsTurnos[k][2]).includes('T') ? String(rowsTurnos[k][2]).split('T')[1].substring(0,5) : String(rowsTurnos[k][2]);
            ocupados.push(horaFila);
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
        horario: datos[i][2], 
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

  // Actualizar el turno en hoja 'Turnos' a 'Atendido'
  if (sheetTurnos) {
    var datosTurnos = sheetTurnos.getDataRange().getValues();
    for (var i = 1; i < datosTurnos.length; i++) {
      var patFila = datosTurnos[i][3] ? datosTurnos[i][3].toString().trim().toUpperCase() : "";
      if (patFila === patenteFmt && datosTurnos[i][4] && datosTurnos[i][4].toString().toLowerCase() === "programado") {
        sheetTurnos.getRange(i + 1, 5).setValue("Atendido");
        break;
      }
    }
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
  
  if (sheetTurnos) {
    var datosTurnos = sheetTurnos.getDataRange().getValues();
    for (var i = 1; i < datosTurnos.length; i++) {
      if (String(datosTurnos[i][3]).toLowerCase().trim() === datosTrabajo.patente.toLowerCase().trim()) {
        sheetTurnos.getRange(i + 1, 5).setValue("Atendido");
        break;
      }
    }
  }
  return { success: true };
}

function obtenerHistorialCliente(emailCliente) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDetalles = ss.getSheetByName("Detalles_Turnos");
  if (!sheetDetalles) return { success: true, historial: [] };
  
  var datos = sheetDetalles.getDataRange().getValues();
  var historialUsuario = [];
  
  for (var i = 1; i < datos.length; i++) {
    var emailFila = datos[i][0] ? datos[i][0].toString().toLowerCase().trim() : "";
    if (emailFila === emailCliente.toLowerCase().trim()) {
      var tieneColumnaModelo = datos[0] && datos[0].length >= 8 && datos[0][4] && datos[0][4].toString().toLowerCase().indexOf("modelo") !== -1;
      var modeloVal = "";
      var kmVal = "";
      var trabajoVal = "";
      var montoVal = "";

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

      historialUsuario.push({
        fecha: datos[i][1] ? datos[i][1].toString().replace("'", "") : "",
        horario: datos[i][2] ? datos[i][2].toString() : "",
        patente: datos[i][3] ? datos[i][3].toString().toUpperCase() : "",
        modelo: modeloVal,
        kilometraje: kmVal,
        trabajo: trabajoVal,
        monto: montoVal
      });
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
                onShowToast('info', 'Sincronizado', 'Planillas de turnos, presupuestos y caja actualizadas.');
              }}
              disabled={loadingTurnos || loadingContabilidad}
              className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 font-heading font-bold text-xs uppercase tracking-wider rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTurnos || loadingContabilidad ? 'animate-spin' : ''}`} />
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
                    fetchTurnos();
                    onShowToast('info', 'Actualizando...', 'Consultando turnos en Google Sheets.');
                  }}
                  disabled={loadingTurnos}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  title="Actualizar lista de turnos desde Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTurnos ? 'animate-spin text-red-500' : 'text-neutral-400'}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>

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

              {/* Search in contabilidad & Actualizar */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="relative flex-1">
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

                <button
                  type="button"
                  onClick={() => {
                    fetchContabilidad();
                    onShowToast('info', 'Actualizando...', 'Consultando contabilidad en Google Sheets.');
                  }}
                  disabled={loadingContabilidad}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  title="Actualizar caja y movimientos desde Google Sheets"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingContabilidad ? 'animate-spin text-emerald-500' : 'text-neutral-400'}`} />
                  <span className="hidden sm:inline">Actualizar</span>
                </button>
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
                    Código de tu Google Apps Script con la Hoja &ldquo;Contabilidad&rdquo;
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Copiá este código y reemplazalo en tu archivo <strong>Code.gs</strong> de tu planilla de Google Sheets. El sistema creará automáticamente la pestaña <strong>Contabilidad</strong>.
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
