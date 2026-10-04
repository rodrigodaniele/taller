import { Wrench, MapPin, Phone, MessageSquare } from 'lucide-react';
import { WHATSAPP_LINK, GOOGLE_MAPS_LINK, WHATSAPP_PHONE } from '../services/gasApi';

export const Footer = () => {
  return (
    <footer className="bg-[#040404] border-t border-neutral-900 text-neutral-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-red-600 flex items-center justify-center text-white">
                <Wrench className="w-4 h-4" />
              </div>
              <span className="font-heading font-black text-lg text-white uppercase tracking-wider">
                La Casa de la Dirección
              </span>
            </div>
            <p className="text-neutral-400 max-w-sm text-xs leading-relaxed">
              Taller mecánico de alta precisión especializado en alineación computarizada 3D, balanceo digital y reparación integral de tren delantero y suspensión.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-2">
            <h4 className="font-heading font-bold text-white text-xs uppercase tracking-wider mb-3">
              Navegación
            </h4>
            <div>
              <a href="#servicios" className="hover:text-red-400 transition-colors">
                Servicios Técnicos
              </a>
            </div>
            <div>
              <a href="#quienes-somos" className="hover:text-red-400 transition-colors">
                Quiénes Somos
              </a>
            </div>
            <div>
              <a href="#horarios" className="hover:text-red-400 transition-colors">
                Horarios & Taller
              </a>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <h4 className="font-heading font-bold text-white text-xs uppercase tracking-wider mb-3">
              Contacto
            </h4>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <a
                href={GOOGLE_MAPS_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-red-400 transition-colors"
              >
                General Alvear, Mendoza
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <span className="font-mono">+{WHATSAPP_PHONE}</span>
            </div>
            <div className="pt-2">
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Atención por WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-900 pt-6 flex flex-wrap items-center justify-between gap-4 text-[11px] text-neutral-400">
          <div>
            © {new Date().getFullYear()} La Casa de la Dirección. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>General Alvear · Mendoza · Argentina</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
