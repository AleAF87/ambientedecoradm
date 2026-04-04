import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const STATUSS = ['fazer_visita','fazer_orcamento','medicao_fina','producao','montagem','aguardando','concluido','geladeira','cancelado'];
const STATUSS_OCULTOS = new Set(['fazer_visita', 'fazer_orcamento', 'geladeira', 'cancelado']);
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
let financeiroOrcamentos = {};

export async function initSociedade() {
  await checkAuth(3);
  const select = document.getElementById('socStatus');
  select.innerHTML = ['<option value="">Todos status</option>']
    .concat(STATUSS.map(s => `<option value="${s}">${STATUS_LABELS[s] || s}</option>`))
    .join('');

  document.getElementById('socBusca')?.addEventListener('input', render);
  document.getElementById('socStatus')?.addEventListener('change', render);
  document.getElementById('socSaldo')?.addEventListener('change', render);
  document.getElementById('socDivisaoPendente')?.addEventListener('change', render);

  onValue(ref(database, 'sociedade'), (snapshot) => {
    if (snapshot.exists()) {
      const dados = snapshot.val() || {};
      lista = Object.keys(dados).map(id => ({ id, ...dados[id] }));
      render();
      return;
    }

    // Compatibilidade com bases antigas sem nó "sociedade"
    onValue(ref(database, 'orcamentos'), (orcSnapshot) => {
      const dados = orcSnapshot.val() || {};
      lista = Object.keys(dados).map(id => ({ id, ...dados[id] }));
      render();
    });
  });
  
  onValue(ref(database, 'orcamentos'), (snapshot) => {
    financeiroOrcamentos = snapshot.val() || {};
    render();
  });
}

function obterDadosFinanceiros(item) {
  const financeiroOrcamento = financeiroOrcamentos?.[item.id]?.financeiro || {};

  return {
    valorLiquido: Number(financeiroOrcamento.valorLiquido ?? item.financeiro?.valorLiquido ?? item.valorLiquido ?? 0),
    saldo: Number(financeiroOrcamento.saldo ?? item.financeiro?.saldo ?? item.saldo ?? 0),
    totalPagamentos: Number(financeiroOrcamento.totalPagamentos ?? item.financeiro?.totalPagamentos ?? item.totalPagamentos ?? 0)
  };
}

function render() {
  const busca = (document.getElementById('socBusca')?.value || '').toLowerCase();
  const status = document.getElementById('socStatus')?.value || '';
  const soSaldo = !!document.getElementById('socSaldo')?.checked;
  const soDivisaoPendente = !!document.getElementById('socDivisaoPendente')?.checked;

  const itens = lista.filter(i => {
    if (STATUSS_OCULTOS.has(i.status || '')) return false;

    const financeiro = obterDadosFinanceiros(i);
    const okBusca = (i.clienteEmpresa || i.projeto?.clienteEmpresa || '').toLowerCase().includes(busca);
    const okStatus = !status || i.status === status;
    const okSaldo = !soSaldo || financeiro.saldo > 0 || i.temSaldoPendente === true;
    const okDivisao = !soDivisaoPendente || !divisaoConcluida(i);
    return okBusca && okStatus && okSaldo && okDivisao;
  }).sort((a, b) => obterTimestampContato(b) - obterTimestampContato(a));

  atualizarCards(itens);

  const tabelaBody = document.getElementById('sociedadeTableBody');
  const listaContainer = document.getElementById('sociedadeLista');

  if (!itens.length) {
    if (tabelaBody) tabelaBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Nenhum lançamento.</td></tr>';
    if (listaContainer) listaContainer.innerHTML = '<div class="text-center text-muted py-4">Nenhum lançamento.</div>';
    return;
  }

  if (tabelaBody) {
    tabelaBody.innerHTML = itens.map(i => {
      const { valorLiquido, saldo } = obterDadosFinanceiros(i);

      return `
        <tr>
          <td class="text-nowrap">${i.id || '-'}</td>
          <td><strong>${i.clienteEmpresa || i.projeto?.clienteEmpresa || '-'}</strong></td>
          <td><span class="badge text-bg-secondary">${obterStatusLabel(i.status)}</span></td>
          <td>${formatarMoeda(valorLiquido)}</td>
          <td class="${saldo > 0 ? 'text-warning fw-semibold' : 'text-success fw-semibold'}">${formatarMoeda(saldo)}</td>
          <td>${formatarDataBr(i.dataContato || i.datas?.dataContato)}</td>
          <td class="fw-semibold text-center ${divisaoConcluida(i) ? 'text-success' : 'text-danger'}">
            <i class="fas ${divisaoConcluida(i) ? 'fa-circle-check' : 'fa-circle-xmark'}" aria-label="${divisaoConcluida(i) ? 'Verificado' : 'Não verificado'}" title="${divisaoConcluida(i) ? 'Verificado' : 'Não verificado'}"></i>
          </td>
          <td>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-success" title="Abrir sociedade" onclick="window.abrirSociedade('${i.id}')">
                <i class="fas fa-dollar-sign"></i>
              </button>
              <button class="btn btn-sm btn-outline-primary" title="Editar orçamento" onclick="window.abrirOrcamento('${i.id}')">
                <i class="fas fa-pen"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  if (listaContainer) {
    listaContainer.innerHTML = itens.map(i => {
      const cliente = i.clienteEmpresa || i.projeto?.clienteEmpresa || '-';
      const { valorLiquido, saldo } = obterDadosFinanceiros(i);
      return `
        <div class="list-group-item sociedade-item d-flex justify-content-between align-items-center gap-3">
          <div class="sociedade-identificacao">
            <div class="fw-semibold sociedade-cliente">${cliente}</div>
            <small class="text-muted">${obterStatusLabel(i.status)} • ${formatarDataBr(i.dataContato || i.datas?.dataContato)}</small>
          </div>
          <div class="text-end sociedade-valores">
            <div class="fw-semibold">${formatarMoeda(valorLiquido)}</div>
            <small class="${saldo > 0 ? 'text-warning' : 'text-success'}">Saldo: ${formatarMoeda(saldo)}</small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-sm btn-outline-success" title="Abrir sociedade" onclick="window.abrirSociedade('${i.id}')">
              <i class="fas fa-dollar-sign"></i>
            </button>
            <button class="btn btn-sm btn-outline-primary" title="Editar orçamento" onclick="window.abrirOrcamento('${i.id}')">
              <i class="fas fa-pen"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

function atualizarCards(itens) {
  const totalProjetos = itens.length;
  const valorLiquidoTotal = itens.reduce((acc, i) => acc + obterDadosFinanceiros(i).valorLiquido, 0);
  const saldoTotal = itens.reduce((acc, i) => acc + obterDadosFinanceiros(i).saldo, 0);
  const totalRecebido = itens.reduce((acc, i) => acc + obterDadosFinanceiros(i).totalPagamentos, 0);

  const setText = (id, value) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value;
  };

  setText('cardTotalProjetos', String(totalProjetos));
  setText('cardValorLiquido', formatarMoeda(valorLiquidoTotal));
  setText('cardSaldo', formatarMoeda(saldoTotal));
  setText('cardTotalPagamentos', formatarMoeda(totalRecebido));
}


function obterStatusLabel(status) {
  if (!status) return '-';
  return STATUS_LABELS[status] || status
    .split('_')
    .map(parte => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

function formatarDataBr(data) {
  if (!data) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [ano, mes, dia] = data.split('-');
    return `${dia}/${mes}/${ano}`;
  }

  const dt = new Date(data);
  if (!Number.isNaN(dt.getTime())) {
    return dt.toLocaleDateString('pt-BR');
  }

  return data;
}

function obterTimestampContato(item) {
  const data = item?.dataContato || item?.datas?.dataContato;
  if (!data) return -Infinity;

  const timestamp = Date.parse(data);
  return Number.isNaN(timestamp) ? -Infinity : timestamp;
}

function divisaoConcluida(item) {
  return Boolean(item.pagamentoDavid && item.pagamentoAlexandre);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.abrirSociedade = (id) => window.app?.loadPage ? window.app.loadPage(`sociedade-edit.html?id=${id}`) : (window.location.href = `sociedade-edit.html?id=${id}`);
window.abrirOrcamento = (id) => window.app?.loadPage ? window.app.loadPage(`orcamentos-edit.html?id=${id}`) : (window.location.href = `orcamentos-edit.html?id=${id}`);

if (!window.location.pathname.includes('app.html')) initSociedade();