/* =============================================
   DADO CRÍTICO — auth.js (integrado com Firebase)
   ============================================= */

import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── TROCA DE ABAS ─────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('formRegister').classList.add('hidden');
  document.getElementById('formForgot').classList.add('hidden');
  document.getElementById('tabLogin').classList.remove('active');
  document.getElementById('tabRegister').classList.remove('active');

  if (tab === 'login') {
    document.getElementById('formLogin').classList.remove('hidden');
    document.getElementById('tabLogin').classList.add('active');
  } else if (tab === 'register') {
    document.getElementById('formRegister').classList.remove('hidden');
    document.getElementById('tabRegister').classList.add('active');
  }
}

function showForgot() {
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('formRegister').classList.add('hidden');
  document.getElementById('formForgot').classList.remove('hidden');
}

function togglePass(inputId, btn) {
  const input = document.getElementById(inputId);
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';
  btn.querySelector('i').className = isPass ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function setErr(id, msg) {
  const el = document.getElementById('err-' + id);
  if (el) el.textContent = msg;
}

function clearErrs() {
  document.querySelectorAll('.err').forEach(e => e.textContent = '');
}

function showOk(title, msg) {
  document.getElementById('formLogin').classList.add('hidden');
  document.getElementById('formRegister').classList.add('hidden');
  document.getElementById('formForgot').classList.add('hidden');
  const ok = document.getElementById('authOk');
  document.getElementById('authOkTitle').textContent = title;
  document.getElementById('authOkMsg').textContent = msg;
  ok.classList.remove('hidden');
}

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  clearErrs();
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPass').value;
  let ok = true;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('loginEmail', 'Insira um e-mail válido.'); ok = false; }
  if (pass.length < 6) { setErr('loginPass', 'Senha deve ter pelo menos 6 caracteres.'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Entrando...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, "users", cred.user.uid));

    if (!snap.exists()) {
      setErr('loginPass', 'Utilizador não encontrado na base de dados.');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Entrar';
      return;
    }

    const data = snap.data();
    const role = data.role;

    showOk(
      role === 'coord' || role === 'master' ? 'Bem-vindo, Coordenador!' : 'Bem-vindo de volta!',
      'Redirecionando para o painel...'
    );

    setTimeout(() => {
      if (role === 'master')  window.location.href = 'mestre.html';
      else if (role === 'coord') window.location.href = 'coordenador.html';
      else if (role === 'mestre') window.location.href = 'mestre.html';
      else window.location.href = 'membro.html';
    }, 1500);

  } catch (err) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Entrar';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      setErr('loginPass', 'E-mail ou senha incorretos.');
    } else {
      setErr('loginPass', 'Erro ao entrar. Tenta novamente.');
    }
  }
}

// ── REGISTER ──────────────────────────────────────────────────
async function doRegister() {
  clearErrs();
  const nome    = document.getElementById('regNome').value.trim();
  const email   = document.getElementById('regEmail').value.trim();
  const pass    = document.getElementById('regPass').value;
  const pass2   = document.getElementById('regPass2').value;
  const nasc    = document.getElementById('regNasc')?.value || '';
  const apelido = document.getElementById('regApelido')?.value.trim() || '';
  const origem  = document.getElementById('regOrigem')?.value || '';
  const novidades = document.getElementById('regNovidades')?.checked || false;
  let ok = true;

  if (nome.length < 2)    { setErr('regNome', 'Insira seu nome completo.'); ok = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('regEmail', 'Insira um e-mail válido.'); ok = false; }
  if (pass.length < 6)    { setErr('regPass', 'Mínimo 6 caracteres.'); ok = false; }
  if (pass !== pass2)     { setErr('regPass2', 'As senhas não coincidem.'); ok = false; }
  if (!ok) return;

  const btn = document.getElementById('btnRegister');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Criando conta...';

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);

    // Guarda dados do utilizador no Firestore
    await setDoc(doc(db, "users", cred.user.uid), {
      nome,
      email,
      apelido,
      role: 'member',
      status: 'pendente',
      criadoEm: new Date().toISOString()
    });

    // Cria pedido de adesão para aprovação pelo coordenador
    await setDoc(doc(db, "adesoes", cred.user.uid), {
      uid: cred.user.uid,
      nome,
      email,
      apelido,
      nascimento: nasc,
      origem,
      novidades,
      dataEnvio: new Date().toISOString(),
      status: 'pendente'
    });

    showOk('Conta criada!', 'Sua ficha foi enviada para aprovação pelos coordenadores. Redirecionando...');
    setTimeout(() => window.location.href = 'membro.html', 2000);

  } catch (err) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Criar Conta';
    if (err.code === 'auth/email-already-in-use') {
      setErr('regEmail', 'Este e-mail já está cadastrado.');
    } else {
      setErr('regEmail', 'Erro ao criar conta. Tenta novamente.');
    }
  }
}

// ── FORGOT ────────────────────────────────────────────────────
async function doForgot() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr('forgotEmail', 'Insira um e-mail válido.');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showOk('E-mail enviado!', 'Verifique sua caixa de entrada para redefinir a senha.');
  } catch (err) {
    setErr('forgotEmail', 'Erro ao enviar e-mail. Verifica o endereço.');
  }
}

// ── EXPÕE FUNÇÕES GLOBAIS ─────────────────────────────────────
window.switchTab  = switchTab;
window.showForgot = showForgot;
window.togglePass = togglePass;
window.doLogin    = doLogin;
window.doRegister = doRegister;
window.doForgot   = doForgot;
