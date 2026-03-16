import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { uploadImagemCloudinary } from './cloudinary-config.js';

let itemId = null;
let valorLiquidoAtual = 0;
let saldoPendenteAtual = 0;

export async function initSociedadeEdit(idFromSPA = null) {
  await checkAuth(3);
  itemId = idFromSPA || new URLSearchParams(window.location.search).get('id');
  if (!itemId) return;

  const [sociedadeSnapshot, orcamentoSnapshot] = await Promise.all([
    get(ref(database, `sociedade/${itemId}`)),
    get(ref(database, `orcamentos/${itemId}/financeiro`))
  ]);
  const dados = sociedadeSnapshot.val() || {};
  const financeiroOrcamento = orcamentoSnapshot.val() || {};

  valorLiquidoAtual = Number(financeiroOrcamento.valorLiquido ?? dados.valorLiquido ?? 0);
  saldoPendenteAtual = Number(financeiroOrcamento.saldo ?? dados.saldo ?? 0);

  document.getElementById('valorLiquido').value = formatarMoeda(valorLiquidoAtual);
  document.getElementById('percentualDivisao').value = dados.percentualDivisao ?? 50;
  document.getElementById('pagamentoDavid').value = dados.pagamentoDavid || '';
  document.getElementById('pagamentoAlexandre').value = dados.pagamentoAlexandre || '';
  
  atualizarDisponibilidadePagamentos();
  atualizarValoresSocios();

  document.getElementById('percentualDivisao')?.addEventListener('input', atualizarValoresSocios);
  document.getElementById('socEditForm').addEventListener('submit', salvar);
}


function atualizarDisponibilidadePagamentos() {
  const possuiSaldoPendente = saldoPendenteAtual > 0;
  const pagamentoDavid = document.getElementById('pagamentoDavid');
  const pagamentoAlexandre = document.getElementById('pagamentoAlexandre');
  const alerta = document.getElementById('saldoPendenteAlert');

  if (pagamentoDavid) pagamentoDavid.disabled = possuiSaldoPendente;
  if (pagamentoAlexandre) pagamentoAlexandre.disabled = possuiSaldoPendente;

  if (!alerta) return;

  if (possuiSaldoPendente) {
    alerta.className = 'col-12 alert alert-warning mb-0';
    alerta.textContent = `Há saldo pendente de ${formatarMoeda(saldoPendenteAtual)}. Preencha os pagamentos apenas quando o saldo for zerado.`;
    return;
  }

  alerta.className = 'col-12 d-none';
  alerta.textContent = '';
}

function atualizarValoresSocios() {
  const percentual = Number(document.getElementById('percentualDivisao').value || 0);
  const valorDavid = (valorLiquidoAtual * percentual) / 100;
  const valorAlexandre = valorLiquidoAtual - valorDavid;

  const campoDavid = document.getElementById('valorDavid');
  const campoAlexandre = document.getElementById('valorAlexandre');

  if (campoDavid) {
    if ('value' in campoDavid) campoDavid.value = formatarMoeda(valorDavid);
    else campoDavid.textContent = formatarMoeda(valorDavid);
  }

  if (campoAlexandre) {
    if ('value' in campoAlexandre) campoAlexandre.value = formatarMoeda(valorAlexandre);
    else campoAlexandre.textContent = formatarMoeda(valorAlexandre);
  }
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

async function salvar(e) {
  e.preventDefault();
  const arquivo = document.getElementById('anexoSociedade').files[0];
  let anexo = null;

  if (arquivo) {
    const up = await uploadImagemCloudinary(arquivo, 'sociedade');
    anexo = { nome: arquivo.name, url: up.secure_url || up.url, publicId: up.public_id };
  }

  const percentualDivisao = Number(document.getElementById('percentualDivisao').value || 50);
  const valorDavid = (valorLiquidoAtual * percentualDivisao) / 100;
  const valorAlexandre = valorLiquidoAtual - valorDavid;

  await update(ref(database, `sociedade/${itemId}`), {
    percentualDivisao,
    pagamentoDavid: document.getElementById('pagamentoDavid').value || null,
    pagamentoAlexandre: document.getElementById('pagamentoAlexandre').value || null,
    valorDavid,
    valorAlexandre,
    anexoSociedade: anexo,
    alteradoEm: new Date().toISOString()
  });

  alert('Registro de sociedade salvo com sucesso.');
}

if (!window.location.pathname.includes('app.html')) initSociedadeEdit();