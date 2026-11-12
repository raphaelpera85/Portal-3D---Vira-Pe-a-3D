export type CartRow = { store_id: string; store_name: string; product_id: string; product_name: string; quantity: number; price_brl: number | string };

export function groupCartItemsByStore(rows: CartRow[]) {
  const stores = new Map<string, { storeId: string; storeName: string; items: Array<{ productId: string; productName: string; quantity: number; priceBrl: number; totalBrl: number }>; totalCents: number }>();
  for (const row of rows) {
    const priceCents = Math.round(Number(row.price_brl) * 100);
    const lineCents = priceCents * row.quantity;
    const group = stores.get(row.store_id) ?? { storeId: row.store_id, storeName: row.store_name, items: [], totalCents: 0 };
    group.items.push({ productId: row.product_id, productName: row.product_name, quantity: row.quantity, priceBrl: priceCents / 100, totalBrl: lineCents / 100 });
    group.totalCents += lineCents;
    stores.set(row.store_id, group);
  }
  return [...stores.values()].map(({ totalCents, ...group }) => ({ ...group, totalBrl: totalCents / 100 }));
}
