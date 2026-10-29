# Firestore o'qishlarini kamaytirish va takroriy kodni birlashtirish

Sana: 2026-10-13
Holat: tasdiqlangan

## Maqsad

1. Firestore o'qishlar sonini kamaytirish: reference kolleksiyalar (regions, districts,
   products, tags, lots, users, customers) uchun ilova darajasida bitta `watch`; `orders`
   uchun limit; `lots` ro'yxatida barcha buyurtmalarni yuklamaslik.
2. Bir xil mantiq bir joyda bo'lsin: telefon, pul va sana formatlash, region/tuman tanlash,
   lost/expense ro'yxatlari, products/tags CRUD ekranlari, swipeable qatorlar, loading.

Pagination (customers uchun) va `any` tiplarni to'liq tozalash bu ishga kirmaydi.

## Hozirgi holat (muammo)

- `src/services/database.tsx` kesh bermaydi. 42 ta alohida `db.*.list/watch` chaqiruvi bor,
  ~30 tasi yuqoridagi 7 kolleksiyaga. `list()` har safar serverdan o'qiydi.
- `orders/index.tsx` har focus'da `orders + customers + products + users + lots` ni `list()`
  bilan to'liq yuklaydi, limit yo'q.
- `lots/index.tsx` barcha `orders` ni watch qiladi, faqat partiya bo'yicha `product_count`
  yig'indisi uchun.
- `OrderModal` 6 joyda mount qilingan; har ochilganda 4 ta watch (shu jumladan barcha
  customers) va region bo'yicha 3 tagacha ketma-ket `districts.list` so'rovi.
- Bitta hujjat uchun `watch(where("__name__", "==", id))` + `.find` ishlatiladi
  (`customers/[id]`, `lots/[id]`, `lots/dashboard/[id]`, `TelegramChat`).
- `LotMapView` har snapshot'da geocoding va Mapbox route API ni qayta chaqiradi.
- Telefon normalizatsiyasi ~8 joyda, `" so'm"` ~20 joyda, region/tuman tanlash 2 joyda
  (turli mantiq bilan), lost/expense UI 2 nusxada, `products/index` va `tags/index`
  deyarli bir xil.

## Dizayn

### 1. `ReferenceDataProvider` — `src/providers/ReferenceData.tsx`

React Context. Root `src/app/_layout.tsx` da `<Stack>` ni o'raydi. Mount bo'lganda har
kolleksiyaga **bitta** `db.<col>.watch` ochadi va ilova yopilguncha ushlab turadi:

| Kolleksiya | Tartib | Izoh |
|---|---|---|
| regions | `orderBy("name")` | |
| districts | `orderBy("name")` | region bo'yicha filtr xotirada |
| products | `orderBy("name")` | |
| tags | `orderBy("name")` | |
| lots | `orderBy("date", "desc")` | |
| users | — | |
| customers | `orderBy("name")` | katta, lekin 6 ekran uni to'liq ishlatadi |

Context qiymati (barchasi `useMemo`):

```ts
interface RefData {
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
  loading: boolean; // birinchi snapshot hammasidan kelguncha true
}
export const useRefData = (): RefData
export const useDistrictsOfRegion = (regionId: string | null): WithId<District>[]
```

`WithId<T> = T & { id: string }` — `src/interfaces/index.ts` ga qo'shiladi va
`X & { id: string }` takrorlari o'rniga ishlatiladi (faqat tegilgan fayllarda).

Ekranlardan o'chiriladigan subscription'lar: products (8), lots (9), users (6),
customers (6), regions (3), tags (4), districts (2). Ularning o'rniga `useRefData()`.

### 2. `database.tsx` ga qo'shimchalar

```ts
watchDoc: (id: string, cb: (data: T | null) => void) => () => void
sum: (field: keyof T & string, ...constraints: any[]) => Promise<number>
```

- `watchDoc` — doc-level `onSnapshot`. Web: `docSnap.exists()`, native: `.exists`.
  Ishlatish: `customers/[customerId]`, `lots/[lotId]`, `lots/dashboard/[lotId]`.
  `TelegramChat` da esa `customers.get(chatId)` (faqat mavjudlik tekshiruvi).
- `sum` — `getAggregateFromServer(query, { total: sum(field) })`. Web `firebase@12` va
  `@react-native-firebase/firestore@23` ikkalasida bor. Ikkala SDK'da ham `sum` va
  `getAggregateFromServer` nomi bir xil, shuning uchun `f.sum` / `f.getAggregateFromServer`
  orqali chaqiriladi.

### 3. Ekranlar bo'yicha o'qish o'zgarishlari

| Fayl | Hozir | Bo'ladi |
|---|---|---|
| `orders/index.tsx` | `list()` ×5, har focus'da | `orders.watch(orderBy("date","desc"), limit(N))`, N=50, "Yana yuklash" → N+=50; qolgani `useRefData` |
| `lots/index.tsx` | `orders.watch()` hammasi | focus'da har lot uchun `orders.sum("product_count", where("lotId","==",id))` — `Promise.all`, natija `Record<lotId, number>` |
| `lots/[lotId].tsx` | lot: `where __name__`; customers/products/users watch | `lots.watchDoc`; qolgani `useRefData` |
| `lots/dashboard/[lotId].tsx` | lot: `where __name__` | `lots.watchDoc`; JS `.sort` olib tashlanadi (Firestore `orderBy` bor) |
| `customers/[customerId].tsx` | `where __name__`; har snapshot'da `lots.get` loop | `customers.watchDoc`; `lotsById` |
| `lots/[lotId]/map.tsx` | customers, products `list()` | `useRefData` |
| `OrderModal.tsx` | 4 watch + districts loop | `useRefData`, `useDistrictsOfRegion`; `idMap` → `utils/regions.ts` |
| `CustomerForm.tsx`, `Search.tsx` | regions/tags/lots/districts watch | `useRefData` |
| `messages/index.tsx` | customers + leads watch | customers → `useRefData`; leads qoladi |
| `TelegramChat.tsx` | users watch, customers `where __name__` | `usersById`; `customers.get` |
| `CustomerList.tsx` | `tags.list()` har mount | `tagsById` |
| `about-us.tsx` | `settings.watch()` + find | `settings.get("about_us")` |
| `LotMapView.tsx` | har snapshot'da geocode + route | geocode natijasi `useRef<Map<orderId, Coordinate>>` da; `calculateRoute` dependency — `orders` dan hosil qilingan `routeKey` (id+lat+lng birlashmasi), `customers` olib tashlanadi |

### 4. Takroriy kodni birlashtirish

**`src/utils/phone.ts`**
- `digitsOnly(s)`, `last9(s)`, `phonesMatch(a, b)` (oxirgi 9 raqam),
  `phoneVariants(s)` → `[9 raqam, 998+9, "+998 " formatli]` (CustomerForm:161-174 va
  search_results:29-45 dan), `formatPhone` (`format.tsx` dan ko'chiriladi, u yerda re-export
  qoladi).
- Almashtiriladi: `PhoneInput` (2 joy), `OrderModal`, `messages/index`, `LotMapView`,
  `CustomerForm` (3 joy), `search_results`.

**`src/utils/format.tsx`**
- `formatMoney(n)` o'zgarmaydi (`"12 000"`, dashboard'da `so'm` alohida stilda). Yangi
  `formatSum(n)` → `"12 000 so'm"`. Hamma `.toLocaleString()` + `" so'm"` joylari
  `formatSum` ga almashtiriladi.
- `formatTime(iso)`, `formatDateLabel(iso)` (TelegramChat:142-180 dan, o'zbek oy nomlari).
- `parseNum(val)` (dashboard:99-104 dan).

**`src/utils/regions.ts` + `src/components/RegionDistrictSelect.tsx`**
- `normalizeRegionName(s)` — OrderModal `normalizeStr` + CustomerForm `normalize` +
  Toshkent special-case bitta funksiya.
- `REGION_ID_ALIASES` — OrderModal:98-117 `idMap`.
- `findRegion(regions, name)`, `districtsOfRegion(districts, regionId)` (alias'lar bilan).
- `RegionDistrictSelect` props: `regionName`, `districtName`,
  `onChange({ region_name, district_name })`. Ichida ikki `Select`. Ishlatiladi:
  `OrderModal`, `CustomerForm`, `Search` (Search'da faqat region kerak bo'lsa
  `districtless` prop).

**`src/components/LotLostList.tsx`, `src/components/LotExpenseList.tsx`**
- `lots/[lotId].tsx:328-492` dan (ScrollView ro'yxatlar, qo'shish/tahrirlash/o'chirish).
  Dashboard'dagi jadvallar (`lots/dashboard/[lotId].tsx:254-371`) faqat o'qish uchun va
  ko'rinishi boshqacha — ular joyida qoladi, faqat formatlash utillariga o'tadi.
  Lost yig'indisini qayta hisoblash (`lots/[lotId]:463-473` va `LostProductModal:83-91`)
  → `services/lotStats.ts: recalcLostTotal(lotId)` (db ga tegadi, shuning uchun utils'da
  emas). Lost foizi (`lots/index:224-229`, `LostProductModal:122-124`) →
  `utils/lots.ts: lostPercent(lot)`.

**`src/components/SimpleCrudScreen.tsx`**
- `products/index.tsx` va `tags/index.tsx` ning umumiy qismi: watch, react-hook-form,
  `CustomModal`, edit/delete `Alert`. Props: `title`, `collection`, `fields`
  (name/label/keyboardType/required), `renderItem?`. Ikkala ekran ~30 qatorga tushadi.
  `faqt.tsx` tegilmaydi (struktura boshqacha).

**`src/hooks/useSwipeableRows.ts`**
- `rowRefs`, `closeRow`, `registerRow(id)` — `lots/index.tsx:25-34,91-120` va
  `CustomerList.tsx:15-16,50-56,84-118` dan.

**`src/components/Loading.tsx`**
- Markazlashgan `ActivityIndicator`; `styles.center` + spinner takrorlari o'rniga.

### 5. Tegilmaydigan narsalar

- `functions/` (Telegram bot) — alohida 4-bosqich.
- Customers pagination.
- `firebase.tsx` dagi `require()` lar.
- UI ko'rinishi — faqat kod joylashuvi o'zgaradi, ekranlar bir xil ko'rinishi kerak.

## Xatolar bilan ishlash

- Provider'dagi watch xatolari `console.error` + bo'sh massiv (hozirgi wrapper xulqi).
- `sum` xatosi → shu lot uchun `0`, ekran bloklanmaydi.
- `watchDoc` hujjat yo'q bo'lsa `null` → ekran "topilmadi" holatini ko'rsatadi (hozirgidek).

## Tekshirish

Avtomatik: `npx tsc --noEmit` → 0 xato; `npx expo lint` → 0 error.

Qo'lda (Android dev client):
1. Buyurtma qo'shish (tab "+"), telefon yozganda mijoz topilishi, region → tuman ro'yxati.
2. Buyurtmani tahrirlash — form to'ldirilgan, yozilgani o'chmaydi.
3. Partiyalar ro'yxatidagi buyurtma sonlari eski bilan bir xil.
4. Partiya ichida lost/expense qo'shish, o'chirish; dashboard'da ham ko'rinishi.
5. Mijozlar qidiruvi (telefon bo'yicha).
6. Xarita: route chiziladi, orders o'zgarmasa qayta hisoblanmaydi.
7. Products va Tags ekranlarida qo'shish/tahrirlash/o'chirish.

## Bajarish tartibi

1. `interfaces` `WithId`, `database.tsx` `watchDoc`/`sum`, `utils/phone|format|regions|lots`,
   `hooks/useSwipeableRows`, `components/Loading` — hech narsani buzmaydi.
2. `ReferenceDataProvider` + root layout.
3. Ekranlarni provider'ga o'tkazish (har ekran alohida, tsc har qadamda).
4. `RegionDistrictSelect`, `LotLostList/ExpenseList`, `SimpleCrudScreen`.
5. `orders/index` limit, `lots/index` sum, `LotMapView` kesh.
