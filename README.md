# Obras 3D · acompanhamento físico

Plataforma para acompanhar o avanço físico de obras em 3D: condomínios de casas, edifícios, loteamentos e obras de infraestrutura. Interface em português, pensada para uso em campo (mouse ou toque).

## Como abrir

Abra `dist/index.html` com dois cliques, no Chrome, Edge ou Firefox. Não precisa de servidor nem de instalação. Tudo fica gravado no próprio navegador e continua lá ao fechar e abrir de novo.

Para gerar o arquivo de novo a partir do código:

```bash
npm install
```

```bash
npm run build
```

## O que a plataforma faz

| Item | Onde fica |
|---|---|
| Várias obras: criar, editar, selecionar, duplicar (com ou sem avanços), arquivar | botão **Obras** e seletor no topo |
| Estrutura configurável: fases, quadras, ranks, casas; torres, pavimentos, aptos; setores, quadras, lotes, ruas; setores, blocos, frentes | geração automática ao criar a obra; aba **Estrutura e propriedades** de cada grupo |
| Casas por rank configurável por obra | editar obra (✎) e botão “+ Rank com N casas” |
| Plantas e documentos por obra; imagem ou PDF como planta de base no 3D | botão **Documentos** |
| Ajuste de posição, orientação, nome e dimensões; arrastar na cena | aba **Posição e propriedades**, botão **Mover** |
| Navegação: girar, deslocar, aproximar, vista geral, superior, primeira pessoa com personagem e colisão | barra acima da cena |
| Etapas por obra, com ordem, unidade, peso e representação 3D | botão **Etapas** |
| Lançamento por elemento, grupo ou conjunto selecionado, com prévia de quem será afetado | painel inferior |
| Acumulado mensal: anterior + realizado no mês = atual; correção retroativa com motivo | painel inferior e linha do tempo |
| Situação “Finalizado” e “Entregue”, com ✓ na cena e “x de y finalizadas” no grupo | botão **Finalizar** e aba **Finalização** |
| Áreas comuns e infraestrutura com etapas e indicadores próprios | lista à esquerda, cards à direita |
| Modos Maquete, Por avanço, O que mudou, Etapa; lado a lado sincronizado; reprodução mês a mês | barra da cena e linha do tempo |
| Exportar e importar a obra completa (.json); planilha de conferência (.xlsx); limpar avanços da obra aberta com cópia de segurança | botão **Dados** |

## Regras de cálculo

1. Avanço da etapa no elemento = acumulado da etapa ÷ quantidade total da etapa no elemento.
2. Avanço do elemento = Σ (peso da etapa × avanço da etapa) ÷ Σ pesos das etapas aplicáveis.
3. Avanço do grupo ou da obra = Σ (peso do elemento × avanço do elemento) ÷ Σ pesos dos elementos.
4. Acumulado do mês = acumulado do mês anterior + realizado no mês. Mês sem lançamento mantém o acumulado.
5. Cada lançamento é gravado no elemento (casa, apto, área comum, trecho), por etapa e por mês. Lançar num grupo grava em cada elemento dele, então o consolidado nunca conta o mesmo serviço duas vezes.
6. Salvar de novo o mesmo valor substitui, não soma.
7. Correção é a alteração de um mês anterior ao último mês já lançado na obra, ou de um mês com lançamentos posteriores daquela etapa. Ela pede motivo, fica no registro de alterações e mantém o realizado de cada mês seguinte. Nenhuma alteração pode deixar o acumulado de qualquer mês fora de 0% a 100%.
8. A finalização vale do mês em que foi registrada em diante e é separada do % físico das etapas.

A mesma regra aparece no painel de indicadores.

## Villa Flora II

Vem cadastrado na primeira abertura, com avanços zerados. A estrutura foi extraída do PDF `Villa Flora II - Desenho Plano de Ataque_R02.pdf` pelo script `tools/extrair_villaflora.py`, e as áreas vêm do quadro de áreas de `1002.ARQ.EX.0001.IMP-R01.pdf`:

- **3 fases**, como na legenda: Fase I com 84 casas e as áreas comuns (ranks 01–28), Fase II com 54 (ranks 29–46) e Fase III com 60 (ranks 47–66). Total de 198 casas.
- **18 trechos** de ataque, lidos no desenho. Fase I: T01 = R01–04, T02 = R05–08, T03 = R09–13, T04 = R14–18, T05 = R19–24, T06 = R25–26, T07 = R27–28, T08 = reservatório e T09 = estacionamento central. Fase II: T10 = R29–31, T11 = R32–38, T12 = R39–44 e T13 = R45–46. Fase III: T14 = R47–51, T15 = R52–57, T16 = R58–62, T17 = R63–66 e T18 = estacionamento sul.
- **Numeração real das casas**, com 3 números consecutivos por rank. Por exemplo, o Rank 01 tem as casas 145 a 147.
- **Posições na escala do desenho.** As vagas de 2,30 m ficam a cada 12,216 pt, o que dá 5,311 pt/m. Por essa escala o terreno fica com cerca de 21.800 m², contra 21.699,05 m² no quadro de áreas.
- **14 áreas comuns**, com as áreas do quadro: salão de festas 92,98 m², churrasqueira 22,31 m², brinquedoteca 49,29 m², sala de ginástica 49,29 m², guarita 21,08 m², serviços 34,78 m², depósito de lixo 20,51 m² e reservatório d'água 12,57 m². Também entram piscinas, dois playgrounds, fitness 3ª idade, pet place e reservatório de retenção.
- **5 trechos de estacionamento e circulação**, com quantidades calculadas pelas dimensões.
- **Peso de cada casa = área privativa.** São 66 térreas de 44,28 m², a casa do meio de cada rank (a legenda indica casas 01 e 03 como sobrado), e 132 sobrados de 55,5 m² em média.
- **Planta do Plano de Ataque já posicionada** como base do 3D, para conferência visual.

**A validar:**

- **Profundidade das casas.** Foi estimada pela área: 8,4 m na térrea e 7,0 m no sobrado.
- **Os 8 sobrados de 3 dormitórios.** O quadro de áreas não diz quais casas são. Ajuste o peso dessas 8 para 65,63 m².
- **Áreas comuns em limite de trecho.** A brinquedoteca (T09) e o playground norte (T03) ficam entre trechos e foram atribuídos por proximidade.
- **Dimensões das áreas comuns sem área no quadro.** Piscinas, playgrounds, pet place, fitness e retenção foram medidos no desenho.

Quem já tinha aberto a versão provisória: sem lançamentos, a obra é refeita automaticamente pelo R02. Com lançamentos, ela é mantida e uma nova obra "Villa Flora II (Plano de Ataque R02)" é criada ao lado.

Os pesos das etapas continuam provisórios (Terraplenagem 5, Fundações 10, Estrutura 15, Alvenaria 20, Cobertura 12, Instalações 15, Acabamentos 18, Paisagismo 5). Ajuste em **Etapas** conforme o orçamento.

## Onde os dados ficam

- Cada obra é gravada separadamente no IndexedDB do navegador (ou no localStorage, se o IndexedDB estiver bloqueado). Os arquivos anexados ficam num depósito à parte, ligados à obra.
- Os dados ficam no navegador e no computador em que foram lançados. Para levar a outro computador ou guardar cópia, use **Dados › Exportar obra**. Limpar os dados do navegador apaga as obras.
- Não há sincronização entre usuários. Duas pessoas lançando em navegadores diferentes geram arquivos diferentes.

## Testes

```bash
npm test
```

```bash
npm run build && npm run e2e
```

- `test/calc.test.mjs`: 14 testes do núcleo de cálculo (acumulação, mês sem lançamento, salvar duas vezes, correção retroativa, limites 0–100%, quantidade, coletivo sem dupla contagem, conclusão, limpeza, duplicação, período, comparação entre meses).
- `test/e2e.mjs`: 78 verificações no navegador, cobrindo cada item da lista de entrega: independência entre obras, lançamento individual e coletivo, acumulação, correção, persistência após recarregar, ✓, áreas comuns e infraestrutura, exportação e importação, planilha, limpeza, mouse, toque e primeira pessoa.

## Limitações conhecidas

- Usar PDF como planta de base precisa de internet na primeira vez, para carregar o leitor de PDF (pdf.js, cdnjs). Depois a imagem convertida fica guardada. Sem internet, anexe a planta como PNG ou JPG.
- A colisão na caminhada considera a base de casas, blocos, térreo de edifícios, piscinas e reservatórios que já têm estrutura ou paredes. Ruas e áreas descobertas são livres.
- Arquivos grandes (PDFs de centenas de MB) podem esbarrar no limite de espaço do navegador.

## Código

```
src/calc.js     núcleo de cálculo (sem interface)
src/model.js    modelos, etapas padrão, geradores de estrutura, Villa Flora II
src/villaflora-r02.js, villaflora-planta.js   dados e planta gerados do Plano de Ataque R02
tools/extrair_villaflora.py   extração a partir do PDF
src/store.js    gravação local (IndexedDB)
src/scene.js    cena 3D (three.js): desenho por etapa, modos, seleção, caminhada
src/app.js      estado, troca de obras, gravação automática, linha do tempo
src/editor.js   painel de lançamento, finalização, histórico e propriedades
src/paineis.js  lista de elementos e indicadores
src/modais.js   obras, etapas, documentos, dados e ajuda
src/xlsx.js     gerador de planilha .xlsx
```
