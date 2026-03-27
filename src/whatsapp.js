const axios = require('axios');
const config = require('./config');

const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/${config.whatsapp.phoneId}/messages`;

const axiosInstance = axios.create({
  headers: {
    'Authorization': `Bearer ${config.whatsapp.token}`,
    'Content-Type': 'application/json'
  }
});

/**
 * Enviar mensaje de texto simple.
 */
async function sendTextMessage(to, text) {
  try {
    if (!config.whatsapp.token || !config.whatsapp.phoneId) return;
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };
    await axiosInstance.post(WHATSAPP_API_URL, body);
  } catch (error) {
    console.error('Error enviando mensaje de texto WhatsApp:', error.response ? error.response.data : error.message);
  }
}

/**
 * Enviar botones interactivos de acción rápida.
 * @param {string} to Destinatario
 * @param {string} text Texto del body
 * @param {Array<{id: string, text: string}>} buttons Hasta 3 botones
 */
async function sendInteractiveButtons(to, text, buttons) {
  try {
    if (!config.whatsapp.token || !config.whatsapp.phoneId) return;
    
    const formattedButtons = buttons.map(btn => ({
      type: 'reply',
      reply: {
        id: btn.id,
        title: btn.text
      }
    }));

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: text
        },
        action: {
          buttons: formattedButtons
        }
      }
    };

    await axiosInstance.post(WHATSAPP_API_URL, body);
  } catch (error) {
    console.error('Error enviando botones interactivos WhatsApp:', error.response ? error.response.data : error.message);
  }
}

/**
 * Envía un mensaje a todos los asesores registrados en la config.
 */
async function broadcastToAdvisors(message) {
  const advisors = config.advisorPhones;
  for (const phone of advisors) {
    await sendTextMessage(phone, message);
  }
}

/**
 * Enviar mensaje multimedia (Imagen, Audio, Documento) usando su ID de Meta.
 */
async function sendMediaMessage(to, type, mediaId, caption = '') {
  try {
    if (!config.whatsapp.token || !config.whatsapp.phoneId) return;
    
    // type puede ser 'image', 'audio', 'video', 'document', 'sticker'
    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: type,
    };
    
    body[type] = {
      id: mediaId
    };
    
    if (caption && type !== 'audio' && type !== 'sticker') {
      body[type].caption = caption;
    }

    await axiosInstance.post(WHATSAPP_API_URL, body);
  } catch (error) {
    console.error(`Error enviando multimedia (${type}) WhatsApp:`, error.response ? error.response.data : error.message);
  }
}

module.exports = {
  sendTextMessage,
  sendInteractiveButtons,
  broadcastToAdvisors,
  sendMediaMessage
};
