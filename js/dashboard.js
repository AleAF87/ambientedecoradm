import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const STATUS_LABELS = {
    fazer_visita: '🚪 Fazer Visita',
    fazer_orcamento: '📝 Fazer Orçamento',
    medicao_fina: '📏 Medição Fina',
    producao: '🔨 Produção',
    montagem: '🔧 Montagem',
    aguardando: '⏳ Aguardando',
    concluido: '✅ Concluído',
    geladeira: '❄️ Geladeira',
    cancelado: '🚫 Cancelado'
};

let lista = [];
let termoBusca = '';

export async function initDashboard() {
    await checkAuth(3);
    document.getElementById('dashboardBusca')?.addEventListener('input', (e) => {
        termoBusca = e.target.value.toLowerCase();
        render();
    });

    onValue(ref(database, 'statusOrc'), (snapshot) => {
        const dados = snapshot.val() || {};
        lista = Object.keys(dados).map((id) => ({ id, ...dados[id] }));
        render();
    });
}

function render() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    const filtrados = lista.filter((item) => (item.clienteEmpresa || '').toLowerCase().includes(termoBusca));
    const agrupado = {};

    filtrados.forEach((item) => {
        const status = item.status || 'aguardando';
        if (!agrupado[status]) agrupado[status] = [];
        agrupado[status].push(item);
    });

    const statusOrdenados = Object.keys(STATUS_LABELS);

    content.innerHTML = `
        <div class="d-flex gap-3 overflow-auto pb-2">
            ${statusOrdenados.map((status) => renderColuna(status, agrupado[status] || [])).join('')}
        </div>
    `;
}

function renderColuna(status, cards) {
    return `
        <div class="border rounded p-2 bg-light" style="min-width: 270px;">
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                <strong>${STATUS_LABELS[status]}</strong>
                <span class="badge bg-secondary">${cards.length}</span>
            </div>
            ${cards.map(renderCard).join('') || '<p class="text-muted small">Sem itens</p>'}
        </div>
    `;
}

function renderCard(item) {    
    return `
        <div class="card mb-2" style="cursor:pointer" onclick="window.abrirOrcamento('${item.id}')">    
            <div class="card-body p-2">
                <div class="small text-muted">#${item.id}</div>
                <div class="fw-semibold">${item.clienteEmpresa || 'Sem cliente'}</div>
                <div class="small">Contato: ${formatarData(item.dataContato)}</div>
                <div class="small">Próx.: ${STATUS_LABELS[item.proximoEvento] || '-'}</div>
                <div class="small">Data próx.: ${formatarData(item.proximoEventoData)}</div>
            </div>
        </div>
    `;
}

function formatarData(data) {
    if (!data) return '-';
    const p = data.split('-');
    if (p.length !== 3) return data;
    return `${p[2]}/${p[1]}/${p[0]}`;
}

window.abrirOrcamento = function (id) {
    if (window.app?.loadPage) {
        window.app.loadPage(`orcamentos-edit.html?id=${id}`);
    } else {
        window.location.href = `orcamentos-edit.html?id=${id}`;
    }
};

if (!window.location.pathname.includes('app.html')) {
    initDashboard();
}