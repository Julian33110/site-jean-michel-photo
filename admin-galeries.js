const errorEl = document.getElementById('error');
const loginScreenEl = document.getElementById('loginScreen');
const dashboardEl = document.getElementById('dashboard');

let currentPassword = '';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function renderGalleries(galleries) {
  const listEl = document.getElementById('galleryList');
  listEl.innerHTML = galleries.length
    ? galleries
        .map(
          (g) => `<div class="gallery-row">
            <div class="gallery-row-info">
              <strong>${esc(g.name)}</strong>
              <span>Lien : galerie.html?g=${esc(g.slug)} · Code : <code>${esc(g.code)}</code></span>
            </div>
            <button class="delete-order-btn" data-slug="${esc(g.slug)}">Supprimer</button>
          </div>`
        )
        .join('')
    : '<p class="empty">Aucune galerie pour l\'instant</p>';

  listEl.querySelectorAll('.delete-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteGallery(btn));
  });
}

async function loadGalleries() {
  const res = await fetch('/api/admin-galleries', {
    headers: { Authorization: 'Bearer ' + currentPassword },
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || `Erreur (HTTP ${res.status})`);
  renderGalleries(data.galleries);
}

async function createGallery() {
  const name = document.getElementById('galleryName').value.trim();
  const code = document.getElementById('galleryCode').value.trim();
  const createError = document.getElementById('createError');
  const btn = document.getElementById('createGalleryBtn');
  createError.textContent = '';

  if (!name || !code) return (createError.textContent = 'Nom et code requis.');

  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch('/api/admin-galleries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + currentPassword },
      body: JSON.stringify({ name, code }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur');

    document.getElementById('galleryName').value = '';
    document.getElementById('galleryCode').value = '';
    await loadGalleries();
  } catch (e) {
    createError.textContent = 'Erreur : ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer';
  }
}

async function deleteGallery(btn) {
  const slug = btn.dataset.slug;
  if (!confirm(`Supprimer la galerie "${slug}" ? Le code d'accès ne fonctionnera plus.`)) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch('/api/admin-galleries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + currentPassword },
      body: JSON.stringify({ deleteSlug: slug }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur');
    await loadGalleries();
  } catch (e) {
    alert('Erreur : ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Supprimer';
  }
}

async function load(skipButtonState) {
  const loadBtn = document.getElementById('loadBtn');
  const password = skipButtonState ? currentPassword : document.getElementById('password').value;
  errorEl.textContent = '';
  if (!skipButtonState) {
    loadBtn.disabled = true;
    loadBtn.textContent = 'Connexion…';
  }

  try {
    currentPassword = password;
    await loadGalleries();
    sessionStorage.setItem('jme-admin-password', password);
    loginScreenEl.hidden = true;
    dashboardEl.hidden = false;
  } catch (e) {
    errorEl.textContent = 'Erreur : ' + e.message;
  } finally {
    loadBtn.disabled = false;
    loadBtn.textContent = 'Entrer';
  }
}

document.getElementById('loadBtn').addEventListener('click', () => load(false));
document.getElementById('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') load(false);
});
document.getElementById('createGalleryBtn').addEventListener('click', createGallery);

const savedPassword = sessionStorage.getItem('jme-admin-password');
if (savedPassword) {
  document.getElementById('password').value = savedPassword;
  load(true);
}
