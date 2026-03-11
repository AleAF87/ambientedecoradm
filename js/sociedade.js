import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const STATUSS = ['', 'fazer_visita','fazer_orcamento','medicao_fina','producao','montagem','aguardando','concluido','geladeira','cancelado'];
let lista = [];

export async function initSociedade() {
  await checkAuth(3);
  const select = document.getElementById('socStatus');
  select.innerHTML = STATUSS.map(s => `<option value="${s}">${s ? s : 'Todos status'}</option>`).join('');

  ['socBusca','socStatus','socSaldo'].forEach(id => document.getElementById(id)?.addEventListener('input', render));
  document.getElementById('socSaldo')?.addEventListener('change', render);

  onValue(ref(database, 'sociedade'), (snapshot) => {
    const dados = snapshot.val() || {};
    lista = Object.keys(dados).map(id => ({ id, ...dados[id] }));
    render();
  });
}

function render() {
  const busca = (document.getElementById('socBusca')?.value || '').toLowerCase();
  const status = document.getElementById('socStatus')?.value || '';
  const soSaldo = !!document.getElementById('socSaldo')?.checked;

  const itens = lista.filter(i => {
    const okBusca = (i.clienteEmpresa || '').toLowerCase().includes(busca);
    const okStatus = !status || i.status === status;
    const okSaldo = !soSaldo || Number(i.financeiro?.saldo ?? i.saldo ?? 0) > 0 || i.temSaldoPendente === true;
    return okBusca && okStatus && okSaldo;
  });

  atualizarCards(itens);

  const el = document.getElementById('sociedadeTableBody');
  if (!el) return;

  if (!itens.length) {
    el.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Nenhum lançamento.</td></tr>';
    return;
  }

  el.innerHTML = itens.map(i => {
    const valorLiquido = Number(i.financeiro?.valorLiquido ?? i.valorLiquido ?? 0);
    const saldo = Number(i.financeiro?.saldo ?? i.saldo ?? 0);
    const totalPagamentos = Number(i.financeiro?.totalPagamentos ?? i.totalPagamentos ?? 0);

    return `
      <tr>
        <td><strong>${i.clienteEmpresa || '-'}</strong></td>
        <td><span class="badge text-bg-secondary">${i.status || '-'}</span></td>
        <td>${formatarMoeda(valorLiquido)}</td>
        <td class="${saldo > 0 ? 'text-warning fw-semibold' : 'text-success fw-semibold'}">${formatarMoeda(saldo)}</td>
        <td>${formatarMoeda(totalPagamentos)}</td>
        <td>${i.dataContato || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="window.abrirSociedade('${i.id}')">
            <i class="fas fa-edit"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function atualizarCards(itens) {
  const totalProjetos = itens.length;
  const valorLiquidoTotal = itens.reduce((acc, i) => acc + Number(i.financeiro?.valorLiquido ?? i.valorLiquido ?? 0), 0);
  const saldoTotal = itens.reduce((acc, i) => acc + Number(i.financeiro?.saldo ?? i.saldo ?? 0), 0);
  const totalRecebido = itens.reduce((acc, i) => acc + Number(i.financeiro?.totalPagamentos ?? i.totalPagamentos ?? 0), 0);

  const setText = (id, value) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value;
  };

  setText('cardTotalProjetos', String(totalProjetos));
  setText('cardValorLiquido', formatarMoeda(valorLiquidoTotal));
  setText('cardSaldo', formatarMoeda(saldoTotal));
  setText('cardTotalPagamentos', formatarMoeda(totalRecebido));
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

window.abrirSociedade = (id) => window.app?.loadPage ? window.app.loadPage(`sociedade-edit.html?id=${id}`) : (window.location.href = `sociedade-edit.html?id=${id}`);

if (!window.location.pathname.includes('app.html')) initSociedade();