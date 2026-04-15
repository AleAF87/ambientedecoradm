import { checkAuth, loadNavbar } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { uploadImagemCloudinary, deletarImagemCloudinary } from './cloudinary-config.js';

let itemId = null;
let valorLiquidoAtual = 0;
let saldoPendenteAtual = 0;
let anexosSociedade = [];

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
  anexosSociedade = normalizarAnexos(dados.anexoSociedade);

  atualizarDisponibilidadePagamentos();
  atualizarValoresSocios();

  document.getElementById('percentualDivisao')?.addEventListener('input', atualizarValoresSocios);
  document.getElementById('socEditForm').addEventListener('submit', salvar);
  document.getElementById('anexosSociedadeContainer')?.addEventListener('click', onClickAnexoSociedade);

  renderizarListaAnexosSociedade();
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

function normalizarAnexos(anexos) {
  if (!anexos) return [];
  if (Array.isArray(anexos)) return anexos.filter((anexo) => anexo?.url);
  if (anexos.url) return [anexos];
  return Object.values(anexos).filter((anexo) => anexo?.url);
}

function sanitizarAnexos(anexos) {
  return normalizarAnexos(anexos).map((anexo, index) => ({
    nome: anexo.nome || `Anexo ${index + 1}`,
    url: anexo.url,
    publicId: anexo.publicId ?? null
  }));
}

function renderizarListaAnexosSociedade() {
  const container = document.getElementById('anexosSociedadeContainer');
  if (!container) return;

  if (!anexosSociedade.length) {
    container.innerHTML = '<p class="text-muted mb-0">Nenhum anexo vinculado a este orçamento.</p>';
    return;
  }

  container.innerHTML = `
    <label class="form-label fw-semibold mb-2">Anexos do orçamento</label>
    <ul class="list-group">
      ${anexosSociedade.map((anexo, index) => `
        <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
          <span class="text-break">${anexo.nome || `Anexo ${index + 1}`}</span>
          <div class="d-flex gap-2">
            <a href="${anexo.url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">Visualizar</a>
            <button type="button" class="btn btn-sm btn-outline-danger" data-acao="deletar-anexo" data-index="${index}">Deletar</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;
}

async function onClickAnexoSociedade(event) {
  const botaoDeletar = event.target.closest('[data-acao="deletar-anexo"]');
  if (!botaoDeletar) return;

  const indice = Number(botaoDeletar.dataset.index);
  const anexo = anexosSociedade[indice];
  if (!anexo) return;

  if (!confirm(`Tem certeza que deseja deletar o anexo "${anexo.nome || 'sem nome'}"?`)) return;

  botaoDeletar.disabled = true;

  try {
    if (anexo.publicId) {
      await deletarImagemCloudinary(anexo.publicId);
    }

    anexosSociedade.splice(indice, 1);

    await update(ref(database, `sociedade/${itemId}`), {
      anexoSociedade: sanitizarAnexos(anexosSociedade),
      alteradoEm: new Date().toISOString()
    });

    renderizarListaAnexosSociedade();
  } catch (error) {
    console.error('Erro ao deletar anexo da sociedade:', error);
    alert('Não foi possível deletar o anexo. Tente novamente.');
    botaoDeletar.disabled = false;
  }
}

async function salvar(e) {
  e.preventDefault();
  const arquivos = Array.from(document.getElementById('anexoSociedade').files || []);
  const novosAnexos = [];

  for (const arquivo of arquivos) {
    const up = await uploadImagemCloudinary(arquivo, 'sociedade');
    novosAnexos.push({
      nome: arquivo.name,
      url: up.secure_url || up.url,
      publicId: up.public_id ?? up.publicId ?? null
    });
  }

  const percentualDivisao = Number(document.getElementById('percentualDivisao').value || 50);
  const valorDavid = (valorLiquidoAtual * percentualDivisao) / 100;
  const valorAlexandre = valorLiquidoAtual - valorDavid;
  const anexosAtualizados = sanitizarAnexos([...anexosSociedade, ...novosAnexos]);

  await update(ref(database, `sociedade/${itemId}`), {
    percentualDivisao,
    pagamentoDavid: document.getElementById('pagamentoDavid').value || null,
    pagamentoAlexandre: document.getElementById('pagamentoAlexandre').value || null,
    valorDavid,
    valorAlexandre,
    anexoSociedade: anexosAtualizados,
    alteradoEm: new Date().toISOString()
  });

  anexosSociedade = anexosAtualizados;
  document.getElementById('anexoSociedade').value = '';
  renderizarListaAnexosSociedade();

  alert('Registro de sociedade salvo com sucesso.');
  voltarParaSociedade();
}

function voltarParaSociedade() {
  if (window.app?.loadPage) {
    window.app.loadPage('sociedade.html');
    return;
  }

  window.location.href = 'sociedade.html';
}

window.cancelarEdicao = function() {
    if (window.app && window.app.loadPage) {
        window.app.loadPage('sociedade.html');
    } else {
        window.location.href = 'sociedade.html';
    }
};

if (!window.location.pathname.includes('app.html')) {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      await loadNavbar();
    } catch (error) {
      console.warn('Nao foi possivel carregar a navbar de sociedade-edit:', error);
    }
    await initSociedadeEdit();
  });
}
