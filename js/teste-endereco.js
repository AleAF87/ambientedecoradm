import { checkAuth, loadNavbar } from './auth-check.js';

function getById(id) {
    return document.getElementById(id);
}

function onlyDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
}

function formatCEP(value) {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function showAlert(message, type = 'warning') {
    const alert = getById('testeEnderecoAlert');
    if (!alert) return;
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
}

function hideAlert() {
    const alert = getById('testeEnderecoAlert');
    if (!alert) return;
    alert.className = 'alert d-none';
    alert.textContent = '';
}

function setStatus(message = '', type = 'muted') {
    const status = getById('testeEnderecoStatus');
    if (!status) return;
    status.textContent = message;
    status.className = `form-text text-${type}`;
}

function clearAddressFields() {
    ['testeEnderecoLogradouro', 'testeEnderecoNumero', 'testeEnderecoComplemento', 'testeEnderecoBairro', 'testeEnderecoCidade', 'testeEnderecoEstado']
        .forEach((id) => {
            const input = getById(id);
            if (input) input.value = '';
        });
}

async function buscarCep() {
    const cepInput = getById('testeEnderecoCep');
    const buscarBtn = getById('testeEnderecoBuscarBtn');
    const cep = onlyDigits(cepInput?.value || '');

    if (cep.length !== 8) {
        showAlert('Informe um CEP valido com 8 numeros.', 'warning');
        setStatus('', 'muted');
        cepInput?.focus();
        return;
    }

    const originalHtml = buscarBtn?.innerHTML;

    try {
        hideAlert();
        setStatus('Buscando endereco...', 'muted');

        if (buscarBtn) {
            buscarBtn.disabled = true;
            buscarBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Buscando';
        }

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
            clearAddressFields();
            showAlert('CEP nao encontrado.', 'warning');
            setStatus('Endereco nao encontrado para este CEP. Preencha manualmente se precisar.', 'danger');
            getById('testeEnderecoLogradouro')?.focus();
            return;
        }

        if (getById('testeEnderecoLogradouro')) getById('testeEnderecoLogradouro').value = data.logradouro || '';
        if (getById('testeEnderecoBairro')) getById('testeEnderecoBairro').value = data.bairro || '';
        if (getById('testeEnderecoCidade')) getById('testeEnderecoCidade').value = data.localidade || '';
        if (getById('testeEnderecoEstado')) getById('testeEnderecoEstado').value = String(data.uf || '').toUpperCase();

        setStatus('Endereco localizado. Confira os dados e informe o numero.', 'success');
        getById('testeEnderecoNumero')?.focus();
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showAlert('Nao foi possivel consultar o CEP agora.', 'danger');
        setStatus('Falha ao consultar o CEP. Voce pode preencher os campos manualmente.', 'danger');
        getById('testeEnderecoLogradouro')?.focus();
    } finally {
        if (buscarBtn) {
            buscarBtn.disabled = false;
            buscarBtn.innerHTML = originalHtml;
        }
    }
}

function bindEvents() {
    getById('testeEnderecoCep')?.addEventListener('input', (event) => {
        event.target.value = formatCEP(event.target.value);
        hideAlert();
        setStatus('', 'muted');
    });

    getById('testeEnderecoEstado')?.addEventListener('input', (event) => {
        event.target.value = String(event.target.value || '').toUpperCase().slice(0, 2);
    });

    getById('testeEnderecoBuscarBtn')?.addEventListener('click', async () => {
        await buscarCep();
    });

    getById('testeEnderecoCep')?.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        await buscarCep();
    });

    getById('testeEnderecoLimparBtn')?.addEventListener('click', () => {
        getById('testeEnderecoForm')?.reset();
        clearAddressFields();
        hideAlert();
        setStatus('', 'muted');
        getById('testeEnderecoCep')?.focus();
    });
}

async function bootstrapTesteEndereco() {
    await checkAuth(3);
    bindEvents();
}

export async function initTesteEndereco() {
    try {
        await bootstrapTesteEndereco();
    } catch (error) {
        console.error('Erro ao carregar teste-endereco:', error);
        showAlert(error?.message || 'Nao foi possivel carregar a pagina.', 'danger');
    }
}

export async function initTesteEnderecoSPA() {
    await initTesteEndereco();
}

if (!window.location.pathname.includes('app.html') && !document.getElementById('app-content')) {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await loadNavbar();
        } catch (error) {
            console.warn('Nao foi possivel carregar a navbar da pagina teste-endereco:', error);
        }
        await initTesteEndereco();
    });
}
