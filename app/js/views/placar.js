/* ===== Placar: chega na fase 2 (lance a lance, fila, modo offline) ===== */
import { cabecalho } from '../ui.js';

export function render(){
  return cabecalho({ titulo: 'Placar' }) + `<section class="cartao">
    <h2>Em breve</h2>
    <p class="mut">O placar lance a lance, com fila de "quem ganha fica" e funcionamento sem internet, chega na próxima fase.</p>
  </section>`;
}
