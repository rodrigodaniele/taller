import { useState, useEffect, useId, useMemo } from 'react';
import {
  FileText,
  PlusCircle,
  Search,
  Printer,
  Share2,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  DollarSign,
  X,
  ShieldCheck,
  Check,
  Copy,
  Car,
  Calendar,
  Phone,
  User,
  AlertCircle,
  RefreshCw,
  MessageCircle,
  CreditCard
} from 'lucide-react';
import { Presupuesto, ItemPresupuesto, TurnoAdmin } from '../types';
import { WORKSHOP_ITEMS, TRABAJOS_TALLER_SERVICIOS, REPUESTOS_TALLER_PIEZAS } from '../constants/workshopItems';
import { VEHICULOS_ARGENTINA, VEHICULOS_POR_MARCA } from '../constants/vehiclesArgentina';
import { gasApi } from '../services/gasApi';

interface PresupuestosManagerProps {
  turnosPendientes: TurnoAdmin[];
  presupuestosList?: Presupuesto[];
  onPresupuestosUpdated?: (updated: Presupuesto[]) => void;
  onRegistrarIngresoCaja: (
    concepto: string,
    monto: number,
    referencia: string,
    fecha?: string,
    presupuestoId?: string,
    presupuestoNumero?: string
  ) => void;
  onContabilidadUpdated?: () => void;
  onTurnoAtendido?: (patente: string) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
  initialTurnoParaPresupuestar?: TurnoAdmin | null;
  onClearInitialTurno?: () => void;
}

const STORAGE_KEY = 'taller_presupuestos_v1';

export { formatearFechaArgentina, calcularFechaVencimiento, formatearHorario, getFechaHoyArgentina, normalizarFechaArgentina } from '../utils/dateFormatter';
import { formatearFechaArgentina, calcularFechaVencimiento, formatearHorario, getFechaHoyArgentina, normalizarFechaArgentina } from '../utils/dateFormatter';

export const PresupuestosManager = ({
  turnosPendientes,
  presupuestosList,
  onPresupuestosUpdated,
  onRegistrarIngresoCaja,
  onContabilidadUpdated,
  onTurnoAtendido,
  onShowToast,
  initialTurnoParaPresupuestar,
  onClearInitialTurno,
}: PresupuestosManagerProps) => {
  // Main State
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(() => {
    if (presupuestosList && presupuestosList.length > 0) {
      return presupuestosList.map((p) => ({ ...p, fecha: normalizarFechaArgentina(p.fecha) }));
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const list: Presupuesto[] = JSON.parse(saved);
        return list.map((p) => ({ ...p, fecha: normalizarFechaArgentina(p.fecha) }));
      }
    } catch (e) {
      console.warn('Error loading presupuestos from localStorage:', e);
    }
    return [
      {
        id: 'pres-1',
        numero: 'P-1001',
        fecha: getFechaHoyArgentina(),
        validezDias: 7,
        clienteNombre: 'Carlos Gómez',
        clienteTelefono: '2625 441122',
        clienteEmail: 'carlos.gomez@gmail.com',
        vehiculoModelo: 'Peugeot 208',
        patente: 'PEU534',
        kilometraje: '124.000 km',
        items: [
          {
            id: 'item-1',
            tipo: 'mano_de_obra',
            descripcion: 'ALINEACIÓN Y BALANCEO',
            cantidad: 1,
            precioUnitario: 35000,
            subtotal: 35000,
          },
          {
            id: 'item-2',
            tipo: 'mano_de_obra',
            descripcion: 'CAMBIO DE EXTREMO DE DIRECCIÓN',
            cantidad: 2,
            precioUnitario: 14000,
            subtotal: 28000,
          },
          {
            id: 'item-3',
            tipo: 'repuesto',
            descripcion: 'EXTREMO DE DIRECCIÓN',
            cantidad: 2,
            precioUnitario: 24500,
            subtotal: 49000,
          },
        ],
        descuentoPorcentaje: 0,
        total: 112000,
        estado: 'pendiente',
        observaciones: 'Valores válidos por 7 días en efectivo o transferencia. Incluye garantía de alineación por 30 días.',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [, setLoadingSync] = useState(false);
  const [copiedText, setCopiedText] = useState(false);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | Presupuesto['estado']>('todos');

  // Modals
  const [showModalForm, setShowModalForm] = useState(false);
  const [presupuestoEnEdicion, setPresupuestoEnEdicion] = useState<Presupuesto | null>(null);
  const [presupuestoParaImprimir, setPresupuestoParaImprimir] = useState<Presupuesto | null>(null);
  const [presupuestoParaCtaCte, setPresupuestoParaCtaCte] = useState<Presupuesto | null>(null);
  const [montoEntregaCtaCte, setMontoEntregaCtaCte] = useState<string>('0');
  const [metodoPagoEntregaCtaCte, setMetodoPagoEntregaCtaCte] = useState<string>('Efectivo');

  // Form Fields
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [vehiculoModelo, setVehiculoModelo] = useState('');
  const [patente, setPatente] = useState('');
  const [fechaPresupuesto, setFechaPresupuesto] = useState(() => getFechaHoyArgentina());
  const [kilometraje, setKilometraje] = useState('');
  const [validezDias, setValidezDias] = useState(7);
  const [observaciones, setObservaciones] = useState('Presupuesto válido por 7 días. Precios en efectivo o transferencia bancaria. Mano de obra garantizada.');
  const [items, setItems] = useState<ItemPresupuesto[]>([]);
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState(0);
  const [selectedTurnoRef, setSelectedTurnoRef] = useState('');

  const searchInputId = useId();

  // Load from Google Sheets on mount
  useEffect(() => {
    const syncFromGoogleSheets = async () => {
      setLoadingSync(true);
      try {
        const res = await gasApi.getPresupuestos();
        if (res && res.presupuestos && res.presupuestos.length > 0) {
          setPresupuestos(res.presupuestos);
          if (onPresupuestosUpdated) {
            onPresupuestosUpdated(res.presupuestos);
          }
        }
      } catch (e) {
        console.warn('Error syncing presupuestos from Sheets:', e);
      } finally {
        setLoadingSync(false);
      }
    };

    syncFromGoogleSheets();
  }, []);

  // Sync to parent and localStorage if state changed
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presupuestos));
    } catch (e) {}

    if (onPresupuestosUpdated) {
      onPresupuestosUpdated(presupuestos);
    }
  }, [presupuestos]);

  // Sincronización en tiempo real desde el Administrador cuando se reciben presupuestos actualizados
  useEffect(() => {
    if (presupuestosList && presupuestosList.length > 0) {
      setPresupuestos((prev) => {
        const prevKeys = prev.map((p) => `${p.id}_${p.estado}`).join('|');
        const nextKeys = presupuestosList.map((p) => `${p.id}_${p.estado}`).join('|');
        if (prevKeys === nextKeys) return prev;
        return presupuestosList;
      });
    }
  }, [presupuestosList]);

  // If a turno was passed to quote directly from the Turnos tab
  useEffect(() => {
    if (initialTurnoParaPresupuestar) {
      iniciarNuevoPresupuesto(initialTurnoParaPresupuestar);
      if (onClearInitialTurno) {
        onClearInitialTurno();
      }
    }
  }, [initialTurnoParaPresupuestar]);

  const iniciarNuevoPresupuesto = (turno?: TurnoAdmin) => {
    setPresupuestoEnEdicion(null);
    if (turno) {
      setPatente(turno.patente.toUpperCase());
      setClienteEmail(turno.email || '');
      setClienteNombre(turno.nombre || '');
      setClienteTelefono(turno.telefono || '');
      setVehiculoModelo('');
      const fNorm = turno.fecha ? normalizarFechaArgentina(turno.fecha) : getFechaHoyArgentina();
      setFechaPresupuesto(fNorm);
      setSelectedTurnoRef(`${turno.patente} (${formatearFechaArgentina(turno.fecha)} ${formatearHorario(turno.horario)}hs)`);
    } else {
      setPatente('');
      setClienteEmail('');
      setClienteNombre('');
      setClienteTelefono('');
      setVehiculoModelo('');
      setFechaPresupuesto(getFechaHoyArgentina());
      setSelectedTurnoRef('');
    }
    setKilometraje('');
    setValidezDias(7);
    setObservaciones('Presupuesto válido por 7 días. Precios en efectivo o transferencia bancaria. Mano de obra garantizada.');
    setDescuentoPorcentaje(0);

    // Initial default row: Alineación y Balanceo
    setItems([
      {
        id: `item-${Date.now()}-1`,
        tipo: 'mano_de_obra',
        descripcion: 'ALINEACIÓN Y BALANCEO',
        cantidad: 1,
        precioUnitario: 35000,
        subtotal: 35000,
      },
    ]);

    setShowModalForm(true);
  };

  const editarPresupuesto = (p: Presupuesto) => {
    setPresupuestoEnEdicion(p);
    setPatente(p.patente);
    setFechaPresupuesto(p.fecha ? normalizarFechaArgentina(p.fecha) : getFechaHoyArgentina());
    setClienteNombre(p.clienteNombre);
    setClienteTelefono(p.clienteTelefono);
    setClienteEmail(p.clienteEmail || '');
    setVehiculoModelo(p.vehiculoModelo || '');
    setKilometraje(p.kilometraje || '');
    setValidezDias(p.validezDias);
    setObservaciones(p.observaciones || '');
    setDescuentoPorcentaje(p.descuentoPorcentaje || 0);
    setItems(p.items.length > 0 ? p.items : []);
    setSelectedTurnoRef(p.turnoRef || '');
    setShowModalForm(true);
  };

  // Add Item to form
  const agregarItem = (tipo: 'mano_de_obra' | 'repuesto', descripcionInicial = '') => {
    const nuevo: ItemPresupuesto = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      tipo,
      descripcion: descripcionInicial,
      cantidad: 1,
      precioUnitario: 0,
      subtotal: 0,
    };
    setItems((prev) => [...prev, nuevo]);
  };

  const actualizarItem = (id: string, campo: keyof ItemPresupuesto, valor: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const actualizado = { ...it, [campo]: valor };
        if (campo === 'cantidad' || campo === 'precioUnitario') {
          const cant = Math.max(1, Number(campo === 'cantidad' ? valor : it.cantidad) || 1);
          const prec = Math.max(0, Number(campo === 'precioUnitario' ? valor : it.precioUnitario) || 0);
          actualizado.cantidad = cant;
          actualizado.precioUnitario = prec;
          actualizado.subtotal = cant * prec;
        }
        return actualizado;
      })
    );
  };

  const eliminarItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Calculate live totals
  const subtotalManoObra = useMemo(() => {
    return items
      .filter((i) => i.tipo === 'mano_de_obra')
      .reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
  }, [items]);

  const subtotalRepuestos = useMemo(() => {
    return items
      .filter((i) => i.tipo === 'repuesto')
      .reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
  }, [items]);

  const totalBruto = subtotalManoObra + subtotalRepuestos;
  const montoDescuento = Math.round((totalBruto * (Number(descuentoPorcentaje) || 0)) / 100);
  const totalNeto = Math.max(0, totalBruto - montoDescuento);

  // Handle Turno selection inside modal: Autocompletes Patente, Nombre, Teléfono, Email!
  const handleTurnoSelect = (patenteTurno: string) => {
    const t = turnosPendientes.find((tp) => tp.patente === patenteTurno);
    if (t) {
      setPatente(t.patente);
      setClienteEmail(t.email || '');
      setClienteNombre(t.nombre || '');
      setClienteTelefono(t.telefono || '');
      const fNorm = t.fecha ? normalizarFechaArgentina(t.fecha) : getFechaHoyArgentina();
      setFechaPresupuesto(fNorm);
      setSelectedTurnoRef(`${t.patente} (${formatearFechaArgentina(t.fecha)} ${formatearHorario(t.horario)}hs)`);
    } else {
      setSelectedTurnoRef('');
    }
  };

  // Save budget to State and Google Sheets
  const guardarPresupuesto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patente.trim()) {
      onShowToast('warning', 'Falta la patente', 'Por favor ingresá la patente del vehículo.');
      return;
    }
    if (items.length === 0) {
      onShowToast('warning', 'Sin ítems', 'Agregá al menos un ítem o trabajo al presupuesto.');
      return;
    }

    const fechaFinalPresupuesto = fechaPresupuesto ? normalizarFechaArgentina(fechaPresupuesto) : getFechaHoyArgentina();
    let presupuestoAGuardar: Presupuesto;

    if (presupuestoEnEdicion) {
      presupuestoAGuardar = {
        ...presupuestoEnEdicion,
        fecha: fechaFinalPresupuesto,
        clienteNombre: clienteNombre.trim() || 'Cliente Mostrador',
        clienteTelefono: clienteTelefono.trim(),
        clienteEmail: clienteEmail.trim(),
        vehiculoModelo: vehiculoModelo.trim(),
        patente: patente.trim().toUpperCase(),
        kilometraje: kilometraje.trim(),
        validezDias,
        items,
        descuentoPorcentaje,
        total: totalNeto,
        observaciones: observaciones.trim(),
        turnoRef: selectedTurnoRef,
      };

      setPresupuestos((prev) =>
        prev.map((p) => (p.id === presupuestoEnEdicion.id ? presupuestoAGuardar : p))
      );
      onShowToast('success', 'Presupuesto actualizado', `Guardando ${presupuestoAGuardar.numero} en Google Sheets...`);
    } else {
      const nextNum = `P-${1000 + presupuestos.length + 1}`;

      presupuestoAGuardar = {
        id: `pres-${Date.now()}`,
        numero: nextNum,
        fecha: fechaFinalPresupuesto,
        validezDias,
        clienteNombre: clienteNombre.trim() || 'Cliente Mostrador',
        clienteTelefono: clienteTelefono.trim(),
        clienteEmail: clienteEmail.trim(),
        vehiculoModelo: vehiculoModelo.trim(),
        patente: patente.trim().toUpperCase(),
        kilometraje: kilometraje.trim(),
        items,
        descuentoPorcentaje,
        total: totalNeto,
        estado: 'pendiente',
        observaciones: observaciones.trim(),
        turnoRef: selectedTurnoRef,
        createdAt: new Date().toISOString(),
      };

      setPresupuestos((prev) => [presupuestoAGuardar, ...prev]);
      onShowToast('success', '¡Presupuesto creado!', `Guardando ${nextNum} por $${totalNeto.toLocaleString('es-AR')} en Google Sheets...`);
    }

    setShowModalForm(false);

    // Persist in Google Sheets (Hoja "Presupuestos")
    try {
      await gasApi.savePresupuesto(presupuestoAGuardar);
    } catch (err) {
      console.warn('Error al guardar en Google Sheets:', err);
    }
  };

  // REQUERIMIENTO 2: CUANDO EL ESTADO PASE A FACTURADO, INMEDIATAMENTE DEBE PASAR A LA CONTABILIDAD
  const cambiarEstado = async (
    id: string,
    nuevoEstado: Presupuesto['estado'],
    opcionesCtaCte?: { entrega?: number; metodoPago?: string }
  ) => {
    const p = presupuestos.find((x) => x.id === id);
    if (!p) return;

    const estadoAnterior = p.estado;

    // Actualizar estado en la lista local
    setPresupuestos((prev) =>
      prev.map((item) => (item.id === id ? { ...item, estado: nuevoEstado } : item))
    );

    // Si cambió a facturado y no estaba facturado antes, registrar de inmediato en Contabilidad y en Detalles_Turnos
    if (nuevoEstado === 'a_cuenta_corriente' && estadoAnterior !== 'a_cuenta_corriente') {
      const fechaPresupuesto = normalizarFechaArgentina(p.fecha);
      const cleanPat = (p.patente || '').trim().toUpperCase();

      const entrega = Math.max(0, Number(opcionesCtaCte?.entrega) || 0);
      const montoTotal = Number(p.total) || 0;
      const entregaReal = Math.min(entrega, montoTotal);
      const saldoDebiendo = Math.max(0, montoTotal - entregaReal);
      const metodoPago = opcionesCtaCte?.metodoPago || 'Efectivo';

      // 1. Crear el registro en Cuenta Corriente con el saldo adeudado y el monto entregado registrado
      gasApi.crearMovimientoCuentaCorriente({
        fecha: fechaPresupuesto,
        clienteNombre: p.clienteNombre || 'Cliente Taller',
        clienteEmail: p.clienteEmail || `${cleanPat.toLowerCase()}@cliente.taller`,
        patente: cleanPat,
        concepto: `Presupuesto ${p.numero} - ${p.vehiculoModelo || p.items[0]?.descripcion || 'Trabajo Taller'}`,
        montoTotal: montoTotal,
        montoPagado: entregaReal,
        saldoPendiente: saldoDebiendo,
        estado: saldoDebiendo <= 0 ? 'pagado' : entregaReal > 0 ? 'parcial' : 'pendiente',
        presupuestoId: p.id,
        observaciones:
          entregaReal > 0
            ? `Seña/Entrega de $${entregaReal.toLocaleString('es-AR')} abonada al retirar (${metodoPago}). Saldo pendiente a cuenta corriente: $${saldoDebiendo.toLocaleString('es-AR')}.`
            : `Adeudado 100% al retirar vehículo ${cleanPat}`,
        ultimoPagoFecha: entregaReal > 0 ? fechaPresupuesto : undefined,
        metodoUltimoPago: entregaReal > 0 ? metodoPago : undefined,
      });

      // Si hubo entrega inicial de dinero, impactar de inmediato en Caja/Contabilidad
      if (entregaReal > 0) {
        const conceptoAnticipo = `Entrega a Cta. Cte. ${p.numero} - ${cleanPat} (${p.vehiculoModelo || 'Trabajo taller'})`;
        onRegistrarIngresoCaja(conceptoAnticipo, entregaReal, cleanPat, fechaPresupuesto, p.id, p.numero);
      }

      // 2. Archivar turno atendido
      try {
        if (cleanPat) {
          const saved = localStorage.getItem('taller_turnos_atendidos_v1');
          const list: string[] = saved ? JSON.parse(saved) : [];
          if (!list.includes(cleanPat)) {
            list.push(cleanPat);
            localStorage.setItem('taller_turnos_atendidos_v1', JSON.stringify(list));
          }
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('lacasadeladireccion_realtime');
              bc.postMessage({ type: 'TURNO_ATENDIDO', patente: cleanPat });
              bc.close();
            } catch {}
          }
        }
      } catch (e) {}

      if (onTurnoAtendido) {
        onTurnoAtendido(p.patente);
      }

      try {
        const pConFechaNormalizada = { ...p, fecha: fechaPresupuesto, estado: 'a_cuenta_corriente' };
        gasApi.facturarPresupuestoYArchivar(pConFechaNormalizada).catch((err) => console.warn(err));
        gasApi.marcarTurnoAtendido(p.patente).catch((err) => console.warn(err));
      } catch (err) {}

      // 3. Descontar repuestos si corresponde
      try {
        if (Array.isArray(p.items) && p.items.length > 0) {
          gasApi.actualizarRotacionYDescontarStock(p.items, p.vehiculoModelo || '', fechaPresupuesto, {
            patente: p.patente,
            clienteNombre: p.clienteNombre,
            presupuestoNumero: p.numero || p.id,
          });
        }
      } catch (err) {}

      if (entregaReal > 0) {
        onShowToast(
          'warning',
          '¡Pase a Cuenta Corriente con Entrega!',
          `Vehículo ${p.patente} archivado. Ingresaron $${entregaReal.toLocaleString('es-AR')} a Caja y quedaron $${saldoDebiendo.toLocaleString('es-AR')} en deuda de Cuenta Corriente.`
        );
      } else {
        onShowToast(
          'warning',
          '¡Enviado a Cuenta Corriente!',
          `Vehículo ${p.patente} archivado. Se cargó una deuda de $${p.total.toLocaleString('es-AR')} en su Cuenta Corriente (no ingresa a Caja hasta que el cliente pague).`
        );
      }
    } else if (nuevoEstado === 'facturado' && estadoAnterior !== 'facturado') {
      const concepto = `Facturación ${p.numero} - ${p.patente} (${p.vehiculoModelo || p.items[0]?.descripcion || 'Trabajos varios'})`;
      const fechaPresupuesto = normalizarFechaArgentina(p.fecha);
      onRegistrarIngresoCaja(concepto, p.total, p.patente, fechaPresupuesto, p.id, p.numero);

      // Si venía de cuenta corriente, actualizar la ficha a saldada
      if (estadoAnterior === 'a_cuenta_corriente') {
        try {
          const savedCC = localStorage.getItem('taller_cuentas_corrientes_v1');
          if (savedCC) {
            const listCC = JSON.parse(savedCC);
            const ccMatch = listCC.find(
              (item: any) =>
                item.presupuestoId === p.id ||
                item.presupuestoId === p.numero ||
                (item.patente === p.patente && item.saldoPendiente > 0)
            );
            if (ccMatch) {
              ccMatch.montoPagado = ccMatch.montoTotal;
              ccMatch.saldoPendiente = 0;
              ccMatch.estado = 'pagado';
              ccMatch.ultimoPagoFecha = getFechaHoyArgentina();
              ccMatch.metodoUltimoPago = 'Caja de Taller';
              localStorage.setItem('taller_cuentas_corrientes_v1', JSON.stringify(listCC));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('taller_cuentacorriente_sync'));
              }
            }
          }
        } catch {}
      }

      // 1. Guardar en almacenamiento local como turno atendido
      try {
        const cleanPat = (p.patente || '').trim().toUpperCase();
        if (cleanPat) {
          const saved = localStorage.getItem('taller_turnos_atendidos_v1');
          const list: string[] = saved ? JSON.parse(saved) : [];
          if (!list.includes(cleanPat)) {
            list.push(cleanPat);
            localStorage.setItem('taller_turnos_atendidos_v1', JSON.stringify(list));
          }
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel('lacasadeladireccion_realtime');
              bc.postMessage({ type: 'TURNO_ATENDIDO', patente: cleanPat });
              bc.close();
            } catch {}
          }
        }
      } catch (e) {}

      // 2. Quitar el turno de turnos programados pendientes en el AdminDashboard inmediatamente
      if (onTurnoAtendido) {
        onTurnoAtendido(p.patente);
      }

      // 3. Registrar automáticamente en la hoja Detalles_Turnos y pasar turno a Atendido en Google Sheets
      try {
        const pConFechaNormalizada = { ...p, fecha: fechaPresupuesto };
        gasApi.facturarPresupuestoYArchivar(pConFechaNormalizada).catch((err) => console.warn(err));
        gasApi.marcarTurnoAtendido(p.patente).catch((err) => console.warn(err));
      } catch (err) {}

      // 4. Actualizar radar de rotación histórica de repuestos, cargar repuestos en Módulo 1 y descontar del inventario físico
      try {
        if (Array.isArray(p.items) && p.items.length > 0) {
          gasApi.actualizarRotacionYDescontarStock(p.items, p.vehiculoModelo || '', fechaPresupuesto, {
            patente: p.patente,
            clienteNombre: p.clienteNombre,
            presupuestoNumero: p.numero || p.id,
          });
        }
      } catch (err) {}

      onShowToast(
        'success',
        '¡Presupuesto Facturado y Servicio Archivado!',
        `Vehículo ${p.patente} (${p.vehiculoModelo || 'Taller'}) archivado en historial clínico y se ingresaron $${p.total.toLocaleString('es-AR')} a Caja.`
      );
    } else if (nuevoEstado === 'trabajo_terminado') {
      onShowToast(
        'success',
        '¡Vehículo Listo para Retirar!',
        `El testigo en vivo del cliente ahora marca su auto como TERMINADO. Podés tocar "Avisar Retiro" para escribirle por WhatsApp.`
      );
    } else if (nuevoEstado === 'en_reparacion') {
      onShowToast(
        'info',
        'Auto en Reparación',
        `El cliente ahora ve en vivo que su auto está siendo reparado en fosa/elevador.`
      );
    } else if (nuevoEstado === 'ingreso_taller') {
      onShowToast(
        'info',
        'Auto Ingresó al Taller',
        `El cliente ahora ve en vivo que su vehículo ya está en las instalaciones del taller.`
      );
    } else {
      onShowToast('info', 'Estado actualizado', `${p.numero} marcado como ${nuevoEstado.toUpperCase()}.`);
    }

    // Persistir el cambio de estado en Google Sheets
    try {
      await gasApi.updatePresupuestoEstado(id, nuevoEstado);
    } catch (e) {
      console.warn('Error al actualizar estado en Sheets:', e);
    }
  };

  const notificarAutoListoWhatsApp = (pres: Presupuesto) => {
    const telLimpio = (pres.clienteTelefono || '').replace(/[^0-9]/g, '');
    const mensaje = `Hola ${pres.clienteNombre}! 👋 Te avisamos de *La Casa de la Dirección* que tu vehículo (*${pres.patente}* - ${pres.vehiculoModelo || ''}) ya tiene el trabajo terminado y está *LISTO PARA RETIRAR* en el taller. 🚗✨\n\n📍 Te esperamos en Av. San Juan e Independencia, General Alvear.\n⏰ Horarios: Lun a Vie 08:00 a 12:30 y 15:30 a 20:00 / Sáb 08:00 a 13:00.`;
    const url = telLimpio
      ? `https://wa.me/549${telLimpio}?text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  // Delete & sync
  const eliminarPresupuesto = async (id: string) => {
    const p = presupuestos.find((x) => x.id === id);
    if (!confirm(`¿Estás seguro de eliminar el presupuesto ${p?.numero || ''} (${p?.patente})?`)) return;
    setPresupuestos((prev) => prev.filter((item) => item.id !== id));
    onShowToast('info', 'Presupuesto eliminado', 'Eliminando presupuesto y descontando de contabilidad...');

    try {
      await gasApi.deletePresupuesto(id);
      onContabilidadUpdated?.();
    } catch (e) {
      console.warn('Error al borrar en Sheets:', e);
    }
  };

  // Botón directo Cobrar / Pasar a Caja
  const facturarYPasarACaja = (p: Presupuesto) => {
    cambiarEstado(p.id, 'facturado');
  };

  // Botón directo Enviar a Cuenta Corriente (Queda debiendo con opción de entrega previa)
  const enviarACuentaCorriente = (p: Presupuesto) => {
    setPresupuestoParaCtaCte(p);
    setMontoEntregaCtaCte('0');
    setMetodoPagoEntregaCtaCte('Efectivo');
  };

  const confirmarPaseACuentaCorriente = () => {
    if (!presupuestoParaCtaCte) return;
    const entrega = Math.max(0, parseFloat(montoEntregaCtaCte) || 0);
    const total = Number(presupuestoParaCtaCte.total) || 0;
    const entregaFinal = Math.min(entrega, total);
    cambiarEstado(presupuestoParaCtaCte.id, 'a_cuenta_corriente', {
      entrega: entregaFinal,
      metodoPago: metodoPagoEntregaCtaCte,
    });
    setPresupuestoParaCtaCte(null);
  };

  // Generate WhatsApp message and open
  const compartirPorWhatsApp = (p: Presupuesto) => {
    const cleanPhone = p.clienteTelefono.replace(/\D/g, '');
    const fechaEmision = formatearFechaArgentina(p.fecha);
    const fechaVence = calcularFechaVencimiento(p.fecha, p.validezDias);

    let texto = `🚗 *PRESUPUESTO - LA CASA DE LA DIRECCIÓN*\n`;
    texto += `📄 *Presupuesto N°:* ${p.numero}\n`;
    texto += `📅 *Fecha de Emisión:* ${fechaEmision}\n`;
    texto += `🚘 *Vehículo:* ${p.vehiculoModelo ? `${p.vehiculoModelo} ` : ''}(Patente: ${p.patente})\n`;
    if (p.clienteNombre && p.clienteNombre !== 'Cliente Mostrador') {
      texto += `👤 *Cliente:* ${p.clienteNombre}\n`;
    }
    texto += `\n🔧 *DETALLE DE TRABAJOS Y REPUESTOS:*\n`;

    p.items.forEach((it) => {
      const tipoIcon = it.tipo === 'mano_de_obra' ? '🛠️' : '🔩';
      texto += `${tipoIcon} ${it.cantidad > 1 ? `${it.cantidad}x ` : ''}${it.descripcion}: $${Number(it.subtotal).toLocaleString('es-AR')}\n`;
    });

    if (p.descuentoPorcentaje && p.descuentoPorcentaje > 0) {
      texto += `\n🏷️ *Descuento aplicado:* ${p.descuentoPorcentaje}%\n`;
    }

    texto += `\n💰 *TOTAL ESTIMADO: $${p.total.toLocaleString('es-AR')} ARS*\n`;
    texto += `\n⏰ _Validez del presupuesto: hasta el ${fechaVence} (${p.validezDias} días)._\n`;
    if (p.observaciones) {
      texto += `ℹ️ _${p.observaciones}_\n`;
    }
    texto += `\n📍 *La Casa de la Dirección*\nAv. San Juan e Independencia, General Alvear, Mendoza.\n📞 WhatsApp: 2625 532070`;

    const encoded = encodeURIComponent(texto);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(url, '_blank');
  };

  // REQUERIMIENTO 3: SECCIÓN IMPRIMIR Y GUARDAR EN PDF CON DISEÑO ELEGANTE Y PRECIO DESTACADO
  const ejecutarImpresion = (p: Presupuesto) => {
    const fechaEmision = formatearFechaArgentina(p.fecha);
    const fechaVence = calcularFechaVencimiento(p.fecha, p.validezDias);
    const subtotalMO = p.items
      .filter((i) => i.tipo === 'mano_de_obra')
      .reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);
    const subtotalRep = p.items
      .filter((i) => i.tipo === 'repuesto')
      .reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0);

    const filasHtml = p.items
      .map(
        (it, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfc'};">
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${
            it.tipo === 'mano_de_obra' ? '#b91c1c' : '#d97706'
          }; text-transform: uppercase; font-size: 11px;">
            ${it.tipo === 'mano_de_obra' ? '🛠️ Mano de Obra' : '🔩 Repuesto'}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-weight: 600; color: #111827; font-size: 13px;">
            ${it.descripcion}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-family: monospace; font-size: 13px;">
            ${it.cantidad}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace; font-size: 13px; color: #374151;">
            $${Number(it.precioUnitario).toLocaleString('es-AR')}
          </td>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-family: monospace; font-weight: bold; font-size: 13px; color: #111827;">
            $${Number(it.subtotal).toLocaleString('es-AR')}
          </td>
        </tr>
      `
      )
      .join('');

    try {
      const printWindow = window.open('', '_blank', 'width=900,height=1000');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Presupuesto ${p.numero} - La Casa de la Dirección</title>
              <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                  color: #111827;
                  background-color: #ffffff;
                  padding: 30px;
                  line-height: 1.5;
                }
                .btn-imprimir {
                  background: #dc2626;
                  color: #ffffff;
                  padding: 12px 28px;
                  border: none;
                  border-radius: 8px;
                  font-weight: 800;
                  font-size: 14px;
                  text-transform: uppercase;
                  letter-spacing: 0.5px;
                  cursor: pointer;
                  box-shadow: 0 4px 12px rgba(220, 38, 38, 0.35);
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                }
                .btn-imprimir:hover { background: #b91c1c; }
                .plate-badge {
                  display: inline-block;
                  background: #000000;
                  color: #ffffff;
                  padding: 4px 12px;
                  border-radius: 6px;
                  font-family: monospace;
                  font-weight: 900;
                  letter-spacing: 2px;
                  border: 2px solid #374151;
                  font-size: 15px;
                }
                .total-card {
                  background: #fef2f2;
                  border: 2px solid #dc2626;
                  border-radius: 12px;
                  padding: 18px 24px;
                  text-align: right;
                  margin-top: 15px;
                }
                .total-amount {
                  font-size: 34px;
                  font-weight: 900;
                  color: #991b1b;
                  font-family: monospace;
                  line-height: 1.1;
                }
                @media print {
                  .no-print { display: none !important; }
                  body { padding: 10px !important; }
                  @page { margin: 12mm; size: A4; }
                }
              </style>
            </head>
            <body>
              <div class="no-print" style="text-align: center; margin-bottom: 30px; padding: 15px; background: #f3f4f6; border-radius: 10px;">
                <button class="btn-imprimir" onclick="window.print()">🖨️ Mandar a Imprimir / Guardar en PDF</button>
                <p style="font-size: 12px; color: #4b5563; margin-top: 8px;">
                  Consejo: en la ventana de impresión podés elegir <strong>"Guardar como PDF"</strong> como destino.
                </p>
              </div>

              <!-- Cabecera Oficial Taller -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #dc2626; padding-bottom: 18px; margin-bottom: 24px;">
                <div>
                  <h1 style="font-size: 26px; font-weight: 900; text-transform: uppercase; color: #000; letter-spacing: -0.5px;">
                    LA CASA DE LA DIRECCIÓN
                  </h1>
                  <p style="font-size: 12px; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                    Alineación · Balanceo · Tren Delantero · Dirección · Frenos
                  </p>
                  <p style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    📍 Av. San Juan e Independencia, General Alvear, Mendoza
                  </p>
                  <p style="font-size: 12px; color: #6b7280;">
                    📞 WhatsApp Taller: <strong>2625 532070</strong>
                  </p>
                </div>
                <div style="text-align: right;">
                  <div style="background: #fee2e2; color: #b91c1c; font-weight: 900; font-size: 12px; padding: 4px 10px; border-radius: 6px; display: inline-block; text-transform: uppercase; border: 1px solid #fca5a5; margin-bottom: 6px;">
                    PRESUPUESTO OFICIAL
                  </div>
                  <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #dc2626;">
                    ${p.numero}
                  </div>
                  <div style="font-size: 12px; color: #374151; margin-top: 4px;">
                    Fecha de Emisión: <strong style="color: #000;">${fechaEmision}</strong>
                  </div>
                  <div style="font-size: 12px; color: #b91c1c; font-weight: 600;">
                    Válido hasta: <strong>${fechaVence} (${p.validezDias} días)</strong>
                  </div>
                </div>
              </div>

              <!-- Bloque Datos de Cliente y Vehículo -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
                <div>
                  <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #6b7280; display: block; margin-bottom: 4px;">
                    Datos del Cliente
                  </span>
                  <div style="font-size: 16px; font-weight: 800; color: #111827;">${p.clienteNombre}</div>
                  <div style="font-size: 12px; color: #4b5563; margin-top: 3px;">
                    📞 Teléfono: <strong>${p.clienteTelefono || 'No informado'}</strong>
                  </div>
                  ${
                    p.clienteEmail
                      ? `<div style="font-size: 12px; color: #4b5563;">✉️ Email: ${p.clienteEmail}</div>`
                      : ''
                  }
                </div>

                <div>
                  <span style="font-size: 10px; text-transform: uppercase; font-weight: 800; color: #6b7280; display: block; margin-bottom: 4px;">
                    Vehículo en Taller
                  </span>
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                    <span class="plate-badge">${p.patente}</span>
                    <span style="font-size: 15px; font-weight: 700; color: #1f2937;">${p.vehiculoModelo || 'No especificado'}</span>
                  </div>
                  ${
                    p.kilometraje
                      ? `<div style="font-size: 12px; color: #4b5563;">⏱️ Kilometraje actual: <strong>${p.kilometraje}</strong></div>`
                      : ''
                  }
                </div>
              </div>

              <!-- Tabla de Trabajos y Repuestos -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #111827; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th style="padding: 10px 12px; text-align: left; border-top-left-radius: 6px;">Tipo</th>
                    <th style="padding: 10px 12px; text-align: left;">Detalle del Trabajo o Repuesto</th>
                    <th style="padding: 10px 12px; text-align: center; width: 60px;">Cant.</th>
                    <th style="padding: 10px 12px; text-align: right; width: 110px;">Unitario</th>
                    <th style="padding: 10px 12px; text-align: right; width: 120px; border-top-right-radius: 6px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasHtml}
                </tbody>
              </table>

              <!-- Totales y Resumen Financiero -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; margin-top: 15px;">
                <div style="flex: 1; max-width: 420px;">
                  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 12px;">
                    <strong style="display: block; color: #111827; margin-bottom: 4px; text-transform: uppercase; font-size: 11px;">
                      Observaciones y Condiciones:
                    </strong>
                    <p style="color: #4b5563; font-size: 11px; line-height: 1.4;">
                      ${p.observaciones || 'Presupuesto válido por 7 días. Precios en efectivo o transferencia.'}
                    </p>
                    <div style="margin-top: 8px; color: #059669; font-weight: 700; font-size: 11px;">
                      🛡️ Mano de obra de alineación y tren delantero con garantía de taller.
                    </div>
                  </div>
                </div>

                <div style="min-width: 280px;">
                  <div style="font-size: 12px; color: #4b5563; space-y: 4px;">
                    <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                      <span>Mano de Obra:</span>
                      <strong style="font-family: monospace;">$${subtotalMO.toLocaleString('es-AR')}</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 3px 0;">
                      <span>Repuestos / Materiales:</span>
                      <strong style="font-family: monospace;">$${subtotalRep.toLocaleString('es-AR')}</strong>
                    </div>
                    ${
                      p.descuentoPorcentaje && p.descuentoPorcentaje > 0
                        ? `
                      <div style="display: flex; justify-content: space-between; padding: 3px 0; color: #dc2626; font-weight: bold;">
                        <span>Descuento (${p.descuentoPorcentaje}%):</span>
                        <span style="font-family: monospace;">-$${(
                          (p.total / (1 - p.descuentoPorcentaje / 100)) *
                          (p.descuentoPorcentaje / 100)
                        ).toFixed(0)}</span>
                      </div>
                    `
                        : ''
                    }
                  </div>

                  <!-- RECUADRO DE TOTAL FINAL GRANDE Y DESTACADO -->
                  <div class="total-card">
                    <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; display: block;">
                      TOTAL FINAL PRESUPUESTO
                    </span>
                    <div class="total-amount">
                      $${p.total.toLocaleString('es-AR')} ARS
                    </div>
                  </div>
                </div>
              </div>

              <!-- Firmas Oficiales -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; padding-top: 15px;">
                <div style="text-align: center; border-top: 1px solid #9ca3af; padding-top: 8px; font-size: 12px; color: #4b5563;">
                  <strong>Firma y Sello del Taller</strong><br>
                  La Casa de la Dirección
                </div>
                <div style="text-align: center; border-top: 1px solid #9ca3af; padding-top: 8px; font-size: 12px; color: #4b5563;">
                  <strong>Conformidad del Cliente</strong><br>
                  Firma de aceptación
                </div>
              </div>

              <script>
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 350);
              <\/script>
            </body>
          </html>
        `);
        printWindow.document.close();
        return;
      }
    } catch (e) {
      console.warn('Popup blocked, attempting fallback print:', e);
    }

    // Fallback directo
    try {
      window.print();
    } catch (e) {
      onShowToast('info', 'Presupuesto listo para imprimir', 'Presioná Ctrl+P para guardar como PDF.');
    }
  };

  // Copy plain text budget to clipboard
  const copiarTextoPresupuesto = (p: Presupuesto) => {
    const fechaEmision = formatearFechaArgentina(p.fecha);
    const fechaVence = calcularFechaVencimiento(p.fecha, p.validezDias);

    let t = `PRESUPUESTO - LA CASA DE LA DIRECCIÓN\n`;
    t += `N°: ${p.numero} | Fecha: ${fechaEmision} | Validez: hasta ${fechaVence} (${p.validezDias} días)\n`;
    t += `Cliente: ${p.clienteNombre} (${p.clienteTelefono || 'Sin teléfono'})\n`;
    t += `Vehículo: ${p.vehiculoModelo || 'No especificado'} - Patente: ${p.patente} ${p.kilometraje ? `(Km: ${p.kilometraje})` : ''}\n\n`;
    t += `DETALLE DE ÍTEMS:\n`;
    p.items.forEach((it) => {
      t += `- [${it.tipo === 'mano_de_obra' ? 'Mano de Obra' : 'Repuesto'}] ${it.cantidad}x ${it.descripcion}: $${it.subtotal.toLocaleString('es-AR')}\n`;
    });
    if (p.descuentoPorcentaje) {
      t += `Descuento: ${p.descuentoPorcentaje}%\n`;
    }
    t += `\nTOTAL ESTIMADO: $${p.total.toLocaleString('es-AR')} ARS\n`;
    if (p.observaciones) {
      t += `Observaciones: ${p.observaciones}\n`;
    }

    navigator.clipboard.writeText(t);
    setCopiedText(true);
    onShowToast('success', '¡Copiado!', 'El detalle del presupuesto fue copiado al portapapeles.');
    setTimeout(() => setCopiedText(false), 3000);
  };

  // REQUERIMIENTO 1: BUSCADOR POTENTE DE PRESUPUESTOS (Busca por Patente, Cliente, N° de Presupuesto, Vehículo, Teléfono o Repuestos)
  const filteredPresupuestos = useMemo(() => {
    return presupuestos.filter((p) => {
      if (filtroEstado !== 'todos' && p.estado !== filtroEstado) return false;
      if (!searchTerm.trim()) return true;

      const q = searchTerm.toLowerCase().trim();
      const matchPatente = (p.patente || '').toLowerCase().includes(q);
      const matchCliente = (p.clienteNombre || '').toLowerCase().includes(q);
      const matchNum = (p.numero || '').toLowerCase().includes(q);
      const matchModelo = (p.vehiculoModelo || '').toLowerCase().includes(q);
      const matchTelefono = (p.clienteTelefono || '').toLowerCase().includes(q);
      const matchEmail = (p.clienteEmail || '').toLowerCase().includes(q);
      const matchItems = (p.items || []).some((it) => (it.descripcion || '').toLowerCase().includes(q));

      return matchPatente || matchCliente || matchNum || matchModelo || matchTelefono || matchEmail || matchItems;
    });
  }, [presupuestos, filtroEstado, searchTerm]);

  // Totals metrics
  const stats = useMemo(() => {
    const totalMonto = presupuestos.reduce((acc, p) => acc + (p.total || 0), 0);
    const pendientes = presupuestos.filter((p) => p.estado === 'pendiente').length;
    const aprobados = presupuestos.filter((p) => p.estado === 'aprobado').length;
    const facturados = presupuestos.filter((p) => p.estado === 'facturado').length;
    return { totalMonto, pendientes, aprobados, facturados };
  }, [presupuestos]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-red-600 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Total Presupuestado</span>
            <DollarSign className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-white">
            ${stats.totalMonto.toLocaleString('es-AR')}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">{presupuestos.length} cotizaciones generadas</p>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-amber-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Pendientes / Enviados</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-amber-400">
            {stats.pendientes}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">A la espera de respuesta del cliente</p>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-blue-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Aprobados</span>
            <CheckCircle2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-blue-400">
            {stats.aprobados}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Confirmados para entrar a taller</p>
        </div>

        <div className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-t-4 border-t-emerald-500 shadow-xl">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-heading font-bold uppercase tracking-wider">
            <span>Facturados / En Caja</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-mono font-black text-emerald-400">
            {stats.facturados}
          </div>
          <p className="text-[11px] text-neutral-400 mt-1">Cobrados e ingresados a contabilidad</p>
        </div>
      </div>

      {/* Action Header & REQUERIMIENTO 1: BUSCADOR DESTACADO */}
      <div className="p-5 sm:p-6 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-500" />
              <span>Cotizaciones y Presupuestos (Sincronizado con Google Sheets)</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              Buscá cualquier presupuesto guardado por <strong>patente, cliente, N° o repuesto</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => iniciarNuevoPresupuesto()}
              className="flex items-center gap-2 px-5 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Nuevo Presupuesto</span>
            </button>
          </div>
        </div>

        {/* BARRA BUSCADORA PROMINENTE */}
        <div className="relative">
          <Search className="w-4 h-4 text-red-500 absolute left-3.5 top-3" />
          <input
            id={searchInputId}
            type="text"
            placeholder="🔍 Buscar presupuesto por Patente (ej: PEU534), Cliente (ej: Carlos), N° (ej: P-1001), Vehículo o Repuesto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-700 focus:border-red-600 text-xs sm:text-sm text-white rounded-xl pl-10 pr-10 py-2.5 focus:outline-none placeholder-neutral-500 shadow-inner"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2.5 text-neutral-400 hover:text-white p-1 rounded transition-colors"
              title="Limpiar búsqueda"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter bar by status */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-800/80">
          <div className="flex flex-wrap items-center gap-1.5">
            {([
              { id: 'todos', label: 'Todos', activeClass: 'bg-red-600 text-white shadow-md shadow-red-950' },
              { id: 'pendiente', label: 'Pendiente', dotColor: 'bg-amber-400', activeClass: 'bg-amber-600 text-white shadow-md shadow-amber-950' },
              { id: 'aprobado', label: 'Aprobado', dotColor: 'bg-blue-400', activeClass: 'bg-blue-600 text-white shadow-md shadow-blue-950' },
              { id: 'ingreso_taller', label: 'En Taller', dotColor: 'bg-purple-400', activeClass: 'bg-purple-600 text-white shadow-md shadow-purple-950' },
              { id: 'en_reparacion', label: 'En Reparación', dotColor: 'bg-orange-400', activeClass: 'bg-orange-600 text-white shadow-md shadow-orange-950' },
              { id: 'trabajo_terminado', label: 'Terminado', dotColor: 'bg-emerald-400', activeClass: 'bg-emerald-600 text-white shadow-md shadow-emerald-950' },
              { id: 'facturado', label: 'Facturado', dotColor: 'bg-zinc-300', activeClass: 'bg-zinc-200 text-zinc-950 font-black shadow-md' },
              { id: 'rechazado', label: 'Rechazado', dotColor: 'bg-neutral-500', activeClass: 'bg-neutral-700 text-white shadow-md' },
            ] as const).map((est) => {
              const count =
                est.id === 'todos'
                  ? presupuestos.length
                  : presupuestos.filter((p) => p.estado === est.id).length;

              const isSelected = filtroEstado === est.id;

              return (
                <button
                  type="button"
                  key={est.id}
                  onClick={() => setFiltroEstado(est.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold uppercase transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? est.activeClass
                      : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {'dotColor' in est && est.dotColor && (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-white' : est.dotColor}`} />
                  )}
                  <span>{est.label}</span>
                  <span
                    className={`font-mono text-[10px] px-1 py-0.2 rounded ${
                      isSelected ? 'bg-black/30' : 'bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-xs text-neutral-400 font-mono">
            {searchTerm ? (
              <span>
                Resultados encontrados: <strong className="text-white">{filteredPresupuestos.length}</strong> de {presupuestos.length}
              </span>
            ) : (
              <span>Total presupuestos: <strong className="text-white">{presupuestos.length}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Presupuestos Cards List */}
      {filteredPresupuestos.length === 0 ? (
        <div className="p-12 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center space-y-3">
          <FileText className="w-10 h-10 text-neutral-600 mx-auto" />
          <h4 className="font-heading font-bold text-white text-base uppercase">
            No se encontraron presupuestos
          </h4>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            {searchTerm
              ? `No hay presupuestos que coincidan con "${searchTerm}". Probá buscando por patente, apellido o número.`
              : 'Todavía no generaste cotizaciones con este filtro.'}
          </p>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-heading font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              <span>Borrar búsqueda</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPresupuestos.map((p) => {
            const estadoColors = {
              pendiente: 'bg-amber-950/60 border-amber-800/80 text-amber-400',
              aprobado: 'bg-blue-950/60 border-blue-800/80 text-blue-400',
              ingreso_taller: 'bg-purple-950/80 border-purple-600 text-purple-300 font-bold',
              en_reparacion: 'bg-orange-950/80 border-orange-600 text-orange-300 font-bold',
              trabajo_terminado: 'bg-emerald-950 border-emerald-500 text-emerald-300 font-black animate-pulse shadow-md shadow-emerald-900/40',
              facturado: 'bg-neutral-900 border-emerald-800/60 text-emerald-400',
              a_cuenta_corriente: 'bg-amber-950/90 border-amber-500 text-amber-300 font-bold',
              rechazado: 'bg-red-950/60 border-red-800/80 text-red-400',
            }[p.estado] || 'bg-neutral-900 border-neutral-700 text-neutral-300';

            const fechaFormat = formatearFechaArgentina(p.fecha);

            return (
              <div
                key={p.id}
                className="p-5 rounded-xl bg-[#0a0a0a] border border-neutral-800 hover:border-neutral-700 transition-all shadow-xl flex flex-col justify-between space-y-4"
              >
                {/* Top header */}
                <div className="flex items-start justify-between gap-2 border-b border-neutral-900 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-red-500 bg-red-950/50 border border-red-900/50 px-2 py-0.5 rounded">
                        {p.numero}
                      </span>
                      <span className="font-mono text-base font-black text-white uppercase tracking-wider">
                        {p.patente}
                      </span>
                      {p.vehiculoModelo && (
                        <span className="text-xs text-neutral-400 font-medium truncate max-w-[150px]">
                          · {p.vehiculoModelo}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
                      <span>👤 {p.clienteNombre}</span>
                      {p.clienteTelefono && <span>📞 {p.clienteTelefono}</span>}
                    </div>
                  </div>

                  {/* Estado Dropdown & Botón de Notificación */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <select
                      value={p.estado}
                      onChange={(e) => {
                        const val = e.target.value as Presupuesto['estado'];
                        if (val === 'a_cuenta_corriente') {
                          enviarACuentaCorriente(p);
                        } else {
                          cambiarEstado(p.id, val);
                        }
                      }}
                      className={`text-[10px] font-heading font-black uppercase tracking-wider px-2.5 py-1.5 rounded border cursor-pointer ${estadoColors}`}
                      title="Cambiar estado del auto y presupuesto. Actualiza el testigo en vivo del cliente al instante."
                    >
                      <option value="pendiente">🟡 Presupuesto Pendiente</option>
                      <option value="aprobado">🔵 Presupuesto Aprobado</option>
                      <option value="ingreso_taller">🟣 Auto en Taller (Ingresó)</option>
                      <option value="en_reparacion">🟠 Auto en Reparación</option>
                      <option value="trabajo_terminado">🟢 Trabajo Terminado (Listo para Retirar)</option>
                      <option value="facturado">🏁 Facturado / Pagado (Pasa a Caja)</option>
                      <option value="a_cuenta_corriente">💳 A Cuenta Corriente (Queda Debiendo)</option>
                      <option value="rechazado">⚪ Rechazado / Cancelado</option>
                    </select>

                    {p.estado === 'trabajo_terminado' && (
                      <button
                        type="button"
                        onClick={() => notificarAutoListoWhatsApp(p)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-heading font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-emerald-950 animate-bounce"
                        title="Avisarle al cliente por WhatsApp que su auto ya está listo para retirar"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Avisar Retiro</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Items breakdown list */}
                <div className="space-y-1.5 text-xs">
                  <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                    Trabajos y Repuestos ({p.items.length}):
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                    {p.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-neutral-300">
                        <span className="truncate pr-2 text-[11px]">
                          {it.tipo === 'mano_de_obra' ? '🛠️' : '🔩'} {it.cantidad > 1 ? `${it.cantidad}x ` : ''}
                          {it.descripcion}
                        </span>
                        <span className="font-mono text-[11px] text-neutral-400 shrink-0">
                          ${it.subtotal.toLocaleString('es-AR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer with Total and Actions */}
                <div className="pt-3 border-t border-neutral-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-neutral-400">
                      <span>Fecha: <strong className="text-white">{fechaFormat}</strong></span>
                      <span className="ml-2 font-mono text-neutral-500">Validez: {p.validezDias}d</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 uppercase block">Total Presupuestado</span>
                      <span className="font-mono text-lg font-black text-emerald-400">
                        ${p.total.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => compartirPorWhatsApp(p)}
                      title="Compartir presupuesto por WhatsApp"
                      className="py-2 px-2.5 rounded bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/80 text-emerald-300 text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPresupuestoParaImprimir(p);
                        setTimeout(() => ejecutarImpresion(p), 150);
                      }}
                      title="Imprimir / Guardar en PDF con formato profesional"
                      className="py-2 px-2.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-red-500" />
                      <span className="hidden sm:inline">Imprimir / PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => editarPresupuesto(p)}
                      title="Modificar ítems o precios"
                      className="py-2 px-2.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    {p.estado === 'facturado' ? (
                      <button
                        type="button"
                        onClick={() => eliminarPresupuesto(p.id)}
                        title="Eliminar de la lista y de Sheets"
                        className="py-2 px-2.5 rounded bg-neutral-950 hover:bg-red-950/50 text-neutral-500 hover:text-red-400 border border-neutral-800 text-xs flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : p.estado === 'a_cuenta_corriente' ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => facturarYPasarACaja(p)}
                          title="Cobrar en Caja de Taller (Impacta en Contabilidad)"
                          className="py-2 px-2.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-heading font-black flex items-center justify-center gap-1 transition-colors shadow-md shadow-emerald-950 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Cobrar Deuda</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminarPresupuesto(p.id)}
                          title="Eliminar de la lista"
                          className="py-2 px-2 rounded bg-neutral-950 hover:bg-red-950/50 text-neutral-500 hover:text-red-400 border border-neutral-800 text-xs flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => facturarYPasarACaja(p)}
                          title="Facturar e ingresar a Caja de Taller (Contabilidad)"
                          className="py-2 px-2.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-heading font-black flex items-center justify-center gap-1 transition-colors shadow-md shadow-red-950 cursor-pointer"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Cobrar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => enviarACuentaCorriente(p)}
                          title="Cargar a Cuenta Corriente (El cliente se lleva el auto y queda debiendo)"
                          className="py-2 px-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-xs font-heading font-bold flex items-center justify-center gap-1 transition-colors shadow-md shadow-amber-950 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">A Cta. Cte.</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREAR / EDITAR PRESUPUESTO */}
      {/* ========================================================================= */}
      {showModalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden">
            {/* Header fijo */}
            <div className="relative p-5 sm:p-6 pb-4 border-b border-neutral-800 bg-[#0a0a0a] shrink-0">
              <button
                type="button"
                onClick={() => setShowModalForm(false)}
                className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
                aria-label="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-red-500 mb-1">
                <FileText className="w-5 h-5" />
                <span className="font-heading font-black text-xs uppercase tracking-widest">
                  Cotizador Oficial de Taller · Guardado en Google Sheets
                </span>
              </div>

              <h2 className="font-heading font-black text-xl text-white uppercase tracking-tight">
                {presupuestoEnEdicion ? `Editar Presupuesto ${presupuestoEnEdicion.numero}` : 'Nuevo Presupuesto'}
              </h2>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={guardarPresupuesto} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1 overscroll-contain">
                {/* 1. VINCULAR CON UN TURNO AGENDADO: AUTOCOMPLETA PATENTE, NOMBRE, TELÉFONO Y EMAIL */}
                {turnosPendientes.length > 0 && !presupuestoEnEdicion && (
                  <div className="p-3.5 rounded-lg bg-red-950/30 border border-red-800/60 space-y-1">
                    <label className="block text-xs font-heading font-bold uppercase text-red-400">
                      💡 Opción rápida: Vincular con un Turno Agendado
                    </label>
                    <p className="text-[11px] text-neutral-400 pb-1">
                      Al elegir un turno, se autocompleta abajo la <strong>patente, nombre del cliente, teléfono/WhatsApp y correo</strong>:
                    </p>
                    <select
                      value={patente}
                      onChange={(e) => handleTurnoSelect(e.target.value)}
                      className="w-full bg-[#111] border border-neutral-700 text-xs text-white rounded-lg px-3 py-2 font-mono font-bold"
                    >
                      <option value="">-- Seleccionar un turno agendado de la lista --</option>
                      {turnosPendientes.map((tp, idx) => (
                        <option key={idx} value={tp.patente}>
                          {tp.patente} — {tp.nombre ? `${tp.nombre} · ` : ''}{formatearFechaArgentina(tp.fecha)} {formatearHorario(tp.horario)} hs ({tp.telefono || tp.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 2. DATOS DEL VEHÍCULO Y CLIENTE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-heading font-black uppercase tracking-wider text-neutral-300 border-b border-neutral-800 pb-1">
                    1. Vehículo y Cliente
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Patente / Dominio *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: PEU534 o AE123MZ"
                        value={patente}
                        onChange={(e) => setPatente(e.target.value.toUpperCase())}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs font-mono font-bold text-white uppercase tracking-wider"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Fecha Presupuesto / Turno
                      </label>
                      <input
                        type="date"
                        required
                        value={fechaPresupuesto}
                        onChange={(e) => setFechaPresupuesto(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    {/* MARCA Y MODELO CON LISTA DESPLEGABLE COMPLETA DE TODOS LOS VEHÍCULOS DE ARGENTINA */}
                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Marca / Modelo del Vehículo (Menú Desplegable) *
                      </label>
                      <select
                        value={vehiculoModelo}
                        onChange={(e) => setVehiculoModelo(e.target.value)}
                        required
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-medium"
                      >
                        <option value="">-- Seleccionar Marca y Modelo de Argentina --</option>
                        {VEHICULOS_POR_MARCA.map((grupo) => (
                          <optgroup key={grupo.marca} label={`🚗 ${grupo.marca}`}>
                            {grupo.modelos.map((mod) => (
                              <option key={mod} value={mod}>
                                {mod}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    {/* KILOMETRAJE INGRESADO POR RODRIGO */}
                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Kilometraje (Lo ingresás vos)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: 145.000 km"
                        value={kilometraje}
                        onChange={(e) => setKilometraje(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Nombre del Cliente
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Carlos Gómez"
                        value={clienteNombre}
                        onChange={(e) => setClienteNombre(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Teléfono / WhatsApp (para enviar)
                      </label>
                      <input
                        type="tel"
                        placeholder="Ej: 2625 123456"
                        value={clienteTelefono}
                        onChange={(e) => setClienteTelefono(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                        Email del Cliente
                      </label>
                      <input
                        type="email"
                        placeholder="cliente@email.com"
                        value={clienteEmail}
                        onChange={(e) => setClienteEmail(e.target.value)}
                        className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. ÍTEMS DEL PRESUPUESTO */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-neutral-800 pb-1">
                    <h4 className="text-xs font-heading font-black uppercase tracking-wider text-neutral-300">
                      2. Trabajos y Repuestos Cotizados ({items.length})
                    </h4>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => agregarItem('mano_de_obra', 'ALINEACIÓN Y BALANCEO')}
                        className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-red-400 text-[11px] font-heading font-bold uppercase transition-colors"
                      >
                        + Mano de Obra
                      </button>
                      <button
                        type="button"
                        onClick={() => agregarItem('repuesto')}
                        className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-amber-400 text-[11px] font-heading font-bold uppercase transition-colors"
                      >
                        + Repuesto
                      </button>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="p-6 rounded-lg bg-neutral-950 border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
                      No agregaste ningún trabajo o repuesto aún. Tocá los botones de arriba para cotizar.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {items.map((it) => (
                        <div
                          key={it.id}
                          className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                        >
                          {/* Tipo */}
                          <select
                            value={it.tipo}
                            onChange={(e) => actualizarItem(it.id, 'tipo', e.target.value)}
                            className="bg-[#111] border border-neutral-800 text-[11px] text-white rounded px-2 py-1.5 shrink-0"
                          >
                            <option value="mano_de_obra">🛠️ Mano de Obra</option>
                            <option value="repuesto">🔩 Repuesto</option>
                          </select>

                          {/* Descripción / Trabajo o Repuesto Desplegable */}
                          <div className="flex-1 min-w-[210px]">
                            <select
                              value={it.descripcion}
                              onChange={(e) => {
                                const val = e.target.value;
                                actualizarItem(it.id, 'descripcion', val);
                                if ((TRABAJOS_TALLER_SERVICIOS as readonly string[]).includes(val)) {
                                  actualizarItem(it.id, 'tipo', 'mano_de_obra');
                                } else if ((REPUESTOS_TALLER_PIEZAS as readonly string[]).includes(val)) {
                                  actualizarItem(it.id, 'tipo', 'repuesto');
                                }
                              }}
                              required
                              className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none text-xs text-white rounded px-2.5 py-2 font-medium"
                            >
                              <option value="">-- Seleccionar Trabajo o Repuesto --</option>
                              <optgroup label="🛠️ Mano de Obra y Servicios de Taller">
                                {TRABAJOS_TALLER_SERVICIOS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="🔩 Repuestos y Piezas">
                                {REPUESTOS_TALLER_PIEZAS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

                          {/* Cantidad */}
                          <div className="w-20 shrink-0">
                            <input
                              type="number"
                              min={1}
                              required
                              title="Cantidad"
                              placeholder="Cant."
                              value={it.cantidad}
                              onChange={(e) => actualizarItem(it.id, 'cantidad', e.target.value)}
                              className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded px-2 py-1.5 font-mono text-center"
                            />
                          </div>

                          {/* Precio Unitario */}
                          <div className="w-28 shrink-0">
                            <input
                              type="number"
                              min={0}
                              required
                              placeholder="Precio ($)"
                              value={it.precioUnitario || ''}
                              onChange={(e) => actualizarItem(it.id, 'precioUnitario', e.target.value)}
                              className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded px-2 py-1.5 font-mono text-right"
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="w-28 text-right font-mono font-bold text-xs text-neutral-200 shrink-0 px-1">
                            ${it.subtotal.toLocaleString('es-AR')}
                          </div>

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => eliminarItem(it.id)}
                            className="p-1.5 text-neutral-500 hover:text-red-400 rounded hover:bg-neutral-900 transition-colors"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick suggestions picker */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold">Agregar rápido:</span>
                    {[
                      { t: 'mano_de_obra', n: 'ALINEACIÓN Y BALANCEO' },
                      { t: 'repuesto', n: 'RÓTULA DE SUSPENSIÓN' },
                      { t: 'repuesto', n: 'PRECAP / AXIAL DE DIRECCIÓN' },
                      { t: 'repuesto', n: 'EXTREMO DE DIRECCIÓN' },
                      { t: 'repuesto', n: 'AMORTIGUADOR DELANTERO' },
                      { t: 'repuesto', n: 'BIELETA DE BARRA ESTABILIZADORA' },
                      { t: 'repuesto', n: 'BUJE DE PARRILLA' },
                      { t: 'repuesto', n: 'JUEGO DE PASTILLAS DE FRENO' },
                    ].map((wi) => (
                      <button
                        type="button"
                        key={wi.n}
                        onClick={() => agregarItem(wi.t as any, wi.n)}
                        className="text-[10px] bg-neutral-950 hover:bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white px-2 py-0.5 rounded transition-colors cursor-pointer"
                      >
                        + {wi.n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. TOTALES Y CONDICIONES */}
                <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                          Validez del Presupuesto
                        </label>
                        <select
                          value={validezDias}
                          onChange={(e) => setValidezDias(Number(e.target.value))}
                          className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded px-3 py-1.5"
                        >
                          <option value={3}>3 días hábiles</option>
                          <option value={7}>7 días (Estándar recomendado)</option>
                          <option value={15}>15 días</option>
                          <option value={30}>30 días</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                          Descuento Especial (%)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="0"
                          value={descuentoPorcentaje || ''}
                          onChange={(e) => setDescuentoPorcentaje(Math.min(100, Math.max(0, Number(e.target.value))))}
                          className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded px-3 py-1.5 font-mono"
                        />
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="space-y-1.5 font-mono text-xs border-l border-neutral-900 pl-4 flex flex-col justify-center">
                      <div className="flex justify-between text-neutral-400">
                        <span>Mano de Obra:</span>
                        <span>${subtotalManoObra.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between text-neutral-400">
                        <span>Repuestos / Materiales:</span>
                        <span>${subtotalRepuestos.toLocaleString('es-AR')}</span>
                      </div>
                      {descuentoPorcentaje > 0 && (
                        <div className="flex justify-between text-red-400">
                          <span>Descuento ({descuentoPorcentaje}%):</span>
                          <span>-${montoDescuento.toLocaleString('es-AR')}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-black text-white pt-2 border-t border-neutral-800">
                        <span className="font-heading uppercase">TOTAL ESTIMADO:</span>
                        <span className="text-emerald-400">${totalNeto.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-heading font-bold uppercase text-neutral-400 mb-1">
                      Observaciones / Garantía para el Cliente
                    </label>
                    <textarea
                      rows={2}
                      value={observaciones}
                      onChange={(e) => setObservaciones(e.target.value)}
                      placeholder="Ej: Valores válidos por 7 días. Precios en efectivo..."
                      className="w-full bg-[#111] border border-neutral-800 text-xs text-white rounded p-2 focus:border-red-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:p-5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowModalForm(false)}
                  className="py-3 px-5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <div className="flex items-center gap-3">
                  <div className="font-mono text-right hidden sm:block">
                    <span className="text-[10px] text-neutral-500 uppercase block">Total</span>
                    <span className="text-base font-black text-emerald-400">
                      ${totalNeto.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <button
                    type="submit"
                    className="py-3 px-6 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                  >
                    <span>💾 Guardar en Google Sheets</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VISTA DE IMPRESIÓN Y PDF ELEGANTE */}
      {/* ========================================================================= */}
      {presupuestoParaImprimir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/95 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white text-black rounded-xl shadow-2xl flex flex-col max-h-[94vh] my-auto overflow-hidden">
            {/* Top Toolbar */}
            <div className="bg-neutral-950 text-white p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-red-500" />
                <span className="text-xs sm:text-sm font-heading font-black uppercase tracking-wider text-white">
                  Vista Previa de Impresión / Guardar PDF — {presupuestoParaImprimir.numero}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => ejecutarImpresion(presupuestoParaImprimir)}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-red-600/40"
                >
                  <Printer className="w-4 h-4" />
                  <span>🖨️ Imprimir / Guardar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => copiarTextoPresupuesto(presupuestoParaImprimir)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-heading font-bold text-xs uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'Copiado' : 'Copiar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPresupuestoParaImprimir(null)}
                  className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div
              id="printable-presupuesto-doc"
              className="p-6 sm:p-10 overflow-y-auto flex-1 font-sans text-neutral-900 space-y-6 bg-white"
            >
              {/* Workshop Letterhead */}
              <div className="flex items-start justify-between border-b-4 border-red-600 pb-5">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black font-heading tracking-tight text-neutral-950 uppercase">
                    LA CASA DE LA DIRECCIÓN
                  </h1>
                  <p className="text-xs sm:text-sm text-neutral-700 font-bold uppercase tracking-wider mt-0.5">
                    ALINEACIÓN Y BALANCEO COMPUTARIZADO · TREN DELANTERO · FRENOS Y DIRECCIÓN
                  </p>
                  <p className="text-xs text-neutral-600 mt-1">
                    📍 Av. San Juan e Independencia, General Alvear, Mendoza
                  </p>
                  <p className="text-xs text-neutral-600">
                    📞 WhatsApp Taller: <strong>2625 532070</strong>
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block bg-red-100 border border-red-300 text-red-700 px-3 py-1 rounded text-xs font-black uppercase tracking-wider mb-1">
                    PRESUPUESTO
                  </div>
                  <div className="text-2xl font-mono font-black text-red-600">
                    {presupuestoParaImprimir.numero}
                  </div>
                  <div className="text-xs text-neutral-700 mt-1">
                    Fecha de Emisión: <strong>{formatearFechaArgentina(presupuestoParaImprimir.fecha)}</strong>
                  </div>
                  <div className="text-xs text-red-700 font-semibold">
                    Válido hasta: <strong>{calcularFechaVencimiento(presupuestoParaImprimir.fecha, presupuestoParaImprimir.validezDias)} ({presupuestoParaImprimir.validezDias} días)</strong>
                  </div>
                </div>
              </div>

              {/* Client & Vehicle Info Box */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs">
                <div className="space-y-1">
                  <span className="text-neutral-500 block uppercase font-bold text-[10px] tracking-wider">
                    Datos del Cliente
                  </span>
                  <div className="font-black text-base text-neutral-950">
                    {presupuestoParaImprimir.clienteNombre}
                  </div>
                  <div className="text-neutral-700 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-neutral-500" />
                    <span>Tel: <strong>{presupuestoParaImprimir.clienteTelefono || 'No informado'}</strong></span>
                  </div>
                  {presupuestoParaImprimir.clienteEmail && (
                    <div className="text-neutral-600">
                      ✉️ {presupuestoParaImprimir.clienteEmail}
                    </div>
                  )}
                </div>

                <div className="space-y-1 sm:border-l sm:border-neutral-200 sm:pl-4">
                  <span className="text-neutral-500 block uppercase font-bold text-[10px] tracking-wider">
                    Datos del Vehículo
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block bg-neutral-950 text-white font-mono font-black text-sm px-2.5 py-0.5 rounded border border-neutral-700 uppercase tracking-widest">
                      {presupuestoParaImprimir.patente}
                    </span>
                    <span className="text-sm font-bold text-neutral-800">
                      {presupuestoParaImprimir.vehiculoModelo || 'No especificado'}
                    </span>
                  </div>
                  {presupuestoParaImprimir.kilometraje && (
                    <div className="text-neutral-600 font-mono text-[11px] pt-0.5">
                      ⏱️ Kilometraje: <strong>{presupuestoParaImprimir.kilometraje}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-neutral-950 text-white uppercase font-heading font-black text-[11px] tracking-wider">
                      <th className="py-2.5 px-3 rounded-l">Tipo</th>
                      <th className="py-2.5 px-3">Descripción del Trabajo o Repuesto</th>
                      <th className="py-2.5 px-3 text-center">Cant.</th>
                      <th className="py-2.5 px-3 text-right">Unitario</th>
                      <th className="py-2.5 px-3 text-right rounded-r">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {presupuestoParaImprimir.items.map((it, idx) => (
                      <tr key={it.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}>
                        <td className="py-3 px-3 text-[11px] font-bold uppercase">
                          {it.tipo === 'mano_de_obra' ? (
                            <span className="text-red-700">🛠️ M. Obra</span>
                          ) : (
                            <span className="text-amber-700">🔩 Repuesto</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-semibold text-neutral-950 text-xs">
                          {it.descripcion}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-xs">
                          {it.cantidad}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-neutral-700 text-xs">
                          ${it.precioUnitario.toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-neutral-950 text-xs">
                          ${it.subtotal.toLocaleString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total & Observations with Big Price Highlight */}
              <div className="border-t-2 border-neutral-300 pt-5 flex flex-col sm:flex-row items-stretch sm:items-start justify-between gap-6">
                <div className="text-xs text-neutral-600 max-w-md space-y-2">
                  <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <span className="font-black uppercase text-[10px] text-neutral-700 block mb-1">
                      Garantía y Condiciones del Taller:
                    </span>
                    <p className="leading-relaxed text-[11px] text-neutral-700">
                      {presupuestoParaImprimir.observaciones || 'Presupuesto sujeto a validez temporal. Precios en efectivo o transferencia.'}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-bold mt-1.5">
                      ✓ Todos los trabajos de alineación y tren delantero cuentan con garantía del taller.
                    </p>
                  </div>
                </div>

                <div className="text-right space-y-2 sm:min-w-[260px]">
                  <div className="text-xs space-y-1 font-mono text-neutral-600 pb-2 border-b border-neutral-200">
                    <div className="flex justify-between">
                      <span>Mano de Obra:</span>
                      <strong>${presupuestoParaImprimir.items.filter((i) => i.tipo === 'mano_de_obra').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0).toLocaleString('es-AR')}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Repuestos:</span>
                      <strong>${presupuestoParaImprimir.items.filter((i) => i.tipo === 'repuesto').reduce((acc, i) => acc + (Number(i.subtotal) || 0), 0).toLocaleString('es-AR')}</strong>
                    </div>
                    {presupuestoParaImprimir.descuentoPorcentaje && presupuestoParaImprimir.descuentoPorcentaje > 0 && (
                      <div className="flex justify-between text-red-600 font-bold">
                        <span>Descuento ({presupuestoParaImprimir.descuentoPorcentaje}%):</span>
                        <span>-
                          $
                          {(
                            (presupuestoParaImprimir.total / (1 - presupuestoParaImprimir.descuentoPorcentaje / 100)) *
                            (presupuestoParaImprimir.descuentoPorcentaje / 100)
                          ).toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* CAJA DEL PRECIO FINAL ENORME */}
                  <div className="p-4 rounded-xl bg-red-50 border-2 border-red-600 text-right">
                    <div className="text-[11px] uppercase text-neutral-600 font-heading font-black tracking-wider">
                      TOTAL FINAL PRESUPUESTO
                    </div>
                    <div className="text-3xl sm:text-4xl font-black font-mono text-red-700 tracking-tight leading-none mt-1">
                      ${presupuestoParaImprimir.total.toLocaleString('es-AR')}
                    </div>
                    <span className="text-[10px] text-neutral-500 font-sans block mt-1">
                      Pesos Argentinos (ARS)
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-10 pt-12 border-t border-neutral-200 text-center text-xs text-neutral-600">
                <div className="border-t border-neutral-400 pt-2">
                  <div className="font-bold text-neutral-900">La Casa de la Dirección</div>
                  <div className="text-[11px] text-neutral-500">Firma y Sello del Taller</div>
                </div>
                <div className="border-t border-neutral-400 pt-2">
                  <div className="font-bold text-neutral-900">{presupuestoParaImprimir.clienteNombre}</div>
                  <div className="text-[11px] text-neutral-500">Conformidad del Cliente</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PASAR A CUENTA CORRIENTE (CON OPCIÓN DE ENTREGA PARCIAL / SEÑA) */}
      {/* ========================================================================= */}
      {presupuestoParaCtaCte && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#0d0d0d] border border-amber-600/70 rounded-2xl shadow-2xl p-5 sm:p-6 my-auto">
            <button
              type="button"
              onClick={() => setPresupuestoParaCtaCte(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-950/80 border border-amber-600 flex items-center justify-center text-amber-400 shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase tracking-wide">
                  Pasar a Cuenta Corriente
                </h3>
                <p className="text-xs text-neutral-400">
                  Presupuesto <span className="text-amber-400 font-bold">{presupuestoParaCtaCte.numero}</span> · Patente <span className="text-white font-mono font-bold">{presupuestoParaCtaCte.patente}</span>
                </p>
              </div>
            </div>

            {/* Resumen del Total */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-neutral-400 uppercase tracking-wider font-heading">
                  Total del Trabajo / Presupuesto:
                </span>
                <span className="text-lg font-mono font-black text-white">
                  ${presupuestoParaCtaCte.total.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Cliente: <strong className="text-neutral-200">{presupuestoParaCtaCte.clienteNombre}</strong> {presupuestoParaCtaCte.vehiculoModelo ? `(${presupuestoParaCtaCte.vehiculoModelo})` : ''}
              </div>
            </div>

            {/* Input de Entrega Parcial */}
            <div className="space-y-4 mb-5">
              <div>
                <label className="block text-xs font-heading font-bold text-amber-400 uppercase tracking-wider mb-1.5">
                  ¿Entregó dinero al retirar el vehículo? (Entrega / Seña)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-mono font-bold text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={presupuestoParaCtaCte.total}
                    value={montoEntregaCtaCte}
                    onChange={(e) => setMontoEntregaCtaCte(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#161616] border border-amber-600/50 rounded-xl py-2.5 pl-8 pr-4 text-white text-base font-mono font-bold focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Si no entregó nada, dejá <strong>$0</strong>. Si pagó una parte (ej. $10.000), ingresala aquí.
                </p>
              </div>

              {/* Botones rápidos de cálculo */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setMontoEntregaCtaCte('0')}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  $0 (Debe todo)
                </button>
                <button
                  type="button"
                  onClick={() => setMontoEntregaCtaCte(String(Math.round(presupuestoParaCtaCte.total * 0.5)))}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  50% (${Math.round(presupuestoParaCtaCte.total * 0.5).toLocaleString('es-AR')})
                </button>
                <button
                  type="button"
                  onClick={() => setMontoEntregaCtaCte(String(Math.round(presupuestoParaCtaCte.total * 0.3)))}
                  className="px-2.5 py-1 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[11px] text-neutral-300 transition-colors cursor-pointer"
                >
                  30% (${Math.round(presupuestoParaCtaCte.total * 0.3).toLocaleString('es-AR')})
                </button>
              </div>

              {/* Si entregó algo, elegir método de pago de esa entrega */}
              {Number(montoEntregaCtaCte) > 0 && (
                <div className="animate-in fade-in duration-150">
                  <label className="block text-xs font-heading font-bold text-neutral-300 uppercase tracking-wider mb-1">
                    Método de Pago de la Entrega (Ingresa a Caja)
                  </label>
                  <select
                    value={metodoPagoEntregaCtaCte}
                    onChange={(e) => setMetodoPagoEntregaCtaCte(e.target.value)}
                    className="w-full bg-[#161616] border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="Efectivo">Efectivo</option>
                    <option value="Mercado Pago / Transferencia">Mercado Pago / Transferencia</option>
                    <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                    <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                  </select>
                </div>
              )}

              {/* Desglose en vivo de lo que pasa a Cuenta Corriente */}
              {(() => {
                const entregaNum = Math.max(0, parseFloat(montoEntregaCtaCte) || 0);
                const totalNum = Number(presupuestoParaCtaCte.total) || 0;
                const entregaReal = Math.min(entregaNum, totalNum);
                const restaDebiendo = Math.max(0, totalNum - entregaReal);

                return (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-600/40 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-400 font-bold">
                        {entregaReal > 0 ? '✓ Ingresa a Caja hoy (Entrega):' : 'Ingresa a Caja hoy:'}
                      </span>
                      <strong className="text-emerald-400 font-mono text-sm">
                        ${entregaReal.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <div className="flex justify-between text-xs border-t border-amber-600/20 pt-1.5">
                      <span className="text-amber-300 font-heading font-black uppercase">
                        💳 Pasa a Cuenta Corriente (Resta que debe):
                      </span>
                      <strong className="text-amber-400 font-mono text-base font-black">
                        ${restaDebiendo.toLocaleString('es-AR')}
                      </strong>
                    </div>
                    <p className="text-[10px] text-neutral-400 mt-1 leading-tight">
                      El vehículo quedará marcado como retirado y el turno como Atendido.
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setPresupuestoParaCtaCte(null)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-heading font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarPaseACuentaCorriente}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-heading font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-950 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Pasar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
