import {
  Customer,
  District,
  Product,
  ProductLot,
  Region,
  Tag,
  User,
  WithId,
} from "@/interfaces";
import { federatedOnAuthStateChanged } from "@/firebase/firebase";
import db, { orderBy } from "@/services/database";
import { districtsOfRegion } from "@/utils/regions";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Reference kolleksiyalar uchun ilova darajasida BITTA watch.
 * Ilgari har ekran/modal o'zi products, lots, customers... ni alohida kuzatardi.
 */

export interface RefData {
  regions: WithId<Region>[];
  districts: WithId<District>[];
  products: WithId<Product>[];
  tags: WithId<Tag>[];
  lots: WithId<ProductLot>[];
  users: WithId<User>[];
  customers: WithId<Customer>[];
  productsById: Record<string, WithId<Product>>;
  lotsById: Record<string, WithId<ProductLot>>;
  usersById: Record<string, WithId<User>>;
  customersById: Record<string, WithId<Customer>>;
  tagsById: Record<string, WithId<Tag>>;
  /** Birinchi snapshot hammasidan kelguncha true */
  loading: boolean;
}

const byId = <T extends { id: string }>(items: T[]): Record<string, T> => {
  const map: Record<string, T> = {};
  for (const item of items) map[item.id] = item;
  return map;
};

const INITIAL_LOADED = {
  regions: false,
  districts: false,
  products: false,
  tags: false,
  lots: false,
  users: false,
  customers: false,
};
type Key = keyof typeof INITIAL_LOADED;
const ALL_LOADED: typeof INITIAL_LOADED = {
  regions: true,
  districts: true,
  products: true,
  tags: true,
  lots: true,
  users: true,
  customers: true,
};

const RefDataContext = createContext<RefData | null>(null);

export const ReferenceDataProvider = ({ children }: { children: ReactNode }) => {
  const [regions, setRegions] = useState<WithId<Region>[]>([]);
  const [districts, setDistricts] = useState<WithId<District>[]>([]);
  const [products, setProducts] = useState<WithId<Product>[]>([]);
  const [tags, setTags] = useState<WithId<Tag>[]>([]);
  const [lots, setLots] = useState<WithId<ProductLot>[]>([]);
  const [users, setUsers] = useState<WithId<User>[]>([]);
  const [customers, setCustomers] = useState<WithId<Customer>[]>([]);
  const [loaded, setLoaded] = useState(INITIAL_LOADED);

  useEffect(() => {
    const mark = (key: Key) =>
      setLoaded((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    let unsubs: (() => void)[] = [];
    const stopWatching = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };

    // firestore.rules faqat login qilgan foydalanuvchiga o'qishga ruxsat beradi.
    // Login'dan oldin ochilgan listener permission-denied bilan o'ladi va qayta
    // tiklanmaydi, shuning uchun watch'lar auth holatiga bog'lab ochiladi.
    const unsubAuth = federatedOnAuthStateChanged((user) => {
      stopWatching();
      if (!user) {
        setRegions([]);
        setDistricts([]);
        setProducts([]);
        setTags([]);
        setLots([]);
        setUsers([]);
        setCustomers([]);
        setLoaded(ALL_LOADED); // bo'sh, lekin "yuklanmoqda" emas
        return;
      }
      setLoaded(INITIAL_LOADED);
      unsubs = [
        db.regions.watch((d) => { setRegions(d as WithId<Region>[]); mark("regions"); }, orderBy("name", "asc")),
        db.districts.watch((d) => { setDistricts(d as WithId<District>[]); mark("districts"); }, orderBy("name", "asc")),
        db.products.watch((d) => { setProducts(d as WithId<Product>[]); mark("products"); }, orderBy("name", "asc")),
        db.tags.watch((d) => { setTags(d as WithId<Tag>[]); mark("tags"); }, orderBy("name", "asc")),
        db.lots.watch((d) => { setLots(d as WithId<ProductLot>[]); mark("lots"); }, orderBy("date", "desc")),
        db.users.watch((d) => { setUsers(d as WithId<User>[]); mark("users"); }),
        db.customers.watch((d) => { setCustomers(d as WithId<Customer>[]); mark("customers"); }, orderBy("name", "asc")),
      ];
    });

    return () => {
      unsubAuth();
      stopWatching();
    };
  }, []);

  const value = useMemo<RefData>(
    () => ({
      regions,
      districts,
      products,
      tags,
      lots,
      users,
      customers,
      productsById: byId(products),
      lotsById: byId(lots),
      usersById: byId(users),
      customersById: byId(customers),
      tagsById: byId(tags),
      loading: !Object.values(loaded).every(Boolean),
    }),
    [regions, districts, products, tags, lots, users, customers, loaded],
  );

  return <RefDataContext.Provider value={value}>{children}</RefDataContext.Provider>;
};

export const useRefData = (): RefData => {
  const ctx = useContext(RefDataContext);
  if (!ctx) {
    throw new Error("useRefData faqat ReferenceDataProvider ichida ishlaydi");
  }
  return ctx;
};

/** Viloyat ID bo'yicha tumanlar (legacy regionId lar bilan) */
export const useDistrictsOfRegion = (regionId: string | null | undefined) => {
  const { districts } = useRefData();
  return useMemo(() => districtsOfRegion(districts, regionId), [districts, regionId]);
};
