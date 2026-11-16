import { describe, expect, it } from 'vitest'
import { parseBible } from './bibleImport'
import { BOOKS } from './books'

/** Bíblia mínima válida: um versículo por capítulo. */
const simple = () =>
  BOOKS.map((b) => ({
    abbrev: b.id,
    chapters: Array.from({ length: b.chapters }, (_, c) => [`${b.name} ${c + 1}, versículo 1`])
  }))

describe('parseBible', () => {
  it('lê o formato de lista de livros com capítulos em texto', () => {
    const bible = parseBible(simple(), 'minha-biblia')
    expect(bible.name).toBe('minha-biblia')
    expect(bible.books).toHaveLength(66)
    expect(bible.books[0][0][0]).toBe('Gênesis 1, versículo 1')
    expect(bible.books[65][21][0]).toBe('Apocalipse 22, versículo 1')
  })

  it('lê o formato com objetos de capítulo e versículo, respeitando a numeração', () => {
    const json = {
      translation: 'Tradução de Teste',
      books: simple().map((b) => ({
        name: b.abbrev,
        chapters: b.chapters.map((_, c) => ({
          chapter: c + 1,
          verses: [
            { verse: 1, text: '  primeiro \n versículo ' },
            { verse: 3, text: 'terceiro' }
          ]
        }))
      }))
    }
    const bible = parseBible(json, 'arquivo')
    expect(bible.name).toBe('Tradução de Teste')
    expect(bible.books[0][0]).toEqual(['primeiro versículo', '', 'terceiro'])
  })

  it('explica o que está errado no arquivo', () => {
    expect(() => parseBible({ foo: 1 }, 'x')).toThrow(/Formato não reconhecido/)
    expect(() => parseBible(simple().slice(0, 27), 'x')).toThrow(/27 livros/)
    const short = simple()
    short[1].chapters.pop()
    expect(() => parseBible(short, 'x')).toThrow(/Êxodo: o arquivo tem 39 capítulos/)
    const empty = simple()
    empty[0].chapters[2] = []
    expect(() => parseBible(empty, 'x')).toThrow(/Gênesis 3: capítulo sem versículos/)
  })
})
