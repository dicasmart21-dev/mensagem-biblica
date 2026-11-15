import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/api'
import {
  TOTAL_DAYS,
  cycleForDay,
  dateForDayNumber,
  dayNumberForDate,
  referenceForDay,
  todayIso
} from '../../shared/rotation'

const longDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})
const shortDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC'
})
const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const UPCOMING = 14

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todayIso()

  useEffect(() => {
    window.api.getSettings().then(setSettings, (e) => setError(String(e)))
  }, [])

  async function changeStartDate(value: string) {
    if (!value) return
    try {
      setSettings(await window.api.setStartDate(value))
      setError(null)
    } catch {
      setError('Não foi possível salvar a data de início.')
    }
  }

  if (!settings) {
    return <main className="page">{error ? <p className="error">{error}</p> : null}</main>
  }

  const day = dayNumberForDate(settings.startDate, today)

  return (
    <main className="page">
      <header className="top">
        <h1>Palavra Diária</h1>
        <label className="start">
          Dia 1 em
          <input
            type="date"
            value={settings.startDate}
            onChange={(e) => void changeStartDate(e.target.value)}
          />
        </label>
      </header>

      {error ? <p className="error">{error}</p> : null}

      {day === null ? (
        <section className="today">
          <p className="eyebrow">{longDate.format(asDate(today))}</p>
          <h2>A sequência ainda não começou</h2>
          <p className="meta">
            O dia 1 (Gênesis 1) será em {longDate.format(asDate(settings.startDate))}.
          </p>
        </section>
      ) : (
        <>
          <section className="today">
            <p className="eyebrow">Hoje · {longDate.format(asDate(today))}</p>
            <h2>{referenceForDay(day).label}</h2>
            <p className="meta">
              Dia {((day - 1) % TOTAL_DAYS) + 1} de {TOTAL_DAYS}
              {cycleForDay(day) > 1 ? ` · ${cycleForDay(day)}º ciclo` : ''}
            </p>
          </section>

          <section>
            <h3>Próximos dias</h3>
            <ol className="upcoming">
              {Array.from({ length: UPCOMING }, (_, i) => day + 1 + i).map((n) => (
                <li key={n}>
                  <span className="when">
                    {shortDate.format(asDate(dateForDayNumber(settings.startDate, n)))}
                  </span>
                  <span className="ref">{referenceForDay(n).label}</span>
                  <span className="num">dia {n}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </main>
  )
}
