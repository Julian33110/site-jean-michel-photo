import { get } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { slug, code } = req.body || {};
  if (!slug || !code) return res.status(400).json({ success: false, error: 'Champs manquants' });

  try {
    const result = await get(`galleries/${slug}.json`, { access: 'private' }).catch(() => null);
    if (!result || result.statusCode !== 200) {
      return res.status(404).json({ success: false, error: 'Galerie introuvable' });
    }
    const gallery = JSON.parse(await new Response(result.stream).text());
    if (gallery.code !== code) {
      return res.status(401).json({ success: false, error: 'Code d\'accès incorrect' });
    }

    let photos = [];
    try {
      const raw = await readFile(path.join(process.cwd(), 'photos.json'), 'utf8');
      photos = JSON.parse(raw).filter((p) => p.galleryId === slug);
    } catch {}

    res.status(200).json({
      success: true,
      name: gallery.name,
      photos: photos.map((p) => ({ id: p.id, title: p.title, file: p.file, price: p.price })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
