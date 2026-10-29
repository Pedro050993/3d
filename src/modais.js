// Diálogos de gestão: obras, etapas, documentos, dados e ajuda.

import * as C from './calc.js';
import * as M from './model.js';
import * as S from './store.js';
import { fmtMes, mesesEntre, mesDe } from './meses.js';
import { $, $$, esc, num, pct, lerNum, dataHora, tamanho, baixar, nomeArquivo, dialogo, confirmar, toast, escolherArquivo, lerArquivoTexto } from './util.js';
import { gerarXlsx } from './xlsx.js';
import { app, mutar, abrirObra, recarregarIndice, salvarAgora, atualizarPlanta, renderTudo, novaVillaFlora } from './app.js';
import { rotCategoria } from './paineis.js';

// ---------------------------------------------------------------- obras

export async function modalObras() {
  const render = () => {
    const lista = app.indice.filter((o) => app.mostrarArquivadas || !o.arquivada);
    return `<div class="obras-topo"><button class="primario" data-o="nova">+ Nova obra</button>
      <label class="chk-lin"><input type="checkbox" id="verArq" ${app.mostrarArquivadas ? 'checked' : ''}> Mostrar arquivadas</label>
      <button data-o="importar">Importar obra (.json)</button></div>
      <div class="tab-wrap"><table class="tab-mini obras"><thead><tr><th>Obra</th><th>Tipo</th><th>Período</th><th>Elementos</th><th>Atualizada</th><th></th></tr></thead><tbody>
      ${lista.map((o) => `<tr class="${o.id === app.obra?.id ? 'atual' : ''} ${o.arquivada ? 'arq' : ''}">
        <td><b>${esc(o.nome)}</b>${o.arquivada ? ' <span class="chip">arquivada</span>' : ''}${o.id === app.obra?.id ? ' <span class="chip st-execucao">aberta</span>' : ''}</td>
        <td>${esc(M.TIPOS_OBRA[o.tipo] || o.tipo)}</td><td>${fmtMes(mesDe(o.inicio))} – ${fmtMes(mesDe(o.termino))}</td><td class="n">${o.nElem ?? ''}</td><td>${dataHora(o.atualizadoEm)}</td>
        <td class="acoes"><button data-o="abrir" data-id="${o.id}">Abrir</button><button data-o="editar" data-id="${o.id}">Editar</button><button data-o="duplicar" data-id="${o.id}">Duplicar</button>
          <button data-o="arquivar" data-id="${o.id}">${o.arquivada ? 'Desarquivar' : 'Arquivar'}</button></td></tr>`).join('')}
      </tbody></table></div><p class="dica">Cada obra guarda seus próprios dados. Arquivar tira a obra da lista principal sem apagar nada.</p>`;
  };
  let fundoRef = null;
  const ligar = (d) => {
    fundoRef = d;
    d.querySelector('#verArq').onchange = (ev) => { app.mostrarArquivadas = ev.target.checked; d.querySelector('.dlg-corpo').innerHTML = render(); ligar(d); };
    d.querySelectorAll('[data-o]').forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.id;
        const o = b.dataset.o;
        if (o === 'nova') { d.querySelector('[data-x]').click(); return modalNovaObra(); }
        if (o === 'importar') { d.querySelector('[data-x]').click(); return importarObra(); }
        if (o === 'abrir') { d.querySelector('[data-x]').click(); return abrirObra(id); }
        if (o === 'editar') { d.querySelector('[data-x]').click(); if (id !== app.obra.id) await abrirObra(id); return modalEditarObra(); }
        if (o === 'duplicar') { d.querySelector('[data-x]').click(); return modalDuplicar(id); }
        if (o === 'arquivar') {
          const ob = id === app.obra.id ? app.obra : await S.carregarObra(id);
          ob.arquivada = !ob.arquivada;
          if (id === app.obra.id) mutar(() => {}, { estrutura: true });
          else await S.salvarObra(ob);
          await recarregarIndice();
          d.querySelector('.dlg-corpo').innerHTML = render();
          ligar(d);
          renderTudo({ cena: false });
        }
      };
    });
  };
  await dialogo({ titulo: 'Obras cadastradas', html: render(), largura: 920, aoAbrir: ligar, botoes: [{ rotulo: 'Fechar', valor: null, classe: 'primario' }] });
  return fundoRef;
}

function camposGerador(tipo) {
  if (tipo === 'condominio') return `<div class="form-grid">
    <label class="campo"><span>Fases</span><input id="gFases" type="number" min="1" value="3"></label>
    <label class="campo"><span>Ranks por fase (separe por vírgula)</span><input id="gRanks" value="8, 8, 8"></label>
    <label class="campo"><span>Casas por rank</span><input id="gCasas" type="number" min="1" value="3"></label>
    <label class="campo"><span>Ranks por fileira</span><input id="gFil" type="number" min="1" value="10"></label>
    <label class="campo"><span>Largura da casa (m)</span><input id="gW" type="number" step="any" value="7"></label>
    <label class="campo"><span>Profundidade da casa (m)</span><input id="gD" type="number" step="any" value="11"></label>
    <label class="chk-lin"><input type="checkbox" id="gAnexos" checked> Criar áreas comuns padrão</label>
    <label class="chk-lin"><input type="checkbox" id="gRuas" checked> Criar ruas</label>
    <label class="chk-lin"><input type="checkbox" id="gQuadras"> Agrupar ranks em quadras</label></div>`;
  if (tipo === 'edificio') return `<div class="form-grid">
    <label class="campo"><span>Torres</span><input id="gTorres" type="number" min="1" value="1"></label>
    <label class="campo"><span>Pavimentos (com térreo)</span><input id="gPav" type="number" min="1" value="10"></label>
    <label class="campo"><span>Apartamentos por pavimento</span><input id="gAptos" type="number" min="1" value="4"></label>
    <label class="campo"><span>Pé-direito (m)</span><input id="gPd" type="number" step="any" value="2.9"></label>
    <label class="chk-lin"><input type="checkbox" id="gAnexos" checked> Criar áreas comuns padrão</label></div>`;
  if (tipo === 'loteamento') return `<div class="form-grid">
    <label class="campo"><span>Setores</span><input id="gSet" type="number" min="1" value="2"></label>
    <label class="campo"><span>Quadras por setor</span><input id="gQd" type="number" min="1" value="4"></label>
    <label class="campo"><span>Lotes por quadra</span><input id="gLotes" type="number" min="1" value="20"></label>
    <label class="campo"><span>Frente do lote (m)</span><input id="gFr" type="number" step="any" value="10"></label>
    <label class="campo"><span>Fundo do lote (m)</span><input id="gFu" type="number" step="any" value="25"></label></div>`;
  return `<div class="form-grid">
    <label class="campo"><span>Setores</span><input id="gSet" type="number" min="1" value="2"></label>
    <label class="campo"><span>Blocos por setor</span><input id="gBl" type="number" min="1" value="3"></label>
    <label class="campo"><span>Frentes por bloco</span><input id="gFr" type="number" min="1" value="2"></label></div>`;
}

export async function modalNovaObra() {
  const hoje = new Date();
  const ini = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const fim = `${hoje.getFullYear() + 2}-${String(hoje.getMonth() + 1).padStart(2, '0')}-28`;
  const r = await dialogo({
    titulo: 'Nova obra',
    largura: 680,
    html: `<div class="form-grid">
      <label class="campo largo"><span>Nome</span><input id="nNome" placeholder="ex.: Residencial Jardim das Flores"></label>
      <label class="campo"><span>Tipo</span><select id="nTipo">${Object.entries(M.TIPOS_OBRA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="campo"><span>Início</span><input id="nIni" type="date" value="${ini}"></label>
      <label class="campo"><span>Término</span><input id="nFim" type="date" value="${fim}"></label>
      <label class="campo largo"><span>Descrição</span><textarea id="nDesc" rows="2"></textarea></label></div>
      <h4>Estrutura inicial</h4>
      <label class="radio"><input type="radio" name="nEst" value="gerar" checked> Gerar automaticamente</label>
      <label class="radio"><input type="radio" name="nEst" value="vazia"> Começar vazia (cadastro manual)</label>
      <label class="radio"><input type="radio" name="nEst" value="villa"> Usar o Villa Flora II pelo Plano de Ataque R02 (66 ranks × 3 casas, 3 fases, 18 trechos)</label>
      <div id="nGer">${camposGerador('condominio')}</div>
      <p class="dica">A obra nova começa com avanços zerados. Etapas, quantidades e posições podem ser ajustadas depois.</p><p class="erro" id="dlgErro"></p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Criar obra', valor: 'ok' }],
    aoAbrir: (d) => {
      d.querySelector('#nTipo').onchange = (ev) => { d.querySelector('#nGer').innerHTML = camposGerador(ev.target.value); };
      $$('input[name=nEst]', d).forEach((x) => { x.onchange = () => { d.querySelector('#nGer').style.display = x.value === 'gerar' && x.checked ? '' : x.checked ? 'none' : d.querySelector('#nGer').style.display; }; });
    },
    coletar: (d) => {
      const g = (id) => d.querySelector(id)?.value;
      const erro = (t) => { d.querySelector('#dlgErro').textContent = t; return false; };
      const nome = g('#nNome').trim();
      if (!nome) return erro('Informe o nome da obra.');
      if (!g('#nIni') || !g('#nFim')) return erro('Informe início e término.');
      if (g('#nFim') < g('#nIni')) return erro('O término deve ser depois do início.');
      const est = d.querySelector('input[name=nEst]:checked').value;
      const tipo = g('#nTipo');
      const p = {};
      if (est === 'gerar') {
        if (tipo === 'condominio') {
          p.fases = Number(g('#gFases'));
          p.ranksPorFase = g('#gRanks').split(/[;,\s]+/).filter(Boolean).map(Number);
          p.casasPorRank = Number(g('#gCasas'));
          p.ranksPorFileira = Number(g('#gFil'));
          p.larguraCasa = lerNum(g('#gW'));
          p.profCasa = lerNum(g('#gD'));
          p.comAnexos = d.querySelector('#gAnexos').checked;
          p.comRuas = d.querySelector('#gRuas').checked;
          p.quadras = d.querySelector('#gQuadras').checked;
          if (!(p.fases >= 1) || p.ranksPorFase.some((x) => !(x >= 0)) || !(p.casasPorRank >= 1)) return erro('Revise fases, ranks e casas por rank.');
          const tot = p.ranksPorFase.slice(0, p.fases).reduce((a, b) => a + b, 0) * p.casasPorRank;
          if (tot > 3000) return erro('Limite de 3000 unidades por geração.');
        } else if (tipo === 'edificio') {
          p.torres = Number(g('#gTorres')); p.pavimentos = Number(g('#gPav')); p.aptosPorPav = Number(g('#gAptos')); p.peDireito = lerNum(g('#gPd')); p.comAnexos = d.querySelector('#gAnexos').checked;
          if (p.torres * p.pavimentos * p.aptosPorPav > 3000) return erro('Limite de 3000 unidades por geração.');
        } else if (tipo === 'loteamento') {
          p.setores = Number(g('#gSet')); p.quadrasPorSetor = Number(g('#gQd')); p.lotesPorQuadra = Number(g('#gLotes')); p.frente = lerNum(g('#gFr')); p.fundo = lerNum(g('#gFu'));
          if (p.setores * p.quadrasPorSetor * p.lotesPorQuadra > 3000) return erro('Limite de 3000 lotes por geração.');
        } else {
          p.setores = Number(g('#gSet')); p.blocosPorSetor = Number(g('#gBl')); p.frentesPorBloco = Number(g('#gFr'));
        }
      }
      return { nome, tipo, ini: g('#nIni'), fim: g('#nFim'), desc: g('#nDesc'), est, p };
    },
  });
  if (!r) return;
  let o;
  if (r.est === 'villa') {
    o = await novaVillaFlora();
    o.nome = r.nome;
    o.inicio = r.ini;
    o.termino = r.fim;
    if (r.desc) o.descricao = r.desc;
  } else {
    o = M.obraVazia({ nome: r.nome, tipo: r.tipo, descricao: r.desc, inicio: r.ini, termino: r.fim });
    if (r.est === 'gerar') {
      if (r.tipo === 'condominio') M.gerarCondominio(o, r.p);
      else if (r.tipo === 'edificio') M.gerarEdificio(o, r.p);
      else if (r.tipo === 'loteamento') M.gerarLoteamento(o, r.p);
      else M.gerarOutro(o, r.p);
    } else {
      o.etapas = M.criarEtapas(r.tipo === 'edificio' ? M.ETAPAS_APTO : r.tipo === 'loteamento' ? M.ETAPAS_LOTE : M.ETAPAS_CASA);
    }
  }
  o.revisoes.push({ id: C.uid('r'), em: new Date().toISOString(), tipo: 'criacao' });
  await S.salvarObra(o);
  await recarregarIndice();
  await abrirObra(o.id);
  toast(`Obra “${o.nome}” criada com ${o.elementos.filter(C.ehFolha).length} elementos e avanços zerados.`);
}

export async function modalEditarObra() {
  const o = app.obra;
  const r = await dialogo({
    titulo: `Editar obra: ${o.nome}`,
    largura: 640,
    html: `<div class="form-grid">
      <label class="campo largo"><span>Nome</span><input id="eNome" value="${esc(o.nome)}"></label>
      <label class="campo"><span>Tipo</span><select id="eTipo">${Object.entries(M.TIPOS_OBRA).map(([k, v]) => `<option value="${k}" ${k === o.tipo ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="campo"><span>Início</span><input id="eIni" type="date" value="${esc(o.inicio)}"></label>
      <label class="campo"><span>Término</span><input id="eFim" type="date" value="${esc(o.termino)}"></label>
      <label class="campo"><span>Casas por rank (padrão para novos ranks)</span><input id="eCpr" type="number" min="1" value="${o.config.casasPorRank || 3}"></label>
      <label class="campo largo"><span>Descrição</span><textarea id="eDesc" rows="3">${esc(o.descricao)}</textarea></label>
      <label class="campo largo"><span>Observações de configuração</span><textarea id="eObs" rows="2">${esc(o.config.observacao || '')}</textarea></label>
      <label class="chk-lin largo"><input type="checkbox" id="eEsq" ${o.esquematico ? 'checked' : ''}> Modelo esquemático (a documentação não permite reprodução exata; posições a conferir)</label></div>
      <p class="dica">Mudar as datas ajusta a linha do tempo. Lançamentos fora do novo período continuam guardados e aparecem marcados.</p><p class="erro" id="dlgErro"></p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar', valor: 'ok' }],
    coletar: (d) => {
      const g = (id) => d.querySelector(id).value;
      if (!g('#eNome').trim()) { d.querySelector('#dlgErro').textContent = 'Informe o nome.'; return false; }
      if (g('#eFim') < g('#eIni')) { d.querySelector('#dlgErro').textContent = 'O término deve ser depois do início.'; return false; }
      return { nome: g('#eNome').trim(), tipo: g('#eTipo'), ini: g('#eIni'), fim: g('#eFim'), cpr: Number(g('#eCpr')) || 3, desc: g('#eDesc'), obs: g('#eObs'), esq: d.querySelector('#eEsq').checked };
    },
  });
  if (!r) return;
  mutar((ob) => {
    ob.nome = r.nome; ob.tipo = r.tipo; ob.inicio = r.ini; ob.termino = r.fim; ob.descricao = r.desc; ob.esquematico = r.esq;
    ob.config.casasPorRank = r.cpr; ob.config.observacao = r.obs;
  }, { estrutura: true, periodo: true });
  await salvarAgora();
  await recarregarIndice();
  renderTudo();
  const { fora } = C.mesesDaObra(app.obra);
  toast(fora.length ? `Período atualizado. ${fora.length} mês(es) com lançamento ficaram fora do período e foram mantidos.` : 'Obra atualizada.');
}

export async function modalDuplicar(id) {
  const orig = id === app.obra.id ? app.obra : await S.carregarObra(id);
  const r = await dialogo({
    titulo: `Duplicar ${orig.nome}`,
    html: `<label class="campo"><span>Nome da nova obra</span><input id="dNome" value="${esc(orig.nome)} (cópia)"></label>
      <label class="chk-lin"><input type="checkbox" id="dAv"> Copiar também os avanços, conclusões e histórico</label>
      <label class="chk-lin"><input type="checkbox" id="dDoc" checked> Copiar documentos anexados</label>
      <p class="dica">A estrutura, as etapas, as quantidades e o modelo são sempre copiados. A cópia é independente: lançar nela não altera a original.</p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Duplicar', valor: 'ok' }],
    coletar: (d) => ({ nome: d.querySelector('#dNome').value.trim() || `${orig.nome} (cópia)`, av: d.querySelector('#dAv').checked, doc: d.querySelector('#dDoc').checked }),
  });
  if (!r) return;
  await salvarAgora();
  const { obra } = M.duplicarObra(orig, { nome: r.nome, copiarAvancos: r.av, copiarDocs: r.doc });
  for (const d of obra.documentos) {
    if (d.copiarDe) {
      const a = await S.lerArquivo(d.copiarDe);
      if (a) {
        d.arquivoId = C.uid('arq');
        await S.salvarArquivo({ id: d.arquivoId, obraId: obra.id, nome: a.nome, mime: a.mime, blob: a.blob });
      } else d.arquivoId = null;
      delete d.copiarDe;
    }
    if (d.renderId) {
      const a = await S.lerArquivo(d.renderId);
      if (a) {
        d.renderId = C.uid('arq');
        await S.salvarArquivo({ id: d.renderId, obraId: obra.id, nome: a.nome, mime: a.mime, blob: a.blob });
      } else d.renderId = null;
    }
  }
  await S.salvarObra(obra);
  await recarregarIndice();
  await abrirObra(obra.id);
  toast(`Obra duplicada ${r.av ? 'com' : 'sem'} avanços.`);
}

// ---------------------------------------------------------------- etapas

export async function modalEtapas() {
  // edição sobre uma cópia; só grava ao salvar
  let ets = JSON.parse(JSON.stringify(app.obra.etapas)).sort((a, b) => a.ordem - b.ordem);
  const usadas = new Set(Object.keys(app.obra.lancamentos).map((k) => k.split('|')[1]));
  const corpo = () => {
    const blocos = Object.entries(M.GRUPOS_ETAPA).map(([g, nomeG]) => {
      const lista = ets.filter((x) => x.grupo === g);
      const somaPeso = lista.reduce((a, x) => a + (Number(x.peso) || 0), 0);
      return `<div class="et-grupo"><h4>${nomeG} <small>${lista.length} etapa(s) · soma dos pesos ${num(somaPeso, 0)}</small></h4>
      <table class="tab-mini etapas"><thead><tr><th></th><th>Nome</th><th>Unidade</th><th>Qtd. padrão</th><th>Peso</th><th>Representação 3D</th><th></th></tr></thead><tbody>
      ${lista.map((x) => `<tr data-id="${x.id}">
        <td class="ord"><button class="mini" data-m="up" title="Subir">▲</button><button class="mini" data-m="dn" title="Descer">▼</button></td>
        <td><input data-f="nome" value="${esc(x.nome)}"></td>
        <td><select data-f="unidade">${M.UNIDADES.map((u) => `<option ${u === x.unidade ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
        <td><input data-f="qtdPadrao" inputmode="decimal" value="${num(x.qtdPadrao, 2)}" ${x.unidade === '%' ? 'disabled' : ''}></td>
        <td><input data-f="peso" inputmode="decimal" value="${num(x.peso, 1)}" style="width:60px"></td>
        <td><select data-f="visual">${Object.entries(M.VISUAIS).map(([k, v]) => `<option value="${k}" ${k === x.visual ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
        <td><button class="mini perigo" data-m="del" title="Remover">✕</button>${usadas.has(x.id) ? '<small title="tem lançamentos">●</small>' : ''}</td></tr>`).join('')}
      </tbody></table>
      <div class="mini-acoes"><button class="link" data-add="${g}">+ etapa em ${nomeG.toLowerCase()}</button>
        ${g === 'unidade' ? '<button class="link" data-mod="casa">carregar modelo de casas</button> <button class="link" data-mod="apto">modelo de apartamentos</button> <button class="link" data-mod="lote">modelo de lotes</button>' : ''}
        ${g === 'anexo' ? '<button class="link" data-mod="anexo">carregar modelo de áreas comuns</button>' : ''}
        ${g === 'infra' ? '<button class="link" data-mod="infra">carregar modelo de infraestrutura (pavimentação, drenagem, água, esgoto...)</button>' : ''}</div></div>`;
    }).join('');
    return `${blocos}<p class="dica">O peso define a participação da etapa no avanço do elemento. Unidade diferente de % permite lançar por quantidade (ex.: m² de pavimento); o total de cada elemento é ajustado em “Posição e propriedades”. Etapas com ● já têm lançamentos.</p>`;
  };
  const ligar = (d) => {
    const ref = () => ligar(d);
    d.querySelectorAll('tr[data-id] [data-f]').forEach((i) => {
      i.onchange = () => {
        const x = ets.find((y) => y.id === i.closest('tr').dataset.id);
        const f = i.dataset.f;
        if (f === 'peso' || f === 'qtdPadrao') x[f] = lerNum(i.value);
        else x[f] = i.value;
        if (f === 'unidade') { d.querySelector('.dlg-corpo').innerHTML = corpo(); ref(); }
      };
    });
    d.querySelectorAll('[data-m]').forEach((b) => {
      b.onclick = async () => {
        const id = b.closest('tr').dataset.id;
        const x = ets.find((y) => y.id === id);
        const lista = ets.filter((y) => y.grupo === x.grupo);
        const i = lista.indexOf(x);
        if (b.dataset.m === 'del') {
          if (usadas.has(id) && !(await confirmar('Remover etapa com lançamentos', `A etapa “${esc(x.nome)}” tem lançamentos. Ao salvar, eles serão apagados. Continuar?`, 'Remover', true))) return;
          ets = ets.filter((y) => y.id !== id);
        } else {
          const j = b.dataset.m === 'up' ? i - 1 : i + 1;
          if (j < 0 || j >= lista.length) return;
          [lista[i].ordem, lista[j].ordem] = [lista[j].ordem, lista[i].ordem];
          if (lista[i].ordem === lista[j].ordem) lista[j].ordem += b.dataset.m === 'up' ? -0.5 : 0.5;
          ets.sort((a, c) => a.ordem - c.ordem);
        }
        d.querySelector('.dlg-corpo').innerHTML = corpo();
        ref();
      };
    });
    d.querySelectorAll('[data-add]').forEach((b) => {
      b.onclick = () => {
        const g = b.dataset.add;
        const maxOrd = ets.reduce((m, x) => Math.max(m, x.ordem), 0);
        ets.push({ id: C.uid('et'), nome: 'Nova etapa', grupo: g, unidade: '%', qtdPadrao: 100, peso: 5, visual: 'generico', ordem: maxOrd + 1 });
        d.querySelector('.dlg-corpo').innerHTML = corpo();
        ref();
      };
    });
    d.querySelectorAll('[data-mod]').forEach((b) => {
      b.onclick = async () => {
        const mod = { casa: M.ETAPAS_CASA, apto: M.ETAPAS_APTO, lote: M.ETAPAS_LOTE, anexo: M.ETAPAS_ANEXO, infra: M.ETAPAS_INFRA }[b.dataset.mod];
        const g = mod[0].grupo;
        const atuais = ets.filter((x) => x.grupo === g);
        const comLanc = atuais.filter((x) => usadas.has(x.id));
        const subst = atuais.length && (await confirmar('Carregar modelo', `Substituir as ${atuais.length} etapa(s) atuais de ${M.GRUPOS_ETAPA[g].toLowerCase()} pelo modelo?${comLanc.length ? ` ${comLanc.length} delas têm lançamentos, que serão apagados ao salvar.` : ''} Cancelar acrescenta as etapas que faltam sem remover nada.`, 'Substituir', comLanc.length > 0));
        const maxOrd = ets.reduce((m, x) => Math.max(m, x.ordem), 0);
        if (subst) ets = ets.filter((x) => x.grupo !== g);
        const nomes = new Set(ets.filter((x) => x.grupo === g).map((x) => x.nome));
        M.criarEtapas(mod).forEach((x, i) => { if (!nomes.has(x.nome)) ets.push({ ...x, ordem: maxOrd + 1 + i }); });
        d.querySelector('.dlg-corpo').innerHTML = corpo();
        ref();
      };
    });
  };
  const r = await dialogo({ titulo: 'Etapas da obra', html: corpo(), largura: 980, aoAbrir: ligar, botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Salvar etapas', valor: 'ok' }], coletar: () => {
    for (const x of ets) {
      if (!String(x.nome).trim()) { toast('Há etapa sem nome.', 'erro'); return false; }
      if (!Number.isFinite(x.peso) || x.peso < 0) { toast(`Peso inválido em ${x.nome}.`, 'erro'); return false; }
      if (x.unidade !== '%' && !(x.qtdPadrao > 0)) { toast(`Quantidade padrão inválida em ${x.nome}.`, 'erro'); return false; }
    }
    return 'ok';
  } });
  if (!r) return;
  const ids = new Set(ets.map((x) => x.id));
  ets.forEach((x, i) => { x.ordem = i + 1; });
  mutar((o) => {
    o.etapas = ets;
    for (const k of Object.keys(o.lancamentos)) if (!ids.has(k.split('|')[1])) delete o.lancamentos[k];
    for (const e of o.elementos) {
      e.etapasExcluidas = e.etapasExcluidas.filter((id) => ids.has(id));
      for (const k of Object.keys(e.quantidades)) if (!ids.has(k)) delete e.quantidades[k];
      if (e.classe === 'anexo' && M.EXCLUSOES_POR_FORMA[e.forma]) {
        // novas etapas de áreas comuns: aplica as exclusões padrão da forma só às etapas recém-criadas
        for (const x of ets) if (x.grupo === 'anexo' && !app.obra.etapas.some((y) => y.id === x.id) && M.EXCLUSOES_POR_FORMA[e.forma].includes(x.nome)) e.etapasExcluidas.push(x.id);
      }
    }
    o.revisoes.push({ id: C.uid('r'), em: new Date().toISOString(), tipo: 'etapas', qtd: ets.length });
  }, { estrutura: true });
  toast('Etapas atualizadas.');
}

// ---------------------------------------------------------------- documentos

export async function modalDocumentos() {
  const corpo = () => {
    const docs = app.obra.documentos;
    return `<p class="dica">Documentos anexados são referência (plantas, implantação, plano de ataque). Eles não entram no avanço: guarita, piscina e salão de festas são elementos construídos e ficam em “Áreas comuns”.</p>
      <div class="obras-topo"><button class="primario" data-d="add">+ Anexar arquivos</button><span class="dica">PDF, imagens (PNG/JPG) ou outros. Ficam guardados neste navegador, junto da obra.</span></div>
      <table class="tab-mini docs"><thead><tr><th>Documento</th><th>Tamanho</th><th>Situação</th><th>Planta de base no 3D</th><th></th></tr></thead><tbody>
      ${docs.map((d) => `<tr data-id="${d.id}">
        <td><b>${esc(d.nome)}</b><small>${esc(d.mime || '')}</small></td><td>${tamanho(d.tamanho)}</td>
        <td>${d.arquivoId ? 'anexado' : '<span class="aviso">pendente: anexe o arquivo</span>'}</td>
        <td>${d.arquivoId && /pdf|image/.test(d.mime || '') ? `<label class="chk-lin"><input type="checkbox" data-d="base" ${d.base?.ativo ? 'checked' : ''}> usar como planta</label>` : '<small>–</small>'}</td>
        <td class="acoes">${d.arquivoId ? '<button data-d="abrir">Abrir</button>' : '<button data-d="anexar">Anexar</button>'}<button data-d="ren">Renomear</button><button class="perigo" data-d="del">Remover</button></td></tr>
        ${d.base?.ativo ? `<tr class="base-cfg" data-id="${d.id}"><td colspan="5"><div class="linha-campos">
          <label class="campo"><span>Centro X (m)</span><input data-b="x" value="${num(d.base.x || 0, 1)}"></label>
          <label class="campo"><span>Centro Z (m)</span><input data-b="z" value="${num(d.base.z || 0, 1)}"></label>
          <label class="campo"><span>Largura real (m)</span><input data-b="largura" value="${num(d.base.largura || 200, 1)}"></label>
          <label class="campo"><span>Rotação (°)</span><input data-b="rot" value="${num(d.base.rot || 0, 1)}"></label>
          <label class="campo"><span>Opacidade</span><input data-b="opacidade" type="range" min="0.1" max="1" step="0.05" value="${d.base.opacidade ?? 0.85}"></label>
          ${/pdf/.test(d.mime) ? `<label class="campo"><span>Página do PDF</span><input data-b="pagina" type="number" min="1" value="${d.base.pagina || 1}"></label>` : ''}
          </div><small>Use a planta para conferir e ajustar a posição dos elementos. Para PDF, a página é convertida em imagem na primeira vez (requer internet para carregar o leitor de PDF).</small></td></tr>` : ''}`).join('')}
      </tbody></table>`;
  };
  const ligar = (d) => {
    const ref = () => { d.querySelector('.dlg-corpo').innerHTML = corpo(); ligar(d); };
    d.querySelectorAll('[data-d]').forEach((b) => {
      const tr = b.closest('tr');
      const doc = tr ? app.obra.documentos.find((x) => x.id === tr.dataset.id) : null;
      const ev = b.type === 'checkbox' ? 'onchange' : 'onclick';
      b[ev] = async () => {
        const a = b.dataset.d;
        if (a === 'add') {
          const fs = await escolherArquivo('', true);
          for (const f of fs) await anexar(f, null);
          return ref();
        }
        if (a === 'anexar') {
          const [f] = await escolherArquivo(/pdf/i.test(doc.nome) ? 'application/pdf' : '', false);
          if (f) await anexar(f, doc);
          return ref();
        }
        if (a === 'abrir') {
          const arq = await S.lerArquivo(doc.arquivoId);
          if (!arq) return toast('Arquivo não encontrado neste navegador.', 'erro');
          const url = URL.createObjectURL(arq.blob);
          let w = null;
          try { w = window.open(url, '_blank'); } catch { w = null; }
          if (!w) await baixar(doc.nome, arq.blob);
          return;
        }
        if (a === 'ren') {
          const { perguntar } = await import('./util.js');
          const n = await perguntar('Renomear documento', 'Nome', doc.nome, true);
          if (n) mutar(() => { doc.nome = n; }, { estrutura: false });
          return ref();
        }
        if (a === 'del') {
          if (!(await confirmar('Remover documento', `Remover “${esc(doc.nome)}” desta obra? Os elementos e avanços não são afetados.`, 'Remover', true))) return;
          if (doc.arquivoId) await S.excluirArquivo(doc.arquivoId);
          if (doc.renderId) await S.excluirArquivo(doc.renderId);
          mutar((o) => { o.documentos = o.documentos.filter((x) => x.id !== doc.id); }, { estrutura: false });
          await atualizarPlanta();
          return ref();
        }
        if (a === 'base') {
          mutar((o) => {
            for (const x of o.documentos) if (x.id !== doc.id && x.base) x.base.ativo = false;
            const c = app.vA.centro || { x: 0, z: 0 };
            doc.base = { x: Math.round(c.x), z: Math.round(c.z), largura: Math.round((app.vA.raioCena || 100) * 2), rot: 0, opacidade: 0.85, pagina: 1, ...(doc.base || {}), ativo: b.checked };
          }, { estrutura: false });
          await atualizarPlanta();
          return ref();
        }
      };
    });
    d.querySelectorAll('[data-b]').forEach((i) => {
      i.onchange = async () => {
        const doc = app.obra.documentos.find((x) => x.id === i.closest('tr').dataset.id);
        const v = lerNum(i.value);
        if (!Number.isFinite(v)) return;
        mutar(() => {
          doc.base[i.dataset.b] = v;
          if (i.dataset.b === 'pagina') doc.renderId = null;
        }, { estrutura: false });
        await atualizarPlanta();
      };
    });
  };
  await dialogo({ titulo: 'Plantas e documentos da obra', html: corpo(), largura: 940, aoAbrir: ligar, botoes: [{ rotulo: 'Fechar', valor: null, classe: 'primario' }] });
  renderTudo({ cena: false });
}

async function anexar(f, doc) {
  const id = C.uid('arq');
  await S.salvarArquivo({ id, obraId: app.obra.id, nome: f.name, mime: f.type, blob: f });
  mutar((o) => {
    if (doc) {
      if (doc.arquivoId) S.excluirArquivo(doc.arquivoId);
      doc.arquivoId = id; doc.mime = f.type || doc.mime; doc.tamanho = f.size; doc.pendente = false; doc.renderId = null;
      doc.nomeOriginal = f.name;
    } else {
      // um arquivo com o mesmo nome de um documento pendente preenche esse documento
      const pend = o.documentos.find((x) => !x.arquivoId && x.nome === f.name);
      if (pend) { pend.arquivoId = id; pend.mime = f.type || pend.mime; pend.tamanho = f.size; pend.pendente = false; }
      else o.documentos.push({ id: C.uid('doc'), nome: f.name, mime: f.type, tamanho: f.size, arquivoId: id, papel: 'documento', em: new Date().toISOString(), base: null });
    }
  }, { estrutura: false });
  toast(`“${f.name}” anexado à obra ${app.obra.nome}.`);
}

// ---------------------------------------------------------------- dados

export async function modalDados() {
  const a = C.alcanceLimpeza(app.obra);
  const modo = await S.modoArmazenamento();
  await dialogo({
    titulo: `Dados de ${app.obra.nome}`,
    largura: 720,
    html: `<div class="dados-grid">
      <div class="dados-bloco"><h4>Cópia completa da obra</h4><p>Estrutura, datas, etapas, lançamentos, conclusões, histórico e (opcional) documentos, em um arquivo .json.</p>
        <label class="chk-lin"><input type="checkbox" id="xDocs" checked> Incluir documentos anexados</label>
        <button class="primario" data-x="exp">Exportar obra</button></div>
      <div class="dados-bloco"><h4>Importar obra</h4><p>Carrega um arquivo exportado por este aplicativo. Você escolhe se entra como obra nova ou substitui uma existente com o mesmo identificador.</p>
        <button data-x="imp">Importar .json</button></div>
      <div class="dados-bloco"><h4>Planilhas para conferência</h4><p>Excel (.xlsx) com resumo, elementos, etapas, lançamentos, avanço por elemento no mês ${fmtMes(app.mes)}, evolução mensal, conclusões e alterações.</p>
        <button data-x="xlsx">Baixar planilha .xlsx</button></div>
      <div class="dados-bloco perigo-bloco"><h4>Limpar avanços desta obra</h4>
        <p>Apaga <b>${a.nLanc}</b> lançamento(s) em <b>${a.nMeses}</b> mês(es) de <b>${a.nElems}</b> elemento(s), <b>${a.nConc}</b> registro(s) de conclusão e o histórico de alterações. Mantém estrutura, modelo 3D, etapas, documentos e configurações. Outras obras não são afetadas.</p>
        <button class="perigo" data-x="limpar" ${a.nLanc + a.nConc ? '' : 'disabled'}>Limpar avanços…</button></div>
    </div><p class="dica">Os dados ficam gravados automaticamente neste navegador (${modo}). Exporte cópias periódicas para guardar fora dele ou levar para outro computador.</p>`,
    botoes: [{ rotulo: 'Fechar', valor: null, classe: 'primario' }],
    aoAbrir: (d) => {
      d.querySelector('[data-x=exp]').onclick = () => exportarObra(d.querySelector('#xDocs').checked);
      d.querySelector('[data-x=imp]').onclick = () => { d.querySelector('.fechar').click(); importarObra(); };
      d.querySelector('[data-x=xlsx]').onclick = () => exportarXlsx();
      d.querySelector('[data-x=limpar]').onclick = async () => { d.querySelector('.fechar').click(); await limparObra(); };
    },
  });
}

export async function pacoteObra(incluirDocs = true) {
  await salvarAgora();
  const o = JSON.parse(JSON.stringify(app.obra));
  const arquivos = [];
  if (incluirDocs) {
    for (const d of o.documentos) {
      for (const k of ['arquivoId', 'renderId']) {
        if (!d[k]) continue;
        const a = await S.lerArquivo(d[k]);
        if (a) arquivos.push({ id: d[k], nome: a.nome, mime: a.mime, dataUrl: await S.blobParaDataUrl(a.blob) });
      }
    }
  }
  return { formato: 'obras3d', versao: 1, exportadoEm: new Date().toISOString(), obra: o, arquivos };
}

export async function exportarObra(incluirDocs = true) {
  const p = await pacoteObra(incluirDocs);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const ok = await baixar(`${nomeArquivo(app.obra.nome)}_${stamp}.json`, new Blob([JSON.stringify(p)], { type: 'application/json' }));
  if (ok) toast('Cópia da obra exportada.');
  return ok;
}

export async function importarObra(arquivoDado) {
  const f = arquivoDado || (await escolherArquivo('.json,application/json'))[0];
  if (!f) return;
  let p;
  try {
    p = JSON.parse(await lerArquivoTexto(f));
  } catch {
    return toast('Arquivo inválido: não é um JSON.', 'erro');
  }
  const obraImp = p && p.formato === 'obras3d' ? p.obra : p && p.elementos && p.etapas ? p : null;
  if (!obraImp || !Array.isArray(obraImp.elementos)) return toast('O arquivo não contém uma obra deste aplicativo.', 'erro');
  M.normalizar(obraImp);
  const existe = app.indice.find((x) => x.id === obraImp.id);
  let modo = 'nova';
  if (existe) {
    modo = await dialogo({
      titulo: 'Importar obra',
      html: `<p>Já existe a obra <b>${esc(existe.nome)}</b> com o mesmo identificador.</p><p>Substituir troca todos os dados dela pelos do arquivo. Importar como nova mantém as duas.</p>`,
      botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Substituir a existente', valor: 'subst', classe: 'perigo' }, { rotulo: 'Importar como nova', valor: 'nova' }],
    });
    if (!modo) return;
  }
  let obra = obraImp;
  if (modo === 'nova' && existe) {
    obra = M.duplicarObra(obraImp, { nome: `${obraImp.nome} (importada)`, copiarAvancos: true, copiarDocs: true }).obra;
    obra.revisoes = obraImp.revisoes.concat([{ id: C.uid('r'), em: new Date().toISOString(), tipo: 'importacao', arquivo: f.name }]);
  } else {
    obra.revisoes.push({ id: C.uid('r'), em: new Date().toISOString(), tipo: 'importacao', arquivo: f.name });
  }
  // arquivos: grava com ids novos, ligados à obra importada
  const mapa = new Map();
  for (const a of p.arquivos || []) {
    try {
      const novo = C.uid('arq');
      await S.salvarArquivo({ id: novo, obraId: obra.id, nome: a.nome, mime: a.mime, blob: await S.dataUrlParaBlob(a.dataUrl) });
      mapa.set(a.id, novo);
    } catch { /* arquivo corrompido: o documento fica pendente */ }
  }
  for (const d of obra.documentos) {
    const orig = d.copiarDe || d.arquivoId;
    d.arquivoId = orig && mapa.get(orig) ? mapa.get(orig) : null;
    d.renderId = d.renderId && mapa.get(d.renderId) ? mapa.get(d.renderId) : null;
    if (!d.arquivoId) d.pendente = true;
    delete d.copiarDe;
  }
  if (modo === 'subst' && app.obra && app.obra.id === obra.id) app.obra = null; // evita regravar a versão antiga
  await S.salvarObra(obra);
  await recarregarIndice();
  await abrirObra(obra.id);
  toast(`Obra “${obra.nome}” importada (${Object.keys(obra.lancamentos).length} lançamentos).`);
}

export async function limparObra() {
  const a = C.alcanceLimpeza(app.obra);
  const r = await dialogo({
    titulo: `Limpar avanços de ${app.obra.nome}`,
    html: `<p>Serão apagados nesta obra:</p><ul><li><b>${a.nLanc}</b> lançamento(s) em ${a.nMeses} mês(es), de ${a.nElems} elemento(s)</li><li><b>${a.nConc}</b> registro(s) de conclusão/entrega</li><li>${a.nRev} item(ns) do histórico de alterações</li></ul>
      <p>Permanecem: estrutura (${app.obra.elementos.length} elementos), modelo 3D, etapas, documentos, datas e configurações. <b>Nenhuma outra obra é alterada.</b></p>
      <label class="chk-lin"><input type="checkbox" id="lBackup" checked> Baixar uma cópia de segurança antes de limpar</label>
      <label class="campo"><span>Para confirmar, digite LIMPAR</span><input id="lConf" autocomplete="off"></label><p class="erro" id="dlgErro"></p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'Limpar avanços', valor: 'ok', classe: 'perigo' }],
    coletar: (d) => {
      if (d.querySelector('#lConf').value.trim().toUpperCase() !== 'LIMPAR') { d.querySelector('#dlgErro').textContent = 'Digite LIMPAR para confirmar.'; return false; }
      return { backup: d.querySelector('#lBackup').checked };
    },
  });
  if (!r) return;
  if (r.backup && !(await exportarObra(true))) {
    toast('Limpeza cancelada: a cópia de segurança não foi salva.', 'erro');
    return;
  }
  mutar((o) => C.limparAvancos(o));
  app.finalPendente.clear();
  await salvarAgora();
  toast('Avanços apagados. A obra está pronta para novos lançamentos.');
}

export function montarAbas(obra, idx, mesRef) {
  const caminho = (id) => C.ancestrais(idx, id).map((a) => a.nome).join(' › ');
  const folhas = obra.elementos.filter(C.ehFolha);
  const { meses } = C.mesesDaObra(obra);
  const r = C.resumo(idx, mesRef);
  const linhasResumo = [
    ['Obra', obra.nome], ['Tipo', M.TIPOS_OBRA[obra.tipo]], ['Início', obra.inicio], ['Término', obra.termino], ['Competência da planilha', fmtMes(mesRef)],
    ['Modelo esquemático', obra.esquematico ? 'sim' : 'não'], ['', ''],
    ['Indicador', 'Valor'],
    ['Unidades: acumulado (%)', r.unidade.acum], ['Unidades: realizado no mês (p.p.)', r.unidade.mes], ['Unidades finalizadas', `${r.unidade.finalizados} de ${r.unidade.n}`],
    ['Áreas comuns: acumulado (%)', r.anexo.acum], ['Áreas comuns finalizadas', `${r.anexo.finalizados} de ${r.anexo.n}`],
    ['Infraestrutura: acumulado (%)', r.infra.acum], ['', ''],
    ...C.REGRA_CALCULO.map((t, i) => [`Regra ${i + 1}`, t]),
  ];
  const ets = idx.etapasOrdenadas;
  const lanc = Object.entries(obra.lancamentos).map(([k, v]) => {
    const [eid, etid, comp] = k.split('|');
    const e = idx.elemById.get(eid);
    const et = idx.etapasById.get(etid);
    if (!e || !et) return null;
    const tot = C.total(e, et);
    const ac = C.acumulado(idx, eid, etid, comp);
    return [comp, e.codigo, e.nome, caminho(eid), et.nome, et.unidade, v.v, ac, tot, (ac / tot) * 100, v.origem || '', v.obs || '', v.em || ''];
  }).filter(Boolean).sort((a, b) => (a[0] + a[1] + a[4] < b[0] + b[1] + b[4] ? -1 : 1));
  const etsUsadas = ets;
  return [
    { nome: 'Resumo', colunas: [{ titulo: 'Item', largura: 38 }, { titulo: 'Valor', largura: 60, pct: true }], linhas: linhasResumo },
    { nome: 'Elementos', colunas: ['Código', 'Nome', 'Classe', 'Categoria', 'Caminho', 'Representação', 'X', 'Z', 'Elevação', 'Rotação', 'Largura', 'Profundidade', 'Altura', 'Peso'].map((t, i) => ({ titulo: t, largura: [10, 22, 12, 14, 30, 14][i] || 10 })),
      linhas: obra.elementos.map((e) => [e.codigo, e.nome, M.CLASSES[e.classe], e.categoria, caminho(e.id), M.FORMAS[e.forma] || e.forma, e.x, e.z, e.y, e.rot, e.w, e.d, e.h, e.peso]) },
    { nome: 'Etapas', colunas: ['Ordem', 'Etapa', 'Grupo', 'Unidade', 'Qtd. padrão', 'Peso', 'Representação 3D'].map((t) => ({ titulo: t, largura: 16 })),
      linhas: ets.map((x) => [x.ordem, x.nome, M.GRUPOS_ETAPA[x.grupo], x.unidade, x.unidade === '%' ? 100 : x.qtdPadrao, x.peso, M.VISUAIS[x.visual] || x.visual]) },
    { nome: 'Lançamentos', colunas: [{ titulo: 'Competência', largura: 12 }, { titulo: 'Código', largura: 10 }, { titulo: 'Elemento', largura: 20 }, { titulo: 'Caminho', largura: 28 }, { titulo: 'Etapa', largura: 18 }, { titulo: 'Unidade', largura: 8 }, { titulo: 'Realizado no mês', largura: 14, pct: true }, { titulo: 'Acumulado (unid.)', largura: 14, pct: true }, { titulo: 'Total (unid.)', largura: 12 }, { titulo: 'Acumulado %', largura: 12, pct: true }, { titulo: 'Origem', largura: 10 }, { titulo: 'Obs.', largura: 20 }, { titulo: 'Gravado em', largura: 20 }], linhas: lanc },
    { nome: `Avanço ${mesRef}`, colunas: [{ titulo: 'Código', largura: 10 }, { titulo: 'Elemento', largura: 20 }, { titulo: 'Caminho', largura: 28 }, { titulo: 'Classe', largura: 12 }, ...etsUsadas.map((x) => ({ titulo: `${x.nome} (%)`, largura: 12, pct: true })), { titulo: 'Físico (%)', largura: 11, pct: true }, { titulo: 'Situação', largura: 16 }],
      linhas: folhas.map((e) => {
        const ap = new Set(C.etapasDoElem(idx, e).map((x) => x.id));
        return [e.codigo, e.nome, caminho(e.id), M.CLASSES[e.classe], ...etsUsadas.map((x) => (ap.has(x.id) ? C.pctEtapa(idx, e, x, mesRef) : '')), C.progElem(idx, e, mesRef), C.ROTULO_STATUS[C.statusElem(idx, e, mesRef)]];
      }) },
    { nome: 'Evolução mensal', colunas: [{ titulo: 'Competência', largura: 12 }, { titulo: 'Unidades acum. %', largura: 15, pct: true }, { titulo: 'Unidades mês p.p.', largura: 15, pct: true }, { titulo: 'Áreas comuns acum. %', largura: 17, pct: true }, { titulo: 'Infra acum. %', largura: 14, pct: true }, { titulo: 'Unidades finalizadas', largura: 16 }, { titulo: 'Áreas comuns finalizadas', largura: 18 }],
      linhas: meses.map((m) => { const x = C.resumo(idx, m); return [m, x.unidade.acum, x.unidade.mes, x.anexo.acum, x.infra.acum, x.unidade.finalizados, x.anexo.finalizados]; }) },
    { nome: 'Conclusões', colunas: ['Código', 'Elemento', 'Competência', 'Situação', 'Obs.', 'Registrado em'].map((t) => ({ titulo: t, largura: 16 })),
      linhas: Object.entries(obra.conclusoes).flatMap(([id, l]) => { const e = idx.elemById.get(id); return e ? l.map((ev) => [e.codigo, e.nome, ev.comp, ev.acao === 'finalizar' ? 'Finalizado' : ev.acao === 'entregar' ? 'Entregue' : 'Reaberto', ev.obs || '', ev.em || '']) : []; }) },
    { nome: 'Alterações', colunas: ['Data', 'Tipo', 'Origem', 'Elemento', 'Etapa', 'Competência', 'Antes', 'Depois', 'Motivo'].map((t) => ({ titulo: t, largura: 16 })),
      linhas: (obra.revisoes || []).map((r) => [r.em, r.tipo, r.origem || '', idx.elemById.get(r.elemId)?.nome || r.nome || '', idx.etapasById.get(r.etapaId)?.nome || '', r.comp || '', r.antes ?? '', r.depois ?? '', r.motivo || '']) },
  ];
}

export async function exportarXlsx() {
  const blob = gerarXlsx(montarAbas(app.obra, app.idx, app.mes));
  if (await baixar(`${nomeArquivo(app.obra.nome)}_conferencia_${app.mes}.xlsx`, blob)) toast('Planilha gerada.');
}

// ---------------------------------------------------------------- ajuda

export function modalAjuda() {
  return dialogo({
    titulo: 'Como usar',
    largura: 760,
    html: `<div class="ajuda">
      <h4>1. Escolha a obra e o mês</h4><p>No topo, selecione a obra. Na linha do tempo, escolha a competência que vai receber o lançamento. Todo valor digitado vale para essa competência.</p>
      <h4>2. Selecione o que foi executado</h4><p>Clique numa casa, apartamento, área comum ou rua, na cena ou na lista. Dois cliques pegam o grupo (rank, pavimento). Em “Nível de seleção” você define se o clique pega a unidade ou o grupo. Shift + clique soma itens num conjunto.</p>
      <h4>3. Lance no painel de baixo</h4><p>Para um elemento: digite o realizado no mês, o acumulado atual ou arraste a barra. Acumulado anterior + realizado no mês = acumulado atual. Para um grupo: marque as etapas, informe o valor, veja quem será afetado e aplique.</p>
      <h4>4. Finalize</h4><p>“Finalizar” registra a conclusão a partir do mês ativo e mostra ✓ sobre o elemento. Em grupos, a aba Finalização mostra “x de y” e permite marcar quais estão prontas.</p>
      <h4>5. Corrija com rastreio</h4><p>Alterar um mês já lançado pede um motivo. O realizado dos meses seguintes é mantido e o acumulado é recalculado. Nada sai de 0% a 100%.</p>
      <h4>Navegação 3D</h4><ul><li>Mouse: arraste para girar, botão direito (ou Ctrl + arraste) para deslocar, roda para aproximar.</li><li>Toque: um dedo gira, dois dedos aproximam e deslocam.</li>
        <li>“Personagem”: clique no ponto onde quer começar e a caminhada inicia. W A S D ou setas para andar, arraste para olhar, Shift corre, Esc sai. No celular use os botões na tela.</li></ul>
      <h4>Modos de visualização</h4><ul><li><b>Maquete</b>: componentes surgem conforme as etapas (terreno, fundação, estrutura, paredes, telhado, instalações, acabamento, paisagismo).</li>
        <li><b>Por avanço</b>: cores por situação no mês.</li><li><b>O que mudou</b>: diferença entre a competência ativa e a de comparação, incluindo correções.</li><li><b>Etapa</b>: filtra a cena e o painel de lançamento por uma etapa.</li></ul>
      <h4>Dados</h4><p>Tudo grava sozinho neste navegador. Em “Dados” você exporta a obra completa, importa, baixa planilha de conferência ou limpa os avanços (só da obra aberta).</p>
    </div>`,
    botoes: [{ rotulo: 'Entendi', valor: null, classe: 'primario' }],
  });
}
