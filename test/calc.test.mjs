import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/calc.js';
import * as M from '../src/model.js';

function obraTeste() {
  const o = M.obraVazia({ nome: 'Teste', tipo: 'condominio', inicio: '2026-01-01', termino: '2026-12-31' });
  M.gerarCondominio(o, { fases: 1, ranksPorFase: [2], casasPorRank: 3 });
  return o;
}
const casas = (idx) => C.todasFolhas(idx).filter((e) => e.classe === 'unidade');
const etapa = (o, nome) => o.etapas.find((e) => e.nome === nome && e.grupo === 'unidade');

test('acumulado: anterior + realizado no mês = acumulado atual; mês sem lançamento mantém', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  const alv = etapa(o, 'Alvenaria');
  assert.ok(C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-01', acumPct: 40 }).ok);
  idx = C.indexar(o);
  assert.ok(C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', realizadoPct: 15 }).ok);
  idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-01'), 40);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-02'), 55);
  assert.equal(C.realizado(idx, casa.id, alv.id, '2026-02'), 15);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-03'), 55, 'março sem lançamento mantém 55%');
});

test('salvar de novo o mesmo lançamento não duplica', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  const alv = etapa(o, 'Alvenaria');
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', acumPct: 55 });
  idx = C.indexar(o);
  const r = C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', acumPct: 55 });
  assert.equal(r.alterado, false);
  idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-02'), 55);
  assert.equal(Object.keys(o.lancamentos).length, 1);
});

test('correção de mês anterior preserva o realizado dos meses seguintes e é identificada', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  const alv = etapa(o, 'Alvenaria');
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-01', acumPct: 40 }); idx = C.indexar(o);
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', realizadoPct: 15 }); idx = C.indexar(o);
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-04', realizadoPct: 10 }); idx = C.indexar(o);
  const r = C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-01', acumPct: 30, motivo: 'medição revisada' });
  assert.ok(r.ok && r.correcao);
  idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-02'), 45);
  assert.equal(C.realizado(idx, casa.id, alv.id, '2026-02'), 15);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-03'), 45);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-04'), 55);
  const rev = o.revisoes.filter((x) => x.tipo === 'correcao');
  assert.equal(rev.length, 1);
  assert.equal(rev[0].motivo, 'medição revisada');
});

test('validação: correção que leva mês seguinte acima de 100% é bloqueada', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  const alv = etapa(o, 'Alvenaria');
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-01', acumPct: 40 }); idx = C.indexar(o);
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', realizadoPct: 55 }); idx = C.indexar(o);
  const r = C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-01', acumPct: 60 });
  assert.equal(r.ok, false);
  assert.match(r.erro, /2026-02/);
  const r2 = C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-03', acumPct: 120 });
  assert.equal(r2.ok, false);
  const r3 = C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-03', acumPct: -5 });
  assert.equal(r3.ok, false);
});

test('lançamento por quantidade calcula % pelo total cadastrado', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const rua = C.todasFolhas(idx).find((e) => e.classe === 'infra');
  const pav = o.etapas.find((e) => e.grupo === 'infra' && e.nome === 'Pavimentação');
  rua.quantidades[pav.id] = 2000;
  idx = C.indexar(o);
  C.lancar(o, idx, { elemId: rua.id, etapaId: pav.id, comp: '2026-03', realizadoQtd: 500 }); idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, rua, pav, '2026-03'), 25);
  C.lancar(o, idx, { elemId: rua.id, etapaId: pav.id, comp: '2026-04', acumQtd: 1500 }); idx = C.indexar(o);
  assert.equal(C.realizado(idx, rua.id, pav.id, '2026-04'), 1000);
  assert.equal(C.pctEtapa(idx, rua, pav, '2026-04'), 75);
});

test('lançamento coletivo altera só as etapas escolhidas e não conta duas vezes', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const rank = o.elementos.find((e) => e.categoria === 'rank');
  const alvos = C.folhas(idx, rank.id);
  assert.equal(alvos.length, 3);
  const alv = etapa(o, 'Alvenaria');
  const cob = etapa(o, 'Cobertura');
  // casa individual com cobertura antes
  C.lancar(o, idx, { elemId: alvos[0].id, etapaId: cob.id, comp: '2026-02', acumPct: 30 }); idx = C.indexar(o);
  const prev = C.previaColetivo(idx, { alvos, etapaIds: [alv.id], comp: '2026-02', modo: 'definir', valorPct: 50 });
  assert.equal(prev.length, 3);
  assert.equal(C.aplicarColetivo(o, idx, prev, { comp: '2026-02', grupoId: rank.id }), 3);
  idx = C.indexar(o);
  for (const c of alvos) assert.equal(C.pctEtapa(idx, c, alv, '2026-02'), 50);
  assert.equal(C.pctEtapa(idx, alvos[0], cob, '2026-02'), 30, 'cobertura da casa preservada');
  // rank = média das casas, obra = média de todas as casas (6)
  const pRank = C.progConjunto(idx, alvos, '2026-02');
  const pCasa0 = C.progElem(idx, alvos[0], '2026-02');
  const pCasa1 = C.progElem(idx, alvos[1], '2026-02');
  assert.ok(Math.abs(pRank - (pCasa0 + 2 * pCasa1) / 3) < 1e-9);
  // somar 10 p.p. no mês
  const prev2 = C.previaColetivo(idx, { alvos, etapaIds: [alv.id], comp: '2026-02', modo: 'somar', valorPct: 10 });
  C.aplicarColetivo(o, idx, prev2, { comp: '2026-02' }); idx = C.indexar(o);
  for (const c of alvos) assert.equal(C.pctEtapa(idx, c, alv, '2026-02'), 60);
  // outras casas (outro rank) intactas
  const outras = casas(idx).filter((c) => !alvos.includes(c));
  for (const c of outras) assert.equal(C.progElem(idx, c, '2026-02'), 0);
});

test('editar uma casa preserva as demais do rank', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const rank = o.elementos.find((e) => e.categoria === 'rank');
  const [a, b, c] = C.folhas(idx, rank.id);
  const alv = etapa(o, 'Alvenaria');
  const prev = C.previaColetivo(idx, { alvos: [a, b, c], etapaIds: [alv.id], comp: '2026-02', modo: 'definir', valorPct: 50 });
  C.aplicarColetivo(o, idx, prev, { comp: '2026-02' }); idx = C.indexar(o);
  C.lancar(o, idx, { elemId: b.id, etapaId: alv.id, comp: '2026-02', acumPct: 80 }); idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, a, alv, '2026-02'), 50);
  assert.equal(C.pctEtapa(idx, b, alv, '2026-02'), 80);
  assert.equal(C.pctEtapa(idx, c, alv, '2026-02'), 50);
});

test('conclusão persiste nos meses seguintes e reabertura corrige', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  C.registrarConclusao(o, casa.id, '2026-03', 'finalizar');
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-02'), null);
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-03'), 'finalizado');
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-09'), 'finalizado');
  C.registrarConclusao(o, casa.id, '2026-05', 'reabrir');
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-06'), null);
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-04'), 'finalizado');
  // finalizar duas vezes no mesmo mês não empilha eventos
  C.registrarConclusao(o, casa.id, '2026-07', 'finalizar');
  C.registrarConclusao(o, casa.id, '2026-07', 'finalizar');
  assert.equal(o.conclusoes[casa.id].filter((x) => x.comp === '2026-07').length, 1);
  // correção: mover o evento de março para fevereiro
  const ev = o.conclusoes[casa.id].find((x) => x.comp === '2026-03');
  C.moverEventoConclusao(o, casa.id, ev.id, '2026-02', 'data real');
  assert.equal(C.situacaoConclusao(o, casa.id, '2026-02'), 'finalizado');
  idx = C.indexar(o);
  assert.equal(C.statusElem(idx, casa, '2026-02'), 'finalizado');
  // finalização é diferente do avanço físico
  assert.equal(C.progElem(idx, casa, '2026-02'), 0);
});

test('áreas comuns e infraestrutura têm indicadores separados', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const piscina = C.todasFolhas(idx).find((e) => e.nome === 'Piscina adulto');
  const etp = C.etapasDoElem(idx, piscina);
  assert.ok(etp.length > 0 && etp.every((x) => x.grupo === 'anexo'));
  assert.ok(!etp.some((x) => x.nome === 'Cobertura'), 'piscina sem cobertura');
  for (const x of etp) C.lancar(o, idx, { elemId: piscina.id, etapaId: x.id, comp: '2026-05', acumPct: 100 });
  idx = C.indexar(o);
  const r = C.resumo(idx, '2026-05');
  assert.equal(r.unidade.acum, 0);
  assert.ok(r.anexo.acum > 0);
  assert.equal(r.infra.acum, 0);
  assert.equal(C.progElem(idx, piscina, '2026-05'), 100);
});

test('limpeza zera avanços e mantém estrutura; não afeta outra obra', () => {
  const a = obraTeste();
  const b = obraTeste();
  let ia = C.indexar(a);
  let ib = C.indexar(b);
  const ca = casas(ia)[0];
  const cb = casas(ib)[0];
  C.lancar(a, ia, { elemId: ca.id, etapaId: etapa(a, 'Alvenaria').id, comp: '2026-02', acumPct: 50 });
  C.lancar(b, ib, { elemId: cb.id, etapaId: etapa(b, 'Alvenaria').id, comp: '2026-02', acumPct: 70 });
  C.registrarConclusao(a, ca.id, '2026-02', 'finalizar');
  const n = a.elementos.length;
  const alc = C.limparAvancos(a);
  assert.equal(alc.nLanc, 1);
  assert.equal(alc.nConc, 1);
  assert.equal(a.elementos.length, n);
  assert.equal(Object.keys(a.lancamentos).length, 0);
  ib = C.indexar(b);
  assert.equal(C.pctEtapa(ib, cb, etapa(b, 'Alvenaria'), '2026-02'), 70);
});

test('Villa Flora II: 66 ranks x 3 casas = 198, numeração sequencial', () => {
  const o = M.criarVillaFlora();
  const idx = C.indexar(o);
  const ranks = o.elementos.filter((e) => e.categoria === 'rank');
  assert.equal(ranks.length, 66);
  const cs = o.elementos.filter((e) => e.categoria === 'casa');
  assert.equal(cs.length, 198);
  for (const r of ranks) assert.equal(C.folhas(idx, r.id).length, 3);
  assert.deepEqual(cs.map((c) => Number(c.codigo)), Array.from({ length: 198 }, (_, i) => i + 1));
  assert.equal(o.documentos.length, 2);
  assert.equal(Object.keys(o.lancamentos).length, 0, 'obra nova começa zerada');
});

test('duplicar com e sem avanços gera obras independentes', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const casa = casas(idx)[0];
  const alv = etapa(o, 'Alvenaria');
  C.lancar(o, idx, { elemId: casa.id, etapaId: alv.id, comp: '2026-02', acumPct: 50 });
  const { obra: sem } = M.duplicarObra(o, { copiarAvancos: false });
  const { obra: com, mapaEl, mapaEt } = M.duplicarObra(o, { copiarAvancos: true });
  assert.equal(Object.keys(sem.lancamentos).length, 0);
  assert.equal(sem.elementos.length, o.elementos.length);
  const ic = C.indexar(com);
  const casaC = ic.elemById.get(mapaEl.get(casa.id));
  assert.equal(C.pctEtapa(ic, casaC, ic.etapasById.get(mapaEt.get(alv.id)), '2026-02'), 50);
  // alterar a cópia não muda a original
  C.lancar(com, ic, { elemId: casaC.id, etapaId: mapaEt.get(alv.id), comp: '2026-02', acumPct: 90 });
  idx = C.indexar(o);
  assert.equal(C.pctEtapa(idx, casa, alv, '2026-02'), 50);
  assert.ok(!com.elementos.some((e) => o.elementos.some((x) => x.id === e.id)));
});

test('linha do tempo se ajusta às datas sem perder lançamentos fora do período', () => {
  const o = obraTeste();
  const idx = C.indexar(o);
  const casa = casas(idx)[0];
  C.lancar(o, idx, { elemId: casa.id, etapaId: etapa(o, 'Alvenaria').id, comp: '2026-06', acumPct: 20 });
  o.inicio = '2026-08-01';
  o.termino = '2026-10-31';
  const { meses, fora } = C.mesesDaObra(o);
  assert.deepEqual(fora, ['2026-06']);
  assert.equal(meses[0], '2026-06');
  assert.equal(Object.keys(o.lancamentos).length, 1);
});

test('o que mudou: avanço, correção e finalização entre dois meses', () => {
  const o = obraTeste();
  let idx = C.indexar(o);
  const [a, b, c] = casas(idx);
  const alv = etapa(o, 'Alvenaria');
  C.lancar(o, idx, { elemId: a.id, etapaId: alv.id, comp: '2026-01', acumPct: 20 });
  C.lancar(o, idx, { elemId: b.id, etapaId: alv.id, comp: '2026-02', acumPct: 20 });
  C.lancar(o, idx, { elemId: c.id, etapaId: alv.id, comp: '2026-04', acumPct: 10 }); idx = C.indexar(o);
  // fev é anterior ao último mês lançado (abr): é correção
  assert.ok(C.lancar(o, idx, { elemId: b.id, etapaId: alv.id, comp: '2026-02', acumPct: 25, motivo: 'x' }).correcao);
  // rever o valor do último mês não é correção
  idx = C.indexar(o);
  assert.equal(C.lancar(o, idx, { elemId: c.id, etapaId: alv.id, comp: '2026-04', acumPct: 12 }).correcao, false);
  C.registrarConclusao(o, c.id, '2026-02', 'finalizar');
  idx = C.indexar(o);
  const d = C.diferencas(idx, '2026-01', '2026-03');
  assert.equal(d.get(a.id).tipo, 'igual');
  assert.equal(d.get(b.id).tipo, 'avancou');
  assert.ok(d.get(b.id).corrigido);
  assert.equal(d.get(c.id).tipo, 'finalizou');
});
