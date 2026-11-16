import { useEffect, useState } from 'react'
import { MODELS, TEXT_FIELDS, type Entry, type Settings, type TextField, type Texts } from '../../shared/api'
import {
  TOTAL_DAYS,
  cycleForDay,
  dateForDayNumber,
  dayNumberForDate,
  referenceForDay,
  todayIso
} from '../../shared/rotation'
import { X_MAX, approvalBlockers, countWords, findIssues, xLength } from '../../shared/validate'

const longDate = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC'
})
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const asDate = (iso: string): Date => new Date(`${iso}T00:00:00Z`)

const FIELDS: Record<TextField, { title: string; rows: number; count(text: string): string }> = {
  impact: { title: 'Frase de impacto', rows: 2, count: (t) => `${[...t].length} caracteres` },
  xPost: { title: 'Post para o X', rows: 4, count: (t) => `${xLength(t)}/${X_MAX}` },
  instagram: { title: 'Legenda do Instagram', rows: 9, count: (t) => `${countWords(t)} palavras` },
  reflection: { title: 'Reflexão', rows: 26, count: (t) => `${countWords(t)} palavras` }
}

const sameTexts = (a: Texts, b: Texts): boolean => TEXT_FIELDS.every((f) => a[f] === b[f])

interface Props {
  settings: Settings
  /** Dia da sequência a mostrar; sem isso, mostra o dia de hoje. */
  day?: number
  onOpenSettings(): void
  /** Quando presente, mostra um botão para voltar à tela anterior. */
  onBack?(): void
}

export function DayView({ settings, day: chosen, onOpenSettings, onBack }: Props) {
  const today = todayIso()
  const todayNumber = dayNumberForDate(settings.startDate, today)
  const day = chosen ?? todayNumber
  const date = day === null ? today : dateForDayNumber(settings.startDate, day)
  const isToday = day !== null && day === todayNumber

  const [entry, setEntry] = useState<Entry | null>(null)
  /** Textos como estão na tela, incluindo edições ainda não salvas. */
  const [texts, setTexts] = useState<Texts | null>(null)
  const [loaded, setLoaded] = useState(false)
  /** O que está em andamento: 'all' = gerando tudo; um campo = reescrevendo só ele. */
  const [busy, setBusy] = useState<'all' | TextField | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<TextField | null>(null)

  function show(next: Entry | null) {
    setEntry(next)
    setTexts(next ? next.texts : null)
  }

  useEffect(() => {
    setLoaded(false)
    show(null)
    setError(null)
    if (day === null) return
    let current = true
    void window.api.getEntry(day).then((found) => {
      if (!current) return
      show(found)
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

  const dayNumber = day
  const dirty = entry !== null && texts !== null && !sameTexts(entry.texts, texts)

  /** Roda uma ação que devolve o dia atualizado; mostra o erro se falhar. */
  async function run(action: Promise<{ ok: true; value: Entry } | { ok: false; error: string }>): Promise<boolean> {
    const outcome = await action
    if (outcome.ok) {
      show(outcome.value)
      setError(null)
    } else {
      setError(outcome.error)
    }
    return outcome.ok
  }

  /** Salva edições pendentes. Devolve false se não conseguiu salvar. */
  async function flush(): Promise<boolean> {
    if (!dirty || !texts) return true
    return run(window.api.saveTexts(dayNumber, texts))
  }

  async function generateAll() {
    if (entry && !window.confirm('Gerar de novo substitui os quatro textos atuais, incluindo suas edições. Continuar?')) {
      return
    }
    setBusy('all')
    await run(window.api.generate(dayNumber))
    setBusy(null)
  }

  async function regenerate(field: TextField) {
    setBusy(field)
    if (await flush()) await run(window.api.regenerateText(dayNumber, field))
    setBusy(null)
  }

  async function approve() {
    if (await flush()) await run(window.api.approve(dayNumber))
  }

  async function copy(field: TextField) {
    if (!texts) return
    await window.api.copyText(texts[field])
    setCopied(field)
    setTimeout(() => setCopied((current) => (current === field ? null : current)), 1500)
  }

  const ref = referenceForDay(day)
  const approved = entry?.status === 'approved'
  const issues = texts ? findIssues(texts) : []
  const blockers = texts ? approvalBlockers(texts) : []
  const modelName = entry ? (MODELS.find((m) => m.id === entry.model)?.name ?? entry.model).replace(/ \(.*\)$/, '') : ''

  return (
    <>
      {onBack ? (
        <button className="back" onClick={onBack}>
          ← Voltar
        </button>
      ) : null}
      <section className="card">
        <p className="eyebrow">
          {isToday ? 'Hoje · ' : ''}
          {longDate.format(asDate(date))}
          {entry ? <span className={approved ? 'badge approved' : 'badge'}>{approved ? 'Aprovado' : 'Rascunho'}</span> : null}
        </p>
        <h2>{ref.label}</h2>
        <p className="meta">
          Dia {((day - 1) % TOTAL_DAYS) + 1} de {TOTAL_DAYS}
          {cycleForDay(day) > 1 ? ` · ${cycleForDay(day)}º ciclo` : ''} · {settings.bible.name}
        </p>

        {loaded ? (
          <div className="actions">
            {approved ? (
              <button disabled={busy !== null} onClick={() => void run(window.api.reopen(dayNumber))}>
                Reabrir para editar
              </button>
            ) : !settings.hasApiKey ? (
              <button className="primary" onClick={onOpenSettings}>
                Informar a chave da API
              </button>
            ) : entry ? (
              <>
                <button
                  className="primary"
                  disabled={busy !== null || blockers.length > 0}
                  onClick={() => void approve()}
                >
                  Aprovar
                </button>
                <button disabled={busy !== null} onClick={() => void generateAll()}>
                  {busy === 'all' ? 'Gerando…' : 'Gerar tudo de novo'}
                </button>
              </>
            ) : (
              <button className="primary" disabled={busy !== null} onClick={() => void generateAll()}>
                {busy === 'all' ? 'Gerando…' : isToday ? 'Gerar textos de hoje' : 'Gerar textos deste dia'}
              </button>
            )}
            {busy ? <span className="hint">Pode levar um ou dois minutos.</span> : null}
            {!settings.hasApiKey && !approved ? (
              <span className="hint">Para gerar os textos, o app precisa da sua chave da API do Claude.</span>
            ) : null}
            {approved && entry?.approvedAt ? (
              <span className="hint">Aprovado em {dateTime.format(new Date(entry.approvedAt))}.</span>
            ) : null}
          </div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {entry && texts ? (
        <section className="texts">
          {issues.length > 0 ? (
            <ul className="issues">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}

          {TEXT_FIELDS.map((field) => (
            <article key={field}>
              <h3>
                {FIELDS[field].title} <span className="count">{FIELDS[field].count(texts[field])}</span>
              </h3>
              {approved ? (
                <p className={`body ${field}`}>{texts[field]}</p>
              ) : (
                <textarea
                  className={`body ${field}`}
                  aria-label={FIELDS[field].title}
                  rows={FIELDS[field].rows}
                  value={texts[field]}
                  disabled={busy !== null}
                  onChange={(e) => setTexts({ ...texts, [field]: e.target.value })}
                  onBlur={() => void flush()}
                />
              )}
              <div className="tools">
                <button onClick={() => void copy(field)}>{copied === field ? 'Copiado' : 'Copiar'}</button>
                {!approved && settings.hasApiKey ? (
                  <button disabled={busy !== null} onClick={() => void regenerate(field)}>
                    {busy === field ? 'Reescrevendo…' : 'Reescrever este texto'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          <p className="meta">
            Gerado em {dateTime.format(new Date(entry.generatedAt))} com {modelName}
            {dirty ? ' · edições ainda não salvas' : ''}.
          </p>
        </section>
      ) : null}
    </>
  )
}
