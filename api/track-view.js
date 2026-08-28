import { put } from '@vercel/blob';
import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { photoId } = req.body || {};
  if (!photoId) return res.status(400).json({ success: false });

  try {
    // Un marqueur indépendant par vue (au lieu d'un compteur en lecture-modification-écriture,
    // sujet à des écritures perdues vu le délai de propagation de Vercel Blob).
    const marker = `stats/views/${photoId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await put(marker, '1', { access: 'private', contentType: 'text/plain' });
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
