import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { checkAuth, loadNavbar } from './auth-check.js';

let state = {
    cpf: '',
    userData: null
};

function getById(id) {
    return document.getElementById(id);
}

function formatarCPF(cpf) {
    const digits = String(cpf || '').replace(/\D/g, '').slice(0, 11);
    if (digits.length !== 11) return digits;
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatarDataHora(valor) {
    if (!valor) return '';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '';
    return data.toLocaleString('pt-BR');
}

function showAlert(message, type = 'warning') {
    const alert = getById('perfilAlert');
    if (!alert) return;
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
}

function hideAlert() {
    const alert = getById('perfilAlert');
    if (!alert) return;
    alert.className = 'alert d-none';
    alert.textContent = '';
}

function preencherFormulario(data = {}) {
    getById('perfilNome').value = data.nome || '';
    getById('perfilEmail').value = data.email || '';
    getById('perfilCpf').value = formatarCPF(state.cpf);
    getById('perfilTelefone').value = data.telefone || data.whatsapp || '';
    getById('perfilNivel').value = String(data.nivel || 3);
    getById('perfilDataNascimento').value = String(data.dataNascimento || '').slice(0, 10);
    getById('perfilAtualizadoEm').value = formatarDataHora(data.atualizadoEm || data.criadoEm || '');
}

async function carregarPerfilAtual() {
    const authContext = await checkAuth(3);
    state.cpf = authContext.cpf;

    const snapshot = await get(ref(database, `usuarios/${state.cpf}`));
    if (!snapshot.exists()) {
        throw new Error('Perfil nao encontrado.');
    }

    state.userData = snapshot.val() || {};
    preencherFormulario(state.userData);
}

async function salvarPerfil() {
    const button = getById('perfilSalvarBtn');
    const originalHtml = button?.innerHTML;

    try {
        hideAlert();

        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Salvando';
        }

        const payload = {
            ...state.userData,
            nome: getById('perfilNome').value.trim(),
            email: getById('perfilEmail').value.trim(),
            telefone: getById('perfilTelefone').value.trim(),
            whatsapp: getById('perfilTelefone').value.trim(),
            dataNascimento: getById('perfilDataNascimento').value || '',
            atualizadoEm: new Date().toISOString()
        };

        await update(ref(database, `usuarios/${state.cpf}`), payload);
        state.userData = payload;
        sessionStorage.setItem('userName', payload.nome || 'Usuario');

        if (window.updateUserGreetingInSPA) window.updateUserGreetingInSPA();
        if (window.updateNavbarUserGreeting) window.updateNavbarUserGreeting();

        preencherFormulario(state.userData);
        showAlert('Perfil atualizado com sucesso.', 'success');
    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        showAlert(error?.message || 'Nao foi possivel salvar o perfil.', 'danger');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

function bindEvents() {
    getById('perfilForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        await salvarPerfil();
    });

    getById('perfilVoltarBtn')?.addEventListener('click', async () => {
        if (window.app?.loadPage) {
            await window.app.loadPage('dashboard.html');
        } else {
            window.location.href = 'dashboard.html';
        }
    });
}

export async function initPerfil() {
    try {
        bindEvents();
        await carregarPerfilAtual();
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showAlert(error?.message || 'Nao foi possivel carregar o perfil.', 'danger');
    }
}

export async function initPerfilSPA() {
    await initPerfil();
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await loadNavbar();
        } catch (error) {
            console.warn('Nao foi possivel carregar a navbar do perfil:', error);
        }
        await initPerfil();
    });
}
