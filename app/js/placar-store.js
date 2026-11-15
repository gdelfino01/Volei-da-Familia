/* ===== Placar guardado neste celular e enviado à planilha em lote =====
   Cada lance é gravado no localStorage na hora. O envio acontece ao salvar um jogo,
   quando a internet volta e alguns segundos depois do último lance; se falhar, tenta de novo depois. */
import * as api from './api.js';
import { S } from './store.js';
import { novoEstado, pendentes, lote, confirmar } from './core/placar.js';

const CHAVE = 'vf-placar';
let estados = (() => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; } })();

export const envio = { andamento: false, erro: '', ultimo: null };
const ouvintes = new Set();
export const aoMudarEnvio = fn => { ouvintes.add(fn); return () => ouvintes.delete(fn); };
const avisar = () => ouvintes.forEach(fn => fn());

export function guardar(){
  try { localStorage.setItem(CHAVE, JSON.stringify(estados)); }
  catch { envio.erro = 'Não foi possível guardar no celular (armazenamento cheio ou bloqueado).'; avisar(); }
}

export function estadoDe(data, numTimes){
  if (!estados[data]) { estados[data] = novoEstado(data, numTimes); guardar(); }
  return estados[data];
}
export const temEstado = data => !!estados[data];

export function novoId(prefixo, data = ''){
  const r = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '');
  return prefixo + data.replace(/-/g, '') + '-' + r.slice(0, 10);
}

export const totalPendente = () => Object.values(estados).reduce((n, e) => n + pendentes(e).length, 0);

/* Envia tudo o que está pendente, domingo por domingo */
export async function sincronizar(){
  if (envio.andamento || !S.pin || !totalPendente()) return;
  envio.andamento = true; envio.erro = ''; avisar();
  try {
    for (const e of Object.values(estados)){
      if (!pendentes(e).length) continue;
      const { versoes, ...corpo } = lote(e);
      await api.post('sincronizar', { pin: S.pin, ...corpo });
      confirmar(e, versoes);
      guardar();
    }
    envio.ultimo = new Date();
    limparAntigos();
  } catch (err){
    envio.erro = err.rede ? 'Sem conexão. Os lances estão guardados neste celular.' : err.message;
    agendar(60000);
  } finally {
    envio.andamento = false;
    avisar();
  }
}

let timer;
export function agendar(ms = 20000){
  clearTimeout(timer);
  timer = setTimeout(sincronizar, ms);
}

/* Domingos antigos, já enviados e sem jogo em andamento, não precisam ficar no celular */
function limparAntigos(){
  const limite = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
  for (const [data, e] of Object.entries(estados)) if (data < limite && !e.atual && !pendentes(e).length) delete estados[data];
  guardar();
}

window.addEventListener('online', () => sincronizar());
