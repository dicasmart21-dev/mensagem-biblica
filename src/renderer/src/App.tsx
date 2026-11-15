import { useEffect, useState } from 'react'
import type { Settings } from '../../shared/api'
import { SettingsView } from './SettingsView'
import { Today } from './Today'

type Tab = 'today' | 'settings'

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [tab, setTab] = useState<Tab>('today')

  useEffect(() => {
    void window.api.getSettings().then(setSettings)
  }, [])

  if (!settings) return <main className="page" />

  return (
    <main className="page">
      <header className="top">
        <h1>Palavra Diária</h1>
        <nav>
          <button className={tab === 'today' ? 'tab on' : 'tab'} onClick={() => setTab('today')}>
            Hoje
          </button>
          <button className={tab === 'settings' ? 'tab on' : 'tab'} onClick={() => setTab('settings')}>
            Configurações
          </button>
        </nav>
      </header>

      {tab === 'today' ? (
        <Today settings={settings} onOpenSettings={() => setTab('settings')} />
      ) : (
        <SettingsView settings={settings} onChange={setSettings} />
      )}
    </main>
  )
}
