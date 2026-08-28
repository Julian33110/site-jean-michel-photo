const CATEGORY_LABELS = {
  mariage: 'Mariage',
  portrait: 'Portrait',
  sport: 'Sport',
  evenementiel: 'Événementiel',
  entreprise: 'Entreprise',
};

const CAMERA_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let allPhotos = [];
let currentCat = 'all';

function placeholderGrid(cat) {
  const cats = cat === 'all' ? Object.keys(CATEGORY_LABELS) : [cat];
  return cats
    .flatMap((c) => Array.from({ length: cat === 'all' ? 2 : 6 }, () => c))
    .map((c) => `<div class="ph-item">${CAMERA_ICON}<span>${esc(CATEGORY_LABELS[c] || c)} — à venir</span></div>`)
    .join('');
}

function render() {
  const grid = document.getElementById('portfolioGrid');
  const filtered = currentCat === 'all' ? allPhotos : allPhotos.filter((p) => p.category === currentCat);

  if (!filtered.length) {
    grid.innerHTML = placeholderGrid(currentCat);
    return;
  }

  grid.innerHTML = filtered
    .map(
      (p) => `<div class="ph-item" style="background:none;" data-photo-title="${esc(p.title)}" data-photo-file="${esc(p.file)}">
        <img src="${esc(p.file)}" alt="${esc(p.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;" />
      </div>`
    )
    .join('');

  grid.querySelectorAll('.ph-item[data-photo-file]').forEach((item) => {
    item.addEventListener('click', () => openLightbox(item.dataset.photoFile, item.dataset.photoTitle));
  });
}

function openLightbox(file, title) {
  document.getElementById('lightboxImg').src = file;
  document.getElementById('lightboxImg').alt = title;
  document.getElementById('lightboxTitle').textContent = title;
  document.getElementById('lightbox').hidden = false;
}
document.getElementById('lightboxClose').addEventListener('click', () => (document.getElementById('lightbox').hidden = true));
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') document.getElementById('lightbox').hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('lightbox').hidden = true;
});

document.querySelectorAll('.portfolio-filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.portfolio-filter').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    render();
  });
});

fetch('photos.json', { cache: 'no-store' })
  .then((r) => r.json())
  .then((photos) => {
    allPhotos = photos.filter((p) => p.public !== false);
    render();
  })
  .catch(() => render());
