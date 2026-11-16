import { describe, expect, it } from 'vitest'
import { fold, matches } from './search'

describe('busca', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(fold('Gênesis É Graça')).toBe('genesis e graca')
    expect(matches('Gênesis 1 — No princípio', 'genesis PRINCIPIO')).toBe(true)
  })

  it('exige todas as palavras, em qualquer ordem', () => {
    expect(matches('Êxodo 1: o povo oprimido', 'oprimido exodo')).toBe(true)
    expect(matches('Êxodo 1: o povo oprimido', 'exodo graça')).toBe(false)
  })

  it('busca vazia encontra tudo', () => {
    expect(matches('qualquer coisa', '  ')).toBe(true)
  })
})
