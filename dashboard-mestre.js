/* =============================================
   DADO CRÍTICO — dashboard-mestre.js (Firebase)
   Painel completo do Mestre:
   Perfil (foto, bio, sistemas) | Minhas Mesas |
   Sessões (c/ filtro) | Notas de Campanha
   ============================================= */

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser     = null;
let currentUserData = null;

// ── estados locais ──
let sessaoEditandoId = null;
let mesaEditandoId   = null;
let filtroSessoes    = 'futuras';

// ── notas ──
let notasCache      = [];   // [{ id, titulo, corpo, updatedAt }]
let notaAtualId     = null;

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
(async () => {
  let session;
  try { session = JSON.parse(sessionStorage.getItem('dc_session')); } catch { session = null; }
  if (!session || (session.role !== 'mestre' && session.role !== 'master')) { window.location.href = 'login.html'; return; }
  currentUser = session;
  const snap = await getDoc(doc(db, 'users', session.uid));
  if (!snap.exists()) { window.location.href = 'login.html'; return; }
  init(snap.data());
})();

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
function init(userData) {
  currentUserData = userData;
  const u = currentUserData;
  const exibicao = u.apelido || u.nome.split(' ')[0];

  document.getElementById('navUserName').textContent  = exibicao;
  document.getElementById('sidebarName').textContent  = exibicao;
  document.getElementById('sidebarCode').textContent  = u.numero || '—';

  // Avatar: foto salva ou inicial
  const avatarEl = document.getElementById('avatarCircle');
  if (u.avatarUrl) {
    avatarEl.innerHTML = `<img src="${u.avatarUrl}" alt="Avatar" />`;
  } else {
    avatarEl.textContent = exibicao.charAt(0).toUpperCase();
  }

  // Perfil
  document.getElementById('pNome').textContent    = u.nome;
  document.getElementById('pEmail').textContent   = u.email;
  document.getElementById('pApelido').textContent = u.apelido || '—';
  document.getElementById('pNumero').textContent  = u.numero  || '—';
  document.getElementById('pEntrada').textContent = u.entrada
    ? new Date(u.entrada).toLocaleDateString('pt-BR') : '—';
  document.getElementById('pBio').value = u.bio || '';
  renderSistemasChips(u.sistemas || []);

  // Upload de avatar
  document.getElementById('avatarUpload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      avatarEl.innerHTML = `<img src="${dataUrl}" alt="Avatar" />`;
      await updateDoc(doc(db, 'users', currentUser.uid), { avatarUrl: dataUrl });
      currentUserData.avatarUrl = dataUrl;
    };
    reader.readAsDataURL(file);
  });

  // Navegação sidebar
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('section-' + link.dataset.section).classList.add('active');
      if (link.dataset.section === 'sessoes') renderSessoes();
      if (link.dataset.section === 'mesas')   renderMesas();
      if (link.dataset.section === 'notas')   renderNotas();
      if (link.dataset.section === 'eventos') renderEventosMestre();
    });
  });

  renderMesas();
  renderSessoes();
  renderNotas();
}

// ═══════════════════════════════════════════════
// PERFIL
// ═══════════════════════════════════════════════

let sistemasAtivos = [];

function renderSistemasChips(lista) {
  sistemasAtivos = [...lista];
  const container = document.getElementById('sistemasChips');
  container.innerHTML = '';
  sistemasAtivos.forEach((s, i) => {
    const chip = document.createElement('span');
    chip.className = 'sistema-chip';
    chip.innerHTML = `${s} <button onclick="removerSistema(${i})" title="Remover"><i class="fas fa-times"></i></button>`;
    container.appendChild(chip);
  });
}

function adicionarSistema() {
  const input = document.getElementById('novoSistemaInput');
  const val   = input.value.trim();
  if (!val) return;
  if (!sistemasAtivos.includes(val)) {
    sistemasAtivos.push(val);
    renderSistemasChips(sistemasAtivos);
  }
  input.value = '';
}

function removerSistema(idx) {
  sistemasAtivos.splice(idx, 1);
  renderSistemasChips(sistemasAtivos);
}

document.getElementById('novoSistemaInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); adicionarSistema(); }
});

async function salvarPerfil() {
  const bio     = document.getElementById('pBio').value.trim();
  const sistemas = [...sistemasAtivos];
  await updateDoc(doc(db, 'users', currentUser.uid), { bio, sistemas });
  currentUserData.bio      = bio;
  currentUserData.sistemas = sistemas;
  const msg = document.getElementById('perfilSavedMsg');
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════════
// MESAS
// ═══════════════════════════════════════════════

async function renderMesas() {
  const grid  = document.getElementById('mesasGrid');
  const empty = document.getElementById('emptyMesas');
  const badge = document.getElementById('badgeMesas');

  // limpa cards (mantém empty-state)
  grid.querySelectorAll('.mesa-card').forEach(el => el.remove());

  const q    = query(collection(db, 'mesas'), where('mestreUid', '==', currentUser.uid));
  const snap = await getDocs(q);
  const mesas = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  badge.textContent   = mesas.filter(m => m.status === 'ativa').length || mesas.length;
  badge.style.display = mesas.length ? '' : 'none';

  if (!mesas.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  // Preenche select de sessão
  const selectMesa = document.getElementById('sessaoMesaId');
  // guarda opção padrão e re-popula
  while (selectMesa.options.length > 1) selectMesa.remove(1);
  mesas.forEach(m => {
    const opt = document.createElement('option');
    opt.value       = m.id;
    opt.textContent = m.nome;
    selectMesa.appendChild(opt);
  });

  mesas.forEach(m => {
    const statusLabel = { ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' }[m.status] || 'Ativa';
    const card = document.createElement('div');
    card.className = 'mesa-card';
    card.innerHTML = `
      <div class="mesa-card-header">
        <div class="mesa-icon"><i class="fas fa-scroll"></i></div>
        <div style="flex:1;min-width:0;">
          <div class="mesa-card-title">${m.nome}</div>
          ${m.sistema ? `<div class="mesa-card-sistema"><i class="fas fa-dice-d6" style="font-size:0.7rem;margin-right:0.25rem;"></i>${m.sistema}</div>` : ''}
        </div>
      </div>
      ${m.desc ? `<div class="mesa-card-desc">${m.desc}</div>` : ''}
      <div class="mesa-card-footer">
        <span class="mesa-status ${m.status || 'ativa'}">${statusLabel}</span>
        <div style="display:flex;align-items:center;gap:0.75rem;">
          ${m.vagas ? `<span class="mesa-vagas"><i class="fas fa-users" style="margin-right:0.25rem;font-size:0.75rem;"></i>${m.vagas} vagas</span>` : ''}
          <div class="mesa-card-actions">
            <button class="btn-acao edit" title="Editar" onclick="editarMesa('${m.id}')"><i class="fas fa-pen"></i></button>
            <button class="btn-acao remove" title="Remover" onclick="removerMesa('${m.id}','${m.nome.replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function abrirNovaMesa() {
  mesaEditandoId = null;
  document.getElementById('modalMesaTitulo').textContent = 'Nova Mesa';
  document.getElementById('mesaNome').value    = '';
  document.getElementById('mesaSistema').value = '';
  document.getElementById('mesaStatus').value  = 'ativa';
  document.getElementById('mesaVagas').value   = '';
  document.getElementById('mesaDesc').value    = '';
  document.getElementById('err-mesaNome').textContent = '';
  document.getElementById('modalMesa').classList.remove('hidden');
}

async function editarMesa(id) {
  const snap = await getDoc(doc(db, 'mesas', id));
  if (!snap.exists()) return;
  const m = snap.data();
  mesaEditandoId = id;
  document.getElementById('modalMesaTitulo').textContent = 'Editar Mesa';
  document.getElementById('mesaNome').value    = m.nome    || '';
  document.getElementById('mesaSistema').value = m.sistema || '';
  document.getElementById('mesaStatus').value  = m.status  || 'ativa';
  document.getElementById('mesaVagas').value   = m.vagas   || '';
  document.getElementById('mesaDesc').value    = m.desc    || '';
  document.getElementById('err-mesaNome').textContent = '';
  document.getElementById('modalMesa').classList.remove('hidden');
}

async function salvarMesa() {
  const nome    = document.getElementById('mesaNome').value.trim();
  const sistema = document.getElementById('mesaSistema').value.trim();
  const status  = document.getElementById('mesaStatus').value;
  const vagas   = parseInt(document.getElementById('mesaVagas').value) || null;
  const desc    = document.getElementById('mesaDesc').value.trim();

  if (nome.length < 2) {
    document.getElementById('err-mesaNome').textContent = 'Dá um nome para a mesa.';
    return;
  }

  const dados = {
    mestreUid:   currentUser.uid,
    mestreNome:  currentUserData.nome,
    nome, sistema, status, vagas, desc
  };

  if (mesaEditandoId) {
    await updateDoc(doc(db, 'mesas', mesaEditandoId), dados);
  } else {
    await addDoc(collection(db, 'mesas'), { ...dados, criadaEm: new Date().toISOString() });
  }

  closeModal('modalMesa');
  mesaEditandoId = null;
  renderMesas();
}

function removerMesa(id, nome) {
  openConfirm(
    'Remover Mesa',
    `Remover a mesa "${nome}"? Esta ação não pode ser desfeita.`,
    'Remover',
    async () => {
      closeModal('modalConfirm');
      await deleteDoc(doc(db, 'mesas', id));
      renderMesas();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

// ═══════════════════════════════════════════════
// SESSÕES
// ═══════════════════════════════════════════════

async function renderSessoes() {
  const lista  = document.getElementById('sessoesList');
  const empty  = document.getElementById('emptySessoes');
  const badge  = document.getElementById('badgeSessoes');

  lista.querySelectorAll('.sessao-item').forEach(el => el.remove());

  const q    = query(collection(db, 'sessoes'), where('mestreUid', '==', currentUser.uid));
  const snap = await getDocs(q);
  let todas  = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // ordena por data desc
  todas.sort((a, b) => new Date(b.data) - new Date(a.data));

  const agora = new Date();
  let filtradas = todas;
  if (filtroSessoes === 'futuras')  filtradas = todas.filter(s => s.data && new Date(s.data) >= agora);
  if (filtroSessoes === 'passadas') filtradas = todas.filter(s => s.data && new Date(s.data) < agora);

  // badge mostra sessões futuras
  const futuras = todas.filter(s => s.data && new Date(s.data) >= agora);
  badge.textContent   = futuras.length;
  badge.style.display = futuras.length ? '' : 'none';

  if (!filtradas.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  filtradas.forEach(s => {
    const dataFmt = s.data
      ? new Date(s.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '—';
    const passado     = s.data && new Date(s.data) < agora;
    const formatoIcon = s.formato === 'presencial'
      ? '<i class="fas fa-map-marker-alt" title="Presencial"></i>'
      : '<i class="fas fa-wifi" title="Online"></i>';

    const div = document.createElement('div');
    div.className = 'sessao-item ficha-item';
    div.innerHTML = `
      <div class="ficha-avatar" style="background:rgba(138,99,210,0.15);color:#a374e8;border:1.5px solid #a374e8;border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">
        <i class="fas fa-dice-d20"></i>
      </div>
      <div class="ficha-info">
        <strong>${s.titulo}</strong>
        <span>${formatoIcon} ${s.formato === 'presencial' ? 'Presencial' : 'Online'} · ${s.sistema || 'Sistema não definido'} · ${dataFmt}${s.vagas ? ' · ' + s.vagas + ' vagas' : ''}</span>
        ${s.desc ? `<span style="color:var(--muted);font-size:0.82rem;margin-top:2px;display:block;">${s.desc}</span>` : ''}
      </div>
      <div class="ficha-data" style="text-align:right;white-space:nowrap;">
        ${passado
          ? '<span style="color:var(--muted);font-size:0.78rem;">Encerrada</span>'
          : '<span style="color:#2dbe6c;font-size:0.78rem;"><i class="fas fa-clock"></i> Agendada</span>'}
      </div>
      <div class="ficha-actions" style="display:flex;gap:0.4rem;">
        <button class="btn-acao edit" title="Editar" onclick="editarSessao('${s.id}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-acao remove" title="Remover" onclick="removerSessao('${s.id}','${s.titulo.replace(/'/g,"\\'")}')">
          <i class="fas fa-trash"></i>
        </button>
      </div>`;
    lista.appendChild(div);
  });
}

function filtrarSessoes(f) {
  filtroSessoes = f;
  document.querySelectorAll('.sessao-filtro-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filtro === f);
  });
  renderSessoes();
}

function abrirNovaSessao() {
  sessaoEditandoId = null;
  document.getElementById('modalSessaoTitulo').textContent = 'Nova Sessão';
  document.getElementById('sessaoTitulo').value  = '';
  document.getElementById('sessaoSistema').value = '';
  document.getElementById('sessaoData').value    = '';
  document.getElementById('sessaoVagas').value   = '';
  document.getElementById('sessaoDesc').value    = '';
  document.getElementById('sessaoMesaId').value  = '';
  document.querySelector('input[name="formato"][value="online"]').checked = true;
  document.getElementById('err-sessaoTitulo').textContent = '';
  document.getElementById('err-sessaoData').textContent   = '';
  document.getElementById('grupoSala').style.display      = 'none';
  document.getElementById('btnSalvarSessao').disabled     = false;
  document.getElementById('modalSessao').classList.remove('hidden');
}

async function editarSessao(id) {
  const snap = await getDoc(doc(db, 'sessoes', id));
  if (!snap.exists()) return;
  const s = snap.data();
  sessaoEditandoId = id;

  document.getElementById('modalSessaoTitulo').textContent = 'Editar Sessão';
  document.getElementById('sessaoTitulo').value  = s.titulo  || '';
  document.getElementById('sessaoSistema').value = s.sistema || '';
  document.getElementById('sessaoVagas').value   = s.vagas   || '';
  document.getElementById('sessaoDesc').value    = s.desc    || '';
  document.getElementById('sessaoMesaId').value  = s.mesaId  || '';

  const fmt = s.formato || 'online';
  document.querySelector(`input[name="formato"][value="${fmt}"]`).checked = true;

  if (s.data) {
    const d   = new Date(s.data);
    const pad = n => String(n).padStart(2, '0');
    document.getElementById('sessaoData').value =
      `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onFormatoChange();
  document.getElementById('btnSalvarSessao').disabled = false;
  document.getElementById('modalSessao').classList.remove('hidden');
}

function onFormatoChange() {
  const fmt   = document.querySelector('input[name="formato"]:checked')?.value;
  const grupo = document.getElementById('grupoSala');
  grupo.style.display = fmt === 'presencial' ? '' : 'none';
  if (fmt === 'presencial') verificarSala();
}

async function verificarSala() {
  const dataVal = document.getElementById('sessaoData').value;
  const info    = document.getElementById('salaInfo');
  const btn     = document.getElementById('btnSalvarSessao');

  if (!dataVal) {
    info.textContent = 'Define a data para verificar a disponibilidade da sala.';
    info.style.color = 'var(--muted)';
    return;
  }

  const dataEscolhida = new Date(dataVal);
  const resSnap = await getDocs(query(collection(db, 'reservas'), where('cancelada', '==', false)));
  const reservas = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const conflito = reservas.find(r => {
    if (sessaoEditandoId && r.sessaoId === sessaoEditandoId) return false;
    const diff = Math.abs(new Date(r.data) - dataEscolhida) / 3600000;
    return diff < 4;
  });

  if (conflito) {
    const dc = new Date(conflito.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    info.innerHTML = `<span style="color:var(--red);"><i class="fas fa-times-circle"></i> Sala ocupada — já existe uma sessão às ${dc}.</span>`;
    btn.disabled = true;
  } else {
    info.innerHTML = `<span style="color:#2dbe6c;"><i class="fas fa-check-circle"></i> Sala disponível!</span>`;
    btn.disabled = false;
  }
}

async function salvarSessao() {
  const titulo   = document.getElementById('sessaoTitulo').value.trim();
  const sistema  = document.getElementById('sessaoSistema').value.trim();
  const formato  = document.querySelector('input[name="formato"]:checked')?.value;
  const dataVal  = document.getElementById('sessaoData').value;
  const vagas    = parseInt(document.getElementById('sessaoVagas').value) || null;
  const desc     = document.getElementById('sessaoDesc').value.trim();
  const mesaId   = document.getElementById('sessaoMesaId').value || null;

  let ok = true;
  document.getElementById('err-sessaoTitulo').textContent = '';
  document.getElementById('err-sessaoData').textContent   = '';

  if (titulo.length < 2) { document.getElementById('err-sessaoTitulo').textContent = 'Dá um título para a sessão.'; ok = false; }
  if (!dataVal)           { document.getElementById('err-sessaoData').textContent   = 'Define a data e hora da sessão.'; ok = false; }
  if (!ok) return;

  const u       = currentUserData;
  const dataISO = new Date(dataVal).toISOString();
  const dadosSessao = {
    mestreUid:    currentUser.uid,
    mestreNumero: u.numero || '—',
    mestreNome:   u.nome,
    mesaId,
    titulo, sistema, formato, data: dataISO, vagas, desc
  };

  if (sessaoEditandoId) {
    await updateDoc(doc(db, 'sessoes', sessaoEditandoId), dadosSessao);

    const resSnap = await getDocs(query(
      collection(db, 'reservas'),
      where('sessaoId', '==', sessaoEditandoId),
      where('cancelada', '==', false)
    ));
    if (formato === 'presencial') {
      resSnap.forEach(async d => await updateDoc(doc(db, 'reservas', d.id), { data: dataISO }));
    } else {
      resSnap.forEach(async d => await updateDoc(doc(db, 'reservas', d.id), {
        cancelada: true,
        canceladaEm: new Date().toISOString(),
        motivoCancelamento: 'Sessão alterada para online'
      }));
    }
  } else {
    const novaRef = await addDoc(collection(db, 'sessoes'), {
      ...dadosSessao,
      criadaEm: new Date().toISOString()
    });
    if (formato === 'presencial') {
      await addDoc(collection(db, 'reservas'), {
        sessaoId:     novaRef.id,
        sessaoTitulo: titulo,
        mestreUid:    currentUser.uid,
        mestreNumero: u.numero || '—',
        mestreNome:   u.nome,
        data:         dataISO,
        cancelada:    false,
        criadaEm:     new Date().toISOString()
      });
    }
  }

  closeModal('modalSessao');
  sessaoEditandoId = null;
  document.getElementById('btnSalvarSessao').disabled = false;
  renderSessoes();
}

function removerSessao(id, titulo) {
  openConfirm(
    'Remover Sessão',
    `Remover a sessão "${titulo}"? A reserva de sala também será cancelada.`,
    'Remover',
    async () => {
      closeModal('modalConfirm');
      await deleteDoc(doc(db, 'sessoes', id));
      const resSnap = await getDocs(query(collection(db, 'reservas'), where('sessaoId', '==', id)));
      resSnap.forEach(async d => await updateDoc(doc(db, 'reservas', d.id), {
        cancelada: true,
        canceladaEm: new Date().toISOString(),
        motivoCancelamento: 'Sessão removida pelo mestre'
      }));
      renderSessoes();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

// ═══════════════════════════════════════════════
// NOTAS DE CAMPANHA
// (Guardadas em Firestore: /notas/{uid}/itens/{id})
// ═══════════════════════════════════════════════

async function renderNotas() {
  const listaEl = document.getElementById('notasListaItens');
  const badge   = document.getElementById('badgeNotas');
  listaEl.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:0.85rem;text-align:center;opacity:0.6;">A carregar...</div>';

  const q    = query(collection(db, 'notas', currentUser.uid, 'itens'));
  const snap = await getDocs(q);
  notasCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  notasCache.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  badge.textContent   = notasCache.length;
  badge.style.display = notasCache.length ? '' : 'none';

  listaEl.innerHTML = '';
  if (!notasCache.length) {
    listaEl.innerHTML = '<div style="padding:1rem 1rem;color:var(--muted);font-size:0.82rem;opacity:0.7;">Nenhuma nota ainda.</div>';
    mostrarEditorVazio();
    return;
  }

  notasCache.forEach(n => {
    const item = document.createElement('div');
    item.className = 'nota-item' + (n.id === notaAtualId ? ' active' : '');
    item.dataset.id = n.id;
    const data = n.updatedAt ? new Date(n.updatedAt).toLocaleDateString('pt-BR') : '';
    item.innerHTML = `
      <div class="nota-item-titulo">${n.titulo || 'Sem título'}</div>
      <div class="nota-item-preview">${(n.corpo || '').substring(0, 50) || '...'}</div>
      ${data ? `<div class="nota-item-data">${data}</div>` : ''}`;
    item.addEventListener('click', () => abrirNota(n.id));
    listaEl.appendChild(item);
  });

  if (notaAtualId) {
    const ainda = notasCache.find(n => n.id === notaAtualId);
    if (ainda) abrirNota(notaAtualId, false);
    else mostrarEditorVazio();
  } else {
    mostrarEditorVazio();
  }
}

function mostrarEditorVazio() {
  document.getElementById('notasEditorEmpty').style.display = '';
  document.getElementById('notasEditor').style.display = 'none';
  notaAtualId = null;
}

function abrirNota(id, focar = true) {
  const nota = notasCache.find(n => n.id === id);
  if (!nota) return;
  notaAtualId = id;

  // destaca na lista
  document.querySelectorAll('.nota-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  document.getElementById('notasEditorEmpty').style.display = 'none';
  const editor = document.getElementById('notasEditor');
  editor.style.display = 'flex';

  document.getElementById('notaTituloInput').value = nota.titulo || '';
  document.getElementById('notaCorpoArea').value   = nota.corpo  || '';

  if (focar) document.getElementById('notaCorpoArea').focus();
}

async function novaNota() {
  const novaRef = await addDoc(collection(db, 'notas', currentUser.uid, 'itens'), {
    titulo:    'Nova nota',
    corpo:     '',
    updatedAt: new Date().toISOString()
  });
  notaAtualId = novaRef.id;
  await renderNotas();
  abrirNota(novaRef.id);
  // seleciona título para editar
  const tituloInput = document.getElementById('notaTituloInput');
  tituloInput.focus();
  tituloInput.select();
}

async function salvarNotaAtual() {
  if (!notaAtualId) return;
  const titulo = document.getElementById('notaTituloInput').value.trim() || 'Sem título';
  const corpo  = document.getElementById('notaCorpoArea').value;
  const now    = new Date().toISOString();

  await setDoc(doc(db, 'notas', currentUser.uid, 'itens', notaAtualId), {
    titulo, corpo, updatedAt: now
  }, { merge: true });

  // actualiza cache sem re-fetch completo
  const idx = notasCache.findIndex(n => n.id === notaAtualId);
  if (idx >= 0) { notasCache[idx] = { ...notasCache[idx], titulo, corpo, updatedAt: now }; }

  // re-renderiza lista
  renderNotas();
}

function deletarNotaAtual() {
  if (!notaAtualId) return;
  const nota = notasCache.find(n => n.id === notaAtualId);
  openConfirm(
    'Apagar Nota',
    `Apagar a nota "${nota?.titulo || 'Sem título'}"? Esta ação não pode ser desfeita.`,
    'Apagar',
    async () => {
      closeModal('modalConfirm');
      await deleteDoc(doc(db, 'notas', currentUser.uid, 'itens', notaAtualId));
      notaAtualId = null;
      renderNotas();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

// auto-save ao sair do campo
document.getElementById('notaCorpoArea')?.addEventListener('blur', () => {
  if (notaAtualId) salvarNotaAtual();
});
document.getElementById('notaTituloInput')?.addEventListener('blur', () => {
  if (notaAtualId) salvarNotaAtual();
});

// ── MODAIS ────────────────────────────────────
function openConfirm(title, msg, btnLabel, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').textContent   = msg;
  const btn = document.getElementById('confirmBtn');
  btn.textContent = btnLabel;
  btn.className   = 'btn btn-primary';
  btn.onclick     = onConfirm;
  document.getElementById('modalConfirm').classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ═════════════════════════════════════════════════════════════
// EVENTOS (visão mestre — leitura apenas)
// ═════════════════════════════════════════════════════════════
async function renderEventosMestre() {
  const grid  = document.getElementById('eventosGridMestre');
  const empty = document.getElementById('emptyEventosMestre');
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
  } catch (err) {
    console.warn('Erro ao carregar eventos:', err);
  }
}

function doLogout(destino) {
  sessionStorage.removeItem('dc_session');
  window.location.href = destino || 'login-mestre.html';
}
window._doLogoutConta = () => doLogout('login-mestre.html');
window._doLogoutSair  = () => doLogout('index.html');

// ── EXPÕE GLOBAIS ─────────────────────────────
window.abrirNovaMesa    = abrirNovaMesa;
window.editarMesa       = editarMesa;
window.salvarMesa       = salvarMesa;
window.removerMesa      = removerMesa;
window.abrirNovaSessao  = abrirNovaSessao;
window.editarSessao     = editarSessao;
window.removerSessao    = removerSessao;
window.salvarSessao     = salvarSessao;
window.onFormatoChange  = onFormatoChange;
window.verificarSala    = verificarSala;
window.filtrarSessoes   = filtrarSessoes;
window.novaNota         = novaNota;
window.salvarNotaAtual  = salvarNotaAtual;
window.deletarNotaAtual = deletarNotaAtual;
window.adicionarSistema = adicionarSistema;
window.removerSistema   = removerSistema;
window.salvarPerfil     = salvarPerfil;
window.openConfirm      = openConfirm;
window.closeModal       = closeModal;
window.doLogout         = doLogout;
window._doLogoutSair    = window._doLogoutSair;
window._doLogoutConta   = window._doLogoutConta;
