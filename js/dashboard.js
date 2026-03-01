// js/dashboard.js - Dashboard Kanban para Ambiente Decor Adm
import { checkAuth, getCurrentUser } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// Variáveis globais
let ordensServico = [];
let currentUser = null;
let currentUserCPF = null;
let bootstrapModal = null;

// Inicialização do dashboard
export async function initDashboard() {
    try {
        console.log('🚀 Iniciando Dashboard Kanban...');
        
        // Verificar autenticação
        const result = await checkAuth(3);
        currentUser = result.userData;
        currentUserCPF = result.cpf;
        
        // Atualizar session storage
        sessionStorage.setItem('userCPF', currentUserCPF);
        sessionStorage.setItem('userName', currentUser.nome);
        sessionStorage.setItem('userNivel', currentUser.nivel || 3);
        
        // Atualizar saudação na navbar
        if (window.updateUserGreetingInSPA) {
            window.updateUserGreetingInSPA();
        }
        
        // Carregar dados do Firebase
        await carregarOrdensServico();
        
        // Configurar listeners
        configurarListeners();
        
        // Inicializar modals do Bootstrap
        if (typeof bootstrap !== 'undefined') {
            bootstrapModal = {
                novaOS: new bootstrap.Modal(document.getElementById('modalNovaOS')),
                detalhes: new bootstrap.Modal(document.getElementById('modalDetalhesOS'))
            };
        }
        
        console.log('✅ Dashboard Kanban inicializado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro no dashboard:', error);
        mostrarErro(error);
    }
}

// Carregar ordens de serviço do Firebase
function carregarOrdensServico() {
    const ordensRef = ref(database, 'ordensServico');
    
    onValue(
        ordensRef,
        (snapshot) => {
            if (snapshot.exists()) {
                const dados = snapshot.val();
                ordensServico = Object.keys(dados).map(key => ({
                    id: key,
                    ...dados[key]
                }));
            } else {
                // Dados iniciais para teste
                ordensServico = gerarDadosIniciais();
                salvarDadosIniciais();
            }
            
            renderizarKanban();
            atualizarEstatisticas();
        },
        (error) => {
            console.error('❌ Erro ao carregar ordens de serviço do Firebase:', error);
            ordensServico = [];
            renderizarErroCarregamento(error);
        }
    );
}

function renderizarErroCarregamento(error) {
    const contentDiv = document.getElementById('dashboard-content');
    if (!contentDiv) return;

    contentDiv.innerHTML = `
        <div class="alert alert-danger mb-0" role="alert">
            <h5 class="alert-heading mb-2">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Não foi possível carregar os dados do Firebase
            </h5>
            <p class="mb-2">${error?.message || 'Erro desconhecido ao buscar dados.'}</p>
            <hr>
            <button class="btn btn-outline-danger btn-sm" onclick="window.location.reload()">
                <i class="fas fa-redo me-1"></i>Tentar novamente
            </button>
        </div>
    `;  
}

// Gerar dados iniciais para teste
function gerarDadosIniciais() {
    const hoje = new Date();
    const semana = new Date(hoje);
    semana.setDate(hoje.getDate() + 7);
    
    return [
        {
            id: 'os1',
            numero: 'OS-001',
            titulo: 'Restauração de Mesa de Jantar',
            cliente: 'Carlos Alberto',
            equipamento: 'Mesa de Madeira Maciça',
            prioridade: 'alta',
            dataAbertura: hoje.toISOString().split('T')[0],
            prazo: semana.toISOString().split('T')[0],
            stage: 'novo',
            descricao: 'Restauração completa com verniz novo',
            responsavel: currentUserCPF
        },
        {
            id: 'os2',
            numero: 'OS-002',
            titulo: 'Reparo em Cadeiras',
            cliente: 'Maria Silva',
            equipamento: '4 Cadeiras Estofadas',
            prioridade: 'media',
            dataAbertura: hoje.toISOString().split('T')[0],
            prazo: semana.toISOString().split('T')[0],
            stage: 'andamento',
            descricao: 'Troca de estofado e reparo nas pernas',
            responsavel: currentUserCPF
        },
        {
            id: 'os3',
            numero: 'OS-003',
            titulo: 'Montagem de Armário',
            cliente: 'João Pedro',
            equipamento: 'Armário Planejado',
            prioridade: 'baixa',
            dataAbertura: hoje.toISOString().split('T')[0],
            prazo: semana.toISOString().split('T')[0],
            stage: 'revisao',
            descricao: 'Montagem e ajustes finais',
            responsavel: currentUserCPF
        },
        {
            id: 'os4',
            numero: 'OS-004',
            titulo: 'Envernizamento de Porta',
            cliente: 'Ana Beatriz',
            equipamento: 'Porta de Madeira',
            prioridade: 'media',
            dataAbertura: hoje.toISOString().split('T')[0],
            prazo: semana.toISOString().split('T')[0],
            stage: 'concluido',
            descricao: 'Aplicação de verniz marítimo',
            responsavel: currentUserCPF
        }
    ];
}

// Salvar dados iniciais no Firebase
function salvarDadosIniciais() {
    const updates = {};
    ordensServico.forEach(os => {
        updates[`ordensServico/${os.id}`] = os;
    });
    update(ref(database), updates);
}

// Configurar listeners de drag and drop
function configurarListeners() {
    document.querySelectorAll('.cards-container').forEach(container => {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            container.classList.add('bg-light');
        });
        
        container.addEventListener('dragleave', () => {
            container.classList.remove('bg-light');
        });
        
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            container.classList.remove('bg-light');
            
            const osId = e.dataTransfer.getData('text/plain');
            const novaColuna = container.closest('.kanban-column').dataset.stage;
            
            atualizarStageOS(osId, novaColuna);
        });
    });
}

// Atualizar estágio da OS
async function atualizarStageOS(osId, novoStage) {
    try {
        const osRef = ref(database, `ordensServico/${osId}`);
        await update(osRef, { 
            stage: novoStage,
            ultimaAtualizacao: new Date().toISOString()
        });
        
        console.log(`✅ OS ${osId} movida para ${novoStage}`);
    } catch (error) {
        console.error('❌ Erro ao atualizar stage:', error);
        alert('Erro ao mover ordem de serviço. Tente novamente.');
    }
}

// Renderizar Kanban
function renderizarKanban() {
    const contentDiv = document.getElementById('dashboard-content');
    if (!contentDiv) return;
    
    // Estatísticas
    const stats = calcularEstatisticas();
    
    // Agrupar OS por stage
    const osPorStage = {
        novo: ordensServico.filter(os => os.stage === 'novo'),
        andamento: ordensServico.filter(os => os.stage === 'andamento'),
        revisao: ordensServico.filter(os => os.stage === 'revisao'),
        concluido: ordensServico.filter(os => os.stage === 'concluido')
    };
    
    const html = `
        <!-- Cards de Estatísticas -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card bg-primary text-white">
                    <div class="card-body">
                        <h6 class="card-title">Total de OS</h6>
                        <h2 class="mb-0">${stats.total}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning text-white">
                    <div class="card-body">
                        <h6 class="card-title">Em Andamento</h6>
                        <h2 class="mb-0">${stats.andamento}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success text-white">
                    <div class="card-body">
                        <h6 class="card-title">Concluídas</h6>
                        <h2 class="mb-0">${stats.concluido}</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card bg-danger text-white">
                    <div class="card-body">
                        <h6 class="card-title">Atrasadas</h6>
                        <h2 class="mb-0">${stats.atrasadas}</h2>
                    </div>
                </div>
            </div>
        </div>

        <!-- Kanban Board -->
        <div class="kanban-board" style="display: flex; gap: 20px; overflow-x: auto; padding: 10px 0;">
            ${renderizarColuna('📋', 'Novo', 'novo', osPorStage.novo, '#0d6efd')}
            ${renderizarColuna('⚙️', 'Em Andamento', 'andamento', osPorStage.andamento, '#ffc107')}
            ${renderizarColuna('🔍', 'Em Revisão', 'revisao', osPorStage.revisao, '#6f42c1')}
            ${renderizarColuna('✅', 'Concluído', 'concluido', osPorStage.concluido, '#198754')}
        </div>
    `;
    
    contentDiv.innerHTML = html;
    
    // Reconfigurar listeners
    configurarListeners();
}

// Renderizar uma coluna do Kanban
function renderizarColuna(emoji, titulo, stage, ordens, cor) {
    return `
        <div class="kanban-column" data-stage="${stage}" style="min-width: 300px; background: #f8f9fa; border-radius: 10px; padding: 15px;">
            <div class="column-header" style="border-bottom: 3px solid ${cor}; padding-bottom: 10px; margin-bottom: 15px;">
                <h5 class="mb-0">
                    ${emoji} ${titulo}
                    <span class="badge bg-secondary ms-2">${ordens.length}</span>
                </h5>
            </div>
            <div class="cards-container" style="min-height: 400px; transition: background-color 0.2s;">
                ${ordens.map(os => renderizarCard(os)).join('')}
            </div>
        </div>
    `;
}

// Renderizar um card de OS
function renderizarCard(os) {
    const hoje = new Date();
    const prazo = new Date(os.prazo);
    const diasRestantes = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    
    const corPrioridade = {
        alta: '#dc3545',
        media: '#ffc107',
        baixa: '#198754'
    };
    
    const statusPrazo = diasRestantes < 0 ? 'atrasado' : 
                       diasRestantes <= 2 ? 'urgente' : 'normal';
    
    return `
        <div class="card mb-2" draggable="true" data-id="${os.id}" data-stage="${os.stage}"
             ondragstart="window.dragStart(event)" 
             ondragend="window.dragEnd(event)"
             ondblclick="window.verDetalhesOS('${os.id}')"
             style="cursor: move; border-left: 4px solid ${corPrioridade[os.prioridade]};">
            
            <div class="card-body p-2">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <span class="badge bg-secondary">${os.numero}</span>
                    <span class="badge" style="background-color: ${corPrioridade[os.prioridade]}">
                        ${os.prioridade.toUpperCase()}
                    </span>
                </div>
                
                <h6 class="mb-1">${os.titulo}</h6>
                
                <div class="small text-muted mb-1">
                    <i class="fas fa-user me-1"></i>${os.cliente}
                </div>
                
                <div class="small text-muted mb-1">
                    <i class="fas fa-tools me-1"></i>${os.equipamento}
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <small class="text-muted">
                        <i class="fas fa-calendar me-1"></i>
                        ${new Date(os.dataAbertura).toLocaleDateString()}
                    </small>
                    
                    <span class="badge ${statusPrazo === 'atrasado' ? 'bg-danger' : 
                                      statusPrazo === 'urgente' ? 'bg-warning text-dark' : 'bg-info'}">
                        <i class="fas fa-clock me-1"></i>
                        ${diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atrasado` : 
                          diasRestantes === 0 ? 'Hoje' : 
                          diasRestantes === 1 ? 'Amanhã' : `${diasRestantes} dias`}
                    </span>
                </div>
            </div>
        </div>
    `;
}

// Calcular estatísticas
function calcularEstatisticas() {
    const hoje = new Date();
    
    return {
        total: ordensServico.length,
        novo: ordensServico.filter(os => os.stage === 'novo').length,
        andamento: ordensServico.filter(os => os.stage === 'andamento').length,
        revisao: ordensServico.filter(os => os.stage === 'revisao').length,
        concluido: ordensServico.filter(os => os.stage === 'concluido').length,
        atrasadas: ordensServico.filter(os => {
            if (os.stage === 'concluido') return false;
            const prazo = new Date(os.prazo);
            return prazo < hoje;
        }).length
    };
}

// Funções de drag and drop (globais)
window.dragStart = function(event) {
    const card = event.target.closest('.card');
    if (card) {
        card.classList.add('opacity-50');
        event.dataTransfer.setData('text/plain', card.dataset.id);
    }
};

window.dragEnd = function(event) {
    const card = event.target.closest('.card');
    if (card) {
        card.classList.remove('opacity-50');
    }
    
    document.querySelectorAll('.cards-container').forEach(container => {
        container.classList.remove('bg-light');
    });
};

// Abrir modal para nova OS
window.adicionarNovaOS = function() {
    // Limpar formulário
    document.getElementById('formNovaOS').reset();
    
    // Definir prazo padrão (7 dias)
    const hoje = new Date();
    const prazo = new Date(hoje);
    prazo.setDate(hoje.getDate() + 7);
    document.getElementById('osPrazo').value = prazo.toISOString().split('T')[0];
    
    // Abrir modal
    if (bootstrapModal?.novaOS) {
        bootstrapModal.novaOS.show();
    }
};

// Salvar nova OS
window.salvarNovaOS = async function() {
    // Validar campos obrigatórios
    const titulo = document.getElementById('osTitulo').value;
    const cliente = document.getElementById('osCliente').value;
    const equipamento = document.getElementById('osEquipamento').value;
    const prazo = document.getElementById('osPrazo').value;
    
    if (!titulo || !cliente || !equipamento || !prazo) {
        alert('Preencha todos os campos obrigatórios!');
        return;
    }
    
    try {
        // Gerar número da OS
        const proximoNumero = String(ordensServico.length + 1).padStart(3, '0');
        
        // Criar nova OS
        const novaOS = {
            numero: `OS-${proximoNumero}`,
            titulo: titulo,
            cliente: cliente,
            equipamento: equipamento,
            prioridade: document.getElementById('osPrioridade').value,
            dataAbertura: new Date().toISOString().split('T')[0],
            prazo: prazo,
            descricao: document.getElementById('osDescricao').value,
            stage: 'novo',
            responsavel: currentUserCPF,
            criadoPor: currentUser.nome,
            criadoEm: new Date().toISOString()
        };
        
        // Salvar no Firebase
        const novaOSRef = push(ref(database, 'ordensServico'));
        await set(novaOSRef, novaOS);
        
        // Fechar modal
        if (bootstrapModal?.novaOS) {
            bootstrapModal.novaOS.hide();
        }
        
        // Mostrar mensagem de sucesso
        alert('✅ Ordem de serviço criada com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao criar OS:', error);
        alert('Erro ao criar ordem de serviço. Tente novamente.');
    }
};

// Ver detalhes da OS
window.verDetalhesOS = async function(osId) {
    const os = ordensServico.find(o => o.id === osId);
    if (!os) return;
    
    const hoje = new Date();
    const prazo = new Date(os.prazo);
    const diasRestantes = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    
    const statusPrazo = diasRestantes < 0 ? 'Atrasado' : 
                       diasRestantes === 0 ? 'Vence hoje' : 
                       `${diasRestantes} dia(s) restante(s)`;
    
    const statusClass = diasRestantes < 0 ? 'danger' : 
                       diasRestantes <= 2 ? 'warning' : 'success';
    
    const content = document.getElementById('detalhesOSContent');
    if (content) {
        content.innerHTML = `
            <div class="container-fluid">
                <div class="row mb-3">
                    <div class="col-12">
                        <h5 class="border-bottom pb-2">${os.titulo}</h5>
                        <span class="badge bg-secondary">${os.numero}</span>
                        <span class="badge ms-2" style="background-color: ${os.prioridade === 'alta' ? '#dc3545' : os.prioridade === 'media' ? '#ffc107' : '#198754'}">
                            Prioridade ${os.prioridade.toUpperCase()}
                        </span>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <strong><i class="fas fa-user me-2"></i>Cliente:</strong>
                        <p>${os.cliente}</p>
                    </div>
                    <div class="col-md-6">
                        <strong><i class="fas fa-tools me-2"></i>Equipamento:</strong>
                        <p>${os.equipamento}</p>
                    </div>
                </div>
                
                <div class="row mb-3">
                    <div class="col-md-6">
                        <strong><i class="fas fa-calendar-plus me-2"></i>Abertura:</strong>
                        <p>${new Date(os.dataAbertura).toLocaleDateString()}</p>
                    </div>
                    <div class="col-md-6">
                        <strong><i class="fas fa-clock me-2"></i>Prazo:</strong>
                        <p class="text-${statusClass}">
                            ${new Date(os.prazo).toLocaleDateString()} 
                            (${statusPrazo})
                        </p>
                    </div>
                </div>
                
                ${os.descricao ? `
                <div class="row mb-3">
                    <div class="col-12">
                        <strong><i class="fas fa-align-left me-2"></i>Descrição:</strong>
                        <p class="bg-light p-3 rounded">${os.descricao}</p>
                    </div>
                </div>
                ` : ''}
                
                <div class="row mb-3">
                    <div class="col-12">
                        <strong><i class="fas fa-tag me-2"></i>Estágio Atual:</strong>
                        <span class="badge bg-primary ms-2">
                            ${os.stage === 'novo' ? '📋 Novo' : 
                              os.stage === 'andamento' ? '⚙️ Em Andamento' : 
                              os.stage === 'revisao' ? '🔍 Em Revisão' : '✅ Concluído'}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Abrir modal
    if (bootstrapModal?.detalhes) {
        bootstrapModal.detalhes.show();
    }
};

// Atualizar estatísticas em tempo real
function atualizarEstatisticas() {
    const stats = calcularEstatisticas();
    
    // Atualizar badges nas colunas
    document.querySelectorAll('.kanban-column').forEach(coluna => {
        const stage = coluna.dataset.stage;
        const badge = coluna.querySelector('.badge');
        if (badge) {
            badge.textContent = stats[stage] || 0;
        }
    });
}

// Mostrar erro
function mostrarErro(error) {
    const contentDiv = document.getElementById('dashboard-content');
    if (contentDiv) {
        contentDiv.innerHTML = `
            <div class="alert alert-danger">
                <h5><i class="fas fa-exclamation-triangle me-2"></i>Erro ao carregar dashboard</h5>
                <p>${error.message}</p>
                <button class="btn btn-primary mt-2" onclick="location.reload()">
                    <i class="fas fa-redo me-1"></i>Tentar novamente
                </button>
            </div>
        `;
    }
}

// Exportar funções
export default {
    initDashboard,
    carregarOrdensServico,
    renderizarKanban
};