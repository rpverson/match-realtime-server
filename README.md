# Servidor Público — Panel de Partido en Vivo

Reemplaza el backend Spring Boot local por un servidor Express + Socket.io
desplegado en Hetzner + Coolify. Elimina los problemas de:

- Versiones de JDK incompatibles entre equipos
- PCs que no se ven en la misma subred
- Diferencias entre macOS / Linux / Windows

---

## Estructura

```
server-publico/
├── DEPLOY.md              ← guía de despliegue en Hetzner + Coolify
├── docker-compose.yml     ← para Coolify
├── server/
│   ├── server.js          ← Express + Socket.io (toda la lógica)
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
└── frontend-patch/
    ├── CAMBIOS.md         ← qué archivos cambiar vs versión Spring Boot
    ├── package.json       ← socket.io-client en lugar de stompjs
    ├── src/
    │   ├── App.jsx        ← useEffect simplificado (sin async)
    │   └── lib/
    │       └── apiClient.js ← socket.io en lugar de stompjs
```

---

## Lo que cambia respecto al backend Spring Boot

| Aspecto | Spring Boot | Este servidor |
|---------|-------------|---------------|
| Runtime | JVM | Node.js 20 |
| WebSocket | STOMP (stompjs) | Socket.io |
| BD | H2 / MySQL | Estado en memoria |
| Despliegue | Local en cada equipo | Un servidor central en la nube |
| Frontend lib | stompjs | socket.io-client |

Los componentes visuales React (Scoreboard, EventFeed, NewEventForm) son **idénticos**.

---

## Inicio rápido (local para probar)

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

Servidor en http://localhost:8080

---

## Despliegue en producción

Ver [DEPLOY.md](DEPLOY.md).

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/match` | Estado actual del partido |
| PUT | `/api/match/:id` | Actualizar marcador |
| POST | `/api/match/:id/reset` | Reiniciar marcador |
| GET | `/api/events` | Lista de eventos |
| POST | `/api/events` | Agregar evento |
| GET | `/api/users/connected` | Clientes conectados |
| POST | `/admin/reset` | Reset completo (requiere header) |
| GET | `/health` | Health check |

## Eventos Socket.io

| Evento (servidor → cliente) | Cuándo se emite |
|----------------------------|-----------------|
| `match:update` | PUT o reset del marcador |
| `match:event` | POST de nuevo evento |
| `match:reset` | POST /admin/reset |
| `chat:message` | Cuando un cliente emite `chat:send` |
