import { useState, useEffect, useId } from 'react';
import { User, Turno, HistorialServicio, Presupuesto } from '../types';
import { gasApi } from '../services/gasApi';
import { formatearFechaArgentina, calcularFechaVencimiento } from '../utils/dateFormatter';
import { VehicleStatusWitness } from './VehicleStatusWitness';
import {
  Calendar,
  Clock,
  Car,
  History,
  AlertCircle,
  Loader2,
  ArrowLeft,
  PlusCircle,
  Wrench,
  ShieldCheck,
  FileText,
  CheckCircle2,
  Printer,
  MessageCircle,
  RefreshCw,
  X,
  ExternalLink,
  Check
} from 'lucide-react';

interface ClientDashboardProps {
  user: User;
  initialTurnos: Turno[];
  onBackToHome: () => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const ClientDashboard = ({
  user,
  initialTurnos,
  onBackToHome,
  onShowToast,
}: ClientDashboardProps) => {
  const [turnos, setTurnos] = useState<Turno[]>(initialTurnos);
  const [activeTab, setActiveTab] = useState<'turnos' | 'presupuestos' | 'historial'>('turnos');

  // New Turno Form State
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [patente, setPatente] = useState('');
  const [fecha, setFecha] = useState('');
  const [horario, setHorario] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Vehicle service history state
  const [historialList, setHistorialList] = useState<HistorialServicio[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Presupuestos state
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loadingPresupuestos, setLoadingPresupuestos] = useState(false);
  const [presupuestoSeleccionadoModal, setPresupuestoSeleccionadoModal] = useState<Presupuesto | null>(null);
  const [aprobandoId, setAprobandoId] = useState<string | null>(null);

  const patenteId = useId();
  const fechaId = useId();
  const horarioId = useId();

  // Calculate safe tomorrow date string for datepicker min attribute
  const getTomorrowMinDate = () => {
    const now = new Date();
    now.setDate(now.getDate() + 1);
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Date selection handler with iOS & timezone safety
  const handleDateChange = async (selectedDate: string) => {
    setFecha(selectedDate);
    setHorario('');
    setAvailableSlots([]);

    if (!selectedDate) return;

    const parts = selectedDate.split('-');
    if (parts.length !== 3) return;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const chosenDate = new Date(year, month, day);

    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (chosenDate <= todayMidnight) {
      onShowToast(
        'warning',
        'Fecha no válida',
        'Los turnos deben solicitarse con al menos 24 hs de anticipación (a partir de mañana).'
      );
      setFecha('');
      return;
    }

    const dayOfWeek = chosenDate.getDay();
    if (dayOfWeek === 0) {
      onShowToast(
        'warning',
        'Domingos cerrado',
        'El taller permanece cerrado los domingos para descanso técnico.'
      );
      setFecha('');
      return;
    }

    // Base available schedule slots
    const baseSlots =
      dayOfWeek >= 1 && dayOfWeek <= 5
        ? ['08:00', '09:00', '10:00', '11:00', '16:00', '17:00', '18:00', '19:00']
        : ['08:00', '09:00', '10:00', '11:00'];

    setLoadingSlots(true);
    try {
      const res = await gasApi.getOccupiedSlots(selectedDate);
      if (res.resultado === 'ok' && Array.isArray(res.ocupados)) {
        const free = baseSlots.filter((slot) => !res.ocupados.includes(slot));
        setAvailableSlots(free);
        if (free.length === 0) {
          onShowToast('info', 'Día completo', 'No quedan turnos disponibles para esa fecha.');
        }
      } else {
        setAvailableSlots(baseSlots);
      }
    } catch (err: any) {
      console.warn('Fallback a horarios base:', err);
      setAvailableSlots(baseSlots);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Submit appointment & redirect to Mercado Pago
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPatente = patente.trim().toUpperCase();

    if (!cleanPatente || !fecha || !horario) {
      onShowToast('warning', 'Campos incompletos', 'Por favor completá la patente, fecha y horario.');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await gasApi.reserveTurno(user.email, fecha, horario, cleanPatente);

      if (res.resultado === 'mercadopago' && res.urlPago) {
        onShowToast(
          'info',
          'Conectando con Mercado Pago...',
          'Te estamos redirigiendo para abonar la seña de reserva.'
        );
        setShowBookingForm(false);
        setPatente('');
        setFecha('');
        setHorario('');
        window.location.href = res.urlPago;
      } else {
        onShowToast(
          'error',
          'No se pudo generar la orden de pago',
          res.mensaje || 'Error al conectar con Mercado Pago.'
        );
      }
    } catch (err: any) {
      onShowToast('error', 'Falla de conexión', err.message || 'Intentá nuevamente en unos momentos.');
    } finally {
      setBookingLoading(false);
    }
  };

  // Fetch client historical repairs
  const loadClientHistory = async () => {
    setLoadingHistorial(true);
    try {
      const res = await gasApi.getClientHistory(user.email);
      if (res.success && Array.isArray(res.historial)) {
        setHistorialList(res.historial);
      } else {
        setHistorialList([]);
      }
    } catch (err: any) {
      console.error(err);
      onShowToast('error', 'Error al cargar historial', 'No se pudieron consultar los trabajos previos.');
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Fetch client budgets & quotes
  const loadClientPresupuestos = async (silent = false) => {
    if (!silent) setLoadingPresupuestos(true);
    try {
      const res = await gasApi.getPresupuestos();
      if (res && res.success && Array.isArray(res.presupuestos)) {
        const userPatentes = turnos.map((t) => (t.patente || '').toUpperCase().trim());
        const userEmail = (user.email || '').toLowerCase().trim();

        const filtrados = res.presupuestos.filter((p) => {
          const emailMatch = p.clienteEmail && p.clienteEmail.toLowerCase().trim() === userEmail;
          const patenteMatch = p.patente && userPatentes.includes(p.patente.toUpperCase().trim());
          return emailMatch || patenteMatch;
        });

        setPresupuestos(filtrados);
      } else {
        setPresupuestos([]);
      }
    } catch (err) {
      console.warn('Error loading client presupuestos:', err);
    } finally {
      if (!silent) setLoadingPresupuestos(false);
    }
  };

  useEffect(() => {
    loadClientPresupuestos();
  }, [user.email, turnos]);

  // Sincronización en tiempo real: cuando el admin cambia el estado del auto o presupuesto
  useEffect(() => {
    // 1. BroadcastChannel para sincronización instantánea (<10ms) entre pestañas y ventanas
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('lacasadeladireccion_realtime');
        bc.onmessage = () => {
          loadClientPresupuestos(true);
        };
      } catch {}
    }

    // 2. Storage event para cambios de localStorage entre pestañas
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'taller_presupuestos_v1') {
        loadClientPresupuestos(true);
      }
    };
    window.addEventListener('storage', handleStorage);

    // 3. Evento interno personalizado
    const handleCustomSync = () => {
      loadClientPresupuestos(true);
    };
    window.addEventListener('taller_presupuesto_sync', handleCustomSync);

    // 4. Evento de foco/visibilidad: si el cliente vuelve a la pestaña, refrescar al segundo
    const handleFocus = () => {
      loadClientPresupuestos(true);
    };
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadClientPresupuestos(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // 5. Polling en segundo plano cada 7 segundos para sincronización entre distintos dispositivos (ej. PC y celular)
    const interval = setInterval(() => {
      loadClientPresupuestos(true);
    }, 7000);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('taller_presupuesto_sync', handleCustomSync);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [user.email, turnos]);

  useEffect(() => {
    if (activeTab === 'historial') {
      loadClientHistory();
    } else if (activeTab === 'presupuestos') {
      loadClientPresupuestos();
    }
  }, [activeTab]);

  // Client approves budget directly
  const handleAprobarPresupuesto = async (p: Presupuesto) => {
    setAprobandoId(p.id);
    try {
      await gasApi.updatePresupuestoEstado(p.id, 'aprobado');
      setPresupuestos((prev) =>
        prev.map((item) => (item.id === p.id ? { ...item, estado: 'aprobado' } : item))
      );
      if (presupuestoSeleccionadoModal?.id === p.id) {
        setPresupuestoSeleccionadoModal({ ...presupuestoSeleccionadoModal, estado: 'aprobado' });
      }
      onShowToast(
        'success',
        '¡Presupuesto Aprobado!',
        `Confirmaste la cotización ${p.numero} ($${p.total.toLocaleString('es-AR')}). Le avisamos a Rodrigo para avanzar.`
      );

      // Offer WhatsApp message to Rodrigo
      const mensaje = `Hola Rodrigo! 👋 Acabo de aprobar desde la web de La Casa de la Dirección el Presupuesto *${p.numero}* para mi auto (*${p.patente}* - ${p.vehiculoModelo || ''}) por un total de *$${p.total.toLocaleString('es-AR')}*. ¡Confirmado para realizar el trabajo!`;
      const url = `https://wa.me/5492625532070?text=${encodeURIComponent(mensaje)}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
      onShowToast('error', 'Error al aprobar', 'No se pudo registrar la confirmación en el servidor.');
    } finally {
      setAprobandoId(null);
    }
  };

  const handleConsultarWhatsApp = (p: Presupuesto) => {
    const mensaje = `Hola Rodrigo, te escribo por el Presupuesto *${p.numero}* (${p.patente} - ${p.vehiculoModelo || ''}) por *$${p.total.toLocaleString('es-AR')}*. Quería consultarte lo siguiente:`;
    const url = `https://wa.me/5492625532070?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  };

  const imprimirPresupuestoCliente = (p: Presupuesto) => {
    const fechaEmision = formatearFechaArgentina(p.fecha);
    const fechaVence = calcularFechaVencimiento(p.fecha, p.validezDias || 7);

    const itemsHtml = p.items
      .map(
        (it) => `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px;">
            <strong style="color: #111827;">${it.tipo === 'mano_de_obra' ? '🛠️ MANO DE OBRA' : '🔩 REPUESTO'}:</strong>
            <span style="display: block; color: #4b5563; margin-top: 2px;">${it.descripcion}</span>
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
                  <div style="font-size: 22px; font-weight: 900; color: #dc2626; font-family: monospace;">
                    ${p.numero}
                  </div>
                  <div style="font-size: 13px; color: #374151; margin-top: 4px;">
                    Fecha de Emisión: <strong style="color: #000;">${fechaEmision}</strong>
                  </div>
                  <div style="font-size: 12px; color: #b91c1c; font-weight: 600; margin-top: 2px;">
                    Válido hasta: <strong>${fechaVence} (${p.validezDias || 7} días)</strong>
                  </div>
                  <div style="margin-top: 8px;">
                    <span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase; background: #e5e7eb; color: #1f2937;">
                      Estado: ${p.estado.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Ficha de Datos del Vehículo y Cliente -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9fafb; padding: 18px; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <div>
                  <h3 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; margin-bottom: 8px;">
                    Datos del Cliente
                  </h3>
                  <div style="font-size: 15px; font-weight: 800; color: #111827;">${p.clienteNombre}</div>
                  <div style="font-size: 13px; color: #4b5563; margin-top: 2px;">📞 ${p.clienteTelefono || 'Sin teléfono'}</div>
                  <div style="font-size: 13px; color: #4b5563;">✉️ ${p.clienteEmail || user.email}</div>
                </div>
                <div>
                  <h3 style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 1px; margin-bottom: 8px;">
                    Vehículo en Cotización
                  </h3>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="plate-badge">${p.patente}</span>
                    <strong style="font-size: 15px; color: #111827;">${p.vehiculoModelo || 'Vehículo'}</strong>
                  </div>
                  ${p.kilometraje ? `<div style="font-size: 13px; color: #4b5563; margin-top: 6px;">📈 Kilometraje: <strong>${p.kilometraje} km</strong></div>` : ''}
                </div>
              </div>

              <!-- Tabla de Items -->
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                  <tr style="background: #111827; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px;">
                    <th style="padding: 10px 12px; text-align: left; border-radius: 6px 0 0 6px;">Descripción de Trabajo / Repuesto</th>
                    <th style="padding: 10px 12px; text-align: center; width: 60px;">Cant.</th>
                    <th style="padding: 10px 12px; text-align: right; width: 120px;">Unitario</th>
                    <th style="padding: 10px 12px; text-align: right; width: 130px; border-radius: 0 6px 6px 0;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <!-- Total Card -->
              <div style="display: flex; justify-content: flex-end;">
                <div style="width: 320px;">
                  <div class="total-card">
                    <span style="font-size: 12px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; display: block;">
                      Total Final Presupuestado
                    </span>
                    <div class="total-amount">
                      $${Number(p.total).toLocaleString('es-AR')}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Observaciones & Términos -->
              <div style="margin-top: 30px; padding: 16px; background: #f9fafb; border-left: 4px solid #dc2626; border-radius: 6px; font-size: 12px; color: #4b5563;">
                <strong style="color: #111827; display: block; margin-bottom: 4px; text-transform: uppercase; font-size: 11px;">
                  Condiciones y Garantía del Taller:
                </strong>
                <p>${p.observaciones || 'Presupuesto válido por 7 días. Precios expresados en moneda nacional (pesos argentinos). Mano de obra y repuestos garantizados por La Casa de la Dirección.'}</p>
              </div>

              <div style="margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px dashed #d1d5db; padding-top: 15px;">
                La Casa de la Dirección · Alineación Computarizada y Tren Delantero · General Alvear, Mendoza
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        setPresupuestoSeleccionadoModal(p);
      }
    } catch {
      setPresupuestoSeleccionadoModal(p);
    }
  };

  const turnosProgramados = turnos.filter(
    (t) => String(t.estado).toLowerCase().trim() === 'programado'
  );
  const turnosAtendidos = turnos.filter(
    (t) => String(t.estado).toLowerCase().trim() !== 'programado'
  );

  const presupuestosPendientesCount = presupuestos.filter((p) => p.estado === 'pendiente').length;

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 bg-[#050505]">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Navigation & header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-5">
          <button
            onClick={onBackToHome}
            className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Inicio</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setShowBookingForm(!showBookingForm);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-heading font-bold text-xs uppercase tracking-wider rounded shadow-md shadow-red-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{showBookingForm ? 'Cerrar Formulario' : 'Solicitar Nuevo Turno'}</span>
            </button>
          </div>
        </div>

        {/* User profile banner */}
        <div className="p-6 rounded-xl bg-neutral-900/80 border border-neutral-800 flex flex-wrap items-center justify-between gap-6 shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-heading font-bold text-red-500 uppercase tracking-widest mb-1">
              <span>Panel de Cliente</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-white uppercase tracking-tight">
              Hola, {user.nombre}
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Tu centro de gestión: turnos en taller, cotizaciones presupuestadas e historial clínico automotor.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-mono text-neutral-300">
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider">
                Teléfono
              </span>
              <span className="font-bold text-white">{user.telefono || 'No especificado'}</span>
            </div>
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-bold tracking-wider">
                Correo Electrónico
              </span>
              <span className="font-bold text-white">{user.email}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TESTIGO EN VIVO DEL VEHÍCULO EN EL TALLER */}
        {/* ========================================================================= */}
        <VehicleStatusWitness
          presupuestos={presupuestos}
          turnosProgramados={turnosProgramados}
          userNombre={user.nombre}
          onVerPresupuesto={(p) => {
            setActiveTab('presupuestos');
            setPresupuestoSeleccionadoModal(p);
          }}
          onRefresh={() => loadClientPresupuestos()}
          refreshing={loadingPresupuestos}
        />

        {/* Modal Booking Form */}
        {showBookingForm && (
          <div className="p-6 sm:p-8 rounded-xl bg-[#0a0a0a] border-2 border-red-600 shadow-2xl animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800 mb-6">
              <div>
                <h3 className="font-heading font-black text-lg text-white uppercase tracking-wide">
                  Reservar Turno con Seña Online
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  Seña requerida vía Mercado Pago para congelar tu lugar en agenda.
                </p>
              </div>
            </div>

            <form onSubmit={handleBookingSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={patenteId} className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
                    1. Patente del Vehículo
                  </label>
                  <div className="relative">
                    <Car className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
                    <input
                      id={patenteId}
                      type="text"
                      required
                      placeholder="Ej: AE123MZ o PEU534"
                      value={patente}
                      onChange={(e) => setPatente(e.target.value.toUpperCase())}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm font-mono font-bold text-white uppercase tracking-widest placeholder-neutral-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor={fechaId} className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
                    2. Fecha del Turno
                  </label>
                  <input
                    id={fechaId}
                    type="date"
                    required
                    min={getTomorrowMinDate()}
                    value={fecha}
                    onChange={(e) => handleDateChange(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label htmlFor={horarioId} className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-1.5">
                    3. Horario Disponible
                  </label>
                  <select
                    id={horarioId}
                    required
                    disabled={!fecha || loadingSlots}
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {!fecha && <option value="">-- Primero elegí un día --</option>}
                    {fecha && loadingSlots && <option value="">Consultando disponibilidad...</option>}
                    {fecha && !loadingSlots && availableSlots.length === 0 && (
                      <option value="">❌ Sin horarios libres</option>
                    )}
                    {fecha &&
                      !loadingSlots &&
                      availableSlots.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot} hs
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-neutral-900">
                <button
                  type="button"
                  onClick={() => setShowBookingForm(false)}
                  className="px-5 py-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading || !fecha || !horario || !patente}
                  className="px-6 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Conectando Mercado Pago...</span>
                    </>
                  ) : (
                    <>
                      <span>Abonar Seña y Confirmar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('turnos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'turnos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Mis Turnos ({turnosProgramados.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('presupuestos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'presupuestos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Mis Presupuestos ({presupuestos.length})</span>
            {presupuestosPendientesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                {presupuestosPendientesCount} pendiente{presupuestosPendientesCount > 1 ? 's' : ''}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
              activeTab === 'historial'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Ficha de Servicios Realizados</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SCHEDULED APPOINTMENTS */}
        {/* ========================================================================= */}
        {activeTab === 'turnos' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-heading font-bold text-white text-base uppercase tracking-wider mb-3">
                🔧 Turnos Programados Pendientes
              </h3>

              {turnosProgramados.length === 0 ? (
                <div className="p-8 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                  <AlertCircle className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                  <p className="text-sm text-neutral-300 font-medium">No tenés turnos programados pendientes.</p>
                  <p className="text-xs text-neutral-500 mt-1">Podés solicitar uno nuevo cuando lo necesites con el botón superior.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {turnosProgramados.map((item, idx) => {
                    // Check if this appointment already has an associated quote
                    const presAsociado = presupuestos.find(
                      (p) => p.patente.toUpperCase() === item.patente.toUpperCase() && p.estado !== 'rechazado'
                    );

                    return (
                      <div
                        key={idx}
                        className="p-5 rounded-xl bg-neutral-900/90 border border-neutral-800 border-l-4 border-l-red-600 flex flex-col justify-between gap-3 shadow-lg"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-base font-black text-white tracking-widest uppercase">
                              🚗 {item.patente}
                            </span>
                            <div className="mt-2 text-xs text-neutral-300 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-red-500" />
                                <span className="font-mono text-white font-bold">{formatearFechaArgentina(item.fecha)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-red-500" />
                                <span>{String(item.horario).replace("'", '')} hs</span>
                              </div>
                            </div>
                          </div>

                          <span className="text-[11px] font-heading font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-red-950 text-red-400 border border-red-800/50">
                            {item.estado}
                          </span>
                        </div>

                        {/* Presupuesto vinculado directo en el turno */}
                        {presAsociado && (
                          <div className="mt-2 p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs text-white font-heading font-bold">
                                <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                <span className="truncate">Cotización {presAsociado.numero}:</span>
                                <span className="font-mono text-emerald-400 font-black">
                                  ${presAsociado.total.toLocaleString('es-AR')}
                                </span>
                              </div>
                              <span className="text-[10px] text-neutral-400 uppercase font-semibold">
                                Estado:{' '}
                                <strong
                                  className={
                                    presAsociado.estado === 'aprobado'
                                      ? 'text-blue-400'
                                      : presAsociado.estado === 'facturado'
                                      ? 'text-emerald-400'
                                      : 'text-amber-400'
                                  }
                                >
                                  {presAsociado.estado}
                                </strong>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('presupuestos');
                                setPresupuestoSeleccionadoModal(presAsociado);
                              }}
                              className="px-3 py-1.5 rounded bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-600/40 text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
                            >
                              Ver Detalle
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {turnosAtendidos.length > 0 && (
              <div className="pt-6 border-t border-neutral-900">
                <h3 className="font-heading font-bold text-neutral-400 text-sm uppercase tracking-wider mb-3">
                  📋 Citas Atendidas Anteriores
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {turnosAtendidos.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-neutral-300 uppercase">{item.patente}</span>
                        <div className="text-neutral-400 mt-0.5 font-mono">
                          {formatearFechaArgentina(item.fecha)} · {String(item.horario).replace("'", '')} hs
                        </div>
                      </div>
                      <span className="text-[10px] font-heading uppercase text-neutral-400 px-2 py-0.5 rounded bg-neutral-900">
                        {item.estado}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PRESUPUESTOS Y COTIZACIONES (NUEVO PARA EL CLIENTE) */}
        {/* ========================================================================= */}
        {activeTab === 'presupuestos' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-black text-white text-lg uppercase tracking-wide flex items-center gap-2">
                  <FileText className="w-5 h-5 text-red-500" />
                  <span>Presupuestos y Cotizaciones de tus Vehículos</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Revisá el detalle de piezas y mano de obra para tu auto, aprobá la cotización online o consultá con Rodrigo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => loadClientPresupuestos()}
                disabled={loadingPresupuestos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPresupuestos ? 'animate-spin text-red-500' : 'text-neutral-400'}`} />
                <span>Actualizar</span>
              </button>
            </div>

            {loadingPresupuestos ? (
              <div className="p-16 text-center text-neutral-400 text-xs">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
                <span className="font-heading uppercase tracking-wider">Consultando presupuestos en el taller...</span>
              </div>
            ) : presupuestos.length === 0 ? (
              <div className="p-10 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center space-y-2">
                <FileText className="w-10 h-10 text-neutral-600 mx-auto" />
                <h4 className="font-heading font-bold text-white uppercase text-base">
                  Aún no tenés cotizaciones cargadas
                </h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Cuando Rodrigo elabore un presupuesto para tu vehículo, vas a poder ver el desglose completo de repuestos y mano de obra acá mismo para aprobarlo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {presupuestos.map((p) => {
                  const estadoBadge = {
                    pendiente: {
                      bg: 'bg-amber-950/60 border-amber-800/80 text-amber-400',
                      label: '🟡 Pendiente de Aprobación',
                    },
                    aprobado: {
                      bg: 'bg-blue-950/60 border-blue-800/80 text-blue-400',
                      label: '🔵 Aprobado por Vos · Esperando Ingreso',
                    },
                    ingreso_taller: {
                      bg: 'bg-purple-950/80 border-purple-600 text-purple-300 font-bold',
                      label: '🟣 Auto Ingresó al Taller',
                    },
                    en_reparacion: {
                      bg: 'bg-orange-950/80 border-orange-600 text-orange-300 font-bold',
                      label: '🟠 Auto en Reparación (Fosa / Elevador)',
                    },
                    trabajo_terminado: {
                      bg: 'bg-emerald-950 border-emerald-500 text-emerald-300 font-black animate-pulse shadow-md shadow-emerald-900/40',
                      label: '🟢 ¡Trabajo Terminado! Listo para Retirar',
                    },
                    facturado: {
                      bg: 'bg-neutral-900 border-neutral-700 text-emerald-400',
                      label: '🏁 Trabajo Concluido / Facturado',
                    },
                    rechazado: {
                      bg: 'bg-neutral-900 border-neutral-700 text-neutral-400',
                      label: '⚪ Rechazado / Vencido',
                    },
                  }[p.estado] || {
                    bg: 'bg-neutral-900 border-neutral-700 text-neutral-400',
                    label: p.estado,
                  };

                  return (
                    <div
                      key={p.id}
                      className="p-5 rounded-xl bg-[#0a0a0a] border border-neutral-800 hover:border-neutral-700 transition-all shadow-xl flex flex-col justify-between space-y-4"
                    >
                      {/* Cabecera de la tarjeta */}
                      <div className="border-b border-neutral-900 pb-3 flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-red-500 bg-red-950/50 border border-red-900/50 px-2 py-0.5 rounded">
                              {p.numero}
                            </span>
                            <span className="font-mono text-base font-black text-white uppercase tracking-wider">
                              {p.patente}
                            </span>
                          </div>
                          {p.vehiculoModelo && (
                            <p className="text-xs text-neutral-300 font-bold mt-1">
                              🚘 {p.vehiculoModelo} {p.kilometraje ? `· ${p.kilometraje} km` : ''}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-neutral-400 mt-1">
                            <span>📅 Emitido: <strong className="text-white font-mono">{formatearFechaArgentina(p.fecha)}</strong></span>
                            <span className="text-neutral-600">·</span>
                            <span>⏳ Válido hasta: <strong className="text-amber-400 font-mono">{calcularFechaVencimiento(p.fecha, p.validezDias || 7)}</strong> ({p.validezDias || 7} días)</span>
                          </div>
                        </div>

                        <span className={`text-[10px] font-heading font-black uppercase tracking-wider px-2 py-1 rounded border shrink-0 ${estadoBadge.bg}`}>
                          {estadoBadge.label}
                        </span>
                      </div>

                      {/* Desglose de Items */}
                      <div className="space-y-1.5 text-xs">
                        <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                          Detalle de Tareas y Repuestos ({p.items.length}):
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                          {p.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-neutral-300 bg-neutral-950/60 p-1.5 rounded border border-neutral-900">
                              <span className="truncate pr-2 text-[11px]">
                                {it.tipo === 'mano_de_obra' ? '🛠️' : '🔩'} {it.cantidad > 1 ? `${it.cantidad}x ` : ''}
                                {it.descripcion}
                              </span>
                              <span className="font-mono text-[11px] text-white font-bold shrink-0">
                                ${it.subtotal.toLocaleString('es-AR')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total y Observaciones */}
                      <div className="pt-3 border-t border-neutral-900 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-400 font-heading uppercase font-bold">
                            Monto Total Presupuestado:
                          </span>
                          <span className="font-mono text-xl font-black text-emerald-400">
                            ${p.total.toLocaleString('es-AR')}
                          </span>
                        </div>

                        {/* Botones de Acción del Cliente */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {p.estado === 'pendiente' && (
                            <button
                              type="button"
                              onClick={() => handleAprobarPresupuesto(p)}
                              disabled={aprobandoId === p.id}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                              title="Aprobar presupuesto para comenzar los trabajos"
                            >
                              {aprobandoId === p.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>Aprobar Presupuesto</span>
                            </button>
                          )}

                          {p.estado === 'trabajo_terminado' && (
                            <a
                              href={`https://wa.me/5492625532070?text=${encodeURIComponent(
                                `Hola Rodrigo! 👋 Veo en el panel que mi auto (*${p.patente}* - ${p.vehiculoModelo || ''}) ya tiene el trabajo terminado. Te aviso que voy a pasar a retirarlo!`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
                              title="Avisar a Rodrigo por WhatsApp que vas a retirar el auto"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Avisar Retiro</span>
                            </a>
                          )}

                          <button
                            type="button"
                            onClick={() => handleConsultarWhatsApp(p)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366] text-[#25D366] hover:text-black border border-[#25D366]/40 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                            title="Consultar dudas con Rodrigo por WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Consultar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => imprimirPresupuestoCliente(p)}
                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                            title="Ver e imprimir comprobante con membrete oficial"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir / PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: VEHICLE SERVICE CLINIC HISTORY */}
        {/* ========================================================================= */}
        {activeTab === 'historial' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-bold text-white text-base uppercase tracking-wider">
                  📋 Registro Histórico de Reparaciones
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Ficha técnica de trabajos, kilómetros certificados y valores registrados en el taller.
                </p>
              </div>

              <button
                onClick={loadClientHistory}
                disabled={loadingHistorial}
                className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 flex items-center gap-1 font-heading font-bold uppercase cursor-pointer"
              >
                {loadingHistorial ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Actualizar'}
              </button>
            </div>

            {loadingHistorial ? (
              <div className="p-12 text-center text-neutral-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                <span>Consultando tu historial clínico en el servidor...</span>
              </div>
            ) : historialList.length === 0 ? (
              <div className="p-8 rounded-xl bg-neutral-900/40 border border-neutral-800 text-center">
                <Wrench className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                <p className="text-sm text-neutral-300 font-medium">Aún no registrás servicios archivados con este correo.</p>
                <p className="text-xs text-neutral-500 mt-1">
                  Cuando tu vehículo sea atendido en el taller, acá quedará registrado cada detalle y kilometraje.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historialList.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 border-l-4 border-l-red-600 shadow-md space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-black text-sm text-white uppercase tracking-wider">
                            🚗 Patente: <span className="text-red-500 font-mono">{item.patente}</span>
                          </span>
                          {item.modelo && (
                            <span className="px-2.5 py-0.5 rounded bg-red-950/60 border border-red-800/70 text-white font-heading font-bold text-xs uppercase tracking-wider shadow-sm">
                              🚘 {item.modelo}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono text-neutral-300 font-bold">
                          📅 {formatearFechaArgentina(item.fecha)}
                        </span>
                      </div>

                      <div className="text-sm text-neutral-200">
                        <strong className="text-white font-heading uppercase text-xs tracking-wider block text-neutral-400 mb-1">
                          🛠️ Trabajo Realizado:
                        </strong>
                        <p className="leading-relaxed bg-neutral-950 p-3 rounded border border-neutral-800/60 font-mono text-xs">
                          {item.trabajo}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 text-xs text-neutral-400">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span>📈 Kilometraje:</span>
                          <strong className="text-white">
                            {Number(item.kilometraje).toLocaleString('es-AR')} km
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono">
                          <span>💰 Monto Total:</span>
                          <strong className="text-emerald-400 text-sm">
                            ${Number(item.monto).toLocaleString('es-AR')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: VER DETALLE DEL PRESUPUESTO (EN CASO DE POPUP BLOQUEADO) */}
      {/* ========================================================================= */}
      {presupuestoSeleccionadoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#0d0d0d] border-2 border-red-600 rounded-xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            {/* Header del modal */}
            <div className="p-5 border-b border-neutral-800 bg-[#0a0a0a] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                <span className="font-heading font-black text-sm text-white uppercase tracking-wider">
                  Detalle del Presupuesto {presupuestoSeleccionadoModal.numero}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPresupuestoSeleccionadoModal(null)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Taller info */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
                <h4 className="font-heading font-black text-white text-sm uppercase">LA CASA DE LA DIRECCIÓN</h4>
                <p className="text-neutral-400">📍 Av. San Juan e Independencia, General Alvear, Mendoza</p>
                <p className="text-neutral-400">📞 WhatsApp Oficial: 2625 532070</p>
              </div>

              {/* Vehículo y estado */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                <div>
                  <span className="text-neutral-500 block uppercase font-bold text-[10px]">Vehículo / Patente</span>
                  <span className="font-mono text-white text-sm font-bold">
                    {presupuestoSeleccionadoModal.patente} · {presupuestoSeleccionadoModal.vehiculoModelo || 'Vehículo'}
                  </span>
                  {presupuestoSeleccionadoModal.kilometraje && (
                    <span className="text-neutral-400 block mt-0.5">Km: {presupuestoSeleccionadoModal.kilometraje} km</span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-neutral-500 block uppercase font-bold text-[10px]">Estado Actual en Taller</span>
                  <span className="font-heading font-black text-xs uppercase text-amber-400 block mt-0.5">
                    {{
                      pendiente: '🟡 Presupuesto Pendiente de Aprobación',
                      aprobado: '🔵 Presupuesto Aprobado (Esperando Ingreso)',
                      ingreso_taller: '🟣 Auto en el Taller (Ingresó)',
                      en_reparacion: '🟠 Auto en Reparación (Fosa / Elevador)',
                      trabajo_terminado: '🟢 ¡Trabajo Terminado! Listo para Retirar',
                      facturado: '🏁 Trabajo Concluido / Facturado',
                      rechazado: '⚪ Rechazado / Cancelado',
                    }[presupuestoSeleccionadoModal.estado] || presupuestoSeleccionadoModal.estado}
                  </span>
                  <span className="text-neutral-300 block mt-1 font-mono text-[11px]">
                    📅 Emisión: <strong className="text-white">{formatearFechaArgentina(presupuestoSeleccionadoModal.fecha)}</strong>
                  </span>
                  <span className="text-amber-400 block mt-0.5 font-mono text-[11px]">
                    ⏳ Válido hasta: {calcularFechaVencimiento(presupuestoSeleccionadoModal.fecha, presupuestoSeleccionadoModal.validezDias || 7)} ({presupuestoSeleccionadoModal.validezDias || 7} días)
                  </span>
                </div>
              </div>

              {/* Tabla de Trabajos */}
              <div className="space-y-2">
                <span className="font-heading font-bold text-neutral-400 uppercase tracking-wider block">
                  Items y Repuestos Cotizados:
                </span>
                <div className="border border-neutral-800 rounded-lg overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] font-heading font-bold">
                      <tr>
                        <th className="p-2.5">Descripción</th>
                        <th className="p-2.5 text-center">Cant.</th>
                        <th className="p-2.5 text-right">Precio</th>
                        <th className="p-2.5 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 font-mono">
                      {presupuestoSeleccionadoModal.items.map((it) => (
                        <tr key={it.id}>
                          <td className="p-2.5 text-neutral-200">
                            {it.tipo === 'mano_de_obra' ? '🛠️' : '🔩'} {it.descripcion}
                          </td>
                          <td className="p-2.5 text-center text-neutral-400">{it.cantidad}</td>
                          <td className="p-2.5 text-right text-neutral-400">${it.precioUnitario.toLocaleString('es-AR')}</td>
                          <td className="p-2.5 text-right text-white font-bold">${it.subtotal.toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Total destacado */}
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/60 flex items-center justify-between">
                <span className="font-heading font-black text-white uppercase text-sm">
                  Total Final a Abonar:
                </span>
                <span className="font-mono text-2xl font-black text-emerald-400">
                  ${presupuestoSeleccionadoModal.total.toLocaleString('es-AR')}
                </span>
              </div>

              {presupuestoSeleccionadoModal.observaciones && (
                <p className="text-neutral-400 text-[11px] italic bg-neutral-950 p-3 rounded border border-neutral-900">
                  💡 {presupuestoSeleccionadoModal.observaciones}
                </p>
              )}
            </div>

            {/* Footer con acciones */}
            <div className="p-4 border-t border-neutral-800 bg-[#0a0a0a] flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => imprimirPresupuestoCliente(presupuestoSeleccionadoModal)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir / PDF</span>
              </button>

              {presupuestoSeleccionadoModal.estado === 'pendiente' && (
                <button
                  type="button"
                  onClick={() => handleAprobarPresupuesto(presupuestoSeleccionadoModal)}
                  disabled={aprobandoId === presupuestoSeleccionadoModal.id}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>Aprobar Presupuesto</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setPresupuestoSeleccionadoModal(null)}
                className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
