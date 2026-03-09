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
    const okSaldo = !soSaldo || i.temSaldoPendente === true;
    return okBusca && okStatus && okSaldo;
  });

  const el = document.getElementById('sociedadeLista');
  el.innerHTML = itens.map(i => `
    <button class="list-group-item list-group-item-action" onclick="window.abrirSociedade('${i.id}')">
      <div class="d-flex justify-content-between"><strong>${i.clienteEmpresa || '-'}</strong><span>${i.status || '-'}</span></div>
      <small>Data contato: ${i.dataContato || '-'} | Saldo pendente: ${i.temSaldoPendente ? 'Sim' : 'Não'}</small>
    </button>
  `).join('') || '<p class="text-muted">Nenhum lançamento.</p>';
}

window.abrirSociedade = (id) => window.app?.loadPage ? window.app.loadPage(`sociedade-edit.html?id=${id}`) : (window.location.href = `sociedade-edit.html?id=${id}`);

if (!window.location.pathname.includes('app.html')) initSociedade();