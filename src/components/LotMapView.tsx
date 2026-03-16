import CustomModal from "@/components/CustomModal";
import { Customer, Order, Product, User } from "@/interfaces";
import db from "@/services/database";
import { Coordinate, MapboxService } from "@/services/mapboxService";
import { RouteService } from "@/services/routeService";
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
import { formatPhone } from "@utils/format";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  users: (User & { id: string })[];
  onOrderPress: (orderId: string) => void;
  onLocationUpdate?: (
    id: string,
    lat: number,
    lng: number,
    type: "order" | "customer",
  ) => void;
}

const LotMapView: React.FC<LotMapViewProps> = ({
  orders,
  customers,
  products,
  onOrderPress,
}) => {
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
  // Preparation logic extracted for reuse
  const calculateRoute = useCallback(
    async (
      currentLocations: Map<string, Coordinate>,
      startCoord?: Coordinate,
    ) => {
      const coordList: Coordinate[] = [];
      const orderIds: string[] = [];

      // Always start from user location if available
      if (startCoord) {
        coordList.push(startCoord);
      }

      // Add all order locations
      for (const [id, coord] of currentLocations.entries()) {
        coordList.push(coord);
        orderIds.push(id);
      }

      if (coordList.length >= 2) {
        const route = await MapboxService.getOptimizedRoute(coordList);
        if (route) {
          setRouteData(route);
          // Mapbox optimization returns waypoints in visiting order
          if (route.waypoints && route.waypoints.length > 0) {
            const optimizedIds: string[] = [];

            // Mapbox optimization response waypoints are ordered by trip sequence
            route.waypoints.forEach((wp: any) => {
              const inputIndex = wp.waypoint_index;
              if (startCoord) {
                if (inputIndex > 0) {
                  optimizedIds.push(orderIds[inputIndex - 1]);
                }
              } else {
                optimizedIds.push(orderIds[inputIndex]);
              }
            });

            setOrderedOrderIds(optimizedIds);
          }
        }
      }
    },
    [],
  );

  // Recalculate route when locations or user coordinates change
  useEffect(() => {
    if (locations.size > 0) {
      calculateRoute(locations, userCoord || undefined);
    }
  }, [locations, userCoord, calculateRoute]);

  // Prepare order data with locations
  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      const newLocations = new Map<string, Coordinate>();

      for (const order of orders) {
        if (order.location) {
          newLocations.set(order.id, {
            latitude: order.location.lat,
            longitude: order.location.lng,
          });
          continue;
        }

        const customer = customers.find((c) => c.id === order.customer_id);
        if (customer) {
          if (customer.location) {
            newLocations.set(order.id, {
              latitude: customer.location.lat,
              longitude: customer.location.lng,
            });
          } else {
            const region = order.region_name || customer.region_name;
            const district = order.district_name || customer.district_name;

            // Geocode fallback with hierarchy: 1. District+Region, 2. Region
            let coords = null;
            if (district && region) {
              coords = await MapboxService.geocode(region, district);
            }

            if (!coords && region) {
              coords = await MapboxService.geocode(region);
            }

            if (coords) {
              newLocations.set(order.id, coords);
            }
          }
        }
      }
      setLocations(newLocations);
      setLoading(false);
    };

    fetchLocations();
  }, [orders, customers]);

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
    if (orderedOrderIds.length === 0) {
      Alert.alert("Xato", "Hali marshrut shakllanmagan. Iltimos biroz kuting.");
      return;
    }

    const startPoint = userCoord || locations.get(orderedOrderIds[0]);
    if (!startPoint) {
      Alert.alert("Xato", "Boshlang'ich nuqtani aniqlab bo'lmadi.");
      return;
    }

    const points = [startPoint];
    orderedOrderIds.forEach((id) => {
      const coord = locations.get(id);
      if (coord && coord !== startPoint) points.push(coord);
    });

    const url = RouteService.getNavigationLink(points);
    try {
      await Share.share({
        message: `Optimallashgan yo'nalish (Barcha buyurtmalar): ${url}`,
        url: url,
      });
    } catch (error) {
      Alert.alert("Xato", "Ulashishda xatolik yuz berdi");
    }
  }, [orderedOrderIds, userCoord, locations]);

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
              await db.orders.update(selectedOrder.id, { state: status });
              setModalVisible(false);
            } catch (error) {
              Alert.alert("Xato", "Holatni yangilashda xatolik yuz berdi");
            }
          },
        },
      ],
    );
  };
  const selectedCustomer = useMemo(() => {
    if (!selectedOrder) return null;
    return customers.find((c) => c.id === selectedOrder.customer_id);
  }, [selectedOrder, customers]);

  const selectedProduct = useMemo(() => {
    if (!selectedOrder) return null;
    return products.find((p) => p.id === selectedOrder.product_id);
  }, [selectedOrder, products]);

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
        const order = orders.find((o) => o.id === orderId);
        // Find the sequence number from optimized route
        const sequenceIndex = orderedOrderIds.indexOf(orderId);
        const sequenceLabel =
          sequenceIndex !== -1 ? (sequenceIndex + 1).toString() : "";

        return (
          <PointAnnotation
            key={orderId}
            id={orderId}
            coordinate={[coord.longitude, coord.latitude]}
            onDragEnd={(e) => handleDragEnd(orderId, e)}
            onSelected={() => {
              setSelectedOrder(order || null);
              setModalVisible(true);
            }}
            draggable={true}
          >
            <View style={styles.markerWrapper} collapsable={false}>
              <View style={styles.markerContainer}>
                <View style={styles.markerMain}>
                  <MaterialIcons
                    name="person-pin-circle"
                    size={42}
                    color={sequenceLabel ? "#6366f1" : "#ef4444"}
                  />
                  {sequenceLabel && (
                    <View style={styles.sequenceBadge}>
                      <Text style={styles.sequenceText}>{sequenceLabel}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{order?.product_count}</Text>
                </View>
              </View>
            </View>
          </PointAnnotation>
        );
      }),
    [locations, orderedOrderIds, orders, handleDragEnd],
  );

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
        <UserLocation animated={true} onUpdate={onUserLocationUpdate} />
        <Camera
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
          followUserLocation={false}
        />

        {/* Route Line */}
        {routeLayer}

        {/* Order Markers */}
        {markers}
      </MapView>

      {/* Share Button Overlay */}
      <TouchableOpacity
        style={styles.shareBtn}
        onPress={handleShareRoute}
        activeOpacity={0.8}
      >
        <MaterialIcons name="share" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Order Detail Modal */}
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
                  {selectedOrder.delivery_price.toLocaleString()} so'm
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <MaterialIcons name="payments" size={20} color="#f59e0b" />
              <Text style={styles.infoLabel}>Jami:</Text>
              <Text style={[styles.infoValue, { color: "#ef4444" }]}>
                {(
                  selectedOrder.product_count * selectedOrder.product_price +
                  selectedOrder.delivery_price
                ).toLocaleString()}{" "}
                so'm
              </Text>
            </View>

            {selectedOrder.note && (
              <View style={styles.infoNote}>
                <Text style={styles.noteTitle}>Eslatma:</Text>
                <Text style={styles.noteText}>{selectedOrder.note}</Text>
              </View>
            )}

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
  markerWrapper: {
    padding: 10,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
  },
  markerMain: {
    alignItems: "center",
    justifyContent: "center",
  },
  sequenceBadge: {
    position: "absolute",
    top: 5,
    backgroundColor: "#fff",
    borderRadius: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: "#6366f1",
    minWidth: 16,
    alignItems: "center",
  },
  sequenceText: {
    color: "#6366f1",
    fontSize: 10,
    fontWeight: "bold",
  },
  countBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  countText: { color: "#fff", fontSize: 9, fontWeight: "bold" },

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
  detailBtn: {
    backgroundColor: "#6366f1",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  detailBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  shareBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    backgroundColor: "#10b981",
    flexDirection: "row",
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
  shareBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 5,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  lotItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  lotName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  lotDate: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
});

export default LotMapView;
