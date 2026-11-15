import { app } from 'electron'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Settings } from '../shared/api'
import { dayNumberForDate, todayIso } from '../shared/rotation'

const file = (): string => join(app.getPath('userData'), 'settings.json')

function save(settings: Settings): Settings {
  const path = file()
  mkdirSync(dirname(path), { recursive: true })
  // Grava em arquivo temporário e renomeia, para nunca deixar o arquivo pela metade.
  writeFileSync(`${path}.tmp`, JSON.stringify(settings, null, 2))
  renameSync(`${path}.tmp`, path)
  return settings
}

/** Lê as configurações; na primeira abertura, o dia 1 passa a ser hoje. */
export function loadSettings(): Settings {
  try {
    const parsed = JSON.parse(readFileSync(file(), 'utf8')) as Partial<Settings>
    if (typeof parsed.startDate === 'string') {
      dayNumberForDate(parsed.startDate, parsed.startDate) // valida o formato
      return { startDate: parsed.startDate }
    }
  } catch {
    // arquivo ausente ou inválido: cai no padrão abaixo
  }
  return save({ startDate: todayIso() })
}

export function setStartDate(startDate: string): Settings {
  dayNumberForDate(startDate, startDate) // lança RangeError se a data for inválida
  return save({ ...loadSettings(), startDate })
}
