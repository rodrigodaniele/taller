import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Wrench,
  X,
  Send,
  Calendar,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Phone
} from 'lucide-react';
import { WHATSAPP_LINK } from '../services/gasApi';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AiAssistantBubbleProps {
  onScheduleClick?: () => void;
}

const PREGUNTAS_RAPIDAS = [
  '🚗 Siento un golpe seco al pasar pozos o lomas',
  '🔄 El volante me vibra a más de 80 km/h',
  '🔧 El auto me tira hacia un costado al soltar el volante',
  '💳 ¿Qué formas y medios de pago reciben?',
  '📅 ¿Cómo reservo un turno para revisar el auto?'
];

export const AiAssistantBubble: React.FC<AiAssistantBubbleProps> = ({ onScheduleClick }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        '¡Hola! 👋 Soy el **Asistente Mecánico Virtual** de **La Casa de la Dirección**.\n\n¿Sentís algún ruido raro en el auto, vibración en el volante o querés saber sobre alineación y tren delantero? Contame qué le pasa a tu vehículo y te oriento, o preguntame sobre turnos y medios de pago.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setShowTooltip(false);
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 150);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, cargando]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleEnviar = async (textoAEnviar?: string) => {
    const texto = (textoAEnviar || input).trim();
    if (!texto || cargando) return;

    const userMsg: Message = {
      id: 'usr-' + Date.now(),
      role: 'user',
      content: texto,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nuevosMensajes = [...messages, userMsg];
    setMessages(nuevosMensajes);
    setInput('');
    setCargando(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch('/api/chat-asistente', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          messages: nuevosMensajes.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorDetalle = '';
        try {
          const errData = await response.json();
          errorDetalle = errData.error || errData.details || '';
        } catch {}
        throw new Error(errorDetalle || `Error ${response.status}`);
      }

      const data = await response.json();
      const botMsg: Message = {
        id: 'bot-' + Date.now(),
        role: 'assistant',
        content: data.reply || 'Disculpame, ocurrió un inconveniente. Por favor intentá de nuevo.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.warn('Error al consultar el asistente IA:', error?.message || error);
      const errorMsg: Message = {
        id: 'err-' + Date.now(),
        role: 'assistant',
        content: `Hubo una interrupción en la conexión (${error?.message || 'Error de red'}). Podés tocar en "Reintentar", consultar directamente por WhatsApp o intentar de nuevo en unos segundos.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setCargando(false);
    }
  };

  const handleReiniciar = () => {
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content:
          '¡Conversación reiniciada! 🔧 Contame qué síntoma tiene tu vehículo o qué duda tenés sobre nuestro taller y te ayudo.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleReintentar = () => {
    const ultimoUsuario = [...messages].reverse().find((m) => m.role === 'user');
    if (ultimoUsuario) {
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('err-')));
      handleEnviar(ultimoUsuario.content);
    }
  };

  const formatearTexto = (texto: string) => {
    // Parser sencillo para negritas y saltos de línea
    const partes = texto.split('\n');
    return partes.map((linea, lIdx) => {
      // Manejar viñetas
      const esItemLista = linea.trim().startsWith('- ') || linea.trim().startsWith('* ');
      const textoLimpio = esItemLista ? linea.trim().substring(2) : linea;

      // Reemplazo de **negrita**
      const fragmentos = textoLimpio.split(/(\*\*.*?\*\*)/g);
      const renderizado = fragmentos.map((f, fIdx) => {
        if (f.startsWith('**') && f.endsWith('**')) {
          return (
            <strong key={fIdx} className="font-semibold text-white">
              {f.slice(2, -2)}
            </strong>
          );
        }
        return f;
      });

      if (esItemLista) {
        return (
          <li key={lIdx} className="ml-4 list-disc text-neutral-300 my-1">
            {renderizado}
          </li>
        );
      }

      if (!linea.trim()) {
        return <div key={lIdx} className="h-2" />;
      }

      return (
        <p key={lIdx} className="my-1 text-neutral-200 leading-relaxed">
          {renderizado}
        </p>
      );
    });
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 select-none">
      {/* TOOLTIP INICIAL PROVOCATIVO (se puede cerrar o se oculta al abrir) */}
      {!isOpen && showTooltip && (
        <div className="absolute bottom-16 right-0 mb-2 w-64 bg-neutral-900/95 border border-red-500/40 text-neutral-100 p-3 rounded-2xl shadow-2xl backdrop-blur-md animate-bounce flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-red-600/20 text-red-400 shrink-0 mt-0.5">
            <Sparkles className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-semibold text-white">¿Tenés dudas con tu auto?</p>
            <p className="text-neutral-400 mt-0.5">Consultale a nuestro Asistente Mecánico Virtual con IA.</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-neutral-500 hover:text-neutral-300 p-0.5"
            aria-label="Cerrar sugerencia"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* VENTANA DEL CHAT */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[92vw] sm:w-[410px] h-[560px] max-h-[82vh] bg-[#0c0d0e]/95 border border-neutral-800 rounded-3xl shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden transition-all duration-300 ring-1 ring-white/10">
          {/* HEADER */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-red-950/40 border-b border-neutral-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-950/50 border border-red-400/30">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-wide">Asistente Mecánico</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-semibold border border-red-500/30">
                    IA
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 flex items-center gap-1">
                  <span>La Casa de la Dirección</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">Online</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleReiniciar}
                title="Reiniciar conversación"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Minimizar"
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* MENSAJES */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm scrollbar-thin scrollbar-thumb-neutral-800">
            {messages.map((m) => {
              const isBot = m.role === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-md ${
                      isBot
                        ? 'bg-neutral-900/95 border border-neutral-800 text-neutral-200 rounded-tl-sm'
                        : 'bg-gradient-to-r from-red-600 to-red-700 text-white font-medium rounded-tr-sm shadow-red-950/40'
                    }`}
                  >
                    {isBot ? formatearTexto(m.content) : <p className="leading-relaxed">{m.content}</p>}

                    {/* Botones contextuales en mensajes del Asistente */}
                    {isBot && m.id !== 'welcome' && (
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex flex-wrap gap-2">
                        {m.id.startsWith('err-') && (
                          <button
                            onClick={handleReintentar}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold shadow-sm transition-all border border-neutral-700"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-red-400" />
                            Reintentar Consulta
                          </button>
                        )}
                        {onScheduleClick && !m.id.startsWith('err-') && (
                          <button
                            onClick={() => {
                              setIsOpen(false);
                              onScheduleClick();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-sm transition-all"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            Sacar Turno en el Taller
                          </button>
                        )}
                        <a
                          href={WHATSAPP_LINK}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Consultar por WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 px-1 mt-1 font-mono">
                    {m.timestamp}
                  </span>
                </div>
              );
            })}

            {/* SPINNER DE RESPUESTA */}
            {cargando && (
              <div className="flex items-center gap-2 p-3 max-w-[70%] bg-neutral-900/90 border border-neutral-800 rounded-2xl rounded-tl-sm text-neutral-400 text-xs">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="text-neutral-300 font-medium">Analizando...</span>
              </div>
            )}

            {/* PREGUNTAS SUGERIDAS (solo si hay pocos mensajes) */}
            {messages.length <= 2 && !cargando && (
              <div className="pt-2 space-y-1.5">
                <p className="text-[11px] text-neutral-500 font-semibold uppercase tracking-wider px-1">
                  Consultas frecuentes:
                </p>
                <div className="flex flex-col gap-1.5">
                  {PREGUNTAS_RAPIDAS.map((pregunta, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleEnviar(pregunta)}
                      className="text-left text-xs text-neutral-300 bg-neutral-900/70 hover:bg-neutral-800/90 hover:text-white border border-neutral-800/80 hover:border-neutral-700 rounded-xl px-3 py-2 transition-all flex items-center justify-between group"
                    >
                      <span>{pregunta}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-red-400 transition-colors shrink-0 ml-1.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* FOOTER / INPUT */}
          <div className="p-3 bg-neutral-900/90 border-t border-neutral-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEnviar();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describí el ruido o consultá por turnos..."
                className="flex-1 bg-neutral-950 border border-neutral-800 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-neutral-500 outline-none transition-all disabled:opacity-50"
                readOnly={cargando}
              />
              <button
                type="submit"
                disabled={!input.trim() || cargando}
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:hover:bg-red-600 text-white font-medium shadow-md shadow-red-950/40 transition-all shrink-0"
                aria-label="Enviar mensaje"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] text-neutral-500">
              <ShieldCheck className="w-3 h-3 text-neutral-600" />
              <span>Orientación mecánica con IA • La Casa de la Dirección</span>
            </div>
          </div>
        </div>
      )}

      {/* BOTÓN FLOTANTE PRINCIPAL (BURBUJA) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-950 border border-neutral-700/80 hover:border-red-500 text-white shadow-2xl shadow-black/80 flex items-center justify-center transition-all duration-300 transform hover:scale-105 active:scale-95 ring-2 ring-red-500/20 hover:ring-red-500/50"
        aria-label="Abrir asistente de IA"
      >
        {/* Glow de fondo */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-600/30 to-red-900/30 blur-md opacity-75 group-hover:opacity-100 transition-opacity" />

        <div className="relative flex items-center justify-center">
          {isOpen ? (
            <X className="w-7 h-7 text-white transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <>
              <Wrench className="w-6 h-6 text-red-500 transform -rotate-12" />
              <Sparkles className="w-4 h-4 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
            </>
          )}
        </div>

        {/* Punto verde de conexión */}
        {!isOpen && (
          <span className="absolute top-1.5 right-1.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-900 rounded-full shadow-sm" />
        )}
      </button>
    </div>
  );
};
