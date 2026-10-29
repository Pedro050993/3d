// Modo compartilhado (versão web): login, papéis e sincronização com o Supabase.
//
// A estrutura da obra (elementos, etapas, documentos, configurações) é um único
// registro, alterado só por administradores. Lançamentos, conclusões e histórico
// são linhas separadas: duas pessoas lançando em casas diferentes nunca se
// sobrescrevem. O aparelho guarda uma cópia local e reenvia o que não subiu.

import { createClient } from '@supabase/supabase-js';
import * as S from './store.js';

const SEP = ['lancamentos', 'conclusoes', 'revisoes'];
let sb = null;
let eu = null; // { id, email, nome, papel }
const fotos = new Map(); // obraId -> último estado confirmado no servidor
let canal = null;
let aoMudarRemoto = null;
let pendente = false;

export function configurado() {
  const c = globalThis.OBRAS3D_CONFIG;
  return !!(c && c.supabaseUrl && c.supabaseKey);
}

export function cliente() {
  if (!sb) {
    const c = globalThis.OBRAS3D_CONFIG;
    sb = createClient(c.supabaseUrl, c.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  return sb;
}

export const usuario = () => eu;
// testes: cliente e usuário simulados
export function _simular(cliente_, usuario_) { sb = cliente_; eu = usuario_; fotos.clear(); }
export const papel = () => (eu ? eu.papel : 'admin');
export const temPendencias = () => pendente;

// ---------------------------------------------------------------- autenticação

export async function sessaoAtual() {
  const { data } = await cliente().auth.getSession();
  return data.session;
}

export async function entrar(email, senha) {
  const { error } = await cliente().auth.signInWithPassword({ email, password: senha });
  if (error) throw traduzir(error);
}

export async function criarConta(email, senha, nome) {
  const { error } = await cliente().auth.signUp({ email, password: senha, options: { data: { nome } } });
  if (error) throw traduzir(error);
  // o administrador inicial já nasce confirmado: tenta entrar direto
  try { await entrar(email, senha); return true; } catch { return false; }
}

export async function recuperarSenha(email) {
  const { error } = await cliente().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw traduzir(error);
}

export async function trocarSenha(nova) {
  const { error } = await cliente().auth.updateUser({ password: nova });
  if (error) throw traduzir(error);
}

export async function sair() {
  await cliente().auth.signOut();
  eu = null;
}

export async function carregarPerfil() {
  const { data: u } = await cliente().auth.getUser();
  if (!u || !u.user) return null;
  const { data, error } = await cliente().from('perfis').select('user_id,email,nome,papel').eq('user_id', u.user.id).maybeSingle();
  if (error) throw traduzir(error);
  eu = data ? { id: data.user_id, email: data.email, nome: data.nome, papel: data.papel } : { id: u.user.id, email: u.user.email, nome: '', papel: 'pendente' };
  return eu;
}

export async function listarUsuarios() {
  const { data, error } = await cliente().from('perfis').select('user_id,email,nome,papel,criado_em').order('criado_em');
  if (error) throw traduzir(error);
  return data;
}

export async function definirPapel(userId, novo) {
  const { error } = await cliente().rpc('definir_papel', { alvo: userId, novo });
  if (error) throw traduzir(error);
}

export async function salvarMeuNome(nome) {
  const { error } = await cliente().from('perfis').update({ nome }).eq('user_id', eu.id);
  if (error) throw traduzir(error);
  eu.nome = nome;
}

function traduzir(e) {
  const m = String(e && (e.message || e.error_description || e)).toLowerCase();
  const msg = m.includes('invalid login') ? 'E-mail ou senha incorretos.'
    : m.includes('email not confirmed') ? 'Cadastro ainda não liberado pelo administrador.'
      : m.includes('already registered') ? 'Este e-mail já tem cadastro. Use “Entrar”.'
        : m.includes('password should be') ? 'A senha precisa ter pelo menos 6 caracteres.'
          : m.includes('rate limit') || m.includes('security purposes') ? 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.'
            : m.includes('row-level security') || m.includes('permission') ? 'Seu acesso não permite esta alteração.'
              : m.includes('failed to fetch') || m.includes('network') ? 'Sem conexão com o servidor.'
                : e && e.message ? e.message : 'Erro no servidor.';
  const err = new Error(msg);
  err.original = e;
  return err;
}

// ---------------------------------------------------------------- leitura

async function todas(tabela, colunas, filtro) {
  const passo = 1000;
  let r = [];
  for (let i = 0; ; i += passo) {
    let q = cliente().from(tabela).select(colunas).range(i, i + passo - 1);
    q = filtro(q);
    const { data, error } = await q;
    if (error) throw traduzir(error);
    r = r.concat(data);
    if (data.length < passo) return r;
  }
}

function separar(obra) {
  const est = {};
  for (const [k, v] of Object.entries(obra)) if (!SEP.includes(k) && !k.startsWith('_')) est[k] = v;
  return est;
}

function tirarFoto(obra) {
  const lanc = new Map(Object.entries(obra.lancamentos || {}).map(([k, v]) => [k, JSON.stringify([v.v, v.obs || '', v.origem || ''])]));
  const conc = new Map();
  for (const [elemId, lista] of Object.entries(obra.conclusoes || {})) for (const ev of lista) conc.set(ev.id, JSON.stringify({ elemId, ...ev }));
  return { est: JSON.stringify(separar(obra)), lanc, conc, revs: new Set((obra.revisoes || []).map((r) => r.id)), versao: obra._versao || 1 };
}

export async function listarObras() {
  const { data, error } = await cliente().from('obras').select('id,nome,arquivada,estrutura,atualizado_em').order('nome');
  if (error) throw traduzir(error);
  return data.map((r) => ({ ...r.estrutura, id: r.id, nome: r.nome, arquivada: r.arquivada, atualizadoEm: r.atualizado_em }));
}

export async function carregarObra(id) {
  try {
    const { data: row, error } = await cliente().from('obras').select('id,nome,arquivada,estrutura,versao').eq('id', id).maybeSingle();
    if (error) throw traduzir(error);
    if (!row) return null;
    const [ls, cs, rs, ps] = await Promise.all([
      todas('lancamentos', 'elem_id,etapa_id,comp,v,obs,origem,em,por', (q) => q.eq('obra_id', id)),
      todas('conclusoes', 'id,elem_id,comp,acao,obs,seq,em,por', (q) => q.eq('obra_id', id)),
      todas('revisoes', 'id,em,por,dados', (q) => q.eq('obra_id', id).order('em')),
      cliente().from('perfis').select('user_id,nome,email'),
    ]);
    const nomes = new Map((ps.data || []).map((p) => [p.user_id, p.nome || p.email]));
    const obra = { ...row.estrutura, id: row.id, nome: row.nome, arquivada: row.arquivada, _versao: row.versao };
    obra.lancamentos = {};
    for (const l of ls) obra.lancamentos[`${l.elem_id}|${l.etapa_id}|${l.comp}`] = { v: l.v, obs: l.obs || '', origem: l.origem || 'individual', em: l.em, porNome: nomes.get(l.por) || '' };
    obra.conclusoes = {};
    for (const c of cs) (obra.conclusoes[c.elem_id] = obra.conclusoes[c.elem_id] || []).push({ id: c.id, comp: c.comp, acao: c.acao, obs: c.obs || '', seq: c.seq, em: c.em, porNome: nomes.get(c.por) || '' });
    obra.revisoes = rs.map((r) => ({ ...r.dados, id: r.id, em: r.em, porNome: nomes.get(r.por) || '' }));
    fotos.set(id, tirarFoto(obra));
    S.salvarObraLocal(JSON.parse(JSON.stringify(obra))).catch(() => {});
    return obra;
  } catch (e) {
    // sem conexão: abre a última cópia deste aparelho
    const local = await S.carregarObraLocal(id);
    if (local) {
      if (!fotos.has(id)) fotos.set(id, local._foto ? revive(local._foto) : tirarFoto({ ...local, lancamentos: {}, conclusoes: {}, revisoes: [] }));
      pendente = true;
      return local;
    }
    throw e;
  }
}

function revive(f) {
  return { est: f.est, lanc: new Map(f.lanc), conc: new Map(f.conc), revs: new Set(f.revs), versao: f.versao };
}

// ---------------------------------------------------------------- gravação

async function emLotes(lista, n, fn) {
  for (let i = 0; i < lista.length; i += n) await fn(lista.slice(i, i + n));
}

export async function salvarObra(obra) {
  const id = obra.id;
  const antes = fotos.get(id);
  const agora = tirarFoto(obra);
  const admin = papel() === 'admin';
  const campo = admin || papel() === 'campo';
  // cópia local antes de tudo (vale como fila quando estiver sem rede)
  const copia = JSON.parse(JSON.stringify(obra));
  copia._foto = antes ? { est: antes.est, lanc: [...antes.lanc], conc: [...antes.conc], revs: [...antes.revs], versao: antes.versao } : null;
  await S.salvarObraLocal(copia).catch(() => {});
  if (!campo) return;
  try {
    const nova = !antes;
    if (admin && (nova || antes.est !== agora.est)) {
      const versao = (antes ? antes.versao : 0) + 1;
      const { error } = await cliente().from('obras').upsert({ id, nome: obra.nome, arquivada: !!obra.arquivada, estrutura: separar(obra), versao, atualizado_em: new Date().toISOString(), atualizado_por: eu.id });
      if (error) throw traduzir(error);
      obra._versao = versao;
      agora.versao = versao;
    } else if (antes) agora.versao = antes.versao;
    if (nova && !admin) return;
    // lançamentos
    const lancAntes = antes ? antes.lanc : new Map();
    const upL = [];
    for (const [k, j] of agora.lanc) if (lancAntes.get(k) !== j) {
      const [elem, etapa, comp] = k.split('|');
      const l = obra.lancamentos[k];
      upL.push({ obra_id: id, elem_id: elem, etapa_id: etapa, comp, v: l.v, obs: l.obs || '', origem: l.origem || 'individual', em: l.em || new Date().toISOString(), por: eu.id });
    }
    const delL = [...lancAntes.keys()].filter((k) => !agora.lanc.has(k));
    if (delL.length && delL.length === lancAntes.size && !agora.lanc.size) {
      const { error } = await cliente().from('lancamentos').delete().eq('obra_id', id);
      if (error) throw traduzir(error);
    } else {
      await emLotes(delL, 40, async (lote) => {
        await Promise.all(lote.map(async (k) => {
          const [elem, etapa, comp] = k.split('|');
          const { error } = await cliente().from('lancamentos').delete().match({ obra_id: id, elem_id: elem, etapa_id: etapa, comp });
          if (error) throw traduzir(error);
        }));
      });
    }
    await emLotes(upL, 500, async (lote) => {
      const { error } = await cliente().from('lancamentos').upsert(lote);
      if (error) throw traduzir(error);
    });
    // conclusões
    const concAntes = antes ? antes.conc : new Map();
    const upC = [];
    for (const [cid, j] of agora.conc) if (concAntes.get(cid) !== j) {
      const ev = JSON.parse(j);
      upC.push({ id: cid, obra_id: id, elem_id: ev.elemId, comp: ev.comp, acao: ev.acao, obs: ev.obs || '', seq: ev.seq || 0, em: ev.em || new Date().toISOString(), por: eu.id });
    }
    const delC = [...concAntes.keys()].filter((k) => !agora.conc.has(k));
    if (delC.length) {
      await emLotes(delC, 200, async (lote) => {
        const { error } = await cliente().from('conclusoes').delete().in('id', lote);
        if (error) throw traduzir(error);
      });
    }
    await emLotes(upC, 500, async (lote) => {
      const { error } = await cliente().from('conclusoes').upsert(lote);
      if (error) throw traduzir(error);
    });
    // histórico: só acrescenta; a limpeza (administrador) apaga o anterior
    const revsAntes = antes ? antes.revs : new Set();
    const removidas = [...revsAntes].filter((r) => !agora.revs.has(r));
    if (removidas.length && admin) {
      await emLotes(removidas, 200, async (lote) => {
        const { error } = await cliente().from('revisoes').delete().in('id', lote);
        if (error) throw traduzir(error);
      });
    }
    const novas = (obra.revisoes || []).filter((r) => !revsAntes.has(r.id));
    for (const r of novas) if (!r.porNome && eu) r.porNome = eu.nome || eu.email;
    await emLotes(novas, 500, async (lote) => {
      const { error } = await cliente().from('revisoes').upsert(lote.map((r) => {
        const { id: rid, em, porNome, ...dados } = r;
        return { id: rid, obra_id: id, em, por: eu.id, dados };
      }));
      if (error) throw traduzir(error);
    });
    fotos.set(id, agora);
    pendente = false;
    copia._foto = null;
    await S.salvarObraLocal({ ...copia, _foto: { est: agora.est, lanc: [...agora.lanc], conc: [...agora.conc], revs: [...agora.revs], versao: agora.versao } }).catch(() => {});
  } catch (e) {
    pendente = true;
    throw e;
  }
}

export async function excluirObra(id) {
  const { error } = await cliente().from('obras').delete().eq('id', id);
  if (error) throw traduzir(error);
}

// ---------------------------------------------------------------- arquivos

export async function salvarArquivo({ id, obraId, nome, mime, blob }) {
  await S.salvarArquivoLocal({ id, obraId, nome, mime, blob }).catch(() => {});
  const { error } = await cliente().storage.from('documentos').upload(`${obraId}/${id}`, blob, { contentType: mime || 'application/octet-stream', upsert: true, metadata: { nome } });
  if (error) throw traduzir(error);
  const reg = { id, obraId, nome, mime };
  const lista = (await S.meta('arquivosRemotos')) || {};
  lista[id] = reg;
  await S.meta('arquivosRemotos', lista);
  return id;
}

async function caminhoDoArquivo(id) {
  const lista = (await S.meta('arquivosRemotos')) || {};
  if (lista[id]) return `${lista[id].obraId}/${id}`;
  // arquivo de outro aparelho: procura nas pastas das obras
  const { data } = await cliente().from('obras').select('id');
  for (const o of data || []) {
    const { data: fs } = await cliente().storage.from('documentos').list(o.id, { search: id });
    if (fs && fs.some((f) => f.name === id)) return `${o.id}/${id}`;
  }
  return null;
}

export async function lerArquivo(id) {
  if (!id) return null;
  const local = await S.lerArquivoLocal(id).catch(() => null);
  if (local) return local;
  const caminho = await caminhoDoArquivo(id);
  if (!caminho) return null;
  const { data, error } = await cliente().storage.from('documentos').download(caminho);
  if (error) return null;
  const obraId = caminho.split('/')[0];
  const reg = { id, obraId, nome: id, mime: data.type, blob: data };
  S.salvarArquivoLocal(reg).catch(() => {});
  return reg;
}

export async function excluirArquivo(id) {
  const caminho = await caminhoDoArquivo(id);
  await S.excluirArquivoLocal(id).catch(() => {});
  if (caminho) await cliente().storage.from('documentos').remove([caminho]);
}

// ---------------------------------------------------------------- tempo real

// Aplica na obra aberta o que outras pessoas gravaram. "aplicar" recebe uma
// função que altera a obra e deve reindexar e redesenhar.
export function acompanhar(obraId, aplicar) {
  aoMudarRemoto = aplicar;
  if (canal) cliente().removeChannel(canal);
  canal = cliente().channel('obra-' + obraId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos', filter: `obra_id=eq.${obraId}` }, (p) => {
      const r = p.new && p.new.elem_id ? p.new : p.old;
      if (!r || !r.elem_id) return;
      const k = `${r.elem_id}|${r.etapa_id}|${r.comp}`;
      const foto = fotos.get(obraId);
      aoMudarRemoto((obra) => {
        if (p.eventType === 'DELETE') {
          delete obra.lancamentos[k];
          if (foto) foto.lanc.delete(k);
        } else {
          obra.lancamentos[k] = { v: r.v, obs: r.obs || '', origem: r.origem || 'individual', em: r.em };
          if (foto) foto.lanc.set(k, JSON.stringify([r.v, r.obs || '', r.origem || '']));
        }
      }, r.por);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conclusoes', filter: `obra_id=eq.${obraId}` }, (p) => {
      const foto = fotos.get(obraId);
      aoMudarRemoto((obra) => {
        if (p.eventType === 'DELETE') {
          const cid = p.old && p.old.id;
          for (const [k, l] of Object.entries(obra.conclusoes)) {
            const i = l.findIndex((x) => x.id === cid);
            if (i >= 0) { l.splice(i, 1); if (!l.length) delete obra.conclusoes[k]; }
          }
          if (foto) foto.conc.delete(cid);
          return;
        }
        const c = p.new;
        const ev = { id: c.id, comp: c.comp, acao: c.acao, obs: c.obs || '', seq: c.seq, em: c.em };
        const l = obra.conclusoes[c.elem_id] || (obra.conclusoes[c.elem_id] = []);
        const i = l.findIndex((x) => x.id === c.id);
        if (i >= 0) l[i] = ev; else l.push(ev);
        if (foto) foto.conc.set(c.id, JSON.stringify({ elemId: c.elem_id, ...ev }));
      }, p.new && p.new.por);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'obras', filter: `id=eq.${obraId}` }, (p) => {
      const r = p.new;
      const foto = fotos.get(obraId);
      if (!r || (foto && r.versao <= foto.versao)) return;
      aoMudarRemoto((obra) => {
        for (const k of Object.keys(obra)) if (!SEP.includes(k)) delete obra[k];
        Object.assign(obra, r.estrutura, { id: r.id, nome: r.nome, arquivada: r.arquivada, _versao: r.versao });
        if (foto) { foto.est = JSON.stringify(separar(obra)); foto.versao = r.versao; }
      }, r.atualizado_por, true);
    })
    .subscribe();
}
