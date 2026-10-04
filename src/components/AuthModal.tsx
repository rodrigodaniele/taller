import { useState, useEffect, useId } from 'react';
import { X, Lock, Mail, User, Phone, Loader2, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

  // Email verification state
  const [regStep, setRegStep] = useState<'form' | 'verify'>('form');
  const [verificationCode, setVerificationCode] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const loginEmailId = useId();
  const loginPasswordId = useId();
  const regNombreId = useId();
  const regTelefonoId = useId();
  const regEmailId = useId();
  const regEmailConfirmId = useId();
  const regPasswordId = useId();
  const regPasswordConfirmId = useId();

  // Cooldown timer for resending code
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

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

  // Step 1: Send verification code to email
  const handleRequestVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!regNombre.trim() || !regTelefono.trim() || !regEmail.trim() || !regPassword) {
      setErrorMsg('Por favor completá todos los campos requeridos.');
      return;
    }

    if (regEmail.toLowerCase().trim() !== regEmailConfirm.toLowerCase().trim()) {
      setErrorMsg('Los correos electrónicos ingresados no coinciden.');
      return;
    }

    if (regPassword.length < 4) {
      setErrorMsg('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (regPassword !== regPasswordConfirm) {
      setErrorMsg('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.sendVerificationCode(regEmail, regNombre);
      if (res.resultado === 'ok') {
        setRegStep('verify');
        setVerificationCode('');
        setResendCooldown(60);
        onShowToast(
          'info',
          '¡Código de verificación enviado!',
          `Revisá tu casilla de correo ${regEmail} (incluso en la carpeta de Spam).`
        );
      } else {
        setErrorMsg(res.mensaje || 'No se pudo enviar el código de verificación.');
      }
    } catch (err: any) {
      setErrorMsg(
        err.message ||
          'Error al conectar con el servidor. Si no actualizaste el script de Google Sheets, recordá copiar la nueva versión desde el Panel de Administración.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm code and register user
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanCode = verificationCode.replace(/\D/g, '').trim();
    if (cleanCode.length !== 6) {
      setErrorMsg('Por favor ingresá el código de 6 dígitos que recibiste por correo.');
      return;
    }

    setLoading(true);
    try {
      const res = await gasApi.register(
        regNombre,
        regTelefono,
        regEmail,
        regPassword,
        cleanCode
      );

      if (res.resultado === 'ok') {
        onShowToast(
          'success',
          '¡Cuenta verificada y creada con éxito!',
          'Iniciando tu sesión automáticamente...'
        );

        // Auto login for seamless user experience
        try {
          const loginRes = await gasApi.login(regEmail, regPassword);
          if (loginRes.resultado === 'ok' && loginRes.nombre) {
            onLoginSuccess(
              {
                nombre: loginRes.nombre,
                telefono: loginRes.telefono || regTelefono,
                email: loginRes.email || regEmail,
              },
              loginRes.turnos || []
            );
            onClose();
            return;
          }
        } catch (e) {
          console.warn('Auto login warning:', e);
        }

        // Fallback to login tab with prefilled credentials
        setMode('login');
        setRegStep('form');
        setLoginEmail(regEmail);
        setLoginPassword(regPassword);
      } else {
        setErrorMsg(res.mensaje || 'Código incorrecto o vencido. Por favor verificá o solicitá uno nuevo.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || loading) return;
    setErrorMsg(null);
    setLoading(true);
    try {
      const res = await gasApi.sendVerificationCode(regEmail, regNombre);
      if (res.resultado === 'ok') {
        setResendCooldown(60);
        onShowToast('info', 'Código reenviado', `Enviamos un nuevo código a ${regEmail}.`);
      } else {
        setErrorMsg(res.mensaje || 'No se pudo reenviar el código.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-md bg-[#0a0a0a] border-2 border-red-600 rounded-xl shadow-2xl overflow-y-auto max-h-[92vh] sm:max-h-[88vh] my-auto p-6 sm:p-8 overscroll-contain">
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
                onClick={() => {
                  setMode('register');
                  setRegStep('form');
                  setErrorMsg(null);
                }}
                className="text-red-500 hover:text-red-400 font-semibold underline underline-offset-2"
              >
                Registrate acá
              </button>
            </p>
          </form>
        ) : regStep === 'verify' ? (
          /* PASO 2: VALIDAR CÓDIGO ENVIADO AL CORREO */
          <form onSubmit={handleVerifyAndRegister} className="space-y-4 animate-in fade-in duration-200">
            <div className="text-center py-1">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-950/60 border border-red-600/60 flex items-center justify-center text-red-500 mb-2.5 shadow-lg shadow-red-600/20">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="font-heading font-black text-lg text-white uppercase tracking-tight">
                Validá tu Correo Electrónico
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Enviamos un código de seguridad de 6 dígitos a:
              </p>
              <div className="mt-1.5 font-mono text-xs font-bold text-white bg-neutral-900 border border-neutral-800 px-3 py-1 rounded inline-block">
                {regEmail}
              </div>
            </div>

            <div>
              <label htmlFor="codigo-verif" className="block text-xs font-heading font-bold uppercase tracking-wider text-neutral-300 mb-2 text-center">
                Ingresá el Código de 6 Dígitos
              </label>
              <input
                id="codigo-verif"
                type="text"
                required
                maxLength={6}
                autoFocus
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-[#111] border-2 border-red-600/70 focus:border-red-500 focus:outline-none rounded-lg py-3 text-center text-2xl font-mono font-black text-white tracking-[8px] placeholder-neutral-700 transition-colors"
              />
              <p className="text-[11px] text-neutral-400 text-center mt-2 leading-relaxed">
                ✉️ Revisá tu casilla de correo. Si no lo ves en Recibidos, fijate en la carpeta <strong>Spam o Correo No Deseado</strong>.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full mt-2 py-3 px-4 rounded-lg bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white font-heading font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando y creando cuenta...</span>
                </>
              ) : (
                <span>Validar Código y Activar Cuenta</span>
              )}
            </button>

            <div className="flex items-center justify-between text-xs pt-3 border-t border-neutral-900">
              <button
                type="button"
                onClick={() => {
                  setRegStep('form');
                  setErrorMsg(null);
                }}
                className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Corregir datos o email</span>
              </button>

              <button
                type="button"
                disabled={resendCooldown > 0 || loading}
                onClick={handleResendCode}
                className="text-red-500 hover:text-red-400 font-semibold disabled:text-neutral-600 transition-colors"
              >
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </form>
        ) : (
          /* PASO 1: CARGAR DATOS PARA REGISTRO */
          <form onSubmit={handleRequestVerificationCode} className="space-y-3.5">
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
                  <span>Enviando código de verificación...</span>
                </>
              ) : (
                <>
                  <span>Continuar y Validar Email</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-neutral-400 pt-2">
              ¿Ya estás registrado?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setRegStep('form');
                  setErrorMsg(null);
                }}
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
