import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  QueryConstraint,
  updateDoc,
} from "firebase/firestore";
import { database } from "../firebase/firebase";
import type {
  Customer,
  District,
  Order,
  OrderLine,
  Product,
  Rate,
  Region,
  Tag,
  User,
} from "../interfaces";

// firebase app instance – react-firebase-hooks uchun
export { database, app as firebaseApp } from "../firebase/firebase";

// ─── Re-export Firestore query helpers ────────────────────────────────────────
export {
  endAt,
  endBefore,
  limit,
  limitToLast,
  orderBy,
  startAfter,
  startAt,
  where,
} from "firebase/firestore";

// ─── Firestore Collection Names ───────────────────────────────────────────────
export type CollectionName =
  | "users"
  | "orders"
  | "products"
  | "regions"
  | "districts"
  | "order_lines"
  | "customers"
  | "tags"
  | "rates";

// ─── Entity interfaces are defined in src/interfaces/index.ts ─────────────────

// ─── Collection → Entity map (type-safe) ─────────────────────────────────────
interface CollectionEntityMap {
  users: User;
  orders: Order;
  products: Product;
  regions: Region;
  districts: District;
  order_lines: OrderLine;
  customers: Customer;
  tags: Tag;
  rates: Rate;
}

// ─── Generic CollectionMethods ────────────────────────────────────────────────
interface CollectionMethods<T> {
  /**
   * Barchasi yoki filterlangan ro'yxatni qaytaradi.
   *
   * @example
   * db.customers.list()
   * db.customers.list(where("region_id", "==", "abc"), limit(20))
   */
  list: (...constraints: QueryConstraint[]) => Promise<T[]>;

  /**
   * ID bo'yicha bitta hujjatni qaytaradi.
   * @example
   * db.customers.get("abc123")
   */
  get: (id: string) => Promise<T | null>;

  /**
   * Yangi hujjat yaratadi va ID sini qaytaradi.
   * @example
   * const id = await db.customers.create({ name: "Ali", ... })
   */
  create: (data: Omit<T, "id">) => Promise<string>;

  /**
   * Mavjud hujjatni yangilaydi.
   * @example
   * await db.customers.update("abc123", { name: "Vali" })
   */
  update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;

  /**
   * Hujjatni o'chiradi.
   * @example
   * await db.customers.delete("abc123")
   */
  delete: (id: string) => Promise<void>;
}

// ─── DB Builder ───────────────────────────────────────────────────────────────

function createCollection<T extends { id?: string }>(
  collectionName: string,
): CollectionMethods<T> {
  return {
    list: async (...constraints: QueryConstraint[]): Promise<T[]> => {
      const colRef = collection(database, collectionName);
      const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    },

    get: async (id: string): Promise<T | null> => {
      const docRef = doc(database, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() } as T;
    },

    create: async (data: Omit<T, "id">): Promise<string> => {
      const docRef = await addDoc(collection(database, collectionName), data);
      return docRef.id;
    },

    update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
      const ref = doc(database, collectionName, id);
      await updateDoc(ref, data as any);
    },

    delete: async (id: string): Promise<void> => {
      const ref = doc(database, collectionName, id);
      await deleteDoc(ref);
    },
  };
}

// ─── Subcollection Builder ────────────────────────────────────────────────────
// regions/{regionId}/districts  va  orders/{orderId}/order_lines uchun

interface SubCollectionMethods<T> {
  /** Parent ID bo'yicha subcollection hujjatlarini qaytaradi */
  list: (parentId: string, ...constraints: QueryConstraint[]) => Promise<T[]>;
  /** Yangi subcollection hujjat yaratadi */
  create: (parentId: string, data: Omit<T, "id">) => Promise<string>;
  /** Subcollection hujjatni yangilaydi */
  update: (
    parentId: string,
    id: string,
    data: Partial<Omit<T, "id">>,
  ) => Promise<void>;
  /** Subcollection hujjatni o'chiradi */
  delete: (parentId: string, id: string) => Promise<void>;
  /**
   * Firestore collection reference – react-firebase-hooks ga uzatish uchun.
   * @example
   *   const [districts] = useCollectionDataOnce(db.subDistricts.ref(regionId))
   */
  ref: (parentId: string) => ReturnType<typeof collection>;
}

function createSubCollection<T extends { id?: string }>(
  parentColName: string,
  subColName: string,
): SubCollectionMethods<T> {
  const colRef = (parentId: string) =>
    collection(database, parentColName, parentId, subColName);

  return {
    ref: (parentId) => colRef(parentId),

    list: async (parentId, ...constraints) => {
      const ref = colRef(parentId);
      const q = constraints.length > 0 ? query(ref, ...constraints) : ref;
      const snapshot = await getDocs(q);
      return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
    },

    create: async (parentId, data) => {
      const docRef = await addDoc(colRef(parentId), data);
      return docRef.id;
    },

    update: async (parentId, id, data) => {
      const ref = doc(database, parentColName, parentId, subColName, id);
      await updateDoc(ref, data as any);
    },

    delete: async (parentId, id) => {
      const ref = doc(database, parentColName, parentId, subColName, id);
      await deleteDoc(ref);
    },
  };
}

// ─── Typed DB Object ──────────────────────────────────────────────────────────

const db: { [K in CollectionName]: CollectionMethods<CollectionEntityMap[K]> } =
  {
    users: createCollection<User>("users"),
    orders: createCollection<Order>("orders"),
    products: createCollection<Product>("products"),
    regions: createCollection<Region>("regions"),
    districts: createCollection<District>("districts"), // flat fallback
    order_lines: createCollection<OrderLine>("order_lines"), // flat fallback
    customers: createCollection<Customer>("customers"),
    tags: createCollection<Tag>("tags"),
    rates: createCollection<Rate>("rates"),
  };

// ─── Subcollection instances ───────────────────────────────────────────────────
/** regions/{regionId}/districts */
export const subDistricts = createSubCollection<District>(
  "regions",
  "districts",
);
/** orders/{orderId}/order_lines */
export const subOrderLines = createSubCollection<OrderLine>(
  "orders",
  "order_lines",
);

export default db;
