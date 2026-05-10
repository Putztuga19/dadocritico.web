/* =============================================
   DADO CRÍTICO — dashboard-member.js
   Foto salva como base64 no Firestore
   ============================================= */

import { db } from "./firebase-config.js";
import {
  doc, getDoc, updateDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Estado global ──────────────────────────────────────────────
let _session      = null;
let _userData     = null;
let _fotoBase64   = null;
let _fotoRemovida = false;

// ── INIT ──────────────────────────────────────────────────────
(async () => {
  try { _session = JSON.parse(sessionStorage.getItem('dc_session')); } catch { _session = null; }
  if (!_session) { window.location.href = 'login.html'; return; }
  if (_session.role === 'coord') { window.location.href = 'coordenador.html'; return; }
  const snap = await getDoc(doc(db, 'users', _session.uid));
  if (!snap.exists()) { window.location.href = 'login.html'; return; }
  _userData = snap.data();
  init(_userData);
  await renderEventosMembro();
})();

// ── RENDER INICIAL ────────────────────────────────────────────
function init(u) {
  const exibicao = u.apelido || u.nome.split(' ')[0];
  const inicial  = exibicao.charAt(0).toUpperCase();

  atualizarAvatarSidebar(u.fotoBase64, inicial);
  document.getElementById('sidebarName').textContent = exibicao;
  document.getElementById('navUserName').textContent = exibicao;

  // Topo do perfil
  atualizarFotoPerfil(u.fotoBase64, inicial);
  document.getElementById('perfilApelidoDisplay').textContent = u.apelido || u.nome.split(' ')[0];
  const bioEl = document.getElementById('perfilBioDisplay');
  bioEl.innerHTML = u.bio ? escapeHtml(u.bio).replace(/\n/g, '<br>') : '<em>Sem bio ainda.</em>';

  // Grid de dados
  document.getElementById('pNome').textContent    = u.nome;
  document.getElementById('pEmail').textContent   = u.email;
  document.getElementById('pApelido').textContent = u.apelido || '—';
  document.getElementById('pEntrada').textContent = u.entrada
    ? new Date(u.entrada).toLocaleDateString('pt-BR') : 'Aguardando aprovação';
  document.getElementById('pNumero').textContent  = u.numero || 'Aguardando aprovação';

  // Status banner
  const banner = document.getElementById('statusBanner');
  const status = u.status || 'ativo';
  if (status === 'recusado') {
    banner.classList.add('recusado');
    document.getElementById('statusIcon').innerHTML    = '<i class="fas fa-times-circle"></i>';
    document.getElementById('statusTitle').textContent = 'Adesão não aprovada';
    document.getElementById('statusMsg').textContent   = 'Infelizmente a tua ficha não foi aprovada. Entra em contacto com a coordenação.';
    document.getElementById('pStatus').textContent     = 'Recusado';
  } else {
    if (banner) banner.style.display = 'none';
    document.getElementById('pStatus').textContent = 'Ativo';
  }

  // Cartão digital — integrado na mesma seção
  if (status === 'aprovado' || status === 'ativo') {
    document.getElementById('cartaoLocked')?.classList.add('hidden');
    document.getElementById('cartaoDigital')?.classList.remove('hidden');
    if (document.getElementById('cNome'))     document.getElementById('cNome').textContent     = u.nome;
    if (document.getElementById('cNumero'))   document.getElementById('cNumero').textContent   = u.numero || '—';
    if (document.getElementById('cEntrada'))  document.getElementById('cEntrada').textContent  = u.entrada ? new Date(u.entrada).toLocaleDateString('pt-BR') : '—';
    if (document.getElementById('cValidade')) document.getElementById('cValidade').textContent = u.validade || '—';
  }

  // Navegação sidebar
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const sec = link.dataset.section;
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('section-' + sec)?.classList.add('active');
    });
  });
}

// ── AVATAR HELPERS ────────────────────────────────────────────
function atualizarAvatarSidebar(fotoBase64, inicial) {
  const circle = document.getElementById('avatarCircle');
  if (!circle) return;
  if (fotoBase64) {
    circle.innerHTML = `<img src="${fotoBase64}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
  } else {
    circle.textContent = inicial;
  }
}

function atualizarFotoPerfil(fotoBase64, inicial) {
  const img  = document.getElementById('perfilFotoImg');
  const span = document.getElementById('perfilFotoInicial');
  if (fotoBase64) {
    img.src = fotoBase64;
    img.style.display = 'block';
    if (span) span.style.display = 'none';
  } else {
    img.style.display = 'none';
    if (span) { span.style.display = ''; span.textContent = inicial; }
  }
}

// ── MODAL EDIÇÃO ──────────────────────────────────────────────
function abrirModalEdicao() {
  if (!_userData) return;
  _fotoBase64   = null;
  _fotoRemovida = false;

  document.getElementById('editApelido').value    = _userData.apelido || '';
  document.getElementById('editBio').value        = _userData.bio     || '';
  document.getElementById('bioCount').textContent = (_userData.bio || '').length;
  document.getElementById('inputFoto').value      = '';

  const img    = document.getElementById('editFotoImg');
  const span   = document.getElementById('editFotoInicial');
  const btnRem = document.getElementById('btnRemoverFoto');
  const inicial = (_userData.apelido || _userData.nome.split(' ')[0]).charAt(0).toUpperCase();

  if (_userData.fotoBase64) {
    img.src = _userData.fotoBase64;
    img.style.display = 'block';
    span.style.display = 'none';
    btnRem.style.display = '';
  } else {
    img.style.display = 'none';
    span.style.display = '';
    span.textContent = inicial;
    btnRem.style.display = 'none';
  }

  esconderFeedback();
  document.getElementById('modalEdicao').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
window.abrirModalEdicao = abrirModalEdicao;

function fecharModalEdicao() {
  document.getElementById('modalEdicao').classList.add('hidden');
  document.body.style.overflow = '';
}
window.fecharModalEdicao = fecharModalEdicao;

// ── PREVIEW + RESIZE FOTO ─────────────────────────────────────
function previewFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { mostrarFeedback('A imagem deve ter no máximo 5 MB.', 'erro'); return; }
  if (!file.type.startsWith('image/')) { mostrarFeedback('Selecione um ficheiro de imagem válido.', 'erro'); return; }

  _fotoRemovida = false;
  esconderFeedback();

  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext('2d');
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width  - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, 256, 256);
      _fotoBase64 = canvas.toDataURL('image/jpeg', 0.75);

      const previewImg  = document.getElementById('editFotoImg');
      const previewSpan = document.getElementById('editFotoInicial');
      previewImg.src = _fotoBase64;
      previewImg.style.display = 'block';
      previewSpan.style.display = 'none';
      document.getElementById('btnRemoverFoto').style.display = '';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
window.previewFoto = previewFoto;

function removerFoto() {
  _fotoBase64   = null;
  _fotoRemovida = true;
  const img    = document.getElementById('editFotoImg');
  const span   = document.getElementById('editFotoInicial');
  img.src = ''; img.style.display = 'none';
  span.style.display = '';
  span.textContent = (_userData.apelido || _userData.nome.split(' ')[0]).charAt(0).toUpperCase();
  document.getElementById('btnRemoverFoto').style.display = 'none';
  document.getElementById('inputFoto').value = '';
}
window.removerFoto = removerFoto;

// Contador bio
document.addEventListener('DOMContentLoaded', () => {
  const bio = document.getElementById('editBio');
  if (bio) bio.addEventListener('input', () => {
    document.getElementById('bioCount').textContent = bio.value.length;
  });
});

// ── SALVAR PERFIL ─────────────────────────────────────────────
async function salvarPerfil() {
  const btn     = document.getElementById('btnSalvarPerfil');
  const apelido = document.getElementById('editApelido').value.trim();
  const bio     = document.getElementById('editBio').value.trim();

  btn.disabled  = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando…';
  esconderFeedback();

  try {
    const updates = { apelido, bio };
    if (_fotoBase64)   updates.fotoBase64 = _fotoBase64;
    if (_fotoRemovida) updates.fotoBase64 = '';

    await updateDoc(doc(db, 'users', _session.uid), updates);
    _userData = { ..._userData, ...updates };

    const exibicao = apelido || _userData.nome.split(' ')[0];
    const inicial  = exibicao.charAt(0).toUpperCase();

    atualizarAvatarSidebar(_userData.fotoBase64, inicial);
    atualizarFotoPerfil(_userData.fotoBase64, inicial);
    document.getElementById('perfilApelidoDisplay').textContent = exibicao;
    const bioEl = document.getElementById('perfilBioDisplay');
    bioEl.innerHTML = bio ? escapeHtml(bio).replace(/\n/g, '<br>') : '<em>Sem bio ainda.</em>';
    document.getElementById('pApelido').textContent    = apelido || '—';
    document.getElementById('sidebarName').textContent = exibicao;
    document.getElementById('navUserName').textContent = exibicao;

    mostrarFeedback('Perfil guardado com sucesso!', 'ok');
    setTimeout(fecharModalEdicao, 1200);

  } catch (err) {
    console.error(err);
    mostrarFeedback('Erro ao salvar. Tenta novamente.', 'erro');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Salvar';
  }
}
window.salvarPerfil = salvarPerfil;

// ── FEEDBACK ──────────────────────────────────────────────────
function mostrarFeedback(msg, tipo) {
  const el = document.getElementById('editFeedback');
  el.textContent = msg;
  el.className   = 'edit-feedback ' + (tipo === 'erro' ? 'edit-feedback-erro' : 'edit-feedback-ok');
}
function esconderFeedback() {
  document.getElementById('editFeedback').className = 'edit-feedback hidden';
}

// ── EVENTOS ───────────────────────────────────────────────────
async function renderEventosMembro() {
  const grid  = document.getElementById('eventosGrid');
  const empty = document.getElementById('emptyEventosMembro');
  if (!grid) return;
  grid.querySelectorAll('.evento-card').forEach(el => el.remove());
  try {
    const snap = await getDocs(collection(db, 'eventos'));
    if (snap.empty) { if (empty) empty.style.display = ''; return; }
    if (empty) empty.style.display = 'none';
    const eventos = [];
    snap.forEach(d => eventos.push({ id: d.id, ...d.data() }));
    eventos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    eventos.forEach(ev => {
      const div = document.createElement('div');
      div.className = 'evento-card' + (ev.tipo === 'especial' ? ' destaque' : '');
      div.innerHTML = `
        <div class="evento-dia">${ev.tipo === 'especial' ? '<i class="fas fa-star"></i>' : (ev.dia || '—')}</div>
        <div class="evento-info">
          <strong>${ev.titulo}</strong>
          <span>${ev.horario || ''}</span>
          <p>${ev.local || ''}</p>
          ${ev.desc ? `<p style="margin-top:0.25rem;font-style:italic;">${ev.desc}</p>` : ''}
        </div>
        <div class="evento-badge ${ev.tipo === 'especial' ? 'especial' : 'regular'}">${ev.tipo === 'especial' ? 'Especial' : 'Regular'}</div>`;
      grid.appendChild(div);
    });
  } catch (err) { console.warn('Erro ao carregar eventos:', err); }
}

// ── LOGOUT ────────────────────────────────────────────────────
function doLogout(destino) {
  sessionStorage.removeItem('dc_session');
  window.location.href = destino || 'login-membro.html';
}
window._doLogoutConta = () => doLogout('login-membro.html');
window._doLogoutSair  = () => doLogout('index.html');

function downloadCartao() { alert('Função de download do cartão em breve!'); }
window.downloadCartao = downloadCartao;

// ── UTIL ──────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
