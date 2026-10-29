// Painel lateral de elementos (árvore) e painel de indicadores.

import * as C from './calc.js';
import { CORES_STATUS, CORES_DIFF, corAvanco } from './scene.js';
import { fmtMes, mesAnterior } from './meses.js';
import { $, esc, pct, pp, num } from './util.js';
import { app, selecionar, irParaMes, renderTudo } from './app.js';

const ROT_CAT = {
  fase: 'Fase', quadra: 'Quadra', rank: 'Rank', casa: 'Casa', torre: 'Torre', pavimento: 'Pavimento', apartamento: 'Apartamento',
  area_comum: 'Área comum', areas_comuns: 'Áreas comuns', trecho: 'Trecho', setor: 'Setor', lote: 'Lote', bloco: 'Bloco', frente: 'Frente', via: 'Via', infraestrutura: 'Infraestrutura',
};
export const rotCategoria = (c) => ROT_CAT[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ') : '');

// ---------------------------------------------------------------- árvore

export function renderArvore() {
  const el = $('#arvore');
  if (!el || !app.idx) return;
  const { idx, mes } = app;
  const busca = ($('#buscaElem')?.value || '').trim().toLowerCase();
  const filtro = $('#filtroStatus')?.value || '';
  const sel = new Set(app.selecao);
  const visiveis = new Set();
  const casa = (e) => {
    if (busca && !(`${e.nome} ${e.codigo}`.toLowerCase().includes(busca))) return false;
    if (filtro && C.ehFolha(e) && C.statusElem(idx, e, mes) !== filtro) return false;
    if (filtro && !C.ehFolha(e)) return false;
    return true;
  };
  const filtrando = !!(busca || filtro);
  if (filtrando) {
    for (const e of app.obra.elementos) {
      if (casa(e)) {
        visiveis.add(e.id);
        for (const a of C.ancestrais(idx, e.id)) visiveis.add(a.id);
      }
    }
  }
  const linhas = [];
  const desenhar = (paiId, prof) => {
    for (const e of C.filhosDe(idx, paiId)) {
      if (filtrando && !visiveis.has(e.id)) continue;
      const folha = C.ehFolha(e);
      const fl = folha ? [e] : C.folhas(idx, e.id);
      const p = C.progConjunto(idx, fl, mes);
      const aberto = filtrando || app.expandidos.has(e.id);
      const temFilhos = C.filhosDe(idx, e.id).length > 0;
      let marca = '';
      if (folha) {
        const s = C.statusElem(idx, e, mes);
        if (s === 'finalizado' || s === 'entregue') marca = `<span class="chk ${s}" title="${C.ROTULO_STATUS[s]}">✓</span>`;
      } else if (fl.length) {
        const nf = fl.filter((f) => C.situacaoConclusao(app.obra, f.id, mes)).length;
        if (nf) marca = `<span class="cont" title="finalizados">${nf}/${fl.length} ✓</span>`;
      }
      const cor = folha ? corAvanco(p, C.statusElem(idx, e, mes)) : corAvanco(p, null);
      linhas.push(`<div class="no ${sel.has(e.id) ? 'sel' : ''} ${folha ? 'folha' : 'grupo'} cls-${e.classe}" data-id="${e.id}" style="--prof:${prof}">
        ${temFilhos ? `<button class="caret ${aberto ? 'aberto' : ''}" data-caret="${e.id}" aria-label="${aberto ? 'Recolher' : 'Expandir'}">▸</button>` : '<span class="caret vazio"></span>'}
        <span class="nome" title="${esc(rotCategoria(e.categoria))}">${esc(e.nome)}</span>${marca}
        <span class="mini"><i style="width:${Math.min(100, p)}%;background:${cor}"></i></span><span class="pc">${num(p, 0)}%</span>
      </div>`);
      if (temFilhos && aberto) desenhar(e.id, prof + 1);
    }
  };
  desenhar(null, 0);
  el.innerHTML = linhas.join('') || '<p class="vazio">Nenhum elemento. Use “Estrutura” para gerar ou adicionar.</p>';
  const nDocs = app.obra.documentos.length;
  const d = $('#resumoDocs');
  if (d) d.innerHTML = `<button class="link" data-acao="docs">📎 Documentos da obra (${nDocs})</button> <span class="dica">referência, não são elementos construídos</span>`;
}

export function ligarArvore() {
  $('#arvore').addEventListener('click', (ev) => {
    const c = ev.target.closest('[data-caret]');
    if (c) {
      const id = c.dataset.caret;
      if (app.expandidos.has(id)) app.expandidos.delete(id);
      else app.expandidos.add(id);
      renderArvore();
      return;
    }
    const no = ev.target.closest('.no');
    if (no) selecionar(no.dataset.id, { aditivo: ev.shiftKey || ev.ctrlKey || ev.metaKey, origem: 'lista' });
  });
  $('#arvore').addEventListener('dblclick', (ev) => {
    const no = ev.target.closest('.no');
    if (no) app.vA.focar([no.dataset.id]);
  });
  $('#buscaElem').addEventListener('input', renderArvore);
  $('#filtroStatus').addEventListener('change', renderArvore);
}

// ---------------------------------------------------------------- indicadores

export function renderIndicadores() {
  const el = $('#indicadores');
  if (!el || !app.idx) return;
  const { idx, mes, obra } = app;
  const r = C.resumo(idx, mes);
  const card = (titulo, b, nomeUn, classe) => b.n ? `<div class="card ${classe}">
      <div class="card-tit">${titulo}</div>
      <div class="card-num">${pct(b.acum)}</div>
      <div class="card-lin"><span>Até o mês anterior</span><b>${pct(b.acumAnt)}</b></div>
      <div class="card-lin"><span>Feito no mês</span><b>${pp(b.mes)}</b></div>
      <div class="card-lin"><span>Finalizados</span><b>${b.finalizados} de ${b.n} ${nomeUn}</b></div>
    </div>` : '';
  const nomeUn = obra.tipo === 'edificio' ? 'aptos' : obra.tipo === 'loteamento' ? 'lotes' : obra.tipo === 'condominio' ? 'casas' : 'unid.';
  const st = r.unidade.n ? r.unidade.status : r.geral.status;
  const barraSt = Object.entries(st).filter(([, v]) => v).map(([k, v]) => {
    const cor = k === 'execucao' ? CORES_STATUS.execucao_ini : CORES_STATUS[k];
    return `<i style="flex:${v};background:${cor}" title="${C.ROTULO_STATUS[k]}: ${v}"></i>`;
  }).join('');
  const etapas = r.porEtapa.map((x) => `<tr data-etapa="${x.etapa.id}" title="Clique para filtrar a cena por esta etapa">
      <td>${esc(x.etapa.nome)}<small>${x.etapa.grupo === 'unidade' ? '' : x.etapa.grupo === 'anexo' ? ' · áreas comuns' : ' · infra'}</small></td>
      <td class="n">${pct(x.acum)}</td><td class="n">${pp(x.mes)}</td>
      <td class="n">${x.etapa.unidade === '%' ? '' : `${num(x.qAcum, 0)}/${num(x.qTot, 0)} ${esc(x.etapa.unidade)}`}</td></tr>`).join('');
  // grupos de primeiro nível (ou filhos do grupo selecionado)
  const selGrupo = app.selecao.length === 1 && !C.ehFolha(idx.elemById.get(app.selecao[0]) || {}) ? idx.elemById.get(app.selecao[0]) : null;
  const base = selGrupo ? C.filhosDe(idx, selGrupo.id) : C.filhosDe(idx, null);
  const grupos = base.map((g) => {
    const fl = C.ehFolha(g) ? [g] : C.folhas(idx, g.id);
    const a = C.progConjunto(idx, fl, mes);
    const b = C.progConjunto(idx, fl, mesAnterior(mes));
    const nf = fl.filter((f) => C.situacaoConclusao(obra, f.id, mes)).length;
    return `<tr data-sel="${g.id}"><td>${esc(g.nome)}</td><td class="n">${pct(a)}</td><td class="n">${pp(a - b)}</td><td class="n">${nf}/${fl.length}</td></tr>`;
  }).join('');
  el.innerHTML = `
    <div class="ind-topo"><span>Mês</span><b>${fmtMes(mes)}</b></div>
    ${card(obra.tipo === 'edificio' ? 'Apartamentos' : obra.tipo === 'loteamento' ? 'Lotes' : 'Unidades', r.unidade, nomeUn, 'un')}
    ${card('Áreas comuns e anexos', r.anexo, 'áreas', 'ac')}
    ${card('Infraestrutura', r.infra, 'trechos', 'inf')}
    <div class="bloco-ind"><div class="sub">Situação ${r.unidade.n ? 'das unidades' : 'dos elementos'}</div><div class="barra-st">${barraSt || '<i style="flex:1;background:#ddd"></i>'}</div>
      <div class="leg-st">${Object.entries(st).map(([k, v]) => `<span><i style="background:${k === 'execucao' ? CORES_STATUS.execucao_ini : CORES_STATUS[k]}"></i>${C.ROTULO_STATUS[k]}: <b>${v}</b></span>`).join('')}</div></div>
    <div class="bloco-ind"><div class="sub">Evolução acumulada <small>(clique para ir ao mês)</small></div>${grafico()}</div>
    <div class="bloco-ind"><div class="sub">Por etapa</div><table class="tab-ind"><thead><tr><th>Etapa</th><th>Acum.</th><th>Mês</th><th>Qtd.</th></tr></thead><tbody>${etapas}</tbody></table></div>
    <div class="bloco-ind"><div class="sub">${selGrupo ? `Dentro de ${esc(selGrupo.nome)}` : 'Por grupo'}</div><table class="tab-ind"><thead><tr><th>Grupo</th><th>Acum.</th><th>Mês</th><th>✓</th></tr></thead><tbody>${grupos}</tbody></table></div>
    <details class="bloco-ind regra" open><summary>Regra de cálculo</summary><ol>${C.REGRA_CALCULO.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      <p class="dica">Pesos atuais das etapas: ${idx.etapasOrdenadas.map((x) => `${esc(x.nome)} ${num(x.peso, 0)}`).join(' · ')}</p></details>`;
}

function grafico() {
  const { idx, meses, mes } = app;
  const todas = C.todasFolhas(idx);
  const series = [
    ['unidade', '#2f6b4f', 'Unidades'],
    ['anexo', '#c27c2c', 'Áreas comuns'],
    ['infra', '#3b6fa8', 'Infra'],
  ].map(([cl, cor, nome]) => ({ cor, nome, lista: todas.filter((e) => e.classe === cl) })).filter((s) => s.lista.length);
  const W = 300;
  const H = 130;
  const pl = 26;
  const pb = 18;
  const n = meses.length;
  const x = (i) => pl + (n <= 1 ? 0 : (i * (W - pl - 6)) / (n - 1));
  const y = (v) => H - pb - (v / 100) * (H - pb - 8);
  const lin = series.map((s) => {
    const pts = meses.map((m, i) => [x(i), y(C.progConjunto(idx, s.lista, m)), m, C.progConjunto(idx, s.lista, m)]);
    return `<polyline fill="none" stroke="${s.cor}" stroke-width="2" points="${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}"/>
      ${pts.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${p[2] === mes ? 3.5 : 1.6}" fill="${s.cor}"><title>${s.nome} · ${fmtMes(p[2])}: ${num(p[3])}%</title></circle>`).join('')}`;
  }).join('');
  const im = meses.indexOf(mes);
  const marcas = meses.map((m, i) => (i % Math.max(1, Math.ceil(n / 6)) === 0 ? `<text x="${x(i)}" y="${H - 4}" font-size="8" text-anchor="middle" fill="#6b6f66">${fmtMes(m)}</text>` : '')).join('');
  const faixas = meses.map((m, i) => `<rect class="faixa-mes" data-mes="${m}" x="${x(i) - (W - pl) / n / 2}" y="0" width="${(W - pl) / Math.max(1, n)}" height="${H - pb}" fill="transparent"><title>${fmtMes(m)}</title></rect>`).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Curva de avanço acumulado">
    ${[0, 25, 50, 75, 100].map((v) => `<line x1="${pl}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e0d8"/><text x="${pl - 4}" y="${y(v) + 3}" font-size="8" text-anchor="end" fill="#6b6f66">${v}</text>`).join('')}
    ${im >= 0 ? `<line x1="${x(im)}" x2="${x(im)}" y1="4" y2="${H - pb}" stroke="#ffb000" stroke-width="2"/>` : ''}
    ${lin}${marcas}${faixas}
  </svg><div class="leg-graf">${series.map((s) => `<span><i style="background:${s.cor}"></i>${s.nome}</span>`).join('')}</div>`;
}

export function ligarIndicadores() {
  $('#indicadores').addEventListener('click', (ev) => {
    const f = ev.target.closest('.faixa-mes');
    if (f) return irParaMes(f.dataset.mes);
    const s = ev.target.closest('[data-sel]');
    if (s) return selecionar(s.dataset.sel, { origem: 'lista' });
    const et = ev.target.closest('[data-etapa]');
    if (et) {
      app.modo = 'etapa';
      app.etapaFiltro = et.dataset.etapa;
      renderTudo();
    }
  });
}

// ---------------------------------------------------------------- legenda

export function renderLegenda() {
  const el = $('#legenda');
  if (!el) return;
  let itens = [];
  if (app.modo === 'avanco' || (app.modo === 'etapa')) {
    itens = [
      [CORES_STATUS.nao_iniciado, 'Não iniciado'],
      [`linear-gradient(90deg, ${CORES_STATUS.execucao_ini}, ${CORES_STATUS.execucao_fim})`, 'Em execução (0→100%)'],
      [CORES_STATUS.concluido, '100% físico'],
    ];
    if (app.modo === 'avanco' || app.etapaFiltro === 'todas') itens.push([CORES_STATUS.finalizado, 'Finalizado'], [CORES_STATUS.entregue, 'Entregue']);
  } else if (app.modo === 'mudou') {
    itens = [['linear-gradient(90deg, #bfe5cb, #17693a)', 'Avançou (pouco → muito)'], [CORES_DIFF.regrediu, 'Regrediu'], [CORES_DIFF.corrigido, 'Correção no período'], [CORES_DIFF.finalizou, 'Finalizado no período'], [CORES_DIFF.igual, 'Sem mudança']];
  } else {
    itens = [['#9b7653', 'Terreno'], ['#a9a9a3', 'Fundação/estrutura'], ['#c07a5a', 'Alvenaria bruta'], ['#eee5d3', 'Acabada'], ['#a4452c', 'Cobertura'], ['#74a84d', 'Paisagismo']];
  }
  el.innerHTML = itens.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('') + '<span><b class="chk-leg">✓</b> Finalizado</span>';
}
