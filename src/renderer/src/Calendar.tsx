import { useEffect, useState } from 'react'
import type { EntryStatus, Settings } from '../../shared/api'
import { dayNumberForDate, referenceForDay, todayIso } from '../../shared/rotation'

const monthTitle = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const iso = (year: number, month: number, date: number): string =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`

interface Props {
  settings: Settings
  /** Mês mostrado, como "AAAA-MM"; fica no App para sobreviver à ida e volta de um dia. */
  month: string
  onMonthChange(month: string): void
  onOpenDay(day: number): void
}

export function Calendar({ settings, month, onMonthChange, onOpenDay }: Props) {
  const today = todayIso()
  const [year, monthIndex] = [Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1]
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()

  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const date = iso(year, monthIndex, i + 1)
    return { date, number: i + 1, day: dayNumberForDate(settings.startDate, date) }
  })
  const first = cells.find((c) => c.day !== null)?.day ?? null
  const last = cells.at(-1)!.day

  const [reload, setReload] = useState(0)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [statuses, setStatuses] = useState<Record<number, EntryStatus>>({})
  useEffect(() => {
    setStatuses({})
    if (first === null || last === null) return
    let current = true
    void window.api.getStatuses(first, last).then((found) => {
      if (current) setStatuses(found)
    })
    return () => {
      current = false
    }
  }, [first, last, reload])

  async function exportRequest() {
    const outcome = await window.api.exportMonthlyRequest(month)
    if (!outcome) return
    setMessage(
      outcome.ok
        ? {
            kind: 'ok',
            text: `Pedido com ${outcome.value.count} ${outcome.value.count === 1 ? 'dia' : 'dias'} salvo em ${outcome.value.path}. Envie esse arquivo ao Claude no chat (com a skill Palavra Diária) e depois importe aqui o arquivo de textos que ele devolver.`
          }
        : { kind: 'error', text: outcome.error }
    )
  }

  async function importTexts() {
    const outcome = await window.api.importTexts()
    if (!outcome) return
    if (!outcome.ok) return setMessage({ kind: 'error', text: `Nada foi importado. ${outcome.error}` })
    const { imported, skipped, withIssues } = outcome.value
    setReload((n) => n + 1)
    setMessage({
      kind: 'ok',
      text: [
        `${imported} ${imported === 1 ? 'dia importado' : 'dias importados'} como rascunho.`,
        skipped > 0 ? `${skipped} já ${skipped === 1 ? 'tinha' : 'tinham'} textos e não ${skipped === 1 ? 'foi alterado' : 'foram alterados'}.` : '',
        withIssues > 0 ? `${withIssues} com aviso de tamanho; abra o dia para ver.` : ''
      ]
        .filter(Boolean)
        .join(' ')
    })
  }

  function shift(delta: number) {
    const moved = new Date(Date.UTC(year, monthIndex + delta, 1))
    onMonthChange(moved.toISOString().slice(0, 7))
  }

  return (
    <section>
      <div className="cal-head">
        <h2>{monthTitle.format(new Date(Date.UTC(year, monthIndex, 1)))}</h2>
        <div className="row">
          <button aria-label="Mês anterior" onClick={() => shift(-1)}>
            ‹
          </button>
          <button onClick={() => onMonthChange(today.slice(0, 7))}>Hoje</button>
          <button aria-label="Próximo mês" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="cal-grid">
        {WEEKDAYS.map((w) => (
          <div key={w} className="cal-weekday">
            {w}
          </div>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <div key={`pad${i}`} />
        ))}
        {cells.map((cell) => {
          const status = cell.day === null ? undefined : statuses[cell.day]
          const classes = ['cal-cell', cell.date === today ? 'today' : '', status ?? ''].join(' ')
          return cell.day === null ? (
            <div key={cell.date} className={`${classes} off`}>
              <span className="cal-date">{cell.number}</span>
            </div>
          ) : (
            <button key={cell.date} className={classes} onClick={() => onOpenDay(cell.day!)}>
              <span className="cal-date">{cell.number}</span>
              <span className="cal-ref">{referenceForDay(cell.day).label}</span>
              {status ? <span className="cal-status">{status === 'approved' ? 'Aprovado' : 'Rascunho'}</span> : null}
            </button>
          )
        })}
      </div>
      <div className="monthly">
        <div>
          <strong>Gerar o mês pelo chat</strong>
          <p className="hint">
            Sem custo de API: salve o pedido deste mês (só os dias ainda sem textos), envie ao Claude no chat e importe
            o arquivo que ele devolver.
          </p>
        </div>
        <div className="row">
          <button onClick={() => void exportRequest()}>Salvar pedido…</button>
          <button onClick={() => void importTexts()}>Importar textos…</button>
        </div>
      </div>
      {message ? <p className={message.kind === 'ok' ? 'saved' : 'error'}>{message.text}</p> : null}
      <p className="hint">Clique em um dia para ver, gerar ou editar os textos, inclusive de dias futuros.</p>
    </section>
  )
}
