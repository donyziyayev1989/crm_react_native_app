import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import Mapbox, { MapView, Camera, UserLocation, MarkerView, PointAnnotation, ShapeSource, LineLayer } from '@rnmapbox/maps';
import { Order, Customer, Product, User } from '@/interfaces';
import { MapboxService, Coordinate } from '@/services/mapboxService';
import db from '@/services/database';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

// Initialize Mapbox
const accessToken = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
Mapbox.setAccessToken(accessToken);

interface LotMapViewProps {
  orders: (Order & { id: string })[];
  customers: (Customer & { id: string })[];
  products: (Product & { id: string })[];
  users: (User & { id: string })[];
  onOrderPress: (orderId: string) => void;
  onLocationUpdate?: (id: string, lat: number, lng: number, type: 'order' | 'customer') => void;
}

const LotMapView: React.FC<LotMapViewProps> = ({ orders, customers, products, users, onOrderPress }) => {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<Map<string, Coordinate>>(new Map());
  const [routeData, setRouteData] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<(Order & { id: string }) | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [userCoord, setUserCoord] = useState<Coordinate | null>(null);
  const [orderedOrderIds, setOrderedOrderIds] = useState<string[]>([]);

  // Preparation logic extracted for reuse
  const calculateRoute = async (currentLocations: Map<string, Coordinate>, startCoord?: Coordinate) => {
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
        // Mapbox optimization returns waypoints in optimized order
        // We map these back to our order IDs
        if (route.waypoints && route.waypoints.length > 0) {
          // waypoints[0] is the start (user), so we skip it
          const optimizedIds = route.waypoints
            .slice(1)
            .map((wp: any) => orderIds[wp.waypoint_index - 1]);
          setOrderedOrderIds(optimizedIds);
        }
      }
    }
  };

  // Prepare order data with locations
  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      const newLocations = new Map<string, Coordinate>();
      
      for (const order of orders) {
        if (order.location) {
          newLocations.set(order.id, { 
            latitude: order.location.lat, 
            longitude: order.location.lng 
          });
          continue;
        }

        const customer = customers.find(c => c.id === order.customer_id);
        if (customer) {
          if (customer.location) {
            newLocations.set(order.id, { 
              latitude: customer.location.lat, 
              longitude: customer.location.lng 
            });
          } else {
            const region = order.region_name || customer.region_name;
            const district = order.district_name || customer.district_name;
            const coords = await MapboxService.geocode(region, district);
            if (coords) {
              newLocations.set(order.id, coords);
            }
          }
        }
      }
      setLocations(newLocations);
      await calculateRoute(newLocations, userCoord || undefined);
      setLoading(false);
    };

    fetchLocations();
  }, [orders, customers]);

  const handleDragEnd = async (orderId: string, event: any) => {
    const [longitude, latitude] = event.geometry.coordinates;
    
    // Update local state for immediate feedback
    const updatedLocations = new Map(locations);
    updatedLocations.set(orderId, { latitude, longitude });
    setLocations(updatedLocations);

    // Recalculate route with new position
    calculateRoute(updatedLocations, userCoord || undefined);

    try {
      await db.orders.update(orderId, {
        location: { lat: latitude, lng: longitude }
      });
    } catch (err) {
      console.error('Failed to update order location:', err);
    }
  };

  const onUserLocationUpdate = (location: any) => {
    if (location?.coords) {
      const newCoord = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      // Only recalculate if location changed significantly (approx > 50m)
      if (!userCoord || MapboxService.getDistance(userCoord, newCoord) > 0.05) {
        setUserCoord(newCoord);
        calculateRoute(locations, newCoord);
      }
    }
  };

  const selectedCustomer = useMemo(() => {
    if (!selectedOrder) return null;
    return customers.find(c => c.id === selectedOrder.customer_id);
  }, [selectedOrder, customers]);

  const selectedProduct = useMemo(() => {
    if (!selectedOrder) return null;
    return products.find(p => p.id === selectedOrder.product_id);
  }, [selectedOrder, products]);

  if (loading && locations.size === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Xaritani tayyorlanmoqda...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <UserLocation 
          animated={true} 
          onUpdate={onUserLocationUpdate}
        />
        <Camera
          defaultSettings={{
            zoomLevel: 10,
            centerCoordinate: userCoord 
              ? [userCoord.longitude, userCoord.latitude]
              : locations.size > 0 
                ? [Array.from(locations.values())[0].longitude, Array.from(locations.values())[0].latitude]
                : [69.2401, 41.2995], 
          }}
          followUserLocation={false}
        />

        {/* Route Line */}
        {routeData && (
          <ShapeSource id="routeSource" shape={routeData.geometry}>
            <LineLayer
              id="routeLine"
              style={{
                lineColor: '#6366f1',
                lineWidth: 5,
                lineOpacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Order Markers */}
        {Array.from(locations.entries()).map(([orderId, coord]) => {
          const order = orders.find(o => o.id === orderId);
          // Find the sequence number from optimized route
          const sequenceIndex = orderedOrderIds.indexOf(orderId);
          const sequenceLabel = sequenceIndex !== -1 ? (sequenceIndex + 1).toString() : '';

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
              <View 
                style={styles.markerWrapper}
                collapsable={false} 
              >
                <View style={styles.markerContainer}>
                  <View style={styles.markerMain}>
                    <MaterialIcons name="person-pin-circle" size={40} color={sequenceLabel ? "#6366f1" : "#ef4444"} />
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
        })}
      </MapView>

      {/* Order Detail Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Buyurtma ma'lumotlari</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#9ca3af" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <View style={styles.modalBody}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="person" size={20} color="#6366f1" />
                  <Text style={styles.infoLabel}>Mijoz:</Text>
                  <Text style={styles.infoValue}>{selectedCustomer?.name || 'Noma\'lum'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <MaterialIcons name="shopping-bag" size={20} color="#6366f1" />
                  <Text style={styles.infoLabel}>Mahsulot:</Text>
                  <Text style={styles.infoValue}>{selectedProduct?.name || 'Noma\'lum'}</Text>
                </View>

                <View style={styles.infoRow}>
                  <MaterialIcons name="reorder" size={20} color="#6366f1" />
                  <Text style={styles.infoLabel}>Soni:</Text>
                  <Text style={styles.infoValue}>{selectedOrder.product_count} ta</Text>
                </View>

                <View style={styles.infoRow}>
                  <MaterialIcons name="place" size={20} color="#6366f1" />
                  <Text style={styles.infoLabel}>Manzil:</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {selectedOrder.region_name || selectedCustomer?.region_name}, {selectedOrder.district_name || selectedCustomer?.district_name}
                  </Text>
                </View>

                {selectedOrder.delivery_price > 0 && (
                  <View style={styles.infoRow}>
                    <MaterialIcons name="delivery-dining" size={20} color="#10b981" />
                    <Text style={styles.infoLabel}>Yetkazib berish:</Text>
                    <Text style={styles.infoValue}>{selectedOrder.delivery_price.toLocaleString()} so'm</Text>
                  </View>
                )}

                <View style={styles.infoRow}>
                  <MaterialIcons name="payments" size={20} color="#f59e0b" />
                  <Text style={styles.infoLabel}>Jami:</Text>
                  <Text style={[styles.infoValue, { color: '#ef4444' }]}>
                    {(selectedOrder.product_count * selectedOrder.product_price + selectedOrder.delivery_price).toLocaleString()} so'm
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
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  loadingText: { marginTop: 12, color: '#4b5563', fontSize: 16 },
  markerWrapper: {
    padding: 10,
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  markerMain: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sequenceBadge: {
    position: 'absolute',
    top: 5,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#6366f1',
    minWidth: 16,
    alignItems: 'center',
  },
  sequenceText: {
    color: '#6366f1',
    fontSize: 10,
    fontWeight: 'bold',
  },
  countBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  countText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937' },
  modalBody: { gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 14, color: '#6b7280', width: 100 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  infoNote: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  noteTitle: { fontSize: 12, fontWeight: '700', color: '#4b5563', marginBottom: 4 },
  noteText: { fontSize: 14, color: '#1f2937', fontStyle: 'italic' },
  detailBtn: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  detailBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default LotMapView;
