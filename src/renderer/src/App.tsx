import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/api'
import { todayIso } from '../../shared/rotation'
import { Calendar } from './Calendar'
import { DayView } from './DayView'
import { History, type HistoryFilter } from './History'
import { SettingsView } from './SettingsView'

type Tab = 'today' | 'calendar' | 'history' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'calendar', label: 'Calendário' },
  { id: 'history', label: 'Histórico' },
  { id: 'settings', label: 'Configurações' }
]

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<Tab>('today')
  /** Dia aberto a partir do calendário ou do histórico. */
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [month, setMonth] = useState(() => todayIso().slice(0, 7))
  const [filter, setFilter] = useState<HistoryFilter>({ query: '', status: 'all' })

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  if (!settings) return <main className="page" />

  function go(next: Tab) {
    setOpenDay(null)
    setTab(next)
  }

  const browsing = tab === 'calendar' || tab === 'history'

  return (
    <main className="page">
      <header className="top">
        <h1>Palavra Diária</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      {tab === 'today' ? (
        <DayView
          settings={settings}
          onOpenSettings={() => go('settings')}
          onOpenDay={(day) => {
            setTab('calendar')
            setOpenDay(day)
          }}
        />
      ) : browsing && openDay !== null ? (
        <DayView
          settings={settings}
          day={openDay}
          onOpenSettings={() => go('settings')}
          onBack={() => setOpenDay(null)}
        />
      ) : tab === 'calendar' ? (
        <Calendar settings={settings} month={month} onMonthChange={setMonth} onOpenDay={setOpenDay} />
      ) : tab === 'history' ? (
        <History settings={settings} filter={filter} onFilterChange={setFilter} onOpenDay={setOpenDay} />
      ) : (
        <SettingsView settings={settings} onChange={setSettings} />
      )}
    </main>
  )
}
