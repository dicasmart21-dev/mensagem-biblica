import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Nome da tradução embutida, usado no prompt e nos créditos. */
export const TRANSLATION = 'Bíblia Livre'

/**
 * Texto de um capítulo, um versículo por linha, com o número na frente.
 * Versículos sem texto nesta tradução (unidos ao anterior) são omitidos.
 */
export function chapterText(bookId: string, chapter: number): string {
  if (!/^[a-z0-9]+$/.test(bookId)) throw new Error(`Livro inválido: ${bookId}`)
  const path = join(app.getAppPath(), 'resources', 'biblia', `${bookId}.json`)
  const chapters = JSON.parse(readFileSync(path, 'utf8')) as string[][]
  const verses = chapters[chapter - 1]
  if (!verses) throw new Error(`Capítulo não encontrado: ${bookId} ${chapter}`)
  return verses
    .map((text, i) => (text ? `${i + 1} ${text}` : ''))
    .filter(Boolean)
    .join('\n')
}
