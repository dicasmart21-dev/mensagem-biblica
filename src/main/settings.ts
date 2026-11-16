import { app, safeStorage } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_MODEL, MODELS, type ModelId, type Settings } from '../shared/api'
import { dayNumberForDate, todayIso } from '../shared/rotation'

/** O que fica gravado em settings.json. A chave da API só aparece cifrada. */
interface Stored {
  startDate: string
  model: ModelId
  /** Chave da API cifrada pelo cofre do sistema operacional, em base64. */
  apiKeyEnc?: string
  /** Nome da Bíblia importada em uso; ausente quando vale a embutida. */
  importedBible?: string
}

/** Nome da tradução embutida no app. */
export const EMBEDDED_BIBLE = 'Bíblia Livre'

const file = (): string => join(app.getPath('userData'), 'settings.json')

function save(stored: Stored): Stored {
  const path = file()
  mkdirSync(dirname(path), { recursive: true })
  // Grava em arquivo temporário e renomeia, para nunca deixar o arquivo pela metade.
  writeFileSync(`${path}.tmp`, JSON.stringify(stored, null, 2))
  renameSync(`${path}.tmp`, path)
  return stored
}

const isModel = (value: unknown): value is ModelId => MODELS.some((m) => m.id === value)

function isDate(value: unknown): value is string {
  try {
    return typeof value === 'string' && dayNumberForDate(value, value) === 1
  } catch {
    return false
  }
}

/** Lê o arquivo; na primeira abertura, o dia 1 passa a ser hoje. */
function load(): Stored {
  let parsed: Partial<Stored> | null = null
  try {
    parsed = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Stored>
  } catch {
    // arquivo ausente ou ilegível: começa do zero
  }
  if (parsed && isDate(parsed.startDate)) {
    return {
      startDate: parsed.startDate,
      model: isModel(parsed.model) ? parsed.model : DEFAULT_MODEL,
      ...(typeof parsed.apiKeyEnc === 'string' ? { apiKeyEnc: parsed.apiKeyEnc } : {}),
      ...(typeof parsed.importedBible === 'string' ? { importedBible: parsed.importedBible } : {})
    }
  }
  return save({ startDate: todayIso(), model: DEFAULT_MODEL })
}

/** Chave da API em texto claro, só para uso dentro do processo principal. */
export function getApiKey(): string | null {
  const { apiKeyEnc } = load()
  if (apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(apiKeyEnc, 'base64'))
    } catch {
      return null
    }
  }
  return process.env.ANTHROPIC_API_KEY || null
}

const toPublic = (stored: Stored): Settings => ({
  startDate: stored.startDate,
  model: stored.model,
  hasApiKey: getApiKey() !== null,
  bible: stored.importedBible
    ? { source: 'imported', name: stored.importedBible }
    : { source: 'embedded', name: EMBEDDED_BIBLE }
})

export const getSettings = (): Settings => toPublic(load())

export function setStartDate(startDate: string): Settings {
  if (!isDate(startDate)) throw new Error('Data de início inválida.')
  return toPublic(save({ ...load(), startDate }))
}

export function setModel(model: string): Settings {
  if (!isModel(model)) throw new Error('Modelo desconhecido.')
  return toPublic(save({ ...load(), model }))
}

export function setApiKey(apiKey: string): Settings {
  const { apiKeyEnc: _removed, ...rest } = load()
  const trimmed = apiKey.trim()
  if (!trimmed) return toPublic(save(rest))
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      'Este sistema não tem um cofre de senhas disponível para guardar a chave com segurança.'
    )
  }
  return toPublic(save({ ...rest, apiKeyEnc: safeStorage.encryptString(trimmed).toString('base64') }))
}

/** Passa a usar a Bíblia importada com este nome; `null` volta para a embutida. */
export function setImportedBible(name: string | null): Settings {
  const { importedBible: _removed, ...rest } = load()
  return toPublic(save(name ? { ...rest, importedBible: name } : rest))
}
