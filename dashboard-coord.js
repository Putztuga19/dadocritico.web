/* =============================================
   DADO CRÍTICO — dashboard-coord.js (Firebase)
   ============================================= */

import { db } from "./firebase-config.js";
import {
  doc, getDoc, collection, getDocs,
  addDoc, updateDoc, deleteDoc,
  query, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentUser     = null;
let currentUserData = null;
let adesaoAtual     = null;
let filterAtivo     = 'todos';
let editTarget      = null;

// ── AUTH ──────────────────────────────────────────────────────
(async () => {
  let session;
  try { session = JSON.parse(sessionStorage.getItem('dc_session')); } catch { session = null; }
  if (!session || (session.role !== 'coord' && session.role !== 'master')) {
    window.location.href = 'login.html'; return;
  }
 const q = query(collection(db, 'users'), where('credencial', '==', session.credencial));
const result = await getDocs(q);
if (result.empty) { window.location.href = 'login.html'; return; }
const docSnap = result.docs[0];
currentUser     = { uid: docSnap.id };
currentUserData = docSnap.data();
  init();
})();

// ── INIT ──────────────────────────────────────────────────────
function init() {
  const u        = currentUserData;
  const isMaster = u.role === 'master';
  const nome     = u.nome || 'Coordenador';
  const code     = u.numero || '';

  document.getElementById('navUserName').textContent  = nome;
  document.getElementById('navUserCode').textContent  = code;
  document.getElementById('sidebarName').textContent  = nome;
  document.getElementById('sidebarCode').textContent  = code;
  document.getElementById('avatarCircle').textContent = isMaster ? '★' : nome.charAt(0).toUpperCase();

  if (isMaster) {
    ['avatarCircle','sidebarCode'].forEach(id => document.getElementById(id).style.color = 'var(--gold)');
    document.getElementById('avatarCircle').style.borderColor = 'var(--gold)';
    document.getElementById('avatarCircle').style.background  = 'rgba(201,168,76,0.15)';
    const roleEl = document.querySelector('.sidebar-role.coord');
    if (roleEl) {
      roleEl.textContent       = 'Dono · Acesso Total';
      roleEl.style.color       = 'var(--gold)';
      roleEl.style.borderColor = 'var(--gold)';
      roleEl.style.background  = 'rgba(201,168,76,0.15)';
    }
  }

  renderAdesoes();
  renderPessoas();
  renderSessoesCoord();
  renderEventos();
  renderCoordCards();

  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      document.querySelectorAll('.dash-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      document.getElementById('section-' + link.dataset.section).classList.add('active');
      if (link.dataset.section === 'sessoes') renderSessoesCoord();
      if (link.dataset.section === 'eventos') renderEventos();
      if (link.dataset.section === 'coordenadores') renderCoordCards();
    });
  });
}

// ═════════════════════════════════════════════════════════════
// PEDIDOS DE ADESÃO
// ═════════════════════════════════════════════════════════════
async function renderAdesoes() {
  const lista = document.getElementById('adesoesList');
  const empty = document.getElementById('emptyAdesoes');
  const badge = document.getElementById('badgeAdesoes');

  const snap    = await getDocs(query(collection(db, "adesoes"), where("status", "==", "pendente")));
  const adesoes = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  document.getElementById('countAdesoes').textContent =
    adesoes.length + ' pedido' + (adesoes.length !== 1 ? 's' : '') + ' aguardando';
  badge.textContent   = adesoes.length;
  badge.style.display = adesoes.length ? '' : 'none';

  lista.querySelectorAll('.ficha-item').forEach(el => el.remove());
  if (!adesoes.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  adesoes.forEach(a => {
    const data = new Date(a.dataEnvio).toLocaleDateString('pt-BR');
    const div  = document.createElement('div');
    div.className = 'ficha-item';
    div.innerHTML = `
      <div class="ficha-avatar">${a.nome.charAt(0)}</div>
      <div class="ficha-info"><strong>${a.nome}</strong><span>${a.email}</span></div>
      <div class="ficha-data">Enviado em<br>${data}</div>
      <div class="ficha-actions">
        <button class="btn-ver" onclick="verAdesao('${a.id}')">
          <i class="fas fa-eye"></i> Ver
        </button>
      </div>`;
    lista.appendChild(div);
  });
}

async function verAdesao(id) {
  const snap = await getDoc(doc(db, "adesoes", id));
  if (!snap.exists()) return;
  adesaoAtual = { id, ...snap.data() };

  const nasc = adesaoAtual.nascimento
    ? new Date(adesaoAtual.nascimento).toLocaleDateString('pt-BR')
    : '—';
  const idade = adesaoAtual.nascimento ? calcIdade(adesaoAtual.nascimento) : '?';

  document.getElementById('modalAdesaoBody').innerHTML = `
    <div class="modal-field"><label>Nome Completo</label><p>${adesaoAtual.nome}</p></div>
    <div class="modal-field"><label>E-mail</label><p>${adesaoAtual.email}</p></div>
    <div class="modal-field"><label>Data de Nascimento</label><p>${nasc} (${idade} anos)</p></div>
    <div class="modal-field"><label>Apelido no Clube</label><p>${adesaoAtual.apelido || '—'}</p></div>
    <div class="modal-field"><label>Como soube do clube</label><p>${adesaoAtual.origem || '—'}</p></div>
    <div class="modal-field"><label>Aceita novidades</label><p>${adesaoAtual.novidades ? 'Sim' : 'Não'}</p></div>
    <div class="modal-field"><label>Data de Envio</label><p>${new Date(adesaoAtual.dataEnvio).toLocaleDateString('pt-BR')}</p></div>
    ${adesaoAtual.status === 'aprovado' ? '<div class="modal-field" style="background:rgba(45,190,108,0.07);border:1px solid rgba(45,190,108,0.2);border-radius:8px;padding:0.75rem 1rem;margin-top:0.5rem;"><label style=\"color:#2dbe6c;\">✅ Aprovado</label><p>Credencial: <strong>' + (adesaoAtual.numero || '—') + '</strong></p><p>Senha provisória: <strong>' + (adesaoAtual.senhaProvisoria || '—') + '</strong></p></div>' : ''}
    ${adesaoAtual.status === 'recusado' ? '<div class="modal-field" style="background:rgba(221,30,42,0.07);border:1px solid rgba(221,30,42,0.2);border-radius:8px;padding:0.75rem 1rem;margin-top:0.5rem;"><label style=\"color:var(--red);\">❌ Recusado</label></div>' : ''}
  `;
  document.getElementById('modalAdesao').classList.remove('hidden');
}

function decidirAdesao(decisao) {
  if (!adesaoAtual) return;
  closeModal('modalAdesao');
  openConfirm(
    decisao === 'aprovar' ? 'Aprovar Membro' : 'Recusar Pedido',
    decisao === 'aprovar'
      ? `Aprovar o pedido de ${adesaoAtual.nome}? Será gerado um cartão de membro.`
      : `Recusar o pedido de ${adesaoAtual.nome}?`,
    decisao === 'aprovar' ? 'Aprovar' : 'Recusar',
    () => confirmarDecisao(decisao)
  );
}

async function confirmarDecisao(decisao) {
  closeModal('modalConfirm');

  if (decisao === 'aprovar') {
    // Gera número DC-MB-XXX
    const membrosSnap = await getDocs(query(
      collection(db, 'users'),
      where('role', 'in', ['member', 'mestre'])
    ));
    const numero = 'DC-MB-' + String(membrosSnap.size + 1).padStart(3, '0');

    // Gera senha provisória = primeiros 4 chars do nome + ano atual
    const senhaProvisoria = (adesaoAtual.nome.replace(/\s/g,'').substring(0,4) + new Date().getFullYear()).toLowerCase();
    const senhaHash = await hashSenha(senhaProvisoria);

    // Cria o utilizador em users
    await addDoc(collection(db, 'users'), {
      credencial:     numero,
      nome:           adesaoAtual.nome,
      apelido:        adesaoAtual.apelido || '',
      email:          adesaoAtual.email   || '',
      role:           'member',
      senhaHash,
      primeiroAcesso: true,
      entrada:        new Date().toISOString().split('T')[0],
      criadoEm:       new Date().toISOString()
    });

    // Marca adesão como aprovada e guarda credencial gerada
    await updateDoc(doc(db, 'adesoes', adesaoAtual.id), {
      status:    'aprovado',
      numero,
      senhaProvisoria,
      aprovadoEm: new Date().toISOString()
    });

    // Mostra credencial ao coordenador
    openConfirm(
      '✅ Membro aprovado!',
      `Credencial: ${numero}\nSenha provisória: ${senhaProvisoria}\n\nAnota e entrega ao membro. Ele terá de trocar a senha no primeiro acesso.`,
      'OK',
      () => closeModal('modalConfirm')
    );

  } else {
    await updateDoc(doc(db, 'adesoes', adesaoAtual.id), {
      status:    'recusado',
      recusadoEm: new Date().toISOString()
    });
  }

  adesaoAtual = null;
  renderAdesoes();
  renderPessoas();
}

// Hash SHA-256 (igual ao login)
async function hashSenha(senha) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(senha));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// ═════════════════════════════════════════════════════════════
// MEMBROS E COORDENADORES
// ═════════════════════════════════════════════════════════════
async function renderPessoas() {
  const tbody = document.getElementById('pessoasBody');
  const empty = document.getElementById('emptyPessoas');
  const query_ = (document.getElementById('searchPessoas')?.value || '').toLowerCase();
  tbody.innerHTML = '';

  const snap   = await getDocs(collection(db, "users"));
  let pessoas  = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(p => p.role !== 'master' || p.uid === currentUser.uid)
    .filter(p => p.role !== 'removed' && p.status !== 'removido'); // ← excluir removidos

  if (filterAtivo === 'membro')  pessoas = pessoas.filter(p => p.role === 'member');
  else if (filterAtivo === 'mestre') pessoas = pessoas.filter(p => p.role === 'mestre');
  else if (filterAtivo === 'coord')  pessoas = pessoas.filter(p => p.role === 'coord');

  if (query_) pessoas = pessoas.filter(p =>
    (p.nome || '').toLowerCase().includes(query_) ||
    (p.email || '').toLowerCase().includes(query_) ||
    (p.numero || '').toLowerCase().includes(query_)
  );

  if (!pessoas.length) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  pessoas.forEach(p => {
    const entrada  = p.entrada ? new Date(p.entrada).toLocaleDateString('pt-BR') : '—';
    const isCoord  = p.role === 'coord' || p.role === 'master';
    const isMestre = p.role === 'mestre';
    const isSelf   = p.uid === currentUser.uid;
    const canEdit  = !isSelf || currentUserData.role === 'master';

    let tipoPill, idColor;
    if (isCoord) {
      tipoPill = `<span class="role-pill coord"><i class="fas fa-shield-alt"></i> Coordenador</span>`;
      idColor  = 'var(--gold)';
    } else if (isMestre) {
      tipoPill = `<span class="role-pill mestre"><i class="fas fa-hat-wizard"></i> Mestre</span>`;
      idColor  = '#a374e8';
    } else {
      tipoPill = `<span class="role-pill membro"><i class="fas fa-user"></i> Membro</span>`;
      idColor  = 'var(--red)';
    }

    // Garante que o prefixo do ID está correto por role
    let idExibido = p.numero || '—';
    if (p.numero) {
      if (isCoord && !p.numero.startsWith('DC-C-'))        idExibido = p.numero;
      else if (isMestre && !p.numero.startsWith('DC-MT-')) idExibido = p.numero;
      else if (!isCoord && !isMestre && !p.numero.startsWith('DC-MB-')) idExibido = p.numero;
    }

    const btnPromover = !isCoord && canEdit ? `
      <button class="btn-acao ${isMestre ? 'rebaixar' : 'promover'}" title="${isMestre ? 'Rebaixar a Membro' : 'Promover a Mestre'}"
        onclick="toggleMestre('${p.uid}','${p.role}','${p.nome}')">
        <i class="fas fa-${isMestre ? 'user-minus' : 'hat-wizard'}"></i>
      </button>` : '';

    const tr = document.createElement('tr');
    const avatarHtml = p.avatarUrl
      ? `<img src="${p.avatarUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:1.5px solid ${idColor};" />`
      : `<div style="width:32px;height:32px;border-radius:50%;background:${isCoord ? 'rgba(201,168,76,0.15)' : isMestre ? 'rgba(163,116,232,0.15)' : 'rgba(200,60,60,0.1)'};border:1.5px solid ${idColor};display:flex;align-items:center;justify-content:center;font-family:var(--font-h);font-size:0.75rem;font-weight:700;color:${idColor};">${(p.apelido || p.nome || '?').charAt(0).toUpperCase()}</div>`;

    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:0.6rem;">
          ${avatarHtml}
          <div>
            <div style="font-weight:600;font-size:0.9rem;color:var(--white);">${p.apelido || p.nome || '—'}</div>
            ${p.apelido ? `<div style="font-size:0.75rem;color:var(--muted);">${p.nome || ''}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-family:var(--font-h);font-size:0.78rem;color:${idColor};letter-spacing:0.05em;">${idExibido}</td>
      <td>${tipoPill}</td>
      <td style="color:var(--muted);font-size:0.88rem;">${entrada}</td>
      <td><span class="status-pill ${p.status === 'inativo' ? 'pendente' : p.status === 'suspenso' ? 'recusado' : 'ativo'}">${p.status === 'inativo' ? 'Inativo' : p.status === 'suspenso' ? 'Suspenso' : 'Ativo'}</span></td>
      <td>
        <div style="display:flex;gap:0.4rem;">
          <button class="btn-acao" title="Ver Informações" onclick="verInfoMembro('${p.uid}')" style="color:var(--gold);border-color:var(--gold);">
            <i class="fas fa-info-circle"></i>
          </button>
          ${canEdit ? `
            ${btnPromover}
            <button class="btn-acao edit" title="Editar" onclick="abrirEdicao('${p.uid}')">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn-acao remove" title="Remover" onclick="abrirRemocao('${p.uid}','${p.nome}')">
              <i class="fas fa-trash"></i>
            </button>` : ''}
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
}

function filterPessoas() { renderPessoas(); }
function setFilter(btn) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  filterAtivo = btn.dataset.filter;
  renderPessoas();
}

// ═════════════════════════════════════════════════════════════
// PROMOVER / REBAIXAR MESTRE
// ═════════════════════════════════════════════════════════════
function toggleMestre(uid, roleAtual, nome) {
  const promovendo = roleAtual === 'member';
  openConfirm(
    promovendo ? 'Promover a Mestre' : 'Rebaixar a Membro',
    promovendo
      ? `Promover ${nome} ao cargo de Mestre?`
      : `Rebaixar ${nome} de Mestre para Membro comum?`,
    promovendo ? 'Promover' : 'Rebaixar',
    async () => {
      closeModal('modalConfirm');
      await updateDoc(doc(db, "users", uid), {
        role: promovendo ? 'mestre' : 'member'
      });
      renderPessoas();
    }
  );
  document.getElementById('confirmBtn').className = promovendo ? 'btn btn-primary' : 'btn btn-recusar';
}

// ═════════════════════════════════════════════════════════════
// EDITAR PESSOA
// ═════════════════════════════════════════════════════════════
async function abrirEdicao(uid) {
  editTarget = uid;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return;
  const p = snap.data();

  document.getElementById('editNome').value      = p.nome       || '';
  document.getElementById('editApelido').value   = p.apelido    || '';
  document.getElementById('editEmail').value     = p.email      || '';
  document.getElementById('editCredencial').value= p.numero     || '';
  document.getElementById('editNascimento').value= p.nascimento || '';
  document.getElementById('editStatus').value    = p.status     || 'ativo';
  document.getElementById('editSenha').value     = '';
  document.getElementById('editNotas').value     = p.notasInternas || '';
  document.getElementById('editId').textContent  = p.numero || uid;
  document.getElementById('editTipo').textContent= '· ' + (p.role || '');
  document.getElementById('editEntrada').textContent = p.entrada ? '· Entrada: ' + new Date(p.entrada).toLocaleDateString('pt-BR') : '';
  ['err-editNome','err-editEmail','err-editCredencial'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=''; });

  // Carregar histórico de sessões
  const histEl = document.getElementById('editSessoesHistorico');
  histEl.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">A carregar...</span>';
  try {
    const sesSnap = await getDocs(query(collection(db, 'sessoes'), where('participantes', 'array-contains', uid)));
    const sessoes = sesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => new Date(b.data) - new Date(a.data));
    if (!sessoes.length) {
      histEl.innerHTML = '<span style="color:var(--muted);font-size:0.85rem;">Sem sessões registadas.</span>';
    } else {
      histEl.innerHTML = sessoes.map(s => {
        const df = new Date(s.data).toLocaleDateString('pt-BR');
        return `<div style="display:flex;align-items:center;gap:0.6rem;padding:0.4rem 0;border-bottom:1px solid var(--border);">
          <i class="fas fa-dice-d20" style="color:#a374e8;font-size:0.75rem;flex-shrink:0;"></i>
          <div>
            <div style="font-size:0.85rem;color:var(--white);">${s.titulo || '—'}</div>
            <div style="font-size:0.75rem;color:var(--muted);">${df} · ${s.sistema || '—'} · ${s.mestreNome || '—'}</div>
          </div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    histEl.innerHTML = '<span style="color:var(--muted);font-size:0.82rem;">Não foi possível carregar o histórico.</span>';
  }

  document.getElementById('modalEditar').classList.remove('hidden');
}

async function guardarEdicao() {
  if (!editTarget) return;
  const nome        = document.getElementById('editNome').value.trim();
  const apelido     = document.getElementById('editApelido').value.trim();
  const email       = document.getElementById('editEmail').value.trim();
  const credencial  = document.getElementById('editCredencial').value.trim();
  const nascimento  = document.getElementById('editNascimento').value;
  const status      = document.getElementById('editStatus').value;
  const senha       = document.getElementById('editSenha').value.trim();
  const notas       = document.getElementById('editNotas').value.trim();
  let ok = true;

  ['err-editNome','err-editEmail','err-editCredencial'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=''; });

  if (nome.length < 2) { document.getElementById('err-editNome').textContent = 'Nome inválido.'; ok = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-editEmail').textContent = 'E-mail inválido.'; ok = false;
  }
  if (credencial.length < 3) { document.getElementById('err-editCredencial').textContent = 'Credencial inválida.'; ok = false; }
  if (!ok) return;

  const updates = { nome, apelido, email, credencial, numero: credencial, nascimento, status, notasInternas: notas };
  if (senha.length >= 4) {
    updates.senhaHash = await hashSenha(senha);
    updates.primeiroAcesso = true;
  }

  await updateDoc(doc(db, "users", editTarget), updates);
  closeModal('modalEditar');
  editTarget = null;
  renderPessoas();
}

// ═════════════════════════════════════════════════════════════
// REMOVER PESSOA
// ═════════════════════════════════════════════════════════════
function removerTodosMembros() {
  openConfirm(
    'Remover todos os membros',
    'Tens a certeza? Esta ação vai remover TODOS os membros e mestres da lista. Coordenadores não serão afetados. Esta ação não pode ser desfeita.',
    'Remover todos',
    async () => {
      closeModal('modalConfirm');
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('role', 'in', ['member', 'mestre'])
      ));
      const batch = snap.docs.map(d =>
        updateDoc(doc(db, 'users', d.id), { status: 'removido', role: 'removed' })
      );
      await Promise.all(batch);
      renderPessoas();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}
  openConfirm(
    'Remover Membro',
    `Tens a certeza que queres remover ${nome}? Esta ação não pode ser desfeita.`,
    'Remover',
    async () => {
      closeModal('modalConfirm');
      await updateDoc(doc(db, "users", uid), { status: 'removido', role: 'removed' });
      renderPessoas();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

// ═════════════════════════════════════════════════════════════
// SESSÕES E SALA (visão da coordenação)
// ═════════════════════════════════════════════════════════════
async function renderSessoesCoord() {
  const resSnap = await getDocs(query(collection(db, "reservas"), where("cancelada", "==", false)));
  const reservas = resSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const sesSnap = await getDocs(collection(db, "sessoes"));
  const sessoes = sesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const badge = document.getElementById('badgeReservas');
  const reservasAtivas = reservas
    .filter(r => new Date(r.data) > new Date())
    .sort((a, b) => new Date(a.data) - new Date(b.data));

  if (badge) {
    badge.textContent   = reservasAtivas.length;
    badge.style.display = reservasAtivas.length ? '' : 'none';
  }

  // Status da sala
  const salaEl = document.getElementById('coordSalaStatus');
  if (salaEl) {
    if (!reservasAtivas.length) {
      salaEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.2rem;background:rgba(45,190,108,0.07);border:1px solid rgba(45,190,108,0.25);border-radius:var(--radius);max-width:520px;">
          <i class="fas fa-door-open" style="color:#2dbe6c;font-size:1.3rem;"></i>
          <div><strong style="color:#2dbe6c;">Sala disponível</strong>
          <p style="color:var(--muted);font-size:0.85rem;margin-top:0.15rem;">Sem reservas ativas.</p></div>
        </div>`;
    } else {
      const prox = reservasAtivas[0];
      const df   = new Date(prox.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      salaEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.2rem;background:rgba(221,30,42,0.07);border:1px solid rgba(221,30,42,0.25);border-radius:var(--radius);max-width:520px;">
          <i class="fas fa-door-closed" style="color:var(--red);font-size:1.3rem;"></i>
          <div><strong style="color:var(--red);">Sala ocupada em breve</strong>
          <p style="color:var(--muted);font-size:0.85rem;margin-top:0.15rem;">Próxima reserva: <strong style="color:var(--white);">${prox.sessaoTitulo}</strong> — ${df} · Mestre: ${prox.mestreNome}</p></div>
        </div>`;
    }
  }

  // Lista de reservas ativas
  const reservasEl = document.getElementById('coordReservasList');
  if (reservasEl) {
    if (!reservasAtivas.length) {
      reservasEl.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;padding:1rem 1.2rem;">Sem reservas ativas.</div>';
    } else {
      reservasEl.innerHTML = '';
      reservasAtivas.forEach(r => {
        const df  = new Date(r.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1.2rem;border-bottom:1px solid var(--border);';
        div.innerHTML = `
          <i class="fas fa-calendar-alt" style="color:#a374e8;flex-shrink:0;"></i>
          <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--white);">${r.sessaoTitulo}</div>
            <div style="font-size:0.8rem;color:var(--muted);">${df} · Mestre: ${r.mestreNome} (${r.mestreNumero})</div>
          </div>
          <button class="btn-acao remove" title="Cancelar reserva" onclick="cancelarReservaCoord('${r.id}','${r.sessaoTitulo.replace(/'/g,"\\'")}')">
            <i class="fas fa-ban"></i>
          </button>`;
        reservasEl.appendChild(div);
      });
    }
  }

  // Lista de todas as sessões
  const sessoesEl = document.getElementById('coordSessoesList');
  if (sessoesEl) {
    const futuras = sessoes
      .filter(s => new Date(s.data) > new Date())
      .sort((a, b) => new Date(a.data) - new Date(b.data));
    if (!futuras.length) {
      sessoesEl.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;padding:1rem 1.2rem;">Nenhuma sessão agendada.</div>';
    } else {
      sessoesEl.innerHTML = '';
      futuras.forEach(s => {
        const df      = new Date(s.data).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
        const fmtIcon = s.formato === 'presencial' ? '<i class="fas fa-map-marker-alt" title="Presencial"></i>' : '<i class="fas fa-wifi" title="Online"></i>';
        const reserva = reservas.find(r => r.sessaoId === s.id);
        const salaTag = s.formato === 'presencial'
          ? (reserva ? '<span style="color:#2dbe6c;font-size:0.78rem;"><i class="fas fa-door-open"></i> Sala reservada</span>'
                     : '<span style="color:var(--red);font-size:0.78rem;"><i class="fas fa-door-open"></i> Sem reserva</span>')
          : '';
        const div = document.createElement('div');
        div.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.75rem 1.2rem;border-bottom:1px solid var(--border);';
        div.innerHTML = `
          <i class="fas fa-dice-d20" style="color:#a374e8;flex-shrink:0;"></i>
          <div style="flex:1;">
            <div style="font-size:0.9rem;color:var(--white);">${s.titulo} ${fmtIcon}</div>
            <div style="font-size:0.8rem;color:var(--muted);">${df} · ${s.sistema || '—'} · Mestre: ${s.mestreNome} (${s.mestreNumero})</div>
            ${salaTag ? `<div style="margin-top:2px;">${salaTag}</div>` : ''}
          </div>`;
        sessoesEl.appendChild(div);
      });
    }
  }
}

async function cancelarReservaCoord(reservaId, titulo) {
  openConfirm(
    'Cancelar Reserva de Sala',
    `Cancelar a reserva da sala para "${titulo}"?`,
    'Cancelar Reserva',
    async () => {
      closeModal('modalConfirm');
      await updateDoc(doc(db, "reservas", reservaId), {
        cancelada: true,
        canceladaEm: new Date().toISOString(),
        motivoCancelamento: 'Cancelada pela coordenação'
      });
      renderSessoesCoord();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

// ── MODAIS ────────────────────────────────────────────────────
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

function calcIdade(nasc) {
  const hoje = new Date(), dn = new Date(nasc);
  let age = hoje.getFullYear() - dn.getFullYear();
  const m = hoje.getMonth() - dn.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) age--;
  return age;
}

function doLogout(destino) {
  sessionStorage.removeItem('dc_session');
  window.location.href = destino || 'login.html';
}
window._doLogoutConta = () => doLogout('login.html');
window._doLogoutSair  = () => doLogout('index.html');

// ── EXPÕE GLOBAIS ─────────────────────────────────────────────
window.verAdesao           = verAdesao;
window.decidirAdesao       = decidirAdesao;
window.filterPessoas       = filterPessoas;
window.setFilter           = setFilter;
window.toggleMestre        = toggleMestre;
window.abrirEdicao         = abrirEdicao;
window.guardarEdicao       = guardarEdicao;
window.abrirRemocao        = abrirRemocao;
window.removerTodosMembros = removerTodosMembros;
window.cancelarReservaCoord = cancelarReservaCoord;

// ═════════════════════════════════════════════════════════════
// VER INFORMAÇÕES DE MEMBRO
// ═════════════════════════════════════════════════════════════
async function verInfoMembro(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const p = snap.data();

  const entrada = p.entrada ? new Date(p.entrada).toLocaleDateString('pt-BR') : '—';
  const nascimento = p.nascimento ? new Date(p.nascimento).toLocaleDateString('pt-BR') : '—';
  const roleLabel = p.role === 'coord' ? 'Coordenador' : p.role === 'mestre' ? 'Mestre' : p.role === 'master' ? 'Dono' : 'Membro';
  const statusLabel = p.status === 'inativo' ? 'Inativo' : p.status === 'suspenso' ? 'Suspenso' : 'Ativo';

  const avatarHtml = p.avatarUrl
    ? `<img src="${p.avatarUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);" />`
    : `<div style="width:72px;height:72px;border-radius:50%;background:rgba(201,168,76,0.1);border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-family:var(--font-h);font-size:1.6rem;font-weight:700;color:var(--gold);">${(p.apelido || p.nome || '?').charAt(0).toUpperCase()}</div>`;

  document.getElementById('modalInfoBody').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;margin-bottom:1.2rem;">
      ${avatarHtml}
      <div style="font-family:var(--font-h);font-size:1rem;font-weight:700;color:var(--white);">${p.apelido || p.nome || '—'}</div>
      ${p.apelido ? `<div style="font-size:0.85rem;color:var(--muted);">${p.nome}</div>` : ''}
      <span style="font-family:var(--font-h);font-size:0.65rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.2rem 0.75rem;border-radius:99px;background:rgba(201,168,76,0.1);color:var(--gold);border:1px solid rgba(201,168,76,0.3);">${roleLabel}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
      <div class="modal-field"><label>Nº de ID</label><p style="font-family:var(--font-h);color:var(--gold);">${p.numero || '—'}</p></div>
      <div class="modal-field"><label>Status</label><p>${statusLabel}</p></div>
      <div class="modal-field"><label>E-mail</label><p>${p.email || '—'}</p></div>
      <div class="modal-field"><label>Data de Nascimento</label><p>${nascimento}</p></div>
      <div class="modal-field"><label>Data de Entrada</label><p>${entrada}</p></div>
      <div class="modal-field"><label>Apelido no Clube</label><p>${p.apelido || '—'}</p></div>
      ${p.bio ? `<div class="modal-field" style="grid-column:1/-1;"><label>Bio</label><p style="font-style:italic;">${p.bio}</p></div>` : ''}
      ${p.sistemas && p.sistemas.length ? `<div class="modal-field" style="grid-column:1/-1;"><label>Sistemas</label><p>${p.sistemas.join(', ')}</p></div>` : ''}
      ${p.notasInternas ? `<div class="modal-field" style="grid-column:1/-1;"><label>Notas Internas</label><p style="color:var(--muted);font-style:italic;">${p.notasInternas}</p></div>` : ''}
    </div>`;

  document.getElementById('modalInfo').classList.remove('hidden');
}
window.verInfoMembro = verInfoMembro;

// ═════════════════════════════════════════════════════════════
// EVENTOS
// ═════════════════════════════════════════════════════════════
let eventoEditandoId = null;

async function renderEventos() {
  const lista = document.getElementById('eventosList');
  const empty = document.getElementById('emptyEventos');
  const badge = document.getElementById('badgeEventos');
  if (!lista) return;

  lista.querySelectorAll('.evento-item').forEach(el => el.remove());

  const snap = await getDocs(collection(db, 'eventos'));
  if (badge) { badge.textContent = snap.size; badge.style.display = snap.size ? '' : 'none'; }

  if (snap.empty) { empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');

  const eventos = [];
  snap.forEach(d => eventos.push({ id: d.id, ...d.data() }));
  eventos.sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  eventos.forEach(ev => {
    const div = document.createElement('div');
    div.className = 'evento-item ficha-item';
    div.innerHTML = `
      <div class="ficha-avatar" style="background:rgba(201,168,76,0.12);color:var(--gold);border:1.5px solid var(--gold);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;font-size:0.95rem;flex-shrink:0;">
        ${ev.tipo === 'especial' ? '<i class="fas fa-star"></i>' : '<i class="fas fa-calendar-alt"></i>'}
      </div>
      <div class="ficha-info" style="flex:1;">
        <strong>${ev.titulo}</strong>
        <span>${ev.horario || '—'}${ev.local ? ' · ' + ev.local : ''}</span>
        ${ev.desc ? `<span style="color:var(--muted);font-size:0.82rem;">${ev.desc}</span>` : ''}
      </div>
      <span class="role-pill ${ev.tipo === 'especial' ? 'mestre' : 'membro'}" style="flex-shrink:0;">${ev.tipo === 'especial' ? 'Especial' : 'Regular'}</span>
      <div class="ficha-actions" style="display:flex;gap:0.4rem;">
        <button class="btn-acao edit" title="Editar" onclick="editarEvento('${ev.id}')"><i class="fas fa-pen"></i></button>
        <button class="btn-acao remove" title="Remover" onclick="removerEvento('${ev.id}','${ev.titulo.replace(/'/g,"\'")}')"><i class="fas fa-trash"></i></button>
      </div>`;
    lista.appendChild(div);
  });
}

function abrirNovoEvento() {
  eventoEditandoId = null;
  document.getElementById('modalEventoTitulo').textContent = 'Novo Evento';
  ['eventoTitulo','eventoDia','eventoHorario','eventoLocal','eventoDesc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('eventoTipo').value = 'regular';
  document.getElementById('err-eventoTitulo').textContent = '';
  document.getElementById('modalEvento').classList.remove('hidden');
}

async function editarEvento(id) {
  const snap = await getDocs(collection(db, 'eventos'));
  snap.forEach(d => {
    if (d.id !== id) return;
    const ev = d.data();
    eventoEditandoId = id;
    document.getElementById('modalEventoTitulo').textContent = 'Editar Evento';
    document.getElementById('eventoTitulo').value  = ev.titulo  || '';
    document.getElementById('eventoDia').value     = ev.dia     || '';
    document.getElementById('eventoHorario').value = ev.horario || '';
    document.getElementById('eventoLocal').value   = ev.local   || '';
    document.getElementById('eventoDesc').value    = ev.desc    || '';
    document.getElementById('eventoTipo').value    = ev.tipo    || 'regular';
    document.getElementById('err-eventoTitulo').textContent = '';
    document.getElementById('modalEvento').classList.remove('hidden');
  });
}

async function salvarEvento() {
  const titulo  = document.getElementById('eventoTitulo').value.trim();
  const dia     = document.getElementById('eventoDia').value.trim();
  const horario = document.getElementById('eventoHorario').value.trim();
  const local   = document.getElementById('eventoLocal').value.trim();
  const desc    = document.getElementById('eventoDesc').value.trim();
  const tipo    = document.getElementById('eventoTipo').value;

  if (!titulo) { document.getElementById('err-eventoTitulo').textContent = 'Dá um título ao evento.'; return; }
  document.getElementById('err-eventoTitulo').textContent = '';

  const btn = document.getElementById('btnSalvarEvento');
  btn.disabled = true;

  try {
    const data = { titulo, dia, horario, local, desc, tipo, updatedAt: new Date().toISOString() };
    if (eventoEditandoId) {
      await updateDoc(doc(db, 'eventos', eventoEditandoId), data);
    } else {
      data.criadoEm = new Date().toISOString();
      data.ordem    = Date.now();
      await addDoc(collection(db, 'eventos'), data);
    }
    closeModal('modalEvento');
    eventoEditandoId = null;
    renderEventos();
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

function removerEvento(id, titulo) {
  openConfirm(
    'Remover Evento',
    `Remover o evento "${titulo}"? Deixará de aparecer no painel dos membros.`,
    'Remover',
    async () => {
      closeModal('modalConfirm');
      await deleteDoc(doc(db, 'eventos', id));
      renderEventos();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

window.abrirNovoEvento      = abrirNovoEvento;
window.editarEvento         = editarEvento;
window.salvarEvento         = salvarEvento;
window.removerEvento        = removerEvento;
window.openConfirm         = openConfirm;
window.closeModal          = closeModal;
window.doLogout            = doLogout;
window._doLogoutSair       = window._doLogoutSair;
window._doLogoutConta      = window._doLogoutConta;

// ═════════════════════════════════════════════════════════════
// COORDENADORES — CARDS + MODAL DE CRIAÇÃO
// ═════════════════════════════════════════════════════════════

async function renderCoordCards() {
  const grid  = document.getElementById('coordCardsGrid');
  const empty = document.getElementById('emptyCoordCards');
  if (!grid) return;

  // Remove cards antigos
  grid.querySelectorAll('.coord-card').forEach(el => el.remove());

  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'coord')));
  const coords = snap.docs.map(d => ({ uid: d.id, ...d.data() }));

  if (!coords.length) { empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');

  coords.forEach(c => {
    const initials = (c.nome || 'C').split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const card = document.createElement('div');
    card.className = 'coord-card';
    card.innerHTML = `
      <div class="coord-card-avatar">${initials}</div>
      <div class="coord-card-info">
        <div class="coord-card-name">${c.nome || '—'}</div>
        ${c.apelido ? `<div class="coord-card-apelido">${c.apelido}</div>` : ''}
        <div class="coord-card-cred"><i class="fas fa-key"></i> ${c.numero || '—'}</div>
        ${c.email ? `<div class="coord-card-email"><i class="fas fa-envelope"></i> ${c.email}</div>` : ''}
        ${c.notasInternas ? `<div class="coord-card-notas"><i class="fas fa-sticky-note"></i> ${c.notasInternas}</div>` : ''}
      </div>
      <div class="coord-card-actions">
        <button class="btn-acao edit" title="Editar" onclick="abrirEdicaoCoord('${c.uid}')"><i class="fas fa-pen"></i></button>
        <button class="btn-acao remove" title="Remover coordenador" onclick="removerCoord('${c.uid}','${(c.nome||'').replace(/'/g,"\\'")}')"><i class="fas fa-trash"></i></button>
      </div>`;
    grid.appendChild(card);
  });
}

function abrirModalNovoCoord() {
  ['ncNome','ncApelido','ncEmail','ncSenhaManual','ncNotas'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.querySelectorAll('input[name="ncSenhaTipo"]').forEach(r => { r.checked = r.value === 'auto'; });
  document.getElementById('ncSenhaManualWrap').style.display = 'none';
  document.getElementById('novoCoordPreviewCode').textContent = 'DC-C-—';
  document.getElementById('ncSenhaAutoPreview').textContent = '';
  ['err-ncNome','err-ncEmail','err-ncSenha'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent=''; });
  // highlight selected radio style
  atualizarEstiloRadioSenha();
  document.getElementById('modalNovoCoord').classList.remove('hidden');
}

function toggleSenhaTipo() {
  const isManual = document.querySelector('input[name="ncSenhaTipo"]:checked')?.value === 'manual';
  document.getElementById('ncSenhaManualWrap').style.display = isManual ? '' : 'none';
  document.getElementById('ncSenhaAutoPreview').style.display = isManual ? 'none' : '';
  atualizarEstiloRadioSenha();
  if (!isManual) previewCoordCode();
}

function atualizarEstiloRadioSenha() {
  const isManual = document.querySelector('input[name="ncSenhaTipo"]:checked')?.value === 'manual';
  const optAuto   = document.getElementById('optSenhaAuto');
  const optManual = document.getElementById('optSenhaManual');
  if (optAuto)   { optAuto.style.borderColor   = isManual ? 'var(--border)' : 'var(--gold)'; optAuto.style.background   = isManual ? '' : 'rgba(201,168,76,0.07)'; }
  if (optManual) { optManual.style.borderColor = isManual ? 'var(--gold)' : 'var(--border)'; optManual.style.background = isManual ? 'rgba(201,168,76,0.07)' : ''; }
}

async function previewCoordCode() {
  const snap  = await getDocs(query(collection(db, 'users'), where('role', 'in', ['coord'])));
  const count = snap.size + 1;
  const code  = 'DC-C-' + String(count).padStart(3, '0');
  document.getElementById('novoCoordPreviewCode').textContent = code;

  // Auto senha preview
  const nome = document.getElementById('ncNome').value.trim();
  if (nome && document.querySelector('input[name="ncSenhaTipo"]:checked')?.value === 'auto') {
    const senhaAuto = (nome.replace(/\s/g,'').substring(0,4) + new Date().getFullYear()).toLowerCase();
    document.getElementById('ncSenhaAutoPreview').innerHTML = `<i class="fas fa-info-circle" style="margin-right:0.3rem;"></i>Senha gerada: <strong style="color:var(--white);font-family:var(--font-h);">${senhaAuto}</strong>`;
  } else {
    document.getElementById('ncSenhaAutoPreview').textContent = '';
  }
}

async function criarCoord() {
  const nome   = document.getElementById('ncNome').value.trim();
  const apelido= document.getElementById('ncApelido').value.trim();
  const email  = document.getElementById('ncEmail').value.trim();
  const notas  = document.getElementById('ncNotas').value.trim();
  const tipoSenha = document.querySelector('input[name="ncSenhaTipo"]:checked')?.value || 'auto';
  const senhaManual = document.getElementById('ncSenhaManual').value.trim();

  let ok = true;
  ['err-ncNome','err-ncEmail','err-ncSenha'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=''; });

  if (nome.length < 2) { document.getElementById('err-ncNome').textContent = 'Nome demasiado curto.'; ok = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-ncEmail').textContent = 'E-mail inválido.'; ok = false; }
  if (tipoSenha === 'manual' && senhaManual.length < 4) { document.getElementById('err-ncSenha').textContent = 'Senha mínima de 4 caracteres.'; ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btnCriarCoord');
  btn.disabled = true;

  try {
    // Gera número DC-C-XXX
    const snap  = await getDocs(query(collection(db, 'users'), where('role', '==', 'coord')));
    const numero = 'DC-C-' + String(snap.size + 1).padStart(3, '0');

    const senhaProvisoria = tipoSenha === 'manual'
      ? senhaManual
      : (nome.replace(/\s/g,'').substring(0,4) + new Date().getFullYear()).toLowerCase();

    const senhaHash = await hashSenha(senhaProvisoria);

    await addDoc(collection(db, 'users'), {
      credencial:     numero,
      numero,
      nome,
      apelido,
      email,
      notasInternas:  notas,
      role:           'coord',
      senhaHash,
      primeiroAcesso: true,
      entrada:        new Date().toISOString().split('T')[0],
      criadoEm:       new Date().toISOString()
    });

    closeModal('modalNovoCoord');
    renderCoordCards();
    renderPessoas();

    openConfirm(
      '✅ Coordenador criado!',
      `Credencial: ${numero}\nSenha provisória: ${senhaProvisoria}\n\nEntregar ao coordenador. Deverá trocar a senha no primeiro acesso.`,
      'OK',
      () => closeModal('modalConfirm')
    );
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

// ── EDITAR COORDENADOR ──────────────────────────────────────
let coordEditTarget = null;

async function abrirEdicaoCoord(uid) {
  coordEditTarget = uid;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return;
  const c = snap.data();
  document.getElementById('ecNome').value   = c.nome   || '';
  document.getElementById('ecApelido').value= c.apelido|| '';
  document.getElementById('ecEmail').value  = c.email  || '';
  document.getElementById('ecSenha').value  = '';
  document.getElementById('ecNotas').value  = c.notasInternas || '';
  ['err-ecNome','err-ecEmail'].forEach(id => { const el=document.getElementById(id); if(el) el.textContent=''; });
  document.getElementById('modalEditCoord').classList.remove('hidden');
}

async function salvarEdicaoCoord() {
  if (!coordEditTarget) return;
  const nome   = document.getElementById('ecNome').value.trim();
  const apelido= document.getElementById('ecApelido').value.trim();
  const email  = document.getElementById('ecEmail').value.trim();
  const senha  = document.getElementById('ecSenha').value.trim();
  const notas  = document.getElementById('ecNotas').value.trim();

  let ok = true;
  if (nome.length < 2) { document.getElementById('err-ecNome').textContent = 'Nome inválido.'; ok = false; }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-ecEmail').textContent = 'E-mail inválido.'; ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btnSalvarCoord');
  btn.disabled = true;

  try {
    const updates = { nome, apelido, email, notasInternas: notas };
    if (senha.length >= 4) {
      updates.senhaHash = await hashSenha(senha);
      updates.primeiroAcesso = true;
    }
    await updateDoc(doc(db, 'users', coordEditTarget), updates);
    closeModal('modalEditCoord');
    coordEditTarget = null;
    renderCoordCards();
    renderPessoas();
  } catch (err) {
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

function removerCoord(uid, nome) {
  openConfirm(
    'Remover Coordenador',
    `Remover ${nome} como coordenador? O acesso será revogado imediatamente.`,
    'Remover',
    async () => {
      closeModal('modalConfirm');
      await updateDoc(doc(db, 'users', uid), { role: 'removed', status: 'removido' });
      renderCoordCards();
      renderPessoas();
    }
  );
  document.getElementById('confirmBtn').className = 'btn btn-recusar';
}

window.abrirModalNovoCoord  = abrirModalNovoCoord;
window.toggleSenhaTipo      = toggleSenhaTipo;
window.previewCoordCode     = previewCoordCode;
window.criarCoord           = criarCoord;
window.abrirEdicaoCoord     = abrirEdicaoCoord;
window.salvarEdicaoCoord    = salvarEdicaoCoord;
window.removerCoord         = removerCoord;
document.head.insertAdjacentHTML('beforeend', `<style>
  .filter-tabs { display:flex;gap:0.4rem;margin-bottom:1.5rem;flex-wrap:wrap; }
  .filter-tab { background:none;border:1px solid var(--border);border-radius:var(--radius);padding:0.4rem 1rem;font-family:var(--font-h);font-size:0.68rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);cursor:pointer;transition:all var(--ease); }
  .filter-tab:hover { border-color:var(--red);color:var(--white); }
  .filter-tab.active { background:var(--red-dim);border-color:var(--red);color:var(--red); }
  .role-pill { display:inline-flex;align-items:center;gap:0.3rem;font-family:var(--font-h);font-size:0.6rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:0.2rem 0.6rem;border-radius:2rem; }
  .role-pill.coord  { background:rgba(201,168,76,0.15);color:var(--gold);border:1px solid var(--gold); }
  .role-pill.mestre { background:rgba(138,99,210,0.15);color:#a374e8;border:1px solid #a374e8; }
  .role-pill.membro { background:var(--red-dim);color:var(--red);border:1px solid var(--red); }
  .btn-acao { background:none;border:1px solid var(--border);border-radius:var(--radius);width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all var(--ease);font-size:0.75rem;color:var(--muted);flex-shrink:0; }
  .btn-acao.edit:hover    { border-color:var(--gold);color:var(--gold); }
  .btn-acao.remove:hover  { border-color:var(--red);color:var(--red); }
  .btn-acao.promover:hover { border-color:#a374e8;color:#a374e8; }
  .btn-acao.rebaixar:hover { border-color:var(--muted);color:var(--muted); }
  .modal-edit-id { display:inline-flex;align-items:center;gap:0.5rem;padding:0.3rem 0.8rem;background:rgba(221,30,42,0.07);border:1px solid rgba(221,30,42,0.2);border-radius:99px;font-family:var(--font-h);font-size:0.8rem;color:var(--red);letter-spacing:0.08em;margin-bottom:1.4rem; }
  .modal-input { width:100%;padding:0.72rem 1rem;background:var(--bg-alt);border:1px solid var(--border);border-radius:var(--radius);color:var(--white);font-family:var(--font-b);font-size:1rem;outline:none;transition:border-color var(--ease); }
  .modal-input:focus { border-color:var(--red); }
  .modal-label { display:block;font-family:var(--font-h);font-size:0.67rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:0.4rem; }
  .modal-group { margin-bottom:1.1rem; }
  .modal-err { display:block;color:var(--red);font-size:0.8rem;margin-top:0.3rem;min-height:1em; }
</style>`);

// Modal de edição completo
document.body.insertAdjacentHTML('beforeend', `
  <div class="modal-overlay hidden" id="modalEditar">
    <div class="modal" style="max-width:620px;">
      <div class="modal-header">
        <h3><i class="fas fa-pen" style="color:var(--gold)"></i> Editar Membro</h3>
        <button onclick="closeModal('modalEditar')"><i class="fas fa-times"></i></button>
      </div>
      <div class="modal-body">
        <!-- ID + tipo -->
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.2rem;flex-wrap:wrap;">
          <div class="modal-edit-id"><i class="fas fa-id-badge"></i><span id="editId"></span></div>
          <span style="font-size:0.78rem;color:var(--muted);" id="editTipo"></span>
          <span style="font-size:0.78rem;color:var(--muted);" id="editEntrada"></span>
        </div>

        <!-- Credencial + Senha (linha de acesso) -->
        <div style="background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:var(--radius);padding:0.9rem 1rem;margin-bottom:1.2rem;">
          <div style="font-family:var(--font-h);font-size:0.63rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.4rem;">
            <i class="fas fa-key"></i> Credenciais de Acesso
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.9rem;">
            <div class="modal-group" style="margin-bottom:0;">
              <label class="modal-label">Credencial (ID)</label>
              <input class="modal-input" type="text" id="editCredencial" placeholder="Ex: DC-MB-001" style="font-family:var(--font-h);letter-spacing:0.06em;" />
              <span class="modal-err" id="err-editCredencial"></span>
            </div>
            <div class="modal-group" style="margin-bottom:0;">
              <label class="modal-label">Nova Senha (vazio = não alterar)</label>
              <input class="modal-input" type="text" id="editSenha" placeholder="Nova senha..." />
            </div>
          </div>
        </div>

        <!-- Nome + Apelido -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.9rem;">
          <div class="modal-group" style="margin-bottom:0;">
            <label class="modal-label">Nome *</label>
            <input class="modal-input" type="text" id="editNome" placeholder="Nome completo..." />
            <span class="modal-err" id="err-editNome"></span>
          </div>
          <div class="modal-group" style="margin-bottom:0;">
            <label class="modal-label">Apelido</label>
            <input class="modal-input" type="text" id="editApelido" placeholder="Apelido no clube..." />
          </div>
        </div>

        <!-- E-mail -->
        <div class="modal-group" style="margin-top:0.9rem;">
          <label class="modal-label">E-mail</label>
          <input class="modal-input" type="email" id="editEmail" placeholder="email@exemplo.com" />
          <span class="modal-err" id="err-editEmail"></span>
        </div>

        <!-- Nascimento + Status -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.9rem;">
          <div class="modal-group" style="margin-bottom:0;">
            <label class="modal-label">Data de Nascimento</label>
            <input class="modal-input" type="date" id="editNascimento" />
          </div>
          <div class="modal-group" style="margin-bottom:0;">
            <label class="modal-label">Status</label>
            <select class="modal-input" id="editStatus">
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="suspenso">Suspenso</option>
            </select>
          </div>
        </div>

        <!-- Notas internas -->
        <div class="modal-group">
          <label class="modal-label">Notas Internas</label>
          <textarea class="modal-input" id="editNotas" rows="2" placeholder="Notas visíveis apenas à coordenação..."></textarea>
        </div>

        <!-- Histórico de sessões -->
        <div style="margin-top:0.5rem;">
          <div style="font-family:var(--font-h);font-size:0.65rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.5rem;">
            <i class="fas fa-dice-d20" style="color:#a374e8;"></i> Histórico de Sessões
          </div>
          <div id="editSessoesHistorico" style="background:var(--bg-alt);border:1px solid var(--border);border-radius:var(--radius);max-height:160px;overflow-y:auto;padding:0.6rem 0.9rem;">
            <span style="color:var(--muted);font-size:0.85rem;">A carregar...</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="closeModal('modalEditar')">Cancelar</button>
        <button class="btn btn-primary" onclick="guardarEdicao()"><i class="fas fa-check"></i> Guardar</button>
      </div>
    </div>
  </div>
`);
