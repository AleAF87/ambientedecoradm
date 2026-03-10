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

    // Adicionar estilos dinamicamente se não existirem
    adicionarEstilosKanban();
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
    await update(ref(database, `statusOrc/${id}`), { status: novoStatus });
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
                            <div class="event-status">${STATUS_LABELS[item.status] || '-'}</div>
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

function adicionarEstilosKanban() {
    // Verificar se os estilos já existem
    if (document.getElementById('kanban-styles')) return;

    const styles = `
        <style id="kanban-styles">
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .stat-card {
                background: white;
                padding: 20px;
                border-radius: 10px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .stat-card h3 {
                color: #666;
                font-size: 0.9em;
                margin-bottom: 5px;
            }

            .stat-card .number {
                font-size: 2em;
                font-weight: bold;
                color: #1a237e;
            }

            .kanban-board {
                display: flex;
                gap: 20px;
                overflow-x: auto;
                padding: 10px 0 20px 0;
                min-height: 600px;
            }

            .kanban-column {
                min-width: 320px;
                background: #f8f9fa;
                border-radius: 12px;
                padding: 15px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: flex;
                flex-direction: column;
                max-height: 800px;
            }

            .column-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #e0e0e0;
            }

            .column-header h2 {
                font-size: 1.1em;
                color: #333;
                margin: 0;
                font-weight: 600;
            }

            .column-count {
                background: #e0e0e0;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.9em;
                font-weight: bold;
                color: #333;
            }

            .cards-container {
                flex: 1;
                min-height: 400px;
                overflow-y: auto;
                padding: 5px;
                transition: background-color 0.2s;
            }

            .cards-container.drag-over {
                background-color: #e3f2fd;
                border-radius: 8px;
            }

            .card {
                background: white;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 12px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                cursor: move;
                transition: transform 0.2s, box-shadow 0.2s;
                border-left: 4px solid;
                position: relative;
            }

            .card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }

            .card.dragging {
                opacity: 0.5;
                transform: scale(0.98);
            }

            .card-header {
                margin-bottom: 10px;
            }

            .os-number {
                font-weight: bold;
                color: #1a237e;
                background: #e8eaf6;
                padding: 4px 10px;
                border-radius: 5px;
                font-size: 0.85em;
                display: inline-block;
            }

            .card-body h3 {
                font-size: 1.1em;
                margin: 0 0 8px 0;
                color: #333;
                font-weight: 600;
                padding-right: 30px;
            }

            .card-body p {
                color: #666;
                font-size: 0.9em;
                margin: 4px 0;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 0.85em;
                color: #666;
                border-top: 1px solid #eee;
                padding-top: 10px;
                margin-top: 10px;
            }

            .client-info {
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .deadline {
                padding: 3px 8px;
                border-radius: 12px;
                font-weight: 500;
                font-size: 0.85em;
            }

            .deadline.overdue {
                background: #ffebee;
                color: #c62828;
            }

            .deadline.today {
                background: #fff3e0;
                color: #ef6c00;
            }

            .deadline.soon {
                background: #fff3e0;
                color: #ef6c00;
            }

            .card-edit-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                color: #1a237e;
                cursor: pointer;
                padding: 5px 8px;
                border-radius: 4px;
                transition: background-color 0.2s;
            }

            .card-edit-btn:hover {
                background: #e8eaf6;
            }

            .empty-column {
                color: #999;
                text-align: center;
                padding: 20px;
                font-style: italic;
            }

            /* Estilos do calendário */
            .calendar-header {
                margin-bottom: 20px;
            }

            .calendar-header h3 {
                color: #1a237e;
                text-transform: capitalize;
            }

            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                gap: 10px;
            }

            .weekday {
                font-weight: 600;
                text-align: center;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 5px;
                color: #333;
            }

            .calendar-day {
                border: 1px solid #e0e0e0;
                border-radius: 8px;
                padding: 10px;
                min-height: 120px;
                background: white;
            }

            .calendar-day.empty {
                background: #f5f5f5;
                border: 1px dashed #ccc;
            }

            .calendar-day.today {
                background: #e8eaf6;
                border: 2px solid #1a237e;
            }

            .day-number {
                font-weight: bold;
                color: #1a237e;
                margin-bottom: 8px;
            }

            .day-events {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .calendar-event {
                background: #f0f0f0;
                padding: 5px;
                border-radius: 4px;
                font-size: 0.85em;
                cursor: pointer;
                transition: background-color 0.2s;
                border-left: 3px solid #1a237e;
            }

            .calendar-event:hover {
                background: #e0e0e0;
            }

            .event-title {
                font-weight: 500;
                color: #333;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .event-status {
                font-size: 0.8em;
                color: #666;
            }

            .no-events {
                color: #999;
                font-size: 0.85em;
                text-align: center;
                padding: 5px;
            }

            @media (max-width: 768px) {
                .kanban-board {
                    flex-direction: column;
                }
                
                .kanban-column {
                    min-width: 100%;
                }

                .calendar-grid {
                    grid-template-columns: repeat(1, 1fr);
                }

                .weekday {
                    display: none;
                }
            }
        </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
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