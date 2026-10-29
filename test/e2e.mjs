// Teste de ponta a ponta no navegador (Playwright + Chromium).
// Uso: npm run build && node test/e2e.mjs [pasta-de-capturas]
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL_APP = 'file://' + path.join(raiz, 'dist', 'index.html');
const SHOTS = process.argv[2] || path.join(raiz, 'test', 'capturas');
mkdirSync(SHOTS, { recursive: true });

let falhas = 0;
let n = 0;
function ok(cond, msg) {
  n++;
  if (cond) console.log(`  ✔ ${msg}`);
  else { falhas++; console.log(`  ✘ ${msg}`); }
}
const passo = (t) => console.log(`\n■ ${t}`);

const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });

const A = (fn, arg) => p.evaluate(fn, arg);
const pronto = () => p.waitForFunction(() => window.__app && __app.obra && !document.querySelector('#carregando'), null, { timeout: 30000 });
const foto = (nome) => p.screenshot({ path: path.join(SHOTS, nome + '.png') });
async function irMes(m) {
  await A((mm) => { const r = document.querySelector('#rangeMes'); r.value = String(__app.meses.indexOf(mm)); r.dispatchEvent(new Event('input')); }, m);
  await p.waitForTimeout(150);
}
async function selecionarPorBusca(nome) {
  await p.fill('#buscaElem', nome);
  await p.locator('#arvore .no', { has: p.locator('.nome', { hasText: new RegExp(`^${nome}$`) }) }).first().click();
  await p.fill('#buscaElem', '');
  await p.dispatchEvent('#buscaElem', 'input');
}
const linha = (etapa) => p.locator('#editor [data-et]', { has: p.locator('.et b', { hasText: new RegExp(`^${etapa}$`) }) });
const uso = async (u) => { await p.click(`[data-uso=${u}]`); await p.waitForTimeout(150); };
async function definirAcum(etapa, v) {
  const i = linha(etapa).locator('.in-acum');
  await i.fill(String(v));
  await i.press('Enter');
  await p.waitForTimeout(120);
}
async function definirReal(etapa, v) {
  const i = linha(etapa).locator('.in-real');
  await i.fill(String(v));
  await i.press('Enter');
  await p.waitForTimeout(120);
}
const pctDe = (nome, etapa, mes) => A(([nome, etapa, mes]) => {
  const { idx } = __app;
  const e = __app.obra.elementos.find((x) => x.nome === nome);
  const et = __app.obra.etapas.find((x) => x.nome === etapa && x.grupo === (e.classe === 'anexo' ? 'anexo' : e.classe === 'infra' ? 'infra' : 'unidade'));
  let s = 0;
  for (const [k, l] of Object.entries(__app.obra.lancamentos)) {
    const [a, b2, c] = k.split('|');
    if (a === e.id && b2 === et.id && c <= mes) s += l.v;
  }
  const tot = et.unidade === '%' ? 100 : (e.quantidades[et.id] || et.qtdPadrao);
  return Math.round((s / tot) * 100 * 1000) / 1000;
}, [nome, etapa, mes]);
const nLanc = () => A(() => Object.keys(__app.obra.lancamentos).length);

// ------------------------------------------------------------------
passo('Abertura e estrutura do Villa Flora II');
await p.goto(URL_APP);
await pronto();
await p.click('#fecharBoas').catch(() => {});
const est = await A(() => ({
  nome: __app.obra.nome,
  ranks: __app.obra.elementos.filter((e) => e.categoria === 'rank').length,
  casas: __app.obra.elementos.filter((e) => e.categoria === 'casa').length,
  docs: __app.obra.documentos.map((d) => d.nome),
  lanc: Object.keys(__app.obra.lancamentos).length,
  anexos: __app.obra.elementos.filter((e) => e.classe === 'anexo').map((e) => e.nome),
}));
ok(est.nome === 'Villa Flora II', 'obra inicial é o Villa Flora II');
ok(est.ranks === 66 && est.casas === 198, `66 ranks e 198 casas (${est.ranks}/${est.casas})`);
ok(await A(() => __app.obra.config.layoutR02 && __app.obra.documentos.some((d) => d.base && d.base.ativo && d.arquivoId)), 'estrutura do Plano de Ataque R02 com a planta como base do 3D');
ok(est.docs.includes('1002.ARQ.EX.0001.IMP-R01.pdf') && est.docs.includes('Villa Flora II - Desenho Plano de Ataque_R02.pdf'), 'documentos de referência listados');
ok(est.lanc === 0, 'obra começa com avanços zerados');
ok(['Guarita', 'Piscinas', 'Salão de festas'].every((x) => est.anexos.includes(x)), 'guarita, piscina e salão como elementos construídos');
await foto('01-abertura');

// ------------------------------------------------------------------
passo('Lançamento individual e acumulação mensal');
await irMes('2026-01');
await selecionarPorBusca('Casa 001');
ok((await p.textContent('#editor .nome-alvo')).includes('Casa 001'), 'painel mostra claramente o alvo: Casa 001');
await definirAcum('Alvenaria', 40);
ok(await pctDe('Casa 001', 'Alvenaria', '2026-01') === 40, 'jan: acumulado 40%');
await irMes('2026-02');
const antFev = await linha('Alvenaria').locator('.ant').textContent();
ok(antFev.includes('40,0%'), `fev mostra acumulado anterior 40% (${antFev.trim()})`);
await definirReal('Alvenaria', 15);
ok(await pctDe('Casa 001', 'Alvenaria', '2026-02') === 55, 'fev: 40% + 15 p.p. = 55%');
await irMes('2026-03');
ok((await linha('Alvenaria').locator('.in-acum').inputValue()) === '55,0', 'mar sem lançamento mantém 55%');
await irMes('2026-02');
const antes = await nLanc();
await definirAcum('Alvenaria', 55);
await definirAcum('Alvenaria', 55);
ok((await nLanc()) === antes && (await pctDe('Casa 001', 'Alvenaria', '2026-02')) === 55, 'salvar de novo não duplica');
// barra editável diretamente
await A(() => { const r = [...document.querySelectorAll('#editor [data-et]')].find((t) => t.querySelector('.et b').textContent === 'Fundações').querySelector('.barra'); r.value = '70'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); });
await p.waitForTimeout(150);
ok(await pctDe('Casa 001', 'Fundações', '2026-02') === 70, 'barra da etapa edita o acumulado (Fundações 70%)');
await foto('02-individual');

// ------------------------------------------------------------------
passo('Correção de mês anterior');
await irMes('2026-01');
await definirAcum('Alvenaria', 30);
await p.waitForSelector('#dlgTxt');
await p.fill('#dlgTxt', 'medição revisada em campo');
await p.click('.dlg .primario');
await p.waitForTimeout(200);
ok(await pctDe('Casa 001', 'Alvenaria', '2026-01') === 30, 'jan corrigido para 30%');
ok(await pctDe('Casa 001', 'Alvenaria', '2026-02') === 45, 'fev recalculado: 30% + 15 p.p. = 45% (realizado do mês preservado)');
const rev = await A(() => __app.obra.revisoes.filter((r) => r.tipo === 'correcao').map((r) => r.motivo));
ok(rev.includes('medição revisada em campo'), 'correção registrada com motivo');
await definirAcum('Alvenaria', 95);
const lanc95 = await pctDe('Casa 001', 'Alvenaria', '2026-01');
await p.click('.dlg .primario').catch(() => {});
await p.waitForTimeout(200);
ok(lanc95 === 30 && (await pctDe('Casa 001', 'Alvenaria', '2026-02')) === 45, 'correção que levaria fev a 110% é bloqueada');
const t = await p.textContent('#toast');
ok(/0% e 100%|fora/.test(t), `aviso de validação exibido (“${t.trim().slice(0, 60)}…”)`);

// ------------------------------------------------------------------
passo('Lançamento coletivo no rank');
await irMes('2026-02');
await selecionarPorBusca('Rank 02');
ok((await p.textContent('#editor .alvo')).includes('Lançamento coletivo em'), 'painel indica lançamento coletivo');
await p.locator('#editor .et-checks label', { hasText: 'Cobertura' }).locator('input').check();
await p.fill('#colValDef', '50');
await p.click('[data-acao=colPrevia]');
const previa = await p.textContent('#editor .previa h4');
ok(/3 elementos e 3 etapas/.test(previa), `prévia mostra os afetados (${previa.trim()})`);
await foto('03-previa-coletivo');
await p.click('[data-acao=colAplicar]');
await p.waitForTimeout(200);
const cob = await Promise.all(['Casa 142', 'Casa 143', 'Casa 144'].map((c) => pctDe(c, 'Cobertura', '2026-02')));
ok(cob.every((v) => v === 50), `Casas 142–144 com cobertura 50% (${cob})`);
ok(await pctDe('Casa 001', 'Cobertura', '2026-02') === 0 && (await pctDe('Casa 001', 'Alvenaria', '2026-02')) === 45, 'outras casas e etapas preservadas');
await selecionarPorBusca('Casa 143');
await definirAcum('Cobertura', 80);
const cob2 = await Promise.all(['Casa 142', 'Casa 143', 'Casa 144'].map((c) => pctDe(c, 'Cobertura', '2026-02')));
ok(cob2[0] === 50 && cob2[1] === 80 && cob2[2] === 50, `editar só a Casa 143 preserva as demais (${cob2})`);
const dupla = await A(() => {
  const { idx, mes } = __app;
  const rank = __app.obra.elementos.find((e) => e.nome === 'Rank 02');
  const filhos = __app.obra.elementos.filter((e) => e.paiId === rank.id);
  return { r: window.__app && idx ? null : null, n: filhos.length };
});
ok(dupla.n === 3, 'rank com 3 casas');

// ------------------------------------------------------------------
passo('Finalização com ✓');
await selecionarPorBusca('Rank 02');
await p.click('[data-aba=final]');
await p.fill('#finQtd', '2');
await p.click('[data-acao=finQtd]');
await p.click('[data-acao=finSalvar]');
await p.click('.dlg .primario');
await p.waitForTimeout(250);
const cont = await p.textContent('#editor .cont-fin');
ok(/2 de 3/.test(cont), `contagem “${cont.trim()}”`);
const checks = await A(() => { let c = 0; __app.vA.raiz.traverse((o) => { if (o.userData.check) c++; }); return c; });
ok(checks === 2, `símbolo ✓ sobre 2 elementos na cena (${checks})`);
await irMes('2026-06');
const fin6 = await A(() => __app.obra.elementos.filter((e) => e.categoria === 'casa').filter((e) => {
  const ev = (__app.obra.conclusoes[e.id] || []).filter((x) => x.comp <= '2026-06');
  return ev.length && ev[ev.length - 1].acao !== 'reabrir';
}).map((e) => e.nome));
ok(fin6.length === 2 && fin6.includes('Casa 142'), `finalização permanece em jun (${fin6})`);
await selecionarPorBusca('Casa 144');
await p.click('[data-acao=finalizar]');
await p.click('.dlg .primario');
await p.waitForTimeout(200);
ok((await p.textContent('#editor .resumo-elem')).includes('Finalizado'), 'finalização individual da Casa 144 em jun');
await irMes('2026-05');
await selecionarPorBusca('Rank 02');
ok(/2 de 3/.test(await p.textContent('#editor .cont-fin')), 'em mai ainda são 2 de 3 (finalização de jun não retroage)');
await foto('04-finalizacao');

// ------------------------------------------------------------------
passo('Áreas comuns e infraestrutura');
await irMes('2026-04');
await selecionarPorBusca('Piscinas');
const etapasPiscina = await p.locator('#editor [data-et] .et b').allTextContents();
ok(!etapasPiscina.includes('Cobertura') && etapasPiscina.includes('Impermeabilização'), 'piscina com etapas próprias');
await definirAcum('Estrutura', 100);
await definirAcum('Fundações', 100);
const ind = await A(() => ({ ac: document.querySelector('.card.ac .card-num').textContent, un: document.querySelector('.card.un .card-num').textContent }));
ok(ind.ac !== '0,0%', `indicador de áreas comuns separado (${ind.ac}; unidades ${ind.un})`);
await p.click('[data-acao=finalizar]');
await p.click('.dlg .primario');
await p.waitForTimeout(150);
ok((await p.textContent('.card.ac')).includes('1 de 14'), 'piscina finalizada contada nas áreas comuns');
await selecionarPorBusca('Estacionamento e circulação central');
const unid = await linha('Pavimentação').locator('.ec-qtd').textContent();
ok(/m²/.test(unid), `pavimentação por quantidade (${unid.trim()})`);
const totPav = await A(() => { const e = __app.obra.elementos.find((x) => x.nome === 'Estacionamento e circulação central'); const et = __app.obra.etapas.find((x) => x.nome === 'Pavimentação'); return e.quantidades[et.id]; });
await definirReal('Pavimentação', Math.round(totPav / 4));
const pPav = await pctDe('Estacionamento e circulação central', 'Pavimentação', '2026-04');
ok(Math.abs(pPav - 25) < 0.1, `realizado em m² vira % pelo total (${pPav}%)`);
ok((await p.textContent('.card.inf .card-num')) !== '0,0%', 'indicador de infraestrutura separado');

// ------------------------------------------------------------------
passo('Modos de visualização e linha do tempo');
for (const [m, txt] of [['avanco', 'Por avanço'], ['mudou', 'O que mudou'], ['etapa', 'Etapa'], ['maquete', 'Maquete']]) {
  await p.click(`[data-modo=${m}]`);
  await p.waitForTimeout(150);
  ok((await p.textContent('#explicaModo')).startsWith(txt), `modo ${txt} com explicação`);
  if (m === 'avanco') await foto('05-modo-avanco');
  if (m === 'mudou') await foto('06-modo-mudou');
}
await p.selectOption('#selEtapa', { label: 'Cobertura' });
await p.waitForTimeout(150);
ok(await A(() => __app.modo === 'etapa' && __app.obra.etapas.find((e) => e.id === __app.etapaFiltro).nome === 'Cobertura'), 'filtro por etapa ativo');
await selecionarPorBusca('Casa 143');
const ets = await p.locator('#editor [data-et] .et b').allTextContents();
ok(ets.length === 1 && ets[0] === 'Cobertura', 'painel edita só a etapa filtrada');
await p.selectOption('#selEtapa', 'todas');
await p.click('[data-modo=maquete]');
await uso('acompanhar');
await p.click('#btnLado');
await p.waitForTimeout(300);
ok(await A(() => !document.querySelector('#cenaB').classList.contains('oculto')), 'duas cenas lado a lado');
await A(() => { __app.vA.camera.position.x += 30; __app.vA.controls.dispatchEvent({ type: 'change' }); });
ok(await A(() => Math.abs(__app.vA.camera.position.x - __app.vB.camera.position.x) < 1e-6), 'navegação sincronizada entre as cenas');
await foto('07-lado-a-lado');
await p.click('#btnLado');
const m0 = await A(() => __app.mes);
await p.click('#btnPlay');
await p.waitForTimeout(2000);
const m1 = await A(() => __app.mes);
await p.click('#btnPlay');
ok(m1 > m0, `reprodução automática avança os meses (${m0} → ${m1})`);
await uso('lancar');

// ------------------------------------------------------------------
passo('Navegação 3D: mouse, seleção na cena, primeira pessoa');
await p.click('#btnGeral');
await p.waitForTimeout(200);
const box = await p.locator('#cenaA canvas').boundingBox();
const cam0 = await A(() => __app.vA.camera.position.toArray());
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2 + 30, { steps: 8 });
await p.mouse.up();
await p.waitForTimeout(300);
const cam1 = await A(() => __app.vA.camera.position.toArray());
ok(cam0.some((v, i) => Math.abs(v - cam1[i]) > 1), 'arrastar com o mouse gira a vista');
const d0 = await A(() => __app.vA.camera.position.distanceTo(__app.vA.controls.target));
await p.mouse.wheel(0, -600);
await p.waitForTimeout(400);
const d1 = await A(() => __app.vA.camera.position.distanceTo(__app.vA.controls.target));
ok(d1 < d0, `roda do mouse aproxima (${d0.toFixed(0)} → ${d1.toFixed(0)} m)`);
// clique em uma casa projetada na tela
await p.click('#btnGeral');
await p.waitForTimeout(200);
const alvoTela = await A(() => {
  const e = __app.obra.elementos.find((x) => x.nome === 'Casa 050');
  const v = __app.vA.objs.get(e.id).grupo.position.clone();
  v.y = 1;
  v.project(__app.vA.camera);
  const r = __app.vA.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
});
await p.mouse.click(alvoTela.x, alvoTela.y);
await p.waitForTimeout(200);
const sel = await A(() => __app.selecao.map((id) => __app.obra.elementos.find((e) => e.id === id).nome));
ok(sel.length === 1 && /^Casa 0(49|50|51)$/.test(sel[0]), `clique na cena seleciona a casa (${sel})`);
await p.mouse.dblclick(alvoTela.x, alvoTela.y);
await p.waitForTimeout(200);
const selR = await A(() => __app.selecao.map((id) => __app.obra.elementos.find((e) => e.id === id).categoria));
ok(selR[0] === 'rank', 'duplo clique seleciona o rank');
// personagem e caminhada
await p.click('#btnPersonagem');
const pontoLivre = await A(() => {
  const v = new (__app.vA.camera.position.constructor)(-60, 0, -12);
  v.project(__app.vA.camera);
  const r = __app.vA.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
});
await p.mouse.click(pontoLivre.x, pontoLivre.y);
await p.waitForTimeout(300);
ok(await A(() => __app.vA.fp.ativo), 'personagem colocado e caminhada iniciada');
ok(await A(() => !document.querySelector('#ctrlFp').classList.contains('oculto')), 'controles de caminhada na tela');
const pos0 = await A(() => __app.vA.fp.pos.toArray());
await p.keyboard.down('KeyW');
await p.waitForTimeout(700);
await p.keyboard.up('KeyW');
const pos1 = await A(() => __app.vA.fp.pos.toArray());
ok(Math.hypot(pos1[0] - pos0[0], pos1[2] - pos0[2]) > 1, 'tecla W anda para frente');
await p.dispatchEvent('[data-mov=girarD]', 'pointerdown');
await p.waitForTimeout(300);
await p.dispatchEvent('[data-mov=girarD]', 'pointerup');
const yaw = await A(() => __app.vA.fp.yaw);
await p.dispatchEvent('[data-mov=frente]', 'pointerdown');
await p.waitForTimeout(500);
await p.dispatchEvent('[data-mov=frente]', 'pointerup');
const pos2 = await A(() => __app.vA.fp.pos.toArray());
ok(Math.hypot(pos2[0] - pos1[0], pos2[2] - pos1[2]) > 0.5, 'botões na tela andam e giram');
await foto('08-primeira-pessoa');
// colisão: casa 004 tem paredes? Lança alvenaria e tenta atravessar
const col = await A(() => {
  const v = __app.vA;
  const e = __app.obra.elementos.find((x) => x.nome === 'Casa 001');
  const c = v.colisores.find((k) => Math.abs(k.x - e.x) < 0.01 && Math.abs(k.z - e.z) < 0.01);
  if (!c) return 'sem colisor';
  const p0 = v._resolverColisao(new (v.camera.position.constructor)(e.x, 0, e.z));
  const dx = p0.x - e.x;
  const dz = p0.z - e.z;
  return Math.abs(dx) >= c.hw - 0.01 || Math.abs(dz) >= c.hd - 0.01 ? 'empurrado' : 'dentro';
});
ok(col === 'empurrado', `colisão com elemento construído (${col})`);
await p.keyboard.press('Escape');
await p.waitForTimeout(200);
ok(await A(() => !__app.vA.fp.ativo && document.querySelector('#ctrlFp').classList.contains('oculto')), 'Esc sai da caminhada');
await p.click('#btnTopo');
await p.waitForTimeout(200);
ok(await A(() => { const v = __app.vA; return v.camera.position.y > 100 && Math.abs(v.camera.position.x - v.controls.target.x) < 1; }), 'vista superior');
await foto('09-vista-superior');

// ------------------------------------------------------------------
passo('Persistência após reabrir');
const snap = await A(() => ({ n: Object.keys(__app.obra.lancamentos).length, c: Object.keys(__app.obra.conclusoes).length, id: __app.obra.id }));
await p.waitForTimeout(600);
await p.reload();
await pronto();
const snap2 = await A(() => ({ n: Object.keys(__app.obra.lancamentos).length, c: Object.keys(__app.obra.conclusoes).length, id: __app.obra.id }));
ok(snap.n === snap2.n && snap.c === snap2.c && snap.id === snap2.id, `dados preservados após recarregar (${snap2.n} lançamentos, ${snap2.c} conclusões)`);
ok(await pctDe('Casa 001', 'Alvenaria', '2026-02') === 45, 'acumulado de fev continua 45%');

// ------------------------------------------------------------------
passo('Nova obra e independência dos dados');
const vfId = snap.id;
await uso('configurar');
await p.click('#btnObras');
await p.click('[data-o=nova]');
await p.fill('#nNome', 'Edifício Teste');
await p.selectOption('#nTipo', 'edificio');
await p.fill('#gPav', '5');
await p.click('.dlg .primario');
await p.waitForFunction(() => __app.obra.nome === 'Edifício Teste');
const ed = await A(() => ({ n: Object.keys(__app.obra.lancamentos).length, aptos: __app.obra.elementos.filter((e) => e.categoria === 'apartamento').length, tipo: __app.obra.tipo }));
ok(ed.n === 0 && ed.aptos === 16 && ed.tipo === 'edificio', `edifício criado zerado com ${ed.aptos} aptos`);
await irMes(await A(() => __app.meses[1]));
await uso('lancar');
await selecionarPorBusca('Apto 101 TA');
await definirAcum('Estrutura', 60);
const edLanc = await nLanc();
ok(edLanc === 1, 'lançamento na nova obra');
await foto('10-edificio');
await p.selectOption('#selObra', vfId);
await p.waitForFunction((id) => __app.obra.id === id, vfId);
ok((await nLanc()) === snap.n, 'Villa Flora intacto após lançar no edifício');
ok(await pctDe('Casa 001', 'Alvenaria', '2026-02') === 45, 'valores do Villa Flora preservados');

// ------------------------------------------------------------------
passo('Duplicação com e sem avanços');
await uso('configurar');
await p.click('#btnObras');
await p.locator('tr', { hasText: 'Villa Flora II' }).first().locator('[data-o=duplicar]').click();
await p.fill('#dNome', 'VF cópia estrutura');
await p.click('.dlg .primario');
await p.waitForFunction(() => __app.obra.nome === 'VF cópia estrutura');
ok((await nLanc()) === 0 && (await A(() => __app.obra.elementos.length)) === 304, 'cópia sem avanços mantém estrutura e zera lançamentos');
await p.selectOption('#selObra', vfId);
await p.waitForFunction((id) => __app.obra.id === id, vfId);
await p.click('#btnObras');
await p.locator('tr', { hasText: 'Villa Flora II' }).first().locator('[data-o=duplicar]').click();
await p.fill('#dNome', 'VF cópia completa');
await p.check('#dAv');
await p.click('.dlg .primario');
await p.waitForFunction(() => __app.obra.nome === 'VF cópia completa');
ok((await nLanc()) === snap.n && (await pctDe('Casa 001', 'Alvenaria', '2026-02')) === 45, 'cópia com avanços traz os lançamentos');
await uso('configurar');

// ------------------------------------------------------------------
passo('Exportar, planilha, importar');
await p.selectOption('#selObra', vfId);
await p.waitForFunction((id) => __app.obra.id === id, vfId);
await p.click('#btnDados');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-x=exp]')]);
const arqJson = path.join(SHOTS, 'export.json');
await dl.saveAs(arqJson);
const pac = JSON.parse(readFileSync(arqJson, 'utf8'));
ok(pac.formato === 'obras3d' && Object.keys(pac.obra.lancamentos).length === snap.n && pac.obra.etapas.length > 0 && pac.obra.inicio, 'exportação completa (estrutura, datas, etapas e lançamentos)');
const [dx] = await Promise.all([p.waitForEvent('download'), p.click('[data-x=xlsx]')]);
const arqX = path.join(SHOTS, 'conferencia.xlsx');
await dx.saveAs(arqX);
const xb = readFileSync(arqX);
ok(xb[0] === 0x50 && xb[1] === 0x4b && xb.length > 5000, `planilha .xlsx gerada (${xb.length} bytes)`);
await p.click('.dlg .fechar');
await p.click('#btnDados');
const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-x=imp]')]);
await fc.setFiles(arqJson);
await p.waitForSelector('.dlg-rodape button:has-text("Importar como nova")');
await p.click('.dlg-rodape button:has-text("Importar como nova")');
await p.waitForFunction(() => __app.obra.nome.includes('(importada)'));
ok((await nLanc()) === snap.n && (await pctDe('Casa 001', 'Alvenaria', '2026-02')) === 45, 'importação como nova obra com todos os lançamentos');
const impId = await A(() => __app.obra.id);
ok(impId !== vfId, 'obra importada tem identificador próprio');

// ------------------------------------------------------------------
passo('Limpar avanços só da obra selecionada');
await p.click('#btnDados');
await p.click('[data-x=limpar]');
await p.fill('#lConf', 'LIMPAR');
const [bk] = await Promise.all([p.waitForEvent('download'), p.click('.dlg-rodape .perigo')]);
ok(!!bk, 'cópia de segurança baixada antes da limpeza');
await p.waitForTimeout(400);
ok((await nLanc()) === 0 && (await A(() => __app.obra.elementos.length)) === 304, 'avanços limpos e estrutura mantida');
await p.selectOption('#selObra', vfId);
await p.waitForFunction((id) => __app.obra.id === id, vfId);
ok((await nLanc()) === snap.n, 'Villa Flora original não foi afetado pela limpeza');

// ------------------------------------------------------------------
passo('Datas da obra e linha do tempo');
await p.click('#btnEditarObra');
await p.fill('#eIni', '2026-03-01');
await p.click('.dlg .primario');
await p.waitForTimeout(300);
const lt = await A(() => ({ ini: __app.meses[0], fora: __app.fora, n: Object.keys(__app.obra.lancamentos).length }));
ok(lt.fora.includes('2026-01') && lt.n === snap.n, `datas alteradas sem apagar lançamentos (fora do período: ${lt.fora.join(', ')})`);
await p.click('#btnEditarObra');
await p.fill('#eIni', '2026-01-01');
await p.click('.dlg .primario');

// ------------------------------------------------------------------
passo('Estrutura configurável pela interface');
await uso('configurar');
await selecionarPorBusca('Trecho 01');
await p.click('[data-acao=addRank]');
await p.waitForTimeout(200);
const novoRank = await A(() => { const r = __app.obra.elementos.filter((e) => e.categoria === 'rank').pop(); return { nome: r.nome, n: __app.obra.elementos.filter((e) => e.paiId === r.id).length }; });
ok(novoRank.n === 3, `novo rank com casas por rank da obra (${novoRank.nome}, ${novoRank.n} casas)`);
const nomeInp = p.locator('#editor input[data-prop=nome]');
await nomeInp.fill('Rank 67 (teste)');
await nomeInp.press('Enter');
await p.waitForTimeout(150);
ok(await A(() => __app.obra.elementos.some((e) => e.nome === 'Rank 67 (teste)')), 'renomear grupo');
await selecionarPorBusca('Casa 001');
const [x0, r0] = await A(() => { const e = __app.obra.elementos.find((x) => x.nome === 'Casa 001'); return [e.x, e.rot]; });
await p.click('[data-nudge="x:1"]');
await p.click('[data-nudge="rot:15"]');
const e1 = await A(() => { const e = __app.obra.elementos.find((x) => x.nome === 'Casa 001'); return { x: e.x, rot: e.rot }; });
ok(Math.abs(e1.x - x0 - 1) < 1e-6 && (e1.rot - r0 + 360) % 360 === 15, 'ajuste de posição e orientação');
await p.click('#btnEtapas');
await p.click('[data-mod=infra]');
await p.click('.dlg-fundo:last-child .dlg-rodape button:first-child');
await p.locator('[data-add=unidade]').click();
await p.click('.dlg-rodape .primario');
await p.waitForTimeout(200);
ok(await A(() => __app.obra.etapas.some((e) => e.nome === 'Nova etapa' && e.grupo === 'unidade')), 'etapa nova cadastrada pela interface');

// ------------------------------------------------------------------
passo('Painéis que abrem e fecham (foco na maquete)');
await uso('lancar');
const largura0 = await p.locator('#cenaA').evaluate((e) => e.clientWidth);
await p.click('#painelEsq .recolher');
await p.waitForTimeout(200);
ok(await A(() => getComputedStyle(document.querySelector('#painelEsq')).display === 'none'), 'lista fecha');
await p.click('[data-secao=lancar] .recolher');
await p.waitForTimeout(300);
const largura1 = await p.locator('#cenaA').evaluate((e) => e.clientWidth);
ok(largura1 > largura0 + 400, `maquete ganha espaço (${largura0} → ${largura1} px de largura)`);
ok(await A(() => document.body.classList.contains('foco')), 'com os dois painéis fechados entra em foco');
ok(await A(() => ['esq', 'dir'].every((k) => getComputedStyle(document.querySelector('.aba-borda.' + k)).display !== 'none')), 'cada painel fechado mostra uma alça para reabrir');
await foto('13-foco-maquete');
await p.reload();
await pronto();
ok(await A(() => document.body.classList.contains('sem-esq') && document.body.classList.contains('sem-dir')), 'escolha dos painéis lembrada ao reabrir');
await p.click('.aba-borda.dir');
await p.waitForTimeout(200);
ok(await A(() => getComputedStyle(document.querySelector('#painelDir')).display !== 'none'), 'alça reabre o painel da direita');
await p.click('.aba-borda.esq');
await p.waitForTimeout(200);
ok(await A(() => !document.body.classList.contains('foco') && getComputedStyle(document.querySelector('#painelEsq')).display !== 'none'), 'alça reabre a lista');
await p.keyboard.press('f');
await p.waitForTimeout(200);
ok(await A(() => document.body.classList.contains('foco')), 'tecla F alterna o foco');
await p.click('#btnSairFoco');
await p.waitForTimeout(200);
ok(await A(() => !document.body.classList.contains('foco')), 'botão “Mostrar painéis” reabre tudo');

// ------------------------------------------------------------------
passo('Maquete em tela cheia');
await p.click('#btnExpandir');
await p.waitForTimeout(400);
const tc = await A(() => { const r = document.querySelector('#cenas').getBoundingClientRect(); return { w: r.width, h: r.height, vw: innerWidth, vh: innerHeight }; });
ok(tc.w >= tc.vw - 2 && tc.h >= tc.vh - 2, `maquete ocupa a tela inteira (${Math.round(tc.w)}×${Math.round(tc.h)})`);
await foto('15-tela-cheia');
await p.click('#btnExpandir');
await p.waitForTimeout(300);
ok(await A(() => !document.querySelector('#cenas').classList.contains('expandida')), 'mesmo botão sai da tela cheia');

// ------------------------------------------------------------------
passo('Toque (celular)');
const ctxM = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const pm = await ctxM.newPage();
pm.on('pageerror', (e) => erros.push('mobile: ' + e.message));
await pm.goto(URL_APP);
await pm.waitForFunction(() => window.__app && __app.obra && !document.querySelector('#carregando'), null, { timeout: 30000 });
await pm.click('#fecharBoas').catch(() => {});
await pm.waitForTimeout(400);
const alvoM = await pm.evaluate(() => {
  const e = __app.obra.elementos.find((x) => x.nome === 'Salão de festas');
  __app.vA.focar([e.id]);
  __app.vA.controls.update();
  const v = __app.vA.objs.get(e.id).grupo.position.clone();
  v.y = 1;
  v.project(__app.vA.camera);
  const r = __app.vA.canvas.getBoundingClientRect();
  return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
});
await pm.waitForTimeout(300);
await pm.touchscreen.tap(alvoM.x, alvoM.y);
await pm.waitForTimeout(300);
const selM = await pm.evaluate(() => __app.selecao.map((id) => __app.obra.elementos.find((e) => e.id === id).nome));
ok(selM[0] === 'Salão de festas', `toque seleciona área comum (${selM})`);
await pm.screenshot({ path: path.join(SHOTS, '11-celular.png') });
await pm.click('[data-painel="#painelEsq"]');
await pm.waitForTimeout(300);
ok(await pm.evaluate(() => document.querySelector('#painelEsq').classList.contains('aberto')), 'painel de elementos abre no celular');
await pm.screenshot({ path: path.join(SHOTS, '12-celular-lista.png') });
await ctxM.close();

ok(erros.length === 0, `sem erros de JavaScript${erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''}`);
await b.close();
console.log(`\n${n - falhas} de ${n} verificações passaram.`);
process.exit(falhas ? 1 : 0);
