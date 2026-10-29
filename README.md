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

Vem cadastrado na primeira abertura, com avanços zerados:

- 66 ranks de 3 casas = 198 casas, numeradas de 001 a 198 em sequência por rank (R01 = casas 001 a 003).
- 12 áreas comuns: guarita, salão de festas, piscinas adulto e infantil, academia, brinquedoteca, churrasqueira, playground, pet place, reservatório e depósitos.
- 5 vias (ruas A a D e avenida de acesso) com etapas de infraestrutura por quantidade.
- Os documentos `1002.ARQ.EX.0001.IMP-R01.pdf` e `Villa Flora II - Desenho Plano de Ataque_R02.pdf` aparecem como pendentes em **Documentos**, para você anexar.

**A validar:** os dois PDFs não estavam disponíveis quando a plataforma foi construída. Por isso o modelo está marcado como esquemático:

- a divisão das fases é provisória (F1 = R01–R22, F2 = R23–R44, F3 = R45–R66);
- a numeração das casas e a posição dos ranks e das áreas comuns seguem uma grade padrão, não a implantação.

Ao anexar a implantação, marque “usar como planta”, ajuste escala e posição, e corrija fases, numeração e posições pela aba **Estrutura e propriedades** (mover para outro grupo, renumerar, ajustar X/Z/rotação ou arrastar na cena).

Os pesos das etapas são um padrão provisório (Terraplenagem 5, Fundações 10, Estrutura 15, Alvenaria 20, Cobertura 12, Instalações 15, Acabamentos 18, Paisagismo 5). Ajuste em **Etapas** conforme o orçamento da obra.

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
- `test/e2e.mjs`: 77 verificações no navegador, cobrindo cada item da lista de entrega: independência entre obras, lançamento individual e coletivo, acumulação, correção, persistência após recarregar, ✓, áreas comuns e infraestrutura, exportação e importação, planilha, limpeza, mouse, toque e primeira pessoa.

## Limitações conhecidas

- Usar PDF como planta de base precisa de internet na primeira vez, para carregar o leitor de PDF (pdf.js, cdnjs). Depois a imagem convertida fica guardada. Sem internet, anexe a planta como PNG ou JPG.
- A colisão na caminhada considera a base de casas, blocos, térreo de edifícios, piscinas e reservatórios que já têm estrutura ou paredes. Ruas e áreas descobertas são livres.
- Arquivos grandes (PDFs de centenas de MB) podem esbarrar no limite de espaço do navegador.

## Código

```
src/calc.js     núcleo de cálculo (sem interface)
src/model.js    modelos, etapas padrão, geradores de estrutura, Villa Flora II
src/store.js    gravação local (IndexedDB)
src/scene.js    cena 3D (three.js): desenho por etapa, modos, seleção, caminhada
src/app.js      estado, troca de obras, gravação automática, linha do tempo
src/editor.js   painel de lançamento, finalização, histórico e propriedades
src/paineis.js  lista de elementos e indicadores
src/modais.js   obras, etapas, documentos, dados e ajuda
src/xlsx.js     gerador de planilha .xlsx
```
