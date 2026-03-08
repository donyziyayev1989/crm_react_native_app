// ─── CRM Entity Interfaces ────────────────────────────────────────────────────
// Diagramma: https://drawsql.app/teams/summer-3/diagrams/crm

export interface User {
  id?: string;
  name: string;
  login: number;
  password: string;
}

export interface Order {
  id?: string;
  name: string;
  date: string;         // ISO date string
  product_count: number;
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
  region_id: string;    // ref → regions
}

export interface OrderLine {
  id?: string;
  order_id: string;     // ref → orders
  customer_id: string;  // ref → customers
  product_id: string;   // ref → products
  product_count: number;
  date: string;         // ISO date string
  rate: number;
  state: string;
  user_id: string;      // ref → users
  delivery_price: number;
}

export interface Customer {
  id?: string;
  name: string;
  region_id: string;    // ref → regions
  district_id: string;  // ref → districts
  phone: string;
  user_id: string;      // ref → users
  tag_id: string;       // ref → tags
  note: string;
  rates: number;
  orders: string[];     // ref → orders
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
  multiline?:boolean
}