// Estado central, troca de obras, gravação automática, linha do tempo e barra 3D.

import * as C from './calc.js';
import * as M from './model.js';
import * as S from './store.js';
import { Visualizador } from './scene.js';
import { fmtMes, mesAtual, mesAnterior, mesDe } from './meses.js';
import { $, $$, esc, toast, dialogo } from './util.js';
import { renderArvore, ligarArvore, renderIndicadores, ligarIndicadores, renderLegenda } from './paineis.js';
import { renderEditor, ligarEditor, moverPorArrasto } from './editor.js';
import * as Modais from './modais.js';

export const app = {
  indice: [],
  obra: null,
  idx: null,
  meses: [],
  fora: [],
  mes: null,
  mesComp: null,
  modo: 'maquete',
  etapaFiltro: 'todas',
  selecao: [],
  nivelSelecao: 'folha',
  ladoALado: false,
  sincronizar: true,
  rotulos: 'grupos',
  sombras: true,
  moverAtivo: false,
  abaEditor: 'avanco',
  mostrarArquivadas: false,
  expandidos: new Set(),
  coletivo: { etapas: new Set(), modo: 'definir', valor: '', previa: null },
  finalPendente: new Map(),
  tocando: null,
  vA: null,
  vB: null,
};
window.__app = app; // acesso para testes e diagnóstico

const EXPLICA = {
  maquete: 'Maquete: cada etapa lançada faz surgir o componente correspondente (terreno, fundação, estrutura, paredes, telhado, instalações, acabamento, paisagismo). Sem avanço, o elemento aparece só como contorno.',
  avanco: 'Por avanço: cor pela situação na competência. Cinza não iniciado, laranja → amarelo em execução, verde 100% físico, azul finalizado, roxo entregue.',
  mudou: 'O que mudou: compara a competência ativa com a de comparação. Verde avançou, vermelho regrediu, magenta teve correção no período, azul foi finalizado no período, cinza sem mudança.',
  etapa: 'Etapa: escolha uma etapa para colorir a cena só por ela e editar apenas essa etapa no painel de baixo. “Todas” mostra o avanço geral.',
};

// ---------------------------------------------------------------- persistência

let timerSalvar = null;
let salvando = Promise.resolve();

export function salvarDepois() {
  clearTimeout(timerSalvar);
  marcarSalvo('pendente');
  timerSalvar = setTimeout(() => salvarAgora(), 350);
}

export async function salvarAgora() {
  clearTimeout(timerSalvar);
  if (!app.obra) return;
  const obra = app.obra;
  salvando = salvando.then(async () => {
    try {
      await S.salvarObra(obra);
      atualizarIndiceLocal(obra);
      await S.meta('indice', app.indice);
      marcarSalvo('ok');
    } catch (e) {
      console.error(e);
      marcarSalvo('erro');
      toast('Não foi possível gravar neste navegador. Exporte uma cópia em “Dados”.', 'erro');
    }
  });
  return salvando;
}

function resumoIndice(o) {
  return { id: o.id, nome: o.nome, tipo: o.tipo, inicio: o.inicio, termino: o.termino, arquivada: !!o.arquivada, atualizadoEm: o.atualizadoEm, nElem: o.elementos.filter(C.ehFolha).length };
}

function atualizarIndiceLocal(o) {
  const i = app.indice.findIndex((x) => x.id === o.id);
  const r = resumoIndice(o);
  if (i >= 0) app.indice[i] = r;
  else app.indice.push(r);
}

export async function recarregarIndice() {
  // o índice guarda só o resumo de cada obra; os dados completos são lidos ao abrir
  let ind = await S.meta('indice');
  const todas = await S.listarObras();
  ind = todas.map(resumoIndice);
  app.indice = ind.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  await S.meta('indice', app.indice);
  renderSeletorObras();
}

function marcarSalvo(st) {
  const el = $('#statusSalvo');
  if (!el) return;
  if (st === 'pendente') { el.textContent = 'Gravando…'; el.className = 'salvo pend'; }
  else if (st === 'erro') { el.textContent = 'Erro ao gravar'; el.className = 'salvo erro'; }
  else { el.textContent = `Salvo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; el.className = 'salvo ok'; }
}

// ---------------------------------------------------------------- mutação

// Aplica uma alteração na obra aberta, reindexa, agenda a gravação e redesenha.
export function mutar(fn, opts = {}) {
  if (!app.obra) return;
  fn(app.obra, app.idx);
  app.idx = C.indexar(app.obra);
  if (opts.periodo !== false) atualizarPeriodo();
  salvarDepois();
  renderTudo({ cena: opts.cena !== false });
}

function atualizarPeriodo() {
  const { meses, fora } = C.mesesDaObra(app.obra);
  app.meses = meses;
  app.fora = fora;
  if (!meses.includes(app.mes)) app.mes = meses.includes(mesAtual()) ? mesAtual() : meses[0];
  if (!meses.includes(app.mesComp) || app.mesComp === app.mes) {
    const i = meses.indexOf(app.mes);
    app.mesComp = meses[Math.max(0, i - 1)];
  }
}

// ---------------------------------------------------------------- abrir obra

export async function abrirObra(id) {
  pararReproducao();
  if (app.obra && app.obra.id !== id) await salvarAgora();
  const o = await S.carregarObra(id);
  if (!o) { toast('Obra não encontrada.', 'erro'); return; }
  M.normalizar(o);
  app.obra = o;
  app.idx = C.indexar(o);
  app.selecao = [];
  app.finalPendente.clear();
  app.coletivo = { etapas: new Set(), modo: 'definir', valor: '', previa: null };
  app.expandidos = new Set(C.filhosDe(app.idx, null).map((e) => e.id));
  app.etapaFiltro = 'todas';
  app.mes = null;
  app.mesComp = null;
  // competência inicial: mês atual se estiver no período, senão o último mês com lançamento, senão o início
  const { meses } = C.mesesDaObra(o);
  const usados = Object.keys(o.lancamentos).map((k) => k.split('|')[2]).sort();
  app.mes = meses.includes(mesAtual()) ? mesAtual() : usados.length ? usados[usados.length - 1] : meses[0];
  atualizarPeriodo();
  await S.meta('ultimaObra', id);
  renderSeletorObras();
  marcarSalvo('ok');
  if (app.vA) {
    app.vA.personagem.visible = false;
    if (o.personagem) app.vA.posicionarPersonagem(o.personagem.x, o.personagem.z);
  }
  renderTudo();
  app.vA.vistaGeral();
  if (app.vB) app.vB.aplicarCamera(app.vA.estadoCamera());
  await atualizarPlanta();
}

// ---------------------------------------------------------------- planta de base

const cachePlanta = new Map();

async function carregarPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = res;
    s.onerror = () => rej(new Error('Sem acesso ao leitor de PDF (internet).'));
    document.head.appendChild(s);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return window.pdfjsLib;
}

async function imagemDe(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export async function atualizarPlanta() {
  const doc = app.obra?.documentos.find((d) => d.base?.ativo && d.arquivoId);
  if (!doc) {
    app.vA?.setPlanta(null, null);
    app.vB?.setPlanta(null, null);
    return;
  }
  try {
    let img = cachePlanta.get(doc.arquivoId + '|' + (doc.base.pagina || 1));
    if (!img) {
      if (/pdf/.test(doc.mime)) {
        let r = doc.renderId ? await S.lerArquivo(doc.renderId) : null;
        if (!r) {
          toast('Convertendo página do PDF em imagem…');
          const arq = await S.lerArquivo(doc.arquivoId);
          const pdfjs = await carregarPdfJs();
          const pdf = await pdfjs.getDocument({ data: await arq.blob.arrayBuffer() }).promise;
          const pg = await pdf.getPage(Math.min(pdf.numPages, Math.max(1, doc.base.pagina || 1)));
          const vp0 = pg.getViewport({ scale: 1 });
          const esc_ = Math.min(4096 / vp0.width, 4096 / vp0.height, 3);
          const vp = pg.getViewport({ scale: esc_ });
          const cv = document.createElement('canvas');
          cv.width = vp.width;
          cv.height = vp.height;
          await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
          const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
          const rid = C.uid('arq');
          await S.salvarArquivo({ id: rid, obraId: app.obra.id, nome: doc.nome + '.png', mime: 'image/png', blob });
          doc.renderId = rid;
          salvarDepois();
          r = { blob };
        }
        img = await imagemDe(r.blob);
      } else {
        const arq = await S.lerArquivo(doc.arquivoId);
        img = await imagemDe(arq.blob);
      }
      cachePlanta.set(doc.arquivoId + '|' + (doc.base.pagina || 1), img);
    }
    app.vA.setPlanta(img, doc.base);
    app.vB?.setPlanta(img, doc.base);
  } catch (e) {
    console.warn(e);
    toast(`Não foi possível usar “${doc.nome}” como planta: ${e.message}. Converta a página em PNG/JPG e anexe a imagem.`, 'erro');
  }
}

// ---------------------------------------------------------------- seleção

export function selecionar(id, { aditivo = false, duplo = false, origem = 'cena' } = {}) {
  if (app.moverAtivo && origem === 'cena' && !id) return;
  if (!id) {
    app.selecao = [];
  } else {
    let alvo = id;
    const e = app.idx.elemById.get(id);
    if (origem === 'cena' && e && C.ehFolha(e)) {
      const anc = C.ancestrais(app.idx, id);
      if (duplo) alvo = anc.length ? anc[anc.length - 1].id : id;
      else if (app.nivelSelecao === 'pai' && anc.length) alvo = anc[anc.length - 1].id;
      else if (app.nivelSelecao === 'avo' && anc.length) alvo = anc[Math.max(0, anc.length - 2)].id;
    }
    if (aditivo) {
      const s = new Set(app.selecao);
      if (s.has(alvo)) s.delete(alvo);
      else s.add(alvo);
      app.selecao = [...s];
    } else app.selecao = [alvo];
    for (const a of C.ancestrais(app.idx, alvo)) app.expandidos.add(a.id);
  }
  app.coletivo.previa = null;
  app.finalPendente.clear();
  const ehFolha = app.selecao.length === 1 && C.ehFolha(app.idx.elemById.get(app.selecao[0]) || {});
  if (ehFolha && !['avanco', 'historico', 'props'].includes(app.abaEditor)) app.abaEditor = 'avanco';
  if (!ehFolha && !['coletivo', 'final', 'elems', 'props'].includes(app.abaEditor)) app.abaEditor = 'coletivo';
  app.vA.estado.selecao = app.selecao;
  app.vA.desenharSelecao(app.selecao);
  if (app.vB && app.ladoALado) { app.vB.estado.selecao = app.selecao; app.vB.desenharSelecao(app.selecao); }
  renderArvore();
  renderEditor();
  renderIndicadores();
  const n = $('#arvore .no.sel');
  if (n && origem === 'cena') n.scrollIntoView({ block: 'nearest' });
}

// ---------------------------------------------------------------- render

export function renderTudo({ cena = true } = {}) {
  if (!app.obra) return;
  renderBarra();
  renderLinhaTempo();
  renderArvore();
  renderIndicadores();
  renderEditor();
  renderLegenda();
  if (cena) reconstruirCena();
}

export function reconstruirCena() {
  const diff = app.modo === 'mudou' ? C.diferencas(app.idx, app.mesComp, app.mes) : null;
  const base = { modo: app.modo, etapaFiltro: app.etapaFiltro, rotulos: app.rotulos, selecao: app.selecao };
  app.vA.construir(app.idx, { ...base, mes: app.mes, diff });
  if (app.ladoALado) app.vB.construir(app.idx, { ...base, mes: app.mesComp, diff: app.modo === 'mudou' ? diff : null });
  $('#tagA').textContent = app.ladoALado ? `Competência ativa · ${fmtMes(app.mes)}` : fmtMes(app.mes);
  $('#tagB').textContent = `Comparação · ${fmtMes(app.mesComp)}`;
}

function renderSeletorObras() {
  const s = $('#selObra');
  if (!s) return;
  const lista = app.indice.filter((o) => !o.arquivada || o.id === app.obra?.id);
  s.innerHTML = lista.map((o) => `<option value="${o.id}" ${o.id === app.obra?.id ? 'selected' : ''}>${esc(o.nome)}${o.arquivada ? ' (arquivada)' : ''}</option>`).join('');
}

function renderBarra() {
  $$('[data-modo]').forEach((b) => b.classList.toggle('ativo', b.dataset.modo === app.modo));
  const sel = $('#selEtapa');
  sel.innerHTML = `<option value="todas">Todas as etapas</option>${Object.entries(M.GRUPOS_ETAPA).map(([g, n]) => {
    const l = app.idx.etapasOrdenadas.filter((x) => x.grupo === g);
    return l.length ? `<optgroup label="${n}">${l.map((x) => `<option value="${x.id}" ${x.id === app.etapaFiltro ? 'selected' : ''}>${esc(x.nome)}</option>`).join('')}</optgroup>` : '';
  }).join('')}`;
  sel.value = app.idx.etapasById.has(app.etapaFiltro) ? app.etapaFiltro : 'todas';
  if (sel.value === 'todas') app.etapaFiltro = 'todas';
  $('#wrapEtapa').classList.toggle('destaque', app.modo === 'etapa');
  const ex = $('#explicaModo');
  ex.textContent = EXPLICA[app.modo];
  ex.classList.toggle('curta', !!app.explicaCurta);
  $('#btnLado').classList.toggle('ativo', app.ladoALado);
  $('#chkSync').checked = app.sincronizar;
  $('#wrapSync').style.display = app.ladoALado ? '' : 'none';
  $('#selRotulos').value = app.rotulos;
  $('#chkSombras').checked = app.sombras;
  $('#selNivel').value = app.nivelSelecao;
  $('#btnMover').classList.toggle('ativo', app.moverAtivo);
  $('#cenaB').classList.toggle('oculto', !app.ladoALado);
  $('#cenas').classList.toggle('duas', app.ladoALado);
  const o = app.obra;
  const avisos = [];
  if (o.arquivada) avisos.push('<b>Obra arquivada.</b> Os dados continuam editáveis; desarquive em “Obras”.');
  if (o.esquematico) avisos.push(`Modelo <b>esquemático</b>: posições e dimensões aproximadas, ajuste em “Posição e propriedades”.${o.config.observacao ? ' ' + esc(o.config.observacao) : ''}`);
  const pend = o.documentos.filter((d) => !d.arquivoId);
  if (pend.length) avisos.push(`${pend.length} documento(s) de referência pendente(s): <button class="link" data-acao="docs">anexar</button>`);
  $('#avisos').innerHTML = avisos.map((a) => `<span>${a}</span>`).join('');
  $('#avisos').style.display = avisos.length ? '' : 'none';
  $('#avisos').classList.toggle('curta', app.avisosCurtos !== false);
  $('#avisos').title = 'Clique para expandir ou recolher';
}

function renderLinhaTempo() {
  const r = $('#rangeMes');
  r.max = String(app.meses.length - 1);
  r.value = String(Math.max(0, app.meses.indexOf(app.mes)));
  $('#rotMes').innerHTML = `<b>${fmtMes(app.mes)}</b>${app.fora.includes(app.mes) ? ' <span class="aviso">fora do período</span>' : ''}`;
  $('#periodo').textContent = `${fmtMes(app.meses[0])} – ${fmtMes(app.meses[app.meses.length - 1])} · ${app.meses.length} meses`;
  const sc = $('#selComp');
  sc.innerHTML = app.meses.map((m) => `<option value="${m}" ${m === app.mesComp ? 'selected' : ''}>${fmtMes(m)}</option>`).join('');
  $('#btnPlay').textContent = app.tocando ? '⏸' : '▶';
  $('#btnPlay').title = app.tocando ? 'Pausar' : 'Reproduzir a evolução mês a mês';
  // marcas de meses com lançamento
  const usados = new Set(Object.keys(app.obra.lancamentos).map((k) => k.split('|')[2]));
  const n = app.meses.length;
  $('#marcasMes').innerHTML = app.meses.map((m, i) => `<i class="${usados.has(m) ? 'com' : ''} ${m === app.mes ? 'atual' : ''} ${m === app.mesComp ? 'comp' : ''}" style="left:${n <= 1 ? 0 : (i / (n - 1)) * 100}%" title="${fmtMes(m)}${usados.has(m) ? ' · com lançamentos' : ''}"></i>`).join('');
}

export function irParaMes(m) {
  if (!app.meses.includes(m)) return;
  const antigo = app.mes;
  app.mes = m;
  if (app.mesComp === m) app.mesComp = antigo !== m ? antigo : app.meses[Math.max(0, app.meses.indexOf(m) - 1)];
  app.coletivo.previa = null;
  app.finalPendente.clear();
  renderTudo();
}

function pararReproducao() {
  if (app.tocando) clearInterval(app.tocando);
  app.tocando = null;
}

function alternarReproducao() {
  if (app.tocando) {
    pararReproducao();
    renderLinhaTempo();
    return;
  }
  if (app.mes === app.meses[app.meses.length - 1]) irParaMes(app.meses[0]);
  app.tocando = setInterval(() => {
    const i = app.meses.indexOf(app.mes);
    if (i >= app.meses.length - 1) { pararReproducao(); renderLinhaTempo(); return; }
    irParaMes(app.meses[i + 1]);
  }, 900);
  renderLinhaTempo();
}

// ---------------------------------------------------------------- caminhada

function mostrarControlesCaminhada(ativo) {
  $('#ctrlFp').classList.toggle('oculto', !ativo);
  $('#btnFp').classList.toggle('ativo', ativo);
  document.body.classList.toggle('caminhando', ativo);
}

function iniciarCaminhada() {
  if (app.ladoALado) { app.ladoALado = false; renderTudo(); }
  app.vA.modoColocar = false;
  $('#dicaColocar').classList.add('oculto');
  app.vA.entrarCaminhada();
  mostrarControlesCaminhada(true);
  app.vA.canvas.focus();
}

// ---------------------------------------------------------------- ligação da interface

function ligarInterface() {
  $('#selObra').onchange = (ev) => abrirObra(ev.target.value);
  $('#btnObras').onclick = () => Modais.modalObras();
  $('#btnEditarObra').onclick = () => Modais.modalEditarObra();
  $('#btnEtapas').onclick = () => Modais.modalEtapas();
  $('#btnDocs').onclick = () => Modais.modalDocumentos();
  $('#btnDados').onclick = () => Modais.modalDados();
  $('#btnAjuda').onclick = () => Modais.modalAjuda();
  document.body.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-acao="docs"]');
    if (b && !b.closest('#editor')) Modais.modalDocumentos();
  });
  $$('[data-modo]').forEach((b) => { b.onclick = () => { app.modo = b.dataset.modo; renderTudo(); }; });
  $('#selEtapa').onchange = (ev) => { app.etapaFiltro = ev.target.value; if (app.modo !== 'etapa') app.modo = 'etapa'; renderTudo(); };
  $('#btnGeral').onclick = () => { app.vA.vistaGeral(); fecharCaminhada(); };
  $('#btnTopo').onclick = () => { app.vA.vistaSuperior(); fecharCaminhada(); };
  $('#btnFp').onclick = () => (app.vA.fp.ativo ? app.vA.sairCaminhada() : iniciarCaminhada());
  $('#btnPersonagem').onclick = () => {
    if (app.vA.fp.ativo) app.vA.sairCaminhada();
    app.vA.modoColocar = !app.vA.modoColocar;
    $('#dicaColocar').classList.toggle('oculto', !app.vA.modoColocar);
    $('#btnPersonagem').classList.toggle('ativo', app.vA.modoColocar);
  };
  $('#btnSairFp').onclick = () => app.vA.sairCaminhada();
  $('#btnCancelarColocar').onclick = () => { app.vA.modoColocar = false; $('#dicaColocar').classList.add('oculto'); $('#btnPersonagem').classList.remove('ativo'); };
  $('#btnLado').onclick = () => {
    app.ladoALado = !app.ladoALado;
    if (app.vA.fp.ativo) app.vA.sairCaminhada();
    renderTudo();
    requestAnimationFrame(() => {
      app.vA.redimensionar();
      app.vB.redimensionar();
      app.vB.aplicarCamera(app.vA.estadoCamera());
    });
  };
  $('#chkSync').onchange = (ev) => { app.sincronizar = ev.target.checked; };
  $('#explicaModo').onclick = () => { app.explicaCurta = !app.explicaCurta; renderBarra(); };
  $('#avisos').onclick = (ev) => { if (ev.target.closest('button')) return; app.avisosCurtos = app.avisosCurtos === false; renderBarra(); };
  $('#selRotulos').onchange = (ev) => { app.rotulos = ev.target.value; reconstruirCena(); };
  $('#chkSombras').onchange = (ev) => { app.sombras = ev.target.checked; app.vA.setSombras(app.sombras); app.vB.setSombras(app.sombras); };
  $('#selNivel').onchange = (ev) => { app.nivelSelecao = ev.target.value; };
  $('#btnMover').onclick = () => {
    app.moverAtivo = !app.moverAtivo;
    app.vA.modoMover = app.moverAtivo;
    toast(app.moverAtivo ? 'Arraste na cena o elemento ou grupo selecionado para reposicioná-lo.' : 'Arraste na cena desligado.');
    renderBarra();
    renderEditor();
  };
  $('#rangeMes').oninput = (ev) => irParaMes(app.meses[Number(ev.target.value)]);
  $('#btnAnt').onclick = () => { const i = app.meses.indexOf(app.mes); if (i > 0) irParaMes(app.meses[i - 1]); };
  $('#btnProx').onclick = () => { const i = app.meses.indexOf(app.mes); if (i < app.meses.length - 1) irParaMes(app.meses[i + 1]); };
  $('#btnHoje').onclick = () => { if (app.meses.includes(mesAtual())) irParaMes(mesAtual()); else toast('O mês atual está fora do período da obra.'); };
  $('#btnPlay').onclick = alternarReproducao;
  $('#selComp').onchange = (ev) => { app.mesComp = ev.target.value; renderTudo(); };
  // controles de caminhada na tela (toque e mouse)
  $$('#ctrlFp [data-mov]').forEach((b) => {
    const k = b.dataset.mov;
    const on = (ev) => { ev.preventDefault(); app.vA.fp.botoes.add(k); b.classList.add('pressionado'); };
    const off = () => { app.vA.fp.botoes.delete(k); b.classList.remove('pressionado'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('pointercancel', off);
  });
  $('#btnCorrer').onclick = () => {
    const f = app.vA.fp.botoes;
    if (f.has('correr')) f.delete('correr'); else f.add('correr');
    $('#btnCorrer').classList.toggle('ativo', f.has('correr'));
  };
  // painéis recolhíveis (telas pequenas)
  $$('[data-painel]').forEach((b) => {
    b.onclick = () => {
      const p = $(b.dataset.painel);
      const abrir = !p.classList.contains('aberto');
      $$('.lateral').forEach((x) => x.classList.remove('aberto'));
      p.classList.toggle('aberto', abrir);
    };
  });
  $$('.lateral .fechar-painel').forEach((b) => { b.onclick = () => b.closest('.lateral').classList.remove('aberto'); });
  $('#btnRecolherEditor').onclick = () => {
    document.body.classList.toggle('editor-recolhido');
    $('#btnRecolherEditor').textContent = document.body.classList.contains('editor-recolhido') ? '▴ Painel de lançamento' : '▾';
    requestAnimationFrame(() => { app.vA.redimensionar(); app.vB.redimensionar(); });
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvarAgora(); });
  window.addEventListener('beforeunload', () => { salvarAgora(); });
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && app.vA.modoColocar) $('#btnCancelarColocar').click();
  });
}

function fecharCaminhada() {
  mostrarControlesCaminhada(false);
}

// ---------------------------------------------------------------- início

async function iniciar() {
  app.sombras = !matchMedia('(pointer: coarse)').matches;
  app.explicaCurta = matchMedia('(max-width: 820px)').matches;
  const sincronizar = (origem) => {
    if (!app.ladoALado || !app.sincronizar) return;
    const alvo = origem === app.vA ? app.vB : app.vA;
    alvo.aplicarCamera(origem.estadoCamera());
  };
  app.vA = new Visualizador($('#cenaA'), {
    aoSelecionar: (id, o) => selecionar(id, { ...o, origem: 'cena' }),
    aoMover: (id, dx, dz) => moverPorArrasto(id, dx, dz),
    aoColocarPersonagem: (x, z) => {
      const p = app.vA.posicionarPersonagem(x, z);
      app.obra.personagem = p;
      salvarDepois();
      $('#btnPersonagem').classList.remove('ativo');
      iniciarCaminhada();
    },
    aoMudarCamera: sincronizar,
    aoSairCaminhada: () => {
      mostrarControlesCaminhada(false);
      app.obra.personagem = { x: app.vA.fp.pos.x, z: app.vA.fp.pos.z };
      salvarDepois();
    },
  });
  app.vB = new Visualizador($('#cenaB'), {
    aoSelecionar: (id, o) => selecionar(id, { ...o, origem: 'cena' }),
    aoMudarCamera: sincronizar,
  });
  app.vA.setSombras(app.sombras);
  app.vB.setSombras(app.sombras);
  ligarInterface();
  ligarArvore();
  ligarIndicadores();
  ligarEditor();

  await recarregarIndice();
  if (!app.indice.length) {
    await S.salvarObra(await novaVillaFlora());
    await recarregarIndice();
  }
  const avisoMigracao = await migrarVillaFloraR02();
  const ultima = await S.meta('ultimaObra');
  const alvo = app.indice.find((o) => o.id === ultima && !o.arquivada) || app.indice.find((o) => !o.arquivada) || app.indice[0];
  await abrirObra(alvo.id);
  $('#carregando').remove();
  const visto = await S.meta('ajudaVista');
  if (!visto) {
    S.meta('ajudaVista', true);
    $('#boasVindas').classList.remove('oculto');
  }
  $('#fecharBoas').onclick = () => $('#boasVindas').classList.add('oculto');
  if (avisoMigracao) toast(avisoMigracao);
}

// Villa Flora II pelo Plano de Ataque R02, com a planta já posicionada como base do 3D.
export async function novaVillaFlora() {
  const vf = M.criarVillaFlora();
  vf.revisoes.push({ id: C.uid('r'), em: new Date().toISOString(), tipo: 'criacao', origem: 'Plano de Ataque R02' });
  try {
    const { VF_PLANTA_JPEG, VF_PLANTA_BASE } = await import('./villaflora-planta.js');
    const blob = await S.dataUrlParaBlob(VF_PLANTA_JPEG);
    const id = C.uid('arq');
    await S.salvarArquivo({ id, obraId: vf.id, nome: 'Plano de Ataque R02 (planta).jpg', mime: 'image/jpeg', blob });
    vf.documentos.unshift({ id: C.uid('doc'), nome: 'Plano de Ataque R02 · planta para o 3D', mime: 'image/jpeg', tamanho: blob.size, arquivoId: id, papel: 'planta', em: new Date().toISOString(), base: { ...VF_PLANTA_BASE, ativo: true } });
  } catch (e) {
    console.warn('planta do Villa Flora não carregada', e);
  }
  return vf;
}

// Obras do Villa Flora II criadas com a distribuição provisória: sem lançamentos,
// são refeitas no lugar; com lançamentos, ficam como estão e uma nova obra R02 é criada ao lado.
async function migrarVillaFloraR02() {
  if (await S.meta('migracaoR02')) return null;
  let msg = null;
  const candidatas = app.indice.filter((x) => /^Villa Flora II/.test(x.nome));
  const legadas = [];
  for (const ind of candidatas) {
    const o = await S.carregarObra(ind.id);
    if (o && !(o.config && o.config.layoutR02)) legadas.push(o);
  }
  let comDados = false;
  for (const o of legadas) {
    const vazia = !Object.keys(o.lancamentos || {}).length && !Object.keys(o.conclusoes || {}).length;
    if (!vazia) { comDados = true; continue; }
    const n = await novaVillaFlora();
    n.id = o.id;
    n.nome = o.nome;
    n.inicio = o.inicio;
    n.termino = o.termino;
    n.arquivada = o.arquivada;
    for (const d of o.documentos || []) {
      if (!d.arquivoId) continue;
      const pend = n.documentos.find((x) => !x.arquivoId && x.nome === d.nome);
      if (pend) Object.assign(pend, { ...d, id: pend.id });
      else n.documentos.push(d);
    }
    await S.salvarObra(n);
    msg = 'Villa Flora II atualizado pelo Plano de Ataque R02: fases, trechos, ranks e numeração reais.';
  }
  if (comDados && !candidatas.some((x) => /R02/.test(x.nome))) {
    const n = await novaVillaFlora();
    n.nome = 'Villa Flora II (Plano de Ataque R02)';
    await S.salvarObra(n);
    msg = 'Criada a obra “Villa Flora II (Plano de Ataque R02)”. A versão anterior foi mantida com seus lançamentos.';
  }
  await S.meta('migracaoR02', true);
  if (msg) await recarregarIndice();
  return msg;
}

// ganchos para testes automatizados e diagnóstico no console
window.__obras3d = { C, M, mutar, irParaMes, selecionar, renderTudo };

iniciar().catch((e) => {
  console.error(e);
  const c = $('#carregando');
  if (c) c.innerHTML = `<p>Erro ao iniciar: ${esc(e.message)}</p>`;
});
