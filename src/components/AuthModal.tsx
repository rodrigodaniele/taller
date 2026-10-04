import { useState, useId } from 'react';
import { X, Lock, Mail, User, Phone, Loader2, ArrowRight } from 'lucide-react';
import { gasApi } from '../services/gasApi';
import { User as UserType } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserType, turnos: any[]) => void;
  onShowToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, desc?: string) => void;
}

export const AuthModal = ({ isOpen, onClose, onLoginSuccess, onShowToast }: AuthModalProps) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Login inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register inputs
  const [regNombre, setRegNombre] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regEmailConfirm, setRegEmailConfirm] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');

  const loginEmailId = useId();
  const loginPasswordId = useId();
  const regNombreId = useId();
  const regTelefonoId = useId();
  const regEmailId = useId();
  const regEmailConfirmId = useId();
  const regPasswordId = useId();
  const regPasswordConfirmId = useId();

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!loginEmail || !loginPassword) {
      setErrorMsg('Por favor completá correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.login(loginEmail, loginPassword);
      if (res.resultado === 'ok' && res.nombre && res.email) {
        onShowToast('success', `¡Bienvenido de nuevo, ${res.nombre}!`, 'Sesión iniciada correctamente.');
        onLoginSuccess(
          {
            nombre: res.nombre,
            telefono: res.telefono || '',
            email: res.email,
          },
          res.turnos || []
        );
        onClose();
      } else {
        setErrorMsg(res.mensaje || 'Credenciales incorrectas o usuario no encontrado.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión con la base de datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regNombre || !regTelefono || !regEmail || !regPassword) {
      setErrorMsg('Por favor completá todos los campos.');
      return;
    }

    if (regEmail.toLowerCase().trim() !== regEmailConfirm.toLowerCase().trim()) {
      setErrorMsg('Los correos electrónicos ingresados no coinciden.');
      return;
    }

    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.register(regNombre, regTelefono, regEmail, regPassword);
      if (res.resultado === 'ok') {
        onShowToast('success', '¡Cuenta creada con éxito!', 'Ya podés iniciar sesión con tus datos.');
        setMode('login');
        setLoginEmail(regEmail);
        setLoginPassword(regPassword);
      } else {
        setErrorMsg(res.mensaje || 'No se pudo crear la cuenta.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl overflow-hidden p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-900 transition-colors"
          aria-label="Cerrar ventana"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Tab switch */}
        <div className="flex border-b border-neutral-800 mb-6 pb-2">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMsg(null);
            }}
            className={`flex-1 text-center pb-2 font-heading font-black text-sm uppercase tracking-wider transition-colors ${
              mode === 'login'
                ? 'text-red-500 border-b-2 border-red-600 -mb-[10px]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 text-center pb-2 font-heading font-black text-sm uppercase tracking-wider transition-colors ${
              mode === 'register'
                ? 'text-red-500 border-b-2 border-red-600 -mb-[10px]'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 rounded bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor={loginEmailId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
                <input
                  id={loginEmailId}
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="ejemplo@correo.com"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor={loginPasswordId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3.5" />
                <input
                  id={loginPasswordId}
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Tu contraseña secreta"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-6 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-heading font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a Mi Cuenta</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-neutral-400 pt-3">
              ¿No tenés cuenta aún?{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="text-red-500 hover:text-red-400 font-semibold underline underline-offset-2"
              >
                Registrate acá
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label htmlFor={regNombreId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Nombre y Apellido
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  id={regNombreId}
                  type="text"
                  required
                  value={regNombre}
                  onChange={(e) => setRegNombre(e.target.value)}
                  placeholder="Ej: Rodrigo Pérez"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor={regTelefonoId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                Teléfono / WhatsApp
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3" />
                <input
                  id={regTelefonoId}
                  type="tel"
                  required
                  value={regTelefono}
                  onChange={(e) => setRegTelefono(e.target.value)}
                  placeholder="Ej: 2625 123456"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={regEmailId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Email
                </label>
                <input
                  id={regEmailId}
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
              <div>
                <label htmlFor={regEmailConfirmId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Confirmar Email
                </label>
                <input
                  id={regEmailConfirmId}
                  type="email"
                  required
                  value={regEmailConfirm}
                  onChange={(e) => setRegEmailConfirm(e.target.value)}
                  placeholder="Repetir email"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={regPasswordId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Contraseña
                </label>
                <input
                  id={regPasswordId}
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
              <div>
                <label htmlFor={regPasswordConfirmId} className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">
                  Confirmar Contraseña
                </label>
                <input
                  id={regPasswordConfirmId}
                  type="password"
                  required
                  value={regPasswordConfirm}
                  onChange={(e) => setRegPasswordConfirm(e.target.value)}
                  placeholder="Repetir contraseña"
                  className="w-full bg-[#111] border border-neutral-800 focus:border-red-600 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-heading font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>Completar Registro</span>
              )}
            </button>

            <p className="text-center text-xs text-neutral-400 pt-2">
              ¿Ya estás registrado?{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="text-red-500 hover:text-red-400 font-semibold underline underline-offset-2"
              >
                Iniciá sesión acá
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
