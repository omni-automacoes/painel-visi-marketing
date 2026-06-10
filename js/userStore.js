/**
 * userStore.js — Armazena o perfil do usuário logado em memória (singleton).
 *
 * Populado pelo main.js após autenticação.
 * Consumido pelas páginas para determinar a visualização correta.
 *
 * user_cargo possíveis: 'Administrador' | 'Comercial' | 'Operações'
 */
const UserStore = {
  _user: null,

  /** Define o perfil do usuário logado */
  setUser(user) {
    this._user = user;
  },

  /** Retorna o objeto completo do usuário */
  getUser() {
    return this._user;
  },

  /** Retorna o user_id (UUID) do usuário logado */
  getUserId() {
    return this._user?.user_id ?? null;
  },

  /** Retorna o cargo do usuário */
  getCargo() {
    return this._user?.user_cargo ?? null;
  },

  /** Retorna o primeiro nome do usuário */
  getPrimeiroNome() {
    const nome = this._user?.user_nome ?? '';
    return nome.split(' ')[0] || 'Usuário';
  },

  /** Verifica se o cargo é Administrador */
  isAdmin() {
    return this.getCargo() === 'Administrador';
  },

  /** Verifica se o cargo é Comercial */
  isComercial() {
    return this.getCargo() === 'Comercial';
  },

  /** Verifica se o cargo é Operações */
  isOperacoes() {
    return this.getCargo() === 'Operações';
  },
};

export default UserStore;
