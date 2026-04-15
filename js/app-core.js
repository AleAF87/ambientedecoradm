import { checkAuth, loadNavbar } from './auth-check.js';

class AppCore {
    constructor() {
        if (!window.location.pathname.includes('app.html')) {
            console.log('Pagina nao SPA, app-core ignorado');
            return null;
        }

        this.currentPage = null;
    }

    normalizePageUrl(pageUrl = '') {
        return String(pageUrl || '').split('#')[0].split('?')[0];
    }

    isSpecialPage(pageUrl) {
        const normalizedPageUrl = this.normalizePageUrl(pageUrl);
        return normalizedPageUrl === 'perfil.html'
            || normalizedPageUrl === 'orcamentos.html'
            || normalizedPageUrl === 'orcamentos-edit.html'
            || normalizedPageUrl === 'sociedade.html'
            || normalizedPageUrl === 'sociedade-edit.html'
            || normalizedPageUrl === 'teste-endereco.html'
            || normalizedPageUrl === 'modal-base.html';
    }

    async init() {
        try {
            const { userData, cpf } = await checkAuth(3);
            sessionStorage.setItem('userCPF', cpf);
            sessionStorage.setItem('userName', userData.nome || 'Usuario');
            sessionStorage.setItem('userNivel', userData.nivel || 3);

            await loadNavbar();

            this.setupNavbar();
            await this.loadPage('dashboard.html');
        } catch (error) {
            console.error('Erro SPA:', error);
            this.showError(error);
        }
    }

    collapseNavbar() {
        const collapseEl = document.getElementById('mainNavbar');
        if (!collapseEl || typeof bootstrap === 'undefined') return;

        const collapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
        collapse.hide();
    }

    setupNavbar() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href$=".html"]');
            if (!link || link.hasAttribute('data-ignore-spa')) return;

            event.preventDefault();
            this.collapseNavbar();
            this.loadPage(link.getAttribute('href'));
        });

        this.setupUserGreeting();
        this.setupDropdown();
    }

    setupUserGreeting() {
        const updateGreeting = () => {
            const userName = sessionStorage.getItem('userName') || 'Usuario';
            const cleanName = userName.replace(/\.{3,}/g, '').replace(/\s*\(.*\)/g, '').trim();
            const greeting = document.getElementById('userGreeting');
            if (greeting) {
                greeting.innerHTML = `<span class="text-white">${cleanName}</span>`;
            }
        };

        updateGreeting();
        window.updateUserGreetingInSPA = updateGreeting;
    }

    setupDropdown() {
        const logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saindo...';

                try {
                    const { auth } = await import('./firebase-config.js');
                    const { signOut } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
                    await signOut(auth);
                } catch (error) {
                    console.error('Erro no logout:', error);
                }

                sessionStorage.clear();
                localStorage.clear();
                window.location.href = 'index.html';
            });
        }

        const profileBtn = document.getElementById('navProfile');
        if (profileBtn) {
            profileBtn.addEventListener('click', (event) => {
                event.preventDefault();
                this.collapseNavbar();
                this.loadPage('perfil.html');
            });
        }
    }

    async loadPage(pageUrl) {
        const normalizedPageUrl = this.normalizePageUrl(pageUrl);
        if (this.currentPage === pageUrl) return;

        const contentDiv = document.getElementById('app-content');
        if (!contentDiv) return;

        try {
            await checkAuth(3);
            contentDiv.innerHTML = this.getLoadingHTML(normalizedPageUrl);

            const response = await fetch(pageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const html = await response.text();

            if (this.isSpecialPage(pageUrl)) {
                await this.loadSpecialPage(html, pageUrl);
            } else {
                const pageContent = this.extractContent(html, normalizedPageUrl);
                contentDiv.innerHTML = pageContent;

                if (normalizedPageUrl === 'dashboard.html') {
                    await this.loadDashboardScript();
                }
            }

            this.currentPage = pageUrl;
            this.updateActiveNav(normalizedPageUrl);
        } catch (error) {
            console.error(`Erro ao carregar ${pageUrl}:`, error);

            if (error?.message?.includes('Nivel insuficiente')) {
                return;
            }

            contentDiv.innerHTML = this.getErrorHTML(error, normalizedPageUrl);
        }
    }

    async loadSpecialPage(html, pageUrl) {
        const contentDiv = document.getElementById('app-content');
        const normalizedPageUrl = this.normalizePageUrl(pageUrl);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const tempDiv = document.createElement('div');

        Array.from(doc.body.children).forEach((child) => {
            if (child.id !== 'navbar' && child.tagName !== 'SCRIPT' && !child.classList?.contains('navbar')) {
                tempDiv.appendChild(child.cloneNode(true));
            }
        });

        this.cleanupInlinePageAssets();
        contentDiv.innerHTML = tempDiv.innerHTML;

        if (normalizedPageUrl === 'perfil.html') {
            await this.loadPerfilScript();
        } else if (normalizedPageUrl === 'orcamentos.html') {
            await this.loadOrcamentosScript();
        } else if (normalizedPageUrl === 'orcamentos-edit.html') {
            await this.loadOrcamentosEditScript(pageUrl);
        } else if (normalizedPageUrl === 'sociedade.html') {
            await this.loadSociedadeScript();
        } else if (normalizedPageUrl === 'sociedade-edit.html') {
            await this.loadSociedadeEditScript(pageUrl);
        } else if (normalizedPageUrl === 'teste-endereco.html') {
            await this.loadTesteEnderecoScript();
        } else if (normalizedPageUrl === 'modal-base.html') {
            this.injectInlinePageScripts(doc, normalizedPageUrl);
        }
    }

    cleanupInlinePageAssets() {
        document.querySelectorAll('[data-spa-inline-script]').forEach((element) => element.remove());
    }

    injectInlinePageScripts(doc, pageUrl) {
        doc.querySelectorAll('script:not([src])').forEach((script) => {
            const injectedScript = document.createElement('script');
            injectedScript.dataset.spaInlineScript = pageUrl;
            injectedScript.textContent = script.textContent;
            document.body.appendChild(injectedScript);
        });
    }

    async loadPerfilScript() {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const mod = await import('./perfil.js');
            if (mod?.initPerfilSPA) {
                await mod.initPerfilSPA();
            } else if (mod?.initPerfil) {
                await mod.initPerfil();
            }
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    }

    async loadOrcamentosScript() {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const mod = await import('./orcamentos.js');
            if (mod?.init) await mod.init();
        } catch (error) {
            console.error('Erro ao carregar orcamentos:', error);
        }
    }

    async loadOrcamentosEditScript(pageUrl = 'orcamentos-edit.html') {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const id = new URLSearchParams(String(pageUrl).split('?')[1] || '').get('id');
            const mod = await import('./orcamentos-edit.js');
            if (mod?.init) await mod.init(id);
        } catch (error) {
            console.error('Erro ao carregar orcamentos-edit:', error);
        }
    }

    async loadSociedadeScript() {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const mod = await import('./sociedade.js');
            if (mod?.initSociedade) await mod.initSociedade();
        } catch (error) {
            console.error('Erro ao carregar sociedade:', error);
        }
    }

    async loadSociedadeEditScript(pageUrl = 'sociedade-edit.html') {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const id = new URLSearchParams(String(pageUrl).split('?')[1] || '').get('id');
            const mod = await import('./sociedade-edit.js');
            if (mod?.initSociedadeEdit) await mod.initSociedadeEdit(id);
        } catch (error) {
            console.error('Erro ao carregar sociedade-edit:', error);
        }
    }

    async loadTesteEnderecoScript() {
        try {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const mod = await import('./teste-endereco.js');
            if (mod?.initTesteEnderecoSPA) {
                await mod.initTesteEnderecoSPA();
            } else if (mod?.initTesteEndereco) {
                await mod.initTesteEndereco();
            }
        } catch (error) {
            console.error('Erro ao carregar teste-endereco:', error);
        }
    }

    async loadDashboardScript() {
        try {
            const mod = await import('./dashboard.js');
            if (mod?.initDashboard) {
                await mod.initDashboard();
            } else {
                this.executeDashboardFallback();
            }
        } catch (error) {
            console.error('Erro ao carregar dashboard:', error);
            this.executeDashboardFallback();
        }
    }

    executeDashboardFallback() {
        const userCPF = sessionStorage.getItem('userCPF') || '00000000000';
        const userName = sessionStorage.getItem('userName') || 'Usuario';
        const cleanName = userName.replace(/\.{3,}/g, '').replace(/\s*\(.*\)/g, '').trim();
        const dashboardContent = document.querySelector('#dashboard-content') || document.querySelector('.card-body');

        if (!dashboardContent) return;

        dashboardContent.innerHTML = `
            <h1 class="display-4 mb-4">Ola, ${cleanName}!</h1>
            <div class="alert alert-success" role="alert">
                <h4 class="alert-heading">Bem-vindo ao sistema</h4>
                <p>Dashboard carregado via Single Page Application.</p>
                <hr>
                <div class="row mb-2">
                    <div class="col-md-6">
                        <strong><i class="fas fa-id-card me-1"></i>CPF:</strong> ${userCPF}
                    </div>
                    <div class="col-md-6">
                        <strong><i class="fas fa-shield-alt me-1"></i>Nivel:</strong>
                        <span class="badge bg-secondary">${sessionStorage.getItem('currentUserLevel') || '3'}</span>
                    </div>
                </div>
            </div>
            <div class="mt-3">
                <button class="btn btn-primary me-2" onclick="window.app.loadPage('orcamentos.html')">
                    <i class="fas fa-file-invoice me-1"></i>Orcamentos
                </button>
                <button class="btn btn-outline-secondary" onclick="window.app.loadPage('sociedade.html')">
                    <i class="fas fa-people-arrows me-1"></i>Sociedade
                </button>
            </div>
        `;
    }

    extractContent(html, pageUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        ['#navbar', 'nav', '.navbar', 'script[src*="navbar"]', 'script[src*="firebase-config"]', 'script[src*="auth-check"]']
            .forEach((selector) => {
                doc.querySelectorAll(selector).forEach((element) => element.remove());
            });

        if (pageUrl === 'dashboard.html') {
            const cardBody = doc.querySelector('.card-body');
            if (cardBody) {
                return `
                    <div class="container-fluid">
                        <div class="row">
                            <div class="col-12">
                                <div class="card mt-3">
                                    <div class="card-body" id="dashboard-content">
                                        ${cardBody.innerHTML}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        const mainContent = doc.querySelector('main, .container-fluid');
        return mainContent ? mainContent.innerHTML : doc.body.innerHTML;
    }

    updateActiveNav(pageUrl) {
        document.querySelectorAll('a[href$=".html"]').forEach((link) => {
            const href = link.getAttribute('href');
            const isActive = href === pageUrl;
            link.classList.toggle('active', isActive);
            link.style.pointerEvents = isActive ? 'none' : 'auto';
            link.style.opacity = isActive ? '0.9' : '1';
            link.style.color = isActive ? '#fff' : 'rgba(255, 255, 255, 0.8)';
        });

        if (window.updateNavbarActiveMenu) {
            window.updateNavbarActiveMenu(pageUrl);
        }
    }

    getLoadingHTML(pageUrl) {
        const pageName = String(pageUrl || '').replace('.html', '').replace(/\//g, ' ');
        return `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <div class="card mt-4">
                            <div class="card-body text-center py-5">
                                <div class="spinner-border text-primary mb-3" style="width: 3rem; height: 3rem;"></div>
                                <h4>Carregando ${pageName}...</h4>
                                <p class="text-muted mt-2">Por favor, aguarde.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    getErrorHTML(error, pageUrl) {
        return `
            <div class="container-fluid">
                <div class="row">
                    <div class="col-12">
                        <div class="card mt-4">
                            <div class="card-body text-center py-5">
                                <div class="alert alert-danger">
                                    <h4 class="alert-heading">
                                        <i class="fas fa-exclamation-triangle me-2"></i>
                                        Erro ao carregar pagina
                                    </h4>
                                    <p><strong>${pageUrl}</strong></p>
                                    <hr>
                                    <p class="mb-0">${error.message}</p>
                                    <div class="mt-3">
                                        <button class="btn btn-primary me-2" onclick="window.app.loadPage('${pageUrl}')">
                                            <i class="fas fa-redo me-1"></i>Tentar novamente
                                        </button>
                                        <button class="btn btn-outline-secondary" onclick="window.app.loadPage('dashboard.html')">
                                            <i class="fas fa-home me-1"></i>Dashboard
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    showError(error) {
        const contentDiv = document.getElementById('app-content');
        if (!contentDiv) return;

        contentDiv.innerHTML = `
            <div class="alert alert-danger m-4">
                <h4>Erro de autenticacao</h4>
                <p>${error.message}</p>
                <a href="index.html" class="btn btn-primary">Voltar ao login</a>
            </div>
        `;
    }
}

if (window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new AppCore();
        if (window.app) window.app.init();
    });
}

export default AppCore;
