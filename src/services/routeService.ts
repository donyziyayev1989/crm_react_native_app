import { Customer } from "@/interfaces";

/**
 * Route Optimization Service
 */
export const RouteService = {
  /**
   * Berilgan mijozlar ro'yxatini eng maqbul yo'nalish bo'yicha tartiblaydi.
   * Nearest Neighbor algoritmi (oddiy va samarali kichik hajmlar uchun).
   * 
   * @param customers Tanlangan mijozlar
   * @param startLocation Boshlang'ich nuqta (masalan, ombor yoki hozirgi joy)
   */
  optimizeRoute: (customers: Customer[], startLocation: { lat: number; lng: number }) => {
    const unvisited = [...customers].filter(c => c.location);
    const route: Customer[] = [];
    let currentPos = startLocation;

    while (unvisited.length > 0) {
      let closestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const dist = RouteService.calculateDistance(
          currentPos,
          unvisited[i].location!
        );
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      }

      const nextCustomer = unvisited.splice(closestIndex, 1)[0];
      route.push(nextCustomer);
      currentPos = nextCustomer.location!;
    }

    return route;
  },

  /**
   * Ikki nuqta orasidagi masofani hisoblash (Haversine formula)
   */
  calculateDistance: (p1: { lat: number; lng: number }, p2: { lat: number; lng: number }) => {
    const R = 6371; // Yer radiusi (km)
    const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
    const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1.lat * (Math.PI / 180)) *
        Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Generates a Google Maps navigation link for a sequence of points
   */
  getNavigationLink: (points: { latitude: number; longitude: number }[]) => {
    if (points.length < 2) return "";
    
    const origin = `${points[0].latitude},${points[0].longitude}`;
    const destination = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
    const waypoints = points.slice(1, -1).map(p => `${p.latitude},${p.longitude}`).join('|');
    
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=driving`;
  }
};
