# Cambios necesarios en el frontend (Spring Boot → Servidor Público)

El frontend de la versión Spring Boot usa `stompjs`. Esta versión lo reemplaza con `socket.io-client`, que es más simple y no requiere configurar STOMP.

Los componentes visuales (Scoreboard, EventFeed, NewEventForm) son **idénticos** a la versión Spring Boot. Solo cambian tres archivos.

---

## Archivo 1 de 3 — `package.json`

Elimina `stompjs`, agrega `socket.io-client`:

```diff
- "stompjs": "^2.3.3"
+ "socket.io-client": "^4.7.5"
```

Luego reinstala:

```bash
npm install
```

---

## Archivo 2 de 3 — `src/lib/apiClient.js`

Reemplaza el archivo completo con el archivo `src/lib/apiClient.js` de esta carpeta.

**Qué cambia:**
- `import Stomp from 'stompjs'` → `import { io } from 'socket.io-client'`
- `subscribeToUpdates` ya no devuelve una `Promise` — devuelve el cleanup directamente
- Se agrega un cuarto parámetro `onStatusChange` para actualizar el indicador de conexión
- Se agregan `sendChatMessage` y `onChatMessage` para la Tarea E

---

## Archivo 3 de 3 — `src/App.jsx`

Reemplaza el archivo completo con el `src/App.jsx` de esta carpeta.

**Qué cambia:**

```diff
- // useEffect con async function connectWs() porque subscribeToUpdates era Promise
+ // useEffect simple porque subscribeToUpdates ahora es síncrono
  useEffect(() => {
-   let cleanup
-   async function connectWs() {
-     cleanup = await subscribeToUpdates(...)
-     setWsStatus('conectado')
-   }
-   connectWs()
-   return () => { if (cleanup) cleanup() }
+   const cleanup = subscribeToUpdates(
+     (match)  => setMatch(match),
+     (event)  => setEvents(prev => [...]),
+     (err)    => console.error(err),
+     (status) => setWsStatus(status),   // ← nuevo parámetro
+   )
+   return cleanup
  }, [])
```

---

## Configurar variables de entorno

Crea `.env.local` en la raíz del frontend con la URL del servidor desplegado:

```
VITE_API_URL=https://tu-servidor.tudominio.com
```

El profesor compartirá esta URL antes de la clase.

---

## Componentes iguales — no los toques

Copia estos archivos directamente desde la versión Spring Boot sin cambios:

- `src/components/Scoreboard.jsx`
- `src/components/EventFeed.jsx`
- `src/components/NewEventForm.jsx`
- `src/main.jsx`
- `index.html`
- `vite.config.js`

---

## Tarea E: Chat — qué cambia

La Tarea E (chat) en la versión Socket.io es más simple porque el servidor hace echo automáticamente:

```javascript
// Versión Socket.io (más simple que Broadcast de Supabase)
import { sendChatMessage, onChatMessage } from '../lib/apiClient'

useEffect(() => {
  const unsubscribe = onChatMessage((msg) => {
    setMessages(prev => [...prev.slice(-49), msg])
  })
  return unsubscribe
}, [])

async function handleSend(e) {
  e.preventDefault()
  const message = { author: MY_NAME, text: text.trim(), at: new Date().toISOString() }
  sendChatMessage(message)          // servidor hace echo a todos
  setMessages(prev => [...prev, message])  // agregar localmente también
  setText('')
}
```

**Diferencia con Supabase Broadcast:** Socket.io `io.emit` hace echo al remitente, así que el mensaje llega dos veces si no se filtra. La solución más simple es agregarlo localmente (como arriba) y filtrar duplicados en el listener por `at` o `author+text`.
