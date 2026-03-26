import { database } from "@/firebase/firebase";
import { 
  Customer, 
  District, 
  ProductLot, 
  Region,
  Order,
  Product,
  Tag,
  Rate,
  LostProduct,
  Lead,
  LeadChat,
  LeadMessage,
  FAQ,  
  User,
  LotExpense
} from "@interfaces/index";
import * as jsFirestore from "firebase/firestore";
import { Platform } from "react-native";

// Native Modular API (v23+)
import * as nativeFirestore from '@react-native-firebase/firestore';

const isWeb = Platform.OS === 'web';

// Har ikkala SDK funksiyalarini bitta ob'ektga yig'amiz
const f: any = isWeb ? jsFirestore : nativeFirestore;

// ─── Query Constraints ──────────────────────────────────────────────────────
export const where = f.where;
export const orderBy = f.orderBy;
export const limit = f.limit;
export const startAfter = f.startAfter;
export const startAt = f.startAt;
export const endAt = f.endAt;
export const endBefore = f.endBefore;

/**
 * Generative Collection Wrapper (Modular v9/v23 style)
 */
function createCollection<T>(
  collectionName: string,
): CollectionMethods<T> {
  const getColRef = () => f.collection(database as any, collectionName);

  return {
    ref: getColRef,

    list: async (...constraints: any[]): Promise<T[]> => {
      const colRef = getColRef();
      const q = constraints.length > 0 ? f.query(colRef, ...constraints) : colRef;
      const snapshot = await f.getDocs(q);
      return snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
    },

    get: async (id: string): Promise<T | null> => {
      const docRef = f.doc(database as any, collectionName, id);
      const docSnap = await f.getDoc(docRef);
      // Native v23 check exists via .exists, Web via .exists()
      const exists = isWeb ? docSnap.exists() : (docSnap as any).exists;
      if (!exists) return null;
      return { id: docSnap.id, ...docSnap.data() } as T;
    },

    create: async (data: Omit<T, "id">): Promise<string> => {
      const docRef = await f.addDoc(getColRef(), data);
      return docRef.id;
    },

    update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
      const ref = f.doc(database as any, collectionName, id);
      await f.updateDoc(ref, data as any);
    },

    delete: async (id: string): Promise<void> => {
      const ref = f.doc(database as any, collectionName, id);
      await f.deleteDoc(ref);
    },

    set: async (id: string, data: Partial<T>): Promise<void> => {
      const ref = f.doc(database as any, collectionName, id);
      await f.setDoc(ref, data, { merge: true });
    },

    watch: (callback: (data: T[]) => void, ...constraints: any[]) => {
      const colRef = getColRef();
      const q = constraints.length > 0 ? f.query(colRef, ...constraints) : colRef;
      return f.onSnapshot(q, (snapshot: any) => {
        const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
        callback(data);
      }, (error: any) => {
        console.error(`Error watching ${collectionName}:`, error);
      });
    },
  };
}

/**
 * Generative Sub-Collection Wrapper
 */
function createSubCollection<T>(
  parentPath: string,
  subName: string,
): (parentId: string) => CollectionMethods<T> {
  return (parentId: string) => {
    const path = `${parentPath}/${parentId}/${subName}`;
    const getSubColRef = () => f.collection(database as any, path);

    return {
      ref: getSubColRef,
      list: async (...constraints: any[]): Promise<T[]> => {
        const colRef = getSubColRef();
        const q = constraints.length > 0 ? f.query(colRef, ...constraints) : colRef;
        const snapshot = await f.getDocs(q);
        return snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
      },
      get: async (id: string): Promise<T | null> => {
        const docRef = f.doc(database as any, path, id);
        const docSnap = await f.getDoc(docRef);
        const exists = isWeb ? docSnap.exists() : (docSnap as any).exists;
        if (!exists) return null;
        return { id: docSnap.id, ...docSnap.data() } as T;
      },
      create: async (data: Omit<T, "id">): Promise<string> => {
        const docRef = await f.addDoc(getSubColRef(), data);
        return docRef.id;
      },
      update: async (id: string, data: Partial<Omit<T, "id">>): Promise<void> => {
        const ref = f.doc(database as any, path, id);
        await f.updateDoc(ref, data as any);
      },
      delete: async (id: string): Promise<void> => {
        const ref = f.doc(database as any, path, id);
        await f.deleteDoc(ref);
      },
      set: async (id: string, data: Partial<T>): Promise<void> => {
        const ref = f.doc(database as any, path, id);
        await f.setDoc(ref, data, { merge: true });
      },
      watch: (callback, ...constraints) => {
        const colRef = getSubColRef();
        const q = constraints.length > 0 ? f.query(colRef, ...constraints) : colRef;
        return f.onSnapshot(q, (snapshot: any) => {
          const data = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }) as T);
          callback(data);
        }, (err: any) => {
          console.error(`Error watching ${path}:`, err);
        });
      },
    };
  };
}

// ─── Database Exports ───────────────────────────────────────────────────────
const db = {
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
  // Sub-collections
  lead_messages: createSubCollection<LeadMessage>("lead_chats", "messages"),
  faqs: createCollection<FAQ>("faqs"),
  settings: createCollection<any>("settings"),
  lot_expenses: createCollection<LotExpense>("lot_expenses"),
};

export default db;

// Types
export interface CollectionMethods<T> {
  ref: () => any;
  list: (...constraints: any[]) => Promise<T[]>;
  get: (id: string) => Promise<T | null>;
  create: (data: Omit<T, "id">) => Promise<string>;
  update: (id: string, data: Partial<Omit<T, "id">>) => Promise<void>;
  delete: (id: string) => Promise<void>;
  set: (id: string, data: Partial<T>) => Promise<void>;
  watch: (callback: (data: T[]) => void, ...constraints: any[]) => () => void;
}
