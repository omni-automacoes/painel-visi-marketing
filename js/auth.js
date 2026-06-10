/**
 * auth.js — Serviço de autenticação do CRM Visi Marketing
 *
 * Responsabilidades:
 *  - Login / Logout com e-mail e senha
 *  - Recuperar sessão e usuário atual
 *  - Observar mudanças de sessão (onAuthStateChange)
 *
 * Uso:
 *   import { login, logout, getUser, onAuthChange } from '../js/auth.js';
 */

import { supabase } from './supabase.js';

/**
 * Realiza login com e-mail e senha.
 * @param {string} email
 * @param {string} password
 * @returns {{ user, error }}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user ?? null, error };
}

/**
 * Realiza logout do usuário atual e redireciona para o login.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.replace('/login.html');
}

/**
 * Retorna o usuário autenticado atual (ou null se não logado).
 * @returns {Promise<User|null>}
 */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/**
 * Retorna a sessão atual (ou null).
 * @returns {Promise<Session|null>}
 */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

/**
 * Registra um callback chamado sempre que a sessão muda
 * (login, logout, refresh de token).
 * @param {Function} callback - recebe (event, session)
 */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange(callback);
}
