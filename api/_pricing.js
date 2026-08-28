// Utilitaire partagé — fichier préfixé par "_" donc ignoré par Vercel (pas transformé en route).

export function discountRateFor(count) {
  if (count >= 6) return 0.2;
  if (count >= 3) return 0.1;
  return 0;
}

export function discountedUnitPrice(priceCents, count) {
  const rate = discountRateFor(count);
  return Math.round(priceCents * (1 - rate));
}
