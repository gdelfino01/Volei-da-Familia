/* ===== Configuração do pedido ===== */
export const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxshfOgz1BvXShRpE9xWZTzURpcvgi97m65usdppzkWolhaYapS5ZOFiXDJMfDc2G75-A/exec'

export const PRICES = {
  prata:  { nome:'Prata',  top:54.90, short:43.90, kit:98.90, cor:'#A9B3BE' },
  bronze: { nome:'Bronze', top:44.90, short:37.90, kit:82.90, cor:'#B5733A' }
};
export const TOPS   = { cropped:'Top cropped', camiseta:'Camiseta manga curta', regata:'Regata' };
export const SHORTS = { fem:'Short feminino', masc:'Short masculino', none:'Sem short' };
export const SIZES  = ['PP','P','M','G','GG','XG'];
export const MAXN   = 12;
export const STEPS  = ['Quantidade','Gênero','Peças','Tamanhos','Nome e número','Confirmação'];

/* Cores usadas nos desenhos (as mesmas do uniforme) */
export const C = { navy:'#0B2D50', turq:'#00B4C7', light:'#7FDCE6', gold:'#E3A83B', skin:'#E2B08A', hair:'#3A2A22', ghost:'#DCE3EA', ghostSkin:'#C9D3DD' };

/* Pagamento: a primeira parcela (sinal) é paga por Pix no momento do pedido.
   Preencha a chave, o nome do recebedor (como está no banco) e a cidade para
   mostrar a chave e o Pix copia e cola na tela final do pedido.
   O e-mail usa a constante PIX do Apps Script (apps-script/Codigo.gs): preencha os dois iguais. */
export const PIX = { chave:'', nome:'', cidade:'' };
export const SINAL = 0.5; // 50% do total na primeira parcela
