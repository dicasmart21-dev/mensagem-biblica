import { useEffect, useState } from 'react'
import { MODELS, type Entry, type Settings } from '../../shared/api'
import {
  TOTAL_DAYS,
  cycleForDay,
  dateForDayNumber,
  dayNumberForDate,
  referenceForDay,
  todayIso
} from '../../shared/rotation'
import { X_MAX, countWords, findIssues, xLength } from '../../shared/validate'

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
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const UPCOMING = 14

interface Props {
  settings: Settings
  onOpenSettings(): void
}

export function Today({ settings, onOpenSettings }: Props) {
  const today = todayIso()
  const day = dayNumberForDate(settings.startDate, today)

  const [entry, setEntry] = useState<Entry | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoaded(false)
    setEntry(null)
    setError(null)
    if (day === null) return
    let current = true
    void window.api.getEntry(day).then((found) => {
      if (!current) return
      setEntry(found)
      setLoaded(true)
    })
    return () => {
      current = false
    }
  }, [day])

  if (day === null) {
    return (
      <section className="card">
        <p className="eyebrow">{longDate.format(asDate(today))}</p>
        <h2>A sequência ainda não começou</h2>
        <p className="meta">O dia 1 (Gênesis 1) será em {longDate.format(asDate(settings.startDate))}.</p>
      </section>
    )
  }

  async function generate() {
    if (day === null) return
    setBusy(true)
    setError(null)
    const outcome = await window.api.generate(day)
    setBusy(false)
    if (outcome.ok) setEntry(outcome.value)
    else setError(outcome.error)
  }

  const ref = referenceForDay(day)
  const issues = entry ? findIssues(entry.texts) : []
  const modelName = entry ? (MODELS.find((m) => m.id === entry.model)?.name ?? entry.model).replace(/ \(.*\)$/, '') : ''

  return (
    <>
      <section className="card">
        <p className="eyebrow">Hoje · {longDate.format(asDate(today))}</p>
        <h2>{ref.label}</h2>
        <p className="meta">
          Dia {((day - 1) % TOTAL_DAYS) + 1} de {TOTAL_DAYS}
          {cycleForDay(day) > 1 ? ` · ${cycleForDay(day)}º ciclo` : ''}
        </p>

        {loaded ? (
          <div className="actions">
            {settings.hasApiKey ? (
              <button className="primary" disabled={busy} onClick={() => void generate()}>
                {busy ? 'Gerando…' : entry ? 'Gerar de novo' : 'Gerar textos de hoje'}
              </button>
            ) : (
              <button className="primary" onClick={onOpenSettings}>
                Informar a chave da API
              </button>
            )}
            {busy ? <span className="hint">Pode levar um ou dois minutos.</span> : null}
            {!settings.hasApiKey ? (
              <span className="hint">Para gerar os textos, o app precisa da sua chave da API do Claude.</span>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {entry ? (
        <section className="texts">
          {issues.length > 0 ? (
            <ul className="issues">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}

          <article>
            <h3>Frase de impacto</h3>
            <p className="impact">{entry.texts.impact}</p>
          </article>
          <article>
            <h3>
              Post para o X <span className="count">{xLength(entry.texts.xPost)}/{X_MAX}</span>
            </h3>
            <p className="body">{entry.texts.xPost}</p>
          </article>
          <article>
            <h3>
              Legenda do Instagram <span className="count">{countWords(entry.texts.instagram)} palavras</span>
            </h3>
            <p className="body">{entry.texts.instagram}</p>
          </article>
          <article>
            <h3>
              Reflexão <span className="count">{countWords(entry.texts.reflection)} palavras</span>
            </h3>
            <p className="body reflection">{entry.texts.reflection}</p>
          </article>
          <p className="meta">
            Rascunho gerado em {dateTime.format(new Date(entry.generatedAt))} com {modelName}.
          </p>
        </section>
      ) : null}

      <section>
        <h3>Próximos dias</h3>
        <ol className="upcoming">
          {Array.from({ length: UPCOMING }, (_, i) => day + 1 + i).map((n) => (
            <li key={n}>
              <span className="when">{shortDate.format(asDate(dateForDayNumber(settings.startDate, n)))}</span>
              <span className="ref">{referenceForDay(n).label}</span>
              <span className="num">dia {n}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
