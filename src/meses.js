// Utilitários de competência mensal no formato 'AAAA-MM'.

const NOMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function mesDe(data) {
  if (!data) return null;
  return String(data).slice(0, 7);
}

export function addMes(m, n) {
  const [a, mm] = m.split('-').map(Number);
  const t = a * 12 + (mm - 1) + n;
  const ano = Math.floor(t / 12);
  const mes = (t % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function mesAnterior(m) {
  return addMes(m, -1);
}

export function mesesEntre(a, b) {
  if (!a || !b) return [];
  if (a > b) [a, b] = [b, a];
  const lista = [];
  let m = a;
  let guarda = 0;
  while (m <= b && guarda < 1200) {
    lista.push(m);
    m = addMes(m, 1);
    guarda++;
  }
  return lista;
}

export function fmtMes(m) {
  if (!m) return '';
  const [a, mm] = m.split('-');
  return `${NOMES[Number(mm) - 1]}/${a}`;
}

export function mesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function validaMes(m) {
  return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}
