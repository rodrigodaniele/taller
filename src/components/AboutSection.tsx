import { Award, Wrench, ShieldCheck, Clock } from 'lucide-react';
import { GOOGLE_MAPS_LINK } from '../services/gasApi';

export const AboutSection = () => {
  return (
    <section id="quienes-somos" className="py-20 lg:py-28 bg-[#050505] border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Text block */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-red-500 font-heading font-bold">
              <span>Compromiso y Trayectoria</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-heading font-black text-white uppercase tracking-tight [text-wrap:balance]">
              Quiénes Somos en <span className="text-red-600">La Casa de la Dirección</span>
            </h2>

            <p className="text-neutral-300 text-base leading-relaxed">
              En <strong>La Casa de la Dirección</strong> nos dedicamos de forma profesional, técnica y honesta al cuidado y mantenimiento automotriz en <strong>General Alvear, Mendoza</strong>. Contamos con equipamiento tecnológico computarizado de vanguardia para garantizar que tu auto o camioneta ruede con total estabilidad y seguridad.
            </p>

            <p className="text-neutral-400 text-sm leading-relaxed">
              Sabemos el valor de tu tiempo y de tu vehículo. Por eso implementamos un sistema digital transparente donde cada cliente puede reservar su turno con antelación y acceder en cualquier momento al registro histórico de todas las reparaciones, repuestos y kilometrajes atendidos en nuestro taller.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
              <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
                <div className="p-2 rounded bg-red-950/60 text-red-500 border border-red-800/40 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-white text-sm uppercase">Tecnología Calibrada</h4>
                  <p className="text-xs text-neutral-400 mt-1">Sensores 3D con tolerancias estrictas para cada marca y modelo.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
                <div className="p-2 rounded bg-red-950/60 text-red-500 border border-red-800/40 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-white text-sm uppercase">Mecánica Especializada</h4>
                  <p className="text-xs text-neutral-400 mt-1">Inspección de bujes, extremos, axiales y amortiguación integral.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
                <div className="p-2 rounded bg-red-950/60 text-red-500 border border-red-800/40 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-white text-sm uppercase">Garantía en Trabajos</h4>
                  <p className="text-xs text-neutral-400 mt-1">Repuestos de calidad y mano de obra respaldada por experiencia.</p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-neutral-900/60 border border-neutral-800 flex items-start gap-3.5">
                <div className="p-2 rounded bg-red-950/60 text-red-500 border border-red-800/40 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-heading font-bold text-white text-sm uppercase">Turnos Puntuales</h4>
                  <p className="text-xs text-neutral-400 mt-1">Horarios asignados respetados para que no pierdas el día.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Side Graphic / Info card */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 p-8 shadow-2xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

              <h3 className="font-heading font-black text-2xl text-white uppercase tracking-wider mb-4 border-b border-neutral-800 pb-3">
                ¿Por qué es vital alinear y balancear?
              </h3>

              <div className="space-y-4 text-sm text-neutral-300">
                <div className="flex gap-3 items-start">
                  <span className="font-mono text-xs font-bold text-red-500 bg-red-950/50 px-2 py-0.5 rounded border border-red-900/50">01</span>
                  <p><strong className="text-white">Mayor vida útil del neumático:</strong> Un rodado desalineado puede destruir una cubierta nueva en apenas 5.000 kilómetros.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="font-mono text-xs font-bold text-red-500 bg-red-950/50 px-2 py-0.5 rounded border border-red-900/50">02</span>
                  <p><strong className="text-white">Estabilidad en frenadas de emergencia:</strong> Evita que el auto se cruce de carril ante una frenada brusca en ruta.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="font-mono text-xs font-bold text-red-500 bg-red-950/50 px-2 py-0.5 rounded border border-red-900/50">03</span>
                  <p><strong className="text-white">Ahorro comprobado de nafta/gasoil:</strong> Reduce la resistencia al avance del tren de rodaje.</p>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-neutral-800">
                <a
                  href={GOOGLE_MAPS_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
                >
                  <span>Ver ubicación en Google Maps</span>
                  <span>→</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
