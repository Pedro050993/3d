// Persistência local: IndexedDB com uma entrada por obra (dados isolados) e
// um depósito separado para arquivos anexados. Cai para localStorage quando
// o navegador bloqueia o IndexedDB.

const DB = 'obras3d';
const VERSAO = 1;
let dbp = null;
let memoria = null; // fallback

function abrir() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      if (!('indexedDB' in globalThis)) return res(null);
      const rq = indexedDB.open(DB, VERSAO);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('obras')) db.createObjectStore('obras', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('arquivos')) db.createObjectStore('arquivos', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(null);
      rq.onblocked = () => res(null);
    } catch {
      res(null);
    }
  });
  return dbp;
}

function tx(db, store, modo, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}

function req(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function ls() {
  if (memoria) return memoria;
  memoria = {
    get(k) { try { const v = localStorage.getItem('obras3d:' + k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { try { localStorage.setItem('obras3d:' + k, JSON.stringify(v)); } catch (e) { console.warn(e); } },
    del(k) { try { localStorage.removeItem('obras3d:' + k); } catch { /* sem acesso */ } },
  };
  return memoria;
}

export async function modoArmazenamentoLocal() {
  return (await abrir()) ? 'IndexedDB' : 'localStorage';
}

export async function listarObrasLocal() {
  const db = await abrir();
  if (!db) {
    const ids = ls().get('indice') || [];
    return ids.map((id) => ls().get('obra:' + id)).filter(Boolean);
  }
  return tx(db, 'obras', 'readonly', (s) => req(s.getAll()));
}

export async function carregarObraLocal(id) {
  const db = await abrir();
  if (!db) return ls().get('obra:' + id);
  return tx(db, 'obras', 'readonly', (s) => req(s.get(id)));
}

export async function salvarObraLocal(obra) {
  obra.atualizadoEm = new Date().toISOString();
  const db = await abrir();
  const copia = JSON.parse(JSON.stringify(obra));
  if (!db) {
    const ids = new Set(ls().get('indice') || []);
    ids.add(obra.id);
    ls().set('indice', [...ids]);
    ls().set('obra:' + obra.id, copia);
    return;
  }
  await tx(db, 'obras', 'readwrite', (s) => req(s.put(copia)));
}

export async function excluirObraLocal(id) {
  const db = await abrir();
  if (!db) {
    ls().set('indice', (ls().get('indice') || []).filter((x) => x !== id));
    ls().del('obra:' + id);
    return;
  }
  await tx(db, 'obras', 'readwrite', (s) => req(s.delete(id)));
}

export async function meta(k, v) {
  const db = await abrir();
  if (v === undefined) {
    if (!db) return ls().get('meta:' + k);
    const r = await tx(db, 'meta', 'readonly', (s) => req(s.get(k)));
    return r ? r.v : null;
  }
  if (!db) return ls().set('meta:' + k, v);
  await tx(db, 'meta', 'readwrite', (s) => req(s.put({ k, v })));
}

// ---------------------------------------------------------------- arquivos

export async function salvarArquivoLocal({ id, obraId, nome, mime, blob }) {
  const db = await abrir();
  if (!db) {
    const dataUrl = await blobParaDataUrl(blob);
    ls().set('arq:' + id, { id, obraId, nome, mime, dataUrl });
    return id;
  }
  await tx(db, 'arquivos', 'readwrite', (s) => req(s.put({ id, obraId, nome, mime, blob })));
  return id;
}

export async function lerArquivoLocal(id) {
  if (!id) return null;
  const db = await abrir();
  if (!db) {
    const r = ls().get('arq:' + id);
    if (!r) return null;
    return { ...r, blob: await (await fetch(r.dataUrl)).blob() };
  }
  return tx(db, 'arquivos', 'readonly', (s) => req(s.get(id)));
}

export async function excluirArquivoLocal(id) {
  const db = await abrir();
  if (!db) return ls().del('arq:' + id);
  await tx(db, 'arquivos', 'readwrite', (s) => req(s.delete(id)));
}

export function blobParaDataUrl(blob) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });
}

export async function dataUrlParaBlob(url) {
  return (await fetch(url)).blob();
}

// ---------------------------------------------------------------- modo compartilhado
// Com um servidor configurado (versão web), as mesmas funções passam a ler e
// gravar no banco compartilhado; o IndexedDB fica como cópia local do aparelho.

let remoto = null;
export function usarRemoto(r) { remoto = r; }
export function emModoRemoto() { return !!remoto; }

export async function modoArmazenamento() { return remoto ? 'servidor compartilhado' : modoArmazenamentoLocal(); }
export async function listarObras() { return remoto ? remoto.listarObras() : listarObrasLocal(); }
export async function carregarObra(id) { return remoto ? remoto.carregarObra(id) : carregarObraLocal(id); }
export async function salvarObra(obra) { return remoto ? remoto.salvarObra(obra) : salvarObraLocal(obra); }
export async function excluirObra(id) { return remoto ? remoto.excluirObra(id) : excluirObraLocal(id); }
export async function salvarArquivo(a) { return remoto ? remoto.salvarArquivo(a) : salvarArquivoLocal(a); }
export async function lerArquivo(id) { return remoto ? remoto.lerArquivo(id) : lerArquivoLocal(id); }
export async function excluirArquivo(id) { return remoto ? remoto.excluirArquivo(id) : excluirArquivoLocal(id); }
