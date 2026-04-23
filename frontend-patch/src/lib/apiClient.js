import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Instancia de socket compartida — se crea al llamar subscribeToUpdates
let socket = null

// ── REST ──────────────────────────────────────────────────────

export async function fetchMatch() {
  const res = await fetch(`${API_URL}/api/match`)
  return res.json()
}

export async function fetchEvents() {
  const res = await fetch(`${API_URL}/api/events`)
  return res.json()
}

export async function updateScore(matchId, homeScore, awayScore) {
  const res = await fetch(`${API_URL}/api/match/${matchId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ homeScore, awayScore }),
  })
  return res.json()
}

export async function resetScore(matchId) {
  const res = await fetch(`${API_URL}/api/match/${matchId}/reset`, {
    method: 'POST',
  })
  return res.json()
}

export async function addEvent(eventType, minute, description) {
  const res = await fetch(`${API_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType,
      minute:      minute      || null,
      description: description || null,
    }),
  })
  return res.json()
}

// ── WebSocket / Socket.io ─────────────────────────────────────
// A diferencia de la versión con stompjs, esta función es
// síncrona y devuelve el cleanup directamente (no una Promesa).

export function subscribeToUpdates(onMatchUpdate, onEventAdded, onError, onStatusChange) {
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],  // websocket primero, polling como fallback
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  })

  socket.on('connect',        ()  => onStatusChange?.('conectado'))
  socket.on('disconnect',     ()  => onStatusChange?.('desconectado'))
  socket.on('connect_error',  (e) => { onStatusChange?.('error'); onError(e) })

  socket.on('match:update', onMatchUpdate)
  socket.on('match:event',  onEventAdded)

  // El servidor emitió un reset completo (solo lo hace /admin/reset)
  socket.on('match:reset', ({ match, events }) => {
    onMatchUpdate(match)
    // El segundo argumento puede usarse si el componente lo acepta
  })

  return () => socket.disconnect()
}

// ── Chat (para Tarea E) ───────────────────────────────────────

export function sendChatMessage(message) {
  socket?.emit('chat:send', message)
}

export function onChatMessage(callback) {
  socket?.on('chat:message', callback)
  return () => socket?.off('chat:message', callback)
}
