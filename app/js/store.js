/* ===== Estado do app (memória + preferências deste celular) ===== */
import * as api from './api.js';
import { isoData, proximoDomingo } from './core/util.js';

function ler(k, padrao){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : padrao; } catch { return padrao; } }
export function gravar(k, v){ try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* armazenamento bloqueado */ } }

export const S = {
  data: isoData(proximoDomingo()),   // domingo em foco (Lista e Times)
  dados: null,                       // resposta de publico ou admin_dados
  admin: false,
  pin: ler('vf-pin', ''),
  meu: ler('vf-meu', null),          // { id, token } do cadastro ligado a este celular
  meuPerfil: null,
  erro: ''
};

export async function carregar(){
  S.erro = '';
  if (S.pin){
    try {
      S.dados = await api.post('admin_dados', { pin: S.pin, data: S.data });
      S.admin = true;
      return;
    } catch (e){
      if (!/PIN/.test(e.message)) throw e;
      sairAdmin(false);
    }
  }
  S.dados = await api.get('publico', { data: S.data });
  S.admin = false;
}

export async function entrarAdmin(pin){
  S.dados = await api.post('admin_dados', { pin, data: S.data });
  S.pin = pin; S.admin = true;
  gravar('vf-pin', pin);
}

export function sairAdmin(){
  S.pin = ''; S.admin = false;
  gravar('vf-pin', null);
}

export function ligarCelular(id, token, perfil){
  S.meu = { id, token }; S.meuPerfil = perfil || null;
  gravar('vf-meu', S.meu);
}

export function desligarCelular(){
  S.meu = null; S.meuPerfil = null;
  gravar('vf-meu', null);
}

/* Atalhos de leitura */
export const cfg = () => S.dados?.config || {};
export const jogadores = () => S.dados?.jogadores || [];
export const jogador = id => jogadores().find(j => j.id === id);
export const presencas = () => S.dados?.presencas || [];
export const timesSalvos = () => S.dados?.times || [];
