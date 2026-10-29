"""Extrai a estrutura do Villa Flora II do PDF "Plano de Ataque R02".

Uso: python3 tools/extrair_villaflora.py <plano_de_ataque.pdf>
Gera src/villaflora-r02.js (dados) e src/villaflora-planta.js (imagem da planta).

Regras usadas (conferidas contra a legenda do desenho):
- números de 7,3 pt são as casas (1 a 198); de 17,8 pt, os ranks (1 a 66);
- cada casa pertence ao rank mais próximo, com 3 casas por rank;
- fases pela sequência da legenda: I = ranks 1-28 (84 un.), II = 29-46 (54), III = 47-66 (60);
- trechos lidos no desenho (linhas tracejadas), ver TRECHOS abaixo;
- escala: vagas de 2,30 m a cada 12,216 pt (5,311 pt/m), confirmada pela área do terreno.
"""
import base64, collections, io, json, math, re, subprocess, sys, tempfile, os
from PIL import Image

pdf = sys.argv[1]
raiz = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
tmp = tempfile.mkdtemp()
subprocess.run(['pdftotext', '-bbox', pdf, f'{tmp}/a.html'], check=True)
s = open(f'{tmp}/a.html', encoding='utf8').read()
ws = [(float(a), float(b), float(c), float(d), t) for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', s)]
cen = lambda w: ((w[0] + w[2]) / 2, (w[1] + w[3]) / 2)
alt = lambda w: round(w[3] - w[1], 1)
casas = {int(w[4]): cen(w) for w in ws if alt(w) == 7.3 and w[4].isdigit()}
ranks = {int(w[4]): cen(w) for w in ws if alt(w) == 17.8 and w[4].isdigit()}
assert sorted(casas) == list(range(1, 199)), 'esperadas 198 casas'
assert sorted(ranks) == list(range(1, 67)), 'esperados 66 ranks'

ESC = 12.216 / 2.30          # pt por metro
OX, OY = 607.0, 419.0        # origem (centro das casas), em pt
m = lambda x, y: (round((x - OX) / ESC, 2), round((y - OY) / ESC, 2))

# casa -> rank (mais próximo, 3 por rank)
pares = sorted((math.dist(casas[c], ranks[r]), c, r) for c in casas for r in ranks)
cap = collections.Counter(); dono = {}
for _, c, r in pares:
    if c in dono or cap[r] >= 3: continue
    dono[c] = r; cap[r] += 1
grupos = collections.defaultdict(list)
for c, r in dono.items(): grupos[r].append(c)
for r, g in grupos.items():
    g.sort(); assert g[2] - g[0] == 2, f'rank {r} com casas não consecutivas {g}'

fase = lambda r: 1 if r <= 28 else 2 if r <= 46 else 3
TRECHOS = {1: range(1, 5), 2: range(5, 9), 3: range(9, 14), 4: range(14, 19), 5: range(19, 25), 6: range(25, 27), 7: range(27, 29),
           10: range(29, 32), 11: range(32, 39), 12: range(39, 45), 13: range(45, 47),
           14: range(47, 52), 15: range(52, 58), 16: range(58, 63), 17: range(63, 67)}
trecho_do_rank = {r: t for t, rr in TRECHOS.items() for r in rr}
assert sorted(trecho_do_rank) == list(range(1, 67))

PASSO = 28.03 / ESC  # frente da casa (m)
saida_ranks, saida_casas = [], []
for r in range(1, 67):
    g = grupos[r]
    pts = [casas[c] for c in g]
    dx = pts[2][0] - pts[0][0]; dy = pts[2][1] - pts[0][1]
    horizontal = abs(dx) >= abs(dy)
    cxr = sum(p[0] for p in pts) / 3; cyr = sum(p[1] for p in pts) / 3
    rx, ry = ranks[r]
    # frente voltada para o lado do círculo do rank (acesso), girada em múltiplos de 90°
    if horizontal: rot = 0 if ry >= cyr else 180
    else: rot = 90 if rx >= cxr else 270
    eixo = (lambda c: casas[c][0]) if horizontal else (lambda c: casas[c][1])
    meio = sorted(g, key=eixo)[1]
    saida_ranks.append({'n': r, 'fase': fase(r), 'trecho': trecho_do_rank[r], 'pos': m(rx, ry)})
    for c in g:
        x, z = m(*casas[c])
        terrea = c == meio
        saida_casas.append({'n': c, 'rank': r, 'x': x, 'z': z, 'rot': rot, 'terrea': terrea})

# áreas comuns: posição pelo texto do desenho, área pelo quadro de áreas da implantação
ANEXOS = [
    # nome, trecho, forma, x_pt, y_pt, w, d, h, área (m², quadro de áreas) ou None
    ('Churrasqueira coberta', 1, 'bloco', 153, 131, 5.5, 4.1, 3.0, 22.31),
    ('Fitness 3ª idade', 4, 'area', 540, 196, 10.5, 5.5, 0.3, None),
    ('Sala de ginástica', 3, 'bloco', 606, 308, 8.4, 5.9, 3.2, 49.29),
    ('Playground norte', 3, 'playground', 823, 205, 9.2, 6.2, 0.4, None),
    ('Brinquedoteca', 9, 'bloco', 681, 446, 8.4, 5.9, 3.2, 49.29),
    ('Guarita', 7, 'bloco', 152, 547, 4.6, 4.6, 3.0, 21.08),
    ('Playground sul', 7, 'playground', 221, 558, 9.2, 6.8, 0.4, None),
    ('Piscinas', 7, 'piscina', 223, 600, 9.9, 16.6, 1.4, None),
    ('Salão de festas', 7, 'bloco', 161, 604, 7.75, 12.0, 3.5, 92.98),
    ('Pet place', 7, 'area', 152, 696, 10.5, 9.9, 0.3, None),
    ('Depósito de lixo', 7, 'bloco', 178, 731, 4.5, 4.55, 2.8, 20.51),
    ('Serviços', 6, 'bloco', 205, 465, 8.2, 4.25, 3.0, 34.78),
    ('Reservatório de retenção', 6, 'area', 140, 442, 10.0, 6.0, 0.3, None),
    ("Reservatório d'água", 8, 'reservatorio', 1052, 700, 4.0, 4.0, 10.0, 12.57),
]
saida_anexos = []
for nome, t, forma, x, y, w, d, h, a in ANEXOS:
    X, Z = m(x, y)
    saida_anexos.append({'nome': nome, 'trecho': t, 'forma': forma, 'x': X, 'z': Z, 'w': w, 'd': d, 'h': h, 'area': a})

# estacionamentos e circulações (faixas retangulares no desenho, em pt)
INFRA = [
    ('Estacionamento e circulação central', 9, 277, 330, 796, 402),
    ('Estacionamento leste', 10, 800, 337, 862, 402),
    ('Estacionamento sul (oeste)', 13, 375, 586, 529, 662),
    ('Estacionamento sul (leste)', 18, 529, 586, 907, 662),
    ('Circulação interna e vagas de visitantes', 6, 117, 485, 244, 497),
]
saida_infra = []
for nome, t, x0, y0, x1, y1 in INFRA:
    X, Z = m((x0 + x1) / 2, (y0 + y1) / 2)
    saida_infra.append({'nome': nome, 'trecho': t, 'x': X, 'z': Z, 'w': round((x1 - x0) / ESC, 1), 'd': round((y1 - y0) / ESC, 1)})

dados = {'fonte': 'Villa Flora II - Desenho Plano de Ataque_R02.pdf', 'escalaPtPorM': round(ESC, 4), 'frente': round(PASSO, 2),
         'ranks': saida_ranks, 'casas': sorted(saida_casas, key=lambda c: c['n']), 'anexos': saida_anexos, 'infra': saida_infra}
with open(os.path.join(raiz, 'src', 'villaflora-r02.js'), 'w', encoding='utf8') as f:
    f.write('// Gerado por tools/extrair_villaflora.py a partir do Plano de Ataque R02. Não editar à mão.\n')
    f.write('export const VF_R02 = ' + json.dumps(dados, ensure_ascii=False, separators=(',', ':')) + ';\n')

# imagem da planta (área do desenho, sem a legenda) para usar como base no 3D
X0, Y0, X1, Y1 = 70, 85, 1110, 785
dpi = 120
subprocess.run(['pdftoppm', '-r', str(dpi), '-png', pdf, f'{tmp}/p'], check=True)
im = Image.open([f'{tmp}/{x}' for x in os.listdir(tmp) if x.startswith('p') and x.endswith('.png')][0]).convert('RGB')
k = dpi / 72
im = im.crop((int(X0 * k), int(Y0 * k), int(X1 * k), int(Y1 * k)))
buf = io.BytesIO(); im.save(buf, 'JPEG', quality=72, optimize=True)
cx, cz = m((X0 + X1) / 2, (Y0 + Y1) / 2)
base = {'x': cx, 'z': cz, 'largura': round((X1 - X0) / ESC, 2), 'rot': 0, 'opacidade': 0.75}
with open(os.path.join(raiz, 'src', 'villaflora-planta.js'), 'w') as f:
    f.write('// Gerado por tools/extrair_villaflora.py: recorte do Plano de Ataque R02 alinhado à escala do modelo.\n')
    f.write(f'export const VF_PLANTA_BASE = {json.dumps(base)};\n')
    f.write('export const VF_PLANTA_JPEG = "data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode() + '";\n')
print('ranks', len(saida_ranks), 'casas', len(saida_casas), 'anexos', len(saida_anexos), 'infra', len(saida_infra), 'planta KB', len(buf.getvalue()) // 1024, base)
