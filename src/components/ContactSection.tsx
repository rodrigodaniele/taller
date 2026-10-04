import { Clock, MapPin, MessageSquare, PhoneCall, ExternalLink } from 'lucide-react';
import { WHATSAPP_LINK, GOOGLE_MAPS_LINK, WHATSAPP_PHONE } from '../services/gasApi';

export const ContactSection = () => {
  return (
    <section id="horarios" className="py-20 lg:py-24 bg-[#080808] border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-red-500 font-heading font-bold mb-2">
            Estamos a tu disposición
          </p>
          <h2 className="text-3xl sm:text-4xl font-heading font-black text-white uppercase tracking-tight">
            Horarios de Atención & Ubicación
          </h2>
          <p className="mt-3 text-sm text-neutral-400">
            Visítanos en nuestro taller en General Alvear o contáctanos por WhatsApp para consultas urgentes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Horarios */}
          <div className="bg-[#050505] p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-800/40 text-red-500 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-white uppercase tracking-wide">
                Horarios de Taller
              </h3>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <span className="text-neutral-400 block text-xs uppercase font-medium">Lunes a Viernes</span>
                  <span className="text-white font-semibold">08:00 a 12:00 hs — 16:00 a 20:00 hs</span>
                </div>
                <div>
                  <span className="text-neutral-400 block text-xs uppercase font-medium">Sábados</span>
                  <span className="text-white font-semibold">08:00 a 12:00 hs</span>
                </div>
                <div>
                  <span className="text-neutral-500 block text-xs uppercase font-medium">Domingos</span>
                  <span className="text-neutral-400 italic">Cerrado por descanso</span>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-900 text-xs text-neutral-400">
              * Los turnos online se programan con al menos 24 hs de anticipación.
            </div>
          </div>

          {/* Ubicación */}
          <div className="bg-[#050505] p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-800/40 text-red-500 flex items-center justify-center mb-4">
                <MapPin className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-white uppercase tracking-wide">
                Ubicación
              </h3>
              <p className="mt-3 text-sm text-neutral-300">
                <strong>La Casa de la Dirección</strong>
                <br />
                Av. San Juan e Independencia, General Alvear, Mendoza.
              </p>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Taller equipado con rampa de alineación computarizada y fosa técnica para atención ágil de autos y utilitarios.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-900">
              <a
                href={GOOGLE_MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs font-heading font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition-colors"
              >
                <span>Abrir en Google Maps</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Contacto Directo */}
          <div className="bg-[#050505] p-6 rounded-xl border border-neutral-800 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-lg bg-red-950/50 border border-red-800/40 text-red-500 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-white uppercase tracking-wide">
                Atención WhatsApp
              </h3>
              <p className="mt-3 text-sm text-neutral-300">
                Línea oficial de consultas y presupuestos:
              </p>
              <p className="mt-1 font-mono text-base font-bold text-white tracking-wide">
                +{WHATSAPP_PHONE}
              </p>
              <p className="mt-2 text-xs text-neutral-400 leading-relaxed">
                Respondemos consultas sobre repuestos, cotizaciones de tren delantero y confirmaciones de citas.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-neutral-900">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all duration-200"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Escribir por WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
