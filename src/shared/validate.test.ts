import { describe, expect, it } from 'vitest'
import { approvalBlockers, countWords, findIssues, xLength } from './validate'

const words = (n: number): string => Array.from({ length: n }, () => 'graça').join(' ')
const ok = { impact: 'Frase.', xPost: 'Post.', instagram: 'Legenda.', reflection: words(500) }

describe('contagens', () => {
  it('conta palavras ignorando espaços e quebras de linha extras', () => {
    expect(countWords('  No princípio\n\ncriou   Deus ')).toBe(4)
    expect(countWords('')).toBe(0)
  })

  it('conta caracteres como o X: acentos valem 1, emojis valem 2', () => {
    expect(xLength('Gênesis')).toBe(7)
    expect(xLength('fé ✝')).toBe(5)
    expect(xLength('“graça”')).toBe(7)
  })
})

describe('findIssues', () => {
  it('aceita textos dentro dos limites', () => {
    expect(findIssues(ok)).toEqual([])
    expect(findIssues({ ...ok, xPost: 'a'.repeat(280), reflection: words(400) })).toEqual([])
    expect(findIssues({ ...ok, reflection: words(700) })).toEqual([])
  })

  it('aponta post longo demais para o X', () => {
    expect(findIssues({ ...ok, xPost: 'a'.repeat(281) })).toEqual([
      'O post para o X tem 281 caracteres; o limite é 280.'
    ])
  })

  it('aponta reflexão fora de 400-700 palavras', () => {
    expect(findIssues({ ...ok, reflection: words(399) })).toHaveLength(1)
    expect(findIssues({ ...ok, reflection: words(701) })).toHaveLength(1)
  })

  it('aponta textos vazios', () => {
    expect(findIssues({ ...ok, impact: ' ', xPost: '' })).toEqual([
      'A frase de impacto está vazia.',
      'O post para o X está vazio.'
    ])
  })
})

describe('approvalBlockers', () => {
  it('bloqueia texto vazio e post longo, mas não reflexão fora do tamanho', () => {
    expect(approvalBlockers({ ...ok, reflection: words(350) })).toEqual([])
    expect(approvalBlockers({ ...ok, xPost: 'a'.repeat(281) })).toHaveLength(1)
    expect(approvalBlockers({ ...ok, instagram: '' })).toEqual(['A legenda do Instagram está vazia.'])
  })
})
