import CustomModal from "@/components/CustomModal";
import { Customer, Order, Product, WithId } from "@/interfaces";
import db from "@/services/database";
import { Coordinate, MapboxService } from "@/services/mapboxService";
import { RouteService } from "@/services/routeService";
import { formatMoney, formatPhone, formatSum } from "@/utils/format";
import { digitsOnly } from "@/utils/phone";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
} from "@rnmapbox/maps";
import { callPhone } from "@utils/actions";
import { useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Initialize Mapbox
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
Mapbox.setAccessToken(accessToken);

interface LotMapViewProps {
  orders: (Order & { id: string })[];
  customers: (Customer & { id: string })[];
  products: (Product & { id: string })[];
  onOrderPress: (orderId: string) => void;
  onUpdate?: () => void;
}

const LotMapView: React.FC<LotMapViewProps> = ({
  orders,
  customers,
  products,
  onOrderPress,
  onUpdate,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Map<string, Coordinate>>(
    new Map(),
  );
  const [routeData, setRouteData] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<
    (Order & { id: string }) | null
  >(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [userCoord, setUserCoord] = useState<Coordinate | null>(null);
  const [orderedOrderIds, setOrderedOrderIds] = useState<string[]>([]);
  const [driverMode, setDriverMode] = useState(false);
  const [updatedStatuses, setUpdatedStatuses] = useState<
    Record<string, string>
  >({});
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const cameraRef = useRef<Camera>(null);

  // ID bo'yicha tez qidirish (ilgari har joyda .find() edi)
  const ordersById = useMemo(() => {
    const m: Record<string, WithId<Order>> = {};
    for (const o of orders) m[o.id] = o;
    return m;
  }, [orders]);
  const customersById = useMemo(() => {
    const m: Record<string, WithId<Customer>> = {};
    for (const c of customers) m[c.id] = c;
    return m;
  }, [customers]);
  const productsById = useMemo(() => {
    const m: Record<string, WithId<Product>> = {};
    for (const p of products) m[p.id] = p;
    return m;
  }, [products]);

  // Lokatsiyalarni qayta hisoblash faqat shu kalit o'zgarganda (har snapshot'da emas)
  const locationKey = useMemo(
    () =>
      orders
        .map((o) => {
          const c = customersById[o.customer_id];
          return [
            o.id,
            o.state,
            o.location?.lat ?? "",
            o.location?.lng ?? "",
            c?.location?.lat ?? "",
            c?.location?.lng ?? "",
            o.region_name || c?.region_name || "",
            o.district_name || c?.district_name || "",
          ].join(":");
        })
        .join("|"),
    [orders, customersById],
  );

  // Effektlar eng so'nggi ma'lumotni ref orqali oladi, dependency sifatida emas
  const ordersRef = useRef(ordersById);
  ordersRef.current = ordersById;
  const customersRef = useRef(customersById);
  customersRef.current = customersById;
  // Bir xil region/district uchun Mapbox geocode faqat bir marta chaqiriladi
  const geocodeCache = useRef(new Map<string, Coordinate | null>());

  // Nearest-neighbor fallback (when Mapbox API fails)
  const nearestNeighborOrder = useCallback(
    (locs: Map<string, Coordinate>, start: Coordinate): string[] => {
      const unvisited = Array.from(locs.entries());
      const ordered: string[] = [];
      let current = start;

      while (unvisited.length > 0) {
        let minDist = Infinity;
        let minIdx = 0;
        unvisited.forEach(([, coord], idx) => {
          // Simple Euclidean distance (good enough for ordering)
          const dLat = coord.latitude - current.latitude;
          const dLng = coord.longitude - current.longitude;
          const dist = dLat * dLat + dLng * dLng;
          if (dist < minDist) {
            minDist = dist;
            minIdx = idx;
          }
        });
        const [id, coord] = unvisited.splice(minIdx, 1)[0];
        ordered.push(id);
        current = coord;
      }
      return ordered;
    },
    [],
  );

  // Preparation logic extracted for reuse
  const calculateRoute = useCallback(
    async (
      currentLocations: Map<string, Coordinate>,
      startCoord?: Coordinate,
    ) => {
      const activeLocations = new Map<string, Coordinate>();
      for (const [id, coord] of currentLocations.entries()) {
        const order = ordersRef.current[id];
        if (order && order.state !== "done" && order.state !== "cancel") {
          activeLocations.set(id, coord);
        }
      }

      if (activeLocations.size === 0) {
        setOrderedOrderIds([]);
        setRouteData(null);
        return;
      }

      const coordList: Coordinate[] = [];
      const orderIds: string[] = [];

      // Always start from user location if available
      if (startCoord) {
        coordList.push(startCoord);
      }

      // Add all active order locations
      for (const [id, coord] of activeLocations.entries()) {
        coordList.push(coord);
        orderIds.push(id);
      }

      // Use userCoord if available, otherwise just use the first order as the starting point.
      const originCoord =
        startCoord || (coordList.length > 0 ? coordList[0] : undefined);
      const hasRealStart = !!startCoord;

      let finalOrderedIds: string[] = [];
      let optimizedResult = false;

      // 1. Try Mapbox Optimization API (max 12 stops) - Traffic-aware TSP
      if (coordList.length <= 12) {
        try {
          const route = await MapboxService.getOptimizedRoute(coordList);
          if (route && route.waypoints && route.waypoints.length > 0) {
            setRouteData(route);
            const optimizedIds: string[] = [];

            // Sorted by visit order (trips_index)
            const sortedWaypoints = [...route.waypoints].sort(
              (a: any, b: any) =>
                a.trips_index - b.trips_index ||
                a.waypoint_index - b.waypoint_index,
            );

            sortedWaypoints.forEach((wp: any) => {
              const inputIndex = wp.waypoint_index;
              if (hasRealStart) {
                // Skip the driver location (inputIndex 0)
                if (inputIndex > 0) {
                  optimizedIds.push(orderIds[inputIndex - 1]);
                }
              } else {
                optimizedIds.push(orderIds[inputIndex]);
              }
            });

            if (optimizedIds.filter(Boolean).length === orderIds.length) {
              finalOrderedIds = optimizedIds.filter(Boolean);
              optimizedResult = true;
            }
          }
        } catch (e) {
          console.error("Optimization failed:", e);
        }
      }

      // 2. Fallback to Nearest Neighbor if Optimization is not used or failed
      if (!optimizedResult) {
        if (originCoord) {
          finalOrderedIds = nearestNeighborOrder(activeLocations, originCoord);
        } else {
          finalOrderedIds = orderIds;
        }
      }

      setOrderedOrderIds(finalOrderedIds);

      // Fetch the actual polyline for the greedy route
      const finalCoords = startCoord ? [startCoord] : [];
      finalOrderedIds.forEach((id) => {
        const c = currentLocations.get(id);
        if (c) finalCoords.push(c);
      });

      // Fetch the actual polyline ONLY if we didn't get it from the Optimization API
      if (
        !optimizedResult &&
        finalCoords.length >= 2 &&
        finalCoords.length <= 25
      ) {
        try {
          const route = await MapboxService.getDirections(finalCoords);
          if (route) {
            setRouteData(route);
          } else {
            setRouteData(null);
          }
        } catch (e) {
          console.error("Directions route fetch failed", e);
          setRouteData(null);
        }
      } else if (!optimizedResult && finalCoords.length < 2) {
        setRouteData(null);
      }
    },
    [nearestNeighborOrder],
  );

  // Recalculate route when locations or user coordinates change (only if NOT actively navigating)
  // This creates a stable "navigator" experience: once started, the sequence is locked until you complete an order.
  useEffect(() => {
    if (locations.size > 0) {
      calculateRoute(locations, userCoord || undefined);
    }
  }, [locations, userCoord, calculateRoute]);

  // Request location permissions (especially critical for Android Emulators)
  useEffect(() => {
    Mapbox.requestAndroidLocationPermissions();
  }, []);

  // Prepare order data with locations
  useEffect(() => {
    let cancelled = false;

    // Geocode fallback with hierarchy: 1. District+Region, 2. Region — keshlanadi
    const geocodeCached = async (region?: string, district?: string) => {
      if (!region) return null;
      const key = `${region}|${district ?? ""}`;
      if (geocodeCache.current.has(key)) {
        return geocodeCache.current.get(key) ?? null;
      }
      let coords: Coordinate | null = null;
      if (district) coords = await MapboxService.geocode(region, district);
      if (!coords) coords = await MapboxService.geocode(region);
      geocodeCache.current.set(key, coords);
      return coords;
    };

    const fetchLocations = async () => {
      setLoading(true);
      const newLocations = new Map<string, Coordinate>();

      for (const order of Object.values(ordersRef.current)) {
        if (order.location) {
          newLocations.set(order.id, {
            latitude: order.location.lat,
            longitude: order.location.lng,
          });
          continue;
        }

        const customer = customersRef.current[order.customer_id];
        if (!customer) continue;
        if (customer.location) {
          newLocations.set(order.id, {
            latitude: customer.location.lat,
            longitude: customer.location.lng,
          });
          continue;
        }

        const coords = await geocodeCached(
          order.region_name || customer.region_name,
          order.district_name || customer.district_name,
        );
        if (coords) newLocations.set(order.id, coords);
      }

      if (!cancelled) {
        setLocations(newLocations);
        setLoading(false);
      }
    };

    fetchLocations();
    return () => {
      cancelled = true;
    };
    // locationKey orders/customers'ning route'ga ta'sir qiluvchi qismini ifodalaydi
  }, [locationKey]);

  const handleDragEnd = useCallback(async (orderId: string, event: any) => {
    const [longitude, latitude] = event.geometry.coordinates;

    // Update local state for immediate feedback
    setLocations((prev) => {
      const updated = new Map(prev);
      updated.set(orderId, { latitude, longitude });
      return updated;
    });

    try {
      await db.orders.update(orderId, {
        location: { lat: latitude, lng: longitude },
      });
    } catch (err) {
      console.error("Failed to update order location:", err);
    }
  }, []);

  const handleShareRoute = useCallback(async () => {
    // 1. Mandatory driver location for precise sorting
    if (!userCoord) {
      Alert.alert(
        "Joylashuv topilmadi",
        "Marshrutni ulashish uchun joriy joylashuvingizni (GPS) yoqing.",
      );
      return;
    }

    // 2. Re-calculate the nearest-neighbor sequence from CURRENT locations
    // to ensure the shared route is perfectly ordered from where the driver is standing.
    const activeLocations = new Map<string, Coordinate>();
    for (const [id, coord] of locations.entries()) {
      const order = ordersById[id];
      // Skip done/cancel orders
      if (order && order.state !== "done" && order.state !== "cancel") {
        activeLocations.set(id, coord);
      }
    }

    if (activeLocations.size === 0) {
      Alert.alert("Eslatma", "Ulashish uchun faol buyurtmalar mavjud emas.");
      return;
    }

    const freshOrderedIds = nearestNeighborOrder(activeLocations, userCoord);

    // 3. Build ordered points list (start with driver) & stop metadata
    const points: Coordinate[] = [userCoord];
    const stopNames: string[] = [];

    freshOrderedIds.forEach((id, idx) => {
      const coord = activeLocations.get(id);
      if (!coord) return;
      points.push(coord);

      const order = ordersById[id];
      const customer = order ? customersById[order.customer_id] : undefined;
      const name = customer?.name || "Noma'lum";
      const count = order?.product_count ?? 0;
      const region = order?.region_name || customer?.region_name || "";
      const district = order?.district_name || customer?.district_name || "";
      const product = order ? productsById[order.product_id] : undefined;
      const phone_number = digitsOnly(customer?.phone);
      const total_price =
        (Number(order?.product_price ?? 0) +
          Number(order?.delivery_price ?? 0)) *
        count;

      stopNames.push(
        `${idx + 1}. ${name} (${phone_number}) — (${district}, ${region}) \n 📦 ${count} ta ${product?.name} \n 💰 Narxi: ${formatMoney(order?.product_price)} so'm \n 🚚 Yolkira: ${formatMoney(order?.delivery_price)} so'm \n ✅ Jami: ${formatMoney(total_price)} so'm \n --------------------------------------------------`,
      );
    });

    // 4. Generate the shared link (Google Maps)
    const url = RouteService.getNavigationLink(points, stopNames);

    // 5. Compose the share message
    const shareText =
      `🗺 Marshrut (${freshOrderedIds.length} ta to'xtash):\n\n` +
      `🕒 Haydovchi joylashuvidan boshlab:\n` +
      stopNames.join("\n") +
      `\n\n📍 Google Maps:\n${url}`;

    try {
      await Share.share({ message: shareText, url });
    } catch (error) {
      Alert.alert("Xato", "Ulashishda xatolik yuz berdi");
    }
  }, [userCoord, locations, ordersById, customersById, productsById, nearestNeighborOrder]);

  /** Open Google Maps navigation for a single order stop */
  const handleNavigateToOrder = useCallback(
    (orderId: string) => {
      const dest = locations.get(orderId);
      if (!dest) {
        Alert.alert("Xato", "Bu buyurtma uchun manzil topilmadi.");
        return;
      }
      const origin = userCoord
        ? `${userCoord.latitude},${userCoord.longitude}`
        : "";
      const destStr = `${dest.latitude},${dest.longitude}`;
      const url = `https://www.google.com/maps/dir/?api=1${origin ? `&origin=${origin}` : ""}&destination=${destStr}&travelmode=driving`;
      Linking.openURL(url).catch(() =>
        Alert.alert("Xato", "Google Maps ochilmadi"),
      );
    },
    [locations, userCoord],
  );

  const onUserLocationUpdate = useCallback(
    (location: any) => {
      if (location?.coords) {
        const { latitude, longitude } = location.coords;
        const newCoord = { latitude, longitude };
        // Only update if location changed significantly (> 30m)
        if (
          !userCoord ||
          MapboxService.getDistance(userCoord, newCoord) > 0.03
        ) {
          setUserCoord(newCoord);
        }
      }
    },
    [userCoord],
  );

  const handleUpdateStatus = async (status: string) => {
    if (!selectedOrder) return;

    const statusMap: Record<string, string> = {
      done: "Bajarildi",
      cancel: "Bekor qilindi",
    };

    Alert.alert(
      statusMap[status] || status,
      `Buyurtma holatini "${statusMap[status] || status}" ga o'zgartirmoqchimisiz?`,
      [
        { text: "Yo'q", style: "cancel" },
        {
          text: "Ha",
          onPress: async () => {
            try {
              if (selectedOrder) {
                // Optimistic local update
                setUpdatedStatuses((prev) => ({
                  ...prev,
                  [selectedOrder.id]: status,
                }));
                setSelectedOrder((prev) =>
                  prev ? { ...prev, state: status } : null,
                );

                await db.orders.update(selectedOrder.id, { state: status });
                if (onUpdate) onUpdate();
              }
              // Keep modal open for a brief moment to show updated status before closing
              setTimeout(() => setModalVisible(false), 800);
            } catch (error) {
              Alert.alert("Xato", "Holatni yangilashda xatolik yuz berdi");
            }
          },
        },
      ],
    );
  };

  const selectedCustomer = selectedOrder
    ? customersById[selectedOrder.customer_id]
    : null;
  const selectedProduct = selectedOrder
    ? productsById[selectedOrder.product_id]
    : null;

  const routeLayer = useMemo(
    () =>
      routeData && (
        <ShapeSource id="routeSource" shape={routeData.geometry}>
          <LineLayer
            id="routeLine"
            style={{
              lineColor: "#6366f1",
              lineWidth: 5,
              lineOpacity: 0.8,
              lineJoin: "round",
              lineCap: "round",
            }}
          />
        </ShapeSource>
      ),
    [routeData],
  );

  const markers = useMemo(
    () =>
      Array.from(locations.entries()).map(([orderId, coord]) => {
        const order = ordersById[orderId];
        const currentStatus = updatedStatuses[orderId] || order?.state;

        let markerColor = "#ef4444"; // Default red
        if (currentStatus === "done") markerColor = "#10b981"; // Finished: green
        if (currentStatus === "cancel") markerColor = "#9ca3af"; // Canceled: gray

        const forceUpdateKey = `${orderId}-${currentStatus}-${isDragMode}`;

        return (
          <PointAnnotation
            key={forceUpdateKey}
            id={forceUpdateKey}
            coordinate={[coord.longitude, coord.latitude]}
            onDragEnd={(e) => handleDragEnd(orderId, e)}
            onSelected={() => {
              setSelectedOrder(order || null);
              setIsEditingStatus(false);
              setModalVisible(true);
            }}
            draggable={isDragMode}
          >
            <View collapsable={false} style={{ zIndex: 10000 }}>
              <Text
                style={{
                  backgroundColor: markerColor,
                  zIndex: 100,
                  padding: 4,
                  borderRadius: 10,
                  color: "white",
                  fontSize: 12,
                  lineHeight: 16,
                  textAlign: "center",
                  fontWeight: "bold",
                }}
              >
                {order?.product_count ?? 0} ta
              </Text>
              <MaterialIcons name="place" size={36} color={markerColor} />
            </View>
          </PointAnnotation>
        );
      }),
    [
      locations,
      orderedOrderIds,
      ordersById,
      handleDragEnd,
      updatedStatuses,
      isDragMode,
    ],
  );

  /** Driver mode: ordered stops list */
  const driverStops = useMemo(() => {
    let sortedList = orderedOrderIds
      .map((id) => {
        const order = ordersById[id];
        // Only include active stops in the panel
        if (!order || order.state === "done" || order.state === "cancel")
          return null;
        const customer = customersById[order.customer_id];
        const coord = locations.get(id);
        return { id, order, customer, coord };
      })
      .filter((stop): stop is any => stop !== null);

    // Final safety sort: Ensure the VERY first stop is indeed the nearest one to current location
    // This handles cases where orderedOrderIds might be slightly stale during movement
    if (userCoord && sortedList.length > 0) {
      sortedList.sort((a, b) => {
        const distA = MapboxService.getDistance(userCoord, a.coord);
        const distB = MapboxService.getDistance(userCoord, b.coord);
        return distA - distB;
      });
    }

    return sortedList.map((stop, index) => ({ ...stop, idx: index }));
  }, [orderedOrderIds, ordersById, customersById, locations, userCoord]);

  const focusOnStop = useCallback((coord: Coordinate) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [coord.longitude, coord.latitude],
      zoomLevel: 14,
      animationDuration: 600,
    });
  }, []);

  if (loading && locations.size === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Xaritani tayyorlanmoqda...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Camera
          ref={cameraRef}
          defaultSettings={{
            zoomLevel: 10,
            centerCoordinate: userCoord
              ? [userCoord.longitude, userCoord.latitude]
              : locations.size > 0
                ? [
                    Array.from(locations.values())[0].longitude,
                    Array.from(locations.values())[0].latitude,
                  ]
                : [69.2401, 41.2995],
          }}
        />

        {/* Route Line at the bottom of style layers */}
        {routeLayer}

        {/* Show user's current location */}
        <UserLocation
          animated={true}
          onUpdate={onUserLocationUpdate}
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* ── Driver Location Marker ── */}
        {userCoord && (
          <PointAnnotation
            id="driver_location"
            key="driver_location"
            coordinate={[userCoord.longitude, userCoord.latitude]}
          >
            <View style={styles.driverPin} collapsable={false}>
              <View style={styles.driverPinInner}>
                <MaterialIcons name="directions-car" size={18} color="#fff" />
              </View>
              <View style={styles.driverPinTail} />
              <View style={styles.driverPinLabel}>
                <Text style={styles.driverPinLabelText}>Siz</Text>
              </View>
            </View>
          </PointAnnotation>
        )}

        {/* Order Markers on top */}
        {markers}
      </MapView>

      {/* ── Toolbar ── */}
      {showToolbar && (
        <View style={styles.toolbar}>
          {/* Driver Mode Toggle */}
          <TouchableOpacity
            style={[styles.toolBtn, driverMode && styles.toolBtnActive]}
            onPress={() => {
              setDriverMode(true);
              setShowToolbar(false);
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="directions-car"
              size={20}
              color={driverMode ? "#fff" : "#6366f1"}
            />
            <Text
              style={[
                styles.toolBtnText,
                driverMode && styles.toolBtnTextActive,
              ]}
            >
              Haydovchi
            </Text>
          </TouchableOpacity>

          {/* Drag Mode Toggle */}
          <TouchableOpacity
            style={[styles.toolBtn, isDragMode && styles.toolBtnActive]}
            onPress={() => setIsDragMode((v) => !v)}
            activeOpacity={0.8}
          >
            <MaterialIcons
              name="edit-location"
              size={20}
              color={isDragMode ? "#fff" : "#6366f1"}
            />
            <Text
              style={[
                styles.toolBtnText,
                isDragMode && styles.toolBtnTextActive,
              ]}
            >
              Joylashuvni tahrirlash
            </Text>
          </TouchableOpacity>

          {/* Center on user */}
          {userCoord && (
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => focusOnStop(userCoord)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="my-location" size={20} color="#6366f1" />
              <Text style={styles.toolBtnText}>Joylashuv</Text>
            </TouchableOpacity>
          )}

          {/* ── Share Route Button ── */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => {
              setShowToolbar(false);
              handleShareRoute();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="share" size={20} color="#6366f1" />
            <Text style={styles.toolBtnText}>Ulashish</Text>
          </TouchableOpacity>

          {/* close mapview */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => {
              setShowToolbar(false);
              router.back();
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={20} color="#6366f1" />
            <Text style={styles.toolBtnText}>Yopish</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Toolbar Toggle Button ── */}
      <TouchableOpacity
        style={[
          styles.shareBtn,
          {
            backgroundColor: showToolbar ? "#ef4444" : "#6366f1",
          },
        ]}
        onPress={() => setShowToolbar(!showToolbar)}
        activeOpacity={0.8}
      >
        <MaterialIcons
          name={showToolbar ? "close" : "apps"}
          size={26}
          color="#fff"
        />
      </TouchableOpacity>

      {/* ── Driver Mode Stops Panel (bottom sliding list) ── */}
      {driverMode && (
        <View style={styles.driverPanel}>
          <View style={styles.driverPanelHeader}>
            <MaterialIcons name="alt-route" size={18} color="#6366f1" />
            <Text style={styles.driverPanelTitle}>
              Marshrut: {driverStops.length} ta to'xtash
            </Text>
            <TouchableOpacity
              style={{ marginLeft: "auto" }}
              onPress={() => setDriverMode(false)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="close" size={20} color="#6366f1" />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.driverStopsList}
          >
            {driverStops.map(({ id, order, customer, idx }) => {
              const coord = locations.get(id);
              return (
                <TouchableOpacity
                  key={id}
                  style={styles.driverStop}
                  onPress={() => {
                    if (coord) focusOnStop(coord);
                  }}
                  activeOpacity={0.85}
                >
                  {/* Step number */}
                  <View style={styles.stopBadge}>
                    <Text style={styles.stopBadgeText}>{idx + 1}</Text>
                  </View>

                  <Text style={styles.stopCustomer} numberOfLines={1}>
                    {customer?.name || "Noma'lum"}
                  </Text>
                  <Text style={styles.stopProduct} numberOfLines={1}>
                    {order?.product_count} ta •{" "}
                    {order?.district_name || order?.region_name || ""}
                  </Text>

                  {/* Navigate button */}
                  <TouchableOpacity
                    style={styles.stopNavBtn}
                    onPress={() => handleNavigateToOrder(id)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="navigation" size={14} color="#fff" />
                    <Text style={styles.stopNavBtnText}>Yo'l</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Order Detail Modal ── */}
      <CustomModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        modalTitle="Buyurtma ma'lumotlari"
        contentContainerStyle={{ justifyContent: "flex-end" }}
      >
        {selectedOrder && (
          <View className="gap-3">
            <View style={styles.infoRow}>
              <MaterialIcons name="person" size={20} color="#6366f1" />
              <Text style={styles.infoLabel}>Mijoz:</Text>
              <Text style={styles.infoValue}>
                {selectedCustomer?.name || "Noma'lum"}
              </Text>
            </View>

            {selectedCustomer?.phone && (
              <TouchableOpacity
                style={styles.infoRow}
                onPress={() => callPhone(selectedCustomer.phone!)}
              >
                <MaterialIcons name="phone" size={20} color="#10b981" />
                <Text style={styles.infoLabel}>Telefon:</Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: "#10b981", fontWeight: "700" },
                  ]}
                >
                  {formatPhone(selectedCustomer.phone)}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.infoRow}>
              <MaterialIcons name="shopping-bag" size={20} color="#6366f1" />
              <Text style={styles.infoLabel}>Mahsulot:</Text>
              <Text style={styles.infoValue}>
                {selectedProduct?.name || "Noma'lum"}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="reorder" size={20} color="#6366f1" />
              <Text style={styles.infoLabel}>Soni:</Text>
              <Text style={styles.infoValue}>
                {selectedOrder.product_count} ta
              </Text>
            </View>

            <View style={styles.infoRow}>
              <MaterialIcons name="place" size={20} color="#6366f1" />
              <Text style={styles.infoLabel}>Manzil:</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {selectedOrder.region_name || selectedCustomer?.region_name},{" "}
                {selectedOrder.district_name || selectedCustomer?.district_name}
              </Text>
            </View>

            {selectedOrder.delivery_price > 0 && (
              <View style={styles.infoRow}>
                <MaterialIcons
                  name="delivery-dining"
                  size={20}
                  color="#10b981"
                />
                <Text style={styles.infoLabel}>Yetkazib berish:</Text>
                <Text style={styles.infoValue}>
                  {formatSum(selectedOrder.delivery_price)}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <MaterialIcons name="payments" size={20} color="#f59e0b" />
              <Text style={styles.infoLabel}>Jami buyurtmalar:</Text>
              <Text style={[styles.infoValue, { color: "#ef4444" }]}>
                {formatSum(
                  selectedOrder.product_count * selectedOrder.product_price +
                    selectedOrder.delivery_price,
                )}
              </Text>
            </View>

            {selectedOrder.note && (
              <View style={styles.infoNote}>
                <Text style={styles.noteTitle}>Eslatma:</Text>
                <Text style={styles.noteText}>{selectedOrder.note}</Text>
              </View>
            )}

            {/* Navigate to this specific order */}
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={() => {
                setModalVisible(false);
                handleNavigateToOrder(selectedOrder.id);
              }}
            >
              <MaterialIcons name="navigation" size={18} color="#fff" />
              <Text style={styles.navigateBtnText}>
                Google Maps'da yo'l olish
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.detailBtn}
              onPress={() => {
                setModalVisible(false);
                onOrderPress(selectedOrder.id);
              }}
            >
              <Text style={styles.detailBtnText}>Batafsil ko'rish</Text>
              <MaterialIcons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>

            {(selectedOrder.state !== "done" &&
              selectedOrder.state !== "cancel") ||
            isEditingStatus ? (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#10b981" }]}
                  onPress={() => handleUpdateStatus("done")}
                >
                  <MaterialIcons name="check-circle" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Bajarildi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
                  onPress={() => handleUpdateStatus("cancel")}
                >
                  <MaterialIcons name="cancel" size={20} color="#fff" />
                  <Text style={styles.actionBtnText}>Bekor qilish</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={{
                  gap: 8,
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <View
                  style={[
                    styles.infoRow,
                    {
                      backgroundColor:
                        selectedOrder.state === "done" ? "#f0fdf4" : "#fef2f2",
                      padding: 14,
                      borderRadius: 12,
                      flex: 1,
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor:
                        selectedOrder.state === "done" ? "#bcf0da" : "#fecaca",
                    },
                  ]}
                >
                  <MaterialIcons
                    name={
                      selectedOrder.state === "done" ? "check-circle" : "cancel"
                    }
                    size={22}
                    color={
                      selectedOrder.state === "done" ? "#10b981" : "#ef4444"
                    }
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "800",
                      color:
                        selectedOrder.state === "done" ? "#10b981" : "#ef4444",
                      marginLeft: 8,
                    }}
                  >
                    {selectedOrder.state === "done"
                      ? "BUYURTMA TOPSHIRILGAN"
                      : "BUYURTMA BEKOR QILINGAN"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 8,
                  }}
                  onPress={() => setIsEditingStatus(true)}
                >
                  <MaterialIcons name="edit" size={16} color="#666" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </CustomModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: { marginTop: 12, color: "#4b5563", fontSize: 16 },

  // ── Toolbar ─────────────────────────────────────────────────────────────────
  toolbar: {
    position: "absolute",
    bottom: 110,
    right: 10,
    flexDirection: "column",
    gap: 8,
    width: 150,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  toolBtnActive: {
    backgroundColor: "#6366f1",
    borderColor: "#6366f1",
  },
  toolBtnText: { fontSize: 13, fontWeight: "600", color: "#6366f1" },
  toolBtnTextActive: { color: "#fff" },

  // ── Share Button ─────────────────────────────────────────────────────────────
  shareBtn: {
    position: "absolute",
    bottom: 40,
    right: 10,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    gap: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  // ── Driver Panel ─────────────────────────────────────────────────────────────
  driverPanel: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 14,
    paddingBottom: 16,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  driverPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  driverPanelTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  driverStopsList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  driverStop: {
    width: 140,
    backgroundColor: "#f8f9ff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#e0e7ff",
    gap: 4,
    alignItems: "flex-start",
  },
  stopBadge: {
    backgroundColor: "#6366f1",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stopBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  stopCustomer: { fontSize: 13, fontWeight: "700", color: "#111827" },
  stopProduct: { fontSize: 11, color: "#6b7280" },
  stopNavBtn: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#6366f1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  stopNavBtnText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  // ── Modal ────────────────────────────────────────────────────────────────────
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoLabel: { fontSize: 14, color: "#6b7280", width: 100 },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  infoNote: {
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  noteTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
    marginBottom: 4,
  },
  noteText: { fontSize: 14, color: "#1f2937", fontStyle: "italic" },
  navigateBtn: {
    backgroundColor: "#0ea5e9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  navigateBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  detailBtn: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 2,
  },
  detailBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 5 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },

  // ── Driver Location Pin ───────────────────────────────────────────────────────
  driverPin: {
    alignItems: "center",
  },
  driverPinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    elevation: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  driverPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#10b981",
    marginTop: -1,
  },
  driverPinLabel: {
    marginTop: 3,
    backgroundColor: "#10b981",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  driverPinLabelText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
});

export default LotMapView;
