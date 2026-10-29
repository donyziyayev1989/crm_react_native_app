// Removed axios in favor of native fetch API for better compatibility and error handling

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface MapboxRoute {
  geometry: string;
  distance: number;
  duration: number;
  waypoints: any[];
}

export interface MapboxMatrix {
  distances: number[][];
  durations: number[][];
}

export const MapboxService = {
  geocode: async (
    region: string,
    district?: string,
  ): Promise<Coordinate | null> => {
    try {
      const query = `${district ? district + ", " : ""}${region}, Uzbekistan`;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1&types=district,place,locality,region`;

      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        return { latitude: lat, longitude: lng };
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Get optimized route for multiple coordinates
   */
  getOptimizedRoute: async (
    coordinates: Coordinate[],
  ): Promise<MapboxRoute | null> => {
    // Basic validation
    const validPoints = coordinates.filter(
      (c) => c && typeof c.latitude === "number" && typeof c.longitude === "number",
    );
    if (validPoints.length < 2) return null;
    const points = validPoints.length > 12 ? validPoints.slice(0, 12) : validPoints;

    try {
      const coordsString = points
        .map((c) => `${c.longitude},${c.latitude}`)
        .join(";");
      
      const tryFetch = async (profile: string) => {
        const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/${profile}/${coordsString}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full&steps=true&source=first`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
        return null;
      };

      // Try driving-traffic first, then fallback to driving
      let data = await tryFetch("driving-traffic");
      if (!data) data = await tryFetch("driving");

      if (data && data.trips && data.trips.length > 0) {
        const trip = data.trips[0];
        return {
          geometry: trip.geometry,
          distance: trip.distance,
          duration: trip.duration,
          waypoints: data.waypoints || [],
        };
      }
      return null;
    } catch (error) {
      console.error("Optimization error:", error);
      return null;
    }
  },

  /**
   * Calculate distance between two points in km
   */
  getDistance: (p1: Coordinate, p2: Coordinate): number => {
    const R = 6371; // Earth radius in km
    const dLat = (p2.latitude - p1.latitude) * (Math.PI / 180);
    const dLng = (p2.longitude - p1.longitude) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.latitude * (Math.PI / 180)) *
        Math.cos(p2.latitude * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Get simple directions between points in order
   */
  getDirections: async (
    coordinates: Coordinate[],
  ): Promise<MapboxRoute | null> => {
    const validPoints = coordinates.filter(
      (c) => c && typeof c.latitude === "number" && typeof c.longitude === "number",
    );
    if (validPoints.length < 2) return null;
    // Mapbox Directions API supports max 25 coordinates
    const points = validPoints.length > 25 ? validPoints.slice(0, 25) : validPoints;

    try {
      const coordsString = points
        .map((c) => `${c.longitude},${c.latitude}`)
        .join(";");
      
      const tryFetch = async (profile: string) => {
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordsString}?access_token=${MAPBOX_ACCESS_TOKEN}&geometries=geojson&overview=full&steps=true&exclude=controlled_border`;
        const res = await fetch(url);
        if (res.ok) return await res.json();
        return null;
      };

      // Try driving-traffic first, fallback to standard driving
      let data = await tryFetch("driving-traffic");
      if (!data) data = await tryFetch("driving");

      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          waypoints: [],
        };
      }
      return null;
    } catch (error) {
      console.error("Directions error:", error);
      return null;
    }
  },

  /**
   * Get driving distances and durations matrix between coordinates (limit 25)
   */
  getMatrix: async (
    coordinates: Coordinate[],
  ): Promise<MapboxMatrix | null> => {
    if (coordinates.length < 2) return null;
    // Matrix API limits to 25
    const coords = coordinates.slice(0, 25);

    try {
      const coordsString = coords
        .map((c) => `${c.longitude},${c.latitude}`)
        .join(";");
      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordsString}?annotations=distance,duration&access_token=${MAPBOX_ACCESS_TOKEN}&exclude=controlled_border`;

      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();

      if (data.distances && data.durations) {
        return {
          distances: data.distances,
          durations: data.durations,
        };
      }
      return null;
    } catch (error) {
      console.error("Matrix error:", error);
      return null;
    }
  },
  /**
   * Reverse geocode coordinates to region and district
   */
  reverseGeocode: async (
    lat: number,
    lng: number,
  ): Promise<{ region: string; district: string } | null> => {
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_ACCESS_TOKEN}&types=region,district&limit=5`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();

      let region = "";
      let district = "";

      if (data.features) {
        const regionFeat = data.features.find((f: any) =>
          f.place_type.includes("region"),
        );
        const districtFeat = data.features.find((f: any) =>
          f.place_type.includes("district"),
        );

        region = regionFeat?.text || "";
        district = districtFeat?.text || "";
      }

      return { region, district };
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      return null;
    }
  },
};
