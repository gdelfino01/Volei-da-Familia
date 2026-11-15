/* ===== Comunicação com o Apps Script =====
   Leitura: GET ?acao=...  Escrita: POST com Content-Type text/plain (não dispara preflight de CORS). */
import { API_URL } from './config.js';
import { chamarDemo } from './mock.js';

export const demo = !API_URL;

async function tratar(resp){
  if (!resp.ok) throw new Error('A planilha não respondeu (' + resp.status + ').');
  let j;
  try { j = await resp.json(); } catch { throw new Error('Resposta inválida da planilha. Confira a URL e a publicação do Apps Script.'); }
  if (!j.ok) throw new Error(j.erro || 'Erro na planilha.');
  return j;
}

async function rede(fn){
  try { return await fn(); }
  catch (e){
    if (e instanceof TypeError) throw new Error('Sem conexão com a planilha. Confira a internet e tente de novo.');
    throw e;
  }
}

export function get(acao, params = {}){
  if (demo) return chamarDemo(acao, params);
  return rede(async () => {
    const u = new URL(API_URL);
    u.searchParams.set('acao', acao);
    for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
    return tratar(await fetch(u, { redirect: 'follow' }));
  });
}

export function post(acao, corpo = {}){
  if (demo) return chamarDemo(acao, corpo);
  return rede(async () => tratar(await fetch(API_URL, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ acao, ...corpo })
  })));
}
