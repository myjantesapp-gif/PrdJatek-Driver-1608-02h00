import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors } from '@/constants/colors';
import { useDriver } from '@/context/DriverContext';
import { router } from 'expo-router';
import { DEFAULT_MAP_REGION, getWebLocationFallback } from '@/lib/delivery-state';

function MapPlaceholder({ message }: { message: string }) {
  return (
    <View style={styles.placeholder}>
      <Ionicons name="map" size={52} color={Colors.border} />
      <Text style={styles.placeholderText}>{message}</Text>
    </View>
  );
}

class MapFallbackBoundary extends React.Component<
  { children: React.ReactNode; message: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MapPlaceholder message={this.props.message} /> : this.props.children;
  }
}

function hasNavigableCoordinates(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const { activeOrder, status } = useDriver();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [MapView, setMapView] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Polyline, setPolyline] = useState<any>(null);
  const [mapUnavailable, setMapUnavailable] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  useEffect(() => {
    let cancelled = false;

    if (Platform.OS !== 'web') {
      (async () => {
        try {
          const maps = await import('react-native-maps');
          const NativeMapView = maps.default;
          if (!NativeMapView) throw new Error('Map component unavailable');
          if (!cancelled) {
            setMapView(() => NativeMapView);
            setMarker(() => maps.Marker);
            setPolyline(() => maps.Polyline);
          }
        } catch {
          if (!cancelled) setMapUnavailable(true);
        }
      })();
    }

    (async () => {
      try {
        if (Platform.OS === 'web') {
          // Guard: navigator may be undefined in non-browser web environments
          if (typeof navigator === 'undefined' || !navigator.geolocation) {
            if (!cancelled) {
              setLocation(getWebLocationFallback('unavailable'));
              setLoading(false);
            }
            return;
          }
          const fallbackTimer = setTimeout(() => {
            if (!cancelled) {
              setLocation(getWebLocationFallback('timeout'));
              setLoading(false);
            }
          }, 12_000);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              clearTimeout(fallbackTimer);
              if (!cancelled) {
                setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                setLoading(false);
              }
            },
            () => {
              clearTimeout(fallbackTimer);
              if (!cancelled) {
                setLocation(getWebLocationFallback('permission-denied'));
                setLoading(false);
              }
            },
            { enableHighAccuracy: true, maximumAge: 10_000, timeout: 12_000 },
          );
          return;
        }
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm !== 'granted') {
          setPermissionError(true);
          setLoading(false);
          return;
        }
        const loc = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Location request timed out')), 12_000);
          }),
        ]);
        if (!cancelled) {
          setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        if (!cancelled) setLocation(getWebLocationFallback('timeout'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const openNavigation = async (lat: number, lng: number, label: string) => {
    if (!hasNavigableCoordinates(lat, lng)) return;

    const encodedLabel = encodeURIComponent(label || 'Destination');
    const nativeUrl = Platform.OS === 'ios'
      ? `maps:0,0?q=${encodedLabel}@${lat},${lng}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
    const webUrl = `https://maps.google.com/?q=${encodeURIComponent(`${lat},${lng}`)}`;

    try {
      const canOpenNative = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpenNative ? nativeUrl : webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        // There is no usable external maps application on this device.
      }
    }
  };

  const mapRegion = location
    ? { ...location, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : DEFAULT_MAP_REGION;

  const renderMap = () => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.webMap}>
          <Ionicons name="navigate-circle" size={64} color={Colors.primary} />
          <Text style={styles.webMapTitle}>Navigation GPS</Text>
          <Text style={styles.webMapSub}>
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : 'Localisation en cours...'}
          </Text>
        </View>
      );
    }
    if (!MapView) {
      return (
        <MapPlaceholder
          message={mapUnavailable ? 'Carte indisponible sur cet appareil' : 'Chargement de la carte...'}
        />
      );
    }
    return (
      <MapFallbackBoundary message="La carte ne peut pas être affichée">
        <MapView
          style={StyleSheet.absoluteFill}
          region={mapRegion}
          showsUserLocation
          showsMyLocationButton={false}
          customMapStyle={DARK_MAP_STYLE}
        >
          {activeOrder && Marker && (
            <>
              {hasNavigableCoordinates(activeOrder.restaurant.lat, activeOrder.restaurant.lng) && (
                <Marker
                  coordinate={{ latitude: activeOrder.restaurant.lat, longitude: activeOrder.restaurant.lng }}
                  title={activeOrder.restaurant.name}
                  pinColor={Colors.primary}
                />
              )}
              {hasNavigableCoordinates(activeOrder.customer.lat, activeOrder.customer.lng) && (
                <Marker
                  coordinate={{ latitude: activeOrder.customer.lat, longitude: activeOrder.customer.lng }}
                  title={activeOrder.customer.name}
                  pinColor={Colors.tertiary}
                />
              )}
              {Polyline && location &&
                hasNavigableCoordinates(activeOrder.restaurant.lat, activeOrder.restaurant.lng) &&
                hasNavigableCoordinates(activeOrder.customer.lat, activeOrder.customer.lng) && (
                  <Polyline
                    coordinates={[
                      { latitude: location.latitude, longitude: location.longitude },
                      { latitude: activeOrder.restaurant.lat, longitude: activeOrder.restaurant.lng },
                      { latitude: activeOrder.customer.lat, longitude: activeOrder.customer.lng },
                    ]}
                    strokeColor={Colors.primary}
                    strokeWidth={3}
                    lineDashPattern={[1]}
                  />
                )}
            </>
          )}
        </MapView>
      </MapFallbackBoundary>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Localisation en cours...</Text>
        </View>
      ) : permissionError ? (
        <View style={styles.errorContainer}>
          <Ionicons name="location-outline" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Permission refusée</Text>
          <Text style={styles.errorSub}>Autorisez la localisation pour utiliser la navigation</Text>
        </View>
      ) : (
        <View style={styles.mapContainer}>
          {renderMap()}

          <View style={styles.overlay}>
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: status === 'online' || status === 'busy' ? Colors.success : Colors.offline }]} />
              <Text style={styles.statusText}>
                {status === 'online' ? 'En ligne' : status === 'busy' ? 'Occupé' : 'Hors ligne'}
              </Text>
            </View>
          </View>

          {activeOrder && (
            <View style={[styles.orderOverlay, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 100 }]}>
              <View style={styles.routeCard}>
                <Text style={styles.routeTitle}>Itinéraire actif</Text>

                <TouchableOpacity
                  style={[styles.routeStep, !hasNavigableCoordinates(activeOrder.restaurant.lat, activeOrder.restaurant.lng) && styles.routeStepDisabled]}
                  onPress={() => openNavigation(activeOrder.restaurant.lat, activeOrder.restaurant.lng, activeOrder.restaurant.name)}
                  activeOpacity={0.8}
                  disabled={!hasNavigableCoordinates(activeOrder.restaurant.lat, activeOrder.restaurant.lng)}
                >
                  <View style={[styles.stepDot, { backgroundColor: Colors.primary }]} />
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepLabel}>Pickup</Text>
                    <Text style={styles.stepAddress} numberOfLines={1}>{activeOrder.restaurant.name}</Text>
                  </View>
                  <Ionicons name="navigate-outline" size={20} color={!hasNavigableCoordinates(activeOrder.restaurant.lat, activeOrder.restaurant.lng) ? Colors.textMuted : Colors.primary} />
                </TouchableOpacity>

                <View style={styles.routeLine} />

                <TouchableOpacity
                  style={[styles.routeStep, !hasNavigableCoordinates(activeOrder.customer.lat, activeOrder.customer.lng) && styles.routeStepDisabled]}
                  onPress={() => openNavigation(activeOrder.customer.lat, activeOrder.customer.lng, activeOrder.customer.name)}
                  activeOpacity={0.8}
                  disabled={!hasNavigableCoordinates(activeOrder.customer.lat, activeOrder.customer.lng)}
                >
                  <View style={[styles.stepDot, { backgroundColor: Colors.tertiary }]} />
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepLabel}>Livraison</Text>
                    <Text style={styles.stepAddress} numberOfLines={1}>{activeOrder.customer.address}</Text>
                  </View>
                  <Ionicons name="navigate-outline" size={20} color={!hasNavigableCoordinates(activeOrder.customer.lat, activeOrder.customer.lng) ? Colors.textMuted : Colors.tertiary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.detailBtn}
                  onPress={() => router.push(`/order/${activeOrder.id}`)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.detailBtnText}>Voir la commande</Text>
                  <Ionicons name="chevron-forward" size={16} color="#000" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {!activeOrder && (
            <View style={[styles.noOrderOverlay, { bottom: Platform.OS === 'web' ? 50 : insets.bottom + 90 }]}>
              <View style={styles.noOrderPill}>
                <MaterialCommunityIcons name="map-marker-path" size={18} color={Colors.textMuted} />
                <Text style={styles.noOrderText}>Aucune livraison active</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0f' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1c1c2e' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2e2e48' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1628' }] },
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: 'Poppins_500Medium',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 20,
    fontFamily: 'Poppins_700Bold',
  },
  errorSub: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
    textAlign: 'center',
  },
  mapContainer: {
    flex: 1,
  },
  webMap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    gap: 12,
  },
  webMapTitle: {
    color: Colors.text,
    fontSize: 22,
    fontFamily: 'Poppins_700Bold',
  },
  webMapSub: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_400Regular',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
  },
  placeholderText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontFamily: 'Poppins_400Regular',
  },
  overlay: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: Colors.card + 'EE',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: Colors.text,
    fontSize: 13,
    fontFamily: 'Poppins_600SemiBold',
  },
  orderOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  routeCard: {
    backgroundColor: Colors.card + 'F5',
    borderRadius: Colors.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  routeTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 14,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepInfo: {
    flex: 1,
  },
  stepLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: 'Poppins_500Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 1,
  },
  stepAddress: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: Colors.border,
    marginLeft: 5,
    marginVertical: 6,
  },
  detailBtn: {
    marginTop: 14,
    backgroundColor: Colors.primary,
    borderRadius: Colors.radius,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailBtnText: {
    color: '#000',
    fontSize: 14,
    fontFamily: 'Poppins_700Bold',
  },
  noOrderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  noOrderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card + 'EE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noOrderText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontFamily: 'Poppins_500Medium',
  },
  routeStepDisabled: {
    opacity: 0.4,
  },
});
