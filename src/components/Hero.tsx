import { Calendar, MessageSquare, MapPin, ChevronRight, ShieldCheck, Cpu, Gauge } from 'lucide-react';
import { WHATSAPP_LINK, GOOGLE_MAPS_LINK } from '../services/gasApi';

interface HeroProps {
  onScheduleClick: () => void;
  isLoggedIn: boolean;
}

export const Hero = ({ onScheduleClick, isLoggedIn }: HeroProps) => {
  return (
    <section className="relative min-h-[640px] lg:min-h-[720px] flex items-center justify-center overflow-hidden border-b border-neutral-800">
      {/* Background with automotive imagery & measured scrim */}
      <div className="absolute inset-0 z-0">
        <img
          src="/src/assets/images/hero_workshop_header_1791116593992.jpg"
          alt="Taller La Casa de la Dirección"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center filter brightness-[0.45] contrast-[1.1]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/75 to-transparent" />
        <div className="absolute inset-0 bg-radial-[at_top_right] from-red-950/30 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 text-center flex flex-col items-center">
        {/* Subtle eyebrow trust label */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-red-600/40 bg-red-950/30 text-red-400 text-xs uppercase tracking-widest font-heading font-bold mb-6">
          <MapPin className="w-3.5 h-3.5" />
          <span>General Alvear, Mendoza</span>
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-black text-white uppercase tracking-tight max-w-4xl leading-[1.08] [text-wrap:balance]">
          Especialistas en <span className="text-red-600">Alineación 3D</span>, Balanceo y Tren Delantero
        </h1>

        <p className="mt-6 text-base sm:text-lg text-neutral-300 max-w-2xl font-normal leading-relaxed [text-wrap:balance]">
          Equipamiento de última generación y precisión milimétrica para la máxima estabilidad, seguridad y rendimiento de tu vehículo en ruta y ciudad.
        </p>

        {/* Action Button Grid */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4 w-full max-w-xl">
          <button
            onClick={onScheduleClick}
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-heading font-extrabold uppercase tracking-wider text-sm rounded shadow-lg shadow-red-600/30 transition-all duration-200"
          >
            <Calendar className="w-5 h-5" />
            <span>{isLoggedIn ? 'Reservar Turno' : 'Solicitar Turno'}</span>
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>

          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white border border-neutral-700 hover:border-red-600/50 font-heading font-bold uppercase tracking-wider text-sm rounded transition-all duration-200"
          >
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <span>Consultar WhatsApp</span>
          </a>
        </div>

        {/* Secondary quick links */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-xs text-neutral-400">
          <a
            href="#servicios"
            className="hover:text-red-400 transition-colors inline-flex items-center gap-1.5"
          >
            Ver catálogo de servicios
          </a>
          <span>·</span>
          <a
            href={GOOGLE_MAPS_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-red-400 transition-colors inline-flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            Cómo llegar al taller
          </a>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl text-left">
          <div className="p-5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-500 mb-3">
              <Cpu className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase tracking-wide">
              Tecnología Láser 3D
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-normal">
              Lectura computarizada en tiempo real de comba, caster y convergencia.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-500 mb-3">
              <Gauge className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase tracking-wide">
              Balanceo Dinámico Digital
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-normal">
              Eliminación total de vibraciones en volante y tren rodante a cualquier velocidad.
            </p>
          </div>

          <div className="p-5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 backdrop-blur-sm">
            <div className="w-9 h-9 rounded bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-500 mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase tracking-wide">
              Historial Digital de Tu Auto
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-normal">
              Registro completo de cada reparación, kilómetros y trabajo realizado.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
