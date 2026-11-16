import Anthropic from '@anthropic-ai/sdk'
import { net } from 'electron'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Entry, TextField, Texts } from '../shared/api'
import { referenceForDay } from '../shared/rotation'
import { REFLECTION_MAX, REFLECTION_MIN, X_MAX, findIssues } from '../shared/validate'
import { chapterText } from './bible'
import { getEntry, saveGenerated, updateTexts } from './db'
import { getApiKey, getSettings } from './settings'

const Output = z.object({
  frase_impacto: z.string(),
  post_x: z.string(),
  legenda_instagram: z.string(),
  reflexao: z.string()
})

const system = (translation: string): string => `Você escreve mensagens bíblicas diárias em português do Brasil. Elas são publicadas no X, no Instagram e num blog, para um público cristão amplo: gente de igreja e gente que só esbarrou no post. A cada dia você recebe um capítulo da Bíblia e escreve quatro textos sobre ele. Uma pessoa revisa e aprova tudo antes de publicar.

# Lente teológica: luterana confessional

- Cristo no centro. Toda a Escritura dá testemunho de Cristo. Mostre como o capítulo aponta para a pessoa e a obra dele (promessa, figura, cumprimento, cruz e ressurreição), sem forçar alegorias que o texto não sustenta.
- Lei e Evangelho, distintos. A Lei diz o que Deus exige e expõe o pecado; o Evangelho anuncia o que Deus fez e entrega em Cristo, de graça. As duas palavras aparecem, mas a Lei nunca fica com a última: a mensagem termina no Evangelho, não numa lista de tarefas.
- Justificação somente pela graça, mediante a fé, por causa de Cristo. Fique longe de moralismo ("esforce-se mais"), de teologia da prosperidade e de promessas que o texto não faz. Boas obras aparecem como fruto da fé, vividas na vocação de cada dia.
- Quando o capítulo abrir espaço com naturalidade, os meios da graça (Palavra, Batismo, Santa Ceia) podem aparecer.

# Fidelidade ao texto

Baseie-se no capítulo fornecido. Citações bíblicas são literais, copiadas do texto fornecido (tradução ${translation}), com o número do versículo. Ao citar outro livro da Bíblia, dê a referência e parafraseie em vez de citar de memória entre aspas. Não atribua frases a Lutero nem às Confissões Luteranas.

# Tom

Caloroso, claro e direto, de pastor que conversa, não de professor que palestra. Sem jargão acadêmico e sem clichês de autoajuda.

# Os quatro textos

1. frase_impacto: uma única frase, de até 120 caracteres, que fique de pé sozinha numa imagem. Sem hashtags e sem referência bíblica.
2. post_x: no máximo ${X_MAX} caracteres, contando espaços, quebras de linha e hashtags. Inclui a referência do capítulo (ex.: Gênesis 1) e no máximo duas hashtags.
3. legenda_instagram: de 80 a 150 palavras em parágrafos curtos, terminando com uma pergunta ou um convite à reflexão. Na última linha, de 5 a 8 hashtags.
4. reflexao: de ${REFLECTION_MIN} a ${REFLECTION_MAX} palavras, em texto corrido, com parágrafos separados por uma linha em branco. Sem título, sem subtítulos e sem markdown. Parte do texto bíblico, distingue Lei e Evangelho, mostra Cristo e termina com consolo e uma oração de uma ou duas frases.

Os limites de tamanho são verificados automaticamente depois; conte antes de responder.`

type Parsed = z.infer<typeof Output>

const toTexts = (o: Parsed): Texts => ({
  impact: o.frase_impacto.trim(),
  xPost: o.post_x.trim(),
  instagram: o.legenda_instagram.trim(),
  reflection: o.reflexao.trim()
})

/** Erro com mensagem pronta para mostrar na tela. */
export class GenerationError extends Error {}

/** Código ou mensagem da causa mais interna de um erro de rede (ex.: ECONNRESET, ENOTFOUND). */
function causeOf(error: unknown): string {
  let detail = ''
  for (let e: unknown = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    const code = (e as NodeJS.ErrnoException).code
    if (e !== error) detail = code ?? e.message
  }
  return detail.slice(0, 120)
}

function explain(error: unknown): GenerationError {
  if (error instanceof GenerationError) return error
  if (error instanceof Anthropic.AuthenticationError) {
    return new GenerationError('A chave da API foi recusada. Confira a chave nas Configurações.')
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new GenerationError('Esta chave da API não tem permissão para usar o modelo escolhido.')
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new GenerationError('O modelo escolhido não está disponível para esta chave da API.')
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new GenerationError('Limite de uso da API atingido. Tente de novo em alguns minutos.')
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new GenerationError('A API do Claude demorou demais para responder. Tente de novo.')
  }
  if (error instanceof Anthropic.APIConnectionError) {
    const detail = causeOf(error)
    return new GenerationError(
      `A conexão com a API do Claude falhou${detail ? ` (${detail})` : ''}. Verifique a internet e tente de novo.`
    )
  }
  if (error instanceof Anthropic.APIError) {
    return new GenerationError(`A API do Claude devolveu um erro (${error.status ?? 'sem código'}): ${error.message}`)
  }
  return new GenerationError(error instanceof Error ? error.message : String(error))
}

type Messages = Anthropic.Beta.BetaMessageParam[]

/** Uma chamada ao Claude com saída estruturada; devolve o objeto validado e o conteúdo bruto. */
async function ask<S extends z.ZodType>(
  client: Anthropic,
  model: string,
  translation: string,
  messages: Messages,
  schema: S
): Promise<{ output: z.infer<S>; content: Anthropic.Beta.BetaContentBlock[] }> {
  // Em streaming, os dados chegam aos poucos: uma resposta longa não deixa a conexão
  // parada por minutos, o que redes e antivírus costumam derrubar.
  const response = await client.beta.messages
    .stream({
      model,
      max_tokens: 32000,
      system: system(translation),
      messages,
      output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
      // Se o modelo recusar por engano de um filtro de segurança, a API tenta
      // sozinha em um modelo substituto em vez de devolver uma recusa.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default'
    })
    .finalMessage()
  if (response.stop_reason === 'refusal') {
    throw new GenerationError('O modelo se recusou a gerar os textos deste capítulo. Tente de novo.')
  }
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
    throw new GenerationError('A resposta do modelo veio incompleta. Tente de novo.')
  }
  return { output: response.parsed_output as z.infer<S>, content: response.content }
}

/**
 * Usa a pilha de rede do Chromium em vez da do Node: ela confia nos certificados
 * instalados no Windows e respeita o proxy do sistema, como um navegador. Sem isso,
 * antivírus e proxies que inspecionam HTTPS quebram a conexão (SELF_SIGNED_CERT_IN_CHAIN).
 */
const systemFetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  net.fetch(input as string | Request, init)) as typeof fetch

function setup(day: number) {
  const apiKey = getApiKey()
  if (!apiKey) throw new GenerationError('Informe a chave da API do Claude nas Configurações.')
  const settings = getSettings()
  const ref = referenceForDay(day)
  const chapter = `Capítulo de hoje: ${ref.label}\n\n<capitulo>\n${chapterText(ref.book.id, ref.chapter)}\n</capitulo>`
  return { client: new Anthropic({ apiKey, fetch: systemFetch }), model: settings.model, translation: settings.bible.name, ref, chapter }
}

const correction = (issues: string[], what: string): string =>
  `A verificação automática encontrou estes problemas:\n${issues.map((i) => `- ${i}`).join('\n')}\n\nReescreva ${what}, corrigindo esses pontos e mantendo o restante.`

/**
 * Gera os quatro textos do dia com o Claude e salva como rascunho.
 * Se a primeira resposta sair dos limites de tamanho, pede uma correção uma vez;
 * se ainda assim sobrar algum problema, salva mesmo assim (a tela mostra o aviso).
 */
export async function generateForDay(day: number): Promise<Entry> {
  try {
    const { client, model, translation, ref, chapter } = setup(day)
    const messages: Messages = [
      { role: 'user', content: `${chapter}\n\nEscreva os quatro textos para este capítulo.` }
    ]
    let texts: Texts | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { output, content } = await ask(client, model, translation, messages, Output)
      texts = toTexts(output)
      const issues = findIssues(texts)
      if (issues.length === 0 || attempt === 2) break
      messages.push(
        { role: 'assistant', content },
        { role: 'user', content: correction(issues, 'os quatro textos') }
      )
    }
    return saveGenerated(day, ref.book.id, ref.chapter, texts!, model)
  } catch (error) {
    throw explain(error)
  }
}

const One = z.object({ texto: z.string() })

const FIELD_NAMES: Record<TextField, string> = {
  impact: 'a frase de impacto (frase_impacto)',
  xPost: 'o post para o X (post_x)',
  instagram: 'a legenda do Instagram (legenda_instagram)',
  reflection: 'a reflexão (reflexao)'
}

/** Reescreve só um dos quatro textos de um rascunho, mantendo os outros três como estão. */
export async function regenerateText(day: number, field: TextField): Promise<Entry> {
  try {
    const entry = getEntry(day)
    if (!entry) throw new GenerationError('Ainda não há textos para este dia.')
    if (entry.status !== 'draft') throw new GenerationError('Este dia já foi aprovado. Reabra para editar.')

    const { client, model, translation, chapter } = setup(day)
    const current = JSON.stringify(
      {
        frase_impacto: entry.texts.impact,
        post_x: entry.texts.xPost,
        legenda_instagram: entry.texts.instagram,
        reflexao: entry.texts.reflection
      },
      null,
      2
    )
    const messages: Messages = [
      {
        role: 'user',
        content: `${chapter}\n\nEstes são os quatro textos atuais deste capítulo:\n\n<textos_atuais>\n${current}\n</textos_atuais>\n\nQuem revisa não ficou satisfeito com ${FIELD_NAMES[field]}. Escreva uma nova versão só desse texto, com outro ângulo ou outra abertura, seguindo as mesmas regras e combinando com os outros três, que ficam como estão. Devolva apenas o novo texto.`
      }
    ]
    let texts = entry.texts
    for (let attempt = 1; attempt <= 2; attempt++) {
      const { output, content } = await ask(client, model, translation, messages, One)
      texts = { ...entry.texts, [field]: output.texto.trim() }
      const before = findIssues(entry.texts)
      const issues = findIssues(texts).filter((issue) => !before.includes(issue))
      if (issues.length === 0 || attempt === 2) break
      messages.push({ role: 'assistant', content }, { role: 'user', content: correction(issues, 'esse texto') })
    }
    return updateTexts(day, texts)
  } catch (error) {
    throw explain(error)
  }
}
