import { doc, setDoc } from "firebase/firestore";
import { database } from "../firebase";
import { districts } from "./districts";
import { regions } from "./regions";

/**
 * Migrates Regions and Districts data to Firestore using a flat architecture.
 * regions/{id} -> { name }
 * districts/{id} -> { name, regionId }
 */
export async function migrate() {
  console.log("🚀 Migration boshlandi...");

  // 1. Regions: regions/{id}
  for (const region of regions) {
    const { id, name } = region;
    await setDoc(doc(database, "regions", id), { name });
    console.log(`  ✓ Region saqlandi: ${name} (${id})`);
  }

  // 2. Mapping between districts.region_id and regions.id
  const regionKeyMap = {
    "Toshkent sh.": "toshkent_sh",
    "Toshkent vil.": "toshkent_v",
    Andijon: "andijon",
    Buxoro: "buxoro",
    Fargona: "fargona",
    Samarqand: "samarqand",
    Namangan: "namangan",
    Jizzax: "jizzax",
    Xorazm: "xorazm",
    Navoiy: "navoiy",
    Qashqadaryo: "qashqadaryo",
    Qoraqalpogiston: "qoraqalpogiston",
    Sirdaryo: "sirdaryo",
    Surxondaryo: "surxondaryo",
  };

  // 3. Districts: districts/{id} (Flat collection with regionId)
  let count = 0;
  for (const district of districts) {
    const { id, name, region_id } = district;
    const regionFirestoreId = regionKeyMap[region_id];

    if (!regionFirestoreId) {
      console.warn(
        `  ⚠ Noma'lum region_id: "${region_id}" (district: ${name})`,
      );
      continue;
    }

    await setDoc(doc(database, "districts", id), {
      name: name,
      regionId: regionFirestoreId,
    });

    count++;
    if (count % 20 === 0) {
      console.log(`  ... ${count} ta tuman saqlandi`);
    }
  }

  console.log(
    `✅ Migration muvaffaqiyatli yakunlandi! Jami: ${count} ta tuman.`,
  );
}
