#!/usr/bin/env python3
"""Apoio à skill palavra-diaria-mensal: lê o pedido exportado pelo app Palavra Diária,
confere os textos escritos e monta o arquivo final para importar no app.

Uso:
  palavra.py resumo    <pedido.json> <pasta_trabalho>
  palavra.py capitulo  <pedido.json> <dia>
  palavra.py frases    <pedido.json> <pasta_trabalho>
  palavra.py verificar <pedido.json> <pasta_trabalho> [dia]
  palavra.py montar    <pedido.json> <pasta_trabalho> <pasta_saida> [--parcial]

Cada dia escrito fica em <pasta_trabalho>/dia-NNNN.md, com quatro seções:
  # frase_impacto / # post_x / # legenda_instagram / # reflexao
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

CAMPOS = ["frase_impacto", "post_x", "legenda_instagram", "reflexao"]


def carregar_pedido(caminho):
    pedido = json.loads(Path(caminho).read_text(encoding="utf-8-sig"))
    if pedido.get("formato") != "palavra-diaria-pedido":
        sys.exit("Este arquivo não é um pedido do Palavra Diária (campo 'formato' diferente).")
    return pedido


def arquivo_do_dia(pasta, dia):
    return Path(pasta) / f"dia-{dia:04d}.md"


def ler_dia(caminho):
    """Lê as quatro seções de um arquivo de dia. Devolve (textos, problemas)."""
    textos, atual, problemas = {}, None, []
    for linha in Path(caminho).read_text(encoding="utf-8").splitlines():
        m = re.fullmatch(r"#\s*(\w+)\s*", linha)
        if m and m.group(1) in CAMPOS:
            atual = m.group(1)
            if atual in textos:
                problemas.append(f"a seção '{atual}' aparece duas vezes")
            textos[atual] = []
        elif atual is not None:
            textos[atual].append(linha)
    textos = {k: "\n".join(v).strip() for k, v in textos.items()}
    for campo in CAMPOS:
        if not textos.get(campo):
            problemas.append(f"falta a seção '# {campo}' ou ela está vazia")
    return textos, problemas


def tamanho_x(texto):
    """Conta caracteres como o X: letras latinas e pontuação comum valem 1; emojis e outros símbolos valem 2."""
    total = 0
    for ch in unicodedata.normalize("NFC", texto):
        cp = ord(ch)
        simples = cp <= 0x10FF or 0x2000 <= cp <= 0x200D or 0x2010 <= cp <= 0x201F or 0x2032 <= cp <= 0x2037
        total += 1 if simples else 2
    return total


def palavras(texto):
    return len(texto.split())


def normalizar(frase):
    sem_acento = "".join(c for c in unicodedata.normalize("NFD", frase) if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9 ]", "", sem_acento.lower()).strip()


def problemas_do_dia(textos, limites, outras_frases):
    p = []
    x = tamanho_x(textos.get("post_x", ""))
    if x > limites["post_x_max"]:
        p.append(f"post_x tem {x} caracteres; o limite é {limites['post_x_max']}")
    n = palavras(textos.get("reflexao", ""))
    if textos.get("reflexao") and not (limites["reflexao_min"] <= n <= limites["reflexao_max"]):
        p.append(f"reflexao tem {n} palavras; deve ter entre {limites['reflexao_min']} e {limites['reflexao_max']}")
    frase = textos.get("frase_impacto", "")
    if "\n" in frase:
        p.append("frase_impacto deve ser uma única frase, em uma linha")
    if len(frase) > 120:
        p.append(f"frase_impacto tem {len(frase)} caracteres; o limite é 120")
    if frase and normalizar(frase) in outras_frases:
        p.append("frase_impacto repete uma frase já usada em outro dia")
    if re.search(r"^#{1,6} |\*\*", textos.get("reflexao", ""), re.M):
        p.append("reflexao não deve ter títulos nem markdown")
    return p


def conferir(pedido, pasta, so_dia=None):
    """Devolve (prontos, faltando, problemas) considerando todos os dias do pedido."""
    anteriores = {normalizar(f) for f in pedido.get("frases_anteriores", [])}
    prontos, faltando, problemas, vistas = [], [], {}, {}
    for item in pedido["dias"]:
        dia, caminho = item["dia"], arquivo_do_dia(pasta, item["dia"])
        if not caminho.exists():
            faltando.append(item)
            continue
        textos, p = ler_dia(caminho)
        chave = normalizar(textos.get("frase_impacto", ""))
        p += problemas_do_dia(textos, pedido["limites"], anteriores | set(vistas))
        if chave:
            vistas.setdefault(chave, dia)
        if p and (so_dia is None or so_dia == dia):
            problemas[dia] = (item["capitulo"], p)
        prontos.append((item, textos))
    return prontos, faltando, problemas


def cmd_resumo(pedido, pasta):
    prontos, faltando, problemas = conferir(pedido, pasta)
    print(f"Mês: {pedido['mes']} | tradução: {pedido['traducao']} | dias no pedido: {len(pedido['dias'])}")
    print(f"Limites: post_x até {pedido['limites']['post_x_max']} caracteres; reflexao de "
          f"{pedido['limites']['reflexao_min']} a {pedido['limites']['reflexao_max']} palavras")
    print(f"Já escritos nesta pasta: {len(prontos)} | faltam: {len(faltando)} | com problemas: {len(problemas)}")
    print("\nDias que faltam (dia, data, capítulo):")
    for item in faltando:
        print(f"  {item['dia']:>4}  {item['data']}  {item['capitulo']}")
    print("\n===== INSTRUÇÕES DE ESTILO (siga à risca) =====\n")
    print(pedido["instrucoes"])


def cmd_capitulo(pedido, dia):
    for item in pedido["dias"]:
        if item["dia"] == dia:
            print(f"Dia {dia} ({item['data']}): {item['capitulo']}  [tradução {pedido['traducao']}]\n")
            print(item["texto"])
            return
    sys.exit(f"O dia {dia} não está neste pedido.")


def cmd_frases(pedido, pasta):
    prontos, _, _ = conferir(pedido, pasta)
    print("Frases de impacto já usadas em meses anteriores (não repetir nem parafrasear de perto):")
    for f in pedido.get("frases_anteriores", []):
        print(f"  - {f}")
    print("\nFrases de impacto já escritas neste pedido:")
    for item, textos in prontos:
        print(f"  - [{item['capitulo']}] {textos.get('frase_impacto', '')}")


def cmd_verificar(pedido, pasta, so_dia):
    prontos, faltando, problemas = conferir(pedido, pasta, so_dia)
    if so_dia is not None and not arquivo_do_dia(pasta, so_dia).exists():
        sys.exit(f"Ainda não existe {arquivo_do_dia(pasta, so_dia)}.")
    for dia, (capitulo, lista) in sorted(problemas.items()):
        print(f"Dia {dia} ({capitulo}):")
        for item in lista:
            print(f"  - {item}")
    if not problemas:
        print("Sem problemas." if so_dia is None else f"Dia {so_dia}: sem problemas.")
    if so_dia is None:
        print(f"\nEscritos: {len(prontos)} | faltam: {len(faltando)}")
    sys.exit(1 if problemas else 0)


def cmd_montar(pedido, pasta, saida, parcial):
    prontos, faltando, problemas = conferir(pedido, pasta)
    if problemas:
        print("Corrija estes problemas antes de montar o arquivo:")
        for dia, (capitulo, lista) in sorted(problemas.items()):
            print(f"  Dia {dia} ({capitulo}): " + "; ".join(lista))
        sys.exit(1)
    if faltando and not parcial:
        print(f"Ainda faltam {len(faltando)} dias: " + ", ".join(f"{i['dia']} ({i['capitulo']})" for i in faltando))
        print("Escreva os que faltam, ou use --parcial para entregar só os prontos.")
        sys.exit(1)
    if not prontos:
        sys.exit("Nenhum dia foi escrito ainda.")
    resultado = {
        "formato": "palavra-diaria-textos",
        "versao": 1,
        "mes": pedido["mes"],
        "dias": [{"dia": item["dia"], "capitulo": item["capitulo"], **{c: textos[c] for c in CAMPOS}}
                 for item, textos in prontos],
    }
    Path(saida).mkdir(parents=True, exist_ok=True)
    destino = Path(saida) / f"textos-{pedido['mes']}{'-parcial' if faltando else ''}.json"
    destino.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Arquivo pronto: {destino}")
    print(f"Dias incluídos: {len(prontos)}" + (f" | ficaram de fora: {len(faltando)}" if faltando else ""))


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit(__doc__)
    comando, pedido = args[0], carregar_pedido(args[1])
    if comando == "resumo" and len(args) == 3:
        cmd_resumo(pedido, args[2])
    elif comando == "capitulo" and len(args) == 3:
        cmd_capitulo(pedido, int(args[2]))
    elif comando == "frases" and len(args) == 3:
        cmd_frases(pedido, args[2])
    elif comando == "verificar" and len(args) in (3, 4):
        cmd_verificar(pedido, args[2], int(args[3]) if len(args) == 4 else None)
    elif comando == "montar" and len(args) in (4, 5):
        cmd_montar(pedido, args[2], args[3], "--parcial" in args)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
