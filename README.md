# WhatsApp Customer Service Bot & Proxy con Google Gemini y Firebase

Este repositorio contiene el código abierto de un Bot avanzado de WhatsApp desarrollado en Node.js, listo para ser desplegado en **Vercel** de manera gratuita (arquitectura Serverless).

Combina la inteligencia de **Google Gemini API** con un sistema de **Micro-CRM y Proxy de Mensajería** para asesores humanos.

## Características Principales 🚀

1. **Atención con Inteligencia Artificial**: Responde a los clientes 24/7 utilizando la memoria conversacional de Gemini API.
2. **Plantillas Interactivas**: Soporte para envíos de Listas y Botones de acción rápida.
3. **Escalamiento a Humanos**: Detecta intenciones de hablar con un humano o se activa mediante botones, poniendo en alerta a un equipo de asesores (`!tomar`).
4. **Proxy Multimedia Cliente-Asesor**: Una vez que el asesor humano toma el chat, la IA se silencia. A partir de ahí, todo texto, **imágenes, audios o documentos** que envíe el cliente se reenviarán limpiamente al WhatsApp del asesor, y viceversa, protegiendo la privacidad y unificando todo en un solo número empresarial.
5. **Base de Datos en Tiempo Real**: Mantiene el contexto e historial de sesiones en memoria utilizando Firebase Firestore.

## 📦 Prerrequisitos

Para usar este proyecto necesitas:
- Un número de teléfono validado en la [API oficial de Meta Cloud de WhatsApp](https://developers.facebook.com/).
- Una cuenta y API Key gratuita en [Google Gemini (Google AI Studio)](https://aistudio.google.com/app/apikey).
- Un proyecto en [Firebase con una Service Account JSON](https://console.firebase.google.com).

## 🚀 Despliegue en 5 minutos (Vercel)

El proyecto incluye soporte nativo listo para funcionar en **Vercel** (`vercel.json` ya integrado).

1. Haz un Fork de este repositorio en GitHub.
2. Entra a [Vercel](https://vercel.com) y crea un *"New Project"*, vinculando tu repositorio Forkeado.
3. Copia todas las variables del archivo `.env.example` dentro del apartado **Environment Variables** en Vercel. 
   - *Nota*: Para Firebase, puedes pegar el contenido literal de todo tu archivo `firebase-adminsdk.json` en una sola línea dentro de la variable `FIREBASE_CREDENTIALS_JSON`.
4. Haz clic en **Deploy**.
5. Abre la consola de desarrolladores de Meta (WhatsApp Configuración > Webhooks), pon la URL que Vercel te dio `/webhook` (Ej. `https://mi-bot.vercel.app/webhook`), y pon el mismo `VERIFY_TOKEN` que elegiste en tu `.env`. Sube los campos de la opción de Webhooks y selecciona `messages`.

¡Y listo! Tu asistente ya está respondiendo a mensajes y rutando información.

## 🛠️ Comandos para Asesores 
Los números agregados a la variable `ADVISOR_PHONES` recibirán las notificaciones. 
Tienen 2 comandos disponibles desde su app personal de WhatsApp.
- `!tomar [número]`: Les conecta directamente para hablar con el cliente de ese número.
- `!cerrar`: Destruye el puente entre el asesor y el cliente, y el bot de Inteligencia Artificial vuelve a tomar el control con normalidad.

## Contribuciones
¡Las contribuciones, issues, e ideas para nuevas características son bienvenidas de la comunidad de código abierto! Si te es útil, regálanos una estrella. ⭐
