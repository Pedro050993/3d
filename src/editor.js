// Painel inferior: lançamento individual e coletivo, finalização, histórico e propriedades.

import * as C from './calc.js';
import { FORMAS, CLASSES, novoElemento } from './model.js';
import { fmtMes, mesAnterior, validaMes } from './meses.js';
import { $, $$, esc, num, pct, pp, lerNum, dataHora, dialogo, confirmar, perguntar, toast } from './util.js';
import { app, mutar, selecionar, renderTudo } from './app.js';
import { rotCategoria } from './paineis.js';
import { corAvanco } from './scene.js';

const caminho = (id) => C.ancestrais(app.idx, id).map((a) => a.nome).join(' › ');

function alvoAtual() {
  const { idx, selecao } = app;
  const els = selecao.map((id) => idx.elemById.get(id)).filter(Boolean);
  if (!els.length) return null;
  if (els.length === 1 && C.ehFolha(els[0])) return { tipo: 'folha', elem: els[0] };
  const folhas = C.expandirSelecao(idx, selecao);
  return { tipo: els.length === 1 ? 'grupo' : 'conjunto', grupo: els.length === 1 ? els[0] : null, els, folhas };
}

function etapasVisiveis(lista) {
  if (app.modo === 'etapa' && app.etapaFiltro !== 'todas') return lista.filter((x) => x.id === app.etapaFiltro);
  return lista;
}

export function renderEditor() {
  const el = $('#editor');
  if (!el || !app.idx) return;
  const a = alvoAtual();
  if (!a) {
    el.innerHTML = `<div class="ed-vazio">
      <b>Selecione o que vai receber o lançamento.</b>
      <span>Clique numa casa, apartamento, área comum ou trecho na cena ou na lista à esquerda. Dê dois cliques (ou use “Nível de seleção”) para pegar o rank, pavimento ou grupo inteiro. Shift + clique monta um conjunto.</span>
      <span>Competência ativa: <b>${fmtMes(app.mes)}</b>. Os valores gravam sozinhos ao sair do campo.</span></div>`;
    return;
  }
  if (a.tipo === 'folha') el.innerHTML = htmlFolha(a.elem);
  else el.innerHTML = htmlGrupo(a);
}

// ---------------------------------------------------------------- folha

function chipStatus(s) {
  return `<span class="chip st-${s}">${s === 'finalizado' || s === 'entregue' ? '✓ ' : ''}${C.ROTULO_STATUS[s]}</span>`;
}

function htmlFolha(e) {
  const { idx, mes } = app;
  const s = C.statusElem(idx, e, mes);
  const fis = C.progElem(idx, e, mes);
  const conc = C.situacaoConclusao(app.obra, e.id, mes);
  const aba = ['avanco', 'historico', 'props'].includes(app.abaEditor) ? app.abaEditor : 'avanco';
  return `<div class="ed-topo">
      <div class="alvo"><span class="rot">Lançamento em</span><b class="nome-alvo">${esc(e.nome)}</b>
        <span class="cam">${esc(caminho(e.id))}${e.categoria ? ` · ${esc(rotCategoria(e.categoria))}` : ''}${e.tipologia ? ` · ${esc(e.tipologia)}` : ''}</span>
        <span class="comp">Competência <b>${fmtMes(mes)}</b></span></div>
      <div class="situacao">${chipStatus(s)}<span class="fis">Físico ${pct(fis)}</span>
        ${conc ? `<button data-acao="reabrir" class="sec">Reabrir</button>${conc === 'finalizado' ? '<button data-acao="entregar" class="sec">Marcar entregue</button>' : ''}`
    : `<button data-acao="finalizar" class="ok">✓ Finalizar em ${fmtMes(mes)}</button>`}
        <button data-acao="selPai" class="sec" title="Selecionar o grupo deste elemento">⬆ Grupo</button>
      </div>
    </div>
    <div class="abas" role="tablist">
      <button class="${aba === 'avanco' ? 'ativa' : ''}" data-aba="avanco">Avanço por etapa</button>
      <button class="${aba === 'historico' ? 'ativa' : ''}" data-aba="historico">Histórico</button>
      <button class="${aba === 'props' ? 'ativa' : ''}" data-aba="props">Posição e propriedades</button>
    </div>
    <div class="ed-corpo">${aba === 'avanco' ? tabelaFolha(e) : aba === 'historico' ? historicoFolha(e) : propsElem(e)}</div>`;
}

function tabelaFolha(e) {
  const { idx, mes } = app;
  const ant = mesAnterior(mes);
  const ets = etapasVisiveis(C.etapasDoElem(idx, e));
  if (!ets.length) return '<p class="vazio">Nenhuma etapa se aplica a este elemento. Cadastre etapas do grupo correspondente em “Etapas” ou revise as etapas aplicáveis em “Posição e propriedades”.</p>';
  const linhas = ets.map((et) => {
    const tot = C.total(e, et);
    const aAnt = C.acumulado(idx, e.id, et.id, ant);
    const real = C.realizado(idx, e.id, et.id, mes);
    const aAt = aAnt + real;
    const pAnt = (aAnt / tot) * 100;
    const pAt = (aAt / tot) * 100;
    const qtd = et.unidade !== '%';
    const temLanc = !!app.obra.lancamentos[C.chave(e.id, et.id, mes)];
    return `<tr data-et="${et.id}">
      <td class="et"><b>${esc(et.nome)}</b><small>peso ${num(et.peso, 0)}</small></td>
      <td class="n">${qtd ? `${num(tot, 0)} ${esc(et.unidade)}` : '100%'}</td>
      <td class="n ant">${pct(pAnt)}${qtd ? `<small>${num(aAnt, 1)} ${esc(et.unidade)}</small>` : ''}</td>
      <td class="n"><span class="mais">+</span><input class="in-real" inputmode="decimal" value="${num(qtd ? real : (real / tot) * 100, qtd ? 2 : 1)}" aria-label="Realizado no mês ${esc(et.nome)}"><small>${qtd ? esc(et.unidade) : 'p.p.'}</small></td>
      <td class="barra-cel"><input type="range" class="barra" min="0" max="100" step="0.5" value="${pAt}" style="--ant:${pAnt}%;--atu:${pAt}%" aria-label="Acumulado atual ${esc(et.nome)}"></td>
      <td class="n"><span class="igual">=</span><input class="in-acum" inputmode="decimal" value="${num(pAt, 1)}" aria-label="Acumulado atual % ${esc(et.nome)}"><small>%</small>${qtd ? `<small class="q">${num(aAt, 1)} ${esc(et.unidade)}</small>` : ''}</td>
      <td class="marca">${temLanc ? '<span title="Há lançamento neste mês" class="pt">●</span>' : ''}</td>
    </tr>`;
  }).join('');
  return `<div class="tab-wrap"><table class="tab-lanc">
    <thead><tr><th>Etapa</th><th>Total</th><th>Acumulado anterior<small>${fmtMes(ant)}</small></th><th>Realizado no mês<small>${fmtMes(mes)}</small></th><th>Barra (arraste)</th><th>Acumulado atual</th><th></th></tr></thead>
    <tbody>${linhas}</tbody></table></div>
    <div class="ed-acoes"><span class="formula">Acumulado anterior + realizado no mês = acumulado atual · físico do elemento ${pct(C.progElem(app.idx, e, mes))}</span>
      ${app.modo === 'etapa' && app.etapaFiltro !== 'todas' ? '<span class="aviso">Filtro de etapa ativo</span>' : ''}
      <button class="sec" data-acao="tudo100">Todas as etapas a 100%</button>
      <button class="sec" data-acao="zerarMes">Limpar lançamentos deste mês</button></div>`;
}

function historicoFolha(e) {
  const { idx, obra } = app;
  const lanc = Object.entries(obra.lancamentos).filter(([k]) => k.startsWith(e.id + '|')).map(([k, v]) => {
    const [, etId, comp] = k.split('|');
    return { comp, et: idx.etapasById.get(etId), v };
  }).filter((x) => x.et).sort((a, b) => (a.comp < b.comp ? -1 : a.comp > b.comp ? 1 : a.et.ordem - b.et.ordem));
  const linhas = lanc.map((x) => {
    const tot = C.total(e, x.et);
    const ac = C.acumulado(idx, e.id, x.et.id, x.comp);
    return `<tr><td>${fmtMes(x.comp)}</td><td>${esc(x.et.nome)}</td><td class="n">${x.et.unidade === '%' ? pp((x.v.v / tot) * 100) : `${num(x.v.v, 2)} ${esc(x.et.unidade)}`}</td><td class="n">${pct((ac / tot) * 100)}</td><td>${x.v.origem === 'coletivo' ? 'coletivo' : 'individual'}</td><td><button class="link" data-ir="${x.comp}">ir ao mês</button></td></tr>`;
  }).join('');
  const evs = C.eventosConclusao(obra, e.id).slice().sort((a, b) => (a.comp < b.comp ? -1 : 1));
  const conc = evs.map((ev) => `<tr><td>${fmtMes(ev.comp)}</td><td>${ev.acao === 'finalizar' ? 'Finalizado' : ev.acao === 'entregar' ? 'Entregue' : 'Reaberto'}</td><td>${esc(ev.obs || '')}</td>
    <td><button class="link" data-mover-ev="${ev.id}">corrigir mês</button> <button class="link perigo" data-rem-ev="${ev.id}">remover</button></td></tr>`).join('');
  const revs = (obra.revisoes || []).filter((r) => r.elemId === e.id).slice(-40).reverse().map((r) => {
    const et = r.etapaId ? idx.etapasById.get(r.etapaId) : null;
    const tipo = { lancamento: 'Lançamento', correcao: 'Correção', conclusao: 'Conclusão', conclusao_removida: 'Conclusão removida', conclusao_corrigida: 'Conclusão corrigida' }[r.tipo] || r.tipo;
    const det = r.etapaId ? `${et ? esc(et.nome) : '?'}: ${num(r.antes, 2)} → ${num(r.depois, 2)}${et && et.unidade !== '%' ? ' ' + esc(et.unidade) : ''}` : esc(r.acao || '');
    return `<tr class="${r.tipo === 'correcao' ? 'corr' : ''}"><td>${dataHora(r.em)}</td><td>${tipo}${r.origem === 'coletivo' ? ' (coletivo)' : ''}</td><td>${fmtMes(r.comp)}</td><td>${det}</td><td>${esc(r.motivo || '')}</td></tr>`;
  }).join('');
  return `<div class="hist-grid">
    <div><h4>Lançamentos (realizado por mês)</h4>${linhas ? `<table class="tab-mini"><thead><tr><th>Mês</th><th>Etapa</th><th>Realizado</th><th>Acum.</th><th>Origem</th><th></th></tr></thead><tbody>${linhas}</tbody></table>` : '<p class="vazio">Sem lançamentos.</p>'}</div>
    <div><h4>Conclusão / entrega</h4>${conc ? `<table class="tab-mini"><thead><tr><th>Mês</th><th>Situação</th><th>Obs.</th><th></th></tr></thead><tbody>${conc}</tbody></table>` : '<p class="vazio">Sem registro de conclusão.</p>'}
      <h4>Registro de alterações</h4>${revs ? `<table class="tab-mini"><thead><tr><th>Quando</th><th>Tipo</th><th>Mês</th><th>Detalhe</th><th>Motivo</th></tr></thead><tbody>${revs}</tbody></table>` : '<p class="vazio">Nada registrado.</p>'}</div></div>`;
}

function propsElem(e) {
  const folha = C.ehFolha(e);
  const g = C.grupoEtapa(e.classe);
  const ets = app.idx.etapasOrdenadas.filter((x) => x.grupo === g);
  const campo = (k, rot, tipo = 'number', extra = '') => `<label class="campo cmp-${k}"><span>${rot}</span><input data-prop="${k}" type="${tipo}" step="any" value="${esc(e[k])}" ${extra}></label>`;
  const sel = (k, rot, ops) => `<label class="campo"><span>${rot}</span><select data-prop="${k}">${Object.entries(ops).map(([v, t]) => `<option value="${v}" ${e[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const filhos = C.filhosDe(app.idx, e.id);
  return `<div class="props">
    <div class="props-col">
      <h4>Identificação</h4>
      ${campo('nome', 'Nome', 'text')}${campo('codigo', 'Código / número', 'text')}${campo('categoria', 'Categoria (rank, casa, torre...)', 'text')}
      ${sel('classe', 'Classe', CLASSES)}
      ${folha ? sel('forma', 'Representação 3D', FORMAS) : ''}
      ${folha ? campo('peso', 'Peso no avanço geral', 'number', 'min="0"') : ''}
    </div>
    ${folha ? `<div class="props-col">
      <h4>Posição, orientação e dimensões (m, graus)</h4>
      <div class="linha-campos">${campo('x', 'X')}${campo('z', 'Z')}${campo('y', 'Elevação')}${campo('rot', 'Rotação °')}</div>
      <div class="linha-campos">${campo('w', 'Largura / comprimento')}${campo('d', 'Profundidade / largura')}${campo('h', 'Altura')}</div>
      <div class="nudge">
        <button data-nudge="x:-1">← 1 m</button><button data-nudge="x:1">→ 1 m</button><button data-nudge="z:-1">↑ 1 m</button><button data-nudge="z:1">↓ 1 m</button>
        <button data-nudge="rot:-15">⟲ 15°</button><button data-nudge="rot:15">⟳ 15°</button>
        <button class="${app.moverAtivo ? 'ativo' : ''}" data-acao="moverCena" title="Com o modo ativo, arraste o elemento selecionado na cena">✥ Arrastar na cena</button>
      </div>
    </div>
    <div class="props-col">
      <h4>Etapas aplicáveis e quantidades</h4>
      ${ets.length ? ets.map((x) => `<div class="et-aplic"><label><input type="checkbox" data-aplic="${x.id}" ${e.etapasExcluidas.includes(x.id) ? '' : 'checked'}> ${esc(x.nome)}</label>
        ${x.unidade !== '%' ? `<input class="qtd" data-qtd="${x.id}" inputmode="decimal" value="${num(C.total(e, x), 2)}"> ${esc(x.unidade)}` : '<small>em %</small>'}</div>`).join('') : '<p class="vazio">Sem etapas para esta classe.</p>'}
    </div>` : `<div class="props-col">
      <h4>Estrutura do grupo (${filhos.length} itens)</h4>
      <div class="botoes-col">
        <button data-acao="addFilho" data-cls="unidade">+ Unidade (casa, apto, lote)</button>
        <button data-acao="addFilho" data-cls="grupo">+ Subgrupo (rank, pavimento, quadra)</button>
        ${['fase', 'quadra', 'trecho'].includes(e.categoria) ? `<button data-acao="addRank">+ Rank com ${app.obra.config.casasPorRank || 3} casas</button>` : ''}
        <button data-acao="addFilho" data-cls="anexo">+ Área comum / anexo</button>
        <button data-acao="addFilho" data-cls="infra">+ Trecho de infraestrutura</button>
        <button data-acao="serie">Gerar série de elementos…</button>
        <button data-acao="renumerar">Renumerar itens…</button>
        <button data-acao="moverCena" class="${app.moverAtivo ? 'ativo' : ''}">✥ Arrastar grupo na cena</button>
      </div>
    </div>`}
    <div class="props-col">
      <h4>Ações</h4>
      <div class="botoes-col">
        <button data-acao="duplicarElem">Duplicar ${folha ? 'elemento' : 'grupo com o conteúdo'}</button>
        <button data-acao="moverPara">Mover para outro grupo…</button>
        <button data-acao="focar">Centralizar na cena</button>
        <button class="perigo" data-acao="excluirElem">Excluir ${folha ? 'elemento' : 'grupo e conteúdo'}</button>
      </div>
      <p class="dica">Ajustes de posição e dimensão não alteram lançamentos. ${app.obra.esquematico ? 'Modelo marcado como esquemático: confira contra a implantação.' : ''}</p>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- grupo / conjunto

function htmlGrupo(a) {
  const { idx, mes } = app;
  const n = a.folhas.length;
  const nf = a.folhas.filter((f) => C.situacaoConclusao(app.obra, f.id, mes)).length;
  const p = C.progConjunto(idx, a.folhas, mes);
  const pAnt = C.progConjunto(idx, a.folhas, mesAnterior(mes));
  const nomeUn = nomeUnidades(a.folhas);
  const aba = ['coletivo', 'final', 'elems', 'props'].includes(app.abaEditor) ? app.abaEditor : 'coletivo';
  const titulo = a.grupo ? esc(a.grupo.nome) : `Conjunto de ${a.els.length} seleções`;
  return `<div class="ed-topo">
      <div class="alvo"><span class="rot">Lançamento coletivo em</span><b class="nome-alvo">${titulo}</b>
        <span class="cam">${a.grupo ? esc(caminho(a.grupo.id)) : ''} ${n} ${nomeUn}</span>
        <span class="comp">Competência <b>${fmtMes(mes)}</b></span></div>
      <div class="situacao"><span class="cont-fin"><b>${nf} de ${n}</b> ${nomeUn} finalizad${nomeUn.endsWith('as') ? 'as' : 'os'} ${a.grupo ? `neste ${esc(rotCategoria(a.grupo.categoria).toLowerCase() || 'grupo')}` : 'no conjunto'}</span>
        <span class="fis">Físico ${pct(p)} (${pp(p - pAnt)} no mês)</span>
        ${a.grupo && a.grupo.paiId ? '<button data-acao="selPai" class="sec">⬆ Grupo acima</button>' : ''}
        ${app.selecao.length > 1 ? '<button data-acao="limparSel" class="sec">Limpar seleção</button>' : ''}</div>
    </div>
    <div class="abas" role="tablist">
      <button class="${aba === 'coletivo' ? 'ativa' : ''}" data-aba="coletivo">Lançamento coletivo</button>
      <button class="${aba === 'final' ? 'ativa' : ''}" data-aba="final">Finalização (${nf}/${n})</button>
      <button class="${aba === 'elems' ? 'ativa' : ''}" data-aba="elems">Elementos (${n})</button>
      ${a.grupo ? `<button class="${aba === 'props' ? 'ativa' : ''}" data-aba="props">Estrutura e propriedades</button>` : ''}
    </div>
    <div class="ed-corpo">${aba === 'coletivo' ? coletivo(a) : aba === 'final' ? finalizacao(a) : aba === 'elems' ? matriz(a) : propsElem(a.grupo)}</div>`;
}

function nomeUnidades(folhas) {
  const cats = new Set(folhas.map((f) => f.categoria));
  if (cats.size === 1) {
    const c = [...cats][0];
    return { casa: 'casas', apartamento: 'apartamentos', lote: 'lotes', area_comum: 'áreas comuns', via: 'trechos', frente: 'frentes' }[c] || 'elementos';
  }
  return 'elementos';
}

function coletivo(a) {
  const { idx } = app;
  const aplic = new Map();
  for (const f of a.folhas) for (const et of C.etapasDoElem(idx, f)) aplic.set(et.id, (aplic.get(et.id) || 0) + 1);
  const ets = etapasVisiveis(idx.etapasOrdenadas.filter((x) => aplic.has(x.id)));
  const st = app.coletivo;
  if (!st.etapas) st.etapas = new Set();
  return `<div class="col-grid">
    <div class="col-bloco">
      <h4>1. Etapas que serão alteradas <small>(as demais ficam como estão)</small></h4>
      <div class="et-checks">${ets.map((et) => `<label class="${st.etapas.has(et.id) ? 'on' : ''}"><input type="checkbox" data-col-et="${et.id}" ${st.etapas.has(et.id) ? 'checked' : ''}> ${esc(et.nome)} <small>${aplic.get(et.id)}/${a.folhas.length}</small></label>`).join('')}</div>
      <div class="mini-acoes"><button class="link" data-acao="colTodas">marcar todas</button> <button class="link" data-acao="colNenhuma">desmarcar</button></div>
    </div>
    <div class="col-bloco">
      <h4>2. Valor</h4>
      <label class="radio"><input type="radio" name="colModo" value="definir" ${st.modo !== 'somar' ? 'checked' : ''}> Definir o <b>acumulado atual</b> em</label>
      <div class="linha"><input id="colValDef" inputmode="decimal" value="${st.modo !== 'somar' ? esc(st.valor ?? '') : ''}" placeholder="ex.: 60"> %</div>
      <label class="radio"><input type="radio" name="colModo" value="somar" ${st.modo === 'somar' ? 'checked' : ''}> <b>Somar no mês</b> (realizado adicional)</label>
      <div class="linha"><input id="colValSom" inputmode="decimal" value="${st.modo === 'somar' ? esc(st.valor ?? '') : ''}" placeholder="ex.: 10"> p.p.</div>
      <label class="campo"><span>Observação (opcional)</span><input id="colObs" value="${esc(st.obs || '')}"></label>
      <button class="primario" data-acao="colPrevia">Ver quem será afetado</button>
    </div>
    <div class="col-bloco previa">${st.previa ? htmlPrevia(st.previa) : '<p class="dica">Escolha as etapas e o valor e clique em “Ver quem será afetado”. Nada é gravado antes de você confirmar.</p>'}</div>
  </div>`;
}

function htmlPrevia(pr) {
  const { idx } = app;
  const validas = pr.filter((l) => !l.ignorado && l.ok && !l.semMudanca);
  const erros = pr.filter((l) => !l.ignorado && !l.ok);
  const ign = pr.filter((l) => l.ignorado);
  const sem = pr.filter((l) => !l.ignorado && l.ok && l.semMudanca);
  const corr = validas.filter((l) => l.correcao);
  const elems = new Set(validas.map((l) => l.elemId));
  const linhas = pr.slice(0, 400).map((l) => {
    const e = idx.elemById.get(l.elemId);
    const et = idx.etapasById.get(l.etapaId);
    const cls = l.ignorado ? 'ign' : !l.ok ? 'err' : l.semMudanca ? 'sem' : l.correcao ? 'corr' : '';
    return `<tr class="${cls}"><td>${esc(e.nome)}</td><td>${esc(et.nome)}</td><td class="n">${l.ignorado ? '' : pct(l.antesPct)}</td><td class="n">${l.ignorado ? '' : pct(l.depoisPct)}</td>
      <td>${l.ignorado ? 'não se aplica' : !l.ok ? esc(l.erro) : l.semMudanca ? 'sem mudança' : l.correcao ? 'correção' : 'ok'}</td></tr>`;
  }).join('');
  return `<h4>3. Prévia: ${elems.size} elementos e ${validas.length} etapas serão alterados</h4>
    <p class="resumo-previa">${erros.length ? `<span class="err">${erros.length} bloqueado(s) por sair de 0–100%</span> · ` : ''}${corr.length ? `<span class="corr">${corr.length} correção(ões) de mês já lançado</span> · ` : ''}${sem.length ? `${sem.length} sem mudança · ` : ''}${ign.length ? `${ign.length} não se aplica` : ''}</p>
    <div class="tab-wrap curta"><table class="tab-mini"><thead><tr><th>Elemento</th><th>Etapa</th><th>Antes</th><th>Depois</th><th>Situação</th></tr></thead><tbody>${linhas}</tbody></table></div>
    ${corr.length ? '<label class="campo"><span>Motivo da correção (obrigatório)</span><input id="colMotivo" placeholder="ex.: medição revisada em campo"></label>' : ''}
    <div class="ed-acoes"><button class="sec" data-acao="colCancelar">Cancelar</button>
      <button class="primario" data-acao="colAplicar" ${validas.length ? '' : 'disabled'}>Aplicar a ${elems.size} elemento(s)${erros.length ? ' (ignorar bloqueados)' : ''}</button></div>`;
}

function matriz(a) {
  const { idx, mes } = app;
  const lista = a.folhas.slice(0, 250);
  const ets = etapasVisiveis(idx.etapasOrdenadas.filter((x) => lista.some((f) => C.etapasDoElem(idx, f).some((y) => y.id === x.id))));
  return `<div class="tab-wrap"><table class="tab-mini matriz"><thead><tr><th>Elemento</th>${ets.map((x) => `<th>${esc(x.nome)}</th>`).join('')}<th>Físico</th><th>Situação</th></tr></thead><tbody>
    ${lista.map((f) => {
    const ap = new Set(C.etapasDoElem(idx, f).map((x) => x.id));
    const s = C.statusElem(idx, f, mes);
    return `<tr data-sel="${f.id}" title="Clique para lançar só neste elemento"><td>${esc(f.nome)}</td>${ets.map((x) => {
      if (!ap.has(x.id)) return '<td class="na">–</td>';
      const v = C.pctEtapa(idx, f, x, mes);
      return `<td class="n" style="background:${v > 0 ? corAvanco(v, null) + '55' : 'transparent'}">${num(v, 0)}</td>`;
    }).join('')}<td class="n"><b>${num(C.progElem(idx, f, mes), 1)}</b></td><td>${chipStatus(s)}</td></tr>`;
  }).join('')}</tbody></table></div>${a.folhas.length > 250 ? `<p class="dica">Mostrando 250 de ${a.folhas.length}.</p>` : ''}`;
}

function finalizacao(a) {
  const { obra, mes, idx } = app;
  const pend = app.finalPendente;
  const nomeUn = nomeUnidades(a.folhas);
  const linhas = a.folhas.map((f) => {
    const atual = C.situacaoConclusao(obra, f.id, mes) || 'obra';
    const v = pend.has(f.id) ? pend.get(f.id) : atual;
    const p = C.progElem(idx, f, mes);
    const ev = C.eventosConclusao(obra, f.id).filter((x) => x.comp <= mes && x.acao !== 'reabrir').sort((x, y) => (x.comp < y.comp ? 1 : -1))[0];
    return `<tr class="${pend.has(f.id) ? 'pend' : ''}">
      <td><label class="chk-lin"><input type="checkbox" data-fin="${f.id}" ${v !== 'obra' ? 'checked' : ''}> ${esc(f.nome)}</label></td>
      <td class="n">${pct(p)}</td>
      <td><select data-fin-sel="${f.id}"><option value="obra" ${v === 'obra' ? 'selected' : ''}>Em obra</option><option value="finalizado" ${v === 'finalizado' ? 'selected' : ''}>Finalizado</option><option value="entregue" ${v === 'entregue' ? 'selected' : ''}>Entregue</option></select></td>
      <td>${atual !== 'obra' && ev ? `desde ${fmtMes(ev.comp)}` : ''}${p < 99.99 && v !== 'obra' ? ' <span class="aviso">físico < 100%</span>' : ''}</td></tr>`;
  }).join('');
  const nMarcadas = a.folhas.filter((f) => (pend.has(f.id) ? pend.get(f.id) : C.situacaoConclusao(obra, f.id, mes) || 'obra') !== 'obra').length;
  return `<div class="fin-topo">
      <div class="contagem"><b>${nMarcadas} de ${a.folhas.length}</b> ${nomeUn} marcadas como finalizadas em ${fmtMes(mes)}</div>
      <label class="linha">Quantas estão finalizadas? <input id="finQtd" inputmode="numeric" value="${nMarcadas}" style="width:64px"> <button class="sec" data-acao="finQtd">Marcar as primeiras pela numeração</button></label>
      <span class="dica">Depois confira e ajuste quais são, na lista abaixo. A finalização vale deste mês em diante e é independente do % físico.</span>
    </div>
    <div class="tab-wrap curta"><table class="tab-mini"><thead><tr><th>Elemento</th><th>Físico</th><th>Situação</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div>
    <div class="ed-acoes"><span>${pend.size ? `${pend.size} alteração(ões) pendente(s)` : 'Sem alterações pendentes'}</span>
      <button class="sec" data-acao="finDescartar" ${pend.size ? '' : 'disabled'}>Descartar</button>
      <button class="primario" data-acao="finSalvar" ${pend.size ? '' : 'disabled'}>Salvar finalizações em ${fmtMes(mes)}</button></div>`;
}

// ---------------------------------------------------------------- eventos

async function pedirMotivo(qtd = 1) {
  return perguntar('Correção de lançamento', `Motivo da correção${qtd > 1 ? ` (${qtd} itens)` : ''}`, '', true,
    'Você está alterando um mês já lançado ou um mês que tem lançamentos posteriores. Os meses seguintes mantêm o realizado de cada mês e o acumulado é recalculado.');
}

async function salvarLinha(tr, origem) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const et = app.idx.etapasById.get(tr.dataset.et);
  if (!e || !et) return;
  const qtd = et.unidade !== '%';
  const tot = C.total(e, et);
  let args;
  if (origem === 'real') {
    const v = lerNum(tr.querySelector('.in-real').value);
    if (!Number.isFinite(v)) { toast('Valor inválido.', 'erro'); renderEditor(); return; }
    args = qtd ? { realizadoQtd: v } : { realizadoPct: v };
  } else {
    const v = origem === 'barra' ? Number(tr.querySelector('.barra').value) : lerNum(tr.querySelector('.in-acum').value);
    if (!Number.isFinite(v)) { toast('Valor inválido.', 'erro'); renderEditor(); return; }
    args = { acumPct: v };
  }
  // simula para descobrir se é correção antes de gravar
  const ant = C.acumulado(app.idx, e.id, et.id, mesAnterior(app.mes));
  const novoV = args.realizadoQtd ?? (args.realizadoPct !== undefined ? (args.realizadoPct / 100) * tot : (args.acumPct / 100) * tot - ant);
  if (Math.abs(novoV - C.realizado(app.idx, e.id, et.id, app.mes)) < 1e-6) { renderEditor(); return; }
  const val = C.validarRealizado(app.idx, e, et, app.mes, novoV);
  if (!val.ok) {
    const m = val.erros[0];
    toast(`${et.nome}: o acumulado em ${fmtMes(m.comp)} ficaria em ${num(m.pct)}%. Mantenha entre 0% e 100%.`, 'erro');
    renderEditor();
    return;
  }
  let motivo = '';
  if (C.ehCorrecao(app.idx, e, et, app.mes)) {
    motivo = await pedirMotivo();
    if (motivo === null) { renderEditor(); return; }
  }
  let r;
  mutar((o, idx) => { r = C.lancar(o, idx, { elemId: e.id, etapaId: et.id, comp: app.mes, motivo, ...args }); });
  if (r && !r.ok) toast(r.erro, 'erro');
  else if (r && r.correcao) toast('Correção registrada. Meses seguintes recalculados.');
}

function atualizarAoVivo(tr) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const et = app.idx.etapasById.get(tr.dataset.et);
  const v = Number(tr.querySelector('.barra').value);
  const tot = C.total(e, et);
  const ant = C.acumulado(app.idx, e.id, et.id, mesAnterior(app.mes));
  const pAnt = (ant / tot) * 100;
  tr.querySelector('.in-acum').value = num(v, 1);
  const real = v - pAnt;
  tr.querySelector('.in-real').value = num(et.unidade === '%' ? real : (real / 100) * tot, et.unidade === '%' ? 1 : 2);
  tr.querySelector('.barra').style.setProperty('--atu', `${v}%`);
}

export function ligarEditor() {
  const el = $('#editor');
  el.addEventListener('input', (ev) => {
    if (ev.target.classList.contains('barra')) atualizarAoVivo(ev.target.closest('tr'));
  });
  el.addEventListener('change', async (ev) => {
    const t = ev.target;
    const tr = t.closest('tr[data-et]');
    if (tr && t.classList.contains('barra')) return salvarLinha(tr, 'barra');
    if (tr && t.classList.contains('in-real')) return salvarLinha(tr, 'real');
    if (tr && t.classList.contains('in-acum')) return salvarLinha(tr, 'acum');
    if (t.dataset.prop) return salvarProp(t);
    if (t.dataset.aplic) return salvarAplic(t);
    if (t.dataset.qtd) return salvarQtd(t);
    if (t.dataset.colEt) {
      if (t.checked) app.coletivo.etapas.add(t.dataset.colEt);
      else app.coletivo.etapas.delete(t.dataset.colEt);
      app.coletivo.previa = null;
      return renderEditor();
    }
    if (t.name === 'colModo') {
      app.coletivo.modo = t.value;
      app.coletivo.previa = null;
      return renderEditor();
    }
    if (t.dataset.fin) {
      marcarPendente(t.dataset.fin, t.checked ? 'finalizado' : 'obra');
      return renderEditor();
    }
    if (t.dataset.finSel) {
      marcarPendente(t.dataset.finSel, t.value);
      return renderEditor();
    }
  });
  el.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.matches('input.in-real, input.in-acum, input[data-prop], input[data-qtd]')) ev.target.blur();
  });
  el.addEventListener('click', async (ev) => {
    const b = ev.target.closest('button, tr[data-sel]');
    if (!b) return;
    if (b.dataset.aba) {
      app.abaEditor = b.dataset.aba;
      return renderEditor();
    }
    if (b.matches('tr[data-sel]')) return selecionar(b.dataset.sel, { origem: 'lista' });
    if (b.dataset.ir) {
      const { irParaMes } = await import('./app.js');
      return irParaMes(b.dataset.ir);
    }
    if (b.dataset.nudge) {
      const [k, d] = b.dataset.nudge.split(':');
      const e = app.idx.elemById.get(app.selecao[0]);
      return mutar(() => { e[k] = Math.round(((e[k] || 0) + Number(d)) * 100) / 100; if (k === 'rot') e.rot = ((e.rot % 360) + 360) % 360; }, { estrutura: true });
    }
    if (b.dataset.moverEv) return corrigirEvento(b.dataset.moverEv);
    if (b.dataset.remEv) return removerEvento(b.dataset.remEv);
    const acao = b.dataset.acao;
    if (acao && ACOES[acao]) return ACOES[acao](b);
  });
}

function marcarPendente(id, v) {
  const atual = C.situacaoConclusao(app.obra, id, app.mes) || 'obra';
  if (v === atual) app.finalPendente.delete(id);
  else app.finalPendente.set(id, v);
}

async function salvarProp(inp) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const k = inp.dataset.prop;
  let v = inp.value;
  if (inp.type === 'number') {
    v = lerNum(v);
    if (!Number.isFinite(v)) { toast('Número inválido.', 'erro'); return renderEditor(); }
    if (['w', 'd', 'h'].includes(k) && v <= 0) { toast('Dimensões precisam ser maiores que zero.', 'erro'); return renderEditor(); }
    if (k === 'peso' && v < 0) { toast('Peso não pode ser negativo.', 'erro'); return renderEditor(); }
  }
  if (k === 'nome' && !String(v).trim()) { toast('O nome não pode ficar vazio.', 'erro'); return renderEditor(); }
  if (k === 'classe') {
    const temLanc = Object.keys(app.obra.lancamentos).some((x) => x.startsWith(e.id + '|'));
    const filhos = C.filhosDe(app.idx, e.id).length;
    if (v === e.classe) return;
    if (temLanc && !(await confirmar('Mudar classe', 'Este elemento tem lançamentos. Ao mudar a classe, as etapas aplicáveis mudam e os lançamentos das etapas antigas deixam de contar (ficam guardados). Continuar?'))) return renderEditor();
    if (v !== 'grupo' && filhos) { toast('Um grupo com itens não pode virar folha. Mova ou exclua os itens antes.', 'erro'); return renderEditor(); }
  }
  mutar(() => {
    e[k] = v;
    if (k === 'classe') {
      if (v === 'grupo') e.forma = 'nenhuma';
      else if (e.forma === 'nenhuma') e.forma = v === 'infra' ? 'rua' : 'bloco';
    }
  }, { estrutura: true });
}

function salvarAplic(inp) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const id = inp.dataset.aplic;
  mutar(() => {
    const s = new Set(e.etapasExcluidas);
    if (inp.checked) s.delete(id);
    else s.add(id);
    e.etapasExcluidas = [...s];
  }, { estrutura: true });
}

function salvarQtd(inp) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const et = app.idx.etapasById.get(inp.dataset.qtd);
  const v = lerNum(inp.value);
  if (!(v > 0)) { toast('Quantidade deve ser maior que zero.', 'erro'); return renderEditor(); }
  const s = app.idx.series.get(`${e.id}|${et.id}`) || [];
  const max = s.reduce((m, p) => Math.max(m, p.cum), 0);
  if (max > v + 1e-6) { toast(`Já há ${num(max, 2)} ${et.unidade} lançados; o total não pode ser menor.`, 'erro'); return renderEditor(); }
  mutar(() => { e.quantidades[et.id] = v; }, { estrutura: true });
}

async function corrigirEvento(evId) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const ev = C.eventosConclusao(app.obra, e.id).find((x) => x.id === evId);
  const r = await dialogo({
    titulo: 'Corrigir mês da conclusão',
    html: `<label class="campo"><span>Novo mês</span><input type="month" id="novoMes" value="${ev.comp}"></label><label class="campo"><span>Motivo</span><input id="motivo"></label><p class="erro" id="dlgErro"></p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Corrigir', valor: 'ok' }],
    coletar: (d) => {
      const m = d.querySelector('#novoMes').value;
      const mo = d.querySelector('#motivo').value.trim();
      if (!validaMes(m)) { d.querySelector('#dlgErro').textContent = 'Informe um mês válido.'; return false; }
      if (!mo) { d.querySelector('#dlgErro').textContent = 'Informe o motivo.'; return false; }
      return { m, mo };
    },
  });
  if (!r) return;
  mutar((o) => C.moverEventoConclusao(o, e.id, evId, r.m, r.mo));
  toast('Conclusão corrigida. O histórico foi recalculado.');
}

async function removerEvento(evId) {
  const e = app.idx.elemById.get(app.selecao[0]);
  const mo = await perguntar('Remover registro de conclusão', 'Motivo', '', true);
  if (mo === null) return;
  mutar((o) => C.removerEventoConclusao(o, e.id, evId, mo));
}

function proximaPosicao(pai, cls) {
  const irmaos = C.filhosDe(app.idx, pai?.id || null).filter((x) => C.ehFolha(x));
  const ult = irmaos[irmaos.length - 1];
  if (ult) return { x: ult.x + ult.w + 0.2 * (ult.forma === 'casa' ? 1 : 10), z: ult.z, rot: ult.rot, w: ult.w, d: ult.d, h: ult.h, y: ult.y, forma: ult.forma, categoria: ult.categoria };
  const f = pai ? C.folhas(app.idx, pai.id) : [];
  const ref = f[f.length - 1];
  const base = { x: (ref?.x ?? pai?.x ?? 0) + (ref ? ref.w + 4 : 0), z: ref?.z ?? pai?.z ?? 0, y: pai?.y || 0, rot: 0 };
  if (cls === 'unidade') return { ...base, w: 7, d: 10, h: 3, forma: app.obra.tipo === 'edificio' ? 'apto' : app.obra.tipo === 'loteamento' ? 'lote' : 'casa', categoria: app.obra.tipo === 'edificio' ? 'apartamento' : app.obra.tipo === 'loteamento' ? 'lote' : 'casa' };
  if (cls === 'anexo') return { ...base, w: 8, d: 8, h: 3, forma: 'bloco', categoria: 'area_comum' };
  if (cls === 'infra') return { ...base, w: 60, d: 8, h: 0.2, forma: 'rua', categoria: 'via' };
  return { ...base, w: 8, d: 8, h: 3, forma: 'nenhuma', categoria: '' };
}

const ACOES = {
  async finalizar() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const p = C.progElem(app.idx, e, app.mes);
    if (p < 99.99 && !(await confirmar('Finalizar com avanço físico incompleto', `<p>${esc(e.nome)} está com <b>${pct(p)}</b> de avanço físico em ${fmtMes(app.mes)}.</p><p>A finalização é uma confirmação separada do % das etapas. Finalizar mesmo assim?</p>`, 'Finalizar'))) return;
    mutar((o) => C.registrarConclusao(o, e.id, app.mes, 'finalizar'));
    toast(`${e.nome} finalizada em ${fmtMes(app.mes)}. Vale para os meses seguintes.`);
  },
  entregar() {
    const e = app.idx.elemById.get(app.selecao[0]);
    mutar((o) => C.registrarConclusao(o, e.id, app.mes, 'entregar'));
  },
  async reabrir() {
    const e = app.idx.elemById.get(app.selecao[0]);
    if (!(await confirmar('Reabrir', `Reabrir ${esc(e.nome)} a partir de ${fmtMes(app.mes)}? Os meses anteriores mantêm o registro de conclusão.`, 'Reabrir'))) return;
    mutar((o) => C.registrarConclusao(o, e.id, app.mes, 'reabrir'));
  },
  selPai() {
    const e = app.idx.elemById.get(app.selecao[0]);
    if (e && e.paiId) selecionar(e.paiId, { origem: 'lista' });
  },
  limparSel() { selecionar(null); },
  async tudo100() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const ets = etapasVisiveis(C.etapasDoElem(app.idx, e));
    const corr = ets.some((et) => C.ehCorrecao(app.idx, e, et, app.mes));
    let motivo = '';
    if (corr) { motivo = await pedirMotivo(ets.length); if (motivo === null) return; }
    let erros = 0;
    mutar((o, idx) => {
      for (const et of ets) {
        const r = C.lancar(o, C.indexar(o), { elemId: e.id, etapaId: et.id, comp: app.mes, acumPct: 100, motivo });
        if (!r.ok) erros++;
      }
      return idx;
    });
    if (erros) toast(`${erros} etapa(s) não puderam ir a 100% (verifique meses seguintes).`, 'erro');
  },
  async zerarMes() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const ets = C.etapasDoElem(app.idx, e).filter((et) => app.obra.lancamentos[C.chave(e.id, et.id, app.mes)]);
    if (!ets.length) return toast('Não há lançamentos neste mês.');
    const motivo = await perguntar('Limpar lançamentos do mês', `Motivo (remove o realizado de ${fmtMes(app.mes)} em ${ets.length} etapa(s))`, '', true);
    if (motivo === null) return;
    let erros = 0;
    mutar((o) => {
      for (const et of ets) {
        const r = C.lancar(o, C.indexar(o), { elemId: e.id, etapaId: et.id, comp: app.mes, realizadoQtd: 0, motivo });
        if (!r.ok) erros++;
      }
    });
    if (erros) toast(`${erros} etapa(s) mantidas: removê-las deixaria um mês seguinte fora de 0–100%.`, 'erro');
  },
  colTodas() {
    const a = alvoAtual();
    for (const f of a.folhas) for (const et of etapasVisiveis(C.etapasDoElem(app.idx, f))) app.coletivo.etapas.add(et.id);
    app.coletivo.previa = null;
    renderEditor();
  },
  colNenhuma() { app.coletivo.etapas.clear(); app.coletivo.previa = null; renderEditor(); },
  colPrevia() {
    const a = alvoAtual();
    const st = app.coletivo;
    const modo = $('input[name=colModo]:checked')?.value || 'definir';
    const v = lerNum(modo === 'somar' ? $('#colValSom').value : $('#colValDef').value);
    st.modo = modo;
    st.obs = $('#colObs').value;
    if (!st.etapas.size) return toast('Marque pelo menos uma etapa.', 'erro');
    if (!Number.isFinite(v)) return toast('Informe o valor.', 'erro');
    if (modo === 'definir' && (v < 0 || v > 100)) return toast('O acumulado deve ficar entre 0% e 100%.', 'erro');
    st.valor = String(v).replace('.', ',');
    st.previa = C.previaColetivo(app.idx, { alvos: a.folhas, etapaIds: [...st.etapas], comp: app.mes, modo, valorPct: v });
    renderEditor();
  },
  colCancelar() { app.coletivo.previa = null; renderEditor(); },
  colAplicar() {
    const st = app.coletivo;
    const a = alvoAtual();
    const temCorr = st.previa.some((l) => !l.ignorado && l.ok && !l.semMudanca && l.correcao);
    const motivo = $('#colMotivo')?.value.trim() || '';
    if (temCorr && !motivo) return toast('Informe o motivo da correção.', 'erro');
    // refaz a prévia com o índice atual para não gravar dados velhos
    const linhas = C.previaColetivo(app.idx, { alvos: a.folhas, etapaIds: [...st.etapas], comp: app.mes, modo: st.modo, valorPct: lerNum(st.valor) });
    let n = 0;
    mutar((o, idx) => { n = C.aplicarColetivo(o, idx, linhas, { comp: app.mes, motivo, obs: st.obs, grupoId: a.grupo?.id }); });
    st.previa = null;
    toast(`${n} lançamento(s) gravados em ${fmtMes(app.mes)}.`);
  },
  finQtd() {
    const a = alvoAtual();
    const q = Math.round(lerNum($('#finQtd').value));
    if (!Number.isFinite(q) || q < 0 || q > a.folhas.length) return toast(`Informe um número entre 0 e ${a.folhas.length}.`, 'erro');
    const ordenadas = [...a.folhas].sort((x, y) => String(x.codigo).localeCompare(String(y.codigo), 'pt-BR', { numeric: true }));
    ordenadas.forEach((f, i) => {
      const atual = C.situacaoConclusao(app.obra, f.id, app.mes) || 'obra';
      const desejado = i < q ? (atual === 'entregue' ? 'entregue' : 'finalizado') : 'obra';
      marcarPendente(f.id, desejado);
    });
    renderEditor();
    toast('Confira quais unidades ficaram marcadas antes de salvar.');
  },
  finDescartar() { app.finalPendente.clear(); renderEditor(); },
  async finSalvar() {
    const itens = [...app.finalPendente.entries()];
    const incompletos = itens.filter(([id, v]) => v !== 'obra' && C.progElem(app.idx, app.idx.elemById.get(id), app.mes) < 99.99);
    if (incompletos.length && !(await confirmar('Finalizar com avanço físico incompleto', `${incompletos.length} elemento(s) estão abaixo de 100% físico. A finalização é registrada separadamente do % das etapas. Continuar?`, 'Salvar'))) return;
    mutar((o) => {
      for (const [id, v] of itens) C.registrarConclusao(o, id, app.mes, v === 'obra' ? 'reabrir' : v === 'entregue' ? 'entregar' : 'finalizar');
    });
    app.finalPendente.clear();
    renderEditor();
    toast(`${itens.length} situação(ões) gravadas em ${fmtMes(app.mes)}.`);
  },
  moverCena() {
    app.moverAtivo = !app.moverAtivo;
    app.vA.modoMover = app.moverAtivo;
    toast(app.moverAtivo ? 'Arraste o elemento selecionado na cena. Clique de novo para desligar.' : 'Arraste na cena desligado.');
    renderTudo({ cena: false });
  },
  focar() { app.vA.focar(app.selecao); },
  async addFilho(b) {
    const pai = app.idx.elemById.get(app.selecao[0]);
    const cls = b.dataset.cls;
    const pos = proximaPosicao(pai, cls);
    const nome = await perguntar('Novo item', 'Nome', cls === 'grupo' ? 'Novo grupo' : cls === 'unidade' ? `${rotCategoria(pos.categoria) || 'Unidade'} nova` : cls === 'anexo' ? 'Nova área comum' : 'Novo trecho', true);
    if (!nome) return;
    let novo;
    mutar((o) => {
      novo = novoElemento(o, { classe: cls, paiId: pai.id, nome, ordem: C.filhosDe(app.idx, pai.id).length, ...pos, forma: cls === 'grupo' ? 'nenhuma' : pos.forma });
      o.elementos.push(novo);
    }, { estrutura: true });
    app.expandidos.add(pai.id);
    selecionar(novo.id, { origem: 'lista' });
    app.abaEditor = 'props';
    renderEditor();
  },
  addRank() {
    const pai = app.idx.elemById.get(app.selecao[0]);
    const n = app.obra.config.casasPorRank || 3;
    const ranks = app.obra.elementos.filter((e) => e.categoria === 'rank');
    const casas = app.obra.elementos.filter((e) => e.categoria === 'casa');
    const maxCasa = casas.reduce((m, c) => Math.max(m, Number(c.codigo) || 0), 0);
    const ult = C.folhas(app.idx, pai.id).slice(-1)[0] || casas.slice(-1)[0];
    const w = ult ? ult.w + 0.2 : 7;
    const d = ult ? ult.d + 1 : 11;
    const x0 = ult ? ult.x + w * 2 + 4 : 0;
    const z0 = ult ? ult.z : 0;
    const cod = `R${String(ranks.length + 1).padStart(2, '0')}`;
    let rank;
    mutar((o) => {
      rank = novoElemento(o, { classe: 'grupo', categoria: 'rank', nome: `Rank ${cod.slice(1)}`, codigo: cod, paiId: pai.id, ordem: C.filhosDe(app.idx, pai.id).length });
      o.elementos.push(rank);
      for (let i = 0; i < n; i++) {
        const num3 = String(maxCasa + i + 1).padStart(3, '0');
        o.elementos.push(novoElemento(o, { classe: 'unidade', categoria: 'casa', forma: 'casa', nome: `Casa ${num3}`, codigo: num3, paiId: rank.id, x: x0 + i * w, z: z0, rot: ult?.rot || 0, w: w - 0.2, d: d - 1, h: ult?.h || 3, ordem: i }));
      }
    }, { estrutura: true });
    app.expandidos.add(pai.id);
    selecionar(rank.id, { origem: 'lista' });
    toast(`${rank.nome} criado com ${n} casas.`);
  },
  async serie() {
    const pai = app.idx.elemById.get(app.selecao[0]);
    const pos = proximaPosicao(pai, 'unidade');
    const r = await dialogo({
      titulo: `Gerar série em ${pai.nome}`,
      largura: 560,
      html: `<div class="form-grid">
        <label class="campo"><span>Quantidade</span><input id="sQtd" type="number" min="1" max="500" value="${app.obra.config.casasPorRank || 3}"></label>
        <label class="campo"><span>Classe</span><select id="sCls">${Object.entries(CLASSES).map(([k, v]) => `<option value="${k}" ${k === 'unidade' ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Categoria</span><input id="sCat" value="${esc(pos.categoria || 'casa')}"></label>
        <label class="campo"><span>Representação 3D</span><select id="sForma">${Object.entries(FORMAS).map(([k, v]) => `<option value="${k}" ${k === pos.forma ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="campo"><span>Prefixo do nome</span><input id="sPref" value="${esc(rotCategoria(pos.categoria) || 'Casa')}"></label>
        <label class="campo"><span>Número inicial</span><input id="sIni" type="number" value="1"></label>
        <label class="campo"><span>Dígitos</span><input id="sDig" type="number" min="1" max="5" value="3"></label>
        <label class="campo"><span>Largura (m)</span><input id="sW" type="number" step="any" value="${pos.w}"></label>
        <label class="campo"><span>Profundidade (m)</span><input id="sD" type="number" step="any" value="${pos.d}"></label>
        <label class="campo"><span>Altura (m)</span><input id="sH" type="number" step="any" value="${pos.h}"></label>
        <label class="campo"><span>Espaço entre itens (m)</span><input id="sGap" type="number" step="any" value="0.2"></label>
        <label class="campo"><span>Itens por linha</span><input id="sLin" type="number" min="1" value="20"></label>
      </div><p class="dica">Os itens começam ao lado do último item do grupo. Ajuste a posição depois, se necessário.</p><p class="erro" id="dlgErro"></p>`,
      botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Gerar', valor: 'ok' }],
      coletar: (d) => {
        const g = (id) => d.querySelector(id).value;
        const q = Number(g('#sQtd'));
        if (!(q >= 1 && q <= 500)) { d.querySelector('#dlgErro').textContent = 'Quantidade entre 1 e 500.'; return false; }
        return { q, cls: g('#sCls'), cat: g('#sCat'), forma: g('#sForma'), pref: g('#sPref'), ini: Number(g('#sIni')), dig: Number(g('#sDig')), w: lerNum(g('#sW')), d: lerNum(g('#sD')), h: lerNum(g('#sH')), gap: lerNum(g('#sGap')), lin: Number(g('#sLin')) || 20 };
      },
    });
    if (!r) return;
    mutar((o) => {
      const base = C.filhosDe(app.idx, pai.id).length;
      for (let i = 0; i < r.q; i++) {
        const n = String(r.ini + i).padStart(r.dig, '0');
        const col = i % r.lin;
        const lin = Math.floor(i / r.lin);
        o.elementos.push(novoElemento(o, {
          classe: r.cls, categoria: r.cat, forma: r.cls === 'grupo' ? 'nenhuma' : r.forma, nome: `${r.pref} ${n}`.trim(), codigo: n, paiId: pai.id, ordem: base + i,
          x: pos.x + col * (r.w + r.gap), z: pos.z + lin * (r.d + 4), y: pos.y || 0, rot: pos.rot || 0, w: r.w, d: r.d, h: r.h,
        }));
      }
    }, { estrutura: true });
    app.expandidos.add(pai.id);
    toast(`${r.q} itens criados em ${pai.nome}.`);
  },
  async renumerar() {
    const pai = app.idx.elemById.get(app.selecao[0]);
    const filhos = C.filhosDe(app.idx, pai.id);
    const r = await dialogo({
      titulo: `Renumerar itens de ${pai.nome}`,
      html: `<div class="form-grid"><label class="campo"><span>Prefixo do nome</span><input id="rPref" value="${esc(rotCategoria(filhos[0]?.categoria) || '')}"></label>
        <label class="campo"><span>Número inicial</span><input id="rIni" type="number" value="1"></label>
        <label class="campo"><span>Dígitos</span><input id="rDig" type="number" min="1" max="5" value="3"></label>
        <label class="campo"><span>Prefixo do código</span><input id="rCod" value=""></label></div>
        <p class="dica">Aplica na ordem atual da lista (${filhos.length} itens): ${esc(filhos.slice(0, 4).map((f) => f.nome).join(', '))}${filhos.length > 4 ? '…' : ''}. Lançamentos são preservados.</p>`,
      botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Renumerar', valor: 'ok' }],
      coletar: (d) => ({ pref: d.querySelector('#rPref').value, ini: Number(d.querySelector('#rIni').value), dig: Number(d.querySelector('#rDig').value), cod: d.querySelector('#rCod').value }),
    });
    if (!r) return;
    mutar(() => {
      filhos.forEach((f, i) => {
        const n = String(r.ini + i).padStart(r.dig, '0');
        f.nome = `${r.pref} ${n}`.trim();
        f.codigo = `${r.cod}${n}`;
      });
    }, { estrutura: true });
  },
  async duplicarElem() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const todos = [e, ...C.ehFolha(e) ? [] : descendentes(e.id)];
    const folhas = todos.filter(C.ehFolha);
    const bx = folhas.length ? Math.max(...folhas.map((f) => f.x + f.w / 2)) - Math.min(...folhas.map((f) => f.x - f.w / 2)) : 10;
    const dx = bx + 4;
    const mapa = new Map(todos.map((x) => [x.id, C.uid('el')]));
    let novoId;
    mutar((o) => {
      for (const x of todos) {
        const c = JSON.parse(JSON.stringify(x));
        c.id = mapa.get(x.id);
        c.paiId = x.id === e.id ? x.paiId : mapa.get(x.paiId);
        if (x.id === e.id) { c.nome = `${x.nome} (cópia)`; c.ordem = (x.ordem || 0) + 0.5; novoId = c.id; }
        if (C.ehFolha(c)) c.x += dx;
        o.elementos.push(c);
      }
    }, { estrutura: true });
    selecionar(novoId, { origem: 'lista' });
    toast('Cópia criada sem avanços, ao lado do original.');
  },
  async moverPara() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const proibidos = new Set([e.id, ...descendentes(e.id).map((x) => x.id)]);
    const grupos = app.obra.elementos.filter((x) => !C.ehFolha(x) && !proibidos.has(x.id));
    const r = await dialogo({
      titulo: `Mover ${e.nome}`,
      html: `<label class="campo"><span>Novo grupo</span><select id="mPai"><option value="">(nível principal)</option>${grupos.map((g) => `<option value="${g.id}" ${g.id === e.paiId ? 'selected' : ''}>${esc(caminho(g.id) ? caminho(g.id) + ' › ' : '')}${esc(g.nome)}</option>`).join('')}</select></label>`,
      botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Mover', valor: 'ok' }],
      coletar: (d) => d.querySelector('#mPai').value,
    });
    if (r === null || r === undefined) return;
    mutar(() => { e.paiId = r || null; }, { estrutura: true });
  },
  async excluirElem() {
    const e = app.idx.elemById.get(app.selecao[0]);
    const todos = [e, ...descendentes(e.id)];
    const ids = new Set(todos.map((x) => x.id));
    const nLanc = Object.keys(app.obra.lancamentos).filter((k) => ids.has(k.split('|')[0])).length;
    if (!(await confirmar('Excluir', `<p>Excluir <b>${esc(e.nome)}</b>${todos.length > 1 ? ` e ${todos.length - 1} item(ns) dentro dele` : ''}?</p><p>${nLanc} lançamento(s) desses elementos serão apagados. Esta ação não pode ser desfeita (exporte uma cópia antes, se precisar).</p>`, 'Excluir', true))) return;
    mutar((o) => {
      o.elementos = o.elementos.filter((x) => !ids.has(x.id));
      for (const k of Object.keys(o.lancamentos)) if (ids.has(k.split('|')[0])) delete o.lancamentos[k];
      for (const k of Object.keys(o.conclusoes)) if (ids.has(k)) delete o.conclusoes[k];
      o.revisoes.push({ id: C.uid('r'), em: new Date().toISOString(), tipo: 'exclusao', nome: e.nome, qtd: todos.length, lancamentos: nLanc });
    }, { estrutura: true });
    selecionar(null);
  },
};

function descendentes(id) {
  const r = [];
  for (const f of C.filhosDe(app.idx, id)) r.push(f, ...descendentes(f.id));
  return r;
}

export function moverPorArrasto(id, dx, dz) {
  const e = app.idx.elemById.get(id);
  if (!e) return;
  const lista = C.ehFolha(e) ? [e] : C.folhas(app.idx, id);
  mutar(() => {
    for (const f of lista) { f.x = Math.round((f.x + dx) * 100) / 100; f.z = Math.round((f.z + dz) * 100) / 100; }
    if (!C.ehFolha(e)) { e.x = (e.x || 0) + dx; e.z = (e.z || 0) + dz; }
  }, { estrutura: true });
}
