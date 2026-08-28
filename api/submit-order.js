import { put } from '@vercel/blob';
import crypto from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { discountedUnitPrice, discountRateFor } from './_pricing.js';

// TODO : remplacer OWNER_EMAIL, IBAN et le domaine d'expédition une fois confirmés avec Jean-Michel.
const OWNER_EMAIL = 'je.michel@free.fr';
const FROM_ADDRESS = 'Jean-Michel Expert Photographe <noreply@jm-expert-photo.fr>';
const WERO_PHONE = '06 28 47 52 58';
const IBAN = 'FR76 XXXX XXXX XXXX XXXX XXXX XXX';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generateOrderId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
  const bytes = crypto.randomBytes(5);
  return 'JME-' + Array.from(bytes).map((b) => chars[b % chars.length]).join('');
}

const send = (payload) =>
  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_ADDRESS, ...payload }),
  });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { nom, email, photoIds, paymentMethod: rawMethod } = req.body || {};
  const paymentMethod = rawMethod === 'iban' ? 'iban' : 'wero';

  if (!nom || !email || !Array.isArray(photoIds) || !photoIds.length) {
    return res.status(400).json({ success: false, error: 'Champs manquants' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Email invalide' });
  }

  let photos;
  try {
    const raw = await readFile(path.join(process.cwd(), 'photos.json'), 'utf8');
    photos = JSON.parse(raw);
  } catch {
    return res.status(500).json({ success: false, error: 'Catalogue indisponible' });
  }

  const byId = new Map(photos.map((p) => [p.id, p]));
  const selected = photoIds.map((id) => byId.get(id)).filter(Boolean);
  if (selected.length !== photoIds.length) {
    return res.status(404).json({ success: false, error: 'Une ou plusieurs photos sont introuvables' });
  }

  const totalCents = selected.reduce((sum, p) => sum + discountedUnitPrice(p.price, selected.length), 0);
  const rate = discountRateFor(selected.length);
  const orderId = generateOrderId();
  const total = (totalCents / 100).toFixed(2);
  const paymentLabel = paymentMethod === 'iban' ? 'Virement bancaire' : 'Wero';

  const order = {
    orderId,
    date: new Date().toISOString(),
    nom,
    email,
    photoIds: selected.map((p) => p.id),
    photoTitles: selected.map((p) => p.title),
    totalCents,
    paymentMethod,
    status: 'pending',
  };

  try {
    await put(`orders/${orderId}.json`, JSON.stringify(order), {
      access: 'private',
      contentType: 'application/json',
    });

    const photoListHtml = selected
      .map((p) => `<li style="margin-bottom:4px;">${esc(p.title)} — ${(p.price / 100).toFixed(2)} €</li>`)
      .join('');

    const ownerPaymentInstruction =
      paymentMethod === 'iban'
        ? `Une fois le virement de <strong>${esc(nom)}</strong> (${total} €) reçu`
        : `Une fois le Wero de <strong>${esc(nom)}</strong> (${total} €) reçu`;

    const notifHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f2f0ec;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#161616;border-radius:12px;padding:14px 28px;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;font-weight:700;">Jean-Michel Expert · Photographe</p>
      </div>
    </div>
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
      <div style="background:#161616;padding:28px 32px;">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">Nouvelle commande de tirages</p>
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:600;">${esc(nom)}</h1>
      </div>
      <div style="padding:32px;">
        <p style="margin:0 0 4px;font-size:14px;color:#161616;"><strong>Client :</strong> ${esc(nom)}</p>
        <p style="margin:0 0 4px;font-size:14px;color:#161616;"><strong>Email :</strong> <a href="mailto:${esc(email)}" style="color:#161616;">${esc(email)}</a></p>
        <p style="margin:0 0 20px;font-size:14px;color:#161616;"><strong>Mode de paiement choisi :</strong> ${esc(paymentLabel)}</p>
        <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#161616;">${photoListHtml}</ul>
        <p style="margin:0;font-size:16px;font-weight:700;color:#161616;">Total : ${total} €${rate ? ` (réduction ${Math.round(rate * 100)}% appliquée)` : ''}</p>
        <div style="margin-top:20px;background:#f7f5f2;border-left:3px solid #c9a24a;border-radius:0 10px 10px 0;padding:16px 20px;">
          <p style="margin:0;font-size:13px;color:#161616;">${ownerPaymentInstruction}, envoyer les photos en haute définition puis marquer la commande "payée" dans le tableau de bord.</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const paymentBlockHtml =
      paymentMethod === 'iban'
        ? `
        <div style="background:#f7f5f2;border-radius:10px;padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#161616;">Réglez par <strong>virement bancaire</strong> à :</p>
          <p style="margin:0;font-size:17px;font-weight:700;color:#161616;letter-spacing:.5px;">${esc(IBAN)}</p>
        </div>`
        : `
        <div style="background:#f7f5f2;border-radius:10px;padding:20px;text-align:center;">
          <p style="margin:0 0 8px;font-size:13px;color:#161616;">Réglez par <strong>Wero</strong> au numéro :</p>
          <p style="margin:0;font-size:20px;font-weight:700;color:#161616;">${WERO_PHONE}</p>
        </div>`;

    const confirmHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f2f0ec;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:580px;margin:0 auto;padding:32px 20px;">
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:#161616;border-radius:12px;padding:14px 28px;">
        <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;font-weight:700;">Jean-Michel Expert · Photographe</p>
      </div>
    </div>
    <div style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
      <div style="background:#161616;padding:28px 32px;">
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">Commande enregistrée</p>
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:600;">Merci ${esc(nom)} !</h1>
      </div>
      <div style="padding:32px;">
        <ul style="margin:0 0 16px;padding-left:18px;font-size:14px;color:#161616;">${photoListHtml}</ul>
        <p style="margin:0 0 20px;font-size:16px;font-weight:700;color:#161616;">Total à régler : ${total} €</p>
        ${paymentBlockHtml}
        <p style="margin:20px 0 0;font-size:13px;color:#6b6b6b;line-height:1.6;">Une fois le paiement reçu, vos photos en haute définition vous seront envoyées à cette adresse email.</p>
      </div>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:10px;color:#a3a3a3;letter-spacing:1px;">JEAN-MICHEL EXPERT · Saint-Julien-d'Armagnac</p>
  </div>
</body>
</html>`;

    await send({ to: [OWNER_EMAIL], reply_to: email, subject: `📸 Nouvelle commande — ${nom}`, html: notifHtml });
    try {
      await send({ to: [email], subject: `Votre commande — Jean-Michel Expert Photographe`, html: confirmHtml });
    } catch (e) {
      console.error('Erreur email confirmation commande:', e.message);
    }

    res.status(200).json({
      success: true,
      orderId,
      totalCents,
      total,
      paymentMethod,
      weroPhone: WERO_PHONE,
      iban: IBAN,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
