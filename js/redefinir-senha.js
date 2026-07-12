/**
 * redefinir-senha.js — Lógica da página de Redefinição de Senha
 */

import { supabase } from './supabase.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const inputPassword = document.getElementById('input-password');
  const btnToggle = document.getElementById('btn-toggle-password');
  const eyeIcon = document.getElementById('eye-icon');
  const alertBox = document.getElementById('reset-alert');
  const btnSubmit = document.getElementById('btn-reset');
  const btnText = document.getElementById('btn-reset-text');
  const btnSpinner = document.getElementById('btn-reset-spinner');

  // Toggle senha
  if (btnToggle && inputPassword && eyeIcon) {
    btnToggle.addEventListener('click', () => {
      const show = inputPassword.type === 'password';
      inputPassword.type = show ? 'text' : 'password';
      eyeIcon.innerHTML = show
        ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
        : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
    });
  }

  // Verifica se o usuário chegou nesta página após clicar no link de recovery
  // O Supabase Auth vai processar o hash da URL e se autenticar temporariamente.
  supabase.auth.onAuthStateChange((event, session) => {
    // PASSWORD_RECOVERY indica que o usuário veio pelo link de reset.
    // Pode ocorrer antes de submeter o form ou o usuário pode já ter uma sessão.
    if (event === 'PASSWORD_RECOVERY') {
      showAlert('info', 'Você já pode digitar sua nova senha.');
    }
  });

  // Submit do form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert();

    const newPassword = inputPassword.value;
    if (!newPassword || newPassword.length < 8) {
      showError(inputPassword, 'A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);

    try {
      // Quando o usuário acessa via link do e-mail de recovery, 
      // o Supabase JS o autentica e updateUser altera a senha deste usuário.
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      // Sucesso
      showAlert('success', 'Senha alterada com sucesso! Redirecionando para o login...');
      setTimeout(() => {
        // Encerramos a sessão de recovery e vamos pro login
        supabase.auth.signOut().then(() => {
          window.location.href = 'login.html';
        });
      }, 2000);

    } catch (err) {
      console.error('[Redefinir Senha] Erro:', err);
      showAlert('error', err.message || 'Ocorreu um erro ao redefinir a senha. O link pode ter expirado.');
    } finally {
      setLoading(false);
    }
  });

  // ── Helpers ─────────────────────────────────────────────────────────

  function setLoading(on) {
    if (on) {
      btnSubmit.disabled = true;
      btnText.hidden = true;
      btnSpinner.hidden = false;
    } else {
      btnSubmit.disabled = false;
      btnText.hidden = false;
      btnSpinner.hidden = true;
    }
  }

  function showAlert(type, msg) {
    alertBox.style.display = 'flex';
    alertBox.className = `login-alert login-alert--${type}`;
    
    let icon = '';
    if (type === 'error') {
      icon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (type === 'success') {
      icon = '<svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
    } else {
      icon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    }

    alertBox.innerHTML = icon + '<span>' + msg + '</span>';
  }

  function clearAlert() {
    alertBox.style.display = 'none';
    alertBox.innerHTML = '';
    document.querySelectorAll('.field-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
    document.querySelectorAll('.field-input-wrap').forEach(el => el.classList.remove('has-error'));
  }

  function showError(inputEl, msg) {
    const wrap = inputEl.closest('.field-group');
    const errEl = wrap?.querySelector('.field-error');
    if (errEl) {
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
    const inputWrap = wrap?.querySelector('.field-input-wrap');
    if (inputWrap) inputWrap.classList.add('has-error');
  }
});
