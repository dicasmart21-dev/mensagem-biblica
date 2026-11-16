import { useState } from 'react'
import { MODELS, type ModelId, type Result, type Settings } from '../../shared/api'

interface Props {
  settings: Settings
  onChange(settings: Settings): void
}

export function SettingsView({ settings, onChange }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

  async function apply(request: Promise<Result<Settings>>, done: string) {
    const outcome = await request
    if (outcome.ok) {
      onChange(outcome.value)
      setMessage({ kind: 'ok', text: done })
    } else {
      setMessage({ kind: 'error', text: outcome.error })
    }
    return outcome.ok
  }

  async function saveKey() {
    if (await apply(window.api.setApiKey(apiKey), 'Chave salva.')) setApiKey('')
  }

  async function importBible() {
    const outcome = await window.api.importBible()
    if (!outcome) return
    if (outcome.ok) {
      onChange(outcome.value)
      setMessage({ kind: 'ok', text: `Bíblia importada: ${outcome.value.bible.name}.` })
    } else {
      setMessage({ kind: 'error', text: outcome.error })
    }
  }

  return (
    <section className="card settings">
      <div className="field">
        <label htmlFor="apiKey">Chave da API do Claude</label>
        <p className="hint">
          {settings.hasApiKey
            ? 'Há uma chave salva. Para trocar, cole a nova abaixo.'
            : 'Nenhuma chave salva. Crie uma em console.anthropic.com e cole aqui.'}{' '}
          A chave fica cifrada pelo cofre de senhas do seu sistema e só é usada para falar com a API do Claude.
        </p>
        <div className="row">
          <input
            id="apiKey"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="sk-ant-…"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <button className="primary" disabled={!apiKey.trim()} onClick={() => void saveKey()}>
            Salvar
          </button>
          {settings.hasApiKey ? (
            <button onClick={() => void apply(window.api.setApiKey(''), 'Chave apagada.')}>Apagar</button>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="model">Modelo</label>
        <select
          id="model"
          value={settings.model}
          onChange={(e) => void apply(window.api.setModel(e.target.value as ModelId), 'Modelo salvo.')}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Texto bíblico</label>
        <p className="hint">
          Em uso: <strong>{settings.bible.name}</strong>
          {settings.bible.source === 'embedded' ? ' (embutida no app)' : ' (importada por você)'}. Você pode importar
          outra tradução a partir de um arquivo JSON que tenha o direito de usar; ele fica só neste computador.
        </p>
        <div className="row">
          <button onClick={() => void importBible()}>Importar Bíblia…</button>
          {settings.bible.source === 'imported' ? (
            <button onClick={() => void apply(window.api.useEmbeddedBible(), 'De volta à Bíblia Livre.')}>
              Voltar para a Bíblia Livre
            </button>
          ) : null}
        </div>
      </div>

      <div className="field">
        <label htmlFor="startDate">Data do dia 1 (Gênesis 1)</label>
        <p className="hint">Mudar a data desloca o calendário; os textos já gerados continuam ligados ao seu capítulo.</p>
        <input
          id="startDate"
          type="date"
          value={settings.startDate}
          onChange={(e) => {
            if (e.target.value) void apply(window.api.setStartDate(e.target.value), 'Data salva.')
          }}
        />
      </div>

      {message ? <p className={message.kind === 'ok' ? 'saved' : 'error'}>{message.text}</p> : null}

      <p className="credits">
        Texto bíblico embutido: Bíblia Livre, baseada na tradução de João Ferreira de Almeida (1819), usada sob licença
        Creative Commons Atribuição 3.0 Brasil.
      </p>
    </section>
  )
}
