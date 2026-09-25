let uidc = 0;
export const uid = () => 'k' + (++uidc);
export const brl = v => v.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
export const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const $ = id => document.getElementById(id);
