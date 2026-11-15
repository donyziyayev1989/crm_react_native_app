import type { Customer, WithId } from "../interfaces";
import { phonesMatch } from "./phone";

/**
 * Telefon bo'yicha mavjud mijozni topish (oxirgi 9 raqam). Bir nechta bo'lsa — ro'yxatdagi
 * birinchisi. Telefon to'liq bo'lmasa `undefined`.
 */
export const findCustomerByPhone = (
  customers: WithId<Customer>[],
  phone: string | undefined | null,
): WithId<Customer> | undefined => customers.find((c) => phonesMatch(c.phone, phone));
