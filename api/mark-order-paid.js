import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization || '';
  const password = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Non autorisé' });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ success: false, error: 'orderId manquant' });

  const pathname = `orders/${orderId}.json`;

  try {
    const existing = await get(pathname, { access: 'private' });
    if (!existing || existing.statusCode !== 200) {
      return res.status(404).json({ success: false, error: 'Commande introuvable' });
    }

    const order = JSON.parse(await new Response(existing.stream).text());
    order.status = 'paid';
    order.paidAt = new Date().toISOString();

    await put(pathname, JSON.stringify(order), {
      access: 'private',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
