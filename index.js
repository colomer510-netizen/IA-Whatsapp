const express = require('express');
const config = require('./src/config');
const whatsapp = require('./src/whatsapp');
const firebase = require('./src/firebase');
const gemini = require('./src/gemini');

const app = express();
app.use(express.json());

// Verificación del Webhook de Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      console.log('Webhook verificado exitosamente!');
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

// Recepción de Mensajes de WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Validar si es un evento de WhatsApp
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry[0];
      const changes = entry.changes[0];
      const value = changes.value;
      
      if (value.messages && value.messages[0]) {
        const message = value.messages[0];
        const contact = value.contacts && value.contacts[0];
        const senderPhone = message.from;
        let messageText = '';
        let mediaId = null;
        let messageType = message.type;

        if (messageType === 'text') {
          messageText = message.text.body;
        } else if (messageType === 'interactive' && message.interactive.type === 'button_reply') {
          messageText = message.interactive.button_reply.title; // El texto del botón presionado
          messageType = 'text'; // Lo tratamos como texto
        } else if (['image', 'audio', 'video', 'document', 'sticker'].includes(messageType)) {
          mediaId = message[messageType].id;
          messageText = message[messageType].caption || '';
        } else {
           messageText = '[Formato no soportado]'; 
        }

        await processMessageFlow(senderPhone, messageText, messageType, mediaId, contact);
      }
    }
    res.sendStatus(200); // Siempre responder 200 rápido a Meta
  } catch (error) {
    console.error('Error procesando webhook:', error);
    res.sendStatus(500);
  }
});

/**
 * Función central de enrutamiento y proxy.
 */
async function processMessageFlow(senderPhone, messageText, messageType, mediaId, contact) {
  const senderName = contact ? contact.profile.name : 'Cliente';
  const isAdvisor = config.advisorPhones.includes(senderPhone);

  // === MODO ASESOR ===
  if (isAdvisor) {
    const textLower = messageText.trim().toLowerCase();
    
    // Comando: !tomar [Numero]
    if (textLower.startsWith('!tomar')) {
      const clientPhone = textLower.replace('!tomar', '').trim();
      if (!clientPhone) {
        return whatsapp.sendTextMessage(senderPhone, 'Formato incorrecto. Usa: !tomar [Numero]');
      }
      
      const clientSession = await firebase.getUserSession(clientPhone);
      if (!clientSession) {
        return whatsapp.sendTextMessage(senderPhone, 'Ese cliente no existe en la base de datos.');
      }
      
      if (clientSession.status === 'esperando_asesor') {
        // Enlazar al asesor con el cliente
        await firebase.updateUserSession(clientPhone, {
          status: 'conectado_con_asesor',
          advisor_phone: senderPhone
        });
        
        await whatsapp.sendTextMessage(senderPhone, `✅ Te has conectado con el cliente ${clientSession.name} (${clientPhone}). Todo lo que escribas ahora se le enviará.`);
        await whatsapp.sendTextMessage(clientPhone, `👨‍💻 Un asesor humano se ha unido al chat. Ya puedes conversar con él.`);
      } else if (clientSession.status === 'conectado_con_asesor') {
        await whatsapp.sendTextMessage(senderPhone, '⚠️ Este cliente ya está siendo atendido por otro asesor.');
      } else {
        await whatsapp.sendTextMessage(senderPhone, `El cliente ${clientPhone} no está esperando asistencia. Estado actual: ${clientSession.status}`);
      }
      return;
    }
    
    // Comando: !cerrar
    if (textLower === '!cerrar') {
      const activeSession = await firebase.getAdvisorActiveSession(senderPhone);
      if (!activeSession) {
        return whatsapp.sendTextMessage(senderPhone, 'No tienes ninguna sesión activa de chat con un cliente para cerrar.');
      }
      
      const clientPhone = activeSession.phone;
      await firebase.updateUserSession(clientPhone, {
        status: 'bot_activo',
        advisor_phone: null
      });
      
      await whatsapp.sendTextMessage(senderPhone, `🔌 Has cerrado el chat con el cliente ${activeSession.name}.`);
      await whatsapp.sendTextMessage(clientPhone, `🤖 La sesión con el asesor ha terminado. Vuelvo a ser tu asistente virtual Encob. ¿En qué más puedo ayudarte?`);
      return;
    }
    
    // Si no es un comando, es un texto del asesor que debe enviarse mediante el Proxy
    const activeSession = await firebase.getAdvisorActiveSession(senderPhone);
    if (activeSession) {
      if (mediaId && ['image', 'audio', 'video', 'document', 'sticker'].includes(messageType)) {
        await whatsapp.sendMediaMessage(activeSession.phone, messageType, mediaId, messageText);
      } else {
        await whatsapp.sendTextMessage(activeSession.phone, messageText || '[Mensaje multimedia sin texto]');
      }
    } else {
      await whatsapp.sendTextMessage(senderPhone, 'No estás atendiendo a ningún cliente ahora mismo. Puedes usar !tomar [numero] cuando te notifique.');
    }
    return;
  }
  
  // === MODO CLIENTE ===
  let session = await firebase.getUserSession(senderPhone);
  if (!session) {
    session = { name: senderName, status: 'bot_activo', advisor_phone: null };
    await firebase.updateUserSession(senderPhone, session);
  }

  // 1. Cliente en chat con humano (PROXY MODO CLIENTE A ASESOR)
  if (session.status === 'conectado_con_asesor' && session.advisor_phone) {
    if (mediaId && ['image', 'audio', 'video', 'document', 'sticker'].includes(messageType)) {
      await whatsapp.sendMediaMessage(session.advisor_phone, messageType, mediaId, `[${session.name} te envió esto] ${messageText}`);
    } else {
      await whatsapp.sendTextMessage(session.advisor_phone, `[${session.name}]: ${messageText}`);
    }
    return;
  }
  
  // 2. Cliente esperando asesor (Bot silenciado)
  if (session.status === 'esperando_asesor') {
     // Opcionalmente podrías avisarle de nuevo "Aún estamos buscándote un asesor", pero es mejor no spamear
    return;
  }

  // 3. Cliente interactuando con el Bot de IA
  if (session.status === 'bot_activo') {
    // Si la persona pide el menú, enviamos botones interactivos en lugar de pedir a Gemini.
    const lowerTxt = messageText.toLowerCase();
    if (lowerTxt === 'menu' || lowerTxt === 'menú' || lowerTxt === 'servicios') {
      const buttons = [
        { id: 'btn_catalogo', text: 'Ver Catálogo' },
        { id: 'btn_humano', text: 'Hablar con Asesor' }
      ];
      await whatsapp.sendInteractiveButtons(senderPhone, '¡Claro! Aquí tienes algunas opciones rápidas:', buttons);
      return;
    }
    
    // Simular que el usuario tocó el botón de "Hablar con Asesor" si en texto llega eso
    if (lowerTxt === 'hablar con asesor') {
       await handleAdvisorRequest(senderPhone, session.name);
       return;
    }

    // Filtrar texto para Gemini si envió imagen, al menos decir que envió un archivo
    let promptForAI = messageText;
    if (mediaId && !messageText) {
       promptForAI = `[El usuario envió un archivo multimedia formato: ${messageType}]`;
    }

    // Llamado a Gemini API usando historial
    const aiResponse = await gemini.processMessageWithAI(session.name, promptForAI, session.history || []);
    
    // Guardar los mensajes en el historial
    await firebase.appendMessageToHistory(senderPhone, 'user', promptForAI);
    await firebase.appendMessageToHistory(senderPhone, 'model', aiResponse.reply);
    
    if (aiResponse.intent === 'hablar_humano') {
      await whatsapp.sendTextMessage(senderPhone, aiResponse.reply);
      await handleAdvisorRequest(senderPhone, session.name);
    } else {
      await whatsapp.sendTextMessage(senderPhone, aiResponse.reply);
    }
  }
}

/**
 * Función auxiliar para cambiar el estado y alertar a los humanos.
 */
async function handleAdvisorRequest(clientPhone, clientName) {
  await firebase.updateUserSession(clientPhone, { status: 'esperando_asesor' });
  
  const alertText = `🚨 El cliente ${clientName} (${clientPhone}) requiere asistencia.\n\nResponde a este chat con:\n!tomar ${clientPhone}`;
  await whatsapp.broadcastToAdvisors(alertText);
}

// Iniciar servidor localmente o exportar para Vercel Serverless
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(config.port, () => {
      console.log(`🚀 Servidor del Bot de Encob escuchando en puerto ${config.port} (Desarrollo)`);
  });
}

// Exportar la app para que Vercel (@vercel/node) la consuma como función Serverless
module.exports = app;
