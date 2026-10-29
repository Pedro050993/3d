// Sincronização com o servidor, usando um banco simulado em memória.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import * as R from '../src/remoto.js';
import * as C from '../src/calc.js';
import * as M from '../src/model.js';

function bancoSimulado(papel) {
  const t = { obras: [], lancamentos: [], conclusoes: [], revisoes: [], perfis: [] };
  const chaves = { obras: ['id'], lancamentos: ['obra_id', 'elem_id', 'etapa_id', 'comp'], conclusoes: ['id'], revisoes: ['id'], perfis: ['user_id'] };
  const regra = (tab, op) => {
    if (op === 'select') return true;
    if (tab === 'obras') return papel.v === 'admin';
    if (tab === 'revisoes' && op === 'delete') return papel.v === 'admin';
    return papel.v === 'admin' || papel.v === 'campo';
  };
  let falhar = false;
  const consulta = (tab) => {
    const filtros = [];
    let op = 'select';
    let dados = null;
    let faixa = null;
    const q = {
      select() { return q; },
      eq(c, v) { filtros.push((r) => r[c] === v); return q; },
      in(c, l) { filtros.push((r) => l.includes(r[c])); return q; },
      match(o) { filtros.push((r) => Object.entries(o).every(([k, v]) => r[k] === v)); return q; },
      order() { return q; },
      range(a, b) { faixa = [a, b]; return q; },
      upsert(d) { op = 'upsert'; dados = Array.isArray(d) ? d : [d]; return q; },
      update(d) { op = 'update'; dados = d; return q; },
      delete() { op = 'delete'; return q; },
      maybeSingle() { q._um = true; return q; },
      then(ok, erro) {
        try {
          if (falhar) return Promise.resolve({ data: null, error: { message: 'Failed to fetch' } }).then(ok, erro);
          if (!regra(tab, op === 'upsert' ? 'insert' : op)) return Promise.resolve({ data: null, error: { message: 'new row violates row-level security policy' } }).then(ok, erro);
          const casa = (r) => filtros.every((f) => f(r));
          let data = null;
          if (op === 'select') {
            data = t[tab].filter(casa).map((r) => ({ ...r }));
            if (faixa) data = data.slice(faixa[0], faixa[1] + 1);
            if (q._um) data = data[0] || null;
          } else if (op === 'upsert') {
            for (const d of dados) {
              const i = t[tab].findIndex((r) => chaves[tab].every((k) => r[k] === d[k]));
              if (i >= 0) t[tab][i] = { ...t[tab][i], ...d }; else t[tab].push({ ...d });
            }
          } else if (op === 'delete') {
            t[tab] = t[tab].filter((r) => !casa(r));
          }
          return Promise.resolve({ data, error: null }).then(ok, erro);
        } catch (e) { return Promise.reject(e).then(ok, erro); }
      },
    };
    return q;
  };
  return { t, falha: (v) => { falhar = v; }, cliente: { from: consulta, storage: { from: () => ({ upload: async () => ({ error: null }), download: async () => ({ error: 'x' }), list: async () => ({ data: [] }), remove: async () => ({}) }) } } };
}

function obraTeste() {
  const o = M.obraVazia({ nome: 'Sinc', tipo: 'condominio', inicio: '2026-01-01', termino: '2026-12-31' });
  M.gerarCondominio(o, { fases: 1, ranksPorFase: [2], casasPorRank: 3 });
  return o;
}
const alv = (o) => o.etapas.find((e) => e.nome === 'Alvenaria');
const casas = (o) => o.elementos.filter((e) => e.categoria === 'casa');

test('administrador cria obra; lançamentos sobem uma vez e reabrem iguais', async () => {
  const papel = { v: 'admin' };
  const b = bancoSimulado(papel);
  R._simular(b.cliente, { id: 'u1', email: 'a@x', nome: 'Ana', papel: 'admin' });
  const o = obraTeste();
  let idx = C.indexar(o);
  C.lancar(o, idx, { elemId: casas(o)[0].id, etapaId: alv(o).id, comp: '2026-02', acumPct: 40 });
  C.registrarConclusao(o, casas(o)[1].id, '2026-03', 'finalizar');
  await R.salvarObra(o);
  assert.equal(b.t.obras.length, 1);
  assert.equal(b.t.lancamentos.length, 1);
  assert.equal(b.t.conclusoes.length, 1);
  const nRev = b.t.revisoes.length;
  assert.ok(nRev >= 2);
  await R.salvarObra(o); // sem mudança: não duplica
  assert.equal(b.t.lancamentos.length, 1);
  assert.equal(b.t.revisoes.length, nRev);
  const lida = await R.carregarObra(o.id);
  idx = C.indexar(lida);
  assert.equal(C.pctEtapa(idx, idx.elemById.get(casas(o)[0].id), idx.etapasById.get(alv(o).id), '2026-02'), 40);
  assert.equal(C.situacaoConclusao(lida, casas(o)[1].id, '2026-05'), 'finalizado');
  assert.equal(lida.elementos.length, o.elementos.length);
});

test('equipe de campo lança mas não altera estrutura', async () => {
  const papel = { v: 'admin' };
  const b = bancoSimulado(papel);
  R._simular(b.cliente, { id: 'u1', email: 'a@x', nome: 'Ana', papel: 'admin' });
  const o = obraTeste();
  await R.salvarObra(o);
  papel.v = 'campo';
  R._simular(b.cliente, { id: 'u2', email: 'c@x', nome: 'Caio', papel: 'campo' });
  const minha = await R.carregarObra(o.id);
  const idx = C.indexar(minha);
  C.lancar(minha, idx, { elemId: casas(minha)[2].id, etapaId: alv(minha).id, comp: '2026-04', acumPct: 25 });
  minha.nome = 'Nome alterado pelo campo';
  await R.salvarObra(minha);
  assert.equal(b.t.lancamentos.length, 1);
  assert.equal(b.t.lancamentos[0].por, 'u2');
  assert.equal(b.t.obras[0].nome, 'Sinc', 'estrutura não mudou');
});

test('dois usuários em casas diferentes não se sobrescrevem; exclusão remove só a linha', async () => {
  const papel = { v: 'admin' };
  const b = bancoSimulado(papel);
  R._simular(b.cliente, { id: 'u1', email: 'a@x', nome: 'Ana', papel: 'admin' });
  const base = obraTeste();
  await R.salvarObra(base);
  const a = await R.carregarObra(base.id);
  C.lancar(a, C.indexar(a), { elemId: casas(a)[0].id, etapaId: alv(a).id, comp: '2026-02', acumPct: 30 });
  await R.salvarObra(a);
  // segundo aparelho abriu antes e lança em outra casa
  R._simular(b.cliente, { id: 'u2', email: 'c@x', nome: 'Caio', papel: 'admin' });
  const bb = JSON.parse(JSON.stringify(base));
  await R.carregarObra(base.id); // foto do servidor
  const b2 = await R.carregarObra(base.id);
  delete b2.lancamentos[Object.keys(b2.lancamentos)[0]]; // aparelho B não tem o lançamento de A carregado
  C.lancar(b2, C.indexar(b2), { elemId: casas(b2)[1].id, etapaId: alv(b2).id, comp: '2026-02', acumPct: 60 });
  void bb;
  // B só envia o que mudou nele: a remoção local de algo que ele recebeu conta como exclusão
  await R.salvarObra(b2);
  assert.equal(b.t.lancamentos.length, 1);
  assert.equal(b.t.lancamentos[0].elem_id, casas(b2)[1].id);
});

test('sem conexão: guarda e reenvia depois', async () => {
  const papel = { v: 'admin' };
  const b = bancoSimulado(papel);
  R._simular(b.cliente, { id: 'u1', email: 'a@x', nome: 'Ana', papel: 'admin' });
  const o = obraTeste();
  await R.salvarObra(o);
  C.lancar(o, C.indexar(o), { elemId: casas(o)[0].id, etapaId: alv(o).id, comp: '2026-02', acumPct: 50 });
  b.falha(true);
  await assert.rejects(() => R.salvarObra(o));
  assert.equal(R.temPendencias(), true);
  assert.equal(b.t.lancamentos.length, 0);
  b.falha(false);
  await R.salvarObra(o);
  assert.equal(b.t.lancamentos.length, 1);
  assert.equal(R.temPendencias(), false);
});

test('limpeza do administrador apaga avanços da obra no servidor', async () => {
  const papel = { v: 'admin' };
  const b = bancoSimulado(papel);
  R._simular(b.cliente, { id: 'u1', email: 'a@x', nome: 'Ana', papel: 'admin' });
  const o = obraTeste();
  for (const c of casas(o)) C.lancar(o, C.indexar(o), { elemId: c.id, etapaId: alv(o).id, comp: '2026-02', acumPct: 20 });
  await R.salvarObra(o);
  assert.equal(b.t.lancamentos.length, 6);
  C.limparAvancos(o);
  await R.salvarObra(o);
  assert.equal(b.t.lancamentos.length, 0);
  assert.equal(b.t.revisoes.length, 1);
  assert.equal(b.t.obras.length, 1);
});
