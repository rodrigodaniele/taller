import { User, ShieldAlert, LogOut, UserCircle2, Wrench } from 'lucide-react';
import { User as UserType } from '../types';
import { EMAIL_ADMIN_OFICIAL } from '../services/gasApi';

interface NavbarProps {
  user: UserType | null;
  onOpenAuth: () => void;
  onOpenAdmin: () => void;
  onOpenDashboard: () => void;
  onLogout: () => void;
  activeView: 'home' | 'client' | 'admin';
  setActiveView: (view: 'home' | 'client' | 'admin') => void;
}

export const Navbar = ({
  user,
  onOpenAuth,
  onOpenAdmin,
  onOpenDashboard,
  onLogout,
  activeView,
  setActiveView,
}: NavbarProps) => {
  const isAdmin = user && user.email.toLowerCase().trim() === EMAIL_ADMIN_OFICIAL.toLowerCase().trim();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-[#080808]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setActiveView('home')}
          className="flex items-center gap-3 text-left group focus:outline-none"
        >
          <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white font-heading font-black text-xl shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <span className="font-heading text-lg sm:text-xl font-black uppercase tracking-wider text-white group-hover:text-red-500 transition-colors block leading-tight">
              La Casa de la Dirección
            </span>
            <span className="text-[11px] uppercase tracking-widest text-neutral-400 font-medium hidden sm:block">
              Alineación 3D · Balanceo · Tren Delantero
            </span>
          </div>
        </button>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold tracking-wide text-neutral-300">
          <a
            href="#servicios"
            onClick={() => setActiveView('home')}
            className="hover:text-red-500 transition-colors py-1"
          >
            Servicios
          </a>
          <a
            href="#quienes-somos"
            onClick={() => setActiveView('home')}
            className="hover:text-red-500 transition-colors py-1"
          >
            Quiénes Somos
          </a>
          <a
            href="#horarios"
            onClick={() => setActiveView('home')}
            className="hover:text-red-500 transition-colors py-1"
          >
            Horarios & Ubicación
          </a>
          <a
            href="https://wa.me/5492625532070/?text=Hola!%20Quiero%20consultar%20por%20un%20turno%20en%20La%20Casa%20de%20la%20Dirección"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-red-500 transition-colors py-1"
          >
            WhatsApp
          </a>
        </nav>

        {/* Zone 3: Primary actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={onOpenAdmin}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-md border transition-all duration-200 ${
                    activeView === 'admin'
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                      : 'bg-neutral-900 text-red-400 border-red-600/50 hover:bg-neutral-800'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span className="hidden sm:inline">Panel Admin</span>
                </button>
              )}

              <button
                onClick={onOpenDashboard}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-heading font-bold uppercase tracking-wider rounded-md border transition-all duration-200 ${
                  activeView === 'client'
                    ? 'bg-neutral-100 text-neutral-900 border-white'
                    : 'bg-neutral-900 text-neutral-200 border-neutral-700 hover:bg-neutral-800'
                }`}
              >
                <UserCircle2 className="w-4 h-4 text-red-500" />
                <span className="max-w-[120px] truncate">{user.nombre.split(' ')[0]}</span>
              </button>

              <button
                onClick={onLogout}
                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-900 rounded-md transition-colors"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-heading font-extrabold uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-md shadow-lg shadow-red-600/25 transition-all duration-200 whitespace-nowrap"
            >
              <User className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
