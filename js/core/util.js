/* ===== Funções pequenas, sem dependência do navegador (testadas no Node) ===== */

const pad = n => String(n).padStart(2, '0');

/* Minúsculas, sem acentos, só letras/números e espaços simples */
export function normalizar(s){
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Datas sempre como texto 'aaaa-mm-dd' (sem fuso) */
export const isoData = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function deIso(s){ const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
export const ehIso = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
export const ddmm = iso => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/* Domingo de hoje (se hoje for domingo) ou o próximo */
export function proximoDomingo(base = new Date()){
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  return d;
}

/* Idade em anos: pelo nascimento; se não houver, pela idade aproximada do cadastro */
export function idade(j, hoje = new Date()){
  if (ehIso(j.nascimento)){
    const n = deIso(j.nascimento);
    let a = hoje.getFullYear() - n.getFullYear();
    if (hoje.getMonth() < n.getMonth() || (hoje.getMonth() === n.getMonth() && hoje.getDate() < n.getDate())) a--;
    return a;
  }
  const ap = Number(j.idade_aprox);
  return ap > 0 ? ap : null;
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export const porNome = (a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR');
