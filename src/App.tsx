import { useState, useEffect } from 'react';
import { User, Turno } from './types';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { ServicesSection } from './components/ServicesSection';
import { AboutSection } from './components/AboutSection';
import { ContactSection } from './components/ContactSection';
import { ClientDashboard } from './components/ClientDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { Footer } from './components/Footer';
import { EMAIL_ADMIN_OFICIAL } from './services/gasApi';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [activeView, setActiveView] = useState<'home' | 'client' | 'admin'>('home');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Load session from localStorage on startup
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('lacasadeladireccion_user');
      const savedTurnos = localStorage.getItem('lacasadeladireccion_turnos');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      if (savedTurnos) {
        setTurnos(JSON.parse(savedTurnos));
      }

      // Reconciliación automática de fechas para asegurar sincronía perfecta en stock y turnos
      const stockSaved = localStorage.getItem('taller_stock_v1');
      if (stockSaved) {
        let stockList = JSON.parse(stockSaved);
        let mod = false;
        stockList = stockList.map((item: any) => {
          if (item.ultimoMovimiento === '2026-10-06' || item.ultimoMovimiento === '06/10/2026') {
            mod = true;
            return { ...item, ultimoMovimiento: '2026-10-07' };
          }
          return item;
        });
        if (mod) {
          localStorage.setItem('taller_stock_v1', JSON.stringify(stockList));
        }
      }
    } catch (e) {
      console.error('Error al restaurar sesión:', e);
    }
  }, []);

  const showToast = (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    description?: string
  ) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, type, title, description }]);
    setTimeout(() => {
      dismissToast(id);
    }, 4500);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (newUser: User, userTurnos: Turno[]) => {
    setUser(newUser);
    setTurnos(userTurnos);
    try {
      localStorage.setItem('lacasadeladireccion_user', JSON.stringify(newUser));
      localStorage.setItem('lacasadeladireccion_turnos', JSON.stringify(userTurnos));
    } catch (e) {
      console.error(e);
    }

    const isAdmin = newUser.email.toLowerCase().trim() === EMAIL_ADMIN_OFICIAL.toLowerCase().trim();
    if (isAdmin) {
      setActiveView('admin');
    } else {
      setActiveView('client');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTurnos([]);
    try {
      localStorage.removeItem('lacasadeladireccion_user');
      localStorage.removeItem('lacasadeladireccion_turnos');
    } catch (e) {
      console.error(e);
    }
    setActiveView('home');
    showToast('info', 'Sesión cerrada', 'Has salido de tu cuenta.');
  };

  const handleScheduleClick = () => {
    if (!user) {
      setIsAuthOpen(true);
      showToast('info', 'Iniciá sesión o registrate', 'Para agendar un turno necesitamos tus datos.');
    } else {
      setActiveView('client');
    }
  };

  const isAdmin = user && user.email.toLowerCase().trim() === EMAIL_ADMIN_OFICIAL.toLowerCase().trim();

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-neutral-100 selection:bg-red-600 selection:text-white">
      <Navbar
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onOpenAdmin={() => setActiveView('admin')}
        onOpenDashboard={() => setActiveView('client')}
        onLogout={handleLogout}
        activeView={activeView}
        setActiveView={setActiveView}
      />

      <main className="flex-1">
        {activeView === 'admin' && isAdmin ? (
          <AdminDashboard
            onBackToHome={() => setActiveView('home')}
            onShowToast={showToast}
          />
        ) : activeView === 'client' && user ? (
          <ClientDashboard
            user={user}
            initialTurnos={turnos}
            onBackToHome={() => setActiveView('home')}
            onShowToast={showToast}
          />
        ) : (
          <>
            <Hero
              onScheduleClick={handleScheduleClick}
              isLoggedIn={!!user}
            />
            <ServicesSection onScheduleClick={handleScheduleClick} />
            <AboutSection />
            <ContactSection />
          </>
        )}
      </main>

      <Footer />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onShowToast={showToast}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
