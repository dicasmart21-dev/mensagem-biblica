import type { Texts } from './api'

export const X_MAX = 280
export const REFLECTION_MIN = 400
export const REFLECTION_MAX = 700

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Tamanho de um post como o X conta: letras latinas e pontuação comum valem 1;
 * emojis e a maioria dos outros símbolos valem 2.
 */
export function xLength(text: string): number {
  let total = 0
  for (const ch of text.normalize('NFC')) {
    const cp = ch.codePointAt(0)!
    const single =
      cp <= 0x10ff ||
      (cp >= 0x2000 && cp <= 0x200d) ||
      (cp >= 0x2010 && cp <= 0x201f) ||
      (cp >= 0x2032 && cp <= 0x2037)
    total += single ? 1 : 2
  }
  return total
}

/** Problemas de tamanho nos textos; lista vazia quando está tudo dentro dos limites. */
export function findIssues(texts: Texts): string[] {
  const issues: string[] = []
  if (!texts.impact.trim()) issues.push('A frase de impacto está vazia.')
  if (!texts.xPost.trim()) issues.push('O post para o X está vazio.')
  if (!texts.instagram.trim()) issues.push('A legenda do Instagram está vazia.')
  if (!texts.reflection.trim()) issues.push('A reflexão está vazia.')
  const x = xLength(texts.xPost)
  if (x > X_MAX) issues.push(`O post para o X tem ${x} caracteres; o limite é ${X_MAX}.`)
  const words = countWords(texts.reflection)
  if (words > 0 && (words < REFLECTION_MIN || words > REFLECTION_MAX)) {
    issues.push(`A reflexão tem ${words} palavras; deve ter entre ${REFLECTION_MIN} e ${REFLECTION_MAX}.`)
  }
  return issues
}

/** O que impede a aprovação: texto vazio ou post que o X não aceitaria. */
export function approvalBlockers(texts: Texts): string[] {
  return findIssues(texts).filter((issue) => !issue.startsWith('A reflexão tem'))
}
