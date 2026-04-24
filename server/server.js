import express      from 'express'
import { createServer } from 'http'
import cors           from 'cors'
import sockjs         from 'sockjs'

const app        = express()
const httpServer = createServer(app)

app.use(cors())
app.use(express.json())

// ── Estado en memoria ────────────────────────────────────────

const MATCH_NAME = process.env.MATCH_NAME || 'Real Madrid vs Barcelona'

let match = {
  id:         1,
  matchName:  MATCH_NAME,
  homeScore:  0,
  awayScore:  0,
  updatedAt:  new Date().toISOString(),
}

let events = [
  { id: 1, eventType: 'Inicio',           minute: 1,  description: 'Pitido inicial — comienza el partido', createdAt: new Date().toISOString() },
  { id: 2, eventType: 'Falta',            minute: 12, description: 'Falta del equipo visitante',           createdAt: new Date().toISOString() },
  { id: 3, eventType: 'Saque de esquina', minute: 18, description: 'Córner para el equipo local',          createdAt: new Date().toISOString() },
]

let nextEventId    = 4
let msgIdCounter   = 1

// ── STOMP: subscripciones activas ────────────────────────────
// Map: conn → Map(subscriptionId → destination)

const stompClients = new Map()

// ── STOMP: parsing / serialización ──────────────────────────

function parseStompFrames(raw) {
  if (!raw || raw.replace(/[\r\n]/g, '').length === 0) return []
  return raw
    .split('\0')
    .map(f => f.replace(/\r\n/g, '\n').trim())
    .filter(f => f.length > 0)
    .map(f => {
      const sep = f.indexOf('\n\n')
      if (sep === -1) return null
      const headerLines = f.substring(0, sep).split('\n')
      const command = headerLines[0].trim()
      if (!command) return null
      const headers = {}
      for (let i = 1; i < headerLines.length; i++) {
        const ci = headerLines[i].indexOf(':')
        if (ci > -1) {
          headers[headerLines[i].substring(0, ci).trim()] = headerLines[i].substring(ci + 1).trim()
        }
      }
      return { command, headers, body: f.substring(sep + 2) }
    })
    .filter(Boolean)
}

function makeStompFrame(command, headers, body) {
  let frame = command + '\n'
  for (const [k, v] of Object.entries(headers)) frame += `${k}:${v}\n`
  frame += '\n'
  if (body) frame += body
  return frame + '\0'
}

// Emite un MESSAGE a todos los clientes suscritos a `destination`
function broadcast(destination, payload) {
  const body = JSON.stringify(payload)
  for (const [conn, subs] of stompClients) {
    for (const [subId, dest] of subs) {
      if (dest === destination) {
        conn.write(makeStompFrame('MESSAGE', {
          subscription:     subId,
          'message-id':     msgIdCounter++,
          destination,
          'content-type':   'application/json',
          'content-length': Buffer.byteLength(body),
        }, body))
      }
    }
  }
}

// ── SockJS: endpoint /ws/match (compatible con stompjs frontend) ──

const sockjsServer = sockjs.createServer({
  sockjs_url: 'https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js',
  log: () => {},   // suprimir logs de sockjs
})

sockjsServer.on('connection', (conn) => {
  stompClients.set(conn, new Map())
  console.log(`[+] STOMP conectado   total=${stompClients.size}`)

  conn.on('data', (raw) => {
    for (const frame of parseStompFrames(raw)) {
      if (frame.command === 'CONNECT') {
        conn.write(makeStompFrame('CONNECTED', {
          version:       '1.1',
          'heart-beat':  '0,0',
          server:        'match-server/1.0',
        }, null))

      } else if (frame.command === 'SUBSCRIBE') {
        stompClients.get(conn)?.set(frame.headers.id, frame.headers.destination)

      } else if (frame.command === 'UNSUBSCRIBE') {
        stompClients.get(conn)?.delete(frame.headers.id)

      } else if (frame.command === 'DISCONNECT') {
        if (frame.headers.receipt) {
          conn.write(makeStompFrame('RECEIPT', { 'receipt-id': frame.headers.receipt }, null))
        }
        conn.close()
      }
    }
  })

  conn.on('close', () => {
    stompClients.delete(conn)
    console.log(`[-] STOMP desconectado total=${stompClients.size}`)
  })
})

sockjsServer.installHandlers(httpServer, { prefix: '/ws/match' })

// ── REST: Partido ─────────────────────────────────────────────

app.get('/api/match', (_req, res) => {
  res.json(match)
})

app.put('/api/match/:id', (req, res) => {
  const { homeScore, awayScore } = req.body
  match = { ...match, homeScore, awayScore, updatedAt: new Date().toISOString() }
  broadcast('/topic/match/update', match)
  res.json(match)
})

app.post('/api/match/:id/reset', (_req, res) => {
  match = { ...match, homeScore: 0, awayScore: 0, updatedAt: new Date().toISOString() }
  broadcast('/topic/match/update', match)
  res.json(match)
})

// ── REST: Eventos ─────────────────────────────────────────────

app.get('/api/events', (_req, res) => {
  res.json([...events].sort((a, b) => b.id - a.id))
})

app.post('/api/events', (req, res) => {
  const { eventType, minute, description } = req.body
  if (!eventType) return res.status(400).json({ error: 'eventType es requerido' })

  const event = {
    id:          nextEventId++,
    eventType,
    minute:      minute      ?? null,
    description: description ?? null,
    createdAt:   new Date().toISOString(),
  }
  events.push(event)
  broadcast('/topic/match/event', event)
  res.status(201).json(event)
})

// ── REST: Usuarios conectados ─────────────────────────────────

app.get('/api/users/connected', (_req, res) => {
  res.json({ count: stompClients.size })
})

// ── REST: Admin ───────────────────────────────────────────────

app.post('/admin/reset', (req, res) => {
  const secret = process.env.ADMIN_SECRET || 'admin'
  if (req.headers['x-admin-secret'] !== secret) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  match = {
    id:        1,
    matchName: MATCH_NAME,
    homeScore: 0,
    awayScore: 0,
    updatedAt: new Date().toISOString(),
  }
  events = [
    { id: 1, eventType: 'Inicio', minute: 1, description: 'Pitido inicial', createdAt: new Date().toISOString() },
  ]
  nextEventId = 2

  broadcast('/topic/match/update', match)
  res.json({ ok: true, message: 'Estado reiniciado' })
})

// ── Health check ──────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', clients: stompClients.size })
})

// ── Arranque ──────────────────────────────────────────────────

const PORT = process.env.PORT || 8080

httpServer.listen(PORT, () => {
  console.log(`Servidor STOMP/SockJS corriendo en http://localhost:${PORT}`)
  console.log(`  WS   /ws/match                  → STOMP sobre SockJS (stompjs frontend)`)
  console.log(`  GET  /api/match`)
  console.log(`  PUT  /api/match/:id`)
  console.log(`  POST /api/match/:id/reset`)
  console.log(`  GET  /api/events`)
  console.log(`  POST /api/events`)
  console.log(`  GET  /api/users/connected`)
  console.log(`  POST /admin/reset              (requiere x-admin-secret)`)
  console.log(`  GET  /health`)
})
