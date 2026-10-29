// Cena 3D: desenho dos elementos conforme o avanço das etapas, modos de cor,
// seleção, navegação orbital, vista superior, primeira pessoa e planta de base.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ehFolha, etapasDoElem, pctEtapa, progElem, statusElem, situacaoConclusao } from './calc.js';

// ---------------------------------------------------------------- materiais e geometrias

const CORES = {
  terra: 0x9b7653, nivelado: 0xbc9a6c, concreto: 0xa9a9a3, estrutura: 0x8e8e89, tijolo: 0xc07a5a,
  reboco: 0xeee5d3, telha: 0xa4452c, vidro: 0x3d5a70, porta: 0x6b4a2f, grama: 0x74a84d, folha: 0x3f7d3a,
  tronco: 0x6b4a2f, asfalto: 0x3b3b3e, brita: 0x8c8474, calcada: 0xd2cdc2, agua: 0x4fa8d8, azulejo: 0x8fd3ea,
  tubAgua: 0x2f7bd6, tubEsgoto: 0x8a5a2b, tubDren: 0x6f6f6f, poste: 0x555555, imper: 0x2e2e33, metal: 0x9aa3ad,
  piso: 0xd9d2c4, borracha: 0x5b8f6a, faixa: 0xf2f2f2, estaca: 0xe0a030,
};

export const CORES_STATUS = {
  nao_iniciado: '#bdbdb4',
  execucao_ini: '#e0782f',
  execucao_fim: '#d9c135',
  concluido: '#3e9b5f',
  finalizado: '#2a6fb5',
  entregue: '#6b4fbf',
};

export const CORES_DIFF = {
  avancou: '#2f9e57',
  regrediu: '#d0393b',
  corrigido: '#c040b0',
  finalizou: '#2a6fb5',
  igual: '#d4d3cc',
};

const cacheMat = new Map();
function mat(cor, op = {}) {
  const k = `${cor}|${op.opacity ?? 1}|${op.emissive ?? 0}`;
  if (cacheMat.has(k)) return cacheMat.get(k);
  const m = new THREE.MeshLambertMaterial({ color: cor, transparent: (op.opacity ?? 1) < 1, opacity: op.opacity ?? 1, depthWrite: (op.opacity ?? 1) >= 1 });
  if (op.emissive) m.emissive = new THREE.Color(op.emissive);
  cacheMat.set(k, m);
  return m;
}
const matInvisivel = new THREE.MeshBasicMaterial({ visible: false });
const matContorno = new THREE.LineBasicMaterial({ color: 0x7a786d, transparent: true, opacity: 0.55 });
const matSelecao = new THREE.LineBasicMaterial({ color: 0xffb000 });

const G = {
  caixa: new THREE.BoxGeometry(1, 1, 1),
  cil: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
  cone: new THREE.ConeGeometry(0.5, 1, 10),
  esfera: new THREE.SphereGeometry(0.5, 12, 10),
  arestas: new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
};
G.caixa.translate(0, 0.5, 0); // base no chão: facilita crescer em altura
G.cil.translate(0, 0.5, 0);
G.cone.translate(0, 0.5, 0);
G.arestas.translate(0, 0.5, 0);
// prisma do telhado (duas águas), base 1x1 e cumeeira no eixo x
G.telhado = (() => {
  const g = new THREE.BufferGeometry();
  const v = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 1, 0, -0.5, 1, 0, -0.5, 0, 0.5, 0.5, 0, 0.5];
  const i = [0, 2, 1, 0, 3, 2, 4, 5, 2, 4, 2, 3, 0, 4, 3, 1, 2, 5, 0, 1, 5, 0, 5, 4];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(i);
  g.computeVertexNormals();
  return g;
})();

function caixa(pai, m, w, h, d, x = 0, y = 0, z = 0, sombra = true) {
  if (w <= 0.001 || h <= 0.001 || d <= 0.001) return null;
  const me = new THREE.Mesh(G.caixa, m);
  me.scale.set(w, h, d);
  me.position.set(x, y, z);
  me.castShadow = sombra;
  me.receiveShadow = true;
  pai.add(me);
  return me;
}
function cilindro(pai, m, r, h, x, y, z) {
  const me = new THREE.Mesh(G.cil, m);
  me.scale.set(r * 2, h, r * 2);
  me.position.set(x, y, z);
  me.castShadow = true;
  pai.add(me);
  return me;
}
function arvore(pai, s, x, z, m) {
  if (s <= 0.02) return;
  cilindro(pai, m.tronco, 0.12 * s, 1.4 * s, x, 0, z);
  const c = new THREE.Mesh(G.esfera, m.folha);
  c.scale.set(2.2 * s, 2.4 * s, 2.2 * s);
  c.position.set(x, 1.3 * s + 1 * s, z);
  c.castShadow = true;
  pai.add(c);
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerpCor = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), clamp01(t)).getHex();

// ---------------------------------------------------------------- texturas (✓ e rótulos)

const cacheTex = new Map();
function texCheck(cor) {
  const k = 'chk' + cor;
  if (cacheTex.has(k)) return cacheTex.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = cor;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = '#ffffff';
  g.stroke();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 16;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(34, 66);
  g.lineTo(56, 88);
  g.lineTo(96, 42);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(k, t);
  return t;
}
function texRotulo(texto, destaque) {
  const k = 'r' + texto + (destaque ? '!' : '');
  if (cacheTex.has(k)) return cacheTex.get(k);
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const fs = 34;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(texto).width) + 28;
  c.width = w;
  c.height = 54;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  g.fillStyle = destaque ? 'rgba(255,176,0,0.95)' : 'rgba(30,36,32,0.78)';
  const r = 12;
  g.beginPath();
  g.roundRect(0, 0, w, 54, r);
  g.fill();
  g.fillStyle = destaque ? '#1d1d1b' : '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(texto, 14, 29);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { aspecto: w / 54 };
  cacheTex.set(k, t);
  return t;
}
const cacheSpriteMat = new Map();
function spriteMat(tex) {
  if (cacheSpriteMat.has(tex)) return cacheSpriteMat.get(tex);
  const m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  cacheSpriteMat.set(tex, m);
  return m;
}

// ---------------------------------------------------------------- avanço por visual

function pctsVisuais(idx, e, m) {
  const soma = {};
  const n = {};
  for (const et of etapasDoElem(idx, e)) {
    const p = clamp01(pctEtapa(idx, e, et, m) / 100);
    soma[et.visual] = (soma[et.visual] || 0) + p;
    n[et.visual] = (n[et.visual] || 0) + 1;
  }
  const r = {};
  for (const k of Object.keys(soma)) r[k] = soma[k] / n[k];
  r._tem = (k) => k in soma;
  return r;
}

// materiais da maquete ou cor única (modos de acompanhamento)
function paleta(tinta) {
  if (tinta) {
    const m = mat(tinta);
    const esc = mat(lerpCor(tinta, 0x000000, 0.25));
    return new Proxy({}, { get: (_, k) => (k === 'vidro' || k === 'asfalto' || k === 'imper' ? esc : m) });
  }
  const r = {};
  for (const [k, v] of Object.entries(CORES)) r[k] = mat(v);
  return r;
}

// ---------------------------------------------------------------- desenho por forma

function desenharCasa(g, e, p, M, plano = false) {
  const { w, d, h } = e;
  const v = (k) => p[k] || 0;
  if (v('terreno') > 0) {
    const t = v('terreno');
    const mm = M.__tinta ? M.terra : mat(lerpCor(CORES.terra, CORES.nivelado, t));
    caixa(g, mm, (w + 1.6) * Math.max(t, 0.2), 0.12, d + 1.6, -(w + 1.6) * (1 - Math.max(t, 0.2)) / 2, 0, 0, false);
  }
  if (v('paisagismo') > 0) {
    const s = v('paisagismo');
    caixa(g, M.grama, w + 1.6, 0.13, 2.2 * s, 0, 0, d / 2 + 0.8 + 1.1 * s, false);
    caixa(g, M.grama, w + 1.6, 0.13, 1.5 * s, 0, 0, -d / 2 - 0.8 - 0.75 * s, false);
    arvore(g, s, w / 2 - 1, d / 2 + 2.4, M);
  }
  const yb = v('terreno') > 0 ? 0.12 : 0;
  const fu = v('fundacao');
  if (fu > 0) caixa(g, M.concreto, w * fu, 0.2, d, -w * (1 - fu) / 2, yb, 0);
  const y0 = yb + (fu > 0 ? 0.2 : 0);
  const es = v('estrutura');
  if (es > 0) {
    const hc = h * Math.min(1, es * 1.15);
    const cols = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1]];
    for (const [cx, cz] of cols) caixa(g, M.estrutura, 0.25, hc, 0.25, cx * (w / 2 - 0.15), y0, cz * (d / 2 - 0.15));
    if (es > 0.85) {
      caixa(g, M.estrutura, w, 0.3, 0.22, 0, y0 + h - 0.3, d / 2 - 0.12);
      caixa(g, M.estrutura, w, 0.3, 0.22, 0, y0 + h - 0.3, -d / 2 + 0.12);
      caixa(g, M.estrutura, 0.22, 0.3, d, w / 2 - 0.12, y0 + h - 0.3, 0);
      caixa(g, M.estrutura, 0.22, 0.3, d, -w / 2 + 0.12, y0 + h - 0.3, 0);
    }
  }
  const pa = v('paredes');
  const ac = Math.max(v('acabamento'), 0);
  const corParede = M.__tinta ? M.reboco : mat(lerpCor(CORES.tijolo, CORES.reboco, ac));
  if (pa > 0) {
    const hp = (h - (es > 0.85 ? 0.3 : 0)) * pa;
    const t = 0.16;
    caixa(g, corParede, w - 0.1, hp, t, 0, y0, d / 2 - t / 2);
    caixa(g, corParede, w - 0.1, hp, t, 0, y0, -d / 2 + t / 2);
    caixa(g, corParede, t, hp, d - 0.1, w / 2 - t / 2, y0, 0);
    caixa(g, corParede, t, hp, d - 0.1, -w / 2 + t / 2, y0, 0);
    if (!plano) caixa(g, corParede, t, hp, d * 0.6, 0, y0, -d * 0.1); // divisória interna
  }
  const esq = Math.max(v('esquadrias'), ac);
  if (pa > 0.75 && esq > 0.25) {
    const yj = y0 + h * 0.35;
    const nj = Math.max(1, Math.round(w / 3.2));
    for (let i = 0; i < nj; i++) {
      const x = -w / 2 + (w / nj) * (i + 0.5);
      if (i === 0 && !plano) caixa(g, M.porta, 0.9, Math.min(2.1, h * 0.75), 0.06, x, y0, d / 2 + 0.02);
      else caixa(g, M.vidro, Math.min(1.5, w / nj - 0.6), h * 0.38, 0.06, x, yj, d / 2 + 0.02);
      caixa(g, M.vidro, Math.min(1.5, w / nj - 0.6), h * 0.38, 0.06, x, yj, -d / 2 - 0.02);
    }
  }
  const co = v('cobertura');
  const ytopo = y0 + h;
  if (co > 0 && !plano) {
    if (e.forma === 'casa') {
      const r = new THREE.Mesh(G.telhado, M.telha);
      r.scale.set((w + 0.6) * co, 1.5, d + 0.8);
      r.position.set(-(w + 0.6) * (1 - co) / 2, ytopo, 0);
      r.castShadow = true;
      g.add(r);
    } else {
      caixa(g, M.concreto, w * co, 0.2, d, -w * (1 - co) / 2, ytopo, 0);
      if (co > 0.9) {
        caixa(g, corParede, w, 0.5, 0.12, 0, ytopo + 0.2, d / 2 - 0.06);
        caixa(g, corParede, w, 0.5, 0.12, 0, ytopo + 0.2, -d / 2 + 0.06);
      }
    }
  }
  const im = v('impermeabilizacao');
  if (im > 0 && e.forma !== 'casa' && !plano) caixa(g, M.imper, w * im, 0.05, d, -w * (1 - im) / 2, ytopo + (co > 0 ? 0.2 : 0), 0, false);
  const ins = v('instalacoes');
  if (ins > 0) {
    cilindro(g, M.tubAgua, 0.06, Math.max(0.4, h * Math.min(1, ins * 1.4)), w / 2 + 0.12, y0, d / 2 - 1);
    if (ins > 0.3) caixa(g, M.metal, 0.5, 0.7, 0.18, -w / 2 + 0.8, y0 + 0.9, d / 2 + 0.1);
    if (ins > 0.7 && (co > 0.6 || plano)) caixa(g, M.tubAgua, 1.1, 0.8, 1.1, w / 4, ytopo + (e.forma === 'casa' ? 0.4 : 0.2), -d / 4);
  }
  const eq = v('equipamentos');
  if (eq > 0.3) caixa(g, M.metal, 0.9, 0.55, 0.35, -w / 2 - 0.25, y0 + 1.6, -d / 4);
  const pi = v('piso');
  if (pi > 0) caixa(g, M.piso, (w - 0.4) * pi, 0.06, d - 0.4, -(w - 0.4) * (1 - pi) / 2, y0, 0, false);
  return { topo: ytopo + (co > 0 && e.forma === 'casa' ? 1.6 : 0.6) };
}

function desenharApto(g, e, p, M) {
  const { w, d, h } = e;
  const v = (k) => p[k] || 0;
  const es = v('estrutura');
  if (es > 0) {
    caixa(g, M.concreto, w, 0.2, d, 0, 0, 0);
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) caixa(g, M.estrutura, 0.3, (h - 0.2) * Math.min(1, es * 1.2), 0.3, cx * (w / 2 - 0.15), 0.2, cz * (d / 2 - 0.15));
    if (es > 0.9) caixa(g, M.concreto, w, 0.2, d, 0, h - 0.2, 0);
  }
  const pa = v('paredes');
  const ac = v('acabamento');
  const corParede = M.__tinta ? M.reboco : mat(lerpCor(CORES.tijolo, CORES.reboco, ac));
  if (pa > 0) {
    const hp = (h - 0.4) * pa;
    caixa(g, corParede, w - 0.2, hp, 0.15, 0, 0.2, d / 2 - 0.1);
    caixa(g, corParede, w - 0.2, hp, 0.15, 0, 0.2, -d / 2 + 0.1);
    caixa(g, corParede, 0.15, hp, d - 0.2, w / 2 - 0.1, 0.2, 0);
    caixa(g, corParede, 0.15, hp, d - 0.2, -w / 2 + 0.1, 0.2, 0);
  }
  const esq = v('esquadrias');
  if (pa > 0.8 && esq > 0) {
    const ww = (w - 1.2) * Math.min(1, esq);
    caixa(g, M.vidro, ww, h * 0.4, 0.06, 0, h * 0.3, d / 2 - 0.0);
    caixa(g, M.vidro, ww, h * 0.4, 0.06, 0, h * 0.3, -d / 2 + 0.0);
  }
  const pi = v('piso');
  if (pi > 0) caixa(g, M.piso, (w - 0.4) * pi, 0.05, d - 0.4, -(w - 0.4) * (1 - pi) / 2, 0.2, 0, false);
  const ins = v('instalacoes');
  if (ins > 0) cilindro(g, M.tubAgua, 0.05, (h - 0.4) * Math.min(1, ins * 1.3), w / 2 - 0.5, 0.2, d / 2 - 0.5);
  const eq = v('equipamentos');
  if (eq > 0.2) caixa(g, M.reboco, 0.6 * eq + 0.2, 0.8, 0.5, -w / 2 + 0.8, 0.2, -d / 2 + 0.7);
  return { topo: h + 0.4 };
}

function desenharPiscina(g, e, p, M) {
  const { w, d, h } = e;
  const v = (k) => p[k] || 0;
  if (v('terreno') > 0) caixa(g, M.terra, (w + 3) * Math.max(0.2, v('terreno')), 0.1, d + 3, 0, 0, 0, false);
  const ac = v('acabamento');
  if (ac > 0) caixa(g, M.calcada, w + 3, 0.16, d + 3, 0, 0, 0, false);
  const es = Math.max(v('estrutura'), v('fundacao') * 0.4);
  const hb = Math.min(0.9, h * 0.6) * es;
  if (es > 0) {
    const t = 0.25;
    caixa(g, M.concreto, w, hb, t, 0, 0.1, d / 2 - t / 2);
    caixa(g, M.concreto, w, hb, t, 0, 0.1, -d / 2 + t / 2);
    caixa(g, M.concreto, t, hb, d, w / 2 - t / 2, 0.1, 0);
    caixa(g, M.concreto, t, hb, d, -w / 2 + t / 2, 0.1, 0);
  }
  if (v('fundacao') > 0) caixa(g, M.concreto, w * v('fundacao'), 0.08, d, 0, 0.1, 0, false);
  if (v('impermeabilizacao') > 0) caixa(g, M.imper, (w - 0.5) * v('impermeabilizacao'), 0.05, d - 0.5, 0, 0.18, 0, false);
  if (ac > 0.4) caixa(g, M.azulejo, w - 0.5, 0.05, d - 0.5, 0, 0.2, 0, false);
  const eq = v('equipamentos');
  if (eq > 0) {
    const agua = M.__tinta ? M.agua : mat(CORES.agua, { opacity: 0.8 });
    caixa(g, agua, w - 0.5, Math.max(0.05, hb - 0.15) * eq, d - 0.5, 0, 0.22, 0, false);
    caixa(g, M.metal, 1.6, 1.4 * eq, 1.4, w / 2 + 2.2, 0, -d / 2, true);
  }
  if (v('instalacoes') > 0) cilindro(g, M.tubAgua, 0.07, 0.5, -w / 2 - 0.6, 0, -d / 2 + 0.5);
  if (v('paisagismo') > 0) arvore(g, v('paisagismo'), -w / 2 - 1.5, d / 2 + 1.2, M);
  return { topo: 1.6 };
}

function desenharArea(g, e, p, M) {
  const { w, d } = e;
  const v = (k) => p[k] || 0;
  if (v('terreno') > 0) caixa(g, M.terra, w * Math.max(0.2, v('terreno')), 0.1, d, -w * (1 - Math.max(0.2, v('terreno'))) / 2, 0, 0, false);
  if (v('fundacao') > 0) caixa(g, M.concreto, w * v('fundacao'), 0.12, d, -w * (1 - v('fundacao')) / 2, 0, 0, false);
  if (v('paisagismo') > 0) caixa(g, M.grama, w * v('paisagismo'), 0.14, d, -w * (1 - v('paisagismo')) / 2, 0, 0, false);
  if (v('acabamento') > 0 && e.forma === 'playground') caixa(g, M.borracha, (w * 0.6) * v('acabamento'), 0.16, d * 0.6, 0, 0, 0, false);
  const eq = v('equipamentos');
  if (eq > 0) {
    if (e.forma === 'playground') {
      caixa(g, M.telha, 1.4, 2.2 * eq, 1.4, -w / 5, 0, 0);
      caixa(g, M.agua, 0.6, 0.15, 3 * eq, -w / 5 + 1, 1.2 * eq, 1.4);
      caixa(g, M.metal, 0.12, 2.2 * eq, 0.12, w / 5, 0, -1);
      caixa(g, M.metal, 0.12, 2.2 * eq, 0.12, w / 5 + 2.4, 0, -1);
      caixa(g, M.metal, 2.6, 0.12, 0.12, w / 5 + 1.2, 2.2 * eq, -1);
    } else {
      caixa(g, M.porta, 1.8, 0.45, 0.5, -w / 4, 0, d / 4);
      caixa(g, M.metal, 0.4, 0.9 * eq, 0.4, w / 4, 0, -d / 4);
    }
  }
  const ac = v('acabamento');
  if (ac > 0.3) {
    // alambrado / cerca
    const nPost = Math.round(10 * ac);
    for (let i = 0; i < nPost; i++) {
      const t = i / 10;
      caixa(g, M.metal, 0.08, 1.2, 0.08, -w / 2 + w * t, 0, d / 2);
      caixa(g, M.metal, 0.08, 1.2, 0.08, -w / 2 + w * t, 0, -d / 2);
    }
  }
  if (v('paisagismo') > 0.4) arvore(g, v('paisagismo'), w / 2 - 1.2, d / 2 - 1.2, M);
  return { topo: 2.6 };
}

function desenharReservatorio(g, e, p, M) {
  const { w, h } = e;
  const v = (k) => p[k] || 0;
  if (v('terreno') > 0) caixa(g, M.terra, w + 2, 0.1, w + 2, 0, 0, 0, false);
  if (v('fundacao') > 0) caixa(g, M.concreto, (w + 1) * v('fundacao'), 0.4, w + 1, 0, 0.1, 0);
  const es = v('estrutura');
  const cor = M.__tinta ? M.concreto : mat(lerpCor(CORES.concreto, 0xf1f1ee, v('acabamento')));
  if (es > 0) cilindro(g, cor, w / 2, h * es, 0, 0.5, 0);
  if (v('impermeabilizacao') > 0 && es > 0.9) cilindro(g, M.imper, w / 2 + 0.03, 0.15, 0, 0.5 + h, 0);
  if (v('instalacoes') > 0) cilindro(g, M.tubAgua, 0.12, 0.5 + h * v('instalacoes'), w / 2 + 0.4, 0, 0);
  if (v('equipamentos') > 0.3) caixa(g, M.metal, 1.4, 1.3, 1, -w / 2 - 1.3, 0, 0);
  return { topo: h + 1.5 };
}

function desenharLote(g, e, p, M) {
  const { w, d } = e;
  const v = (k) => p[k] || 0;
  const de = v('demarcacao');
  if (de > 0) {
    const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const n = Math.max(1, Math.round(4 * de));
    for (let i = 0; i < n; i++) caixa(g, M.estaca, 0.12, 0.8, 0.12, cantos[i][0] * (w / 2 - 0.1), 0, cantos[i][1] * (d / 2 - 0.1));
  }
  if (v('terreno') > 0) {
    const t = v('terreno');
    const mm = M.__tinta ? M.terra : mat(lerpCor(CORES.terra, CORES.nivelado, t));
    caixa(g, mm, w * t, 0.12, d, -w * (1 - t) / 2, 0, 0, false);
  }
  if (v('instalacoes') > 0) {
    const n = Math.max(1, Math.round(3 * v('instalacoes')));
    for (let i = 0; i < n; i++) caixa(g, [M.tubAgua, M.tubEsgoto, M.metal][i], 0.4, 0.5, 0.3, -w / 2 + 1 + i * 0.7, 0, d / 2 - 0.4);
  }
  if (v('calcada') > 0) caixa(g, M.calcada, w * v('calcada'), 0.15, 1.5, -w * (1 - v('calcada')) / 2, 0, d / 2 + 0.75, false);
  if (v('paisagismo') > 0) arvore(g, v('paisagismo'), 0, 0, M);
  return { topo: 1.2 };
}

function desenharRua(g, e, p, M) {
  const L = e.w;
  const W = e.d;
  const v = (k) => p[k] || 0;
  const faixa = (m, t, y, h, larg, z = 0) => t > 0 && caixa(g, m, L * t, h, larg, -L / 2 + (L * t) / 2, y, z, false);
  faixa(M.terra, v('terreno'), 0, 0.04, W + 3);
  if (e.forma === 'rua' || p._tem('drenagem')) {
    faixa(M.tubDren, v('drenagem'), 0.04, 0.12, 0.5, W / 2 - 0.6);
    const nPv = Math.floor((L / 30) * v('drenagem'));
    for (let i = 0; i < nPv; i++) cilindro(g, M.concreto, 0.45, 0.25, -L / 2 + 15 + i * 30, 0.02, W / 2 - 0.6);
  }
  faixa(M.tubAgua, v('rede_agua'), 0.04, 0.1, 0.25, -W / 4);
  faixa(M.tubEsgoto, v('rede_esgoto'), 0.04, 0.11, 0.35, W / 6);
  if (e.forma === 'rua') {
    faixa(M.brita, v('base'), 0.06, 0.06, W);
    faixa(M.asfalto, v('pavimento'), 0.12, 0.06, W);
    const si = v('sinalizacao');
    if (si > 0 && v('pavimento') > 0.5) {
      const n = Math.floor((L / 6) * si);
      for (let i = 0; i < n; i++) caixa(g, M.faixa, 2.5, 0.02, 0.15, -L / 2 + 3 + i * 6, 0.18, 0, false);
    }
    const ca = v('calcada');
    if (ca > 0) {
      faixa(M.calcada, ca, 0.04, 0.22, 2, W / 2 + 1);
      faixa(M.calcada, ca, 0.04, 0.22, 2, -W / 2 - 1);
    }
  }
  const il = v('iluminacao');
  if (il > 0) {
    const tot = Math.max(1, Math.round(L / 30));
    const n = Math.round(tot * il);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 15 + i * 30;
      cilindro(g, M.poste, 0.08, 7, x, 0, -W / 2 - 1.6);
      caixa(g, M.poste, 1.4, 0.12, 0.2, x, 6.9, -W / 2 - 1);
    }
  }
  return { topo: 2 };
}

function desenharElemento(idx, e, m, tinta) {
  const g = new THREE.Group();
  const p = pctsVisuais(idx, e, m);
  const M = paleta(tinta);
  if (tinta) M.__tinta = true;
  let info = { topo: e.h + 1 };
  switch (e.forma) {
    case 'casa': case 'bloco': info = desenharCasa(g, e, p, M); break;
    case 'apto': info = desenharApto(g, e, p, M); break;
    case 'piscina': info = desenharPiscina(g, e, p, M); break;
    case 'playground': case 'area': info = desenharArea(g, e, p, M); break;
    case 'reservatorio': info = desenharReservatorio(g, e, p, M); break;
    case 'lote': info = desenharLote(g, e, p, M); break;
    case 'rua': case 'rede': info = desenharRua(g, e, p, M); break;
    default: break;
  }
  return { grupo: g, topo: info.topo, pcts: p };
}

// cor de acompanhamento por avanço
export function corAvanco(pct, status) {
  if (status === 'finalizado') return CORES_STATUS.finalizado;
  if (status === 'entregue') return CORES_STATUS.entregue;
  if (pct <= 1e-6) return CORES_STATUS.nao_iniciado;
  if (pct >= 99.999) return CORES_STATUS.concluido;
  const c = new THREE.Color(CORES_STATUS.execucao_ini).lerp(new THREE.Color(CORES_STATUS.execucao_fim), pct / 100);
  return '#' + c.getHexString();
}

// ---------------------------------------------------------------- visualizador

export class Visualizador {
  constructor(container, { aoSelecionar, aoMover, aoColocarPersonagem, aoMudarCamera, aoSairCaminhada, aoPassar } = {}) {
    this.container = container;
    this.cb = { aoSelecionar, aoMover, aoColocarPersonagem, aoMudarCamera, aoSairCaminhada, aoPassar };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;
    this.canvas.tabIndex = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdfe6e3);
    this.scene.fog = new THREE.Fog(0xdfe6e3, 600, 1400);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 4000);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03;
    this.controls.screenSpacePanning = false;
    this.setFerramenta('mao');
    this.controls.listenToKeyEvents(window);
    this.controls.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };
    this.controls.addEventListener('change', () => {
      this.sujo = true;
      if (!this._sincronizando && this.cb.aoMudarCamera) this.cb.aoMudarCamera(this);
    });

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.6);
    this.scene.add(hemi);
    this.sol = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sol.position.set(120, 200, 90);
    this.sol.castShadow = true;
    this.sol.shadow.mapSize.set(2048, 2048);
    this.scene.add(this.sol);
    this.scene.add(this.sol.target);

    this.chao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xd8d3c2 }));
    this.chao.rotation.x = -Math.PI / 2;
    this.chao.receiveShadow = true;
    this.chao.userData.chao = true;
    this.scene.add(this.chao);
    this.grade = null;

    this.raiz = new THREE.Group();
    this.scene.add(this.raiz);
    this.extras = new THREE.Group();
    this.scene.add(this.extras);
    this.selGrupo = new THREE.Group();
    this.scene.add(this.selGrupo);
    this.planta = null;

    this.objs = new Map(); // elemId -> { grupo, topo }
    this.colisores = [];
    this.estado = {};
    this.sujo = true;
    this.fp = { ativo: false, pos: new THREE.Vector3(), yaw: 0, pitch: 0, teclas: new Set(), botoes: new Set(), vel: 4.2 };
    this.modoColocar = false;
    this.modoMover = false;

    this.personagem = criarPersonagem();
    this.personagem.visible = false;
    this.scene.add(this.personagem);

    this._eventos();
    this._redimensionar = () => this.redimensionar();
    new ResizeObserver(this._redimensionar).observe(container);
    this.redimensionar();
    this.relogio = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  redimensionar() {
    const w = Math.max(10, this.container.clientWidth);
    const h = Math.max(10, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.sujo = true;
  }

  // ferramenta do arraste com o botão esquerdo / um dedo: 'mao' desloca, 'girar' gira
  setFerramenta(f) {
    this.ferramenta = f;
    const c = this.controls;
    if (f === 'mao') {
      c.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
      c.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    } else {
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
      c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    }
    this._cursor();
  }

  _cursor(agarrando = false) {
    if (!this.canvas) return;
    const cv = this.canvas;
    if (this.fp && this.fp.ativo) cv.style.cursor = 'crosshair';
    else if (this.modoColocar) cv.style.cursor = 'copy';
    else if (this.modoMover) cv.style.cursor = 'move';
    else if (this.ferramenta === 'mao') cv.style.cursor = agarrando ? 'grabbing' : 'grab';
    else cv.style.cursor = agarrando ? 'grabbing' : 'default';
  }

  setPlantaVisivel(v) {
    this.plantaVisivel = v;
    if (this.planta) this.planta.visible = v;
    this.sujo = true;
  }

  temPlanta() { return !!this.planta; }

  setSombras(ativo) {
    this.renderer.shadowMap.enabled = ativo;
    this.sol.castShadow = ativo;
    this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.sujo = true;
  }

  // ------------------------------------------------ construção

  construir(idx, estado) {
    this.idx = idx;
    this.estado = estado;
    this.raiz.clear();
    this.extras.clear();
    this.objs.clear();
    this.colisores = [];
    const caixaTotal = new THREE.Box3();
    const obra = idx.obra;
    const { mes, modo, etapaFiltro, diff, rotulos } = estado;
    const folhas = obra.elementos.filter(ehFolha);
    for (const e of folhas) {
      if (e.forma === 'nenhuma') continue;
      const st = statusElem(idx, e, mes);
      let tinta = null;
      if (modo === 'avanco') tinta = corAvanco(progElem(idx, e, mes), st);
      else if (modo === 'etapa') {
        if (etapaFiltro && etapaFiltro !== 'todas') {
          const aplica = etapasDoElem(idx, e).some((x) => x.id === etapaFiltro);
          tinta = aplica ? corAvanco(progElem(idx, e, mes, etapaFiltro), null) : '#e7e6e0';
        } else tinta = corAvanco(progElem(idx, e, mes), st);
      } else if (modo === 'mudou' && diff) {
        const dd = diff.get(e.id);
        tinta = CORES_DIFF[dd ? dd.tipo : 'igual'];
        // quanto maior o avanço no período, mais escuro o verde
        if (dd && dd.tipo === 'avancou') tinta = '#' + new THREE.Color('#bfe5cb').lerp(new THREE.Color('#17693a'), clamp01(dd.delta / 30)).getHexString();
      }
      const { grupo, topo, pcts } = desenharElemento(idx, e, mes, tinta);
      grupo.position.set(e.x, e.y || 0, e.z);
      grupo.rotation.y = THREE.MathUtils.degToRad(e.rot || 0);
      grupo.userData.elemId = e.id;
      // caixa de seleção (invisível) e contorno do elemento
      const hb = e.forma === 'rua' || e.forma === 'rede' || e.forma === 'lote' || e.forma === 'area' || e.forma === 'playground' ? 0.4 : Math.max(0.5, e.h);
      const pick = new THREE.Mesh(G.caixa, matInvisivel);
      const wb = e.forma === 'reservatorio' ? e.w : e.w;
      pick.scale.set(wb, hb, e.forma === 'reservatorio' ? e.w : e.d);
      pick.userData.elemId = e.id;
      grupo.add(pick);
      const vazio = grupo.children.length <= 1;
      if (vazio || modo === 'mudou') {
        const c = new THREE.LineSegments(G.arestas, matContorno);
        c.scale.set(wb, hb, e.forma === 'reservatorio' ? e.w : e.d);
        grupo.add(c);
      }
      if (vazio) {
        // base clara para que elementos sem avanço continuem visíveis e clicáveis
        const cor = tinta && tinta !== CORES_STATUS.nao_iniciado ? tinta : 0xc9c4b3;
        const gh = new THREE.Mesh(G.caixa, mat(cor, { opacity: 0.75 }));
        gh.scale.set(wb, 0.25, e.forma === 'reservatorio' ? e.w : e.d);
        gh.receiveShadow = true;
        grupo.add(gh);
      }
      const conc = situacaoConclusao(obra, e.id, mes);
      if (conc) {
        const s = new THREE.Sprite(spriteMat(texCheck(conc === 'entregue' ? CORES_STATUS.entregue : '#1f9d55')));
        const tam = Math.max(1.6, Math.min(3.2, Math.max(e.w, e.d) / 4));
        s.scale.set(tam, tam, 1);
        s.position.set(0, topo + tam * 0.7, 0);
        s.renderOrder = 10;
        s.userData.check = true;
        grupo.add(s);
      }
      if (rotulos === 'todos') {
        const t = texRotulo(e.codigo || e.nome);
        const s = new THREE.Sprite(spriteMat(t));
        s.scale.set(0.9 * t.userData.aspecto, 0.9, 1);
        s.position.set(0, topo + (conc ? 3.4 : 0.9), 0);
        s.renderOrder = 9;
        grupo.add(s);
      }
      this.raiz.add(grupo);
      this.objs.set(e.id, { grupo, topo, elem: e });
      caixaTotal.expandByObject(grupo);
      // colisão
      const solido = (e.forma === 'casa' || e.forma === 'bloco') ? (pcts.paredes || 0) > 0.15 || (pcts.estrutura || 0) > 0.3
        : e.forma === 'apto' ? (e.y || 0) < 1.5 && ((pcts.paredes || 0) > 0.15 || (pcts.estrutura || 0) > 0.3)
          : e.forma === 'piscina' ? (pcts.estrutura || 0) > 0.05 || (pcts.fundacao || 0) > 0.05
            : e.forma === 'reservatorio' ? (pcts.estrutura || 0) > 0.05 : false;
      if (solido) {
        const r = THREE.MathUtils.degToRad(e.rot || 0);
        this.colisores.push({ x: e.x, z: e.z, c: Math.cos(r), s: Math.sin(r), hw: (e.forma === 'reservatorio' ? e.w : e.w) / 2, hd: (e.forma === 'reservatorio' ? e.w : e.d) / 2 });
      }
    }
    // rótulos dos grupos que contêm folhas (rank, pavimento, quadra...)
    if (rotulos === 'grupos' || rotulos === 'todos') {
      for (const gr of obra.elementos.filter((x) => !ehFolha(x))) {
        const fs = (idx.filhos.get(gr.id) || []).filter(ehFolha).filter((f) => this.objs.has(f.id));
        if (!fs.length) continue;
        const b = new THREE.Box3();
        for (const f of fs) b.expandByObject(this.objs.get(f.id).grupo);
        const c = b.getCenter(new THREE.Vector3());
        const t = texRotulo(gr.codigo || gr.nome);
        const s = new THREE.Sprite(spriteMat(t));
        const k = 1.5;
        s.scale.set(k * t.userData.aspecto, k, 1);
        s.position.set(c.x, b.max.y + 2.2, c.z);
        s.renderOrder = 8;
        this.extras.add(s);
      }
    }
    if (caixaTotal.isEmpty()) caixaTotal.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 5, 50));
    this.limites = caixaTotal;
    this._ajustarChao();
    this.desenharSelecao(estado.selecao || []);
    this.sujo = true;
  }

  _ajustarChao() {
    const b = this.limites.clone();
    if (this.planta && this.planta.visible) b.expandByObject(this.planta);
    const c = b.getCenter(new THREE.Vector3());
    const sz = b.getSize(new THREE.Vector3());
    const L = Math.max(sz.x, sz.z) + 80;
    this.chao.scale.set(L, L, 1);
    this.chao.position.set(c.x, -0.01, c.z);
    if (this.grade) this.scene.remove(this.grade);
    this.grade = new THREE.GridHelper(L, Math.round(L / 10), 0xbab4a2, 0xcac5b4);
    this.grade.position.set(c.x, 0, c.z);
    this.grade.material.transparent = true;
    this.grade.material.opacity = 0.35;
    this.scene.add(this.grade);
    const raio = Math.max(sz.x, sz.z) / 2 + 30;
    this.sol.position.set(c.x + raio * 0.6, raio * 1.2 + 60, c.z + raio * 0.5);
    this.sol.target.position.copy(c);
    const cam = this.sol.shadow.camera;
    cam.left = -raio; cam.right = raio; cam.top = raio; cam.bottom = -raio; cam.near = 1; cam.far = raio * 4 + 200;
    cam.updateProjectionMatrix();
    this.centro = c;
    this.raioCena = raio;
  }

  desenharSelecao(ids) {
    this.selGrupo.clear();
    if (!this.idx) return;
    const folhasSel = new Set();
    for (const id of ids) {
      const e = this.idx.elemById.get(id);
      if (!e) continue;
      const lista = ehFolha(e) ? [e] : this._folhasDe(id);
      for (const f of lista) folhasSel.add(f.id);
      if (!ehFolha(e)) {
        const b = new THREE.Box3();
        for (const f of lista) if (this.objs.has(f.id)) b.expandByObject(this.objs.get(f.id).grupo);
        if (!b.isEmpty()) {
          const helper = new THREE.Box3Helper(b.expandByScalar(0.6), 0xff8a00);
          this.selGrupo.add(helper);
        }
      }
    }
    for (const id of folhasSel) {
      const o = this.objs.get(id);
      if (!o) continue;
      const e = o.elem;
      const l = new THREE.LineSegments(G.arestas, matSelecao);
      const hb = Math.max(0.6, o.topo);
      l.scale.set((e.forma === 'reservatorio' ? e.w : e.w) + 0.4, hb, (e.forma === 'reservatorio' ? e.w : e.d) + 0.4);
      l.position.copy(o.grupo.position);
      l.rotation.copy(o.grupo.rotation);
      this.selGrupo.add(l);
    }
    this.sujo = true;
  }

  _folhasDe(id) {
    const r = [];
    const pilha = [id];
    while (pilha.length) {
      const k = pilha.pop();
      for (const f of this.idx.filhos.get(k) || []) {
        if (ehFolha(f)) r.push(f);
        else pilha.push(f.id);
      }
    }
    return r;
  }

  // ------------------------------------------------ planta de base

  setPlanta(img, base) {
    if (this.planta) {
      this.scene.remove(this.planta);
      this.planta.material.map?.dispose();
      this.planta.material.dispose();
      this.planta = null;
    }
    if (img && base && base.ativo) {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const asp = img.height / img.width;
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: base.opacidade ?? 0.85, depthWrite: false });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m);
      pl.rotation.x = -Math.PI / 2;
      pl.rotation.z = THREE.MathUtils.degToRad(base.rot || 0);
      pl.scale.set(base.largura || 200, (base.largura || 200) * asp, 1);
      pl.position.set(base.x || 0, 0.015, base.z || 0);
      pl.renderOrder = -1;
      this.planta = pl;
      pl.visible = this.plantaVisivel !== false;
      this.scene.add(pl);
    }
    if (this.limites) this._ajustarChao();
    this.sujo = true;
  }

  // ------------------------------------------------ câmera

  // distância para a obra inteira caber na tela, considerando a proporção do quadro
  _distanciaEnquadrar(fator = 1) {
    const sz = this.limites.getSize(new THREE.Vector3());
    const meia = Math.max(sz.x, sz.z) / 2 + 8;
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    return (meia / Math.tan(Math.min(vfov, hfov) / 2)) * fator;
  }

  vistaGeral() {
    if (!this.centro) return;
    this.sairCaminhada(false);
    const d = this._distanciaEnquadrar(0.82);
    const dir = new THREE.Vector3(-0.42, 0.62, 0.66).normalize();
    this.controls.target.copy(this.centro).setY(0);
    this.camera.position.copy(this.controls.target).addScaledVector(dir, d);
    this.camera.up.set(0, 1, 0);
    this.controls.update();
    this.sujo = true;
  }

  vistaSuperior() {
    if (!this.centro) return;
    this.sairCaminhada(false);
    const d = this._distanciaEnquadrar(0.95);
    this.controls.target.copy(this.centro).setY(0);
    this.camera.position.set(this.centro.x, d, this.centro.z + 0.01);
    this.controls.update();
    this.sujo = true;
  }

  focar(ids) {
    const b = new THREE.Box3();
    for (const id of ids) {
      const e = this.idx?.elemById.get(id);
      if (!e) continue;
      const lista = ehFolha(e) ? [e] : this._folhasDe(id);
      for (const f of lista) if (this.objs.has(f.id)) b.expandByObject(this.objs.get(f.id).grupo);
    }
    if (b.isEmpty()) return;
    this.sairCaminhada(false);
    const c = b.getCenter(new THREE.Vector3());
    const s = b.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.z, 26);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(c);
    this.camera.position.copy(c).addScaledVector(dir, r * 1.8 + 10);
    if (this.camera.position.y < 4) this.camera.position.y = r;
    this.controls.update();
    this.sujo = true;
  }

  estadoCamera() {
    return { p: this.camera.position.toArray(), t: this.controls.target.toArray() };
  }

  aplicarCamera(st) {
    if (!st) return;
    this._sincronizando = true;
    this.camera.position.fromArray(st.p);
    this.controls.target.fromArray(st.t);
    this.controls.update();
    this._sincronizando = false;
    this.sujo = true;
  }

  // ------------------------------------------------ personagem e caminhada

  posicionarPersonagem(x, z) {
    const p = this._resolverColisao(new THREE.Vector3(x, 0, z));
    this.personagem.position.set(p.x, 0, p.z);
    this.personagem.visible = true;
    this.sujo = true;
    return { x: p.x, z: p.z };
  }

  entrarCaminhada() {
    if (!this.personagem.visible) {
      const c = this.centro || new THREE.Vector3();
      this.posicionarPersonagem(c.x - (this.raioCena || 50) * 0.6, c.z);
    }
    const f = this.fp;
    f.ativo = true;
    f.pos.copy(this.personagem.position);
    const alvo = this.centro || new THREE.Vector3();
    f.yaw = Math.atan2(-(alvo.x - f.pos.x), -(alvo.z - f.pos.z));
    f.pitch = -0.05;
    this.personagem.visible = false;
    this.controls.enabled = false;
    this._camOrbita = this.estadoCamera();
    this.sujo = true;
  }

  sairCaminhada(restaurar = true) {
    const f = this.fp;
    if (!f.ativo) return;
    f.ativo = false;
    f.teclas.clear();
    f.botoes.clear();
    this.personagem.position.copy(f.pos);
    this.personagem.rotation.y = f.yaw;
    this.personagem.visible = true;
    this.controls.enabled = true;
    if (restaurar && this._camOrbita) {
      this.aplicarCamera(this._camOrbita);
    }
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    if (this.cb.aoSairCaminhada) this.cb.aoSairCaminhada();
    this.sujo = true;
  }

  _resolverColisao(p) {
    const r = 0.35;
    for (let it = 0; it < 3; it++) {
      for (const c of this.colisores) {
        const dx = p.x - c.x;
        const dz = p.z - c.z;
        // coordenadas locais do elemento (rotação em torno de y)
        const lx = dx * c.c - dz * c.s;
        const lz = dx * c.s + dz * c.c;
        const px = c.hw + r - Math.abs(lx);
        const pz = c.hd + r - Math.abs(lz);
        if (px > 0 && pz > 0) {
          let nx = lx;
          let nz = lz;
          if (px < pz) nx = Math.sign(lx || 1) * (c.hw + r);
          else nz = Math.sign(lz || 1) * (c.hd + r);
          p.x = c.x + nx * c.c + nz * c.s;
          p.z = c.z - nx * c.s + nz * c.c;
        }
      }
    }
    if (this.limites) {
      const m = 60;
      p.x = Math.max(this.limites.min.x - m, Math.min(this.limites.max.x + m, p.x));
      p.z = Math.max(this.limites.min.z - m, Math.min(this.limites.max.z + m, p.z));
    }
    return p;
  }

  _passoCaminhada(dt) {
    const f = this.fp;
    const t = f.teclas;
    const b = f.botoes;
    const corre = t.has('ShiftLeft') || t.has('ShiftRight') || b.has('correr');
    const v = f.vel * (corre ? 2.2 : 1) * dt;
    let fr = 0;
    let la = 0;
    if (t.has('KeyW') || t.has('ArrowUp') || b.has('frente')) fr += 1;
    if (t.has('KeyS') || t.has('ArrowDown') || b.has('tras')) fr -= 1;
    if (t.has('KeyD') || b.has('direita')) la += 1;
    if (t.has('KeyA') || b.has('esquerda')) la -= 1;
    if (t.has('ArrowLeft') || t.has('KeyQ') || b.has('girarE')) f.yaw += 1.8 * dt;
    if (t.has('ArrowRight') || t.has('KeyE') || b.has('girarD')) f.yaw -= 1.8 * dt;
    if (fr || la) {
      const sx = -Math.sin(f.yaw);
      const sz = -Math.cos(f.yaw);
      const nova = f.pos.clone();
      nova.x = f.pos.x + sx * fr * v + Math.cos(f.yaw) * la * v;
      nova.z = f.pos.z + sz * fr * v - Math.sin(f.yaw) * la * v;
      f.pos.copy(this._resolverColisao(nova));
    }
    const olho = 1.65;
    this.camera.position.set(f.pos.x, olho, f.pos.z);
    const dir = new THREE.Vector3(-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch));
    this.camera.lookAt(this.camera.position.clone().add(dir));
    this.sujo = true;
  }

  // ------------------------------------------------ eventos

  _eventos() {
    const cv = this.canvas;
    let down = null;
    let arrasto = null;
    const ray = new THREE.Raycaster();
    const ndc = (ev) => {
      const r = cv.getBoundingClientRect();
      return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    };
    const pontoChao = (ev) => {
      ray.setFromCamera(ndc(ev), this.camera);
      const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const p = new THREE.Vector3();
      return ray.ray.intersectPlane(plano, p) ? p : null;
    };
    this.pick = (ev) => {
      ray.setFromCamera(ndc(ev), this.camera);
      const hits = ray.intersectObjects(this.raiz.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.elemId) o = o.parent;
        if (o) return o.userData.elemId;
      }
      return null;
    };
    cv.addEventListener('pointerdown', () => this._cursor(true));
    window.addEventListener('pointerup', () => this._cursor(false));
    cv.addEventListener('pointerenter', () => this._cursor(false));
    cv.addEventListener('pointerdown', (ev) => {
      down = { x: ev.clientX, y: ev.clientY, t: performance.now(), id: ev.pointerId };
      if (this.fp.ativo) {
        cv.setPointerCapture(ev.pointerId);
        down.yaw = this.fp.yaw;
        down.pitch = this.fp.pitch;
        return;
      }
      if (this.modoMover && ev.button === 0) {
        const id = this.pick(ev);
        const sel = this.estado.selecao || [];
        if (id && this.idx) {
          const alvo = sel.find((s) => s === id || this._folhasDe(s).some((f) => f.id === id));
          if (alvo) {
            const p = pontoChao(ev);
            const ids = ehFolha(this.idx.elemById.get(alvo)) ? [alvo] : this._folhasDe(alvo).map((f) => f.id);
            arrasto = { inicio: p, ids, raizId: alvo, orig: ids.map((i) => this.objs.get(i)?.grupo.position.clone()) };
            this.controls.enabled = false;
            cv.setPointerCapture(ev.pointerId);
          }
        }
      }
    });
    // passar o mouse: avisa qual elemento está sob o cursor (sem botão apertado)
    let ultimoPasso = 0;
    cv.addEventListener('pointermove', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.buttons || this.fp.ativo || !this.cb.aoPassar) return;
      const t = performance.now();
      if (t - ultimoPasso < 70) return;
      ultimoPasso = t;
      this.cb.aoPassar(this.pick(ev), ev.clientX, ev.clientY);
    });
    cv.addEventListener('pointerleave', () => this.cb.aoPassar && this.cb.aoPassar(null));
    cv.addEventListener('pointerdown', () => this.cb.aoPassar && this.cb.aoPassar(null));
    cv.addEventListener('pointermove', (ev) => {
      if (this.fp.ativo && down && down.id === ev.pointerId) {
        const dx = ev.clientX - down.x;
        const dy = ev.clientY - down.y;
        this.fp.yaw = down.yaw - dx * 0.005;
        this.fp.pitch = Math.max(-1.2, Math.min(1.2, down.pitch - dy * 0.004));
        return;
      }
      if (this.fp.ativo && document.pointerLockElement === cv) {
        this.fp.yaw -= ev.movementX * 0.0025;
        this.fp.pitch = Math.max(-1.2, Math.min(1.2, this.fp.pitch - ev.movementY * 0.0025));
        return;
      }
      if (arrasto) {
        const p = pontoChao(ev);
        if (!p || !arrasto.inicio) return;
        const d = p.clone().sub(arrasto.inicio);
        arrasto.ids.forEach((id, i) => {
          const o = this.objs.get(id);
          if (o && arrasto.orig[i]) o.grupo.position.set(arrasto.orig[i].x + d.x, arrasto.orig[i].y, arrasto.orig[i].z + d.z);
        });
        arrasto.delta = d;
        this.selGrupo.visible = false;
        this.sujo = true;
      }
    });
    cv.addEventListener('pointerup', (ev) => {
      if (arrasto) {
        const d = arrasto.delta;
        this.controls.enabled = !this.fp.ativo;
        this.selGrupo.visible = true;
        const a = arrasto;
        arrasto = null;
        down = null;
        if (d && (Math.abs(d.x) > 0.01 || Math.abs(d.z) > 0.01) && this.cb.aoMover) this.cb.aoMover(a.raizId, Math.round(d.x * 100) / 100, Math.round(d.z * 100) / 100);
        return;
      }
      if (!down) return;
      const mov = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
      const d0 = down;
      down = null;
      if (mov > 6 || ev.button > 0) return;
      if (this.fp.ativo) {
        if (performance.now() - d0.t < 300 && ev.pointerType === 'mouse' && cv.requestPointerLock && !document.pointerLockElement) {
          try { cv.requestPointerLock(); } catch { /* sem suporte */ }
        }
        return;
      }
      if (this.modoColocar) {
        const p = pontoChao(ev);
        if (p && this.cb.aoColocarPersonagem) this.cb.aoColocarPersonagem(p.x, p.z);
        return;
      }
      const id = this.pick(ev);
      if (this.cb.aoSelecionar) this.cb.aoSelecionar(id, { aditivo: ev.shiftKey || ev.ctrlKey || ev.metaKey, duplo: false });
    });
    cv.addEventListener('dblclick', (ev) => {
      if (this.fp.ativo || this.modoColocar) return;
      const id = this.pick(ev);
      if (id && this.cb.aoSelecionar) this.cb.aoSelecionar(id, { duplo: true });
    });
    const tecla = (ev, on) => {
      const alvo = ev.target;
      if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable)) return;
      if (!this.fp.ativo) return;
      if (ev.code === 'Escape' && on) {
        this.sairCaminhada();
        return;
      }
      if (on) this.fp.teclas.add(ev.code);
      else this.fp.teclas.delete(ev.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(ev.code)) ev.preventDefault();
    };
    window.addEventListener('keydown', (ev) => tecla(ev, true));
    window.addEventListener('keyup', (ev) => tecla(ev, false));
    window.addEventListener('blur', () => this.fp.teclas.clear());
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.1, this.relogio.getDelta());
    if (this.fp.ativo) this._passoCaminhada(dt);
    else if (this.controls.enabled) this.controls.update();
    if (this.sujo) {
      this.sujo = false;
      this.renderer.render(this.scene, this.camera);
    }
  }
}

function criarPersonagem() {
  const g = new THREE.Group();
  const colete = mat(0xf07a1a);
  const calca = mat(0x2d3b55);
  const pele = mat(0xd9a77b);
  const capacete = mat(0xf5d020);
  caixa(g, calca, 0.16, 0.85, 0.18, -0.11, 0, 0);
  caixa(g, calca, 0.16, 0.85, 0.18, 0.11, 0, 0);
  caixa(g, colete, 0.48, 0.62, 0.26, 0, 0.85, 0);
  caixa(g, colete, 0.12, 0.55, 0.14, -0.31, 0.9, 0);
  caixa(g, colete, 0.12, 0.55, 0.14, 0.31, 0.9, 0);
  const cabeca = new THREE.Mesh(G.esfera, pele);
  cabeca.scale.set(0.26, 0.28, 0.26);
  cabeca.position.y = 1.62;
  g.add(cabeca);
  const cap = new THREE.Mesh(G.esfera, capacete);
  cap.scale.set(0.32, 0.2, 0.32);
  cap.position.y = 1.74;
  g.add(cap);
  // seta no chão indicando a frente
  const seta = new THREE.Mesh(G.cone, mat(0xf07a1a));
  seta.scale.set(0.5, 0.9, 0.5);
  seta.rotation.x = -Math.PI / 2;
  seta.position.set(0, 0.05, -0.9);
  g.add(seta);
  const anel = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 24), new THREE.MeshBasicMaterial({ color: 0xf07a1a, side: THREE.DoubleSide }));
  anel.rotation.x = -Math.PI / 2;
  anel.position.y = 0.03;
  g.add(anel);
  g.scale.setScalar(1.6); // um pouco maior que o real para ser visto de longe
  return g;
}
