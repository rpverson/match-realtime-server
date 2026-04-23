import express   from 'express'
import { createServer } from 'http'
import { Server }  from 'socket.io'
import cors        from 'cors'

const app        = express()
const httpServer = createServer(app)
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PUT'] },
})

app.use(cors())
app.use(express.json())

// ── Estado en memoria ────────────────────────────────────────
// Se inicializa al arrancar el servidor. Si necesitas reiniciar
// el estado durante la clase, llama POST /admin/reset.

const MATCH_NAME = process.env.MATCH_NAME || 'Real Madrid vs Barcelona'

let match = {
  id: 1,
  matchName: MATCH_NAME,
  homeScore: 0,
  awayScore: 0,
  updatedAt: new Date().toISOString(),
}

let events = [
  { id: 1, eventType: 'Inicio',           minute: 1,  description: 'Pitido inicial — comienza el partido', createdAt: new Date().toISOString() },
  { id: 2, eventType: 'Falta',            minute: 12, description: 'Falta del equipo visitante',           createdAt: new Date().toISOString() },
  { id: 3, eventType: 'Saque de esquina', minute: 18, description: 'Córner para el equipo local',          createdAt: new Date().toISOString() },
]

let nextEventId = 4

// ── REST: Partido ─────────────────────────────────────────────

app.get('/api/match', (_req, res) => {
  res.json(match)
})

app.put('/api/match/:id', (req, res) => {
  const { homeScore, awayScore } = req.body
  match = { ...match, homeScore, awayScore, updatedAt: new Date().toISOString() }
  io.emit('match:update', match)   // broadcast a todos los clientes conectados
  res.json(match)
})

app.post('/api/match/:id/reset', (_req, res) => {
  match = { ...match, homeScore: 0, awayScore: 0, updatedAt: new Date().toISOString() }
  io.emit('match:update', match)
  res.json(match)
})

// ── REST: Eventos ─────────────────────────────────────────────

app.get('/api/events', (_req, res) => {
  const sorted = [...events].sort((a, b) => b.id - a.id)
  res.json(sorted)
})

app.post('/api/events', (req, res) => {
  const { eventType, minute, description } = req.body

  if (!eventType) {
    return res.status(400).json({ error: 'eventType es requerido' })
  }

  const event = {
    id: nextEventId++,
    eventType,
    minute:      minute      ?? null,
    description: description ?? null,
    createdAt:   new Date().toISOString(),
  }

  events.push(event)
  io.emit('match:event', event)   // broadcast a todos los clientes conectados
  res.status(201).json(event)
})

// ── REST: Usuarios conectados (para Tarea B) ──────────────────

app.get('/api/users/connected', (_req, res) => {
  res.json({ count: io.engine.clientsCount })
})

// ── REST: Admin ───────────────────────────────────────────────
// Permite al profesor reiniciar el estado antes de clase.
// Protegido por ADMIN_SECRET para evitar resets accidentales.

app.post('/admin/reset', (req, res) => {
  const secret = process.env.ADMIN_SECRET || 'admin'
  if (req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  match = {
    id: 1,
    matchName: MATCH_NAME,
    homeScore: 0,
    awayScore: 0,
    updatedAt: new Date().toISOString(),
  }

  events = [
    { id: 1, eventType: 'Inicio', minute: 1, description: 'Pitido inicial', createdAt: new Date().toISOString() },
  ]

  nextEventId = 2
  io.emit('match:reset', { match, events })  // clientes limpian su estado local
  res.json({ ok: true, message: 'Estado reiniciado' })
})

// ── Health check (para Coolify / Docker) ─────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: io.engine.clientsCount })
})

// ── WebSocket: conexiones ─────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] cliente conectado   id=${socket.id}  total=${io.engine.clientsCount}`)

  // Chat efímero para Tarea E: el servidor hace echo a todos
  socket.on('chat:send', (message) => {
    // io.emit incluye al remitente; el cliente ya lo agregó localmente,
    // así que el componente de chat debe evitar duplicar su propio mensaje
    io.emit('chat:message', message)
  })

  socket.on('disconnect', () => {
    console.log(`[-] cliente desconectado id=${socket.id}  total=${io.engine.clientsCount}`)
  })
})

// ── Arranque ──────────────────────────────────────────────────

const PORT = process.env.PORT || 8080

httpServer.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
  console.log(`  GET  /api/match               → estado del partido`)
  console.log(`  PUT  /api/match/:id            → actualizar marcador`)
  console.log(`  POST /api/match/:id/reset      → reiniciar marcador`)
  console.log(`  GET  /api/events               → lista de eventos`)
  console.log(`  POST /api/events               → agregar evento`)
  console.log(`  GET  /api/users/connected      → clientes activos`)
  console.log(`  POST /admin/reset              → reset completo (requiere header)`)
  console.log(`  GET  /health                   → health check`)
})
