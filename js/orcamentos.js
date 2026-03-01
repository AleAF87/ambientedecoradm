// js/orcamentos.js - Listagem de Orçamentos
import { database } from './firebase-config.js';
import { ref, onValue, query, limitToLast, orderByKey } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { checkAuth } from './auth-check.js';

// Variáveis globais
let todosOrcamentos = [];
let orcamentosFiltrados = [];
let paginaAtual = 1;
const ITENS_POR_PAGINA = 10;

// Status com cores e ícones
const STATUS_CONFIG = {
    'fazer_visita': { icon: '🚪', label: 'Fazer Visita', color: '#6c757d' },
    'fazer_orcamento': { icon: '📝', label: 'Fazer Orçamento', color: '#0d6efd' },
    'medicao_fina': { icon: '📏', label: 'Medição Fina', color: '#ffc107' },
    'producao': { icon: '🔨', label: 'Produção', color: '#fd7e14' },
    'montagem': { icon: '🔧', label: 'Montagem', color: '#20c997' },
    'concluido': { icon: '✅', label: 'Concluído', color: '#198754' },
    'geladeira': { icon: '❄️', label: 'Geladeira', color: '#0dcaf0' },
    'cancelado': { icon: '🚫', label: 'Cancelado', color: '#dc3545' }
};

// Inicialização
document.addEventListener('DOMContentLoaded', async function() {
    await checkAuth(3);
    carregarOrcamentos();
    configurarFiltros();
});

// Carregar orçamentos do Firebase (do nó statusOrc para economizar)
function carregarOrcamentos() {
    const statusRef = ref(database, 'statusOrc');
    
    onValue(statusRef, (snapshot) => {
        if (snapshot.exists()) {
            const dados = snapshot.val();
            todosOrcamentos = Object.keys(dados).map(key => ({
                id: key,
                ...dados[key]
            })).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
            
            orcamentosFiltrados = [...todosOrcamentos];
            atualizarTabela();
            atualizarPaginacao();
        } else {
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
        }
    });
}

// Configurar filtros
function configurarFiltros() {
    document.getElementById('searchInput').addEventListener('input', aplicarFiltros);
    document.getElementById('statusFilter').addEventListener('change', aplicarFiltros);
    document.getElementById('saldoFilter').addEventListener('change', aplicarFiltros);
}

// Aplicar filtros
function aplicarFiltros() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    const saldoFilter = document.getElementById('saldoFilter').value;
    
    orcamentosFiltrados = todosOrcamentos.filter(orc => {
        // Filtro de busca
        const matchesSearch = searchTerm === '' || 
            orc.clienteEmpresa?.toLowerCase().includes(searchTerm) ||
            orc.descricao?.toLowerCase().includes(searchTerm);
        
        // Filtro de status
        const matchesStatus = statusFilter === '' || orc.status === statusFilter;
        
        // Filtro de saldo
        let matchesSaldo = true;
        if (saldoFilter === 'pendente') {
            matchesSaldo = orc.saldo > 0;
        } else if (saldoFilter === 'quitado') {
            matchesSaldo = orc.saldo <= 0;
        }
        
        return matchesSearch && matchesStatus && matchesSaldo;
    });
    
    paginaAtual = 1;
    atualizarTabela();
    atualizarPaginacao();
}

// Limpar filtros
window.limparFiltros = function() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('saldoFilter').value = '';
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
        const status = STATUS_CONFIG[orc.status] || { icon: '📋', label: orc.status, color: '#6c757d' };
        const saldoClass = orc.saldo > 0 ? 'text-warning' : 'text-success';
        
        return `
            <tr>
                <td><small class="text-muted">${orc.id}</small></td>
                <td><strong>${orc.clienteEmpresa || '---'}</strong></td>
                <td>${orc.descricao?.substring(0, 50)}${orc.descricao?.length > 50 ? '...' : ''}</td>
                <td>
                    <span class="badge" style="background-color: ${status.color}">
                        ${status.icon} ${status.label}
                    </span>
                </td>
                <td>R$ ${formatarMoeda(orc.valorBruto || 0)}</td>
                <td class="${saldoClass} fw-bold">R$ ${formatarMoeda(orc.saldo || 0)}</td>
                <td>${formatarData(orc.dataContato)}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editarOrcamento('${orc.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-info" onclick="verOrcamento('${orc.id}')">
                        <i class="fas fa-eye"></i>
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
    
    if (totalPaginas <= 1) {
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