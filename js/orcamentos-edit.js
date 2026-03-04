// js/orcamentos-edit.js - Criação/Edição de Orçamentos
import { database, auth } from './firebase-config.js';
import { ref, set, update, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { uploadImagemCloudinary, deletarImagemCloudinary } from './cloudinary-config.js';
import { checkAuth } from './auth-check.js';

// Variáveis globais
let orcamentoId = null;
let modoEdicao = false;
let userData = null;
let userCPF = null;
let anexosPendentesUpload = {};

const modeloDadosOrcamento = {
    projeto: {},
    datas: {},
    financeiro: {
        valorInicial: 0,
        valorBruto: 0,
        totalCustos: 0,
        totalPagamentos: 0,
        valorLiquido: 0,
        saldo: 0,
        alteracoesValor: {},
        custos: {},
        pagamentos: {}
    },
    anexos: {},
    historicoAlteracoes: {},
    status: 'producao',
    observacoes: ''
};

// Dados do orçamento em memória
let dadosOrcamento = structuredClone(modeloDadosOrcamento);

// Função de inicialização (chamada pelo SPA)
export async function init(editId = null) {
    console.log('🚀 Inicializando orcamentos-edit...', editId);
    dadosOrcamento = structuredClone(modeloDadosOrcamento);
    anexosPendentesUpload = {};

    // Verificar autenticação
    const authResult = await checkAuth(3);
    userData = authResult.userData;
    userCPF = authResult.cpf;
    
    orcamentoId = editId;
    
    if (orcamentoId) {
        modoEdicao = true;
        document.getElementById('formTitulo').textContent = 'Editar Orçamento';
        await carregarOrcamento(orcamentoId);
    } else {
        document.getElementById('formTitulo').textContent = 'Novo Orçamento';
        document.getElementById('dataContato').value = new Date().toISOString().split('T')[0];
    }
    
    // Configurar eventos
    document.getElementById('orcamentoForm').onsubmit = salvarOrcamento;
    document.getElementById('valorInicial').oninput = atualizarResumoFinanceiro;
    
    // Configurar máscara CPF/CNPJ
    document.getElementById('cpfCnpj').onblur = function() {
        const valor = this.value;
        const valorLimpo = valor.replace(/\D/g, '');
        
        if (valorLimpo.length > 0) {
            if (valorLimpo.length === 11 || valorLimpo.length === 14) {
                this.value = aplicarMascaraCPFCNPJ(valorLimpo);
                this.classList.remove('is-invalid');
                this.classList.add('is-valid');
            } else {
                this.classList.remove('is-valid');
                this.classList.add('is-invalid');
            }
        } else {
            this.classList.remove('is-valid', 'is-invalid');
        }
    };
    
    document.getElementById('cpfCnpj').oninput = function() {
        this.value = this.value.replace(/\D/g, '');
    };
    
    atualizarResumoFinanceiro();
}

// Máscara para CPF/CNPJ
function aplicarMascaraCPFCNPJ(valor) {
    valor = valor.replace(/\D/g, '');
    
    if (valor.length <= 11) {
        // CPF: 000.000.000-00
        return valor.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
        // CNPJ: 00.000.000/0000-00
        return valor.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
}

// Função auxiliar para abrir modal
function abrirModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        // Garantir que não haja modais presos
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } else {
        console.error('Modal não encontrado:', modalId);
    }
}

// Função auxiliar para fechar modal
function fecharModal(modalId) {
    const modalElement = document.getElementById(modalId);
    if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
    }
}

// Carregar orçamento para edição
async function carregarOrcamento(id) {
    try {
        // Tentar primeiro com "orcamentos" (com s)
        let orcamentoRef = ref(database, `orcamentos/${id}`);
        let snapshot = await get(orcamentoRef);
        
        // Se não encontrar, tentar sem s
        if (!snapshot.exists()) {
            orcamentoRef = ref(database, `orcamento/${id}`);
            snapshot = await get(orcamentoRef);
        }
        
        if (!snapshot.exists()) {
            alert('Orçamento não encontrado');
            cancelarEdicao();
            return;
        }
        
        dadosOrcamento = snapshot.val();
        
        // Preencher formulário
        document.getElementById('clienteEmpresa').value = dadosOrcamento.projeto?.clienteEmpresa || '';
        document.getElementById('cpfCnpj').value = dadosOrcamento.projeto?.cpfCnpj || '';
        document.getElementById('descricao').value = dadosOrcamento.projeto?.descricao || '';
        
        document.getElementById('dataContato').value = dadosOrcamento.datas?.dataContato || '';
        document.getElementById('dataVisita').value = dadosOrcamento.datas?.dataVisita || '';
        document.getElementById('dataEnvioOrcamento').value = dadosOrcamento.datas?.dataEnvioOrcamento || '';
        document.getElementById('dataInicioProducao').value = dadosOrcamento.datas?.dataInicioProducao || '';
        document.getElementById('dataProducaoConcluida').value = dadosOrcamento.datas?.dataProducaoConcluida || '';
        document.getElementById('dataInicioMontagem').value = dadosOrcamento.datas?.dataInicioMontagem || '';
        document.getElementById('dataMontagemConcluida').value = dadosOrcamento.datas?.dataMontagemConcluida || '';
        
        document.getElementById('valorInicial').value = dadosOrcamento.financeiro?.valorInicial || 0;
        
        document.getElementById('status').value = dadosOrcamento.status || 'producao';
        document.getElementById('observacoes').value = dadosOrcamento.observacoes || '';
        
        // Atualizar listas
        atualizarTabelaAlteracoes();
        atualizarTabelaCustos();
        atualizarTabelaPagamentos();
        atualizarAnexos();
        atualizarResumoFinanceiro();
        
    } catch (error) {
        console.error('Erro ao carregar orçamento:', error);
        alert('Erro ao carregar orçamento');
    }
}

// Gerar ID do orçamento (AAMMDDHHMM)
function gerarIdOrcamento() {
    const agora = new Date();
    const ano = agora.getFullYear().toString().slice(-2);
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const seg = String(agora.getSeconds()).padStart(2, '0');
    return `${ano}${mes}${dia}${hora}${min}${seg}`;
}

// Gerar ID para subitens (prefixo + AAMMDDHHMM)
function gerarSubItemId(prefixo) {
    const agora = new Date();
    const ano = agora.getFullYear().toString().slice(-2);
    const mes = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    const hora = String(agora.getHours()).padStart(2, '0');
    const min = String(agora.getMinutes()).padStart(2, '0');
    const seg = String(agora.getSeconds()).padStart(2, '0');
    return `${prefixo}${ano}${mes}${dia}${hora}${min}${seg}`;
}

// Salvar orçamento
async function salvarOrcamento(e) {
    e.preventDefault();
    
    // Validar campos obrigatórios
    const clienteEmpresa = document.getElementById('clienteEmpresa').value;
    const descricao = document.getElementById('descricao').value;
    const dataContato = document.getElementById('dataContato').value;
    
    if (!clienteEmpresa || !descricao || !dataContato) {
        alert('Preencha todos os campos obrigatórios (*)');
        return;
    }
    
    const btnSalvar = document.getElementById('btnSalvar');
    btnSalvar.disabled = true;
    btnSalvar.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Salvando...';
    
    try {
        await fazerUploadAnexosPendentes();

        const agora = new Date().toISOString();
        const valorInicial = parseFloat(document.getElementById('valorInicial').value) || 0;
        
        // Calcular totais
        const totalAlteracoes = calcularTotalAlteracoes();
        const totalCustos = calcularTotalCustos();
        const totalPagamentos = calcularTotalPagamentos();
        
        const valorBruto = valorInicial + totalAlteracoes;
        const valorLiquido = valorBruto - totalCustos;
        const saldo = valorLiquido - totalPagamentos;
        
        // Preparar dados para salvar
        const dadosParaSalvar = {
            id: modoEdicao ? orcamentoId : gerarIdOrcamento(),
            projeto: {
                clienteEmpresa,
                cpfCnpj: document.getElementById('cpfCnpj').value,
                descricao
            },
            datas: {
                dataContato,
                dataVisita: document.getElementById('dataVisita').value || null,
                dataEnvioOrcamento: document.getElementById('dataEnvioOrcamento').value || null,
                dataInicioProducao: document.getElementById('dataInicioProducao').value || null,
                dataProducaoConcluida: document.getElementById('dataProducaoConcluida').value || null,
                dataInicioMontagem: document.getElementById('dataInicioMontagem').value || null,
                dataMontagemConcluida: document.getElementById('dataMontagemConcluida').value || null
            },
            financeiro: {
                valorInicial,
                valorBruto,
                totalCustos,
                totalPagamentos,
                valorLiquido,
                saldo,
                alteracoesValor: dadosOrcamento.financeiro.alteracoesValor || {},
                custos: dadosOrcamento.financeiro.custos || {},
                pagamentos: dadosOrcamento.financeiro.pagamentos || {}
            },
            anexos: dadosOrcamento.anexos || {},
            historicoAlteracoes: dadosOrcamento.historicoAlteracoes || {},
            status: document.getElementById('status').value,
            observacoes: document.getElementById('observacoes').value,
            criadoPor: userData.nome,
            criadoPorCPF: userCPF,
            alteradoEm: agora
        };
        
        // Se for novo, adicionar criadoEm
        if (!modoEdicao) {
            dadosParaSalvar.criadoEm = agora;
            
            const histId = gerarSubItemId('hist');
            dadosParaSalvar.historicoAlteracoes[histId] = {
                data: agora,
                usuario: userData.nome,
                cpf: userCPF,
                acao: 'criacao',
                descricao: 'Orçamento criado'
            };
        } else {
            const histId = gerarSubItemId('hist');
            dadosParaSalvar.historicoAlteracoes[histId] = {
                data: agora,
                usuario: userData.nome,
                cpf: userCPF,
                acao: 'alteracao',
                descricao: 'Orçamento atualizado'
            };
        }
        
        // Salvar no Firebase (tentar com e sem s)
        try {
            await set(ref(database, `orcamentos/${dadosParaSalvar.id}`), dadosParaSalvar);
        } catch (e) {
            await set(ref(database, `orcamento/${dadosParaSalvar.id}`), dadosParaSalvar);
        }
        
        // Salvar status resumido
        const statusData = {
            id: dadosParaSalvar.id,
            clienteEmpresa,
            descricao: descricao.substring(0, 100),
            valorBruto,
            valorLiquido,
            saldo,
            status: dadosParaSalvar.status,
            dataContato,
            proximoEvento: dadosParaSalvar.datas.dataInicioProducao || dadosParaSalvar.datas.dataVisita || null,
            proximoEventoDescricao: dadosParaSalvar.datas.dataInicioProducao ? 'Início Produção' : 
                                   dadosParaSalvar.datas.dataVisita ? 'Visita' : null,
            temSaldoPendente: saldo > 0,
            ultimaAlteracao: agora,
            criadoEm: dadosParaSalvar.criadoEm || agora
        };
        
        try {
            await set(ref(database, `statusOrc/${dadosParaSalvar.id}`), statusData);
        } catch (e) {
            await set(ref(database, `statusOrcamento/${dadosParaSalvar.id}`), statusData);
        }
        
        alert('Orçamento salvo com sucesso!');
        
        // Redirecionar para listagem
        if (window.app && window.app.loadPage) {
            window.app.loadPage('orcamentos.html');
        } else {
            window.location.href = 'orcamentos.html';
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('Erro ao salvar orçamento. Tente novamente.');
    } finally {
        btnSalvar.disabled = false;
        btnSalvar.innerHTML = '<i class="fas fa-save me-1"></i> Salvar Orçamento';
    }
}

window.cancelarEdicao = function() {
    if (window.app && window.app.loadPage) {
        window.app.loadPage('orcamentos.html');
    } else {
        window.location.href = 'orcamentos.html';
    }
};

// ========== ALTERAÇÕES DE VALOR ==========
window.abrirModalAlteracao = function(editarId = null) {
    if (editarId) {
        const alteracao = dadosOrcamento.financeiro.alteracoesValor[editarId];
        document.getElementById('alteracaoEditando').value = editarId;
        document.getElementById('alteracaoData').value = alteracao.data;
        document.getElementById('alteracaoTipo').value = alteracao.tipo;
        document.getElementById('alteracaoValor').value = Math.abs(alteracao.valor);
        document.getElementById('alteracaoDescricao').value = alteracao.descricao;
    } else {
        document.getElementById('alteracaoEditando').value = '';
        document.getElementById('alteracaoData').value = new Date().toISOString().slice(0, 16);
        document.getElementById('alteracaoTipo').value = 'acrescimo';
        document.getElementById('alteracaoValor').value = '';
        document.getElementById('alteracaoDescricao').value = '';
    }
    
    abrirModal('modalAlteracao');
};

window.salvarAlteracao = function() {
    const id = document.getElementById('alteracaoEditando').value;
    const data = document.getElementById('alteracaoData').value;
    const tipo = document.getElementById('alteracaoTipo').value;
    const valor = parseFloat(document.getElementById('alteracaoValor').value);
    const descricao = document.getElementById('alteracaoDescricao').value;
    
    if (!data || !valor || !descricao) {
        alert('Preencha todos os campos');
        return;
    }
    
    const alteracao = {
        data,
        valor: tipo === 'desconto' ? -valor : valor,
        tipo,
        descricao,
        criadoPor: userData.nome,
        criadoPorCPF: userCPF
    };
    
    if (id) {
        dadosOrcamento.financeiro.alteracoesValor[id] = alteracao;
    } else {
        const novoId = gerarSubItemId('altv');
        dadosOrcamento.financeiro.alteracoesValor[novoId] = alteracao;
        
        const histId = gerarSubItemId('hist');
        dadosOrcamento.historicoAlteracoes[histId] = {
            data: new Date().toISOString(),
            usuario: userData.nome,
            cpf: userCPF,
            acao: 'financeiro',
            descricao: `${tipo === 'acrescimo' ? 'Acréscimo' : 'Desconto'} de R$ ${valor.toFixed(2)}: ${descricao}`
        };
    }
    
    atualizarTabelaAlteracoes();
    atualizarResumoFinanceiro();
    fecharModal('modalAlteracao');
};

window.excluirAlteracao = function(id) {
    if (confirm('Tem certeza que deseja excluir esta alteração?')) {
        delete dadosOrcamento.financeiro.alteracoesValor[id];
        atualizarTabelaAlteracoes();
        atualizarResumoFinanceiro();
    }
};

function atualizarTabelaAlteracoes() {
    const tbody = document.getElementById('alteracoesBody');
    const alteracoes = dadosOrcamento.financeiro.alteracoesValor || {};
    
    if (Object.keys(alteracoes).length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Nenhuma alteração cadastrada</td></tr>';
        return;
    }
    
    tbody.innerHTML = Object.entries(alteracoes)
        .sort((a, b) => b[1].data.localeCompare(a[1].data))
        .map(([id, alt]) => `
            <tr>
                <td>${formatarDataHora(alt.data)}</td>
                <td>
                    <span class="badge ${alt.tipo === 'acrescimo' ? 'bg-success' : 'bg-danger'}">
                        ${alt.tipo === 'acrescimo' ? '+' : '-'}
                    </span>
                </td>
                <td>R$ ${Math.abs(alt.valor).toFixed(2)}</td>
                <td>${alt.descricao}</td>
                <td>
                    <button class="btn btn-sm btn-link p-0 me-2" onclick="abrirModalAlteracao('${id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-link p-0 text-danger" onclick="excluirAlteracao('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
}

// ========== CUSTOS ==========
window.abrirModalCusto = function(editarId = null) {
    if (editarId) {
        const custo = dadosOrcamento.financeiro.custos[editarId];
        document.getElementById('custoEditando').value = editarId;
        document.getElementById('custoData').value = custo.data;
        document.getElementById('custoValor').value = custo.valor;
        document.getElementById('custoDescricao').value = custo.descricao;
    } else {
        document.getElementById('custoEditando').value = '';
        document.getElementById('custoData').value = new Date().toISOString().slice(0, 16);
        document.getElementById('custoValor').value = '';
        document.getElementById('custoDescricao').value = '';
    }
    
    abrirModal('modalCusto');
};

window.salvarCusto = function() {
    const id = document.getElementById('custoEditando').value;
    const data = document.getElementById('custoData').value;
    const valor = parseFloat(document.getElementById('custoValor').value);
    const descricao = document.getElementById('custoDescricao').value;
    
    if (!data || !valor || !descricao) {
        alert('Preencha todos os campos');
        return;
    }
    
    const custo = {
        data,
        valor,
        descricao,
        criadoPor: userData.nome,
        criadoPorCPF: userCPF
    };
    
    if (id) {
        dadosOrcamento.financeiro.custos[id] = custo;
    } else {
        const novoId = gerarSubItemId('cust');
        dadosOrcamento.financeiro.custos[novoId] = custo;
        
        const histId = gerarSubItemId('hist');
        dadosOrcamento.historicoAlteracoes[histId] = {
            data: new Date().toISOString(),
            usuario: userData.nome,
            cpf: userCPF,
            acao: 'custo',
            descricao: `Custo de R$ ${valor.toFixed(2)}: ${descricao}`
        };
    }
    
    atualizarTabelaCustos();
    atualizarResumoFinanceiro();
    fecharModal('modalCusto');
};

window.excluirCusto = function(id) {
    if (confirm('Tem certeza que deseja excluir este custo?')) {
        delete dadosOrcamento.financeiro.custos[id];
        atualizarTabelaCustos();
        atualizarResumoFinanceiro();
    }
};

function atualizarTabelaCustos() {
    const tbody = document.getElementById('custosBody');
    const custos = dadosOrcamento.financeiro.custos || {};
    
    if (Object.keys(custos).length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum custo cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = Object.entries(custos)
        .sort((a, b) => b[1].data.localeCompare(a[1].data))
        .map(([id, custo]) => `
            <tr>
                <td>${formatarDataHora(custo.data)}</td>
                <td>R$ ${custo.valor.toFixed(2)}</td>
                <td>${custo.descricao}</td>
                <td>
                    <button class="btn btn-sm btn-link p-0 me-2" onclick="abrirModalCusto('${id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-link p-0 text-danger" onclick="excluirCusto('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
}

// ========== PAGAMENTOS ==========
window.abrirModalPagamento = function(editarId = null) {
    if (editarId) {
        const pagamento = dadosOrcamento.financeiro.pagamentos[editarId];
        document.getElementById('pagamentoEditando').value = editarId;
        document.getElementById('pagamentoData').value = pagamento.data;
        document.getElementById('pagamentoValor').value = pagamento.valor;
        document.getElementById('pagamentoDescricao').value = pagamento.descricao;
    } else {
        document.getElementById('pagamentoEditando').value = '';
        document.getElementById('pagamentoData').value = new Date().toISOString().slice(0, 16);
        document.getElementById('pagamentoValor').value = '';
        document.getElementById('pagamentoDescricao').value = '';
    }
    
    abrirModal('modalPagamento');
};

window.salvarPagamento = function() {
    const id = document.getElementById('pagamentoEditando').value;
    const data = document.getElementById('pagamentoData').value;
    const valor = parseFloat(document.getElementById('pagamentoValor').value);
    const descricao = document.getElementById('pagamentoDescricao').value;
    
    if (!data || !valor || !descricao) {
        alert('Preencha todos os campos');
        return;
    }
    
    const pagamento = {
        data,
        valor,
        descricao,
        criadoPor: userData.nome,
        criadoPorCPF: userCPF
    };
    
    if (id) {
        dadosOrcamento.financeiro.pagamentos[id] = pagamento;
    } else {
        const novoId = gerarSubItemId('pagt');
        dadosOrcamento.financeiro.pagamentos[novoId] = pagamento;
        
        const histId = gerarSubItemId('hist');
        dadosOrcamento.historicoAlteracoes[histId] = {
            data: new Date().toISOString(),
            usuario: userData.nome,
            cpf: userCPF,
            acao: 'pagamento',
            descricao: `Pagamento de R$ ${valor.toFixed(2)}: ${descricao}`
        };
    }
    
    atualizarTabelaPagamentos();
    atualizarResumoFinanceiro();
    fecharModal('modalPagamento');
};

window.excluirPagamento = function(id) {
    if (confirm('Tem certeza que deseja excluir este pagamento?')) {
        delete dadosOrcamento.financeiro.pagamentos[id];
        atualizarTabelaPagamentos();
        atualizarResumoFinanceiro();
    }
};

function atualizarTabelaPagamentos() {
    const tbody = document.getElementById('pagamentosBody');
    const pagamentos = dadosOrcamento.financeiro.pagamentos || {};
    
    if (Object.keys(pagamentos).length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum pagamento cadastrado</td></tr>';
        return;
    }
    
    tbody.innerHTML = Object.entries(pagamentos)
        .sort((a, b) => b[1].data.localeCompare(a[1].data))
        .map(([id, pag]) => `
            <tr>
                <td>${formatarDataHora(pag.data)}</td>
                <td class="text-success fw-bold">R$ ${pag.valor.toFixed(2)}</td>
                <td>${pag.descricao}</td>
                <td>
                    <button class="btn btn-sm btn-link p-0 me-2" onclick="abrirModalPagamento('${id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-link p-0 text-danger" onclick="excluirPagamento('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
}

// ========== ANEXOS ==========
window.abrirModalAnexo = function() {
    document.getElementById('anexoEditando').value = '';
    document.getElementById('anexoArquivo').value = '';
    document.getElementById('anexoNome').value = '';
    document.getElementById('anexoDescricao').value = '';
    
    abrirModal('modalAnexo');
};

window.uploadAnexo = async function() {
    const arquivos = Array.from(document.getElementById('anexoArquivo').files || []);
    const nome = document.getElementById('anexoNome').value.trim();
    const descricao = document.getElementById('anexoDescricao').value;
    
    if (arquivos.length === 0 || !nome) {
        alert('Selecione ao menos um arquivo e dê um nome ao anexo');
        return;
    }
    
    const baseSequencia = gerarSubItemId('anexp');
    arquivos.forEach((arquivo, index) => {
        const nomeSequencial = arquivos.length === 1
            ? nome
            : `${nome} (${index + 1})`;
        const novoId = `${baseSequencia}_${String(index + 1).padStart(2, '0')}`;

        dadosOrcamento.anexos[novoId] = {
            data: new Date().toISOString(),
            nome: nomeSequencial,
            descricao,
            url: '',
            publicId: null,
            pendenteUpload: true,
            nomeArquivo: arquivo.name,
            criadoPor: userData.nome,
            criadoPorCPF: userCPF
        };
        
        anexosPendentesUpload[novoId] = arquivo;
    });

    const histId = gerarSubItemId('hist');
    dadosOrcamento.historicoAlteracoes[histId] = {
        data: new Date().toISOString(),
        usuario: userData.nome,
        cpf: userCPF,
        acao: 'anexo_pendente',
        descricao: `${arquivos.length} anexo(s) adicionado(s) e pendente(s) de upload` 
    };

    atualizarAnexos();
    fecharModal('modalAnexo');
};

async function fazerUploadAnexosPendentes() {
    const idsPendentes = Object.keys(anexosPendentesUpload);
    if (idsPendentes.length === 0) return;

    for (const id of idsPendentes) {
        const arquivo = anexosPendentesUpload[id];
        if (!arquivo) continue;

        const resultado = await uploadImagemCloudinary(arquivo);
        dadosOrcamento.anexos[id] = {
            ...dadosOrcamento.anexos[id],
            url: resultado.url,
            publicId: resultado.publicId,
            pendenteUpload: false
        };
        
        delete anexosPendentesUpload[id];
    }
}

function atualizarAnexos() {
    const container = document.getElementById('anexosContainer');
    const anexos = dadosOrcamento.anexos || {};
    
    if (Object.keys(anexos).length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Nenhum anexo adicionado</p>';
        return;
    }
    
    container.innerHTML = `
        <div class="list-group list-group-flush">
            ${Object.entries(anexos)
        .sort((a, b) => b[1].data.localeCompare(a[1].data))
        .map(([id, anexo]) => `
            <div class="list-group-item d-flex justify-content-between align-items-start gap-3">
                <div>
                    <h6 class="mb-1">${anexo.nome}</h6>
                    <p class="mb-1 small text-muted">${anexo.descricao || ''}</p>
                    <small class="text-muted">${formatarDataHora(anexo.data)}</small>
                    ${anexo.pendenteUpload ? '<span class="badge bg-warning text-dark ms-2">Pendente de upload</span>' : ''}
                </div>
                <div class="d-flex gap-2">
                    ${anexo.url ? `<a href="${anexo.url}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="fas fa-eye"></i> Visualizar</a>` : ''}
                    <button class="btn btn-sm btn-outline-danger" onclick="excluirAnexo('${id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('')}
        </div>
    `;
}

window.excluirAnexo = async function(id) {
    if (confirm('Tem certeza que deseja excluir este anexo?')) {
        const anexo = dadosOrcamento.anexos[id];
        if (anexo?.publicId) {
            try {
                await deletarImagemCloudinary(anexo.publicId);
            } catch (error) {
                console.error('Erro ao excluir anexo no Cloudinary:', error);
                alert('Não foi possível excluir o arquivo no Cloudinary. Tente novamente.');
                return;
            }
        }

        delete anexosPendentesUpload[id];
        delete dadosOrcamento.anexos[id];
        atualizarAnexos();
    }
};

// ========== CÁLCULOS FINANCEIROS ==========
function calcularTotalAlteracoes() {
    const alteracoes = dadosOrcamento.financeiro.alteracoesValor || {};
    return Object.values(alteracoes).reduce((total, alt) => total + (alt.valor || 0), 0);
}

function calcularTotalCustos() {
    const custos = dadosOrcamento.financeiro.custos || {};
    return Object.values(custos).reduce((total, custo) => total + (custo.valor || 0), 0);
}

function calcularTotalPagamentos() {
    const pagamentos = dadosOrcamento.financeiro.pagamentos || {};
    return Object.values(pagamentos).reduce((total, pag) => total + (pag.valor || 0), 0);
}

function atualizarResumoFinanceiro() {
    const valorInicial = parseFloat(document.getElementById('valorInicial').value) || 0;
    
    const totalAlteracoes = calcularTotalAlteracoes();
    const totalCustos = calcularTotalCustos();
    const totalPagamentos = calcularTotalPagamentos();
    
    const valorBruto = valorInicial + totalAlteracoes;
    const valorLiquido = valorBruto - totalCustos;
    const saldo = valorLiquido - totalPagamentos;
    
    document.getElementById('displayValorBruto').textContent = `R$ ${valorBruto.toFixed(2)}`;
    document.getElementById('displayTotalCustos').textContent = `R$ ${totalCustos.toFixed(2)}`;
    document.getElementById('displayTotalPagamentos').textContent = `R$ ${totalPagamentos.toFixed(2)}`;
    document.getElementById('displayValorLiquido').textContent = `R$ ${valorLiquido.toFixed(2)}`;
    
    const saldoElement = document.getElementById('displaySaldo');
    saldoElement.textContent = `R$ ${saldo.toFixed(2)}`;
    
    if (saldo > 0) {
        saldoElement.className = 'mb-0 text-warning';
    } else if (saldo < 0) {
        saldoElement.className = 'mb-0 text-danger';
    } else {
        saldoElement.className = 'mb-0 text-success';
    }
}

// ========== UTILITÁRIOS ==========
function formatarDataHora(dataISO) {
    if (!dataISO) return '---';
    const data = new Date(dataISO);
    return data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// Exportar funções para o window
window.abrirModalAlteracao = window.abrirModalAlteracao;
window.salvarAlteracao = window.salvarAlteracao;
window.excluirAlteracao = window.excluirAlteracao;
window.abrirModalCusto = window.abrirModalCusto;
window.salvarCusto = window.salvarCusto;
window.excluirCusto = window.excluirCusto;
window.abrirModalPagamento = window.abrirModalPagamento;
window.salvarPagamento = window.salvarPagamento;
window.excluirPagamento = window.excluirPagamento;
window.abrirModalAnexo = window.abrirModalAnexo;
window.uploadAnexo = window.uploadAnexo;
window.excluirAnexo = window.excluirAnexo;
window.atualizarResumoFinanceiro = atualizarResumoFinanceiro;

// Inicialização automática quando a página é aberta fora do SPA
if (!window.location.pathname.includes('app.html')) {
    const autoInit = () => {
        const params = new URLSearchParams(window.location.search);
        init(params.get('id'));
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', autoInit);
    } else {
        autoInit();
    }
}