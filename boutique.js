const CART_KEY = 'jme-cart';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCents(cents) {
  return (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) + ' €';
}

function discountRateFor(count) {
  if (count >= 6) return 0.2;
  if (count >= 3) return 0.1;
  return 0;
}

let photosById = new Map();
let cart = new Set(JSON.parse(localStorage.getItem(CART_KEY) || '[]'));

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(Array.from(cart)));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  badge.textContent = cart.size;
  badge.hidden = cart.size === 0;
}

function addToCart(photoId) {
  cart.add(photoId);
  saveCart();
}

function removeFromCart(photoId) {
  cart.delete(photoId);
  saveCart();
  renderCart();
}

async function loadPhotos() {
  const grid = document.getElementById('grid');
  try {
    const res = await fetch('photos.json', { cache: 'no-store' });
    const all = await res.json();
    const photos = all.filter((p) => p.public !== false);

    if (!photos.length) {
      grid.innerHTML = '<p class="boutique-empty">Aucune photo disponible pour le moment.</p>';
      return;
    }

    photosById = new Map(photos.map((p) => [p.id, p]));

    grid.innerHTML = photos
      .map(
        (p) => `
      <div class="photo-card">
        <img src="${esc(p.file)}" alt="${esc(p.title)}" loading="lazy" data-photo-id="${esc(p.id)}" />
        <div class="photo-card-body">
          <span class="photo-card-title">${esc(p.title)}</span>
          <span class="photo-card-price">${formatCents(p.price)}</span>
        </div>
        <button class="photo-buy-btn" data-photo-id="${esc(p.id)}">Ajouter au panier</button>
      </div>`
      )
      .join('');

    grid.querySelectorAll('.photo-card img').forEach((img) => {
      img.addEventListener('click', () => openLightbox(img.dataset.photoId));
    });
    grid.querySelectorAll('.photo-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => addToCartWithFeedback(btn));
    });
  } catch (e) {
    grid.innerHTML = '<p class="boutique-empty">Impossible de charger la boutique.</p>';
  }
}

function addToCartWithFeedback(btn) {
  addToCart(btn.dataset.photoId);
  const original = btn.textContent;
  btn.textContent = 'Ajouté ✓';
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 900);
}

function openLightbox(photoId) {
  const p = photosById.get(photoId);
  if (!p) return;
  document.getElementById('lightboxImg').src = p.file;
  document.getElementById('lightboxImg').alt = p.title;
  document.getElementById('lightboxTitle').textContent = p.title;
  document.getElementById('lightboxPrice').textContent = formatCents(p.price);
  const buyBtn = document.getElementById('lightboxBuy');
  buyBtn.dataset.photoId = photoId;
  buyBtn.disabled = false;
  buyBtn.textContent = 'Ajouter au panier';
  document.getElementById('lightbox').hidden = false;

  fetch('/api/track-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photoId }),
  }).catch(() => {});
}

function closeLightbox() {
  document.getElementById('lightbox').hidden = true;
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const items = Array.from(cart)
    .map((id) => photosById.get(id))
    .filter(Boolean);

  if (!items.length) {
    itemsEl.innerHTML = '<p class="cart-empty">Ton panier est vide.</p>';
  } else {
    itemsEl.innerHTML = items
      .map(
        (p) => `
      <div class="cart-item">
        <img src="${esc(p.file)}" alt="${esc(p.title)}" />
        <div class="cart-item-info">
          <div class="cart-item-title">${esc(p.title)}</div>
          <div class="cart-item-price">${formatCents(p.price)}</div>
        </div>
        <button class="cart-item-remove" data-photo-id="${esc(p.id)}" aria-label="Retirer">✕</button>
      </div>`
      )
      .join('');

    itemsEl.querySelectorAll('.cart-item-remove').forEach((btn) => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.photoId));
    });
  }

  const subtotal = items.reduce((sum, p) => sum + p.price, 0);
  const rate = discountRateFor(items.length);
  const discountAmount = Math.round(subtotal * rate);
  const total = subtotal - discountAmount;

  document.getElementById('cartSubtotal').textContent = formatCents(subtotal);
  document.getElementById('cartTotal').textContent = formatCents(total);

  const discountLine = document.getElementById('cartDiscountLine');
  if (rate > 0) {
    discountLine.hidden = false;
    document.getElementById('cartDiscountAmount').textContent = '-' + formatCents(discountAmount);
  } else {
    discountLine.hidden = true;
  }

  const note = document.getElementById('cartDiscountNote');
  if (items.length === 0) {
    note.textContent = '';
  } else if (rate === 0.2) {
    note.textContent = '-20% appliqué 🎉';
  } else if (rate === 0.1) {
    const missing = 6 - items.length;
    note.textContent = `-10% appliqué — encore ${missing} photo${missing > 1 ? 's' : ''} pour -20%`;
  } else {
    const missing = 3 - items.length;
    note.textContent = `Ajoute ${missing} photo${missing > 1 ? 's' : ''} de plus pour -10%`;
  }

  document.getElementById('cartCheckout').disabled = items.length === 0;
}

function openCart() {
  document.getElementById('cartRecap').hidden = false;
  document.getElementById('cartOrderForm').hidden = false;
  document.getElementById('cartConfirmation').hidden = true;
  document.getElementById('orderError').textContent = '';
  renderCart();
  document.getElementById('cartOverlay').hidden = false;
}

function closeCart() {
  document.getElementById('cartOverlay').hidden = true;
}

async function submitOrder() {
  const btn = document.getElementById('cartCheckout');
  const errorEl = document.getElementById('orderError');
  const nom = document.getElementById('orderNom').value.trim();
  const email = document.getElementById('orderEmail').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  errorEl.textContent = '';

  if (!nom) return (errorEl.textContent = 'Merci de renseigner votre nom.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (errorEl.textContent = 'Email invalide.');
  if (cart.size === 0) return (errorEl.textContent = 'Votre panier est vide.');

  btn.disabled = true;
  btn.textContent = 'Envoi…';

  try {
    const res = await fetch('/api/submit-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, photoIds: Array.from(cart), paymentMethod }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur inconnue');

    const paymentBlockHtml =
      data.paymentMethod === 'iban'
        ? `<p>Réglez par virement bancaire à :</p>
           <div class="cart-confirmation-iban"><strong>${esc(data.iban)}</strong></div>`
        : `<p>Réglez par Wero au numéro :</p>
           <div class="cart-confirmation-phone">${esc(data.weroPhone)}</div>`;

    document.getElementById('cartConfirmation').innerHTML = `
      <h3>Commande enregistrée !</h3>
      ${paymentBlockHtml}
      <div class="cart-confirmation-amount">${data.total} €</div>
      <p>Un email de confirmation vient de vous être envoyé.</p>
      <button class="cart-confirmation-close" id="cartConfirmationClose">Fermer</button>
    `;
    document.getElementById('cartRecap').hidden = true;
    document.getElementById('cartOrderForm').hidden = true;
    document.getElementById('cartConfirmation').hidden = false;
    document.getElementById('cartConfirmationClose').addEventListener('click', closeCart);

    cart = new Set();
    saveCart();
  } catch (e) {
    errorEl.textContent = 'Erreur : ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Commander';
  }
}

document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', (e) => {
  if (e.target.id === 'lightbox') closeLightbox();
});
document.getElementById('lightboxBuy').addEventListener('click', (e) => {
  addToCartWithFeedback(e.target);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLightbox();
    closeCart();
  }
});

document.getElementById('cartToggle').addEventListener('click', openCart);
document.getElementById('cartClose').addEventListener('click', closeCart);
document.getElementById('cartOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'cartOverlay') closeCart();
});
document.getElementById('cartCheckout').addEventListener('click', submitOrder);

updateCartBadge();
loadPhotos();
