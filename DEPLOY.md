# Guía de Despliegue — Coolify en Hetzner

Tiempo estimado: 30–45 minutos la primera vez.

---

## Prerequisitos

- VPS en Hetzner (mínimo **CX22**, 2 vCPU / 4 GB RAM — ~4 €/mes)
- Coolify instalado en el VPS
- Dominio o subdominio apuntando a la IP del VPS (opcional pero recomendado)
- Repositorio Git con este código (GitHub, GitLab o Gitea)

---

## Paso 1 — Crear el VPS en Hetzner

1. Entra a [hetzner.com/cloud](https://www.hetzner.com/cloud) y crea un proyecto.
2. Crea un servidor:
   - **Tipo:** CX22 (2 vCPU / 4 GB RAM)
   - **Imagen:** Ubuntu 24.04
   - **Región:** cualquiera cercana a tu ubicación
   - **SSH Key:** agrega tu clave pública (la necesitas para acceder)
3. Anota la IP del servidor.

---

## Paso 2 — Instalar Coolify

Conéctate al VPS por SSH:

```bash
ssh root@<IP-del-VPS>
```

Instala Coolify con el script oficial:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Cuando termine (puede tomar 5–10 minutos), abre en el navegador:

```
http://<IP-del-VPS>:8000
```

Crea tu cuenta de administrador en el wizard inicial.

---

## Paso 3 — Subir el código a GitHub

En tu máquina local, desde la carpeta `server-publico/`:

```bash
# Inicializar repo si no lo tienes ya
git init
git add .
git commit -m "feat: servidor público de partido en vivo"

# Crear repo en GitHub y hacer push
gh repo create match-realtime-server --public --source=. --push
# O manualmente: crear el repo en github.com y seguir las instrucciones
```

---

## Paso 4 — Conectar Coolify a GitHub

En el panel de Coolify:

1. Ve a **Sources** → **Add a new source** → **GitHub App**
2. Sigue el wizard para autorizar el acceso a tu cuenta de GitHub
3. Selecciona el repositorio `match-realtime-server`

---

## Paso 5 — Crear el servicio en Coolify

1. Ve a **Projects** → **New Project** → dale un nombre (ej: `clase-realtime`)
2. Dentro del proyecto, clic en **New Resource** → **Docker Compose**
3. Selecciona el repositorio y la rama `main`
4. Coolify detecta el `docker-compose.yml` automáticamente

**Configurar variables de entorno** (en el panel de Coolify, antes de hacer deploy):

| Variable | Valor |
|----------|-------|
| `PORT` | `8080` |
| `MATCH_NAME` | `Real Madrid vs Barcelona` |
| `ADMIN_SECRET` | `una-clave-segura-para-clase` |

5. En **Domains**, configura el dominio o subdominio (ej: `match.tudominio.com`)
   - Coolify provisiona SSL automáticamente con Let's Encrypt
   - Si no tienes dominio, puedes usar la IP directamente en `http://IP:8080`

6. Clic en **Deploy**

---

## Paso 6 — Verificar el despliegue

Cuando el deploy termine (2–3 minutos), verifica en el navegador:

```
https://match.tudominio.com/health
```

Deberías ver:

```json
{ "status": "ok", "clients": 0 }
```

Verifica también los endpoints:

```
https://match.tudominio.com/api/match
https://match.tudominio.com/api/events
```

---

## Paso 7 — Compartir con los estudiantes

Comparte en clase (chat, proyector, o pizarrón):

```
VITE_API_URL=https://match.tudominio.com
```

Cada estudiante crea su `.env.local` con esa línea y ejecuta `npm run dev`.

---

## Antes de cada clase: resetear el estado

Para empezar la clase con el partido en 0-0 y sin eventos viejos:

```bash
curl -X POST https://match.tudominio.com/admin/reset \
  -H "x-admin-secret: tu-clave-segura"
```

Respuesta esperada:
```json
{ "ok": true, "message": "Estado reiniciado" }
```

También puedes hacer esto desde Postman, Insomnia, o cualquier cliente HTTP.

---

## Mantenimiento

### Ver logs en tiempo real

En Coolify: **Projects** → tu proyecto → **Logs**

O desde el VPS:

```bash
docker compose logs -f
```

### Reiniciar el servicio

En Coolify: botón **Restart** en el panel del servicio.

### Actualizar el código

1. Haz `git push` desde tu máquina
2. En Coolify: **Redeploy** (o activa el webhook automático desde la configuración del repo)

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|---------------|----------|
| `/health` no responde | Container no arrancó | Ver logs en Coolify |
| CORS error en el frontend | URL incorrecta en `VITE_API_URL` | Verificar que no tiene `/` al final |
| WebSocket no conecta | Proxy no pasa WebSocket | En Coolify, activar **WebSocket support** en la configuración del dominio |
| Estado se pierde al restart | Normal — estado en memoria | Llamar `/admin/reset` para reinicializar |
| `401 No autorizado` en reset | Header incorrecto | Verificar que `x-admin-secret` coincide con `ADMIN_SECRET` |

---

## WebSocket a través de proxy (importante)

Coolify usa Traefik como reverse proxy. Para que Socket.io funcione, el proxy debe pasar el WebSocket upgrade.

En Coolify, al configurar el dominio del servicio, asegúrate de que está activa la opción:
- **WebSocket**: Enable (o "Upgrade")

Si no aparece en la UI, agrégalo como label en `docker-compose.yml`:

```yaml
labels:
  - "traefik.http.middlewares.match-ws.headers.customrequestheaders.X-Forwarded-Proto=https"
```

---

## Arquitectura final en producción

```
Estudiante → HTTPS → Hetzner VPS
                          │
                     Coolify / Traefik (reverse proxy + SSL)
                          │
                     Docker Container (Node.js + Express + Socket.io)
                          │
                     Estado en memoria (match + events)
```
