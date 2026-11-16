import { describe, expect, it } from 'vitest'
import type { Entry } from './api'
import { toCsv, toRows } from './export'

const entry: Entry = {
  day: 2,
  bookId: 'ex',
  chapter: 1,
  status: 'approved',
  texts: { impact: 'Deus "ouve"; e age.', xPost: '=soma', instagram: 'linha 1\nlinha 2', reflection: 'Reflexão.' },
  model: 'claude-opus-5-5',
  generatedAt: '2026-11-16T10:00:00.000Z',
  updatedAt: '2026-11-16T10:05:00.000Z',
  approvedAt: '2026-11-16T10:05:00.000Z'
}

describe('exportação', () => {
  it('monta as linhas com data e capítulo', () => {
    const [row] = toRows([entry], '2026-11-15')
    expect(row.data).toBe('2026-11-16')
    expect(row.capitulo).toBe('Êxodo 1')
    expect(row.estado).toBe('aprovado')
  })

  it('gera CSV para Excel: BOM, ponto e vírgula, aspas duplicadas, sem fórmulas', () => {
    const csv = toCsv(toRows([entry], '2026-11-15'))
    expect(csv.startsWith('\uFEFFdata;dia;capitulo;')).toBe(true)
    const [, line] = csv.split('\r\n')
    expect(line).toContain('"Deus ""ouve""; e age."')
    expect(line).toContain(`"'=soma"`)
    expect(csv).toContain('"linha 1\nlinha 2"')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('sem dias, sai só o cabeçalho', () => {
    expect(toCsv([]).trim().split('\r\n')).toHaveLength(1)
  })
})
