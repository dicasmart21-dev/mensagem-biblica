import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Entry, EntryStatus, EntrySummary, Texts } from '../shared/api'
import { referenceForDay } from '../shared/rotation'
import { matches } from '../shared/search'

let db: DatabaseSync | null = null

function open(): DatabaseSync {
  if (db) return db
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  db = new DatabaseSync(join(dir, 'palavra-diaria.db'))
  db.exec(`
    CREATE TABLE IF NOT EXISTS entries (
      day          INTEGER PRIMARY KEY,
      book_id      TEXT NOT NULL,
      chapter      INTEGER NOT NULL,
      status       TEXT NOT NULL DEFAULT 'draft',
      impact       TEXT NOT NULL,
      x_post       TEXT NOT NULL,
      instagram    TEXT NOT NULL,
      reflection   TEXT NOT NULL,
      model        TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      approved_at  TEXT
    )
  `)
  return db
}

type Row = Record<string, string | number | null>

const toEntry = (row: Row): Entry => ({
  day: row.day as number,
  bookId: row.book_id as string,
  chapter: row.chapter as number,
  status: row.status as EntryStatus,
  texts: {
    impact: row.impact as string,
    xPost: row.x_post as string,
    instagram: row.instagram as string,
    reflection: row.reflection as string
  },
  model: row.model as string,
  generatedAt: row.generated_at as string,
  updatedAt: row.updated_at as string,
  approvedAt: row.approved_at as string | null
})

export function getEntry(day: number): Entry | null {
  const row = open().prepare('SELECT * FROM entries WHERE day = ?').get(day) as Row | undefined
  return row ? toEntry(row) : null
}

export function getStatuses(fromDay: number, toDay: number): Record<number, EntryStatus> {
  const rows = open()
    .prepare('SELECT day, status FROM entries WHERE day BETWEEN ? AND ?')
    .all(fromDay, toDay) as Row[]
  return Object.fromEntries(rows.map((r) => [r.day, r.status])) as Record<number, EntryStatus>
}

/** Busca por livro/capítulo e pelo conteúdo dos quatro textos, do dia mais recente ao mais antigo. */
export function findEntries(query: string, status: EntryStatus | 'all'): Entry[] {
  const rows = open().prepare('SELECT * FROM entries ORDER BY day DESC').all() as Row[]
  return rows
    .map(toEntry)
    .filter((e) => status === 'all' || e.status === status)
    .filter((e) => matches([referenceForDay(e.day).label, ...Object.values(e.texts)].join('\n'), query))
}

export function searchEntries(query: string, status: EntryStatus | 'all'): EntrySummary[] {
  return findEntries(query, status).map((e) => ({
    day: e.day,
    status: e.status,
    impact: e.texts.impact,
    generatedAt: e.generatedAt,
    approvedAt: e.approvedAt
  }))
}

/** Grava textos recém-gerados como rascunho, substituindo o que houver para o dia. */
export function saveGenerated(
  day: number,
  bookId: string,
  chapter: number,
  texts: Texts,
  model: string
): Entry {
  const now = new Date().toISOString()
  open()
    .prepare(
      `INSERT INTO entries (day, book_id, chapter, status, impact, x_post, instagram, reflection,
                            model, generated_at, updated_at, approved_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(day) DO UPDATE SET
         book_id = excluded.book_id, chapter = excluded.chapter, status = 'draft',
         impact = excluded.impact, x_post = excluded.x_post, instagram = excluded.instagram,
         reflection = excluded.reflection, model = excluded.model,
         generated_at = excluded.generated_at, updated_at = excluded.updated_at, approved_at = NULL`
    )
    .run(day, bookId, chapter, texts.impact, texts.xPost, texts.instagram, texts.reflection, model, now, now)
  return getEntry(day)!
}

/** Salva edições em um rascunho. Dias aprovados precisam ser reabertos antes. */
export function updateTexts(day: number, texts: Texts): Entry {
  const entry = getEntry(day)
  if (!entry) throw new Error('Ainda não há textos para este dia.')
  if (entry.status !== 'draft') throw new Error('Este dia já foi aprovado. Reabra para editar.')
  open()
    .prepare('UPDATE entries SET impact = ?, x_post = ?, instagram = ?, reflection = ?, updated_at = ? WHERE day = ?')
    .run(texts.impact, texts.xPost, texts.instagram, texts.reflection, new Date().toISOString(), day)
  return getEntry(day)!
}

export function setStatus(day: number, status: EntryStatus): Entry {
  if (!getEntry(day)) throw new Error('Ainda não há textos para este dia.')
  const now = new Date().toISOString()
  open()
    .prepare('UPDATE entries SET status = ?, approved_at = ?, updated_at = ? WHERE day = ?')
    .run(status, status === 'approved' ? now : null, now, day)
  return getEntry(day)!
}

/** Frases de impacto já gravadas, da mais recente para a mais antiga. */
export function recentImpacts(limit: number): string[] {
  const rows = open().prepare('SELECT impact FROM entries ORDER BY day DESC LIMIT ?').all(limit) as Row[]
  return rows.map((r) => r.impact as string)
}

/** Modelo registrado nos textos que vieram do chat, e não da API. */
export const CHAT_MODEL = 'chat'

/**
 * Grava como rascunho os dias vindos do chat. Dias que já têm textos são pulados,
 * para uma importação nunca apagar o que já foi gerado, editado ou aprovado.
 */
export function saveImported(days: { day: number; texts: Texts }[]): { imported: number; skipped: number } {
  const database = open()
  let imported = 0
  database.exec('BEGIN')
  try {
    for (const { day, texts } of days) {
      if (getEntry(day)) continue
      const ref = referenceForDay(day)
      saveGenerated(day, ref.book.id, ref.chapter, texts, CHAT_MODEL)
      imported++
    }
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
  return { imported, skipped: days.length - imported }
}

export function closeDb(): void {
  db?.close()
  db = null
}
