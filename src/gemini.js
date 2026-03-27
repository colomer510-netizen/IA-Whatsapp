const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('./config');

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Procesa un mensaje con Gemini enfocado en atención al cliente, manteniendo historial.
 * @param {string} userName Nombre del cliente de WhatsApp
 * @param {string} message Mensaje entrante
 * @param {Array} history Historial previo de la conversación en MongoDB/Firestore
 * @returns {Promise<{ reply: string, intent: 'normal' | 'hablar_humano' }>}
 */
async function processMessageWithAI(userName, message, history = []) {
  try {
    if (!config.gemini.apiKey) {
      return { reply: "Lo siento, la API de inteligencia artificial no está configurada.", intent: 'normal' };
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      systemInstruction: `Eres el asistente virtual de la marca de tecnología "Encob". Eres amable, profesional y conciso. El cliente con el que hablas se llama ${userName}, salúdalo por su nombre de forma natural si es la primera vez. Tu objetivo es ayudar con servicios tecnológicos (venta de equipos, soporte, desarrollo, etc.). Si el cliente te pide explícitamente hablar con un asesor humano o si no puedes resolver su problema, indícalo claramente y finaliza tu respuesta con la frase exacta: "[INTENCION_HUMANO]".` 
    });

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessage(message);
    let reply = result.response.text();
    let intent = 'normal';

    // Detectar intención de saltar a humano generada por Gemini
    if (reply.includes('[INTENCION_HUMANO]')) {
      intent = 'hablar_humano';
      reply = reply.replace('[INTENCION_HUMANO]', '').trim();
      if (!reply) {
        reply = "Entendido, te transferiré con uno de nuestros asesores en un momento.";
      }
    }

    // Análisis de regla cruda por seguridad: Palabras clave fuertes
    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes('asesor') || lowerMessage.includes('humano') || lowerMessage.includes('persona')) {
       intent = 'hablar_humano';
    }

    return { reply, intent };
    
  } catch (error) {
    console.error('Error en Gemini API:', error);
    return { reply: "Hubo un error al procesar tu mensaje en este momento. Intenta de nuevo más tarde.", intent: 'normal' };
  }
}

module.exports = {
  processMessageWithAI
};
