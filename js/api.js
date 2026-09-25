import { SCRIPT_URL, PRICES, TOPS, SHORTS } from './config.js';
import { price, tipo, total } from './state.js';

/* ===== Envio do pedido para a planilha (Google Apps Script) ===== */
export function buildPayload(players, resp, email){
  const now = new Date(), pad = x => String(x).padStart(2, '0');
  const id = 'VF-' + String(now.getFullYear()).slice(2) + pad(now.getMonth() + 1) + pad(now.getDate()) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  return {
    pedidoId:id, dataHora:now.toISOString(), responsavel:resp.trim(), email:email.trim(), total:+total().toFixed(2),
    itens:players.map((p, i) => ({
      jogador:i + 1, genero:p.g === 'F' ? 'Feminino' : 'Masculino', linha:PRICES[p.line].nome,
      pecaCima:TOPS[p.top], tamanhoCima:p.topSize,
      short:p.short === 'none' ? '' : SHORTS[p.short], tamanhoShort:p.short === 'none' ? '' : p.shortSize,
      tipo:tipo(p), nomeCamisa:p.name, numeroCamisa:p.num ? p.num.padStart(2, '0') : '', valor:price(p)
    }))
  };
}

/* Resolve com { demo } quando o envio sai; rejeita se a rede falhar */
export async function submitOrder(payload){
  if (SCRIPT_URL){
    await fetch(SCRIPT_URL, { method:'POST', mode:'no-cors', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify(payload) });
  } else {
    await new Promise(r => setTimeout(r, 700));
    console.log('Pedido (modo de teste):', payload);
  }
  return { demo:!SCRIPT_URL };
}
