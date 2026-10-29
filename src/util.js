// Utilitários de interface: DOM, formatação, diálogos e download.

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function num(v, casas = 1) {
  if (!Number.isFinite(v)) return '–';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function pct(v, casas = 1) {
  return `${num(v, casas)}%`;
}

export function pp(v, casas = 1) {
  const s = v > 1e-9 ? '+' : '';
  return `${s}${num(v, casas)} p.p.`;
}

export function lerNum(s) {
  if (typeof s === 'number') return s;
  const t = String(s ?? '').trim().replace(/\s/g, '').replace(/%$/, '');
  if (!t) return NaN;
  // aceita 1.234,5 e 1234.5
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(n);
}

export function dataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function tamanho(b) {
  if (!b) return '–';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${num(b / 1024, 0)} KB`;
  return `${num(b / 1024 / 1024, 1)} MB`;
}

// Oferece um arquivo ao usuário. Dentro do claude.ai usa a capacidade
// "downloads" (o usuário confirma); fora dele, um link de download comum.
// Retorna true quando o arquivo foi entregue.
let downloadsP = null;
export async function baixar(nome, blob) {
  if (window.claude && typeof window.claude.use === 'function') {
    if (!downloadsP) downloadsP = window.claude.use('downloads').catch(() => null);
    const dl = await downloadsP;
    if (dl) {
      try {
        await dl.save({ filename: nome, data: blob });
        return true;
      } catch (e) {
        if (e && e.code === 'declined') toast('Download cancelado.', 'erro');
        else toast(`Não foi possível salvar o arquivo (${e?.code || 'erro'}).`, 'erro');
        return false;
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

export function nomeArquivo(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').slice(0, 60);
}

let toastTimer = null;
export function toast(msg, tipo = 'ok') {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast mostrar ${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, tipo === 'erro' ? 6000 : 3200);
}

// Diálogo genérico. botoes: [{ rotulo, valor, classe }]. Retorna o valor do botão
// (ou null ao fechar). "aoAbrir" recebe o elemento para ligar eventos.
export function dialogo({ titulo, html, botoes = [{ rotulo: 'Fechar', valor: null }], largura = 520, aoAbrir, coletar }) {
  return new Promise((res) => {
    const fundo = document.createElement('div');
    fundo.className = 'dlg-fundo';
    fundo.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" style="max-width:${largura}px">
      <div class="dlg-topo"><h3>${esc(titulo)}</h3><button class="icone fechar" data-x aria-label="Fechar">×</button></div>
      <div class="dlg-corpo">${html}</div>
      <div class="dlg-rodape">${botoes.map((b, i) => `<button class="${b.classe || (i === botoes.length - 1 ? 'primario' : '')}" data-i="${i}">${esc(b.rotulo)}</button>`).join('')}</div>
    </div>`;
    document.body.appendChild(fundo);
    const fechar = (v) => {
      fundo.remove();
      document.removeEventListener('keydown', esc_);
      res(v);
    };
    const esc_ = (ev) => { if (ev.key === 'Escape') fechar(null); };
    document.addEventListener('keydown', esc_);
    fundo.querySelector('[data-x]').onclick = () => fechar(null);
    fundo.addEventListener('mousedown', (ev) => { if (ev.target === fundo) fechar(null); });
    fundo.querySelectorAll('[data-i]').forEach((b) => {
      b.onclick = () => {
        const bt = botoes[Number(b.dataset.i)];
        if (bt.valor !== null && coletar) {
          const r = coletar(fundo, bt.valor);
          if (r === false) return; // validação pediu para ficar aberto
          fechar(r === undefined ? bt.valor : r);
        } else fechar(bt.valor);
      };
    });
    if (aoAbrir) aoAbrir(fundo);
    const foco = fundo.querySelector('input,textarea,select') || fundo.querySelector('.primario');
    if (foco) setTimeout(() => foco.focus(), 30);
  });
}

export async function confirmar(titulo, html, rotuloOk = 'Confirmar', perigo = false) {
  const v = await dialogo({ titulo, html, botoes: [{ rotulo: 'Cancelar', valor: null, classe: '' }, { rotulo: rotuloOk, valor: true, classe: perigo ? 'perigo' : 'primario' }] });
  return v === true;
}

export async function perguntar(titulo, rotulo, valor = '', obrigatorio = false, dica = '') {
  const v = await dialogo({
    titulo,
    html: `<label class="campo"><span>${esc(rotulo)}</span><input type="text" id="dlgTxt" value="${esc(valor)}"></label>${dica ? `<p class="dica">${dica}</p>` : ''}<p class="erro" id="dlgErro"></p>`,
    botoes: [{ rotulo: 'Cancelar', valor: null }, { rotulo: 'OK', valor: 'ok' }],
    aoAbrir: (el) => {
      const i = el.querySelector('#dlgTxt');
      i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') el.querySelector('.primario').click(); });
    },
    coletar: (el) => {
      const t = el.querySelector('#dlgTxt').value.trim();
      if (obrigatorio && !t) {
        el.querySelector('#dlgErro').textContent = 'Preencha este campo.';
        return false;
      }
      return t;
    },
  });
  return v;
}

export function lerArquivoTexto(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result);
    fr.onerror = () => rej(fr.error);
    fr.readAsText(file);
  });
}

export function escolherArquivo(accept = '', multiplo = false) {
  return new Promise((res) => {
    const i = document.createElement('input');
    i.type = 'file';
    i.accept = accept;
    i.multiple = multiplo;
    i.style.display = 'none';
    document.body.appendChild(i);
    i.onchange = () => {
      res([...i.files]);
      i.remove();
    };
    i.click();
  });
}
