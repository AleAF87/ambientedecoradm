// js/app-core.js - Núcleo do SPA (CORRIGIDO)
import { checkAuth } from './auth-check.js';
import { loadNavbar } from './auth-check.js';

class AppCore {
    constructor() {
        if (!window.location.pathname.includes('app.html')) {
            console.log(`🚫 Página independente, ignorando SPA`);
            return null;
        }
        
        this.currentPage = 'dashboard';
    }
    
    async init() {
        if (!window.location.pathname.includes('app.html')) {
            return;
        }
        
        try {
            // checkAuth retorna objeto com userData e cpf
            const result = await checkAuth(3);
            
            const userData = result.userData;
            const cpf = result.cpf; // APENAS CPF
            
            console.log('📦 Dados recebidos:', { 
                nome: userData.nome, 
                nivel: userData.nivel,
                cpf: cpf 
            });
            
            // SALVAR APENAS CPF
            sessionStorage.setItem('userCPF', cpf);
            sessionStorage.setItem('userName', userData.nome);
            sessionStorage.setItem('userNivel', userData.nivel || 3);
            
            await loadNavbar();
            
            this.setupNavbar();
            await this.loadPage('dashboard.html');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar SPA:', error);
            this.showError(error);
        }
    }

    setupNavbar() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href$=".html"]');
            if (link && !link.hasAttribute('data-ignore-spa')) {
                e.preventDefault();
                const href = link.getAttribute('href');
                this.loadPage(href);
            }
        });
        
        this.setupUserGreeting();
        this.setupDropdown();
    }
    
    setupUserGreeting() {
        const updateGreeting = () => {
            const userName = sessionStorage.getItem('userName') || 'Usuário';
            const cleanName = userName.replace(/\.{3,}/g, '')
                                    .replace(/\s*\(.*\)/g, '')
                                    .trim();
            
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
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saindo...';
                
                try {
                    const { auth } = await import('./firebase-config.js');
                    const { signOut } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
                    
                    await signOut(auth);
                    sessionStorage.clear();
                    localStorage.clear();
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Erro no logout:', error);
                    sessionStorage.clear();
                    localStorage.clear();
                    window.location.href = 'index.html';
                }
            });
        }
        
        const profileBtn = document.getElementById('navProfile');
        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.loadPage('perfil.html');
            });
        }
    }
    
    getLoadingHTML(pageUrl) {
        const pageName = pageUrl.replace('.html', '')
            .replace(/^\//, '')
            .replace(/\//g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        
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
                                        Erro ao carregar página
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
    
    async loadPage(pageUrl) {
        if (this.currentPage === pageUrl) return;
        
        const contentDiv = document.getElementById('app-content');
        if (!contentDiv) return;
        
        try {
            contentDiv.innerHTML = this.getLoadingHTML(pageUrl);
            
            const response = await fetch(pageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const html = await response.text();
            
            if (pageUrl === 'base.html' || pageUrl === 'perfil.html') {
                await this.loadSpecialPage(html, pageUrl);
            } else {
                const pageContent = this.extractContent(html, pageUrl);
                contentDiv.innerHTML = pageContent;
                
                if (pageUrl === 'dashboard.html') {
                    await this.loadDashboardScript();
                }
            }
            
            this.currentPage = pageUrl;
            this.updateActiveNav(pageUrl);
            
        } catch (error) {
            console.error(`❌ Erro ao carregar ${pageUrl}:`, error);
            contentDiv.innerHTML = this.getErrorHTML(error, pageUrl);
        }
    }
    
    async loadSpecialPage(html, pageUrl) {
        const contentDiv = document.getElementById('app-content');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const navbar = doc.querySelector('#navbar');
        if (navbar) navbar.remove();
        
        const mainContent = doc.querySelector('main');
        if (mainContent) {
            contentDiv.innerHTML = mainContent.innerHTML;
            
            if (pageUrl === 'base.html') {
                await this.loadBaseScript();
            } else if (pageUrl === 'perfil.html') {
                await this.loadPerfilScript();
            }
        } else {
            contentDiv.innerHTML = '<div class="alert alert-danger">Erro: Conteúdo não encontrado</div>';
        }
    }
    
    async loadBaseScript() {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const baseModule = await import('./base.js');
            
            if (baseModule && baseModule.initBaseSPA) {
                await baseModule.initBaseSPA();
            } else if (baseModule && baseModule.initBase) {
                await baseModule.initBase();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar base:', error);
            this.showError(error);
        }
    }
    
    async loadPerfilScript() {
        try {
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const perfilModule = await import('./perfil.js');
            
            if (perfilModule && perfilModule.initPerfilSPA) {
                await perfilModule.initPerfilSPA();
            } else if (perfilModule && perfilModule.initPerfil) {
                await perfilModule.initPerfil();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar perfil:', error);
            this.showError(error);
        }
    }
    
    async loadDashboardScript() {
        try {
            const dashboardModule = await import('./dashboard.js');
            
            if (dashboardModule && dashboardModule.initDashboard) {
                await dashboardModule.initDashboard();
            } else {
                this.executeDashboardFallback();
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar dashboard:', error);
            this.executeDashboardFallback();
        }
    }
    
    executeDashboardFallback() {
        const userCPF = sessionStorage.getItem('userCPF') || '000000';
        const userName = sessionStorage.getItem('userName') || 'Usuário';
        const cleanName = userName.replace(/\.{3,}/g, '').replace(/\s*\(.*\)/g, '').trim();
        
        const dashboardContent = document.querySelector('#dashboard-content') || 
                                document.querySelector('.card-body');
        
        if (dashboardContent) {
            dashboardContent.innerHTML = `
                <h1 class="display-4 mb-4">Olá, ${cleanName}!</h1>
                <div class="alert alert-success" role="alert">
                    <h4 class="alert-heading">Bem-vindo ao Sistema</h4>
                    <p>Dashboard carregado via Single Page Application.</p>
                    <hr>
                    <div class="mb-0">
                        <div class="row mb-2">
                            <div class="col-md-6">
                                <strong><i class="fas fa-id-card me-1"></i>CPF:</strong> ${userCPF}
                            </div>
                            <div class="col-md-6">
                                <strong><i class="fas fa-shield-alt me-1"></i>Nível:</strong> 
                                <span class="badge bg-secondary">Carregando...</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-primary me-2" onclick="window.app.loadPage('base.html')">
                        <i class="fas fa-code me-1"></i>Ver Base
                    </button>
                    <button class="btn btn-outline-secondary" onclick="window.app.loadPage('dashboard.html')">
                        <i class="fas fa-redo me-1"></i>Recarregar
                    </button>
                </div>
            `;
        }
    }
    
    extractContent(html, pageUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const elementsToRemove = [
            '#navbar',
            'nav',
            '.navbar',
            'script[src*="navbar"]',
            'link[href*="navbar"]',
            'script[src*="firebase-config"]',
            'script[src*="auth-check"]'
        ];
        
        elementsToRemove.forEach(selector => {
            doc.querySelectorAll(selector).forEach(el => el.remove());
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
        document.querySelectorAll('a[href$=".html"]').forEach(link => {
            const href = link.getAttribute('href');
            const isActive = href === pageUrl;
            
            link.classList.toggle('active', isActive);
            
            if (isActive) {
                link.style.pointerEvents = 'none';
                link.style.opacity = '0.7';
                link.style.color = '#fff';
            } else {
                link.style.pointerEvents = 'auto';
                link.style.opacity = '1';
                link.style.color = 'rgba(255, 255, 255, 0.8)';
            }
        });
        
        if (window.updateNavbarActiveMenu) {
            window.updateNavbarActiveMenu(pageUrl);
        }
    }
    
    showError(error) {
        const contentDiv = document.getElementById('app-content');
        if (contentDiv) {
            contentDiv.innerHTML = `
                <div class="alert alert-danger m-4">
                    <h4>Erro de Autenticação</h4>
                    <p>${error.message}</p>
                    <a href="index.html" class="btn btn-primary">
                        Voltar ao Login
                    </a>
                </div>
            `;
        }
    }
}

if (window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new AppCore();
        
        if (window.app) {
            window.app.init();
        }
    });
}

export default AppCore;