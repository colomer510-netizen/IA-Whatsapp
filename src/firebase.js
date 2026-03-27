const admin = require('firebase-admin');
const config = require('./config');

try {
  // Inicialización de Firebase Admin para Vercel o Entorno Local
  if (config.firebaseCredentialsJson) {
    // Modo Nube (Vercel): Lee la variable de entorno con el string JSON
    const serviceAccount = JSON.parse(config.firebaseCredentialsJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else if (config.firebaseServiceAccountPath) {
    // Modo Local: Lee el archivo JSON
    const serviceAccount = require(`../${config.firebaseServiceAccountPath}`);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } else {
    // Intenta usar la configuración por defecto del entorno
    admin.initializeApp();
  }
  console.log('Firebase Inicializado correctamente.');
} catch (error) {
  console.log('Aviso: Error inicializando Firebase. Si estás probando sin credenciales, ciertas funciones fallarán.', error.message);
}

const db = admin.firestore();

/**
 * Obtiene la sesión actual del usuario.
 * @param {string} phone Número de teléfono (ID del documento)
 */
async function getUserSession(phone) {
  try {
    const doc = await db.collection('sessions').doc(phone).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data();
  } catch (error) {
    console.error('Error obteniendo sesión de Firestore:', error);
    return null;
  }
}

/**
 * Crea o actualiza la sesión del usuario.
 * @param {string} phone Número de teléfono
 * @param {object} data Objeto con datos a actualizar: name, status, advisor_phone, etc.
 */
async function updateUserSession(phone, data) {
  try {
    await db.collection('sessions').doc(phone).set(data, { merge: true });
    return true;
  } catch (error) {
    console.error('Error actualizando sesión en Firestore:', error);
    return false;
  }
}

/**
 * Busca si un asesor ya está atendiendo a un cliente.
 * @param {string} advisorPhone Número del asesor
 */
async function getAdvisorActiveSession(advisorPhone) {
  try {
    const querySnapshot = await db.collection('sessions')
      .where('status', '==', 'conectado_con_asesor')
      .where('advisor_phone', '==', advisorPhone)
      .limit(1)
      .get();
      
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return { phone: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error obteniendo sesión activa del asesor:', error);
    return null;
  }
}

/**
 * Agrega un mensaje al historial de la sesión para el contexto de Gemini.
 * Mantiene solo los últimos 10 turnos de conversación.
 */
async function appendMessageToHistory(phone, role, text) {
  try {
    if (!text) return;
    const docRef = db.collection('sessions').doc(phone);
    const doc = await docRef.get();
    let history = [];
    if (doc.exists) {
      const data = doc.data();
      history = data.history || [];
    }
    
    history.push({
      role: role,
      parts: [{ text: text }]
    });

    if (history.length > 20) {
      history = history.slice(history.length - 20); // Conservar últimos 20 (10 turnos)
    }

    await docRef.set({ history }, { merge: true });
  } catch (error) {
    console.error('Error actualizando historial en Firestore:', error);
  }
}

module.exports = {
  getUserSession,
  updateUserSession,
  getAdvisorActiveSession,
  appendMessageToHistory
};
