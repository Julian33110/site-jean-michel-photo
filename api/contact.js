// TODO : remplacer OWNER_EMAIL et le domaine d'expédition une fois le vrai nom de domaine
// choisi et vérifié dans Resend (voir mémoire project_api_keys.md pour la clé partagée).
const OWNER_EMAIL = 'je.michel@free.fr';
const FROM_ADDRESS = 'Jean-Michel Expert Photographe <noreply@jm-expert-photo.fr>';

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const d = req.body || {};

  // Anti-spam : champ piège rempli → bot. On répond succès sans envoyer de mail.
  if (d.hp_site) {
    return res.status(200).json({ success: true });
  }
  const loadedAt = Number(d.form_ts);
  if (!loadedAt || Date.now() - loadedAt < 3000) {
    return res.status(200).json({ success: true });
  }

  const { prenom, nom, email, sujet, message } = d;

  if (!prenom || !nom || !email || !message) {
    return res.status(400).json({ success: false, error: 'Champs requis manquants' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'Email invalide' });
  }

  const html = `
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
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">Nouveau message</p>
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:600;">${esc(sujet) || 'Contact site web'}</h1>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;margin-bottom:24px;">
          <tr>
            <td style="width:50%;padding:12px;background:#f7f5f2;border-radius:10px;vertical-align:top;">
              <p style="margin:0 0 4px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#c9a24a;">De</p>
              <p style="margin:0;font-size:16px;font-weight:700;color:#161616;">${esc(prenom)} ${esc(nom)}</p>
              <p style="margin:4px 0 0;font-size:12px;color:#6b6b6b;"><a href="mailto:${esc(email)}" style="color:#161616;">${esc(email)}</a></p>
            </td>
          </tr>
        </table>
        <div style="background:#f7f5f2;border-left:3px solid #c9a24a;border-radius:0 10px 10px 0;padding:20px 24px;">
          <p style="margin:0 0 8px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#c9a24a;">Message</p>
          <p style="margin:0;font-size:14px;color:#161616;line-height:1.7;white-space:pre-line;">${esc(message)}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

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
        <p style="margin:0 0 4px;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#c9a24a;">Message reçu</p>
        <h1 style="margin:0;font-size:22px;color:#fff;font-weight:600;">Merci, ${esc(prenom)} !</h1>
      </div>
      <div style="padding:32px;">
        <p style="margin:0;font-size:15px;color:#161616;line-height:1.7;">Votre message a bien été reçu, je reviens vers vous dans les plus brefs délais.</p>
      </div>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:10px;color:#a3a3a3;letter-spacing:1px;">JEAN-MICHEL EXPERT · Saint-Julien-d'Armagnac</p>
  </div>
</body>
</html>`;

  const send = (payload) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, ...payload }),
    });

  try {
    const r = await send({
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `✉️ ${prenom} ${nom} — ${sujet || 'Contact site web'}`,
      html,
    });
    if (!r.ok) { const err = await r.json(); return res.status(500).json({ success: false, error: err }); }

    try {
      await send({ to: [email], subject: `Votre message à Jean-Michel Expert Photographe`, html: confirmHtml });
    } catch (e) {
      console.error('Erreur email confirmation visiteur:', e.message);
    }

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
