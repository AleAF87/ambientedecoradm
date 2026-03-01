// js/navbar.js - Controle da Navbar - Ambiente Decor
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

console.log('✅ navbar.js carregado - Ambiente Decor');

// 1. ATUALIZAR DROPDOWN COM NOME DO USUÁRIO
function updateUserGreeting() {
    const greeting = document.getElementById('userGreeting');
    const dropdownToggle = document.getElementById('userGreetingDropdown');
    
    if (!greeting || !dropdownToggle) {
        setTimeout(updateUserGreeting, 100);
        return;
    }
    
    // BUSCAR DADOS DO USUÁRIO
    const userName = sessionStorage.getItem('userName');
    const userCPF = sessionStorage.getItem('userCPF');
    
    console.log('📦 Navbar - Dados:', { userName, userCPF });
    
    if (userName) {
        let cleanName = userName;
        cleanName = cleanName.replace(/\.{3,}/g, '');
        cleanName = cleanName.replace(/\s*\(.*\)/g, '');
        cleanName = cleanName.trim();
        
        greeting.textContent = cleanName;
        
        // Tooltip com CPF
        if (userCPF && userCPF.length === 11) {
            const cpfFormatado = userCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            dropdownToggle.title = `CPF: ${cpfFormatado}`;
            
            // Inicializar tooltip do Bootstrap
            if (typeof bootstrap !== 'undefined') {
                new bootstrap.Tooltip(dropdownToggle);
            }
        }
        
        return true;
    }
    
    greeting.textContent = 'Visitante';
    return false;
}

// 2. FUNÇÃO DE LOGOUT
async function performLogout() {
    try {
        if (auth) {
            await signOut(auth);
        }
        
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Erro no logout:', error);
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'index.html';
    }
}

// 3. CONFIGURAR DROPDOWN
function setupDropdown() {
    const logoutBtn = document.getElementById('navLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const originalText = logoutBtn.innerHTML;
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saindo...';
            
            await performLogout();
            
            setTimeout(() => {
                logoutBtn.innerHTML = originalText;
            }, 3000);
        });
    }
    
    const profileBtn = document.getElementById('navProfile');
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            if (window.app && window.app.loadPage) {
                window.app.loadPage('perfil.html');
            } else {
                window.location.href = 'perfil.html';
            }
        });
    }
}

// 4. DESTACAR MENU ATIVO (CORRIGIDO PARA SPA)
function highlightMenu() {
    // Para SPA, precisamos olhar para o hash ou para a última página carregada
    let currentPage = 'dashboard.html';
    
    if (window.app && window.app.currentPage) {
        currentPage = window.app.currentPage;
    } else {
        // Fallback: tenta pegar do pathname
        const pathPage = location.pathname.split('/').pop();
        if (pathPage && pathPage !== 'app.html') {
            currentPage = pathPage;
        }
    }
    
    console.log('🎯 Destacando menu para:', currentPage);
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.style.pointerEvents = 'auto';
        link.style.opacity = '1';
        link.style.color = 'rgba(255, 245, 235, 0.9)';
        link.style.backgroundColor = 'transparent';
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        // Comparação mais flexível
        if (href === currentPage || 
            (currentPage.includes('orcamentos') && href.includes('orcamentos')) ||
            (currentPage.includes('dashboard') && href.includes('dashboard')) ||
            (currentPage.includes('perfil') && href.includes('perfil'))) {
            
            link.classList.add('active');
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.95';
            link.style.color = '#fff';
            link.style.backgroundColor = 'rgba(210, 180, 140, 0.2)';
            
            console.log('✅ Ativo:', href);
        }
    });
    
    const navbarBrand = document.querySelector('.navbar-brand');
    if (navbarBrand) {
        navbarBrand.classList.remove('active');
        navbarBrand.style.cursor = 'default';
        navbarBrand.style.opacity = '1';
        navbarBrand.style.color = '#fff';
    }
}

// 5. CONFIGURAR NAVEGAÇÃO SPA
function setupSPANavigation() {
    document.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link[href$=".html"]');
        if (link && !link.hasAttribute('data-ignore-spa')) {
            e.preventDefault();
            const href = link.getAttribute('href');
            
            console.log('🔄 Navegando para:', href);
            
            if (window.app && window.app.loadPage) {
                window.app.loadPage(href);
            } else {
                window.location.href = href;
            }
        }
    });
}

// 6. ESTILIZAR DROPDOWN
function styleDropdownToggle() {
    const dropdownToggle = document.getElementById('userGreetingDropdown');
    if (!dropdownToggle) return;
    
    dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 0.5)';
    dropdownToggle.style.color = '#fff';
    dropdownToggle.style.transition = 'all 0.3s';
    dropdownToggle.style.backgroundColor = 'transparent';
    
    dropdownToggle.addEventListener('mouseenter', () => {
        dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 1)';
        dropdownToggle.style.backgroundColor = 'rgba(210, 180, 140, 0.15)';
    });
    
    dropdownToggle.addEventListener('mouseleave', () => {
        dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 0.5)';
        dropdownToggle.style.backgroundColor = 'transparent';
    });
    
    dropdownToggle.addEventListener('click', () => {
        setTimeout(() => {
            const isOpen = dropdownToggle.getAttribute('aria-expanded') === 'true';
            if (isOpen) {
                dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 1)';
                dropdownToggle.style.backgroundColor = 'rgba(210, 180, 140, 0.2)';
            } else {
                dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 0.5)';
                dropdownToggle.style.backgroundColor = 'transparent';
            }
        }, 10);
    });
}

// 7. INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando navbar...');
    
    // Tentar atualizar saudação múltiplas vezes
    updateUserGreeting();
    setTimeout(updateUserGreeting, 500);
    setTimeout(updateUserGreeting, 1000);
    
    setupDropdown();
    highlightMenu();
    setupSPANavigation();
    styleDropdownToggle();
    
    // Inicializar tooltips do Bootstrap
    if (typeof bootstrap !== 'undefined') {
        const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }
    
    // Observar mudanças no DOM para re-aplicar estilos
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                highlightMenu();
                updateUserGreeting();
            }
        });
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Também observar mudanças no título da página (para SPA)
    const titleObserver = new MutationObserver(function() {
        setTimeout(highlightMenu, 100);
    });
    
    const titleElement = document.querySelector('title');
    if (titleElement) {
        titleObserver.observe(titleElement, { childList: true, characterData: true, subtree: true });
    }
});

// 8. FUNÇÕES GLOBAIS
window.updateNavbarUserGreeting = updateUserGreeting;

window.updateNavbarActiveMenu = function(pageUrl) {
    console.log('🔄 Atualizando menu ativo para:', pageUrl);
    
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        link.style.pointerEvents = 'auto';
        link.style.opacity = '1';
        link.style.color = 'rgba(255, 245, 235, 0.9)';
        link.style.backgroundColor = 'transparent';
    });
    
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        
        // Comparação mais flexível
        if (href === pageUrl || 
            (pageUrl.includes('orcamentos') && href.includes('orcamentos')) ||
            (pageUrl.includes('dashboard') && href.includes('dashboard')) ||
            (pageUrl.includes('perfil') && href.includes('perfil'))) {
            
            link.classList.add('active');
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.95';
            link.style.color = '#fff';
            link.style.backgroundColor = 'rgba(210, 180, 140, 0.2)';
            
            console.log('✅ Ativado:', href);
        }
    });
};

// 9. EXPORTAR
export { updateUserGreeting };