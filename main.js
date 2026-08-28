// ── HEADER STICKY ──
const header = document.getElementById('header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll);
}

// ── MENU MOBILE ──
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');
function closeMenu() { mobileMenu?.classList.remove('open'); }
burger?.addEventListener('click', () => mobileMenu?.classList.add('open'));
mobileMenuClose?.addEventListener('click', closeMenu);
mobileMenu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

// ── ONGLET NAV ACTIF ──
const currentPage = location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a, .mobile-menu-links a').forEach((a) => {
  const href = a.getAttribute('href');
  if (href === currentPage || (currentPage === '' && href === 'index.html')) a.classList.add('active');
});

// ── REVEAL AU SCROLL ──
const revealEls = document.querySelectorAll('.reveal');
if (revealEls.length) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    },
    { threshold: 0.12 }
  );
  revealEls.forEach((el) => io.observe(el));
}

// ── FORMULAIRE DE CONTACT ──
const contactForm = document.getElementById('contact-form');
if (contactForm) {
  const tsField = document.getElementById('form_ts');
  if (tsField) tsField.value = Date.now();

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('button[type="submit"]');
    const defaultLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    try {
      const data = Object.fromEntries(new FormData(contactForm));
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        btn.textContent = '✓ Message envoyé !';
        btn.style.background = '#2e7d32';
        contactForm.reset();
        if (tsField) tsField.value = Date.now();
        setTimeout(() => { btn.textContent = defaultLabel; btn.style.background = ''; btn.disabled = false; }, 5000);
      } else throw new Error();
    } catch {
      btn.textContent = 'Erreur — réessayez';
      btn.style.background = '#c62828';
      setTimeout(() => { btn.textContent = defaultLabel; btn.style.background = ''; btn.disabled = false; }, 3000);
    }
  });
}
