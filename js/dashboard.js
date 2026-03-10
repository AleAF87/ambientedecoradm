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

// Ordem dos status para exibição
const STATUS_ORDER = [
    'fazer_visita',
    'fazer_orcamento',
    'medicao_fina',
    'producao',
    'montagem',
    'aguardando',
    'concluido',
    'geladeira',
    'cancelado'
];

let lista = [];
let listaOrcamentos = [];
let termoBusca = '';
let modoVisualizacao = 'kanban';
let draggedItem = null;

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

    onValue(ref(database, 'orcamentos'), (snapshot) => {
        const dados = snapshot.val() || {};
        listaOrcamentos = Object.keys(dados).map((id) => ({ id, ...dados[id] }));
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

    const filtrados = lista.filter((item) => 
        (item.clienteEmpresa || '').toLowerCase().includes(termoBusca)
    );

    if (modoVisualizacao === 'calendar') {
        renderCalendario(content, filtrados);
        return;
    }

    // Agrupar por status
    const agrupado = {};
    filtrados.forEach((item) => {
        const status = item.status || 'aguardando';
        if (!agrupado[status]) agrupado[status] = [];
        agrupado[status].push(item);
    });

    // Calcular estatísticas
    const totalOrcamentos = filtrados.length;
    const andamento = filtrados.filter(item => 
        !['concluido', 'cancelado', 'geladeira'].includes(item.status || '')
    ).length;
    const concluidos = filtrados.filter(item => 
        ['concluido'].includes(item.status || '')
    ).length;
    
    // Calcular atrasados (itens com proximoEventoData anterior a hoje)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const atrasados = filtrados.filter(item => {
        if (!item.proximoEventoData || ['concluido', 'cancelado'].includes(item.status || '')) return false;
        const [ano, mes, dia] = item.proximoEventoData.split('-').map(Number);
        const dataEvento = new Date(ano, mes - 1, dia);
        return dataEvento < hoje;
    }).length;

    content.innerHTML = `
        <div class="stats mb-4">
            <div class="stat-card">
                <h3>Total de Orçamentos</h3>
                <div class="number">${totalOrcamentos}</div>
            </div>
            <div class="stat-card">
                <h3>Em Andamento</h3>
                <div class="number">${andamento}</div>
            </div>
            <div class="stat-card">
                <h3>Concluídos</h3>
                <div class="number">${concluidos}</div>
            </div>
            <div class="stat-card">
                <h3>Atrasados</h3>
                <div class="number">${atrasados}</div>
            </div>
        </div>
        <div class="kanban-board" id="kanbanBoard">
            ${STATUS_ORDER.map((status) => renderColuna(status, agrupado[status] || [])).join('')}
        </div>
    `;

    habilitarDragAndDrop();
}

function renderColuna(status, cards) {
    const statusLabel = STATUS_LABELS[status] || status;
    const getCorBorda = (status) => {
        const cores = {
            'fazer_visita': '#2196f3',
            'fazer_orcamento': '#ff9800',
            'medicao_fina': '#9c27b0',
            'producao': '#ff5722',
            'montagem': '#795548',
            'aguardando': '#757575',
            'concluido': '#4caf50',
            'geladeira': '#00bcd4',
            'cancelado': '#f44336'
        };
        return cores[status] || '#1a237e';
    };

    return `
        <div class="kanban-column" data-status="${status}">
            <div class="column-header">
                <h2>${statusLabel}</h2>
                <span class="column-count">${cards.length}</span>
            </div>
            <div class="cards-container drop-zone" data-status="${status}">
                ${cards.map((item) => renderCard(item, getCorBorda(status))).join('') || 
                  '<div class="empty-column">Nenhum item</div>'}
            </div>
        </div>
    `;
}

function renderCard(item, corBorda) {    
    // Calcular dias restantes ou atraso
    let diasInfo = '';
    if (item.proximoEventoData) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const [ano, mes, dia] = item.proximoEventoData.split('-').map(Number);
        const dataEvento = new Date(ano, mes - 1, dia);
        const diffTime = dataEvento - hoje;
        const diffDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDias < 0) {
            diasInfo = `<span class="deadline overdue">${Math.abs(diffDias)} dias atrasado</span>`;
        } else if (diffDias === 0) {
            diasInfo = '<span class="deadline today">Hoje</span>';
        } else if (diffDias <= 3) {
            diasInfo = `<span class="deadline soon">${diffDias} dias</span>`;
        } else {
            diasInfo = `<span class="deadline">${diffDias} dias</span>`;
        }
    }

    return `
        <div class="card" draggable="true" data-id="${item.id}" data-status="${item.status || 'aguardando'}" 
             style="border-left-color: ${corBorda}">
            <div class="card-header">
                <span class="os-number">#${item.id}</span>
            </div>
            <div class="card-body">
                <h3>${item.clienteEmpresa || 'Sem cliente'}</h3>
                <p>📅 Contato: ${formatarData(item.dataContato) || '-'}</p>
                <p>📋 Próximo: ${STATUS_LABELS[item.proximoEvento] || '-'}</p>
            </div>
            <div class="card-footer">
                <span>📅 ${formatarData(item.proximoEventoData) || 'Sem data'}</span>
                <span class="client-info">
                    ${diasInfo || '⏳ Sem prazo'}
                </span>
            </div>
            <button class="card-edit-btn" onclick="window.abrirOrcamento('${item.id}')">
                <i class="fas fa-arrow-up-right-from-square"></i>
            </button>
        </div>
    `;
}

function habilitarDragAndDrop() {
    const cards = document.querySelectorAll('.card[draggable="true"]');
    const colunas = document.querySelectorAll('.cards-container');

    // Remover event listeners antigos
    cards.forEach((card) => {
        card.removeEventListener('dragstart', dragStart);
        card.removeEventListener('dragend', dragEnd);
        card.addEventListener('dragstart', dragStart);
        card.addEventListener('dragend', dragEnd);
    });

    colunas.forEach((coluna) => {
        coluna.removeEventListener('dragover', dragOver);
        coluna.removeEventListener('dragleave', dragLeave);
        coluna.removeEventListener('drop', drop);
        coluna.addEventListener('dragover', dragOver);
        coluna.addEventListener('dragleave', dragLeave);
        coluna.addEventListener('drop', drop);
    });
}

function dragStart(event) {
    const card = event.target.closest('.card');
    if (!card) return;
    
    draggedItem = card;
    event.dataTransfer?.setData('text/plain', card.dataset.id || '');
    card.classList.add('dragging');
}

function dragEnd(event) {
    const card = event.target.closest('.card');
    if (card) {
        card.classList.remove('dragging');
    }
    
    document.querySelectorAll('.cards-container').forEach(container => {
        container.classList.remove('drag-over');
    });
    
    draggedItem = null;
}

function dragOver(event) {
    event.preventDefault();
    const container = event.currentTarget;
    container.classList.add('drag-over');
}

function dragLeave(event) {
    const container = event.currentTarget;
    container.classList.remove('drag-over');
}

async function drop(event) {
    event.preventDefault();
    const container = event.currentTarget;
    container.classList.remove('drag-over');

    const id = event.dataTransfer?.getData('text/plain');
    const novoStatus = container.closest('.kanban-column')?.dataset.status;
    
    if (!id || !novoStatus) return;

    const atual = lista.find((item) => item.id === id);
    if (!atual || atual.status === novoStatus) return;

    // Atualizar no Firebase
    await Promise.all([
        update(ref(database, `statusOrc/${id}`), { status: novoStatus }),
        update(ref(database, `orcamentos/${id}`), { status: novoStatus }).catch(async () => {
            await update(ref(database, `orcamento/${id}`), { status: novoStatus });
        })
    ]);
}

function renderCalendario(container, itens) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth();
    const primeiroDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const inicioSemana = primeiroDia.getDay();

    const eventosPorDia = {};
    const itensCalendario = listaOrcamentos.length > 0
        ? listaOrcamentos
            .map((orc) => ({
                id: orc.id,
                clienteEmpresa: orc.projeto?.clienteEmpresa || orc.clienteEmpresa || 'Sem cliente',
                dataProximoEvento: orc.datas?.dataProximoEvento || orc.dataProximoEvento || null,
                statusProxMissao: orc.statusProxMissaro || orc.statusProxMissao || null,
                status: orc.status || 'aguardando'
            }))
            .filter((orc) => (orc.clienteEmpresa || '').toLowerCase().includes(termoBusca))
        : itens.map((item) => ({
            ...item,
            dataProximoEvento: item.proximoEventoData,
            statusProxMissao: item.proximoEvento || item.statusProxMissaro || item.statusProxMissao
        }));

    itensCalendario.forEach((item) => {
        if (!item.dataProximoEvento) return;
        const [yyyy, mm, dd] = item.dataProximoEvento.split('-').map(Number);
        if (!yyyy || !mm || !dd) return;
        if (yyyy !== ano || mm - 1 !== mes) return;

        if (!eventosPorDia[dd]) eventosPorDia[dd] = [];
        eventosPorDia[dd].push(item);
    });

    let diasHtml = '';
    for (let i = 0; i < inicioSemana; i += 1) {
        diasHtml += '<div class="calendar-day empty"></div>';
    }

    for (let dia = 1; dia <= ultimoDia.getDate(); dia += 1) {
        const eventos = eventosPorDia[dia] || [];
        const isHoje = dia === hoje.getDate() && mes === hoje.getMonth() && ano === hoje.getFullYear();
        
        diasHtml += `
            <div class="calendar-day ${isHoje ? 'today' : ''}">
                <div class="day-number">${dia}</div>
                <div class="day-events">
                    ${eventos.map((item) => `
                        <div class="calendar-event" onclick="window.abrirOrcamento('${item.id}')">
                            <div class="event-title">${item.clienteEmpresa || 'Sem cliente'}</div>
                            <div class="event-status">${STATUS_LABELS[item.statusProxMissao] || '-'}</div>
                        </div>
                    `).join('')}
                    ${eventos.length === 0 ? '<div class="no-events">Sem eventos</div>' : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="calendar-header">
            <h3>${hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
            <p class="text-muted">Visualização do calendário baseada em "próximo evento"</p>
        </div>
        <div class="calendar-grid">
            <div class="weekday">Dom</div>
            <div class="weekday">Seg</div>
            <div class="weekday">Ter</div>
            <div class="weekday">Qua</div>
            <div class="weekday">Qui</div>
            <div class="weekday">Sex</div>
            <div class="weekday">Sáb</div>
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