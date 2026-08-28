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

function formatDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function renderOrders(orders) {
  const ordersBody = document.getElementById('ordersBody');
  ordersBody.innerHTML = orders.length
    ? orders
        .map(
          (o) => `<tr>
            <td>${esc(o.orderId || '—')}</td>
            <td>${formatDate(o.date)}</td>
            <td>${esc(o.nom || o.email || 'inconnu')}</td>
            <td>${o.photoIds.length}</td>
            <td>${(o.totalCents / 100).toFixed(2)} €</td>
            <td>${o.paymentMethod === 'iban' ? 'Virement' : 'Wero'}</td>
            <td><span class="status-pill status-pill--${o.status}">${o.status === 'paid' ? 'Payée' : 'En attente'}</span></td>
            <td class="actions-cell">${
              o.orderId
                ? `${
                    o.status !== 'paid'
                      ? `<button class="mark-paid-btn" data-order-id="${esc(o.orderId)}" data-photo-count="${o.photoIds.length}" data-amount-cents="${o.totalCents}">Marquer payé</button>`
                      : ''
                  }<button class="delete-order-btn" data-order-id="${esc(o.orderId)}" data-status="${esc(o.status)}" data-photo-count="${o.photoIds.length}" data-amount-cents="${o.totalCents}" title="Supprimer la commande">Supprimer</button>`
                : ''
            }</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="8" class="empty">Aucune commande pour l\'instant</td></tr>';

  ordersBody.querySelectorAll('.mark-paid-btn').forEach((btn) => {
    btn.addEventListener('click', () => markPaid(btn));
  });
  ordersBody.querySelectorAll('.delete-order-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteOrder(btn));
  });
}

// Vercel Blob peut mettre jusqu'à 60s à propager une écriture (voir doc officielle) :
// on met donc à jour l'affichage localement plutôt que de recharger depuis le serveur,
// pour éviter de montrer une donnée périmée juste après l'action.
function applyPaidLocally(btn) {
  const row = btn.closest('tr');
  const statusCell = row.children[6];
  statusCell.innerHTML = '<span class="status-pill status-pill--paid">Payée</span>';
  row.children[7].innerHTML = '';

  const photoCount = Number(btn.dataset.photoCount);
  const amountCents = Number(btn.dataset.amountCents);

  document.getElementById('orderCount').textContent = Number(document.getElementById('orderCount').textContent) + 1;
  document.getElementById('photoCount').textContent = Number(document.getElementById('photoCount').textContent) + photoCount;
  document.getElementById('pendingCount').textContent = Math.max(0, Number(document.getElementById('pendingCount').textContent) - 1);
  const totalEl = document.getElementById('total');
  const newTotalCents = Math.round(parseFloat(totalEl.textContent) * 100) + amountCents;
  totalEl.textContent = (newTotalCents / 100).toFixed(2) + ' €';
}

async function markPaid(btn) {
  const orderId = btn.dataset.orderId;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch('/api/mark-order-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + currentPassword },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur');
    applyPaidLocally(btn);
  } catch (e) {
    alert('Erreur : ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Marquer payé';
  }
}

function removeOrderLocally(btn) {
  const row = btn.closest('tr');
  const status = btn.dataset.status;
  const photoCount = Number(btn.dataset.photoCount);
  const amountCents = Number(btn.dataset.amountCents);

  if (status === 'paid') {
    document.getElementById('orderCount').textContent = Math.max(0, Number(document.getElementById('orderCount').textContent) - 1);
    document.getElementById('photoCount').textContent = Math.max(0, Number(document.getElementById('photoCount').textContent) - photoCount);
    const totalEl = document.getElementById('total');
    const newTotalCents = Math.max(0, Math.round(parseFloat(totalEl.textContent) * 100) - amountCents);
    totalEl.textContent = (newTotalCents / 100).toFixed(2) + ' €';
  } else {
    document.getElementById('pendingCount').textContent = Math.max(0, Number(document.getElementById('pendingCount').textContent) - 1);
  }

  row.remove();
  const ordersBody = document.getElementById('ordersBody');
  if (!ordersBody.children.length) {
    ordersBody.innerHTML = '<tr><td colspan="8" class="empty">Aucune commande pour l\'instant</td></tr>';
  }
}

async function deleteOrder(btn) {
  const orderId = btn.dataset.orderId;
  if (!confirm(`Supprimer définitivement la commande ${orderId} ?`)) return;
  btn.disabled = true;
  btn.textContent = '…';
  try {
    const res = await fetch('/api/delete-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + currentPassword },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Erreur');
    removeOrderLocally(btn);
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
    const res = await fetch('/api/admin-stats', {
      headers: { Authorization: 'Bearer ' + password },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || `Erreur (HTTP ${res.status})`);

    currentPassword = password;
    sessionStorage.setItem('jme-admin-password', password);

    document.getElementById('orderCount').textContent = data.orderCount;
    document.getElementById('photoCount').textContent = data.photoCount;
    document.getElementById('total').textContent = data.total + ' €';
    document.getElementById('pendingCount').textContent = data.pendingCount;

    const perPhotoBody = document.getElementById('perPhotoBody');
    const perPhotoSorted = Object.entries(data.perPhoto).sort((a, b) => b[1].totalCents - a[1].totalCents);
    perPhotoBody.innerHTML = perPhotoSorted.length
      ? perPhotoSorted
          .map(
            ([id, v]) =>
              `<tr><td>${esc(id)}</td><td>${v.count}</td><td>${(v.totalCents / 100).toFixed(2)} €</td></tr>`
          )
          .join('')
      : '<tr><td colspan="3" class="empty">Aucune vente pour l\'instant</td></tr>';

    const topViewedBody = document.getElementById('topViewedBody');
    topViewedBody.innerHTML = data.topViewed.length
      ? data.topViewed
          .map((v) => `<tr><td>${esc(v.title)}</td><td>${v.count}</td></tr>`)
          .join('')
      : '<tr><td colspan="2" class="empty">Aucune vue enregistrée</td></tr>';

    renderOrders(data.orders);

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

const savedPassword = sessionStorage.getItem('jme-admin-password');
if (savedPassword) {
  document.getElementById('password').value = savedPassword;
  load(true);
}
