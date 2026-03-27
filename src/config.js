require('dotenv').config();

const config = {
    port: process.env.PORT || 3000,
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN,
        phoneId: process.env.WHATSAPP_PHONE_ID,
        verifyToken: process.env.VERIFY_TOKEN
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY
    },
    advisorPhones: process.env.ADVISOR_PHONES ? process.env.ADVISOR_PHONES.split(',').map(p => p.trim()) : [],
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
    firebaseCredentialsJson: process.env.FIREBASE_CREDENTIALS_JSON
};

module.exports = config;
