import { BOOKS } from './books'

/** Bíblia importada: livros na ordem canônica -> capítulos -> versículos (índice 0 = versículo 1). */
export interface ImportedBible {
  name: string
  books: string[][][]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function verseList(chapter: unknown, where: string): string[] {
  const raw = Array.isArray(chapter) ? chapter : isObject(chapter) ? chapter.verses : null
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`${where}: capítulo sem versículos.`)
  const verses: string[] = []
  raw.forEach((item, index) => {
    const text = typeof item === 'string' ? item : isObject(item) ? item.text : null
    if (typeof text !== 'string') throw new Error(`${where}: versículo em formato desconhecido.`)
    const number = isObject(item) && Number.isInteger(item.verse) ? (item.verse as number) : index + 1
    if (number < 1 || number > 250) throw new Error(`${where}: número de versículo inválido.`)
    verses[number - 1] = text.replace(/\s+/g, ' ').trim()
  })
  for (let i = 0; i < verses.length; i++) verses[i] ??= ''
  if (!verses.some(Boolean)) throw new Error(`${where}: capítulo sem texto.`)
  return verses
}

/**
 * Lê uma Bíblia em JSON nos formatos mais comuns:
 * - lista de 66 livros, cada um com `chapters` = lista de capítulos = lista de versículos (texto);
 * - `{ books: [{ chapters: [{ verses: [{ verse, text }] }] }] }`.
 * Os 66 livros precisam estar na ordem canônica, com o número de capítulos de cada um.
 */
export function parseBible(json: unknown, fallbackName: string): ImportedBible {
  const list = Array.isArray(json) ? json : isObject(json) ? json.books : null
  if (!Array.isArray(list)) {
    throw new Error('Formato não reconhecido: o arquivo precisa conter a lista dos livros da Bíblia.')
  }
  if (list.length !== BOOKS.length) {
    throw new Error(`O arquivo tem ${list.length} livros; são esperados ${BOOKS.length}, na ordem de Gênesis a Apocalipse.`)
  }
  const books = list.map((book, i) => {
    const expected = BOOKS[i]
    const chapters = Array.isArray(book) ? book : isObject(book) ? book.chapters : null
    if (!Array.isArray(chapters)) throw new Error(`${expected.name}: livro sem capítulos.`)
    if (chapters.length !== expected.chapters) {
      throw new Error(
        `${expected.name}: o arquivo tem ${chapters.length} capítulos; são esperados ${expected.chapters}. Os livros estão na ordem de Gênesis a Apocalipse?`
      )
    }
    return chapters.map((chapter, c) => verseList(chapter, `${expected.name} ${c + 1}`))
  })
  const named = isObject(json) ? (json.translation ?? json.name ?? json.version) : null
  const name = (typeof named === 'string' && named.trim() ? named : fallbackName).trim().slice(0, 80)
  return { name: name || 'Bíblia importada', books }
}
