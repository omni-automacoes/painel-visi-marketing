/**
 * login.js — Lógica da página de login
 *
 * Fluxo:
 *  1. Se já há sessão ativa → redireciona para /
 *  2. Submissão do form → signInWithPassword via Supabase
 *  3. Sucesso → redireciona para /
 *  4. Erro → exibe mensagem amigável
 */

import { supabase } from './supabase.js';

// ── Elementos ────────────────────────────────────────────────
const form          = document.getElementById('login-form');
const inputEmail    = document.getElementById('input-email');
const inputPassword = document.getElementById('input-password');
const btnLogin      = document.getElementById('btn-login');
const btnLoginText  = document.getElementById('btn-login-text');
const btnSpinner    = document.getElementById('btn-login-spinner');
const loginAlert    = document.getElementById('login-alert');
const errorEmail    = document.getElementById('error-email');
const errorPassword = document.getElementById('error-password');
const btnToggle     = document.getElementById('btn-toggle-password');

// ── 1. Redireciona se já está logado ─────────────────────────
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    window.location.replace('/');
  }
})();

// ── 2. Toggle de visibilidade da senha ───────────────────────
btnToggle?.addEventListener('click', () => {
  const isPassword = inputPassword.type === 'password';
  inputPassword.type = isPassword ? 'text' : 'password';

  // Troca ícone: olho aberto / olho fechado
  document.getElementById('eye-icon').innerHTML = isPassword
    ? /* olho fechado */
      `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
       <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
       <line x1="1" y1="1" x2="23" y2="23"/>`
    : /* olho aberto */
      `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
       <circle cx="12" cy="12" r="3"/>`;
});

// ── 3. Limpa erros ao digitar ─────────────────────────────────
inputEmail?.addEventListener('input', () => clearFieldError('field-email', 'error-email'));
inputPassword?.addEventListener('input', () => clearFieldError('field-password', 'error-password'));

// ── 4. Submissão do formulário ────────────────────────────────
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAll();

  const email    = inputEmail.value.trim();
  const password = inputPassword.value;

  // Validação básica
  let valid = true;
  if (!email) {
    setFieldError('field-email', 'error-email', 'Informe seu e-mail.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('field-email', 'error-email', 'E-mail inválido.');
    valid = false;
  }
  if (!password) {
    setFieldError('field-password', 'error-password', 'Informe sua senha.');
    valid = false;
  }
  if (!valid) return;

  // Loading
  setLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setLoading(false);
    showAlert(friendlyError(error.message));
    return;
  }

  // Sucesso → vai para o app
  window.location.replace('/');
});

// ── Helpers ──────────────────────────────────────────────────

function setLoading(loading) {
  btnLogin.disabled     = loading;
  btnLoginText.textContent = loading ? 'Entrando...' : 'Entrar';
  btnSpinner.hidden     = !loading;
}

function setFieldError(fieldId, errorId, msg) {
  document.getElementById(fieldId)?.classList.add('has-error');
  const el = document.getElementById(errorId);
  if (el) el.textContent = msg;
}

function clearFieldError(fieldId, errorId) {
  document.getElementById(fieldId)?.classList.remove('has-error');
  const el = document.getElementById(errorId);
  if (el) el.textContent = '';
  loginAlert.classList.remove('visible');
  loginAlert.textContent = '';
}

function clearAll() {
  errorEmail.textContent = '';
  errorPassword.textContent = '';
  document.getElementById('field-email')?.classList.remove('has-error');
  document.getElementById('field-password')?.classList.remove('has-error');
  loginAlert.classList.remove('visible');
  loginAlert.textContent = '';
}

function showAlert(msg) {
  loginAlert.textContent = msg;
  loginAlert.classList.add('visible');
}

/** Traduz mensagens de erro do Supabase para português */
function friendlyError(msg) {
  if (!msg) return 'Erro inesperado. Tente novamente.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid email or password'))
    return 'E-mail ou senha incorretos. Verifique e tente novamente.';
  if (m.includes('email not confirmed'))
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (m.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Sem conexão com a internet. Verifique sua rede.';
  return 'Não foi possível fazer login. Tente novamente.';
}
