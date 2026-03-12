import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  QueryConstraint,
  updateDoc,
} from "firebase/firestore";
// ... (imports remain same)
import { database } from "../firebase/firebase";
import type {
  Customer,
  District,
  LostProduct,
  Order,
  Product,
  ProductLot,
  Rate,
  Region,
  Tag,
  Lead,
  LeadChat,
  LeadMessage,
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

// ─── Firestore Collection Names (Flat Architecture) ───────────────────────────
export type CollectionName =
  | "users"
  | "lots"
  | "orders"
  | "products"
  | "regions"
  | "districts"
  | "customers"
  | "tags"
  | "rates"
  | "lost_products"
  | "leads"
  | "lead_chats";

// ─── Collection → Entity map (type-safe) ─────────────────────────────────────
interface CollectionEntityMap {
  users: User;
  lots: ProductLot;
  orders: Order;
  products: Product;
  regions: Region;
  districts: District;
  customers: Customer;
  tags: Tag;
  rates: Rate;
  lost_products: LostProduct;
  leads: Lead;
  lead_chats: LeadChat;
}

export interface CollectionMethods<T> {
  // ...
  list: (...constraints: QueryConstraint[]) => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: Omit<T, "id">) => Promise<string>;
  update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
  delete: (id: string) => Promise<void>;
  ref: () => ReturnType<typeof collection>;

  /**
   * Realtime kuzatish. To'xtatish uchun qaytarilgan funksiyani chaqiring.
   */
  watch: (
    callback: (data: T[]) => void,
    ...constraints: QueryConstraint[]
  ) => () => void;
}

function createCollection<T extends { id?: string }>(
  collectionName: string,
): CollectionMethods<T> {
  return {
    ref: () => collection(database, collectionName),
    // ...
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

    watch: (callback, ...constraints) => {
      const colRef = collection(database, collectionName);
      const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
        callback(data);
      });
    },
  };
}

function createSubCollection<T extends { id?: string }>(
  parentPath: string,
  subName: string,
): (parentId: string) => CollectionMethods<T> {
  return (parentId: string) => {
    const path = `${parentPath}/${parentId}/${subName}`;
    return {
      ref: () => collection(database, path),
      list: async (...constraints: QueryConstraint[]): Promise<T[]> => {
        const colRef = collection(database, path);
        const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
        const snapshot = await getDocs(q);
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
      },
      get: async (id: string): Promise<T | null> => {
        const docRef = doc(database, path, id);
        const docSnap = await getDoc(docRef);
        if (!docSnap.exists()) return null;
        return { id: docSnap.id, ...docSnap.data() } as T;
      },
      create: async (data: Omit<T, "id">): Promise<string> => {
        const docRef = await addDoc(collection(database, path), data);
        return docRef.id;
      },
      update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
        const ref = doc(database, path, id);
        await updateDoc(ref, data as any);
      },
      delete: async (id: string): Promise<void> => {
        const ref = doc(database, path, id);
        await deleteDoc(ref);
      },
      watch: (callback, ...constraints) => {
        const colRef = collection(database, path);
        const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;
        return onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as T);
          callback(data);
        });
      },
    };
  };
}

// ─── Typed DB Object ──────────────────────────────────────────────────────────
const _db = {
  users: createCollection<User>("users"),
  lots: createCollection<ProductLot>("lots"),
  orders: createCollection<Order>("orders"),
  products: createCollection<Product>("products"),
  regions: createCollection<Region>("regions"),
  districts: createCollection<District>("districts"),
  customers: createCollection<Customer>("customers"),
  tags: createCollection<Tag>("tags"),
  rates: createCollection<Rate>("rates"),
  lost_products: createCollection<LostProduct>("lost_products"),
  leads: createCollection<Lead>("leads"),
  lead_chats: createCollection<LeadChat>("lead_chats"),
  lead_messages: createSubCollection<LeadMessage>("lead_chats", "messages"),
};

type DBType = typeof _db & { [K in CollectionName]: CollectionMethods<CollectionEntityMap[K]> };

const db = _db as DBType;

export default db;
