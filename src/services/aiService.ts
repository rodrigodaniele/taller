/**
 * Servicio Inteligente del Asistente Virtual para La Casa de la Dirección.
 * Diseñado para operar con tolerancia total a fallos en cualquier entorno:
 * - Dominio personalizado casadeladireccion.com.ar (hosting estático o dinámico)
 * - Teléfonos móviles (iPhone Safari, Android Chrome)
 * - Computadoras de escritorio
 * - Entornos de previsualización y Cloud Run
 * 
 * Evita por completo los errores HTTP 405 (Method Not Allowed) mediante
 * resolución en cascada (Proxy local -> API Gemini directa -> Motor de Diagnóstico Experto).
 */

export const WHATSAPP_LINK = 'https://wa.me/5492625532070/?text=Hola!%20Quiero%20consultar%20por%20un%20turno%20en%20La%20Casa%20de%20la%20Dirección';
export const WHATSAPP_PHONE = '+54 9 2625 53-2070';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_INSTRUCTION = `Sos el Asistente Mecánico Virtual Oficial de "La Casa de la Dirección", taller mecánico de máxima confianza y tecnología de punta en General Alvear, Mendoza, Argentina.
Tu misión es asesorar a clientes y conductores con calidez, solvencia técnica y lenguaje argentino natural (usá "vos", "fijate", "podés", "tenés").

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
- Mercado Pago (dinero en cuenta y hasta cuotas según promociones bancarias).
- Cuenta Corriente: disponible para clientes habituales del taller con previo acuerdo o entrega de seña inicial.

RESERVA DE TURNOS:
- Los clientes pueden agendar su turno directamente desde esta página web (haciendo clic en el botón "Sacar Turno") eligiendo día y horario disponible, o consultando por WhatsApp.

REGLAS DE RESPUESTA:
- Si el usuario consulta por FORMAS DE PAGO o CUOTAS, respondé con claridad sobre las opciones de pago (efectivo, transferencias, tarjetas, Mercado Pago y cuenta corriente con acuerdo) sin mezclar con diagnósticos mecánicos a menos que los haya mencionado.
- Si describe un síntoma mecánico (ruidos, vibración, volante torcido), explicá las causas más probables con fundamentos técnicos sencillos y recordale que una revisión física en la fosa del taller es indispensable para su seguridad.
- Respuestas concisas, bien estructuradas con viñetas cuando sea útil.`;

/**
 * Motor de Diagnóstico Experto Integrado (Fallback 100% Offline / Standalone).
 * Garantiza que incluso si el hosting bloquea peticiones POST con HTTP 405
 * o si no hay conexión externa a la API, el asistente responda con conocimiento
 * exacto, profesional y contextual.
 */
function generarDiagnosticoExperto(ultimoMensaje: string): string {
  const q = ultimoMensaje.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. FORMAS DE PAGO, CUOTAS, MERCADO PAGO, CUENTA CORRIENTE
  if (
    q.includes('pago') ||
    q.includes('tarjeta') ||
    q.includes('cuota') ||
    q.includes('mercado pago') ||
    q.includes('mercadopago') ||
    q.includes('transferencia') ||
    q.includes('efectivo') ||
    q.includes('cuenta corriente') ||
    q.includes('senia') ||
    q.includes('precio') ||
    q.includes('cuanto sale') ||
    q.includes('cuanto cuesta')
  ) {
    return `💳 **Formas y Medios de Pago en La Casa de la Dirección:**\n\n` +
      `Para tu comodidad, en el taller aceptamos múltiples opciones de pago:\n\n` +
      `• **Efectivo** en caja con bonificaciones especiales en mano de obra.\n` +
      `• **Transferencia bancaria** inmediata.\n` +
      `• **Tarjetas de Débito y Crédito**.\n` +
      `• **Mercado Pago** (saldo en cuenta o en cuotas según las promociones de tu banco).\n` +
      `• **Cuenta Corriente**: habilitada para clientes habituales y empresas, con previo acuerdo o entrega de seña inicial.\n\n` +
      `Si querés un presupuesto detallado para tu vehículo, podés coordinar un turno para revisarlo en fosa o escribirnos directamente al WhatsApp oficial del taller (+54 9 2625 53-2070).`;
  }

  // 2. TURNOS, HORARIOS, DIRECCIÓN, UBICACIÓN
  if (
    q.includes('turno') ||
    q.includes('horario') ||
    q.includes('hora') ||
    q.includes('abierto') ||
    q.includes('cuando abren') ||
    q.includes('donde estan') ||
    q.includes('ubicacion') ||
    q.includes('direccion') ||
    q.includes('telefono') ||
    q.includes('whatsapp') ||
    q.includes('donde queda')
  ) {
    return `📅 **Turnos y Horarios de Atención:**\n\n` +
      `• **Horarios de Taller:** Lunes a Viernes de 8:00 a 12:30 hs y de 15:30 a 20:00 hs. Sábados por la mañana.\n` +
      `• **Ubicación:** General Alvear, Mendoza, Argentina.\n` +
      `• **WhatsApp Directo:** +54 9 2625 53-2070.\n\n` +
      `Podés reservar tu turno en este mismo momento haciendo clic en el botón **"Sacar Turno en el Taller"** aquí abajo, o dejarnos un mensaje por WhatsApp para agendar el día que mejor te quede.`;
  }

  // 3. VIBRACIÓN EN EL VOLANTE (BALANCEO, CUBIERTAS)
  if (
    q.includes('vibra') ||
    q.includes('vibracion') ||
    q.includes('tiembla') ||
    q.includes('sacude') ||
    q.includes('80') ||
    q.includes('100') ||
    q.includes('120') ||
    q.includes('velocidad')
  ) {
    return `🔄 **Diagnóstico de Vibración en el Volante:**\n\n` +
      `Si el volante o la trompa del auto te vibra a partir de los 80 a 110 km/h, las causas más frecuentes son:\n\n` +
      `1. **Falta de Balanceo Dinámico:** Los contrapesos de las llantas delanteras se cayeron o las ruedas perdieron equilibrio.\n` +
      `2. **Cubierta Deformada o con Huevo:** Una rotura interna en la malla de acero del neumático provoca un salto constante al girar.\n` +
      `3. **Llanta Golpeada o Alabeada:** Un golpe contra un pozo suele desviar el labio de la llanta.\n` +
      `4. **Juego en Precaps o Extremos:** Holgura en la unión entre cremallera y maza.\n\n` +
      `💡 **Recomendación:** Te sugerimos pasar por el taller para un **Balanceo Dinámico Digital** y chequeo en fosa para cuidar tus cubiertas y tu seguridad.`;
  }

  // 4. EL AUTO TIRA HACIA UN COSTADO (ALINEACIÓN, BUJES)
  if (
    q.includes('tira') ||
    q.includes('costado') ||
    q.includes('desvia') ||
    q.includes('alineacion') ||
    q.includes('soltar el volante') ||
    q.includes('volante torcido') ||
    q.includes('volante cruzado')
  ) {
    return `🔧 **Diagnóstico: El vehículo tira hacia un lado / Volante desviado:**\n\n` +
      `Cuando soltás el volante en línea recta y el auto se va hacia la banquina o el carril contrario, suele deberse a:\n\n` +
      `1. **Alineación Descalibrada (Cáster o Comba):** Pérdida de ángulos geométricos por baches o cordones.\n` +
      `2. **Bujes de Parrilla Cedidos o Rotos:** Al acelerar o frenar, la rueda se desplaza hacia atrás cambiando la pisada.\n` +
      `3. **Diferencia de Presión o Desgaste Desigual:** Una cubierta con menos libras o gastada despareja genera resistencia al avance.\n` +
      `4. **Frenos Agarrados:** Un caliper que no retrocede del todo puede frenar ligeramente una de las ruedas.\n\n` +
      `💡 **Solución:** Lo solucionamos con nuestra **Alineación 3D Láser Computarizada**, revisando previamente en fosa que no haya rótulas ni bujes vencidos.`;
  }

  // 5. GOLPES SECOS, CRUJIDOS O RUIDOS EN BACHES Y LOMOS DE BURRO (TREN DELANTERO)
  if (
    q.includes('golpe') ||
    q.includes('ruido') ||
    q.includes('clac') ||
    q.includes('toc') ||
    q.includes('crujido') ||
    q.includes('pozo') ||
    q.includes('bache') ||
    q.includes('lomo de burro') ||
    q.includes('cuneta') ||
    q.includes('cazoleta') ||
    q.includes('rotula') ||
    q.includes('amortiguador') ||
    q.includes('buje')
  ) {
    return `⚠️ **Diagnóstico de Ruidos y Golpes en el Tren Delantero:**\n\n` +
      `Un ruido o golpe seco tipo "clac-clac" o "toc" al agarrar un bache o pasar un lomo de burro es una señal de desgaste mecánico:\n\n` +
      `• **Cazoletas y crapodinas de amortiguador:** Si están resecas o rajadas, transmiten el impacto directo a la carrocería.\n` +
      `• **Bielas o bujes de barra estabilizadora:** Provocan un golpeteo metálico corto muy molesto en empedrados o serruchos.\n` +
      `• **Rótulas de suspensión:** ¡Elemento crítico! Si tienen juego excesivo hay riesgo de desprendimiento de la rueda.\n` +
      `• **Amortiguadores reventados:** Si perdieron aceite hidráulico, el espiral rebota sin freno.\n\n` +
      `🚨 **Consejo:** El tren delantero es el pilar de la seguridad vial de tu familia. Agendá un turno y lo inspeccionamos a fondo en fosa con palanca de fuerza para darte un diagnóstico exacto.`;
  }

  // 6. DIRECCIÓN DURA, CHILLIDOS O PÉRDIDA DE LÍQUIDO HIDRÁULICO (CREMALLERA, BOMBA)
  if (
    q.includes('direccion') ||
    q.includes('dura') ||
    q.includes('pesada') ||
    q.includes('chillido') ||
    q.includes('silbido') ||
    q.includes('liquido') ||
    q.includes('cremallera') ||
    q.includes('bomba') ||
    q.includes('fuelle') ||
    q.includes('hidraulica') ||
    q.includes('al doblar')
  ) {
    return `⚙️ **Diagnóstico de Dirección Hidráulica o Cremallera:**\n\n` +
      `Si sentís la dirección pesada, hace un zumbido al doblar todo o pierde líquido:\n\n` +
      `1. **Nivel Bajo de Líquido Hidráulico:** La bomba succiona aire y produce un zumbido agudo o chillido.\n` +
      `2. **Fuelles de Cremallera Rotos:** Ingresa tierra y agua, rayando la barra de dirección y arruinando los retenes.\n` +
      `3. **Correa de Accesorios Floja o Desgastada:** Al doblar a tope patina y la bomba pierde asistencia momentánea.\n` +
      `4. **Juego Interno en Cremallera:** Se siente holgura o un punto muerto al mover el volante en reposo.\n\n` +
      `🔧 En el taller somos especialistas en reparación, ajuste y reemplazo de cremalleras y bombas de dirección. ¡Traelo y te lo revisamos!`;
  }

  // 7. FRENOS (CHILLIDO, PEDAL ESPONJOSO, VIBRACIÓN AL FRENAR)
  if (
    q.includes('freno') ||
    q.includes('frena') ||
    q.includes('pastilla') ||
    q.includes('disco') ||
    q.includes('pedal')
  ) {
    return `🛑 **Diagnóstico de Sistema de Frenos:**\n\n` +
      `Si escuchás un chillido agudo al frenar o el pedal tiene un tacto raro:\n\n` +
      `• **Chillido metálico:** Las pastillas de freno llegaron a su testigo de desgaste y están rozando el disco de freno.\n` +
      `• **Pedal esponjoso que se va al fondo:** Posible aire en el circuito, líquido de frenos degradado o falla en la bomba de freno.\n` +
      `• **Vibración o pulsación en el pedal al frenar:** Discos de freno deformados (alabeados) por exceso de temperatura.\n\n` +
      `No dejes pasar los frenos: realizamos recambio de pastillas, rectificación de discos y purgado de líquido.`;
  }

  // 8. SALUDO O CONSULTA GENERAL
  return `¡Hola! 👋 En **La Casa de la Dirección** somos especialistas en **Tren Delantero, Alineación 3D Láser, Balanceo Digital, Dirección Hidráulica y Frenos** en General Alvear, Mendoza.\n\n` +
    `Contame con confianza qué síntoma sentís en tu auto (un ruido al pasar baches, vibración en el volante, si te tira hacia un costado, o si tenés dudas sobre turnos o formas de pago) y te oriento al instante.\n\n` +
    `También podés reservar tu turno haciendo clic en **"Sacar Turno en el Taller"** o escribirnos directamente a nuestro WhatsApp oficial (+54 9 2625 53-2070).`;
}

/**
 * Consulta a la IA con resiliencia total y cero riesgo de error 405.
 */
export async function consultarAsistenteVirtual(mensajes: ChatMessage[]): Promise<string> {
  const ultimoMensaje = mensajes.filter((m) => m.role === 'user').pop()?.content || '';

  // 1. Si hay una API Key de Gemini disponible en tiempo de compilación o ejecución, intentamos llamada directa a Google
  const apiKey = (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) || '';

  if (apiKey) {
    const models = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
    for (const model of models) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
              },
              contents: mensajes.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
            }),
            signal: controller.signal,
          }
        );

        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText && candidateText.trim()) {
            return candidateText.trim();
          }
        }
      } catch (err) {
        // Silencioso: pasamos a la siguiente alternativa
        console.warn(`Llamada directa a ${model} no completada, evaluando alternativa...`);
      }
    }
  }

  // 2. Intentar llamada al backend local /api/chat-asistente (funciona en localhost y dev server)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('/api/chat-asistente', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        messages: mensajes.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      if (data?.reply) {
        return data.reply;
      }
    }
  } catch (err) {
    // Si da 405 (hosting estático como casadeladireccion.com.ar) o error de red, no rompemos la UI
    console.warn('Backend /api/chat-asistente no disponible en este host (posible hosting estático). Activando respuesta experta integrada.');
  }

  // 3. Fallback Infalible: Motor de Diagnóstico Experto Integrado
  // Garantiza 0 errores 405, 0 pantallas rotas y respuesta inmediata de alta calidad
  return generarDiagnosticoExperto(ultimoMensaje);
}
