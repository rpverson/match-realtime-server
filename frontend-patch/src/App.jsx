import { useEffect, useState } from 'react'
import {
  fetchMatch,
  fetchEvents,
  updateScore,
  resetScore,
  addEvent,
  subscribeToUpdates,
} from './lib/apiClient'
import Scoreboard   from './components/Scoreboard'
import EventFeed    from './components/EventFeed'
import NewEventForm from './components/NewEventForm'

export default function App() {
  const [match,     setMatch]     = useState(null)
  const [events,    setEvents]    = useState([])
  const [error,     setError]     = useState(null)
  const [wsStatus,  setWsStatus]  = useState('conectando...')

  // ── Carga inicial ─────────────────────────────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const [matchData, eventsData] = await Promise.all([fetchMatch(), fetchEvents()])
        setMatch(matchData)
        setEvents(eventsData)
      } catch (err) {
        setError('No se puede conectar al servidor: ' + err.message)
      }
    }
    loadData()
  }, [])

  // ── WebSocket ─────────────────────────────────────────────
  // subscribeToUpdates ahora es síncrono (sin await) y devuelve
  // el cleanup directamente gracias a socket.io.
  useEffect(() => {
    const cleanup = subscribeToUpdates(
      (match)  => setMatch(match),
      (event)  => setEvents((prev) => {
        if (prev.some((e) => e.id === event.id)) return prev
        return [event, ...prev]
      }),
      (err)    => console.error('WebSocket error:', err),
      (status) => setWsStatus(status),
    )
    return cleanup
  }, [])

  // ── Acciones ──────────────────────────────────────────────
  async function goalHome() {
    if (!match) return
    try { await updateScore(match.id, match.homeScore + 1, match.awayScore) }
    catch (err) { setError(err.message) }
  }

  async function goalAway() {
    if (!match) return
    try { await updateScore(match.id, match.homeScore, match.awayScore + 1) }
    catch (err) { setError(err.message) }
  }

  async function handleReset() {
    if (!match) return
    try { await resetScore(match.id) }
    catch (err) { setError(err.message) }
  }

  async function handleAddEvent(eventType, minute, description) {
    try { return await addEvent(eventType, minute, description) }
    catch (err) { setError(err.message) }
  }

  // ── Render ────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ padding: '2rem', color: '#c0392b', fontFamily: 'sans-serif' }}>
        <strong>Error:</strong> {error}
        <p style={{ fontSize: '0.85rem', color: '#555' }}>
          Verifica que <code>VITE_API_URL</code> apunta al servidor correcto.
        </p>
      </div>
    )
  }

  if (!match) {
    return (
      <div style={{ padding: '2rem', fontFamily: 'sans-serif', color: '#555' }}>
        Conectando... ({wsStatus})
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '760px', margin: '2rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.1rem', color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Panel de Partido en Vivo
      </h1>
      <p style={{ fontSize: '0.8rem', color: '#aaa', margin: '0 0 1rem' }}>
        WebSocket: <span style={{ fontWeight: 'bold', color: wsStatus === 'conectado' ? '#4caf50' : '#e74c3c' }}>● {wsStatus}</span>
      </p>

      <Scoreboard
        match={match}
        onGoalHome={goalHome}
        onGoalAway={goalAway}
        onReset={handleReset}
      />

      <NewEventForm onAddEvent={handleAddEvent} />

      <EventFeed events={events} />
    </div>
  )
}
