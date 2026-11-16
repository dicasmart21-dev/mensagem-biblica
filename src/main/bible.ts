import { app } from 'electron'
import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import type { Settings } from '../shared/api'
import { parseBible, type ImportedBible } from '../shared/bibleImport'
import { BOOKS } from '../shared/books'
import { getSettings, setImportedBible } from './settings'

const MAX_IMPORT_BYTES = 60 * 1024 * 1024

const importedFile = (): string => join(app.getPath('userData'), 'biblia-importada.json')

let importedCache: ImportedBible | null = null

function imported(): ImportedBible {
  importedCache ??= JSON.parse(readFileSync(importedFile(), 'utf8')) as ImportedBible
  return importedCache
}

function chapterVerses(bookId: string, chapter: number): string[] {
  const index = BOOKS.findIndex((b) => b.id === bookId)
  if (index < 0) throw new Error(`Livro inválido: ${bookId}`)
  let chapters: string[][]
  if (getSettings().bible.source === 'imported') {
    try {
      chapters = imported().books[index]
    } catch {
      throw new Error('Não foi possível ler a Bíblia importada. Importe o arquivo de novo nas Configurações.')
    }
  } else {
    const path = join(app.getAppPath(), 'resources', 'biblia', `${bookId}.json`)
    chapters = JSON.parse(readFileSync(path, 'utf8')) as string[][]
  }
  const verses = chapters?.[chapter - 1]
  if (!verses) throw new Error(`Capítulo não encontrado: ${bookId} ${chapter}`)
  return verses
}

/**
 * Texto de um capítulo na tradução em uso, um versículo por linha, com o número na frente.
 * Versículos sem texto nesta tradução (unidos ao anterior) são omitidos.
 */
export function chapterText(bookId: string, chapter: number): string {
  return chapterVerses(bookId, chapter)
    .map((text, i) => (text ? `${i + 1} ${text}` : ''))
    .filter(Boolean)
    .join('\n')
}

/** Importa um arquivo JSON de Bíblia para a pasta de dados do usuário e passa a usá-lo. */
export function importBibleFile(path: string): Settings {
  if (statSync(path).size > MAX_IMPORT_BYTES) throw new Error('O arquivo é grande demais para ser uma Bíblia em JSON.')
  let json: unknown
  try {
    json = JSON.parse(readFileSync(path, 'utf8').replace(/^﻿/, ''))
  } catch {
    throw new Error('O arquivo não é um JSON válido.')
  }
  const bible = parseBible(json, basename(path, extname(path)))
  const target = importedFile()
  writeFileSync(`${target}.tmp`, JSON.stringify(bible))
  renameSync(`${target}.tmp`, target)
  importedCache = bible
  return setImportedBible(bible.name)
}

/** Apaga a Bíblia importada e volta para a embutida. */
export function removeImportedBible(): Settings {
  rmSync(importedFile(), { force: true })
  importedCache = null
  return setImportedBible(null)
}
