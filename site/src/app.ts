import { verifySession, getUserInfo, signInWithDiscord, logout, type UserInfo } from './utils/auth.ts';

type Page = 'loading' | 'login' | 'dashboard';

export class App {
  private container: HTMLElement;
  private currentPage: Page = 'loading';
  private user: UserInfo | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async init(): Promise<void> {
    this.render();
    await this.checkAuth();
  }

  private async checkAuth(): Promise<void> {
    const session = await verifySession();

    if (session.valid) {
      const userInfo = await getUserInfo();
      if (userInfo) {
        this.user = userInfo;
        this.currentPage = 'dashboard';
      } else {
        this.currentPage = 'login';
      }
    } else {
      this.currentPage = 'login';
    }

    this.render();
  }

  private render(): void {
    switch (this.currentPage) {
      case 'loading':
        this.renderLoading();
        break;
      case 'login':
        this.renderLogin();
        break;
      case 'dashboard':
        this.renderDashboard();
        break;
    }
  }

  private renderLoading(): void {
    this.container.innerHTML = `
      <div class="loading">
        <div class="loading-spinner"></div>
        <span>Chargement...</span>
      </div>
    `;
  }

  private renderLogin(): void {
    this.container.innerHTML = `
      <div class="login-page">
        <div class="login-card">
          <h1>Moddy Dashboard</h1>
          <p>Connectez-vous avec Discord pour accéder au dashboard</p>
          <button class="discord-btn" id="login-btn">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Se connecter avec Discord
          </button>
        </div>
      </div>
    `;

    const loginBtn = document.getElementById('login-btn');
    loginBtn?.addEventListener('click', async () => {
      loginBtn.setAttribute('disabled', 'true');
      loginBtn.innerHTML = `
        <div class="loading-spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
        Redirection...
      `;
      try {
        await signInWithDiscord();
      } catch {
        loginBtn.removeAttribute('disabled');
        loginBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          Se connecter avec Discord
        `;
      }
    });
  }

  private renderDashboard(): void {
    if (!this.user) return;

    const avatarContent = this.user.avatar_url
      ? `<img src="${this.user.avatar_url}" alt="Avatar">`
      : this.user.username.charAt(0).toUpperCase();

    this.container.innerHTML = `
      <div class="dashboard">
        <aside class="sidebar">
          <div class="sidebar-header">
            <div class="sidebar-logo">
              <svg viewBox="0 0 100 100" fill="none">
                <circle cx="50" cy="50" r="45" fill="#5865F2"/>
                <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">M</text>
              </svg>
              Moddy
            </div>
          </div>
          <nav class="sidebar-nav">
            <button class="nav-item active">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              Accueil
            </button>
            <button class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Serveurs
            </button>
            <button class="nav-item">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Paramètres
            </button>
          </nav>
          <div class="sidebar-footer">
            <div class="user-info">
              <div class="user-avatar">${avatarContent}</div>
              <div class="user-details">
                <div class="user-name">${this.user.username}</div>
                <div class="user-email">${this.user.email || 'Email non disponible'}</div>
              </div>
              <button class="logout-btn" id="logout-btn" title="Se déconnecter">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        </aside>
        <main class="main-content">
          <header class="content-header">
            <h1>Bienvenue, ${this.user.username} !</h1>
          </header>
          <div class="content-body">
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Serveurs</div>
                <div class="stat-value">--</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Commandes utilisées</div>
                <div class="stat-value">--</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Membres gérés</div>
                <div class="stat-value">--</div>
              </div>
            </div>
            <div class="card">
              <h2 class="card-title">Activité récente</h2>
              <p style="color: var(--color-text-secondary);">Aucune activité récente pour le moment.</p>
            </div>
          </div>
        </main>
      </div>
    `;

    const logoutBtn = document.getElementById('logout-btn');
    logoutBtn?.addEventListener('click', async () => {
      const success = await logout();
      if (success) {
        this.user = null;
        this.currentPage = 'login';
        this.render();
      }
    });
  }
}
