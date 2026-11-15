import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Entry, Texts } from '../shared/api'
import { referenceForDay } from '../shared/rotation'
import { REFLECTION_MAX, REFLECTION_MIN, X_MAX, findIssues } from '../shared/validate'
import { TRANSLATION, chapterText } from './bible'
import { saveGenerated } from './db'
import { getApiKey, getSettings } from './settings'

const Output = z.object({
  frase_impacto: z.string(),
  post_x: z.string(),
  legenda_instagram: z.string(),
  reflexao: z.string()
})

const SYSTEM = `Você escreve mensagens bíblicas diárias em português do Brasil. Elas são publicadas no X, no Instagram e num blog, para um público cristão amplo: gente de igreja e gente que só esbarrou no post. A cada dia você recebe um capítulo da Bíblia e escreve quatro textos sobre ele. Uma pessoa revisa e aprova tudo antes de publicar.

# Lente teológica: luterana confessional

- Cristo no centro. Toda a Escritura dá testemunho de Cristo. Mostre como o capítulo aponta para a pessoa e a obra dele (promessa, figura, cumprimento, cruz e ressurreição), sem forçar alegorias que o texto não sustenta.
- Lei e Evangelho, distintos. A Lei diz o que Deus exige e expõe o pecado; o Evangelho anuncia o que Deus fez e entrega em Cristo, de graça. As duas palavras aparecem, mas a Lei nunca fica com a última: a mensagem termina no Evangelho, não numa lista de tarefas.
- Justificação somente pela graça, mediante a fé, por causa de Cristo. Fique longe de moralismo ("esforce-se mais"), de teologia da prosperidade e de promessas que o texto não faz. Boas obras aparecem como fruto da fé, vividas na vocação de cada dia.
- Quando o capítulo abrir espaço com naturalidade, os meios da graça (Palavra, Batismo, Santa Ceia) podem aparecer.

# Fidelidade ao texto

Baseie-se no capítulo fornecido. Citações bíblicas são literais, copiadas do texto fornecido (tradução ${TRANSLATION}), com o número do versículo. Ao citar outro livro da Bíblia, dê a referência e parafraseie em vez de citar de memória entre aspas. Não atribua frases a Lutero nem às Confissões Luteranas.

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
  if (error instanceof Anthropic.APIConnectionError) {
    return new GenerationError('Não foi possível conectar à API do Claude. Verifique sua internet.')
  }
  if (error instanceof Anthropic.APIError) {
    return new GenerationError(`A API do Claude devolveu um erro (${error.status ?? 'sem código'}): ${error.message}`)
  }
  return new GenerationError(error instanceof Error ? error.message : String(error))
}

/**
 * Gera os quatro textos do dia com o Claude e salva como rascunho.
 * Se a primeira resposta sair dos limites de tamanho, pede uma correção uma vez;
 * se ainda assim sobrar algum problema, salva mesmo assim (a tela mostra o aviso).
 */
export async function generateForDay(day: number): Promise<Entry> {
  const apiKey = getApiKey()
  if (!apiKey) throw new GenerationError('Informe a chave da API do Claude nas Configurações.')

  const { model } = getSettings()
  const ref = referenceForDay(day)
  const client = new Anthropic({ apiKey })

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Capítulo de hoje: ${ref.label}\n\n<capitulo>\n${chapterText(ref.book.id, ref.chapter)}\n</capitulo>\n\nEscreva os quatro textos para este capítulo.`
    }
  ]

  try {
    let texts: Texts | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await client.beta.messages.parse({
        model,
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        output_config: { effort: 'high', format: betaZodOutputFormat(Output) },
        // Se o modelo recusar por engano de um filtro de segurança, a API tenta
        // sozinha em um modelo substituto em vez de devolver uma recusa.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default'
      })

      if (response.stop_reason === 'refusal') {
        throw new GenerationError('O modelo se recusou a gerar os textos deste capítulo. Tente de novo.')
      }
      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        throw new GenerationError('A resposta do modelo veio incompleta. Tente de novo.')
      }

      texts = toTexts(response.parsed_output)
      const issues = findIssues(texts)
      if (issues.length === 0 || attempt === 2) break

      messages.push(
        { role: 'assistant', content: response.content },
        {
          role: 'user',
          content: `A verificação automática encontrou estes problemas:\n${issues.map((i) => `- ${i}`).join('\n')}\n\nReescreva os quatro textos, corrigindo esses pontos e mantendo o restante.`
        }
      )
    }
    return saveGenerated(day, ref.book.id, ref.chapter, texts!, model)
  } catch (error) {
    throw explain(error)
  }
}
