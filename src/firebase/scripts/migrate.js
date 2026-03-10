import { doc, setDoc } from "firebase/firestore";
import { database } from "../../firebase/firebase";
import { districs } from "./districts";
import { regions } from "./regions";

export async function migrate() {
  console.log("Migration boshlandi...");

  // ─── 1. Regions: aniq ID bilan saqlash ──────────────────────────────────────
  // regions[].id → Firestore document ID sifatida ishlatiladi
  const regionIdMap = {}; // { "Fargona": "fargona", "Andijon": "andijon", ... }

  for (const region of regions) {
    const { id, ...data } = region;
    await setDoc(doc(database, "regions", id), data);
    // districts.js dagi region_id ("Fargona") → Firestore ID ("fargona") ga map
    regionIdMap[data.name] = id;
    console.log(`  ✓ Region: ${data.name} (ID: ${id})`);
  }

  // ─── 2. Districts: regions/{regionId}/districts subcollectionga yozish ──────
  // districts.js dagi region_id maydoni region.name bilan mos keladi
  // Masalan: "Fargona" → regionIdMap["Farg'ona"] = "fargona"

  // region_id → Firestore region ID ga sodda mapping (to'g'ridan-to'g'ri)
  const regionKeyMap = {
    "Toshkent sh.":    "toshkent_sh",
    "Toshkent vil.":   "toshkent_v",
    "Andijon":         "andijon",
    "Buxoro":          "buxoro",
    "Fargona":         "fargona",
    "Samarqand":       "samarqand",
    "Namangan":        "namangan",
    "Jizzax":          "jizzax",
    "Xorazm":          "xorazm",
    "Navoiy":          "navoiy",
    "Qashqadaryo":     "qashqadaryo",
    "Qoraqalpogiston": "qoraqalpogiston",
    "Sirdaryo":        "sirdaryo",
    "Surxondaryo":     "surxondaryo",
  };

  for (const district of districs) {
    const { id, region_id, ...data } = district;
    const regionFirestoreId = regionKeyMap[region_id];

    if (!regionFirestoreId) {
      console.warn(`  ⚠ Noma'lum region_id: "${region_id}" (district: ${data.name})`);
      continue;
    }

    // Subcollectionga explicit ID bilan yozish
    await setDoc(
      doc(database, "regions", regionFirestoreId, "districts", id),
      data   // faqat { name } — region ma'lumoti path da
    );
    console.log(`  ✓ District: ${data.name} → regions/${regionFirestoreId}/districts/${id}`);
  }

  console.log("Migration muvaffaqiyatli yakunlandi!");
}
