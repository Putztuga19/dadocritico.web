/* =============================================
   DADO CRÍTICO — script.js
   Sem ES Modules — carrega com defer normal
   ============================================= */

// ── NAVBAR SCROLL
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── MOBILE MENU
const toggle = document.getElementById('navToggle');
const links  = document.getElementById('navLinks');
toggle.addEventListener('click', () => {
  links.classList.toggle('open');
  toggle.querySelector('i').className =
    links.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
});
links.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    links.classList.remove('open');
    toggle.querySelector('i').className = 'fas fa-bars';
  });
});

// ── SCROLL REVEAL
const revealEls = Array.from(document.querySelectorAll('.reveal'));
if (revealEls.length) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const i = revealEls.indexOf(entry.target);
        setTimeout(() => entry.target.classList.add('visible'), Math.max(i, 0) * 100);
        revealObs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  revealEls.forEach(el => revealObs.observe(el));
}

// ── COUNTER ANIMATION
function runCounter(el, target) {
  let start = null;
  const duration = 1600;
  const step = (ts) => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target + '+';
  };
  requestAnimationFrame(step);
}
const statsEl = document.querySelector('.stats');
if (statsEl) {
  const statsObs = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      document.querySelectorAll('.stat-n').forEach(el => {
        runCounter(el, parseInt(el.dataset.target));
      });
      statsObs.disconnect();
    }
  }, { threshold: 0.5 });
  statsObs.observe(statsEl);
}

// ── SMOOTH SCROLL
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = navbar.offsetHeight + 16;
      window.scrollTo({ top: target.offsetTop - offset, behavior: 'smooth' });
    }
  });
});

// ── FORMULÁRIO
const form      = document.getElementById('form');
const submitBtn = document.getElementById('submitBtn');
const formOk    = document.getElementById('formOk');

function setErr(id, msg) {
  const el = document.getElementById('err-' + id);
  if (el) el.textContent = msg;
}
function clearErrs() {
  document.querySelectorAll('.err').forEach(el => el.textContent = '');
}

if (form) {
  form.addEventListener('submit', e => {
    e.preventDefault();
    clearErrs();

    const nome      = document.getElementById('nome').value.trim();
    const email     = document.getElementById('email').value.trim();
    const nasc      = document.getElementById('nascimento').value;
    const origem    = document.getElementById('origem').value;
    const novidades = document.getElementById('novidades').value;
    const conduta   = document.getElementById('conduta').checked;
    const apelido   = document.getElementById('apelido')?.value.trim() || '';
    let ok = true;

    if (nome.length < 2)
      { setErr('nome', 'Insira seu nome completo.'); ok = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      { setErr('email', 'Insira um e-mail válido.'); ok = false; }
    if (!nasc) {
      setErr('nascimento', 'Insira sua data de nascimento.'); ok = false;
    } else {
      const hoje = new Date(), dn = new Date(nasc);
      let idade = hoje.getFullYear() - dn.getFullYear();
      const m = hoje.getMonth() - dn.getMonth();
      if (m < 0 || (m === 0 && hoje.getDate() < dn.getDate())) idade--;
      if (idade < 12)
        { setErr('nascimento', 'É necessário ter pelo menos 12 anos.'); ok = false; }
    }
    if (!origem)    { setErr('origem',    'Selecione uma opção.'); ok = false; }
    if (!novidades) { setErr('novidades', 'Selecione uma opção.'); ok = false; }
    if (!conduta)   { setErr('conduta',   'Aceite o código de conduta para continuar.'); ok = false; }

    if (!ok) return;

    submitBtn.disabled = true;
    submitBtn.querySelector('span').textContent = 'Enviando...';

    // Salvar no Firestore — usa o db exposto pelo firebase-config.js
    if (window.__dc_db && window.__dc_addDoc && window.__dc_collection) {
      window.__dc_addDoc(window.__dc_collection(window.__dc_db, 'adesoes'), {
        nome, email, nascimento: nasc, apelido, origem,
        novidades: novidades === 'sim',
        status: 'pendente',
        dataEnvio: new Date().toISOString()
      }).catch(err => console.warn('Firestore erro:', err));
    }

    setTimeout(() => {
      form.style.display = 'none';
      formOk.classList.add('show');
    }, 1000);
  });

  ['nome', 'email', 'nascimento', 'origem', 'novidades'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => setErr(id, ''));
  });
  const condutaEl = document.getElementById('conduta');
  if (condutaEl) condutaEl.addEventListener('change', () => setErr('conduta', ''));
}
