// Modelos de obra, etapas padrão, geradores de estrutura e o preset do Villa Flora II.

import { uid } from './calc.js';
import { VF_R02 } from './villaflora-r02.js';

export const SCHEMA = 1;

export const TIPOS_OBRA = {
  condominio: 'Condomínio horizontal',
  edificio: 'Edifício',
  loteamento: 'Loteamento',
  outro: 'Outra obra',
};

export const CLASSES = {
  grupo: 'Grupo',
  unidade: 'Unidade',
  anexo: 'Área comum / anexo',
  infra: 'Infraestrutura',
};

export const GRUPOS_ETAPA = {
  unidade: 'Unidades',
  anexo: 'Áreas comuns',
  infra: 'Infraestrutura',
};

// formas que o 3D sabe desenhar
export const FORMAS = {
  casa: 'Casa',
  apto: 'Apartamento / pavimento',
  lote: 'Lote',
  bloco: 'Edificação (bloco)',
  piscina: 'Piscina',
  playground: 'Playground / área livre',
  area: 'Área descoberta',
  reservatorio: 'Reservatório',
  rua: 'Rua / via',
  rede: 'Rede linear (trecho)',
  nenhuma: 'Sem representação',
};

// representação visual que cada etapa aciona no 3D
export const VISUAIS = {
  terreno: 'Terreno / terraplenagem',
  fundacao: 'Fundação / radier',
  estrutura: 'Estrutura',
  paredes: 'Alvenaria / vedação',
  cobertura: 'Cobertura',
  impermeabilizacao: 'Impermeabilização',
  instalacoes: 'Instalações',
  esquadrias: 'Esquadrias',
  piso: 'Contrapiso / piso',
  acabamento: 'Acabamento / pintura',
  equipamentos: 'Equipamentos',
  paisagismo: 'Paisagismo',
  drenagem: 'Drenagem',
  rede_agua: 'Rede de água',
  rede_esgoto: 'Rede de esgoto',
  base: 'Base e sub-base',
  pavimento: 'Pavimentação',
  calcada: 'Calçadas / guias',
  iluminacao: 'Iluminação',
  sinalizacao: 'Sinalização',
  demarcacao: 'Demarcação',
  generico: 'Genérico (cor)',
};

export const UNIDADES = ['%', 'm²', 'm³', 'm', 'kg', 'un', 'vb'];

function et(nome, grupo, visual, peso, unidade = '%', qtdPadrao = 100) {
  return { nome, grupo, visual, peso, unidade, qtdPadrao };
}

// Pesos padrão provisórios: ajuste pela curva do orçamento da obra.
export const ETAPAS_CASA = [
  et('Terraplenagem', 'unidade', 'terreno', 5),
  et('Fundações', 'unidade', 'fundacao', 10),
  et('Estrutura', 'unidade', 'estrutura', 15),
  et('Alvenaria', 'unidade', 'paredes', 20),
  et('Cobertura', 'unidade', 'cobertura', 12),
  et('Instalações', 'unidade', 'instalacoes', 15),
  et('Acabamentos', 'unidade', 'acabamento', 18),
  et('Paisagismo', 'unidade', 'paisagismo', 5),
];

export const ETAPAS_APTO = [
  et('Estrutura', 'unidade', 'estrutura', 25),
  et('Alvenaria', 'unidade', 'paredes', 15),
  et('Instalações', 'unidade', 'instalacoes', 15),
  et('Contrapiso', 'unidade', 'piso', 8),
  et('Esquadrias', 'unidade', 'esquadrias', 10),
  et('Revestimentos e pintura', 'unidade', 'acabamento', 20),
  et('Louças e metais', 'unidade', 'equipamentos', 7),
];

export const ETAPAS_LOTE = [
  et('Demarcação', 'unidade', 'demarcacao', 10),
  et('Terraplenagem do lote', 'unidade', 'terreno', 40),
  et('Ligações (água, esgoto, energia)', 'unidade', 'instalacoes', 30),
  et('Calçada do lote', 'unidade', 'calcada', 20),
];

export const ETAPAS_ANEXO = [
  et('Terraplenagem', 'anexo', 'terreno', 5),
  et('Fundações', 'anexo', 'fundacao', 10),
  et('Estrutura', 'anexo', 'estrutura', 15),
  et('Alvenaria / fechamento', 'anexo', 'paredes', 15),
  et('Cobertura', 'anexo', 'cobertura', 10),
  et('Impermeabilização', 'anexo', 'impermeabilizacao', 8),
  et('Instalações', 'anexo', 'instalacoes', 12),
  et('Acabamentos', 'anexo', 'acabamento', 13),
  et('Equipamentos', 'anexo', 'equipamentos', 7),
  et('Paisagismo', 'anexo', 'paisagismo', 5),
];

export const ETAPAS_INFRA = [
  et('Terraplenagem', 'infra', 'terreno', 10, 'm²', 1000),
  et('Drenagem', 'infra', 'drenagem', 15, 'm', 100),
  et('Rede de água', 'infra', 'rede_agua', 10, 'm', 100),
  et('Rede de esgoto', 'infra', 'rede_esgoto', 12, 'm', 100),
  et('Base e sub-base', 'infra', 'base', 13, 'm²', 1000),
  et('Pavimentação', 'infra', 'pavimento', 20, 'm²', 1000),
  et('Guias e calçadas', 'infra', 'calcada', 10, 'm', 200),
  et('Iluminação', 'infra', 'iluminacao', 6, 'un', 4),
  et('Sinalização', 'infra', 'sinalizacao', 4),
];

// etapas que normalmente não fazem sentido para cada forma de área comum
export const EXCLUSOES_POR_FORMA = {
  piscina: ['Alvenaria / fechamento', 'Cobertura'],
  playground: ['Estrutura', 'Alvenaria / fechamento', 'Cobertura', 'Impermeabilização'],
  area: ['Estrutura', 'Alvenaria / fechamento', 'Cobertura', 'Impermeabilização'],
  reservatorio: ['Alvenaria / fechamento', 'Cobertura', 'Paisagismo'],
};

export function criarEtapas(lista) {
  return lista.map((x, i) => ({ id: uid('et'), ordem: i + 1, ...x }));
}

export function obraVazia({ nome, tipo = 'outro', descricao = '', inicio, termino } = {}) {
  const hoje = new Date();
  const ini = inicio || `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;
  const fim = termino || `${hoje.getFullYear() + 2}-${String(hoje.getMonth() + 1).padStart(2, '0')}-28`;
  return normalizar({
    schema: SCHEMA,
    id: uid('obra'),
    nome: nome || 'Nova obra',
    tipo,
    descricao,
    inicio: ini,
    termino: fim,
    arquivada: false,
    esquematico: true,
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
    config: { casasPorRank: 3 },
    etapas: [],
    elementos: [],
    lancamentos: {},
    conclusoes: {},
    revisoes: [],
    documentos: [],
    personagem: null,
  });
}

// garante campos obrigatórios (também usado ao importar e ao abrir dados antigos)
export function normalizar(o) {
  o.schema = SCHEMA;
  o.config = o.config || {};
  o.etapas = Array.isArray(o.etapas) ? o.etapas : [];
  o.elementos = Array.isArray(o.elementos) ? o.elementos : [];
  o.lancamentos = o.lancamentos && typeof o.lancamentos === 'object' ? o.lancamentos : {};
  o.conclusoes = o.conclusoes && typeof o.conclusoes === 'object' ? o.conclusoes : {};
  o.revisoes = Array.isArray(o.revisoes) ? o.revisoes : [];
  o.documentos = Array.isArray(o.documentos) ? o.documentos : [];
  o.etapas.forEach((x, i) => {
    x.id = x.id || uid('et');
    x.ordem = typeof x.ordem === 'number' ? x.ordem : i + 1;
    x.unidade = x.unidade || '%';
    x.peso = typeof x.peso === 'number' ? x.peso : 1;
    x.grupo = x.grupo || 'unidade';
    x.visual = x.visual || 'generico';
    x.qtdPadrao = typeof x.qtdPadrao === 'number' ? x.qtdPadrao : 100;
  });
  o.elementos.forEach((e, i) => {
    e.id = e.id || uid('el');
    e.paiId = e.paiId || null;
    e.classe = e.classe || 'unidade';
    e.categoria = e.categoria || '';
    e.nome = e.nome || `Elemento ${i + 1}`;
    e.codigo = e.codigo || '';
    e.forma = e.forma || (e.classe === 'grupo' ? 'nenhuma' : 'bloco');
    for (const k of ['x', 'y', 'z', 'rot']) e[k] = typeof e[k] === 'number' ? e[k] : 0;
    e.w = typeof e.w === 'number' ? e.w : 8;
    e.d = typeof e.d === 'number' ? e.d : 8;
    e.h = typeof e.h === 'number' ? e.h : 3;
    e.peso = typeof e.peso === 'number' ? e.peso : 1;
    e.etapasExcluidas = Array.isArray(e.etapasExcluidas) ? e.etapasExcluidas : [];
    e.quantidades = e.quantidades && typeof e.quantidades === 'object' ? e.quantidades : {};
    e.ordem = typeof e.ordem === 'number' ? e.ordem : i;
  });
  for (const [k, l] of Object.entries(o.conclusoes)) {
    if (!Array.isArray(l) || !l.length) delete o.conclusoes[k];
    else l.forEach((ev, i) => { ev.id = ev.id || uid('c'); ev.seq = ev.seq || i + 1; });
  }
  return o;
}

function elem(campos) {
  return {
    id: uid('el'),
    paiId: null,
    classe: 'grupo',
    categoria: '',
    nome: '',
    codigo: '',
    forma: 'nenhuma',
    x: 0, y: 0, z: 0, rot: 0, w: 8, d: 8, h: 3,
    peso: 1,
    etapasExcluidas: [],
    quantidades: {},
    ordem: 0,
    ...campos,
  };
}

function exclusoesPara(obra, forma) {
  const nomes = EXCLUSOES_POR_FORMA[forma] || [];
  return obra.etapas.filter((e) => e.grupo === 'anexo' && nomes.includes(e.nome)).map((e) => e.id);
}

export function novoElemento(obra, campos) {
  const e = elem(campos);
  if (e.classe === 'anexo') e.etapasExcluidas = exclusoesPara(obra, e.forma);
  return e;
}

// ---------------------------------------------------------------- áreas comuns

export const ANEXOS_CONDOMINIO = [
  ['Guarita', 'bloco', 6, 5, 3],
  ['Salão de festas', 'bloco', 16, 10, 3.5],
  ['Piscina adulto', 'piscina', 12, 6, 1.4],
  ['Piscina infantil', 'piscina', 5, 4, 0.6],
  ['Academia', 'bloco', 10, 8, 3.2],
  ['Brinquedoteca', 'bloco', 8, 7, 3],
  ['Churrasqueira', 'bloco', 8, 6, 3],
  ['Playground', 'playground', 12, 10, 0.4],
  ['Pet place', 'area', 12, 10, 0.3],
  ['Reservatório', 'reservatorio', 6, 6, 9],
  ['Depósito de lixo', 'bloco', 5, 4, 2.6],
  ['Depósito / DML', 'bloco', 5, 4, 2.8],
];

// ---------------------------------------------------------------- geradores

// Condomínio horizontal: fases > ranks > casas, ranks em fileiras com ruas entre elas.
export function gerarCondominio(obra, {
  fases = 3,
  ranksPorFase = [8, 8, 8],
  casasPorRank = 3,
  larguraCasa = 7,
  profCasa = 11,
  alturaCasa = 3,
  ranksPorFileira = 11,
  prefixoCasa = 'Casa',
  comAnexos = true,
  comRuas = true,
  quadras = false,
} = {}) {
  obra.config.casasPorRank = casasPorRank;
  if (!obra.etapas.some((e) => e.grupo === 'unidade')) obra.etapas.push(...criarEtapas(ETAPAS_CASA));
  if (comAnexos && !obra.etapas.some((e) => e.grupo === 'anexo')) obra.etapas.push(...criarEtapas(ETAPAS_ANEXO).map((x, i) => ({ ...x, ordem: 100 + i })));
  if (comRuas && !obra.etapas.some((e) => e.grupo === 'infra')) obra.etapas.push(...criarEtapas(ETAPAS_INFRA).map((x, i) => ({ ...x, ordem: 200 + i })));

  const els = [];
  const compRank = casasPorRank * larguraCasa;
  const gapRank = 4;
  const passoX = compRank + gapRank;
  const rua = 10;
  const passoFileira = profCasa * 2 + 2 + rua; // duas fileiras de costas + rua
  let rankGlobal = 0;
  let casaGlobal = 0;
  const totalRanks = ranksPorFase.slice(0, fases).reduce((a, b) => a + b, 0);
  const fileiras = Math.ceil(totalRanks / ranksPorFileira);
  const larguraTotal = ranksPorFileira * passoX;
  const x0 = -larguraTotal / 2 + compRank / 2;

  for (let f = 0; f < fases; f++) {
    const fase = elem({ classe: 'grupo', categoria: 'fase', nome: `Fase ${f + 1}`, codigo: `F${f + 1}`, ordem: f });
    els.push(fase);
    const nr = ranksPorFase[f] ?? ranksPorFase[ranksPorFase.length - 1] ?? 0;
    let quadra = null;
    for (let r = 0; r < nr; r++) {
      const fileira = Math.floor(rankGlobal / ranksPorFileira);
      const col = rankGlobal % ranksPorFileira;
      // fileiras alternam frente para rua acima / abaixo
      const bloco = Math.floor(fileira / 2);
      const lado = fileira % 2;
      const zc = bloco * passoFileira + (lado === 0 ? 0 : profCasa + 2);
      const xc = x0 + col * passoX;
      if (quadras && col === 0) {
        quadra = elem({ classe: 'grupo', categoria: 'quadra', nome: `Quadra ${fileira + 1}`, codigo: `Q${fileira + 1}`, paiId: fase.id, ordem: r });
        els.push(quadra);
      }
      const codRank = `R${String(rankGlobal + 1).padStart(2, '0')}`;
      const rank = elem({ classe: 'grupo', categoria: 'rank', nome: `Rank ${codRank.slice(1)}`, codigo: codRank, paiId: (quadra || fase).id, x: xc, z: zc, w: compRank, d: profCasa, ordem: r });
      els.push(rank);
      for (let c = 0; c < casasPorRank; c++) {
        casaGlobal++;
        const num = String(casaGlobal).padStart(3, '0');
        els.push(elem({
          classe: 'unidade', categoria: 'casa', forma: 'casa',
          nome: `${prefixoCasa} ${num}`, codigo: num, paiId: rank.id,
          x: xc - compRank / 2 + larguraCasa / 2 + c * larguraCasa, z: zc,
          rot: lado === 0 ? 0 : 180,
          w: larguraCasa - 0.2, d: profCasa - 1, h: alturaCasa, ordem: c,
        }));
      }
      rankGlobal++;
    }
  }

  const zMin = -profCasa / 2 - rua / 2 - 1;
  const ultimoBloco = Math.ceil(fileiras / 2);
  if (comRuas) {
    const infra = elem({ classe: 'grupo', categoria: 'infraestrutura', nome: 'Infraestrutura viária', codigo: 'INFRA', ordem: 900 });
    els.push(infra);
    const comp = larguraTotal + 10;
    // ruas longitudinais entre os blocos de fileiras
    for (let b = 0; b <= ultimoBloco; b++) {
      const z = b === 0 ? zMin : b * passoFileira - rua / 2 - 1;
      const nomeRua = `Rua ${String.fromCharCode(65 + b)}`;
      els.push(novoElementoInfra(obra, { nome: nomeRua, codigo: `RUA-${String.fromCharCode(65 + b)}`, paiId: infra.id, x: -5, z, w: comp, d: rua - 2, ordem: b }, comp, rua - 2));
    }
    // via de acesso transversal
    const zMax = ultimoBloco * passoFileira - rua / 2 - 1;
    els.push(novoElementoInfra(obra, { nome: 'Avenida de acesso', codigo: 'AV-1', paiId: infra.id, x: x0 - compRank / 2 - 9, z: (zMin + zMax) / 2, w: zMax - zMin + rua, d: 8, rot: 90, ordem: 50 }, zMax - zMin + rua, 8));
  }

  if (comAnexos) {
    const lazer = elem({ classe: 'grupo', categoria: 'areas_comuns', nome: 'Áreas comuns', codigo: 'AC', ordem: 800 });
    els.push(lazer);
    const xBase = x0 - compRank / 2 - 30;
    let zc = zMin - 2;
    let coluna = 0;
    ANEXOS_CONDOMINIO.forEach(([nome, forma, w, d, h], i) => {
      if (i === 6) { coluna = 1; zc = zMin - 2; }
      const x = xBase - coluna * 22;
      const e = novoElemento(obra, { classe: 'anexo', categoria: 'area_comum', forma, nome, codigo: `AC-${String(i + 1).padStart(2, '0')}`, paiId: lazer.id, x, z: zc + d / 2, w, d, h, ordem: i });
      els.push(e);
      zc += d + 5;
    });
  }
  obra.elementos.push(...els);
  return els;
}

function novoElementoInfra(obra, campos, comp, larg) {
  const e = elem({ classe: 'infra', categoria: 'via', forma: 'rua', h: 0.2, ...campos });
  // quantidades da via estimadas pelas dimensões (ajuste conforme projeto)
  for (const etp of obra.etapas.filter((x) => x.grupo === 'infra')) {
    if (etp.unidade === 'm²') e.quantidades[etp.id] = Math.round(comp * larg);
    else if (etp.unidade === 'm') e.quantidades[etp.id] = Math.round(etp.visual === 'calcada' ? comp * 2 : comp);
    else if (etp.unidade === 'un') e.quantidades[etp.id] = Math.max(2, Math.round(comp / 30));
  }
  return e;
}

// Edifício: torres > pavimentos > apartamentos, mais áreas comuns no térreo.
export function gerarEdificio(obra, { torres = 1, pavimentos = 10, aptosPorPav = 4, peDireito = 2.9, larguraTorre = 24, profTorre = 16, comAnexos = true } = {}) {
  if (!obra.etapas.some((e) => e.grupo === 'unidade')) obra.etapas.push(...criarEtapas(ETAPAS_APTO));
  if (comAnexos && !obra.etapas.some((e) => e.grupo === 'anexo')) obra.etapas.push(...criarEtapas(ETAPAS_ANEXO).map((x, i) => ({ ...x, ordem: 100 + i })));
  const els = [];
  for (let t = 0; t < torres; t++) {
    const xt = (t - (torres - 1) / 2) * (larguraTorre + 20);
    const torre = elem({ classe: 'grupo', categoria: 'torre', nome: `Torre ${String.fromCharCode(65 + t)}`, codigo: `T${String.fromCharCode(65 + t)}`, x: xt, z: 0, w: larguraTorre, d: profTorre, ordem: t });
    els.push(torre);
    for (let p = 0; p < pavimentos; p++) {
      const pav = elem({ classe: 'grupo', categoria: 'pavimento', nome: p === 0 ? 'Térreo' : `${p}º pavimento`, codigo: `${torre.codigo}-P${String(p).padStart(2, '0')}`, paiId: torre.id, x: xt, y: p * peDireito, w: larguraTorre, d: profTorre, ordem: p });
      els.push(pav);
      if (p === 0) {
        els.push(novoElemento(obra, { classe: 'anexo', categoria: 'area_comum', forma: 'apto', nome: `Hall e áreas comuns ${torre.codigo}`, codigo: `${torre.codigo}-HALL`, paiId: pav.id, x: xt, y: 0, z: 0, w: larguraTorre, d: profTorre, h: peDireito, ordem: 0 }));
        continue;
      }
      const cols = Math.ceil(aptosPorPav / 2);
      const wa = larguraTorre / cols;
      const da = profTorre / 2;
      for (let a = 0; a < aptosPorPav; a++) {
        const c = a % cols;
        const lin = Math.floor(a / cols);
        const num = `${p}${String(a + 1).padStart(2, '0')}`;
        els.push(elem({
          classe: 'unidade', categoria: 'apartamento', forma: 'apto', nome: `Apto ${num} ${torre.codigo}`, codigo: `${torre.codigo}-${num}`, paiId: pav.id,
          x: xt - larguraTorre / 2 + wa / 2 + c * wa, y: p * peDireito, z: -profTorre / 2 + da / 2 + lin * da, w: wa - 0.1, d: da - 0.1, h: peDireito, ordem: a,
        }));
      }
    }
  }
  if (comAnexos) {
    const lazer = elem({ classe: 'grupo', categoria: 'areas_comuns', nome: 'Lazer e apoio', codigo: 'LZ', ordem: 800 });
    els.push(lazer);
    [['Piscina', 'piscina', 12, 6, 1.4], ['Salão de festas', 'bloco', 14, 9, 3.5], ['Playground', 'playground', 10, 8, 0.4], ['Guarita', 'bloco', 5, 4, 3]].forEach(([nome, forma, w, d, h], i) => {
      els.push(novoElemento(obra, { classe: 'anexo', categoria: 'area_comum', forma, nome, codigo: `LZ-${i + 1}`, paiId: lazer.id, x: -larguraTorre / 2 - 20 + (i % 2) * 18, z: profTorre / 2 + 14 + Math.floor(i / 2) * 14, w, d, h, ordem: i }));
    });
  }
  obra.elementos.push(...els);
  return els;
}

// Loteamento: setores > quadras > lotes, mais ruas e redes por trecho.
export function gerarLoteamento(obra, { setores = 2, quadrasPorSetor = 4, lotesPorQuadra = 20, frente = 10, fundo = 25 } = {}) {
  if (!obra.etapas.some((e) => e.grupo === 'unidade')) obra.etapas.push(...criarEtapas(ETAPAS_LOTE));
  if (!obra.etapas.some((e) => e.grupo === 'infra')) obra.etapas.push(...criarEtapas(ETAPAS_INFRA).map((x, i) => ({ ...x, ordem: 200 + i })));
  const els = [];
  const lotesLado = Math.ceil(lotesPorQuadra / 2);
  const wq = lotesLado * frente;
  const dq = fundo * 2;
  const rua = 12;
  const infra = elem({ classe: 'grupo', categoria: 'infraestrutura', nome: 'Infraestrutura', codigo: 'INFRA', ordem: 900 });
  els.push(infra);
  let q = 0;
  const colunas = Math.min(quadrasPorSetor, 4);
  for (let s = 0; s < setores; s++) {
    const setor = elem({ classe: 'grupo', categoria: 'setor', nome: `Setor ${s + 1}`, codigo: `S${s + 1}`, ordem: s });
    els.push(setor);
    for (let k = 0; k < quadrasPorSetor; k++) {
      const col = q % colunas;
      const lin = Math.floor(q / colunas);
      const xq = col * (wq + rua);
      const zq = lin * (dq + rua);
      const quadra = elem({ classe: 'grupo', categoria: 'quadra', nome: `Quadra ${q + 1}`, codigo: `Q${String(q + 1).padStart(2, '0')}`, paiId: setor.id, x: xq, z: zq, w: wq, d: dq, ordem: k });
      els.push(quadra);
      for (let l = 0; l < lotesPorQuadra; l++) {
        const lado = l < lotesLado ? 0 : 1;
        const i = l % lotesLado;
        els.push(elem({
          classe: 'unidade', categoria: 'lote', forma: 'lote', nome: `Lote ${l + 1} ${quadra.codigo}`, codigo: `${quadra.codigo}-L${String(l + 1).padStart(2, '0')}`, paiId: quadra.id,
          x: xq - wq / 2 + frente / 2 + i * frente, z: zq - dq / 2 + fundo / 2 + lado * fundo, rot: lado ? 180 : 0, w: frente - 0.3, d: fundo - 0.3, h: 0.2, ordem: l,
        }));
      }
      q++;
    }
  }
  const linhas = Math.ceil(q / colunas);
  for (let r = 0; r <= linhas; r++) {
    const z = r * (dq + rua) - dq / 2 - rua / 2;
    const comp = colunas * (wq + rua);
    els.push(novoElementoInfra(obra, { nome: `Rua ${r + 1}`, codigo: `RUA-${r + 1}`, paiId: infra.id, x: (colunas - 1) * (wq + rua) / 2, z, w: comp, d: rua - 2, ordem: r }, comp, rua - 2));
  }
  for (let c = 0; c <= colunas; c++) {
    const x = c * (wq + rua) - wq / 2 - rua / 2;
    const comp = linhas * (dq + rua);
    els.push(novoElementoInfra(obra, { nome: `Travessa ${c + 1}`, codigo: `TV-${c + 1}`, paiId: infra.id, x, z: (linhas - 1) * (dq + rua) / 2, w: comp, d: rua - 2, rot: 90, ordem: 100 + c }, comp, rua - 2));
  }
  obra.elementos.push(...els);
  return els;
}

// Outras obras: setores > blocos > frentes de serviço.
export function gerarOutro(obra, { setores = 2, blocosPorSetor = 3, frentesPorBloco = 2 } = {}) {
  if (!obra.etapas.some((e) => e.grupo === 'unidade')) obra.etapas.push(...criarEtapas(ETAPAS_ANEXO.map((x) => ({ ...x, grupo: 'unidade' }))));
  const els = [];
  for (let s = 0; s < setores; s++) {
    const setor = elem({ classe: 'grupo', categoria: 'setor', nome: `Setor ${s + 1}`, codigo: `S${s + 1}`, ordem: s });
    els.push(setor);
    for (let b = 0; b < blocosPorSetor; b++) {
      const bloco = elem({ classe: 'grupo', categoria: 'bloco', nome: `Bloco ${s + 1}.${b + 1}`, codigo: `B${s + 1}${b + 1}`, paiId: setor.id, ordem: b });
      els.push(bloco);
      for (let f = 0; f < frentesPorBloco; f++) {
        els.push(elem({ classe: 'unidade', categoria: 'frente', forma: 'bloco', nome: `Frente ${s + 1}.${b + 1}.${f + 1}`, codigo: `F${s + 1}${b + 1}${f + 1}`, paiId: bloco.id, x: b * 30 + f * 13 - 30, z: s * 30, w: 11, d: 18, h: 6, ordem: f }));
      }
    }
  }
  obra.elementos.push(...els);
  return els;
}

// ---------------------------------------------------------------- Villa Flora II

export const VILLA_FLORA_DOCS = ['1002.ARQ.EX.0001.IMP-R01.pdf', 'Villa Flora II - Desenho Plano de Ataque_R02.pdf'];

// Estrutura extraída do Plano de Ataque R02 (tools/extrair_villaflora.py):
// fases, trechos, ranks, numeração real das casas, posições e áreas comuns.
const ROMANO = ['I', 'II', 'III'];
const pad = (n, k) => String(n).padStart(k, '0');

export function criarVillaFlora() {
  const o = obraVazia({
    nome: 'Villa Flora II',
    tipo: 'condominio',
    descricao: 'Villa Flora Americana · Condomínio das Azaleias. 66 ranks de casas geminadas 3 a 3 (198 casas) em 3 fases e 18 trechos, conforme o Plano de Ataque R02. Áreas pelo quadro de áreas da implantação 1002.ARQ.EX.0001.IMP-R01.',
    inicio: '2026-01-01',
    termino: '2028-06-30',
  });
  o.etapas.push(...criarEtapas(ETAPAS_CASA));
  o.etapas.push(...criarEtapas(ETAPAS_ANEXO).map((x, i) => ({ ...x, ordem: 100 + i })));
  o.etapas.push(...criarEtapas(ETAPAS_INFRA).map((x, i) => ({ ...x, ordem: 200 + i })));
  const D = VF_R02;
  const els = [];
  const fases = [1, 2, 3].map((f) => {
    const n = D.ranks.filter((r) => r.fase === f).length * 3;
    const e = elem({ classe: 'grupo', categoria: 'fase', nome: `Fase ${ROMANO[f - 1]}`, codigo: `F${f}`, ordem: f });
    e.obs = `${n} unidades${f === 1 ? ' + áreas comuns' : ''}`;
    els.push(e);
    return e;
  });
  const faseDoTrecho = (t) => (t <= 9 ? 1 : t <= 13 ? 2 : 3);
  const trechos = new Map();
  for (let t = 1; t <= 18; t++) {
    const e = elem({ classe: 'grupo', categoria: 'trecho', nome: `Trecho ${pad(t, 2)}`, codigo: `T${pad(t, 2)}`, paiId: fases[faseDoTrecho(t) - 1].id, ordem: t });
    trechos.set(t, e);
    els.push(e);
  }
  const ranks = new Map();
  for (const r of D.ranks) {
    const e = elem({ classe: 'grupo', categoria: 'rank', nome: `Rank ${pad(r.n, 2)}`, codigo: `R${pad(r.n, 2)}`, paiId: trechos.get(r.trecho).id, x: r.pos[0], z: r.pos[1], ordem: r.n });
    ranks.set(r.n, e);
    els.push(e);
  }
  // térrea 44,28 m² (meio do rank) e sobrados de 2 dormitórios (média 55,5 m²) pelo quadro de áreas;
  // profundidades estimadas a partir da área e da frente de 5,28 m
  for (const c of D.casas) {
    els.push(elem({
      classe: 'unidade', categoria: 'casa', forma: 'casa', nome: `Casa ${pad(c.n, 3)}`, codigo: pad(c.n, 3), paiId: ranks.get(c.rank).id,
      x: c.x, z: c.z, rot: c.rot, w: D.frente - 0.15, d: c.terrea ? 8.4 : 7.0, h: c.terrea ? 3.0 : 5.6,
      peso: c.terrea ? 44.28 : 55.5, tipologia: c.terrea ? 'Térrea 2 dorm. (44,28 m²)' : 'Sobrado 2/3 dorm. (≈55,5 m²)', ordem: c.n,
    }));
  }
  D.anexos.forEach((a, i) => {
    const e = novoElemento(o, { classe: 'anexo', categoria: 'area_comum', forma: a.forma, nome: a.nome, codigo: `AC-${pad(i + 1, 2)}`, paiId: trechos.get(a.trecho).id, x: a.x, z: a.z, w: a.w, d: a.d, h: a.h, ordem: 100 + i, peso: a.area || 1 });
    if (a.area) e.tipologia = `${String(a.area).replace('.', ',')} m² (quadro de áreas)`;
    els.push(e);
  });
  D.infra.forEach((v, i) => {
    els.push(novoElementoInfra(o, { nome: v.nome, codigo: `INF-${pad(i + 1, 2)}`, paiId: trechos.get(v.trecho).id, x: v.x, z: v.z, w: v.w, d: v.d, ordem: 200 + i }, v.w, v.d));
  });
  o.elementos.push(...els);
  o.config.casasPorRank = 3;
  o.config.layoutR02 = true;
  o.config.observacao = 'Estrutura do Plano de Ataque R02: fases, trechos, ranks e numeração conferem com a legenda (84 + 54 + 60 = 198). Posições na escala do desenho; dimensões das casas estimadas pela área.';
  o.documentos = VILLA_FLORA_DOCS.map((nome) => ({ id: uid('doc'), nome, mime: 'application/pdf', tamanho: 0, arquivoId: null, papel: 'referencia', pendente: true, em: new Date().toISOString(), base: null }));
  o.esquematico = true;
  return o;
}

// ---------------------------------------------------------------- duplicação

export function duplicarObra(orig, { nome, copiarAvancos = false, copiarDocs = true } = {}) {
  const o = JSON.parse(JSON.stringify(orig));
  o.id = uid('obra');
  o.nome = nome || `${orig.nome} (cópia)`;
  o.arquivada = false;
  o.criadoEm = new Date().toISOString();
  o.atualizadoEm = o.criadoEm;
  // novos ids para que nada seja compartilhado com a obra de origem
  const mapaEl = new Map();
  for (const e of o.elementos) mapaEl.set(e.id, uid('el'));
  const mapaEt = new Map();
  for (const x of o.etapas) mapaEt.set(x.id, uid('et'));
  for (const e of o.elementos) {
    e.id = mapaEl.get(e.id);
    e.paiId = e.paiId ? mapaEl.get(e.paiId) || null : null;
    e.etapasExcluidas = e.etapasExcluidas.map((id) => mapaEt.get(id)).filter(Boolean);
    const q = {};
    for (const [k, v] of Object.entries(e.quantidades || {})) if (mapaEt.get(k)) q[mapaEt.get(k)] = v;
    e.quantidades = q;
  }
  for (const x of o.etapas) x.id = mapaEt.get(x.id);
  if (copiarAvancos) {
    const l = {};
    for (const [k, v] of Object.entries(orig.lancamentos || {})) {
      const [a, b, c] = k.split('|');
      if (mapaEl.get(a) && mapaEt.get(b)) l[`${mapaEl.get(a)}|${mapaEt.get(b)}|${c}`] = { ...v };
    }
    o.lancamentos = l;
    const cc = {};
    for (const [k, v] of Object.entries(orig.conclusoes || {})) if (mapaEl.get(k)) cc[mapaEl.get(k)] = v.map((ev) => ({ ...ev, id: uid('c') }));
    o.conclusoes = cc;
    o.revisoes = [{ id: uid('r'), em: new Date().toISOString(), tipo: 'duplicacao', origem: orig.nome, comAvancos: true }];
  } else {
    o.lancamentos = {};
    o.conclusoes = {};
    o.revisoes = [{ id: uid('r'), em: new Date().toISOString(), tipo: 'duplicacao', origem: orig.nome, comAvancos: false }];
  }
  if (!copiarDocs) o.documentos = [];
  else o.documentos = o.documentos.map((d) => ({ ...d, id: uid('doc'), copiarDe: d.arquivoId }));
  return { obra: normalizar(o), mapaEl, mapaEt };
}
