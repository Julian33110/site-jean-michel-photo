import { list, get } from '@vercel/blob';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const auth = req.headers.authorization || '';
  const password = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, error: 'Non autorisé' });
  }

  try {
    // ── Commandes (stockées comme fichiers individuels sur Blob) ──
    const orders = [];
    let cursor;
    let hasMore = true;
    while (hasMore) {
      const page = await list({ prefix: 'orders/', access: 'private', cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const result = await get(blob.pathname, { access: 'private' }).catch(() => null);
        if (result?.statusCode === 200) {
          try {
            orders.push(JSON.parse(await new Response(result.stream).text()));
          } catch {}
        }
      }
      hasMore = page.hasMore;
      cursor = page.cursor;
    }
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    const paidOrders = orders.filter((o) => o.status === 'paid');
    const pendingOrders = orders.filter((o) => o.status !== 'paid');

    const orderCount = paidOrders.length;
    const photoCount = paidOrders.reduce((sum, o) => sum + o.photoIds.length, 0);
    const totalCents = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
    const pendingCount = pendingOrders.length;
    const pendingCents = pendingOrders.reduce((sum, o) => sum + o.totalCents, 0);

    const perPhoto = new Map();
    for (const o of paidOrders) {
      const share = Math.round(o.totalCents / o.photoIds.length);
      for (const photoId of o.photoIds) {
        const entry = perPhoto.get(photoId) || { count: 0, totalCents: 0 };
        entry.count += 1;
        entry.totalCents += share;
        perPhoto.set(photoId, entry);
      }
    }

    // ── Vues par photo ──
    const views = {};
    cursor = undefined;
    hasMore = true;
    while (hasMore) {
      const page = await list({ prefix: 'stats/views/', access: 'private', cursor, limit: 1000 });
      for (const blob of page.blobs) {
        const photoId = blob.pathname.split('/')[2];
        if (photoId) views[photoId] = (views[photoId] || 0) + 1;
      }
      hasMore = page.hasMore;
      cursor = page.cursor;
    }

    let photosById = {};
    try {
      const raw = await readFile(path.join(process.cwd(), 'photos.json'), 'utf8');
      photosById = Object.fromEntries(JSON.parse(raw).map((p) => [p.id, p.title]));
    } catch {}

    const topViewed = Object.entries(views)
      .map(([photoId, count]) => ({ photoId, title: photosById[photoId] || photoId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.status(200).json({
      success: true,
      orderCount,
      photoCount,
      totalCents,
      total: (totalCents / 100).toFixed(2),
      pendingCount,
      pendingCents,
      pendingTotal: (pendingCents / 100).toFixed(2),
      perPhoto: Object.fromEntries(perPhoto),
      orders: orders.slice(0, 100),
      topViewed,
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
