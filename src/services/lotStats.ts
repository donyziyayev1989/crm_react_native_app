import db, { where } from "@/services/database";

/**
 * Partiyadagi barcha yo'qotishlarni qayta yig'ib, lots/{lotId}.lost_products ni yangilaydi.
 * LostProductModal (saqlash) va LotLostList (o'chirish) dan chaqiriladi.
 */
export const recalcLostTotal = async (lotId: string): Promise<number> => {
  const all = await db.lost_products.list(where("lotId", "==", lotId));
  const total = all.reduce((sum, item) => sum + (item.count || 0), 0);
  await db.lots.update(lotId, { lost_products: total });
  return total;
};
