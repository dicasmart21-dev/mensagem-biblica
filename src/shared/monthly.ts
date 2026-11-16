import type { Texts } from './api'
import { instructions } from './prompt'
import { dateForDayNumber, dayNumberForDate, referenceForDay } from './rotation'
import { REFLECTION_MAX, REFLECTION_MIN, X_MAX } from './validate'

export const REQUEST_FORMAT = 'palavra-diaria-pedido'
export const TEXTS_FORMAT = 'palavra-diaria-textos'

/** Arquivo que o app exporta para a skill do chat gerar os textos de um mês. */
export interface MonthlyRequest {
  formato: typeof REQUEST_FORMAT
  versao: 1
  /** "AAAA-MM" */
  mes: string
  traducao: string
  instrucoes: string
  limites: { post_x_max: number; reflexao_min: number; reflexao_max: number }
  /** Frases de impacto já usadas em outros dias, para a skill não repetir. */
  frases_anteriores: string[]
  dias: { dia: number; data: string; capitulo: string; texto: string }[]
}

/** Dias da sequência que caem em um mês ("AAAA-MM"), a partir da data de início. */
export function daysOfMonth(startDate: string, month: string): number[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error(`Mês inválido: ${month}`)
  const [year, m] = [Number(month.slice(0, 4)), Number(month.slice(5, 7))]
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const days: number[] = []
  for (let d = 1; d <= count; d++) {
    const day = dayNumberForDate(startDate, `${month}-${String(d).padStart(2, '0')}`)
    if (day !== null) days.push(day)
  }
  return days
}

export function buildRequest(options: {
  month: string
  startDate: string
  translation: string
  /** Dias do mês que ainda não têm textos. */
  days: number[]
  chapterText(bookId: string, chapter: number): string
  previousImpacts: string[]
}): MonthlyRequest {
  return {
    formato: REQUEST_FORMAT,
    versao: 1,
    mes: options.month,
    traducao: options.translation,
    instrucoes: instructions(options.translation),
    limites: { post_x_max: X_MAX, reflexao_min: REFLECTION_MIN, reflexao_max: REFLECTION_MAX },
    frases_anteriores: options.previousImpacts,
    dias: options.days.map((day) => {
      const ref = referenceForDay(day)
      return {
        dia: day,
        data: dateForDayNumber(options.startDate, day),
        capitulo: ref.label,
        texto: options.chapterText(ref.book.id, ref.chapter)
      }
    })
  }
}

export interface ImportedDay {
  day: number
  texts: Texts
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/**
 * Lê o arquivo de textos devolvido pela skill. Confere o arquivo inteiro antes de
 * devolver qualquer coisa: ou tudo é válido, ou nada é importado.
 */
export function parseTextsFile(json: unknown): ImportedDay[] {
  if (!isObject(json) || json.formato !== TEXTS_FORMAT) {
    throw new Error(
      json && isObject(json) && json.formato === REQUEST_FORMAT
        ? 'Este é o arquivo de pedido, não o de textos. Envie-o ao chat e importe aqui o arquivo "textos-…" que a skill devolver.'
        : 'Este não é um arquivo de textos do Palavra Diária.'
    )
  }
  if (!Array.isArray(json.dias) || json.dias.length === 0) throw new Error('O arquivo não traz nenhum dia.')
  const seen = new Set<number>()
  return json.dias.map((item, index) => {
    const where = `Item ${index + 1}`
    if (!isObject(item) || !Number.isInteger(item.dia) || (item.dia as number) < 1) {
      throw new Error(`${where}: número do dia ausente ou inválido.`)
    }
    const day = item.dia as number
    const label = referenceForDay(day).label
    if (seen.has(day)) throw new Error(`O dia ${day} (${label}) aparece duas vezes no arquivo.`)
    seen.add(day)
    if (item.capitulo !== label) {
      throw new Error(`Dia ${day}: o arquivo traz "${String(item.capitulo)}", mas o capítulo desse dia é ${label}.`)
    }
    const read = (field: string): string => {
      const value = item[field]
      if (typeof value !== 'string' || !value.trim()) throw new Error(`Dia ${day} (${label}): falta o texto "${field}".`)
      return value.trim()
    }
    return {
      day,
      texts: {
        impact: read('frase_impacto'),
        xPost: read('post_x'),
        instagram: read('legenda_instagram'),
        reflection: read('reflexao')
      }
    }
  })
}
