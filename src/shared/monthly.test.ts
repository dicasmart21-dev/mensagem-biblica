import { describe, expect, it } from 'vitest'
import { REQUEST_FORMAT, TEXTS_FORMAT, buildRequest, daysOfMonth, parseTextsFile } from './monthly'

describe('pedido mensal', () => {
  it('lista os dias da sequência que caem no mês', () => {
    expect(daysOfMonth('2026-11-15', '2026-11')).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    expect(daysOfMonth('2026-11-15', '2026-12')).toHaveLength(31)
    expect(daysOfMonth('2026-11-15', '2026-12')[0]).toBe(17)
    expect(daysOfMonth('2026-11-15', '2026-10')).toEqual([])
    expect(() => daysOfMonth('2026-11-15', '2026-13')).toThrow()
  })

  it('monta o pedido com instruções, limites e o texto de cada capítulo', () => {
    const request = buildRequest({
      month: '2026-11',
      startDate: '2026-11-15',
      translation: 'Tradução X',
      days: [1, 3],
      chapterText: (book, chapter) => `texto de ${book} ${chapter}`,
      previousImpacts: ['Já usada.']
    })
    expect(request.formato).toBe(REQUEST_FORMAT)
    expect(request.instrucoes).toContain('tradução Tradução X')
    expect(request.limites).toEqual({ post_x_max: 280, reflexao_min: 400, reflexao_max: 700 })
    expect(request.dias).toEqual([
      { dia: 1, data: '2026-11-15', capitulo: 'Gênesis 1', texto: 'texto de gn 1' },
      { dia: 3, data: '2026-11-17', capitulo: 'Levítico 1', texto: 'texto de lv 1' }
    ])
  })
})

describe('arquivo de textos', () => {
  const day = (over: object = {}) => ({
    dia: 2,
    capitulo: 'Êxodo 1',
    frase_impacto: ' Frase. ',
    post_x: 'Post.',
    legenda_instagram: 'Legenda.',
    reflexao: 'Reflexão.',
    ...over
  })
  const file = (dias: unknown[]) => ({ formato: TEXTS_FORMAT, versao: 1, dias })

  it('lê os dias e apara espaços', () => {
    expect(parseTextsFile(file([day()]))).toEqual([
      { day: 2, texts: { impact: 'Frase.', xPost: 'Post.', instagram: 'Legenda.', reflection: 'Reflexão.' } }
    ])
  })

  it('recusa arquivo de outro tipo, capítulo trocado, dia repetido e texto faltando', () => {
    expect(() => parseTextsFile({ foo: 1 })).toThrow(/não é um arquivo de textos/)
    expect(() => parseTextsFile({ formato: REQUEST_FORMAT })).toThrow(/arquivo de pedido/)
    expect(() => parseTextsFile(file([]))).toThrow(/nenhum dia/)
    expect(() => parseTextsFile(file([day({ capitulo: 'Gênesis 2' })]))).toThrow(/capítulo desse dia é Êxodo 1/)
    expect(() => parseTextsFile(file([day(), day()]))).toThrow(/duas vezes/)
    expect(() => parseTextsFile(file([day({ reflexao: '  ' })]))).toThrow(/falta o texto "reflexao"/)
  })
})
