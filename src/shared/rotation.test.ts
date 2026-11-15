import { describe, expect, it } from 'vitest'
import { BOOKS } from './books'
import {
  TOTAL_DAYS,
  cycleForDay,
  dateForDayNumber,
  dayNumberForDate,
  referenceForDate,
  referenceForDay
} from './rotation'

describe('tabela de livros', () => {
  it('tem 66 livros e 1.189 capítulos', () => {
    expect(BOOKS).toHaveLength(66)
    expect(BOOKS.filter((b) => b.testament === 'AT')).toHaveLength(39)
    expect(BOOKS.filter((b) => b.testament === 'AT').reduce((s, b) => s + b.chapters, 0)).toBe(929)
    expect(BOOKS.filter((b) => b.testament === 'NT').reduce((s, b) => s + b.chapters, 0)).toBe(260)
    expect(new Set(BOOKS.map((b) => b.id)).size).toBe(66)
  })
})

describe('rotação', () => {
  it('segue os exemplos do pedido', () => {
    expect(referenceForDay(1).label).toBe('Gênesis 1')
    expect(referenceForDay(2).label).toBe('Êxodo 1')
    expect(referenceForDay(66).label).toBe('Apocalipse 1')
    expect(referenceForDay(67).label).toBe('Gênesis 2')
  })

  it('tira da rotação os livros que terminaram', () => {
    // A volta 2 não tem Obadias, Filemom, 2 João, 3 João nem Judas: 61 dias.
    const round2 = Array.from({ length: 61 }, (_, i) => referenceForDay(67 + i))
    expect(round2.every((r) => r.chapter === 2)).toBe(true)
    expect(round2.map((r) => r.book.id)).not.toContain('ob')
    expect(round2.at(-1)!.label).toBe('Apocalipse 2')
    expect(referenceForDay(128).label).toBe('Gênesis 3')
  })

  it('cobre cada capítulo da Bíblia exatamente uma vez', () => {
    expect(TOTAL_DAYS).toBe(1189)
    const seen = new Set<string>()
    for (let day = 1; day <= TOTAL_DAYS; day++) {
      const r = referenceForDay(day)
      expect(r.day).toBe(day)
      expect(r.chapter).toBeLessThanOrEqual(r.book.chapters)
      seen.add(`${r.book.id}:${r.chapter}`)
    }
    expect(seen.size).toBe(1189)
  })

  it('termina só com Salmos', () => {
    expect(referenceForDay(TOTAL_DAYS).label).toBe('Salmos 150')
    expect(referenceForDay(TOTAL_DAYS - 83).label).toBe('Salmos 67')
    expect(referenceForDay(TOTAL_DAYS - 84).label).toBe('Isaías 66')
  })

  it('recomeça o ciclo depois do último dia', () => {
    expect(referenceForDay(TOTAL_DAYS + 1).label).toBe('Gênesis 1')
    expect(cycleForDay(TOTAL_DAYS)).toBe(1)
    expect(cycleForDay(TOTAL_DAYS + 1)).toBe(2)
  })

  it('rejeita dias inválidos', () => {
    expect(() => referenceForDay(0)).toThrow(RangeError)
    expect(() => referenceForDay(1.5)).toThrow(RangeError)
  })
})

describe('datas', () => {
  it('conta dias a partir da data de início', () => {
    expect(dayNumberForDate('2026-11-15', '2026-11-15')).toBe(1)
    expect(dayNumberForDate('2026-11-15', '2026-11-16')).toBe(2)
    expect(dayNumberForDate('2026-11-15', '2026-11-14')).toBeNull()
    expect(referenceForDate('2026-11-15', '2027-01-20')!.label).toBe('Gênesis 2')
  })

  it('atravessa anos bissextos e viradas de ano', () => {
    expect(dayNumberForDate('2027-12-31', '2028-03-01')).toBe(62)
    expect(dateForDayNumber('2027-12-31', 62)).toBe('2028-03-01')
  })

  it('ida e volta entre data e dia', () => {
    for (const day of [1, 66, 67, 400, 1189, 1190]) {
      expect(dayNumberForDate('2026-11-15', dateForDayNumber('2026-11-15', day))).toBe(day)
    }
  })

  it('rejeita datas malformadas', () => {
    expect(() => dayNumberForDate('2026-02-30', '2026-03-01')).toThrow(RangeError)
    expect(() => dayNumberForDate('15/11/2026', '2026-11-16')).toThrow(RangeError)
  })
})
