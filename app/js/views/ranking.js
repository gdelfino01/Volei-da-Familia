/* ===== Ranking: chega na fase 3 (mês, temporada e nota automática) ===== */
import { cabecalho } from '../ui.js';

export function render(){
  return cabecalho({ titulo: 'Ranking' }) + `<section class="cartao">
    <h2>Em breve</h2>
    <p class="mut">O ranking do mês e da temporada aparece aqui depois que os primeiros jogos forem registrados no placar.</p>
  </section>`;
}
