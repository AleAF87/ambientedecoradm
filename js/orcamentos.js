// js/orcamentos.js - Listagem de Orçamentos
import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { checkAuth } from './auth-check.js';

// Variáveis globais
let todosOrcamentos = [];
let orcamentosFiltrados = [];
let paginaAtual = 1;
const ITENS_POR_PAGINA = 10;
let firebaseUnsubscribe = null;

const STATUS_CONCLUIDO = 'concluido';
const STATUS_CANCELADOS_CONGELADOS = new Set(['cancelado', 'geladeira']);

// Status com cores e ícones
const STATUS_CONFIG = {
    'fazer_visita': { icon: '🚪', label: 'Fazer Visita', color: '#6c757d' },
    'fazer_orcamento': { icon: '📝', label: 'Fazer Orçamento', color: '#0d6efd' },
    'medicao_fina': { icon: '📏', label: 'Medição Fina', color: '#ffc107' },
    'producao': { icon: '🔨', label: 'Produção', color: '#fd7e14' },
    'montagem': { icon: '🔧', label: 'Montagem', color: '#20c997' },
    'aguardando': { icon: '⏳', label: 'Aguardando', color: '#6610f2' },
    'concluido': { icon: '✅', label: 'Concluído', color: '#198754' },
    'geladeira': { icon: '❄️', label: 'Geladeira', color: '#0dcaf0' },
    'cancelado': { icon: '🚫', label: 'Cancelado', color: '#dc3545' }
};

// Inicialização (compatível com página direta e SPA)
export async function init() {
    try {
        await checkAuth(3);
        carregarOrcamentos();
        configurarFiltros();
    } catch (error) {
        mostrarErroCarregamento('Não foi possível validar sua sessão. Faça login novamente.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Carregar orçamentos do Firebase
function carregarOrcamentos() {
    if (typeof firebaseUnsubscribe === 'function') {
        firebaseUnsubscribe();
        firebaseUnsubscribe = null;
    }

    const carregarDeNo = (noPrincipal, noFallback = null) => {
        firebaseUnsubscribe = onValue(ref(database, noPrincipal), (snapshot) => {
            if (!snapshot.exists() && noFallback) {
                carregarDeNo(noFallback, null);
                return;
            }

            if (snapshot.exists()) {
                const dados = snapshot.val();
                todosOrcamentos = Object.keys(dados).map(key => ({
                    id: key,
                    ...dados[key]
                }));

                ordenarOrcamentosPorDataContrato(todosOrcamentos);

                orcamentosFiltrados = [...todosOrcamentos];
                atualizarTabela();
                atualizarPaginacao();
                return;
            }

            todosOrcamentos = [];
            orcamentosFiltrados = [];
            document.getElementById('orcamentosTableBody').innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <i class="fas fa-folder-open fa-3x text-muted mb-3"></i>
                        <p>Nenhum orçamento encontrado</p>
                        <a href="orcamentos-edit.html" class="btn btn-primary">
                            Criar Primeiro Orçamento
                        </a>
                    </td>
                </tr>
            `;
        atualizarPaginacao();
        }, (error) => {
            console.error('❌ Erro ao carregar orçamentos:', error);
            mostrarErroCarregamento('Erro ao carregar orçamentos do Firebase. Verifique as permissões e tente novamente.');
        });
    };

    carregarDeNo('orcamentos', 'orcamento');
}

function mostrarErroCarregamento(mensagem) {
    document.getElementById('orcamentosTableBody').innerHTML = `
        <tr>
            <td colspan="8" class="text-center py-4 text-danger">
                <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                <p class="mb-0">${mensagem}</p>
            </td>
        </tr>
    `;
}

// Configurar filtros
function configurarFiltros() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const saldoFilter = document.getElementById('saldoFilter');
    const showConcluidos = document.getElementById('showConcluidos');
    const showCanceladosCongelados = document.getElementById('showCanceladosCongelados');

    if (!searchInput || !statusFilter || !saldoFilter || !showConcluidos || !showCanceladosCongelados) return;

    searchInput.oninput = aplicarFiltros;
    statusFilter.onchange = aplicarFiltros;
    saldoFilter.onchange = aplicarFiltros;
    showConcluidos.onchange = aplicarFiltros;
    showCanceladosCongelados.onchange = aplicarFiltros;

    aplicarFiltros();
}

// Aplicar filtros
function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const saldoFilter = document.getElementById('saldoFilter').value;
    const exibirConcluidos = document.getElementById('showConcluidos').checked;
    const exibirCanceladosCongelados = document.getElementById('showCanceladosCongelados').checked;
    
    orcamentosFiltrados = todosOrcamentos.filter(orc => {
        const clienteEmpresa = (orc.clienteEmpresa || orc.projeto?.clienteEmpresa || '').toLowerCase();
        const descricao = (orc.descricao || orc.projeto?.descricao || '').toLowerCase();
        const status = orc.status || orc.projeto?.status || '';
        const saldo = Number(orc.saldo ?? orc.financeiro?.saldo ?? 0);

        // Filtro de busca
        const matchesSearch = searchTerm === '' || 
            clienteEmpresa.includes(searchTerm) ||
            descricao.includes(searchTerm);
        
        // Filtro de status
        const matchesStatus = statusFilter === '' || status === statusFilter;
        
        const statusOculto =
            (!exibirConcluidos && status === STATUS_CONCLUIDO) ||
            (!exibirCanceladosCongelados && STATUS_CANCELADOS_CONGELADOS.has(status));

        // Filtro de saldo
        let matchesSaldo = true;
        if (saldoFilter === 'pendente') {
            matchesSaldo = saldo > 0;
        } else if (saldoFilter === 'quitado') {
            matchesSaldo = saldo <= 0;
        }
        
        return matchesSearch && matchesStatus && matchesSaldo && !statusOculto;
    });
    
    ordenarOrcamentosPorDataContrato(orcamentosFiltrados);

    paginaAtual = 1;
    atualizarTabela();
    atualizarPaginacao();
}

// Limpar filtros
window.limparFiltros = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('saldoFilter').value = '';
    document.getElementById('showConcluidos').checked = false;
    document.getElementById('showCanceladosCongelados').checked = false;
    aplicarFiltros();
};

// Atualizar tabela
function atualizarTabela() {
    const tbody = document.getElementById('orcamentosTableBody');
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    const fim = inicio + ITENS_POR_PAGINA;
    const orcamentosPagina = orcamentosFiltrados.slice(inicio, fim);
    
    if (orcamentosPagina.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <i class="fas fa-search fa-3x text-muted mb-3"></i>
                    <p>Nenhum orçamento encontrado com os filtros</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = orcamentosPagina.map(orc => {
        const statusAtual = orc.status || orc.projeto?.status || '';
        const status = STATUS_CONFIG[statusAtual] || { icon: '📋', label: statusAtual || 'Sem status', color: '#6c757d' };
        const saldoAtual = Number(orc.financeiro?.saldo ?? orc.saldo ?? 0);
        const valorBruto = Number(orc.valorBruto ?? orc.financeiro?.valorBruto ?? 0);
        const clienteEmpresa = orc.clienteEmpresa || orc.projeto?.clienteEmpresa || '---';
        const descricao = orc.projeto?.descricao || orc.descricao || '---';
        const dataContato = orc.dataContato || orc.datas?.dataContato;
        const saldoClass = saldoAtual > 0 ? 'text-warning' : 'text-success';
        
        return `
            <tr>
                <td><small class="text-muted">${orc.id}</small></td>
                <td><strong>${clienteEmpresa}</strong></td>
                <td><span title="${descricao.replace(/"/g, '&quot;')}">${descricao.substring(0, 30)}${descricao.length > 30 ? '...' : ''}</span></td>
                <td>
                    <span class="badge" style="background-color: ${status.color}">
                        ${status.icon} ${status.label}
                    </span>
                </td>
                <td>R$ ${formatarMoeda(valorBruto)}</td>
                <td class="${saldoClass} fw-bold">R$ ${formatarMoeda(saldoAtual)}</td>
                <td>${formatarData(dataContato)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="editarOrcamento('${orc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    document.getElementById('paginacaoInfo').textContent = 
        `Mostrando ${inicio + 1}-${Math.min(fim, orcamentosFiltrados.length)} de ${orcamentosFiltrados.length} orçamentos`;
}

// Atualizar paginação
function atualizarPaginacao() {
    const totalPaginas = Math.ceil(orcamentosFiltrados.length / ITENS_POR_PAGINA);
    const paginacao = document.getElementById('paginacao');
    
    if (orcamentosFiltrados.length < ITENS_POR_PAGINA) {
        paginacao.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Botão anterior
    html += `
        <li class="page-item ${paginaAtual === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="mudarPagina(${paginaAtual - 1}); return false;">Anterior</a>
        </li>
    `;
    
    // Páginas
    for (let i = 1; i <= totalPaginas; i++) {
        if (i === 1 || i === totalPaginas || (i >= paginaAtual - 2 && i <= paginaAtual + 2)) {
            html += `
                <li class="page-item ${i === paginaAtual ? 'active' : ''}">
                    <a class="page-link" href="#" onclick="mudarPagina(${i}); return false;">${i}</a>
                </li>
            `;
        } else if (i === paginaAtual - 3 || i === paginaAtual + 3) {
            html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    // Botão próximo
    html += `
        <li class="page-item ${paginaAtual === totalPaginas ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="mudarPagina(${paginaAtual + 1}); return false;">Próximo</a>
        </li>
    `;
    
    paginacao.innerHTML = html;
}

// Mudar página
window.mudarPagina = function(novaPagina) {
    paginaAtual = novaPagina;
    atualizarTabela();
    atualizarPaginacao();
};

// Editar orçamento (no SPA)
window.editarOrcamento = function(id) {
    if (window.app && window.app.loadPage) {
        window.app.loadPage(`orcamentos-edit.html?id=${id}`);
    } else {
        window.location.href = `orcamentos-edit.html?id=${id}`;
    }
};

// Ver orçamento (apenas visualização)
window.verOrcamento = function(id) {
    // Implementar modal de visualização ou redirecionar
    console.log('Ver orçamento:', id);
};

// Utilitários
function formatarMoeda(valor) {
    return valor.toFixed(2).replace('.', ',');
}

function formatarData(data) {
    if (!data) return '---';
    const partes = data.split('-');
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
}

function ordenarOrcamentosPorDataContrato(orcamentos) {
    orcamentos.sort((a, b) => {
        const dataA = obterTimestampDataContrato(a);
        const dataB = obterTimestampDataContrato(b);

        if (dataA !== dataB) {
            return dataB - dataA;
        }

        return String(b.id || '').localeCompare(String(a.id || ''));
    });
}

function obterTimestampDataContrato(orcamento) {
    const dataContrato = orcamento.dataContrato || orcamento.datas?.dataContrato || orcamento.dataContato || orcamento.datas?.dataContato;

    if (!dataContrato) {
        return Number.MIN_SAFE_INTEGER;
    }

    const [ano, mes, dia] = String(dataContrato).split('-').map(Number);
    const dataValida = Number.isInteger(ano) && Number.isInteger(mes) && Number.isInteger(dia);

    if (!dataValida) {
        return Number.MIN_SAFE_INTEGER;
    }

    return new Date(ano, mes - 1, dia).getTime();
}