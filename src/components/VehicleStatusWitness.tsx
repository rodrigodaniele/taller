import { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Car,
  MessageCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  MapPin,
  X,
} from 'lucide-react';
import { Presupuesto, Turno } from '../types';
import { formatearFechaArgentina } from '../utils/dateFormatter';

interface VehicleStatusWitnessProps {
  presupuestos: Presupuesto[];
  turnosProgramados: Turno[];
  userNombre: string;
  onVerPresupuesto: (p: Presupuesto) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const VehicleStatusWitness = ({
  presupuestos,
  turnosProgramados,
  onVerPresupuesto,
}: VehicleStatusWitnessProps) => {
  // IDs de presupuestos en 'trabajo_terminado' que el cliente ya confirmó haber retirado
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('testigo_retirado_')) {
          set.add(k.replace('testigo_retirado_', ''));
        }
      }
    } catch {}
    return set;
  });

  const handleConfirmarRetiro = (id: string) => {
    try {
      localStorage.setItem(`testigo_retirado_${id}`, 'true');
    } catch {}
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  // Encontrar vehículos activos en el taller:
  // 1. Se excluye 'rechazado' (el cliente o taller no aceptó la cotización, no hay auto en reparación)
  // 2. Se excluye 'facturado' (cuando está facturado el servicio está concluido y cobrado, el auto ya salió del taller)
  // 3. Se excluye si está en 'trabajo_terminado' y el cliente ya confirmó el retiro con el botón
  const activePresupuestos = presupuestos.filter((p) => {
    if (p.estado === 'rechazado' || p.estado === 'facturado') return false;
    if (p.estado === 'trabajo_terminado' && dismissedIds.has(p.id)) return false;
    return true;
  });

  // Si no hay ningún presupuesto activo pero sí hay un turno programado pendiente
  const primerTurno = turnosProgramados.length > 0 ? turnosProgramados[0] : null;

  // Si el turno existente ya tuvo un presupuesto que fue rechazado o facturado, tampoco se debe mostrar el cartel de espera
  const turnoConPresupuestoCerrado = primerTurno && presupuestos.some(
    (p) =>
      p.patente.toUpperCase().trim() === primerTurno.patente.toUpperCase().trim() &&
      (p.estado === 'rechazado' || p.estado === 'facturado')
  );

  // Si no hay autos activos en el taller, o si el presupuesto fue rechazado/facturado,
  // el testigo se apaga por completo (pantalla limpia sin carteles)
  if (activePresupuestos.length === 0) {
    if (!primerTurno || turnoConPresupuestoCerrado) {
      return null;
    }
  }

  // Si no hay presupuestos cargados aún pero hay turno agendado
  if (activePresupuestos.length === 0 && primerTurno) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 border-2 border-red-600/40 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3.5 rounded-xl bg-red-600/20 border border-red-600/40 text-red-500 shrink-0">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-[11px] font-heading font-black uppercase tracking-widest text-amber-400">
                  TESTIGO DE TU VEHÍCULO · TURNO CONFIRMADO
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-heading font-black text-white uppercase tracking-tight mt-1">
                Esperando ingreso al taller: {primerTurno.patente}
              </h3>
              <p className="text-xs text-neutral-300 mt-1 max-w-xl">
                Tu turno está agendado para el <strong>{formatearFechaArgentina(primerTurno.fecha)}</strong> a las{' '}
                <strong>{String(primerTurno.horario).replace("'", '')} hs</strong>. Apenas ingreses tu vehículo, Rodrigo te cargará la cotización técnica y podrás seguir cada etapa desde este testigo.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <a
              href="https://wa.me/5492625532070?text=Hola%20Rodrigo!%20Te%20consulto%20por%20mi%20turno%20en%20La%20Casa%20de%20la%20Direcci%C3%B3n"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Consultar al Taller</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Tomamos el presupuesto más relevante para el testigo
  // Prioridad: trabajo_terminado > en_reparacion > ingreso_taller > aprobado > pendiente
  const sortedPresupuestos = [...activePresupuestos].sort((a, b) => {
    const orden: Record<string, number> = {
      trabajo_terminado: 5,
      en_reparacion: 4,
      ingreso_taller: 3,
      aprobado: 2,
      pendiente: 1,
    };
    return (orden[b.estado] || 0) - (orden[a.estado] || 0);
  });

  const p = sortedPresupuestos[0];
  if (!p) return null;

  // Configuración de etapas para el Testigo
  const getStageInfo = (estado: Presupuesto['estado']) => {
    switch (estado) {
      case 'trabajo_terminado':
        return {
          step: 5,
          color: 'from-emerald-950 via-neutral-900 to-emerald-950 border-emerald-500 shadow-emerald-900/30',
          badgeBg: 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/50',
          badgeText: '🟢 ¡LISTO PARA RETIRAR!',
          title: '🎉 ¡TRABAJO TERMINADO! TU AUTO ESTÁ LISTO',
          desc: `El trabajo en tu ${p.vehiculoModelo || 'vehículo'} (${p.patente}) fue completado, alineado y testeado con éxito por Rodrigo. Ya podés pasar a retirarlo por el taller.`,
          icon: <CheckCircle2 className="w-8 h-8 text-emerald-400 animate-bounce" />,
          actionLabel: '📲 Avisar que voy a retirar',
          actionUrl: `https://wa.me/5492625532070?text=${encodeURIComponent(
            `Hola Rodrigo! 👋 Veo en el panel que mi auto (*${p.patente}* - ${p.vehiculoModelo || ''}) ya está terminado y LISTO PARA RETIRAR. Te aviso que voy en camino al taller!`
          )}`,
        };

      case 'en_reparacion':
        return {
          step: 4,
          color: 'from-amber-950/80 via-neutral-900 to-amber-950/80 border-amber-500 shadow-amber-900/30',
          badgeBg: 'bg-amber-500 text-black shadow-lg shadow-amber-500/40',
          badgeText: '🟠 AUTO EN REPARACIÓN',
          title: '🔧 EN TRABAJO TÉCNICO EN FOSA / ELEVADOR',
          desc: `Nuestros especialistas están trabajando en las reparaciones cotizadas de tu ${p.vehiculoModelo || 'vehículo'}. Alineación, tren delantero, dirección y frenos bajo inspección exhaustiva.`,
          icon: <Wrench className="w-8 h-8 text-amber-400 animate-spin" />,
          actionLabel: '💬 Consultar con Rodrigo por WhatsApp',
          actionUrl: `https://wa.me/5492625532070?text=${encodeURIComponent(
            `Hola Rodrigo! Te consulto por el avance de reparación de mi auto (*${p.patente}* - ${p.vehiculoModelo || ''}).`
          )}`,
        };

      case 'ingreso_taller':
        return {
          step: 3,
          color: 'from-purple-950/80 via-neutral-900 to-purple-950/80 border-purple-500 shadow-purple-900/30',
          badgeBg: 'bg-purple-600 text-white shadow-lg shadow-purple-600/40',
          badgeText: '🟣 AUTO EN EL TALLER',
          title: '🚪 VEHÍCULO INGRESÓ AL TALLER',
          desc: `Tu vehículo (${p.patente}) ya ingresó a nuestras instalaciones de Av. San Juan e Independencia. Se encuentra en boxes listo para dar inicio al desarmado y reparación.`,
          icon: <Car className="w-8 h-8 text-purple-400 animate-pulse" />,
          actionLabel: '💬 Contactar al Taller',
          actionUrl: `https://wa.me/5492625532070?text=${encodeURIComponent(
            `Hola Rodrigo! Te escribo porque mi auto (*${p.patente}*) ya está en el taller. Cualquier novedad avisame.`
          )}`,
        };

      case 'aprobado':
        return {
          step: 2,
          color: 'from-blue-950/80 via-neutral-900 to-blue-950/80 border-blue-500 shadow-blue-900/30',
          badgeBg: 'bg-blue-600 text-white shadow-lg shadow-blue-600/40',
          badgeText: '🔵 PRESUPUESTO APROBADO',
          title: '👍 PRESUPUESTO APROBADO · ESPERANDO INGRESO',
          desc: `Confirmaste la cotización de $${p.total.toLocaleString('es-AR')}. Rodrigo ya reservó los repuestos necesarios y el lugar en boxes para recibir tu auto.`,
          icon: <ShieldCheck className="w-8 h-8 text-blue-400" />,
          actionLabel: 'Ver Detalle del Presupuesto',
          onActionClick: () => onVerPresupuesto(p),
        };

      case 'pendiente':
      default:
        return {
          step: 1,
          color: 'from-amber-950/60 via-neutral-900 to-neutral-950 border-amber-600/60 shadow-amber-900/20',
          badgeBg: 'bg-amber-400 text-black',
          badgeText: '🟡 PRESUPUESTO PENDIENTE',
          title: '📋 REVISÁ Y APROBÁ TU COTIZACIÓN',
          desc: `Rodrigo cargó el presupuesto para tu auto por un total de $${p.total.toLocaleString('es-AR')}. Revisá el detalle de mano de obra y repuestos para darnos el OK y comenzar.`,
          icon: <AlertCircle className="w-8 h-8 text-amber-400" />,
          actionLabel: '✅ Ver y Aprobar Presupuesto',
          onActionClick: () => onVerPresupuesto(p),
        };
    }
  };

  const stage = getStageInfo(p.estado);

  // Lista de 5 etapas para la barra de progreso
  const stepsTimeline = [
    { num: 1, label: 'Presupuestado', icon: '📋' },
    { num: 2, label: 'Aprobado', icon: '👍' },
    { num: 3, label: 'En el Taller', icon: '🚪' },
    { num: 4, label: 'En Reparación', icon: '🔧' },
    { num: 5, label: '¡Listo para Retirar!', icon: '✨' },
  ];

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stage.color} border-2 p-5 sm:p-7 shadow-2xl transition-all duration-300`}>
      {/* Botón rápido de cierre para el cliente si está listo para retirar */}
      {p.estado === 'trabajo_terminado' && (
        <button
          type="button"
          onClick={() => handleConfirmarRetiro(p.id)}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1.5 rounded-lg bg-neutral-950/80 hover:bg-neutral-900 transition-colors cursor-pointer border border-neutral-700/60 z-10 flex items-center gap-1 text-[11px] font-heading uppercase"
          title="Cerrar este cartel porque ya retiré mi vehículo"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Cerrar</span>
        </button>
      )}

      {/* Fondo decorativo de taller con glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-red-600/10 blur-3xl pointer-events-none" />

      {/* Cabecera del Testigo */}
      <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 shadow-inner shrink-0">
            {stage.icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-heading font-black uppercase tracking-widest ${stage.badgeBg}`}>
                {stage.badgeText}
              </span>
              <span className="text-xs font-mono font-bold text-neutral-400">
                Patente: <strong className="text-white font-black text-sm uppercase">{p.patente}</strong>
              </span>
              {p.vehiculoModelo && (
                <span className="text-xs text-neutral-300 font-bold bg-neutral-950/80 px-2.5 py-0.5 rounded border border-neutral-800">
                  🚘 {p.vehiculoModelo}
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-heading font-black text-white uppercase tracking-tight mt-2">
              {stage.title}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-300 mt-1 max-w-2xl leading-relaxed">
              {stage.desc}
            </p>
          </div>
        </div>

        {/* Botones de acción del Testigo */}
        <div className="shrink-0 w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {p.estado === 'trabajo_terminado' ? (
            <>
              <button
                type="button"
                onClick={() => handleConfirmarRetiro(p.id)}
                className="px-4 py-3 rounded-xl bg-neutral-950 hover:bg-neutral-900 text-emerald-400 hover:text-emerald-300 border border-emerald-500/50 font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
                title="Confirmar que ya retiraste el auto para cerrar este aviso de tu pantalla"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Confirmar Retiro (Cerrar)</span>
              </button>
              <a
                href={stage.actionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{stage.actionLabel}</span>
              </a>
            </>
          ) : stage.actionUrl ? (
            <a
              href={stage.actionUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{stage.actionLabel}</span>
            </a>
          ) : (
            <button
              type="button"
              onClick={stage.onActionClick}
              className="px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              <span>{stage.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso de etapas estilo testigo automotor */}
      <div className="relative pt-6">
        <div className="text-[11px] font-heading font-black uppercase tracking-wider text-neutral-400 mb-3 flex items-center justify-between">
          <span>Progreso en el taller en tiempo real:</span>
          <span className="text-white font-mono">Paso {stage.step} de 5</span>
        </div>

        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {stepsTimeline.map((s) => {
            const isCompleted = s.num < stage.step;
            const isCurrent = s.num === stage.step;

            return (
              <div key={s.num} className="flex flex-col items-center text-center">
                {/* Indicador circular / luz testigo */}
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-xs font-mono font-black transition-all ${
                    isCurrent
                      ? 'bg-red-600 text-white ring-4 ring-red-500/30 scale-110 shadow-lg shadow-red-600/50'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-500'
                  }`}
                >
                  {isCompleted ? '✓' : s.icon}
                </div>

                <span
                  className={`text-[10px] sm:text-xs font-heading font-bold uppercase mt-2 line-clamp-1 ${
                    isCurrent
                      ? 'text-white font-black'
                      : isCompleted
                      ? 'text-emerald-400'
                      : 'text-neutral-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Banner especial cuando el auto está listo para retirar */}
        {p.estado === 'trabajo_terminado' && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-950/80 border-2 border-emerald-500/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xl animate-pulse">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <strong className="text-white uppercase font-heading block">
                  Ubicación de retiro del vehículo:
                </strong>
                <span className="text-emerald-200">
                  📍 Av. San Juan e Independencia, General Alvear, Mendoza
                </span>
                <span className="text-neutral-300 block text-[11px] mt-0.5">
                  ⏰ Horarios: Lun a Vie 08:00 a 12:30 y 15:30 a 20:00 / Sáb 08:00 a 13:00 hs.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleConfirmarRetiro(p.id)}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-emerald-900/90 hover:bg-emerald-800 text-white border border-emerald-400 font-heading font-black uppercase text-[11px] tracking-wider transition-colors cursor-pointer shadow-md"
              >
                ✓ Ya lo retiré (Cerrar)
              </button>
              <a
                href="tel:2625532070"
                className="flex-1 sm:flex-none text-center px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-heading font-black uppercase text-[11px] tracking-wider"
              >
                📞 Llamar al Taller
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
