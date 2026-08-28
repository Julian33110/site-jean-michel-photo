// Gestion des galeries clients privées (nom, slug, code d'accès), stockées sur Vercel Blob
// pour pouvoir être créées depuis le tableau de bord sans redéploiement. L'association des
// photos à une galerie se fait ensuite en relançant scripts/prepare-photos.mjs avec
// --gallery <slug> (voir le script), ce qui nécessite un redéploiement.

import { list, get, put, del } from '@vercel/blob';

function checkAuth(req) {
  const auth = req.headers.authorization || '';
  const password = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return Boolean(process.env.ADMIN_PASSWORD) && password === process.env.ADMIN_PASSWORD;
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default async function handler(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ success: false, error: 'Non autorisé' });

  if (req.method === 'GET') {
    try {
      const galleries = [];
      let cursor;
      let hasMore = true;
      while (hasMore) {
        const page = await list({ prefix: 'galleries/', access: 'private', cursor, limit: 1000 });
        for (const blob of page.blobs) {
          const result = await get(blob.pathname, { access: 'private' }).catch(() => null);
          if (result?.statusCode === 200) {
            try {
              galleries.push(JSON.parse(await new Response(result.stream).text()));
            } catch {}
          }
        }
        hasMore = page.hasMore;
        cursor = page.cursor;
      }
      galleries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      res.status(200).json({ success: true, galleries });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
    return;
  }

  if (req.method === 'POST') {
    const { name, code, deleteSlug } = req.body || {};

    if (deleteSlug) {
      try {
        await del(`galleries/${deleteSlug}.json`, { access: 'private' });
        return res.status(200).json({ success: true });
      } catch (e) {
        return res.status(500).json({ success: false, error: e.message });
      }
    }

    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Nom et code d\'accès requis' });
    }
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ success: false, error: 'Nom invalide' });

    const gallery = { slug, name, code, createdAt: new Date().toISOString() };

    try {
      await put(`galleries/${slug}.json`, JSON.stringify(gallery), {
        access: 'private',
        contentType: 'application/json',
        allowOverwrite: true,
      });
      res.status(200).json({ success: true, gallery });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
    return;
  }

  res.status(405).end();
}
