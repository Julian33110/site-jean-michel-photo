import { del } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const auth = req.headers.authorization || '';
  const password = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Non autorisé' });
  }

  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ success: false, error: 'orderId manquant' });

  try {
    await del(`orders/${orderId}.json`, { access: 'private' });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
