// Núcleo de cálculo: acumulado mensal, correções, lançamentos coletivos,
// conclusões e indicadores. Tudo aqui é puro sobre o objeto "obra", sem DOM.
//
// Regras centrais
// - Cada lançamento é guardado no nível do elemento-folha (casa, apartamento,
//   área comum, trecho), por etapa e por competência: chave "elem|etapa|mes".
//   O valor guardado é o REALIZADO NO MÊS, na unidade da etapa.
// - Acumulado do mês M = soma dos realizados de todas as competências <= M.
//   Um mês sem lançamento mantém o acumulado do mês anterior.
// - Salvar de novo o mesmo valor substitui (não soma), então não duplica.
// - Lançamentos de grupo são expandidos para as folhas no momento do registro;
//   como os consolidados só somam folhas, nenhum serviço é contado duas vezes.

import { mesAnterior, mesesEntre, mesDe } from './meses.js';

export const EPS = 1e-6;
export const CLASSES_FOLHA = ['unidade', 'anexo', 'infra'];

export function uid(prefixo = '') {
  return prefixo + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export function chave(elemId, etapaId, comp) {
  return `${elemId}|${etapaId}|${comp}`;
}

function arred(v) {
  return Math.round(v * 1e6) / 1e6;
}

// ---------------------------------------------------------------- índice

export function indexar(obra) {
  const elemById = new Map();
  const filhos = new Map();
  for (const e of obra.elementos) {
    elemById.set(e.id, e);
    const p = e.paiId || null;
    if (!filhos.has(p)) filhos.set(p, []);
    filhos.get(p).push(e);
  }
  for (const lista of filhos.values()) lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  const etapasById = new Map(obra.etapas.map((et) => [et.id, et]));
  const etapasOrdenadas = [...obra.etapas].sort((a, b) => a.ordem - b.ordem);

  // séries por elemento|etapa, ordenadas por competência
  const series = new Map();
  for (const [k, l] of Object.entries(obra.lancamentos || {})) {
    const [elemId, etapaId, comp] = k.split('|');
    const sk = `${elemId}|${etapaId}`;
    if (!series.has(sk)) series.set(sk, []);
    series.get(sk).push({ comp, v: l.v });
  }
  for (const s of series.values()) {
    s.sort((a, b) => (a.comp < b.comp ? -1 : 1));
    let c = 0;
    for (const p of s) {
      c = arred(c + p.v);
      p.cum = c;
    }
  }

  let ultimoMes = null;
  for (const k of Object.keys(obra.lancamentos || {})) {
    const c = k.slice(k.lastIndexOf('|') + 1);
    if (!ultimoMes || c > ultimoMes) ultimoMes = c;
  }
  const folhasCache = new Map();
  const idx = { obra, elemById, filhos, etapasById, etapasOrdenadas, series, folhasCache, ultimoMes };
  return idx;
}

export function ehFolha(e) {
  return CLASSES_FOLHA.includes(e.classe);
}

export function filhosDe(idx, id) {
  return idx.filhos.get(id || null) || [];
}

export function folhas(idx, id) {
  if (idx.folhasCache.has(id)) return idx.folhasCache.get(id);
  const e = idx.elemById.get(id);
  let r = [];
  if (e && ehFolha(e)) r = [e];
  else {
    for (const f of filhosDe(idx, id)) r = r.concat(folhas(idx, f.id));
  }
  idx.folhasCache.set(id, r);
  return r;
}

export function todasFolhas(idx) {
  return idx.obra.elementos.filter(ehFolha);
}

export function ancestrais(idx, id) {
  const r = [];
  let e = idx.elemById.get(id);
  while (e && e.paiId) {
    e = idx.elemById.get(e.paiId);
    if (e) r.unshift(e);
  }
  return r;
}

export function expandirSelecao(idx, ids) {
  const vistos = new Set();
  const r = [];
  for (const id of ids) {
    for (const f of folhas(idx, id)) {
      if (!vistos.has(f.id)) {
        vistos.add(f.id);
        r.push(f);
      }
    }
  }
  return r;
}

// grupo de etapas que vale para a classe do elemento
export function grupoEtapa(classe) {
  return classe === 'anexo' ? 'anexo' : classe === 'infra' ? 'infra' : 'unidade';
}

export function etapasDoElem(idx, e) {
  if (!ehFolha(e)) return [];
  const g = grupoEtapa(e.classe);
  const excl = new Set(e.etapasExcluidas || []);
  return idx.etapasOrdenadas.filter((et) => et.grupo === g && !excl.has(et.id));
}

export function total(e, et) {
  if (!et || et.unidade === '%') return 100;
  const q = e.quantidades && e.quantidades[et.id];
  if (typeof q === 'number' && q > 0) return q;
  return et.qtdPadrao > 0 ? et.qtdPadrao : 100;
}

// ---------------------------------------------------------------- consultas

export function acumulado(idx, elemId, etapaId, m) {
  const s = idx.series.get(`${elemId}|${etapaId}`);
  if (!s || !m) return 0;
  let r = 0;
  for (const p of s) {
    if (p.comp <= m) r = p.cum;
    else break;
  }
  return r;
}

export function realizado(idx, elemId, etapaId, m) {
  const l = idx.obra.lancamentos[chave(elemId, etapaId, m)];
  return l ? l.v : 0;
}

export function pctEtapa(idx, e, et, m) {
  return arred((acumulado(idx, e.id, et.id, m) / total(e, et)) * 100);
}

export function progElem(idx, e, m, etapaId = null) {
  const ets = etapasDoElem(idx, e).filter((et) => !etapaId || et.id === etapaId);
  let sp = 0;
  let sv = 0;
  for (const et of ets) {
    const p = et.peso > 0 ? et.peso : 0;
    sp += p;
    sv += p * pctEtapa(idx, e, et, m);
  }
  if (sp === 0) {
    // sem pesos definidos: média simples para não esconder avanço
    if (!ets.length) return 0;
    return ets.reduce((a, et) => a + pctEtapa(idx, e, et, m), 0) / ets.length;
  }
  return sv / sp;
}

export function pesoElem(e) {
  return typeof e.peso === 'number' && e.peso >= 0 ? e.peso : 1;
}

// avanço consolidado de um conjunto de folhas, ponderado pelo peso do elemento
export function progConjunto(idx, lista, m, etapaId = null) {
  let sp = 0;
  let sv = 0;
  for (const e of lista) {
    if (etapaId && !etapasDoElem(idx, e).some((et) => et.id === etapaId)) continue;
    const p = pesoElem(e);
    sp += p;
    sv += p * progElem(idx, e, m, etapaId);
  }
  return sp ? sv / sp : 0;
}

// ---------------------------------------------------------------- conclusão

export function eventosConclusao(obra, elemId) {
  return (obra.conclusoes && obra.conclusoes[elemId]) || [];
}

// situação de conclusão vigente no mês: último evento com competência <= m
export function situacaoConclusao(obra, elemId, m) {
  const ev = eventosConclusao(obra, elemId)
    .filter((x) => x.comp <= m)
    .sort((a, b) => (a.comp === b.comp ? a.seq - b.seq : a.comp < b.comp ? -1 : 1));
  const ult = ev[ev.length - 1];
  if (!ult || ult.acao === 'reabrir') return null;
  return ult.acao === 'entregar' ? 'entregue' : 'finalizado';
}

export function statusElem(idx, e, m) {
  const c = situacaoConclusao(idx.obra, e.id, m);
  if (c) return c;
  const p = progElem(idx, e, m);
  if (p <= EPS) return 'nao_iniciado';
  if (p >= 100 - 1e-4) return 'concluido';
  return 'execucao';
}

export const ROTULO_STATUS = {
  nao_iniciado: 'Não iniciado',
  execucao: 'Em execução',
  concluido: '100% físico (não finalizado)',
  finalizado: 'Finalizado',
  entregue: 'Entregue',
};

// ---------------------------------------------------------------- validação

// Simula a troca do realizado de (elem, etapa, comp) e confere o acumulado
// de todas as competências afetadas. Retorna os meses que sairiam de 0..total.
export function validarRealizado(idx, e, et, comp, novoV) {
  const tot = total(e, et);
  const s = (idx.series.get(`${e.id}|${et.id}`) || []).map((p) => ({ comp: p.comp, v: p.v }));
  const i = s.findIndex((p) => p.comp === comp);
  if (i >= 0) s[i].v = novoV;
  else s.push({ comp, v: novoV });
  s.sort((a, b) => (a.comp < b.comp ? -1 : 1));
  let c = 0;
  const erros = [];
  for (const p of s) {
    c = arred(c + p.v);
    if (p.comp >= comp && (c < -EPS || c > tot + EPS)) erros.push({ comp: p.comp, acum: c, pct: (c / tot) * 100 });
  }
  return { ok: erros.length === 0, erros, total: tot };
}

// É correção a alteração retroativa: mês anterior ao último mês já lançado na
// obra, ou mês que já tem lançamentos posteriores desta etapa. Rever o valor
// do mês corrente é atualização normal (fica no registro, sem pedir motivo).
export function ehCorrecao(idx, e, et, comp) {
  if (idx.ultimoMes && comp < idx.ultimoMes) return true;
  const s = idx.series.get(`${e.id}|${et.id}`) || [];
  return s.some((p) => p.comp > comp);
}

// ---------------------------------------------------------------- escrita

function registrarRevisao(obra, rev) {
  if (!obra.revisoes) obra.revisoes = [];
  obra.revisoes.push({ id: uid('r'), em: new Date().toISOString(), ...rev });
  if (obra.revisoes.length > 20000) obra.revisoes.splice(0, obra.revisoes.length - 20000);
}

function gravarRealizado(obra, e, et, comp, v, meta) {
  const k = chave(e.id, et.id, comp);
  const antes = obra.lancamentos[k] ? obra.lancamentos[k].v : 0;
  v = arred(v);
  if (Math.abs(antes - v) < EPS) return false; // mesmo valor: nada a fazer
  if (Math.abs(v) < EPS) delete obra.lancamentos[k];
  else obra.lancamentos[k] = { v, em: new Date().toISOString(), obs: meta.obs || '', origem: meta.origem || 'individual' };
  registrarRevisao(obra, {
    tipo: meta.correcao ? 'correcao' : 'lancamento',
    origem: meta.origem || 'individual',
    lote: meta.lote || null,
    elemId: e.id,
    etapaId: et.id,
    comp,
    antes,
    depois: v,
    motivo: meta.motivo || '',
  });
  return true;
}

// Define o lançamento de uma etapa de um elemento num mês.
// Informe "acumPct" (acumulado atual em %), "acumQtd" (acumulado na unidade)
// ou "realizadoQtd" (realizado no mês, na unidade da etapa).
export function lancar(obra, idx, { elemId, etapaId, comp, acumPct, acumQtd, realizadoQtd, realizadoPct, motivo, obs, origem, lote }) {
  const e = idx.elemById.get(elemId);
  const et = idx.etapasById.get(etapaId);
  if (!e || !et) return { ok: false, erro: 'Elemento ou etapa inexistente.' };
  if (!etapasDoElem(idx, e).some((x) => x.id === etapaId)) return { ok: false, erro: `A etapa "${et.nome}" não se aplica a ${e.nome}.` };
  const tot = total(e, et);
  const anterior = acumulado(idx, elemId, etapaId, mesAnterior(comp));
  let novoV;
  if (typeof realizadoQtd === 'number') novoV = realizadoQtd;
  else if (typeof realizadoPct === 'number') novoV = (realizadoPct / 100) * tot;
  else if (typeof acumQtd === 'number') novoV = acumQtd - anterior;
  else if (typeof acumPct === 'number') novoV = (acumPct / 100) * tot - anterior;
  else return { ok: false, erro: 'Nenhum valor informado.' };
  if (!Number.isFinite(novoV)) return { ok: false, erro: 'Valor inválido.' };
  novoV = arred(novoV);
  const atual = realizado(idx, elemId, etapaId, comp);
  if (Math.abs(atual - novoV) < EPS) return { ok: true, alterado: false };
  const val = validarRealizado(idx, e, et, comp, novoV);
  if (!val.ok) return { ok: false, erro: mensagemErro(e, et, val), erros: val.erros };
  const correcao = ehCorrecao(idx, e, et, comp);
  gravarRealizado(obra, e, et, comp, novoV, { motivo, obs, origem, lote, correcao });
  return { ok: true, alterado: true, correcao };
}

function mensagemErro(e, et, val) {
  const m = val.erros[0];
  const pct = Math.round(m.pct * 10) / 10;
  return `${e.nome} · ${et.nome}: o acumulado em ${m.comp} ficaria em ${pct}% (fora de 0% a 100%).`;
}

// Prévia do lançamento coletivo. modo: 'definir' (acumulado alvo em %) ou
// 'somar' (pontos percentuais realizados no mês).
export function previaColetivo(idx, { alvos, etapaIds, comp, modo, valorPct }) {
  const linhas = [];
  for (const e of alvos) {
    const aplicaveis = etapasDoElem(idx, e);
    for (const etId of etapaIds) {
      const et = idx.etapasById.get(etId);
      if (!et) continue;
      if (!aplicaveis.some((x) => x.id === etId)) {
        linhas.push({ elemId: e.id, etapaId: etId, ignorado: true, motivo: 'etapa não se aplica' });
        continue;
      }
      const tot = total(e, et);
      const ant = acumulado(idx, e.id, etId, mesAnterior(comp));
      const atual = acumulado(idx, e.id, etId, comp);
      let novoV;
      if (modo === 'somar') novoV = realizado(idx, e.id, etId, comp) + (valorPct / 100) * tot;
      else novoV = (valorPct / 100) * tot - ant;
      novoV = arred(novoV);
      const val = validarRealizado(idx, e, et, comp, novoV);
      const depois = ant + novoV;
      linhas.push({
        elemId: e.id,
        etapaId: etId,
        antesPct: (atual / tot) * 100,
        depoisPct: (depois / tot) * 100,
        novoV,
        semMudanca: Math.abs(novoV - realizado(idx, e.id, etId, comp)) < EPS,
        correcao: ehCorrecao(idx, e, et, comp),
        ok: val.ok,
        erro: val.ok ? '' : mensagemErro(e, et, val),
      });
    }
  }
  return linhas;
}

export function aplicarColetivo(obra, idx, linhas, { comp, motivo, obs, grupoId }) {
  const lote = uid('lote');
  let n = 0;
  for (const l of linhas) {
    if (l.ignorado || !l.ok || l.semMudanca) continue;
    const e = idx.elemById.get(l.elemId);
    const et = idx.etapasById.get(l.etapaId);
    const correcao = ehCorrecao(idx, e, et, comp);
    if (gravarRealizado(obra, e, et, comp, l.novoV, { motivo, obs, origem: 'coletivo', lote, correcao })) n++;
  }
  if (n) registrarRevisao(obra, { tipo: 'coletivo', grupoId: grupoId || null, comp, lote, qtd: n, motivo: motivo || '' });
  return n;
}

// ---------------------------------------------------------------- conclusão (escrita)

export function registrarConclusao(obra, elemId, comp, acao, obs = '') {
  if (!obra.conclusoes) obra.conclusoes = {};
  const lista = obra.conclusoes[elemId] || (obra.conclusoes[elemId] = []);
  const atual = situacaoConclusao(obra, elemId, comp);
  const alvo = acao === 'reabrir' ? null : acao === 'entregar' ? 'entregue' : 'finalizado';
  if (atual === alvo) return false;
  // evento no mesmo mês substitui o anterior do mesmo mês (evita pilha de cliques)
  const doMes = lista.filter((x) => x.comp === comp);
  const seq = (lista.reduce((a, x) => Math.max(a, x.seq || 0), 0) || 0) + 1;
  const antesDoMes = situacaoConclusao(obra, elemId, mesAnterior(comp));
  for (const x of doMes) lista.splice(lista.indexOf(x), 1);
  if (antesDoMes !== alvo) lista.push({ id: uid('c'), comp, acao, obs, seq, em: new Date().toISOString() });
  registrarRevisao(obra, { tipo: 'conclusao', elemId, comp, acao, obs, antes: atual, depois: alvo });
  if (!lista.length) delete obra.conclusoes[elemId];
  return true;
}

export function removerEventoConclusao(obra, elemId, eventoId, motivo = '') {
  const lista = (obra.conclusoes && obra.conclusoes[elemId]) || [];
  const i = lista.findIndex((x) => x.id === eventoId);
  if (i < 0) return false;
  const [ev] = lista.splice(i, 1);
  if (!lista.length) delete obra.conclusoes[elemId];
  registrarRevisao(obra, { tipo: 'conclusao_removida', elemId, comp: ev.comp, acao: ev.acao, motivo });
  return true;
}

export function moverEventoConclusao(obra, elemId, eventoId, novoComp, motivo = '') {
  const lista = (obra.conclusoes && obra.conclusoes[elemId]) || [];
  const ev = lista.find((x) => x.id === eventoId);
  if (!ev) return false;
  const antes = ev.comp;
  ev.comp = novoComp;
  registrarRevisao(obra, { tipo: 'conclusao_corrigida', elemId, comp: novoComp, compAnterior: antes, acao: ev.acao, motivo });
  return true;
}

// ---------------------------------------------------------------- limpeza

export function alcanceLimpeza(obra) {
  const nLanc = Object.keys(obra.lancamentos || {}).length;
  const nConc = Object.values(obra.conclusoes || {}).reduce((a, l) => a + l.length, 0);
  const meses = new Set(Object.keys(obra.lancamentos || {}).map((k) => k.split('|')[2]));
  const elems = new Set(Object.keys(obra.lancamentos || {}).map((k) => k.split('|')[0]));
  return { nLanc, nConc, nMeses: meses.size, nElems: elems.size, nRev: (obra.revisoes || []).length };
}

export function limparAvancos(obra) {
  const a = alcanceLimpeza(obra);
  obra.lancamentos = {};
  obra.conclusoes = {};
  obra.revisoes = [];
  registrarRevisao(obra, { tipo: 'limpeza', qtdLanc: a.nLanc, qtdConc: a.nConc });
  return a;
}

// ---------------------------------------------------------------- período

export function mesesDaObra(obra) {
  const ini = mesDe(obra.inicio);
  const fim = mesDe(obra.termino);
  let lista = ini && fim ? mesesEntre(ini, fim) : [];
  const usados = new Set();
  for (const k of Object.keys(obra.lancamentos || {})) usados.add(k.split('|')[2]);
  for (const l of Object.values(obra.conclusoes || {})) for (const ev of l) usados.add(ev.comp);
  const fora = [...usados].filter((m) => !lista.includes(m)).sort();
  if (fora.length) {
    const todos = [...lista, ...fora].sort();
    lista = mesesEntre(todos[0], todos[todos.length - 1]);
  }
  if (!lista.length) lista = [mesDe(new Date().toISOString())];
  return { meses: lista, fora };
}

// ---------------------------------------------------------------- indicadores

export function resumo(idx, m) {
  const obra = idx.obra;
  const ant = mesAnterior(m);
  const todas = todasFolhas(idx);
  const porClasse = { unidade: [], anexo: [], infra: [] };
  for (const e of todas) porClasse[e.classe].push(e);
  const bloco = (lista) => {
    const acum = progConjunto(idx, lista, m);
    const acumAnt = progConjunto(idx, lista, ant);
    let fin = 0;
    let ent = 0;
    const st = { nao_iniciado: 0, execucao: 0, concluido: 0, finalizado: 0, entregue: 0 };
    for (const e of lista) {
      const s = statusElem(idx, e, m);
      st[s]++;
      if (s === 'finalizado') fin++;
      if (s === 'entregue') ent++;
    }
    return { n: lista.length, acum, acumAnt, mes: acum - acumAnt, finalizados: fin + ent, entregues: ent, status: st };
  };
  const r = {
    unidade: bloco(porClasse.unidade),
    anexo: bloco(porClasse.anexo),
    infra: bloco(porClasse.infra),
    geral: bloco(todas),
    porEtapa: [],
  };
  for (const et of idx.etapasOrdenadas) {
    const lista = porClasse[et.grupo] || [];
    const aplic = lista.filter((e) => etapasDoElem(idx, e).some((x) => x.id === et.id));
    if (!aplic.length) continue;
    const a = progConjunto(idx, aplic, m, et.id);
    const b = progConjunto(idx, aplic, ant, et.id);
    // quantidade física, quando a etapa tem unidade própria
    let qAcum = 0;
    let qTot = 0;
    let qMes = 0;
    for (const e of aplic) {
      qTot += total(e, et);
      qAcum += acumulado(idx, e.id, et.id, m);
      qMes += realizado(idx, e.id, et.id, m);
    }
    r.porEtapa.push({ etapa: et, n: aplic.length, acum: a, mes: a - b, qAcum, qTot, qMes });
  }
  return r;
}

export function serieMensal(idx, meses, lista) {
  return meses.map((m) => ({ m, v: progConjunto(idx, lista, m) }));
}

// Diferenças entre duas competências (A = base, B = comparação)
export function diferencas(idx, mA, mB) {
  const [a, b] = mA <= mB ? [mA, mB] : [mB, mA];
  const corrigidos = new Set();
  for (const r of idx.obra.revisoes || []) {
    if ((r.tipo === 'correcao' || r.tipo === 'conclusao_corrigida' || r.tipo === 'conclusao_removida') && r.comp > a && r.comp <= b) corrigidos.add(r.elemId);
  }
  const res = new Map();
  for (const e of todasFolhas(idx)) {
    const pa = progElem(idx, e, a);
    const pb = progElem(idx, e, b);
    const ca = situacaoConclusao(idx.obra, e.id, a);
    const cb = situacaoConclusao(idx.obra, e.id, b);
    let tipo = 'igual';
    if (pb - pa > 1e-4) tipo = 'avancou';
    else if (pa - pb > 1e-4) tipo = 'regrediu';
    if (cb && !ca) tipo = 'finalizou';
    if (corrigidos.has(e.id) && tipo === 'igual') tipo = 'corrigido';
    res.set(e.id, { tipo, delta: pb - pa, corrigido: corrigidos.has(e.id), pa, pb });
  }
  return res;
}

// ---------------------------------------------------------------- texto da regra

export const REGRA_CALCULO = [
  'Avanço da etapa no elemento = acumulado da etapa ÷ quantidade total da etapa no elemento.',
  'Avanço do elemento = Σ (peso da etapa × avanço da etapa) ÷ Σ pesos das etapas aplicáveis.',
  'Avanço do grupo ou da obra = Σ (peso do elemento × avanço do elemento) ÷ Σ pesos dos elementos.',
  'Acumulado do mês = acumulado do mês anterior + realizado no mês. Mês sem lançamento mantém o acumulado.',
  'Lançamentos de grupo são gravados em cada elemento; o consolidado soma só elementos, sem dupla contagem.',
  'Unidades, áreas comuns e infraestrutura têm indicadores separados.',
];
