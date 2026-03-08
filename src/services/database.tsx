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

// ─── Re-export Firestore query helpers ───────────────────────────────────────
// Shunday qilib foydalanuvchi faqat database.tsx dan import qilsa yetarli
export {
    endAt,
    endBefore,
    limit,
    limitToLast,
    orderBy,
    startAfter,
    startAt,
    where
} from "firebase/firestore";

// ─── Interface ────────────────────────────────────────────────────────────────

interface CollectionMethods {
  /**
   * Collectiondagi hujjatlarni qaytaradi.
   * Firestore ning native constraint larini spread argument sifatida qabul qiladi.
   *
   * @example
   * import db, { where, orderBy, limit } from "../../services/database";
   *
   * // Barchasi
   * db.users.list()
   *
   * // Bitta shart
   * db.users.list(where("name", "==", "Doniyor"))
   *
   * // Bir nechta shart
   * db.orders.list(
   *   where("status", "==", "pending"),
   *   where("total", ">", 100),
   *   orderBy("createdAt", "desc"),
   *   limit(20)
   * )
   */
  list: (...constraints: QueryConstraint[]) => Promise<any[]>;

  /**
   * ID bo'yicha bitta hujjatni qaytaradi.
   * @example
   * db.users.get("abc123")
   */
  get: (id: string) => Promise<any>;

  /**
   * Yangi hujjat yaratadi va uning ID sini qaytaradi.
   * @example
   * const id = await db.users.create({ name: "Ali" })
   */
  create: (data: any) => Promise<string>;

  /**
   * Mavjud hujjatni yangilaydi.
   * @example
   * await db.users.update("abc123", { name: "Vali" })
   */
  update: (id: string, data: any) => Promise<void>;

  /**
   * Hujjatni o'chiradi.
   * @example
   * await db.users.delete("abc123")
   */
  delete: (id: string) => Promise<void>;
}

// ─── DB Builder ───────────────────────────────────────────────────────────────

const db: { [key: string]: CollectionMethods } = {};
const collections = ["users", "orders", "customers", "products"];

collections.forEach((collectionName) => {
  db[collectionName] = {
    list: async (...constraints: QueryConstraint[]) => {
      const colRef = collection(database, collectionName);
      const q = constraints.length > 0 ? query(colRef, ...constraints) : colRef;

      const snapshot = await getDocs(q);
      const data: any[] = [];
      snapshot.forEach((d) => data.push({ id: d.id, ...d.data() }));
      return data;
    },

    get: async (id: string) => {
      const docRef = doc(database, collectionName, id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) return null;
      return { id: docSnap.id, ...docSnap.data() };
    },

    create: async (data: any) => {
      const docRef = await addDoc(collection(database, collectionName), data);
      return docRef.id;
    },

    update: async (id: string, data: any) => {
      const ref = doc(database, collectionName, id);
      await updateDoc(ref, data);
    },

    delete: async (id: string) => {
      const ref = doc(database, collectionName, id);
      await deleteDoc(ref);
    },
  };
});

export default db;
