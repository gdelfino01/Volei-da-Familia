import { PIX, SINAL } from './config.js';

/* ===== Pix: valor da primeira parcela e código "copia e cola" (BR Code do Banco Central) ===== */
const campo = (id, v) => id + String(v.length).padStart(2, '0') + v;
const semAcento = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').trim();

/* CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no fim do código */
function crc16(s){
  let crc = 0xFFFF;
  for (const ch of s){
    crc ^= ch.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function brCode({ chave, nome, cidade, valor, txid }){
  const body =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave.trim())) +
    campo('52', '0000') + campo('53', '986') +
    (valor > 0 ? campo('54', valor.toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', semAcento(nome).toUpperCase().slice(0, 25)) +
    campo('60', semAcento(cidade).toUpperCase().slice(0, 15)) +
    campo('62', campo('05', (txid || '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***')) +
    '6304';
  return body + crc16(body);
}

export const pixConfigurado = () => !!(PIX.chave && PIX.nome && PIX.cidade);

/* Valores de pagamento de um pedido; o sinal é arredondado para centavos */
export function pagamento(total, pedidoId){
  const sinal = Math.round(total * SINAL * 100) / 100;
  const pg = { percentualSinal:Math.round(SINAL * 100), sinal, restante:Math.round((total - sinal) * 100) / 100,
    pixChave:PIX.chave, pixNome:PIX.nome, pixCopiaECola:'' };
  if (pixConfigurado()) pg.pixCopiaECola = brCode({ ...PIX, valor:sinal, txid:pedidoId });
  return pg;
}
