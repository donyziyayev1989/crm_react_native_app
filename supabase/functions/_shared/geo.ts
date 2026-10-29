// Koordinatalardan viloyat/tuman aniqlash (OSM Nominatim) va O'zbekiston viloyat nomlarini normallashtirish.
// Sof mantiq: Deno ham, Node ham ishlata oladi (fetch injeksiya qilinadi).

export interface NominatimAddress {
  state?: string;
  province?: string;
  region?: string;
  city?: string;
  town?: string;
  county?: string;
  municipality?: string;
  city_district?: string;
  district?: string;
  village?: string;
  suburb?: string;
}

export interface AddressDetails {
  region: string;
  district: string;
}

export const UNKNOWN_REGION = "Noma'lum viloyat";
export const UNKNOWN_DISTRICT = "Noma'lum tuman";

/** Nominatim manzilidan CRM uchun viloyat va tuman nomi (functions/index.js bilan bir xil mantiq). */
export function normalizeAddress(address: NominatimAddress): AddressDetails {
  let region =
    address.state ||
    address.province ||
    address.region ||
    address.city ||
    address.town ||
    address.county ||
    address.municipality ||
    UNKNOWN_REGION;

  const district = (
    address.city_district ||
    address.county ||
    address.district ||
    address.town ||
    address.city ||
    address.village ||
    address.suburb ||
    UNKNOWN_DISTRICT
  )
    .replace(/ tumani| tuman/gi, "")
    .trim();

  const r = region.toLowerCase();

  if (r.includes("toshkent")) {
    // Toshkent shahri vs viloyati
    if (address.city === "Toshkent" || (!r.includes("viloyat") && !r.includes("region"))) {
      region = "Toshkent shahri";
    } else {
      region = "Toshkent viloyati";
    }
  } else if (r.includes("andijon")) region = "Andijon";
  else if (r.includes("buxoro")) region = "Buxoro";
  else if (r.includes("fargona") || r.includes("farg'ona") || r.includes("fergana")) region = "Farg'ona";
  else if (r.includes("jizzax")) region = "Jizzax";
  else if (r.includes("xorazm")) region = "Xorazm";
  else if (r.includes("namangan")) region = "Namangan";
  else if (r.includes("navoiy")) region = "Navoiy";
  else if (r.includes("qashqadaryo") || r.includes("kashkadarya")) region = "Qashqadaryo";
  else if (r.includes("qoraqalpog") || r.includes("karakalpak")) region = "Qoraqalpog'iston Respublikasi";
  else if (r.includes("samarqand")) region = "Samarqand";
  else if (r.includes("sirdaryo")) region = "Sirdaryo";
  else if (r.includes("surxondaryo")) region = "Surxondaryo";

  return { region, district };
}

export async function getAddressDetails(
  lat: number,
  lng: number,
  fetchImpl: typeof fetch = fetch,
  baseUrl = "https://nominatim.openstreetmap.org",
): Promise<AddressDetails> {
  try {
    const url = new URL(`${baseUrl}/reverse`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("accept-language", "uz");
    const res = await fetchImpl(url, { headers: { "User-Agent": "CRM-App-Bot" } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const data = await res.json();
    return normalizeAddress(data.address ?? {});
  } catch {
    return { region: UNKNOWN_REGION, district: UNKNOWN_DISTRICT };
  }
}
