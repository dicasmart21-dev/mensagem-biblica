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
  }, [first, last])

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
      <p className="hint">Clique em um dia para ver, gerar ou editar os textos, inclusive de dias futuros.</p>
    </section>
  )
}
