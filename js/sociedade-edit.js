import { checkAuth } from './auth-check.js';
import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { uploadImagemCloudinary } from './cloudinary-config.js';

let itemId = null;

export async function initSociedadeEdit(idFromSPA = null) {
  await checkAuth(3);
  itemId = idFromSPA || new URLSearchParams(window.location.search).get('id');
  if (!itemId) return;

  const snapshot = await get(ref(database, `sociedade/${itemId}`));
  const dados = snapshot.val() || {};

  document.getElementById('percentualDivisao').value = dados.percentualDivisao ?? 50;
  document.getElementById('pagamentoDavid').value = dados.pagamentoDavid || '';
  document.getElementById('pagamentoAlexandre').value = dados.pagamentoAlexandre || '';
  document.getElementById('valorDavid').value = dados.valorDavid || '';
  document.getElementById('valorAlexandre').value = dados.valorAlexandre || '';

  document.getElementById('socEditForm').addEventListener('submit', salvar);
}

async function salvar(e) {
  e.preventDefault();
  const arquivo = document.getElementById('anexoSociedade').files[0];
  let anexo = null;

  if (arquivo) {
    const up = await uploadImagemCloudinary(arquivo, 'sociedade');
    anexo = { nome: arquivo.name, url: up.secure_url || up.url, publicId: up.public_id };
  }

  await update(ref(database, `sociedade/${itemId}`), {
    percentualDivisao: Number(document.getElementById('percentualDivisao').value || 50),
    pagamentoDavid: document.getElementById('pagamentoDavid').value || null,
    pagamentoAlexandre: document.getElementById('pagamentoAlexandre').value || null,
    valorDavid: document.getElementById('valorDavid').value || '',
    valorAlexandre: document.getElementById('valorAlexandre').value || '',
    anexoSociedade: anexo,
    alteradoEm: new Date().toISOString()
  });

  alert('Registro de sociedade salvo com sucesso.');
}

if (!window.location.pathname.includes('app.html')) initSociedadeEdit();