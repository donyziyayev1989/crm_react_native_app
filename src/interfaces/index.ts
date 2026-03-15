// ─── CRM Entity Interfaces ────────────────────────────────────────────────────
// Diagramma: https://drawsql.app/teams/summer-3/diagrams/crm
//
// Firestore tuzilmasi (Yassi / Flat Architecture):
//   regions/{id}                          ← Region
//   districts/{id}                        ← District (has regionId ref)
//   lots/{id}                             ← ProductLot (Partiya)
//   orders/{id}                           ← Order (Buyurtma, has lotId ref)
//   lost_products/{id}                    ← LostProduct (has lotId ref)
//   customers/{id}                        ← Customer
//   products/{id}                         ← Product
//   users/{id}                            ← User (Auth UID)
//   tags/{id}                             ← Tag
//   rates/{id}                            ← Rate

export interface User {
  id?: string; // Firebase Auth UID
  name: string;
  email: string | null;
  photoURL?: string | null;
  role?: string;
}

export interface ProductLot {
  id?: string;
  name: string;
  date: string; // ISO date string
  product_count: number;
  lost_products: number;
}

export interface LostProduct {
  id?: string;
  lotId: string; // ref → lots
  count: number;
  date: string;
  timestamp: number;
}

export interface Product {
  id?: string;
  name: string;
  price: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  active?: boolean;
}

export interface Region {
  id?: string;
  name: string;
}

export interface District {
  id?: string;
  name: string;
  regionId: string; // ref → regions
}

export interface Order {
  id?: string;
  lotId: string; // ref → lots
  customer_id: string; // ref → customers
  product_id: string; // ref → products
  product_count: number;
  product_price: number;
  region_name: string; // ref -> regions
  district_name?: string; // denormalized field
  date: string; // ISO date string
  rate: number;
  state: string;
  user_id: string; // ref → users
  delivery_price: number;
  note?: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
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
  order_ids: string[]; // ref → lots/orders (historical)
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

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  telegram_id: string;
  product_id?: string;
  product_name?: string;
  product_count: number;
  region_name?: string;
  district_name?: string;
  location?: {
    lat: number;
    lng: number;
  };
  date: string; // ISO date string
  state: "new" | "confirmed" | "rejected" | "pending";
  note?: string;
}

export interface LeadChat {
  id?: string; // Обычно совпадает с lead_id
  lead_id: string;
  last_message?: string;
  last_timestamp?: string;
  unread_count?: number;
}

export interface LeadMessage {
  id?: string;
  text: string;
  sender: "operator" | "customer";
  timestamp: string; // ISO string
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
