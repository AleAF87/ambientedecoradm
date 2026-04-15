import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

function updateUserGreeting() {
    const greeting = document.getElementById('userGreeting');
    const dropdownToggle = document.getElementById('userGreetingDropdown');

    if (!greeting || !dropdownToggle) return;

    const userName = sessionStorage.getItem('userName');
    const userCPF = sessionStorage.getItem('userCPF');

    if (userName) {
        const cleanName = userName.replace(/\.{3,}/g, '').replace(/\s*\(.*\)/g, '').trim();
        greeting.textContent = cleanName;

        if (userCPF) {
            dropdownToggle.title = `CPF: ${userCPF}`;
            dropdownToggle.setAttribute('data-bs-toggle', 'tooltip');
            dropdownToggle.setAttribute('data-bs-placement', 'bottom');
        }
    } else {
        greeting.textContent = 'Usuario';
    }
}

function collapseNavbar() {
    const collapseEl = document.getElementById('mainNavbar');
    if (!collapseEl || typeof bootstrap === 'undefined' || !bootstrap.Collapse) return;

    const collapse = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
    collapse.hide();
}

async function performLogout() {
    try {
        if (auth) await signOut(auth);
    } catch (error) {
        console.error(error);
    }

    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'index.html';
}

function setupDropdown() {
    const logoutBtn = document.getElementById('navLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saindo...';
            await performLogout();
        });
    }

    const profileBtn = document.getElementById('navProfile');
    if (profileBtn) {
        profileBtn.addEventListener('click', (event) => {
            event.preventDefault();
            collapseNavbar();

            if (window.app?.loadPage) {
                window.app.loadPage('perfil.html');
            } else {
                window.location.href = 'perfil.html';
            }
        });
    }
}

function matchPage(href, currentPage) {
    return href === currentPage
        || (currentPage.includes('orcamentos') && href.includes('orcamentos'))
        || (currentPage.includes('dashboard') && href.includes('dashboard'))
        || (currentPage.includes('perfil') && href.includes('perfil'))
        || (currentPage.includes('sociedade') && href.includes('sociedade'))
        || (currentPage.includes('teste-endereco') && href.includes('teste-endereco'));
}

function highlightMenu(pageOverride = '') {
    const currentPage = pageOverride || window.app?.currentPage || location.pathname.split('/').pop() || 'dashboard.html';

    document.querySelectorAll('.nav-link').forEach((link) => {
        const href = link.getAttribute('href') || '';
        const isActive = matchPage(href, currentPage);
        link.classList.toggle('active', isActive);
        link.style.pointerEvents = isActive ? 'none' : 'auto';
        link.style.opacity = isActive ? '0.95' : '1';
        link.style.color = isActive ? '#fff' : 'rgba(255, 245, 235, 0.9)';
        link.style.backgroundColor = isActive ? 'rgba(210, 180, 140, 0.2)' : 'transparent';
    });
}

function setupSPANavigation() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href$=".html"]');
        if (!link || link.hasAttribute('data-ignore-spa') || !window.app?.loadPage) return;

        event.preventDefault();
        collapseNavbar();
        window.app.loadPage(link.getAttribute('href'));
    });
}

function styleDropdownToggle() {
    const dropdownToggle = document.getElementById('userGreetingDropdown');
    if (!dropdownToggle) return;

    dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 0.5)';
    dropdownToggle.style.color = '#fff';
    dropdownToggle.style.transition = 'all 0.2s';
    dropdownToggle.style.backgroundColor = 'transparent';

    dropdownToggle.addEventListener('mouseenter', () => {
        dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 1)';
        dropdownToggle.style.backgroundColor = 'rgba(210, 180, 140, 0.15)';
    });

    dropdownToggle.addEventListener('mouseleave', () => {
        dropdownToggle.style.borderColor = 'rgba(210, 180, 140, 0.5)';
        dropdownToggle.style.backgroundColor = 'transparent';
    });
}

function initNavbar() {
    updateUserGreeting();
    setupDropdown();
    setupSPANavigation();
    styleDropdownToggle();
    highlightMenu();

    if (typeof bootstrap !== 'undefined') {
        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((element) => {
            try {
                new bootstrap.Tooltip(element);
            } catch (error) {
                console.warn('Tooltip nao inicializado:', error);
            }
        });
    }
}

document.addEventListener('navbar:loaded', initNavbar);

window.updateNavbarUserGreeting = updateUserGreeting;
window.updateNavbarActiveMenu = function(pageUrl) {
    highlightMenu(pageUrl);
};

export { updateUserGreeting };
