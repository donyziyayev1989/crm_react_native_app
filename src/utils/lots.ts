import { ProductLot } from "../interfaces";

/** Yo'qotilgan tovarlar foizi, bir o'nlik: "7.5". product_count bo'lmasa "0". */
export const lostPercent = (
  lot: Pick<ProductLot, "product_count" | "lost_products"> | null | undefined,
): string => {
  if (!lot?.product_count) return "0";
  return (((lot.lost_products || 0) * 100) / lot.product_count).toFixed(1);
};
