import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let navbarModulePromise = null;

function formatarCPF(cpf) {
    if (!cpf) return null;
    return String(cpf).replace(/\D/g, '').padStart(11, '0');
}

function clearUserData() {
    sessionStorage.removeItem('userCPF');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('userNivel');
    sessionStorage.removeItem('currentUserLevel');
    localStorage.removeItem('userCPF');
    localStorage.removeItem('userName');
}

function redirectToAppWithRefresh() {
    window.location.replace('app.html');
}

async function carregarDadosUsuario(userCPF) {
    const usuarioRef = ref(database, `usuarios/${userCPF}`);
    const snapshot = await get(usuarioRef);

    if (!snapshot.exists()) {
        throw new Error('Dados do usuario nao encontrados');
    }

    const userData = snapshot.val() || {};
    const loginRef = ref(database, `login/${userCPF}`);
    const loginSnapshot = await get(loginRef);
    const loginData = loginSnapshot.exists() ? (loginSnapshot.val() || {}) : {};
    const loginStatus = String(loginData.status || userData.status || 'ativo').trim().toLowerCase();

    if (loginStatus !== 'ativo') {
        throw new Error(`Cadastro com status ${loginStatus}`);
    }

    if (!userData.nome) {
        userData.nome = loginData.nome || auth.currentUser?.email?.split('@')[0] || 'Usuario';
    }

    return {
        userData,
        userLevel: Number(userData.nivel || 3)
    };
}

export function checkAuth(requiredLevel = 3) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            try {
                let userCPF = sessionStorage.getItem('userCPF') || localStorage.getItem('userCPF');
                userCPF = formatarCPF(userCPF);

                if (!userCPF) {
                    throw new Error('CPF nao encontrado');
                }

                const { userData, userLevel } = await carregarDadosUsuario(userCPF);

                sessionStorage.setItem('currentUserLevel', userLevel);
                sessionStorage.setItem('userNivel', userLevel);

                if (userLevel > requiredLevel) {
                    alert('Acesso negado.\n\nCaso necessario, contate o administrador.');

                    if (window.location.pathname.includes('app.html')) {
                        redirectToAppWithRefresh();
                    } else {
                        window.location.href = 'app.html';
                    }

                    reject(new Error(`Nivel insuficiente: ${userLevel} > ${requiredLevel}`));
                    return;
                }

                resolve({
                    user,
                    userData,
                    cpf: userCPF
                });
            } catch (error) {
                console.error('Erro ao verificar acesso:', error.message);

                if (!error.message.includes('Nivel insuficiente')) {
                    alert('Erro ao verificar permissoes: ' + error.message);
                    clearUserData();
                    window.location.href = 'index.html';
                }

                reject(error);
            }
        });
    });
}

async function ensureNavbarModuleLoaded() {
    if (window.location.pathname.includes('app.html')) return;
    if (!navbarModulePromise) {
        navbarModulePromise = import('./navbar.js');
    }
    await navbarModulePromise;
}

export async function loadNavbar() {
    const existingNavbar = document.getElementById('navbar');
    if (existingNavbar && existingNavbar.innerHTML.trim() !== '') {
        await ensureNavbarModuleLoaded();
        return true;
    }

    let navbarElement = document.getElementById('navbar');
    if (!navbarElement) {
        navbarElement = document.createElement('div');
        navbarElement.id = 'navbar';
        document.body.insertBefore(navbarElement, document.body.firstChild);
    }

    try {
        const response = await fetch('components/navbar.html');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        navbarElement.innerHTML = await response.text();
        await ensureNavbarModuleLoaded();
        document.dispatchEvent(new CustomEvent('navbar:loaded'));
        return true;
    } catch (error) {
        console.error('Erro ao carregar navbar:', error.message);

        if (!navbarElement.innerHTML.trim()) {
            navbarElement.innerHTML = createFallbackNavbar();
        }

        return false;
    }
}

function createFallbackNavbar() {
    return `
        <nav class="navbar navbar-dark bg-marrom-escuro fixed-top">
            <div class="container-fluid">
                <span class="navbar-brand">
                    <img src="img/logo.png" alt="Ambiente Decor" style="height: 35px; margin-right: 10px;" onerror="this.style.display='none'">
                    Ambiente Decor
                </span>
                <div class="d-flex">
                    <a href="dashboard.html" class="btn btn-outline-light btn-sm me-2">Dashboard</a>
                    <a href="orcamentos.html" class="btn btn-outline-light btn-sm me-2">Orcamentos</a>
                    <a href="sociedade.html" class="btn btn-outline-light btn-sm">Sociedade</a>
                </div>
            </div>
        </nav>
    `;
}

export async function getCurrentUser() {
    const { cpf } = await checkAuth(3);
    const usuarioRef = ref(database, `usuarios/${cpf}`);
    const snapshot = await get(usuarioRef);

    if (!snapshot.exists()) {
        throw new Error('Usuario nao encontrado');
    }

    return {
        cpf,
        data: snapshot.val() || {}
    };
}

window.logout = function() {
    clearUserData();
    auth.signOut().finally(() => {
        window.location.href = 'index.html';
    });
};

export default {
    checkAuth,
    loadNavbar,
    getCurrentUser
};
