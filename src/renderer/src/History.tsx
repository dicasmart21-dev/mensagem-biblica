import { useEffect, useState } from 'react'
import type { EntryStatus, EntrySummary, Settings } from '../../shared/api'
import { dateForDayNumber, referenceForDay } from '../../shared/rotation'

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })

export interface HistoryFilter {
  query: string
  status: EntryStatus | 'all'
}

interface Props {
  settings: Settings
  /** Fica no App para a busca continuar lá depois de abrir um dia e voltar. */
  filter: HistoryFilter
  onFilterChange(filter: HistoryFilter): void
  onOpenDay(day: number): void
}

export function History({ settings, filter, onFilterChange, onOpenDay }: Props) {
  const [results, setResults] = useState<EntrySummary[] | null>(null)

  useEffect(() => {
    let current = true
    void window.api.searchEntries(filter.query, filter.status).then((found) => {
      if (current) setResults(found)
    })
    return () => {
      current = false
    }
  }, [filter.query, filter.status])

  const [exported, setExported] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function exportResults() {
    const outcome = await window.api.exportEntries(filter.query, filter.status)
    if (!outcome) return
    setExported(
      outcome.ok
        ? { kind: 'ok', text: `${outcome.value.count} ${outcome.value.count === 1 ? 'dia exportado' : 'dias exportados'} para ${outcome.value.path}` }
        : { kind: 'error', text: `Não foi possível exportar: ${outcome.error}` }
    )
  }

  const filtering = filter.query.trim() !== '' || filter.status !== 'all'

  return (
    <section>
      <div className="row history-filter">
        <input
          type="search"
          placeholder="Buscar por livro ou por palavras dos textos"
          aria-label="Buscar no histórico"
          value={filter.query}
          onChange={(e) => onFilterChange({ ...filter, query: e.target.value })}
        />
        <select
          aria-label="Estado"
          value={filter.status}
          onChange={(e) => onFilterChange({ ...filter, status: e.target.value as HistoryFilter['status'] })}
        >
          <option value="all">Todos</option>
          <option value="draft">Rascunhos</option>
          <option value="approved">Aprovados</option>
        </select>
      </div>

      {results === null ? null : results.length === 0 ? (
        <p className="hint empty">
          {filtering ? 'Nenhum dia encontrado com esse filtro.' : 'Ainda não há textos gerados. Comece pela tela Hoje.'}
        </p>
      ) : (
        <>
          <div className="history-count">
            <p className="hint">
              {results.length} {results.length === 1 ? 'dia' : 'dias'}
            </p>
            <button onClick={() => void exportResults()}>Exportar…</button>
          </div>
          {exported ? <p className={exported.kind === 'ok' ? 'saved' : 'error'}>{exported.text}</p> : null}
          <ul className="history">
            {results.map((r) => (
              <li key={r.day}>
                <button onClick={() => onOpenDay(r.day)}>
                  <span className="when">{shortDate.format(new Date(`${dateForDayNumber(settings.startDate, r.day)}T00:00:00Z`))}</span>
                  <span className="history-main">
                    <strong>{referenceForDay(r.day).label}</strong>
                    <span className="history-impact">{r.impact}</span>
                  </span>
                  <span className={r.status === 'approved' ? 'badge approved' : 'badge'}>
                    {r.status === 'approved' ? 'Aprovado' : 'Rascunho'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
