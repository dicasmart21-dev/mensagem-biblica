import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Entry, EntryStatus, Texts } from '../shared/api'

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

export function closeDb(): void {
  db?.close()
  db = null
}
