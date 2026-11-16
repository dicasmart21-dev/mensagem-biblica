import type { Entry } from './api'
import { dateForDayNumber, referenceForDay } from './rotation'

const COLUMNS = [
  'data',
  'dia',
  'capitulo',
  'estado',
  'frase_impacto',
  'post_x',
  'legenda_instagram',
  'reflexao',
  'modelo',
  'gerado_em',
  'aprovado_em'
] as const

export type ExportRow = Record<(typeof COLUMNS)[number], string | number>

export function toRows(entries: Entry[], startDate: string): ExportRow[] {
  return entries.map((e) => ({
    data: dateForDayNumber(startDate, e.day),
    dia: e.day,
    capitulo: referenceForDay(e.day).label,
    estado: e.status === 'approved' ? 'aprovado' : 'rascunho',
    frase_impacto: e.texts.impact,
    post_x: e.texts.xPost,
    legenda_instagram: e.texts.instagram,
    reflexao: e.texts.reflection,
    modelo: e.model,
    gerado_em: e.generatedAt,
    aprovado_em: e.approvedAt ?? ''
  }))
}

/**
 * CSV que o Excel em português abre direto: separado por ponto e vírgula,
 * com marca de UTF-8 no início e quebras de linha preservadas dentro das aspas.
 */
export function toCsv(rows: ExportRow[]): string {
  const cell = (value: string | number): string => {
    let text = String(value)
    // Texto começando com =, +, - ou @ seria lido pelo Excel como fórmula.
    if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`
    return `"${text.replace(/"/g, '""')}"`
  }
  const lines = [COLUMNS.join(';'), ...rows.map((row) => COLUMNS.map((c) => cell(row[c])).join(';'))]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
