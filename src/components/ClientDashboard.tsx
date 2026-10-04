import { useState, useEffect, useId } from 'react';
import { User, Turno, HistorialServicio } from '../types';
import { gasApi } from '../services/gasApi';
import { Calendar, Clock, Car, History, AlertCircle, Loader2, ArrowLeft, PlusCircle, Wrench, ShieldCheck } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'turnos' | 'historial'>('turnos');

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
    // Monday-Friday: 08:00 to 11:00 & 16:00 to 19:00
    // Saturday: 08:00 to 11:00
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

  useEffect(() => {
    if (activeTab === 'historial') {
      loadClientHistory();
    }
  }, [activeTab]);

  const turnosProgramados = turnos.filter(
    (t) => String(t.estado).toLowerCase().trim() === 'programado'
  );
  const turnosAtendidos = turnos.filter(
    (t) => String(t.estado).toLowerCase().trim() !== 'programado'
  );

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
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-heading font-bold text-xs uppercase tracking-wider rounded shadow-md shadow-red-600/20 transition-all"
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
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-400">
              <span>📧 {user.email}</span>
              {user.telefono && (
                <>
                  <span>·</span>
                  <span>📱 {user.telefono}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-neutral-300 font-medium">Cliente Verificado del Taller</span>
          </div>
        </div>

        {/* Interactive Booking Form Card */}
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
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2.5 text-sm text-white"
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
                  className="px-5 py-2.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-heading font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading || !fecha || !horario || !patente}
                  className="px-6 py-2.5 rounded bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
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
        <div className="flex items-center gap-2 border-b border-neutral-800">
          <button
            onClick={() => setActiveTab('turnos')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'turnos'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Mis Turnos ({turnosProgramados.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('historial')}
            className={`flex items-center gap-2 px-5 py-3 font-heading font-black text-sm uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'historial'
                ? 'border-red-600 text-red-500'
                : 'border-transparent text-neutral-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Ficha de Servicios Realizados</span>
          </button>
        </div>

        {/* Tab 1: Scheduled appointments */}
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
                  {turnosProgramados.map((item, idx) => (
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
                              <span>{String(item.fecha).replace("'", '')}</span>
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
                    </div>
                  ))}
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
                        <div className="text-neutral-500 mt-0.5">
                          {String(item.fecha).replace("'", '')} · {String(item.horario).replace("'", '')} hs
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

        {/* Tab 2: Vehicle Service Clinic History */}
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
                className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 flex items-center gap-1 font-heading font-bold uppercase"
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
                {historialList.map((item, idx) => {
                  let cleanFecha = item.fecha;
                  if (cleanFecha.includes('GMT') || cleanFecha.includes('00:00:00')) {
                    try {
                      const d = new Date(cleanFecha);
                      const dia = String(d.getDate()).padStart(2, '0');
                      const mes = String(d.getMonth() + 1).padStart(2, '0');
                      const anio = d.getFullYear();
                      cleanFecha = `${dia}/${mes}/${anio}`;
                    } catch (e) {
                      cleanFecha = cleanFecha.substring(0, 10);
                    }
                  }

                  return (
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
                        <span className="text-xs font-mono text-neutral-400">
                          📅 {cleanFecha}
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
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
