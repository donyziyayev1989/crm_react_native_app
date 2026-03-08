import db from "../../services/database";
import { districs } from "./districts";
import { regions } from "./regions";

export async function migrate() {
  console.log("Starting migration...")
  for (const region of regions) {
    await db.regions.create(region);
  }
  for (const district of districs) {
    await db.districts.create(district);
  }
  console.log("Migration completed");
}

