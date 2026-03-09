import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, onValue, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

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
let modoVisualizacao = 'kanban';

export async function initDashboard() {
    await checkAuth(3);

    document.getElementById('dashboardBusca')?.addEventListener('input', (e) => {
        termoBusca = e.target.value.toLowerCase();
        render();
    });

    document.getElementById('viewKanban')?.addEventListener('click', () => {
        modoVisualizacao = 'kanban';
        atualizarBotoesVisualizacao();
        render();
    });

    document.getElementById('viewCalendar')?.addEventListener('click', () => {
        modoVisualizacao = 'calendar';
        atualizarBotoesVisualizacao();
        render();
    });

    onValue(ref(database, 'statusOrc'), (snapshot) => {
        const dados = snapshot.val() || {};
        lista = Object.keys(dados).map((id) => ({ id, ...dados[id] }));
        render();
    });
}

function atualizarBotoesVisualizacao() {
    const btnKanban = document.getElementById('viewKanban');
    const btnCalendar = document.getElementById('viewCalendar');

    if (!btnKanban || !btnCalendar) return;

    btnKanban.className = `btn btn-sm ${modoVisualizacao === 'kanban' ? 'btn-primary' : 'btn-outline-primary'}`;
    btnCalendar.className = `btn btn-sm ${modoVisualizacao === 'calendar' ? 'btn-primary' : 'btn-outline-primary'}`;
}

function render() {
    const content = document.getElementById('dashboard-content');
    if (!content) return;

    const filtrados = lista.filter((item) => (item.clienteEmpresa || '').toLowerCase().includes(termoBusca));

    if (modoVisualizacao === 'calendar') {
        renderCalendario(content, filtrados);
        return;
    }

    const agrupado = {};
    filtrados.forEach((item) => {
        const status = item.status || 'aguardando';
        if (!agrupado[status]) agrupado[status] = [];
        agrupado[status].push(item);
    });

    const statusOrdenados = Object.keys(STATUS_LABELS);
    content.innerHTML = `
        <div class="d-flex gap-3 overflow-auto pb-2" id="kanbanBoard">
            ${statusOrdenados.map((status) => renderColuna(status, agrupado[status] || [])).join('')}
        </div>
    `;

    habilitarDragAndDrop();
}

function renderColuna(status, cards) {
    return `
        <div class="border rounded p-2 bg-light" style="min-width: 300px;">
            <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-2">
                <strong>${STATUS_LABELS[status]}</strong>
                <span class="badge bg-secondary">${cards.length}</span>
            </div>
            <div class="drop-zone" data-status="${status}" style="min-height: 180px; border-radius: 8px; transition: background-color .2s;">
                ${cards.map((item) => renderCard(item, true)).join('') || '<p class="text-muted small px-2">Sem itens</p>'}
            </div>
        </div>
    `;
}

function renderCard(item) {    
    return `
        <div class="card mb-2" style="cursor:pointer" onclick="window.abrirOrcamento('${item.id}')">    
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start gap-2">
                    <div>
                        <div class="small text-muted">#${item.id}</div>
                        <div class="fw-semibold">${item.clienteEmpresa || 'Sem cliente'}</div>
                    </div>
                    <button class="btn btn-outline-primary btn-sm" onclick="window.abrirOrcamento('${item.id}')">
                        <i class="fas fa-arrow-up-right-from-square"></i>
                    </button>
                </div>
                <div class="small">Contato: ${formatarData(item.dataContato)}</div>
                <div class="small">Próx.: ${STATUS_LABELS[item.proximoEvento] || '-'}</div>
                <div class="small">Data próx.: ${formatarData(item.proximoEventoData)}</div>
            </div>
        </div>
    `;
}

function habilitarDragAndDrop() {
    const cards = document.querySelectorAll('.card[draggable="true"]');
    const colunas = document.querySelectorAll('.drop-zone');

    cards.forEach((card) => {
        card.addEventListener('dragstart', (event) => {
            event.dataTransfer?.setData('text/plain', card.dataset.id || '');
            card.classList.add('opacity-50');
        });

        card.addEventListener('dragend', () => {
            card.classList.remove('opacity-50');
        });
    });

    colunas.forEach((coluna) => {
        coluna.addEventListener('dragover', (event) => {
            event.preventDefault();
            coluna.style.backgroundColor = '#e7f1ff';
        });

        coluna.addEventListener('dragleave', () => {
            coluna.style.backgroundColor = 'transparent';
        });

        coluna.addEventListener('drop', async (event) => {
            event.preventDefault();
            coluna.style.backgroundColor = 'transparent';

            const id = event.dataTransfer?.getData('text/plain');
            const novoStatus = coluna.dataset.status;
            if (!id || !novoStatus) return;

            const atual = lista.find((item) => item.id === id);
            if (!atual || atual.status === novoStatus) return;

            await update(ref(database, `statusOrc/${id}`), { status: novoStatus });
        });
    });
}

function renderCalendario(container, itens) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const inicioSemana = primeiroDia.getDay();

    const eventosPorDia = {};
    itens.forEach((item) => {
        if (!item.proximoEventoData) return;
        const [yyyy, mm, dd] = item.proximoEventoData.split('-').map(Number);
        if (!yyyy || !mm || !dd) return;
        if (yyyy !== ano || mm - 1 !== mes) return;

        if (!eventosPorDia[dd]) eventosPorDia[dd] = [];
        eventosPorDia[dd].push(item);
    });

    let diasHtml = '';
    for (let i = 0; i < inicioSemana; i += 1) {
        diasHtml += '<div class="border rounded p-2 bg-light-subtle"></div>';
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia += 1) {
        const eventos = eventosPorDia[dia] || [];
        diasHtml += `
            <div class="border rounded p-2" style="min-height: 160px;">
                <div class="fw-semibold mb-2">${dia}</div>
                <div class="d-flex flex-column gap-2">
                    ${eventos.map((item) => `
                        <div class="border rounded p-2 bg-light">
                            <div class="small fw-semibold">${item.clienteEmpresa || 'Sem cliente'}</div>
                            <div class="small text-muted">${STATUS_LABELS[item.status] || '-'}</div>
                            <button class="btn btn-outline-primary btn-sm mt-1" onclick="window.abrirOrcamento('${item.id}')">Abrir</button>
                        </div>
                    `).join('') || '<div class="small text-muted">Sem eventos</div>'}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="mb-3 small text-muted">
            Visualização calendário (mês atual), usando <code>proximoEventoData</code>.
        </div>
        <div class="d-grid gap-2" style="grid-template-columns: repeat(7, minmax(0, 1fr));">
            <div class="fw-semibold text-center">Dom</div>
            <div class="fw-semibold text-center">Seg</div>
            <div class="fw-semibold text-center">Ter</div>
            <div class="fw-semibold text-center">Qua</div>
            <div class="fw-semibold text-center">Qui</div>
            <div class="fw-semibold text-center">Sex</div>
            <div class="fw-semibold text-center">Sáb</div>
            ${diasHtml}
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