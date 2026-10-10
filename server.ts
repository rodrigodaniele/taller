import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configuración de CORS y cabeceras para máxima compatibilidad con Safari iOS y navegadores móviles
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, Origin');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const SYSTEM_INSTRUCTION = `Sos el Asistente Mecánico Virtual Oficial de "La Casa de la Dirección", un taller mecánico de máxima confianza y tecnología de punta en General Alvear, Mendoza, Argentina.
Tu misión es asesorar a los clientes y conductores que visitan la página web.

ESPECIALIDAD DEL TALLER:
- Tren Delantero y Suspensión de precisión (rótulas, extremos de dirección, precaps/axiales, bujes de parrilla, barras estabilizadoras, cazoletas, amortiguadores).
- Dirección de todo tipo (cremalleras mecánicas e hidráulicas, bombas de dirección hidráulica, fuelles de semieje y cremallera).
- Alineación 3D Láser Computarizada de última generación.
- Balanceo Dinámico Digital de ruedas.
- Sistema de Frenos (revisión de pastillas, discos, cintas, rectificación).

UBICACIÓN Y CONTACTO:
- Taller ubicado en General Alvear, Mendoza, Argentina.
- WhatsApp directo de atención: +54 9 2625 53-2070.
- Atención: Lunes a Viernes de 8:00 a 12:30 y de 15:30 a 20:00, y Sábados por la mañana.

FORMAS DE PAGO:
- Efectivo en mostrador.
- Transferencia bancaria.
- Tarjetas de débito y crédito.
- Mercado Pago (dinero en cuenta y hasta cuotas según promociones).
- Cuenta Corriente: disponible para clientes habituales del taller con previo acuerdo o entrega de seña inicial.

RESERVA DE TURNOS:
- Los clientes pueden agendar su turno directamente desde esta página web (haciendo clic en "Sacar Turno" o "Reservar") eligiendo día y horario disponible, o consultando por WhatsApp.

TONO Y ESTILO DE RESPUESTA:
- Hablá en español argentino natural (usá "vos", "fijate", "podés", "tenés", etc.), cálido, servicial y profesional.
- Explicá en lenguaje claro y accesible, pero con criterio mecánico preciso.
- Cuando el cliente describa un síntoma (ruido a golpe seco, vibración a cierta velocidad, chillido al doblar, volante desviado, etc.), explicale las causas más probables con fundamentos técnicos sencillos.
- Aclará siempre con responsabilidad que el tren delantero y la dirección son elementos vitales para la seguridad vial de la familia, por lo que una revisión física en la fosa del taller es indispensable para un diagnóstico certero.
- Al final de tu explicación, invitalo amablemente a reservar un turno desde la web o a escribir al WhatsApp del taller para revisarlo cuanto antes.
- Respuestas concisas, bien estructuradas con viñetas cuando sea útil, sin textos interminables ni lenguaje aburrido.`;

// Endpoint para el asistente de IA
app.post('/api/chat-asistente', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Falta el historial de mensajes.' });
    }

    // Adaptar mensajes al formato de generateContent
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || '') }],
    }));

    let reply = '';
    const modelsToTry = ['gemini-3.8-flash', 'gemini-flash-latest'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.7,
          },
        });
        if (response.text) {
          reply = response.text;
          break;
        }
      } catch (err: any) {
        console.warn(`Error con modelo ${modelName}, intentando alternativa:`, err?.message || err);
        lastError = err;
      }
    }

    if (!reply) {
      if (lastError) throw lastError;
      reply = 'Disculpame, no pude generar una respuesta en este momento. Podés consultarnos directamente por WhatsApp o intentar de nuevo en unos instantes.';
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error('Error en /api/chat-asistente:', error);
    return res.status(500).json({
      error: 'Hubo un inconveniente al consultar el asistente. Por favor, intentá nuevamente o comunicate por WhatsApp.',
      details: error?.message,
    });
  }
});

// Manejo de Vite en desarrollo y archivos estáticos en producción
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor de La Casa de la Dirección escuchando en el puerto ${port}`);
  });
}

startServer();
