// ─── CRM Entity Interfaces ────────────────────────────────────────────────────
// Diagramma: https://drawsql.app/teams/summer-3/diagrams/crm
//
// Firestore tuzilmasi:
//   regions/{regionId}                    ← Region
//   regions/{regionId}/districts/{id}     ← District (subcollection)
//   orders/{orderId}                      ← Order
//   orders/{orderId}/order_lines/{id}     ← OrderLine (subcollection)

export interface User {
  id?: string; // Firebase Auth UID
  name: string;
  email: string | null;
  photoURL?: string | null;
  role?: string;
}

export interface Order {
  id?: string;
  name: string;
  date: string; // ISO date string
  product_count: number;
  lost_products: number;
}

export interface LostProduct {
  id?: string;
  count: number;
  date: string;
  timestamp: number;
}

export interface Product {
  id?: string;
  name: string;
  price: number;
}

export interface Region {
  id?: string;
  name: string;
}

export interface District {
  id?: string;
  name: string;
  // region_id endi Firestore path orqali belgilanadi:
  // regions/{regionId}/districts/{districtId}
  // Qulaylik uchun regionId ni ham saqlaymiz
  regionId?: string;
}

export interface OrderLine {
  id?: string;
  // order_id endi Firestore path orqali belgilanadi:
  // orders/{orderId}/order_lines/{id}
  // Qulaylik uchun orderId ni ham saqlaymiz
  orderId?: string;
  customer_id: string; // ref → customers
  product_id: string; // ref → products
  product_count: number;
  product_price: number;
  region_name: string; // ref -> regions
  date: string; // ISO date string
  rate: number;
  state: string;
  user_id: string; // ref → users
  delivery_price: number;
  note?: string;
}

export interface Customer {
  id?: string;
  name: string;
  region_name: string; // ref → regions
  district_name?: string; // denormalized field
  phone: string; // unique
  user_id: string; // ref → users
  tag_ids: string[]; // ref → tags
  note: string;
  rates: number;
  order_ids: string[]; // ref → orders
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  telegram_id?: string;
}

export interface Tag {
  id?: string;
  name: string;
}
export interface Rate {
  id?: string;
  name: string;
  rate: number;
}

export interface InputProps {
  name: string;
  value: string;
  onChange: (text: string) => void;
  errors?: Record<string, any>;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "numeric"
    | "email-address"
    | "phone-pad"
    | "decimal-pad";
}
