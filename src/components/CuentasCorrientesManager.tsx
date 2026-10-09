import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Search,
  Plus,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Share2,
  Clock,
  User,
  Car,
  FileText,
  X,
  ExternalLink,
  ShieldCheck,
  Check,
  Filter,
  RefreshCw,
  Mail,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { CuentaCorrienteItem } from '../types';
import { gasApi, WHATSAPP_PHONE } from '../services/gasApi';
import { getFechaHoyArgentina, normalizarFechaArgentina, formatearFechaArgentina } from '../utils/dateFormatter';

interface CuentasCorrientesManagerProps {
  modoLectura?: boolean; // true para panel de cliente (solo lector + pago MP), false para admin
  clientEmail?: string;
  clientPatentes?: string[];
  onShowToast: (tipo: 'success' | 'error' | 'warning' | 'info', titulo: string, mensaje: string) => void;
  onContabilidadUpdated?: () => void;
}

export const CuentasCorrientesManager: React.FC<CuentasCorrientesManagerProps> = ({
  modoLectura = false,
  clientEmail,
  clientPatentes = [],
  onShowToast,
  onContabilidadUpdated,
}) => {
  const [items, setItems] = useState<CuentaCorrienteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'pendientes' | 'pagados'>('todos');

  // Modal para Crear Nueva Cuenta Corriente (solo Admin)
  const [showCrearModal, setShowCrearModal] = useState<boolean>(false);
  const [nuevoPatente, setNuevoPatente] = useState<string>('');
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState<string>('');
  const [nuevoClienteEmail, setNuevoClienteEmail] = useState<string>('');
  const [nuevoConcepto, setNuevoConcepto] = useState<string>('');
  const [nuevoMonto, setNuevoMonto] = useState<string>('');
  const [nuevoObservaciones, setNuevoObservaciones] = useState<string>('');
  const [guardandoNuevo, setGuardandoNuevo] = useState<boolean>(false);

  // Modal para Cobrar en Taller (solo Admin)
  const [itemACobrar, setItemACobrar] = useState<CuentaCorrienteItem | null>(null);
  const [montoCobro, setMontoCobro] = useState<string>('');
  const [metodoPagoCobro, setMetodoPagoCobro] = useState<string>('Efectivo');
  const [comprobanteCobro, setComprobanteCobro] = useState<string>('');
  const [procesandoCobro, setProcesandoCobro] = useState<boolean>(false);

  // Modal de Confirmación de Eliminación (solo Admin)
  const [itemAEliminar, setItemAEliminar] = useState<CuentaCorrienteItem | null>(null);
  const [procesandoEliminar, setProcesandoEliminar] = useState<boolean>(false);

  // Estado de procesamiento de Mercado Pago (Cliente)
  const [procesandoMPId, setProcesandoMPId] = useState<string | null>(null);
  const [modalMercadoPago, setModalMercadoPago] = useState<{
    isOpen: boolean;
    item: CuentaCorrienteItem | null;
    urlPago: string | null;
    cargando: boolean;
    error: string | null;
  }>({
    isOpen: false,
    item: null,
    urlPago: null,
    cargando: false,
    error: null,
  });
  const [procesandoAcreditacion, setProcesandoAcreditacion] = useState<boolean>(false);

  // Cargar Cuentas Corrientes
  const cargarCuentas = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await gasApi.getCuentasCorrientes();
      if (res && res.success && Array.isArray(res.items)) {
        setItems(res.items);
      }
    } catch (e) {
      console.error('Error al cargar cuentas corrientes:', e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    cargarCuentas();

    const handleSync = () => {
      cargarCuentas(true);
    };

    window.addEventListener('taller_cuentacorriente_sync', handleSync);
    window.addEventListener('storage', handleSync);

    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.onmessage = (ev) => {
          if (ev.data && (ev.data.type === 'CUENTA_CORRIENTE_UPDATED' || ev.data.type === 'TURNO_ATENDIDO')) {
            cargarCuentas(true);
          }
        };
      } catch {}
    }

    return () => {
      window.removeEventListener('taller_cuentacorriente_sync', handleSync);
      window.removeEventListener('storage', handleSync);
      if (bc) bc.close();
    };
  }, []);

  // Filtrado según perfil (Cliente vs Admin) y búsqueda
  const itemsFiltrados = useMemo(() => {
    let result = [...items];

    // Si es modo lectura de cliente, filtrar exclusivamente por su cuenta
    if (modoLectura) {
      const cleanEmail = (clientEmail || '').toLowerCase().trim();
      const patentesUpper = clientPatentes.map((p) => (p || '').toUpperCase().trim());

      result = result.filter((item) => {
        const itemEmail = (item.clienteEmail || '').toLowerCase().trim();
        const itemPat = (item.patente || '').toUpperCase().trim();
        const emailMatch = cleanEmail && itemEmail === cleanEmail;
        const patenteMatch = patentesUpper.length > 0 && patentesUpper.includes(itemPat);
        return emailMatch || patenteMatch;
      });
    }

    // Filtro por Estado
    if (filtroEstado === 'pendientes') {
      result = result.filter((item) => item.saldoPendiente > 0);
    } else if (filtroEstado === 'pagados') {
      result = result.filter((item) => item.saldoPendiente <= 0 || item.estado === 'pagado');
    }

    // Filtro por Búsqueda
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter((item) => {
        return (
          (item.patente || '').toLowerCase().includes(q) ||
          (item.clienteNombre || '').toLowerCase().includes(q) ||
          (item.clienteEmail || '').toLowerCase().includes(q) ||
          (item.concepto || '').toLowerCase().includes(q) ||
          (item.id || '').toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [items, modoLectura, clientEmail, clientPatentes, filtroEstado, search]);

  // Totales financieros calculados
  const metricas = useMemo(() => {
    let totalDeudaPendiente = 0;
    let totalCobrado = 0;
    let cantidadPendientes = 0;

    itemsFiltrados.forEach((item) => {
      const pend = Number(item.saldoPendiente) || 0;
      const pag = Number(item.montoPagado) || 0;
      totalDeudaPendiente += pend;
      totalCobrado += pag;
      if (pend > 0) {
        cantidadPendientes += 1;
      }
    });

    return {
      totalDeudaPendiente,
      totalCobrado,
      cantidadPendientes,
      totalRegistros: itemsFiltrados.length,
    };
  }, [itemsFiltrados]);

  // Manejar creación manual (Admin)
  const handleGuardarNuevo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPat = nuevoPatente.trim().toUpperCase();
    const montoNum = parseFloat(nuevoMonto);

    if (!cleanPat) {
      onShowToast('warning', 'Patente requerida', 'Ingresa la patente del vehículo.');
      return;
    }
    if (isNaN(montoNum) || montoNum <= 0) {
      onShowToast('warning', 'Monto inválido', 'El monto adeudado debe ser un número mayor a cero.');
      return;
    }
    if (!nuevoConcepto.trim()) {
      onShowToast('warning', 'Concepto requerido', 'Indica el concepto o trabajo realizado.');
      return;
    }

    setGuardandoNuevo(true);
    try {
      const res = await gasApi.crearMovimientoCuentaCorriente({
        fecha: getFechaHoyArgentina(),
        patente: cleanPat,
        clienteNombre: nuevoClienteNombre.trim() || 'Cliente Taller',
        clienteEmail: nuevoClienteEmail.trim() || `${cleanPat.toLowerCase()}@cliente.taller`,
        concepto: nuevoConcepto.trim(),
        montoTotal: montoNum,
        observaciones: nuevoObservaciones.trim(),
      });

      if (res.success) {
        onShowToast(
          'success',
          '¡Cuenta Corriente creada!',
          `Se registró una deuda de $${montoNum.toLocaleString('es-AR')} para ${cleanPat}.`
        );
        setShowCrearModal(false);
        setNuevoPatente('');
        setNuevoClienteNombre('');
        setNuevoClienteEmail('');
        setNuevoConcepto('');
        setNuevoMonto('');
        setNuevoObservaciones('');
        await cargarCuentas(true);
      } else {
        onShowToast('error', 'Error al guardar', res.error || 'No se pudo crear la cuenta corriente.');
      }
    } catch (err: any) {
      onShowToast('error', 'Error', err.message || 'Error inesperado.');
    } finally {
      setGuardandoNuevo(false);
    }
  };

  // Abrir Modal de Cobro (Admin)
  const abrirModalCobro = (item: CuentaCorrienteItem) => {
    setItemACobrar(item);
    setMontoCobro(item.saldoPendiente.toString());
    setMetodoPagoCobro('Efectivo');
    setComprobanteCobro('');
  };

  // Procesar Cobro en Taller (Admin)
  const handleConfirmarCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemACobrar) return;

    const montoNum = parseFloat(montoCobro);
    if (isNaN(montoNum) || montoNum <= 0) {
      onShowToast('warning', 'Monto inválido', 'Ingresa un monto válido a cobrar.');
      return;
    }
    if (montoNum > itemACobrar.saldoPendiente) {
      onShowToast(
        'warning',
        'Monto excede deuda',
        `El saldo pendiente actual es de $${itemACobrar.saldoPendiente.toLocaleString('es-AR')}.`
      );
      return;
    }

    setProcesandoCobro(true);
    try {
      const res = await gasApi.cobrarCuentaCorriente(
        itemACobrar.id,
        montoNum,
        metodoPagoCobro,
        comprobanteCobro.trim()
      );

      if (res.success) {
        onShowToast(
          'success',
          '¡Cobro registrado con éxito!',
          `Se ingresaron $${montoNum.toLocaleString('es-AR')} a Contabilidad por caja de taller.`
        );
        setItemACobrar(null);
        if (onContabilidadUpdated) {
          onContabilidadUpdated();
        }
        await cargarCuentas(true);
      } else {
        onShowToast('error', 'Error al procesar cobro', res.error || 'No se pudo asentar el pago.');
      }
    } catch (err: any) {
      onShowToast('error', 'Error', err.message || 'Falla al cobrar cuenta corriente.');
    } finally {
      setProcesandoCobro(false);
    }
  };

  // Eliminar Cuenta Corriente (Admin)
  const handleConfirmarEliminar = async () => {
    if (!itemAEliminar) return;

    setProcesandoEliminar(true);
    try {
      const res = await gasApi.eliminarCuentaCorriente(itemAEliminar.id);
      if (res.success) {
        onShowToast(
          'info',
          'Registro eliminado',
          `Se eliminó la cuenta corriente de ${itemAEliminar.patente} y se limpió cualquier ingreso asociado.`
        );
        setItemAEliminar(null);
        if (onContabilidadUpdated) {
          onContabilidadUpdated();
        }
        await cargarCuentas(true);
      } else {
        onShowToast('error', 'No se pudo eliminar', res.error || 'Error al eliminar el registro.');
      }
    } catch (e: any) {
      onShowToast('error', 'Error', e.message || 'Error al eliminar.');
    } finally {
      setProcesandoEliminar(false);
    }
  };

  // Pagar con Mercado Pago (Cliente) - SIEMPRE TOTAL, SIN PAGO PARCIAL
  const handlePagarMercadoPago = async (item: CuentaCorrienteItem) => {
    if (item.saldoPendiente <= 0) {
      onShowToast('info', 'Sin saldo pendiente', 'Esta cuenta corriente ya se encuentra totalmente saldada.');
      return;
    }

    setProcesandoMPId(item.id);
    setModalMercadoPago({
      isOpen: true,
      item,
      urlPago: null,
      cargando: true,
      error: null,
    });
    onShowToast('info', 'Conectando con Mercado Pago...', `Generando orden segura para cancelar el total de $${item.saldoPendiente.toLocaleString('es-AR')}...`);

    try {
      const res = await gasApi.pagarCuentaCorrienteMercadoPago(item.id, item);
      if (res.success && res.urlPago) {
        setModalMercadoPago({
          isOpen: true,
          item,
          urlPago: res.urlPago,
          cargando: false,
          error: null,
        });

        // Intentar apertura inmediata en nueva pestaña
        try {
          const opened = window.open(res.urlPago, '_blank', 'noopener,noreferrer');
          if (!opened && window.top && window.top !== window) {
            try {
              window.top.location.href = res.urlPago;
            } catch {}
          }
        } catch (openErr) {
          console.warn('Ventana bloqueada, el usuario puede presionar el botón directo del modal:', openErr);
        }
      } else {
        setModalMercadoPago({
          isOpen: true,
          item,
          urlPago: null,
          cargando: false,
          error: res.error || 'No se pudo generar la orden de Mercado Pago.',
        });
      }
    } catch (err: any) {
      setModalMercadoPago({
        isOpen: true,
        item,
        urlPago: null,
        cargando: false,
        error: err.message || 'Error de conexión con Mercado Pago.',
      });
    } finally {
      setProcesandoMPId(null);
    }
  };

  // Verificar con la API oficial de Mercado Pago antes de asentar el cobro
  const handleConfirmarPagoOnline = async (item: CuentaCorrienteItem, esSimulacion = false) => {
    setProcesandoAcreditacion(true);
    try {
      if (esSimulacion) {
        const metodo = 'Mercado Pago (Simulación Test)';
        const compRef = `MP-SIM-${Date.now()}`;
        const cobroRes = await gasApi.cobrarCuentaCorriente(
          item.id,
          item.saldoPendiente,
          metodo,
          compRef
        );
        if (cobroRes.success) {
          onShowToast(
            'success',
            '¡Simulación de Pago Aprobada!',
            `Se canceló la totalidad adeudada ($${item.saldoPendiente.toLocaleString('es-AR')}) y se impactó el ingreso en Contabilidad.`
          );
          setModalMercadoPago({ isOpen: false, item: null, urlPago: null, cargando: false, error: null });
          await cargarCuentas(true);
        }
        return;
      }

      // Verificación real con la API de Mercado Pago
      onShowToast('info', 'Verificando con Mercado Pago...', 'Consultando estado oficial de la transacción...');
      const resVerif = await gasApi.verificarPagoMercadoPago({ externalReference: item.id });

      if (resVerif.aprobado) {
        const metodo = 'Mercado Pago (Online)';
        const compRef = resVerif.paymentId ? `MP-${resVerif.paymentId}` : `MP-ONLINE-${item.id}`;
        const cobroRes = await gasApi.cobrarCuentaCorriente(
          item.id,
          item.saldoPendiente,
          metodo,
          compRef
        );

        if (cobroRes.success) {
          onShowToast(
            'success',
            '¡Pago Verificado y Acreditado!',
            `Mercado Pago confirmó la transacción aprobada (ID: ${resVerif.paymentId || 'OK'}). Se canceló la deuda de $${item.saldoPendiente.toLocaleString('es-AR')} en cuenta corriente e impactó en Contabilidad.`
          );
          setModalMercadoPago({ isOpen: false, item: null, urlPago: null, cargando: false, error: null });
          await cargarCuentas(true);
        } else {
          onShowToast('error', 'Error al asentar', cobroRes.error || 'No se pudo asentar el cobro.');
        }
      } else {
        // NO APROBADO: No tocar la deuda
        const estadoDesc =
          resVerif.estado === 'pending'
            ? 'Pago pendiente de acreditación'
            : resVerif.estado === 'rejected'
            ? 'Pago rechazado por el banco'
            : 'No se detectó ningún pago completado';

        onShowToast(
          'warning',
          'Pago No Acreditado',
          `${estadoDesc}. Si cerraste la ventana de Mercado Pago sin pagar o cancelaste la operación, la deuda de $${item.saldoPendiente.toLocaleString('es-AR')} continúa pendiente.`
        );
      }
    } catch (e: any) {
      onShowToast('error', 'Error al verificar', e.message || 'Error al comunicarse con Mercado Pago.');
    } finally {
      setProcesandoAcreditacion(false);
    }
  };

  // Compartir estado por WhatsApp
  const compartirPorWhatsApp = (item: CuentaCorrienteItem) => {
    const texto = `Hola ${item.clienteNombre || 'Cliente'}, te compartimos el resumen de tu Cuenta Corriente en *La Casa de la Dirección*:%0A%0A` +
      `🚗 *Vehículo:* ${item.patente}%0A` +
      `🔧 *Concepto:* ${item.concepto}%0A` +
      `💰 *Monto Total:* $${item.montoTotal.toLocaleString('es-AR')}%0A` +
      `💵 *Abonado:* $${item.montoPagado.toLocaleString('es-AR')}%0A` +
      `🔴 *Saldo Pendiente:* $${item.saldoPendiente.toLocaleString('es-AR')}%0A` +
      `📅 *Fecha:* ${formatearFechaArgentina(item.fecha)}%0A%0A` +
      `Cualquier consulta no dudes en respondernos. ¡Gracias!`;

    const url = `https://wa.me/?text=${texto}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* HEADER & RESUMEN */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
              <CreditCard className="w-5 h-5" />
            </span>
            <h2 className="text-xl font-heading font-black text-white uppercase tracking-wider">
              {modoLectura ? 'Mi Cuenta Corriente' : 'Gestión de Cuentas Corrientes'}
            </h2>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            {modoLectura
              ? 'Consulta el estado de deudas y saldos de tus vehículos. Cancela el saldo total pendiente mediante Mercado Pago.'
              : 'Control exhaustivo de deudas pendientes de cobro y cancelaciones. Los pagos impactan automáticamente en Contabilidad.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => cargarCuentas()}
            className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 transition-colors cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {!modoLectura && (
            <button
              type="button"
              onClick={() => setShowCrearModal(true)}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-950/50 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Cuenta Corriente</span>
            </button>
          )}
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Deuda Pendiente */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-red-950/60 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider">
              {modoLectura ? 'Total a Abonar' : 'Total Deuda Pendiente'}
            </span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-red-500">
              ${metricas.totalDeudaPendiente.toLocaleString('es-AR')}
            </span>
            {metricas.cantidadPendientes > 0 && (
              <span className="text-[10px] text-red-400 font-bold">
                ({metricas.cantidadPendientes} {metricas.cantidadPendientes === 1 ? 'deuda' : 'deudas'})
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {modoLectura ? 'Saldo pendiente total a cancelar' : 'Importe por cobrar no ingresado aún en caja'}
          </p>
        </div>

        {/* Total Cancelado / Cobrado */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-emerald-950/60 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-600/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
              {modoLectura ? 'Total Abonado' : 'Total Cobrado / Saldado'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2">
            <span className="font-mono text-2xl font-black text-emerald-400">
              ${metricas.totalCobrado.toLocaleString('es-AR')}
            </span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {modoLectura ? 'Pagos ya acreditados y registrados' : 'Ingresado y asentado en Contabilidad'}
          </p>
        </div>

        {/* Estado General */}
        <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-neutral-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider">
              Estado de Cuenta
            </span>
            <ShieldCheck className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-2">
            {metricas.totalDeudaPendiente === 0 ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-600/60 text-emerald-400 font-mono text-sm font-black">
                <Check className="w-4 h-4" /> Al día (Sin Deudas)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-600/60 text-red-400 font-mono text-sm font-black">
                <AlertTriangle className="w-4 h-4" /> Deuda Activa
              </span>
            )}
          </div>
          <p className="text-[11px] text-neutral-500 mt-1">
            {metricas.totalRegistros} {metricas.totalRegistros === 1 ? 'registro cargado' : 'registros cargados'}
          </p>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900/40 border border-neutral-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={modoLectura ? "Buscar por patente o trabajo..." : "Buscar por patente, cliente, email o concepto..."}
            className="w-full pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros por estado */}
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
          <button
            type="button"
            onClick={() => setFiltroEstado('todos')}
            className={`px-3 py-1.5 rounded text-[11px] font-heading font-bold uppercase transition-all ${
              filtroEstado === 'todos'
                ? 'bg-neutral-800 text-white'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('pendientes')}
            className={`px-3 py-1.5 rounded text-[11px] font-heading font-bold uppercase transition-all ${
              filtroEstado === 'pendientes'
                ? 'bg-red-600 text-white'
                : 'text-neutral-400 hover:text-red-400'
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setFiltroEstado('pagados')}
            className={`px-3 py-1.5 rounded text-[11px] font-heading font-bold uppercase transition-all ${
              filtroEstado === 'pagados'
                ? 'bg-emerald-600 text-white'
                : 'text-neutral-400 hover:text-emerald-400'
            }`}
          >
            Saldados
          </button>
        </div>
      </div>

      {/* LISTADO DE CUENTAS CORRIENTES */}
      {loading ? (
        <div className="py-16 text-center text-neutral-500 text-xs flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
          <span>Cargando cuentas corrientes...</span>
        </div>
      ) : itemsFiltrados.length === 0 ? (
        <div className="py-16 text-center p-8 rounded-2xl bg-neutral-900/20 border border-neutral-800 text-neutral-400 text-xs flex flex-col items-center gap-2">
          <CheckCircle2 className="w-8 h-8 text-neutral-600 mb-1" />
          <span className="font-heading font-bold text-white text-sm">
            {modoLectura ? 'No tienes deudas pendientes' : 'No se encontraron registros de cuenta corriente'}
          </span>
          <p className="text-neutral-500 max-w-sm">
            {modoLectura
              ? 'Tus vehículos registrados se encuentran al día con los trabajos y pagos del taller.'
              : 'Las deudas cargadas aquí o diferidas desde presupuestos aparecerán en este panel.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {itemsFiltrados.map((item) => {
            const tieneSaldo = item.saldoPendiente > 0;
            const esPagadoTotal = item.saldoPendiente <= 0 || item.estado === 'pagado';

            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl bg-[#0d0d0d] border transition-all shadow-xl flex flex-col justify-between gap-4 overflow-hidden relative ${
                  tieneSaldo
                    ? 'border-neutral-800 hover:border-red-900/60 border-l-4 border-l-red-600'
                    : 'border-neutral-900 hover:border-emerald-900/40 border-l-4 border-l-emerald-600 bg-neutral-950/40 opacity-90'
                }`}
              >
                {/* Header de la tarjeta */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 rounded bg-neutral-900 border border-neutral-700 font-mono text-sm font-black text-white tracking-widest uppercase shadow-inner">
                        {item.patente}
                      </span>
                      {item.clienteNombre && (
                        <span className="text-xs font-heading font-bold text-neutral-300 truncate max-w-[170px]">
                          {item.clienteNombre}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                          esPagadoTotal
                            ? 'bg-emerald-950/80 border-emerald-600/60 text-emerald-400'
                            : item.montoPagado > 0
                            ? 'bg-amber-950/80 border-amber-600/60 text-amber-400'
                            : 'bg-red-950/80 border-red-600/60 text-red-400'
                        }`}
                      >
                        {esPagadoTotal ? 'Saldado' : item.montoPagado > 0 ? 'Pago Parcial' : 'Pendiente'}
                      </span>
                    </div>
                  </div>

                  {/* Concepto y detalles */}
                  <div className="mt-3">
                    <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">
                      {item.concepto}
                    </h3>
                    {item.observaciones && (
                      <p className="text-[11px] text-neutral-400 italic mt-1 line-clamp-2">
                        &ldquo;{item.observaciones}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Metadatos */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-neutral-500" />
                      <span>Emisión: {formatearFechaArgentina(item.fecha)}</span>
                    </div>
                    {item.clienteEmail && !modoLectura && (
                      <div className="flex items-center gap-1">
                        <Mail className="w-3 h-3 text-neutral-500" />
                        <span className="truncate max-w-[150px]">{item.clienteEmail}</span>
                      </div>
                    )}
                    {item.ultimoPagoFecha && (
                      <div className="flex items-center gap-1 text-emerald-400/90">
                        <Check className="w-3 h-3" />
                        <span>Último pago: {formatearFechaArgentina(item.ultimoPagoFecha)} ({item.metodoUltimoPago || 'Caja'})</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Desglose de Montos */}
                <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-900/80 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block">Total</span>
                    <span className="font-mono text-sm font-bold text-neutral-300">
                      ${item.montoTotal.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-neutral-500 block">Abonado</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      ${item.montoPagado.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="border-l border-neutral-900">
                    <span className="text-[10px] uppercase font-mono text-red-400 block font-bold">Saldo</span>
                    <span className={`font-mono text-base font-black ${tieneSaldo ? 'text-red-500' : 'text-emerald-400'}`}>
                      ${item.saldoPendiente.toLocaleString('es-AR')}
                    </span>
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="pt-2 border-t border-neutral-900 flex items-center justify-between gap-2">
                  {/* Si es Modo Lectura (Cliente) */}
                  {modoLectura ? (
                    <div className="w-full flex items-center justify-between gap-3">
                      {tieneSaldo ? (
                        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          <div className="text-[11px] text-neutral-400">
                            <span className="text-white font-bold block">Cancelar Deuda Total:</span>
                            <span className="text-neutral-500">Pago seguro en 1 pago mediante Mercado Pago</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePagarMercadoPago(item)}
                            disabled={procesandoMPId === item.id}
                            className="px-4 py-2.5 rounded-xl bg-[#009ee3] hover:bg-[#0082ba] active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-[#009ee3]/20 transition-all cursor-pointer disabled:opacity-50"
                            title={`Abonar total adeudado de $${item.saldoPendiente.toLocaleString('es-AR')}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>
                              {procesandoMPId === item.id ? 'Conectando...' : `Pagar $${item.saldoPendiente.toLocaleString('es-AR')} con Mercado Pago`}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="w-full py-1.5 px-3 rounded-lg bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-xs font-medium flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Cuenta saldada en su totalidad. ¡Gracias por confiar en el taller!</span>
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Si es Modo Admin (Edición y Cobro) */
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => compartirPorWhatsApp(item)}
                          className="p-2 rounded-lg bg-neutral-900 hover:bg-emerald-950/60 border border-neutral-800 hover:border-emerald-700/60 text-neutral-400 hover:text-emerald-400 transition-colors cursor-pointer"
                          title="Enviar resumen por WhatsApp al cliente"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemAEliminar(item)}
                          className="p-2 rounded-lg bg-neutral-900 hover:bg-red-950/60 border border-neutral-800 hover:border-red-700/60 text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Eliminar registro de cuenta corriente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {tieneSaldo ? (
                        <button
                          type="button"
                          onClick={() => abrirModalCobro(item)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-emerald-950 transition-all cursor-pointer"
                          title="Cobrar en caja de taller e impactar en contabilidad"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Cobrar en Taller</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-500 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Totalmente Saldado
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: CREAR NUEVA CUENTA CORRIENTE (ADMIN) */}
      {showCrearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30">
                  <CreditCard className="w-4 h-4" />
                </span>
                <h3 className="font-heading font-black text-white text-base uppercase tracking-wider">
                  Cargar Deuda en Cuenta Corriente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCrearModal(false)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGuardarNuevo} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                    Patente del Vehículo *
                  </label>
                  <input
                    type="text"
                    required
                    value={nuevoPatente}
                    onChange={(e) => setNuevoPatente(e.target.value.toUpperCase())}
                    placeholder="Ej: AB123CD"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-mono font-bold text-white uppercase focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                    Monto Adeudado ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={nuevoMonto}
                    onChange={(e) => setNuevoMonto(e.target.value)}
                    placeholder="Ej: 85000"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-sm font-mono font-bold text-emerald-400 focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                    Nombre del Cliente
                  </label>
                  <input
                    type="text"
                    value={nuevoClienteNombre}
                    onChange={(e) => setNuevoClienteNombre(e.target.value)}
                    placeholder="Ej: Juan Pérez"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                    Email del Cliente (Para su panel)
                  </label>
                  <input
                    type="email"
                    value={nuevoClienteEmail}
                    onChange={(e) => setNuevoClienteEmail(e.target.value)}
                    placeholder="cliente@ejemplo.com"
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                  Concepto / Detalle de los Trabajos *
                </label>
                <input
                  type="text"
                  required
                  value={nuevoConcepto}
                  onChange={(e) => setNuevoConcepto(e.target.value)}
                  placeholder="Ej: Reparación cremallera hidráulica y extremos"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                  Observaciones internas
                </label>
                <textarea
                  rows={2}
                  value={nuevoObservaciones}
                  onChange={(e) => setNuevoObservaciones(e.target.value)}
                  placeholder="Ej: Se compromete a abonar el viernes..."
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-red-500 focus:outline-none resize-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-900 text-[11px] text-neutral-400">
                ℹ️ <strong>Nota contable:</strong> Esta deuda queda archivada en Cuentas Corrientes y figurará al usuario. <strong>NO ingresa a Contabilidad</strong> hasta el momento en que se cobre.
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCrearModal(false)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-heading font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoNuevo}
                  className="px-5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-heading font-black uppercase tracking-wider shadow-lg shadow-red-950 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {guardandoNuevo ? 'Guardando...' : 'Confirmar y Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: COBRAR EN TALLER (ADMIN) */}
      {itemACobrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-neutral-800 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-500 border border-emerald-500/30">
                  <DollarSign className="w-4 h-4" />
                </span>
                <h3 className="font-heading font-black text-white text-base uppercase tracking-wider">
                  Cobrar Cuenta Corriente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setItemACobrar(null)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarCobro} className="mt-4 space-y-4">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-900 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Vehículo:</span>
                  <span className="font-mono font-bold text-white uppercase">{itemACobrar.patente}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Cliente:</span>
                  <span className="text-neutral-300 font-semibold">{itemACobrar.clienteNombre || 'Sin nombre'}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-neutral-900">
                  <span className="text-red-400 font-bold">Saldo Pendiente:</span>
                  <span className="font-mono font-black text-red-500 text-sm">
                    ${itemACobrar.saldoPendiente.toLocaleString('es-AR')}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] uppercase font-mono text-neutral-400 block">
                    Monto a Cobrar ($) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setMontoCobro(itemACobrar.saldoPendiente.toString())}
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                  >
                    Cobrar Total ($ {itemACobrar.saldoPendiente.toLocaleString('es-AR')})
                  </button>
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={itemACobrar.saldoPendiente}
                  step="any"
                  value={montoCobro}
                  onChange={(e) => setMontoCobro(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-base font-mono font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                  Método de Pago *
                </label>
                <select
                  value={metodoPagoCobro}
                  onChange={(e) => setMetodoPagoCobro(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Efectivo">Efectivo en Caja</option>
                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                  <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                  <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  <option value="Mercado Pago (Mostrador)">Mercado Pago (QR / Punto)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-mono text-neutral-400 block mb-1">
                  N° Comprobante / Recibo (Opcional)
                </label>
                <input
                  type="text"
                  value={comprobanteCobro}
                  onChange={(e) => setComprobanteCobro(e.target.value)}
                  placeholder="Ej: REC-0045 o N° Transferencia"
                  className="w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-900/40 text-[11px] text-emerald-300">
                ✅ <strong>Impacto automático:</strong> Este cobro ingresará de inmediato al libro de <strong>Contabilidad</strong> como Ingreso de Caja con el concepto de cobro de cuenta corriente.
              </div>

              <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setItemACobrar(null)}
                  className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-heading font-bold uppercase transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoCobro}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-heading font-black uppercase tracking-wider shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {procesandoCobro ? 'Asentando Cobro...' : 'Confirmar Ingreso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR ELIMINACIÓN (ADMIN) */}
      {itemAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0f0f0f] border border-red-950/80 rounded-2xl p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-3">
              <span className="p-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/30">
                <Trash2 className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-heading font-black text-white text-base uppercase tracking-wider">
                  Eliminar Cuenta Corriente
                </h3>
                <span className="text-xs text-neutral-400">Patente: {itemAEliminar.patente}</span>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              ¿Estás seguro de eliminar este registro de cuenta corriente por <strong>${itemAEliminar.montoTotal.toLocaleString('es-AR')}</strong>?
            </p>

            <div className="my-3 p-3 rounded-lg bg-red-950/30 border border-red-900/40 text-[11px] text-red-300">
              ⚠️ Si este registro ya tenía un cobro asentado en la caja contable, <strong>se limpiará en cascada</strong> para mantener el balance contable 100% fidedigno y sin duplicados.
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setItemAEliminar(null)}
                className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 text-xs font-heading font-bold uppercase transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                disabled={procesandoEliminar}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-heading font-black uppercase tracking-wider shadow-lg shadow-red-950 transition-all disabled:opacity-50"
              >
                {procesandoEliminar ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHECKOUT MERCADO PAGO OFICIAL (100% TOTAL, INFALIBLE) */}
      {modalMercadoPago.isOpen && modalMercadoPago.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#0d0d0d] border border-[#009ee3]/50 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
            {/* Glow decorativo de Mercado Pago */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#009ee3]/15 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between pb-4 border-b border-neutral-800 relative z-10">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-[#009ee3]/20 text-[#009ee3] border border-[#009ee3]/30">
                  <CreditCard className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="font-heading font-black text-white text-base sm:text-lg uppercase tracking-wider flex items-center gap-2">
                    <span>Mercado Pago Oficial</span>
                    <span className="text-[10px] bg-[#009ee3]/20 text-[#009ee3] border border-[#009ee3]/40 px-2 py-0.5 rounded-full uppercase tracking-normal">
                      Pago Total
                    </span>
                  </h3>
                  <p className="text-xs text-neutral-400">Cancelación segura de cuenta corriente</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setModalMercadoPago({ isOpen: false, item: null, urlPago: null, cargando: false, error: null })}
                className="p-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjeta de detalle de la deuda */}
            <div className="my-5 p-4 rounded-2xl bg-neutral-900/70 border border-neutral-800/80 space-y-3 relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Vehículo:</span>
                <span className="font-mono font-bold text-white uppercase bg-black px-2.5 py-1 rounded-lg border border-neutral-800">
                  🚗 {modalMercadoPago.item.patente}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Concepto:</span>
                <span className="text-neutral-200 font-medium text-right max-w-[240px] truncate">
                  {modalMercadoPago.item.concepto}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Titular:</span>
                <span className="text-neutral-200 font-medium">
                  {modalMercadoPago.item.clienteNombre || 'Cliente del Taller'}
                </span>
              </div>
              <div className="pt-3 border-t border-neutral-800/80 flex items-baseline justify-between">
                <div>
                  <span className="text-xs uppercase font-mono text-neutral-400 block font-bold">Total a cancelar:</span>
                  <span className="text-[10px] text-cyan-400 font-medium">100% Saldo Deudor Completo</span>
                </div>
                <span className="font-mono text-2xl sm:text-3xl font-black text-emerald-400">
                  ${modalMercadoPago.item.saldoPendiente.toLocaleString('es-AR')}
                </span>
              </div>
            </div>

            {/* Estado de carga */}
            {modalMercadoPago.cargando && (
              <div className="py-6 flex flex-col items-center justify-center gap-3 text-center relative z-10">
                <RefreshCw className="w-8 h-8 text-[#009ee3] animate-spin" />
                <p className="text-sm font-medium text-white">Generando orden de pago en Mercado Pago...</p>
                <p className="text-xs text-neutral-400">Conectando de forma segura con la pasarela oficial.</p>
              </div>
            )}

            {/* Error si lo hubiese */}
            {modalMercadoPago.error && (
              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-900/60 space-y-2 mb-4 relative z-10">
                <div className="flex items-center gap-2 text-red-400 text-xs font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>Aviso de Mercado Pago</span>
                </div>
                <p className="text-xs text-neutral-300">{modalMercadoPago.error}</p>
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePagarMercadoPago(modalMercadoPago.item!)}
                    className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-heading font-bold"
                  >
                    Reintentar conexión
                  </button>
                  <button
                    type="button"
                    disabled={procesandoAcreditacion}
                    onClick={() => handleConfirmarPagoOnline(modalMercadoPago.item!, true)}
                    className="px-3 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-xs font-heading font-bold flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simular pago aprobado (Modo Demo)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Botón Principal cuando la URL está lista */}
            {modalMercadoPago.urlPago && (
              <div className="space-y-4 relative z-10">
                <a
                  href={modalMercadoPago.urlPago}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 px-6 rounded-2xl bg-[#009ee3] hover:bg-[#0082ba] active:scale-98 text-white font-heading font-black text-sm sm:text-base uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl shadow-[#009ee3]/30 transition-all border border-cyan-300/30 cursor-pointer text-center group"
                >
                  <CreditCard className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>ABRIR MERCADO PAGO Y PAGAR ↗</span>
                </a>

                <p className="text-[11px] text-center text-neutral-400 leading-relaxed">
                  Podés abonar con dinero en cuenta de Mercado Pago, Débito o Crédito. La pasarela se abre en una pestaña segura de Mercado Pago.
                </p>

                <div className="pt-3 border-t border-neutral-800 space-y-2">
                  <div className="text-[11px] text-neutral-400 text-center">
                    ¿Completaste el pago en Mercado Pago? Verificá la acreditación real:
                  </div>
                  <button
                    type="button"
                    disabled={procesandoAcreditacion}
                    onClick={() => handleConfirmarPagoOnline(modalMercadoPago.item!, false)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-heading font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{procesandoAcreditacion ? 'Verificando con Mercado Pago...' : 'Verificar y Acreditar Pago'}</span>
                  </button>
                  <p className="text-[10px] text-center text-neutral-500">
                    * El sistema consultará directamente a Mercado Pago. Si cerraste la ventana sin pagar, la deuda no se cancelará.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-neutral-900 flex justify-end">
              <button
                type="button"
                onClick={() => setModalMercadoPago({ isOpen: false, item: null, urlPago: null, cargando: false, error: null })}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white text-xs font-heading font-bold uppercase transition-colors"
              >
                Cerrar (Sin Cambios)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
