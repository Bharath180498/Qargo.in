import { useEffect, useRef } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import * as Location from 'expo-location';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';

export function HomeScreen() {
  const bootstrap = useDriverAppStore((state) => state.bootstrap);
  const availabilityStatus = useDriverAppStore((state) => state.availabilityStatus);
  const setAvailability = useDriverAppStore((state) => state.setAvailability);
  const refreshJobs = useDriverAppStore((state) => state.refreshJobs);
  const refreshEarnings = useDriverAppStore((state) => state.refreshEarnings);
  const updateLocation = useDriverAppStore((state) => state.updateLocation);
  const currentJob = useDriverAppStore((state) => state.currentJob);
  const nextJob = useDriverAppStore((state) => state.nextJob);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const timer = setInterval(() => {
      void Promise.all([refreshJobs(), refreshEarnings()]);
    }, 10000);

    return () => clearInterval(timer);
  }, [refreshEarnings, refreshJobs]);

  useEffect(() => {
    const startTracking = async () => {
      if (availabilityStatus === 'OFFLINE' || !availabilityStatus) {
        if (locationSubscription.current) {
          locationSubscription.current.remove();
          locationSubscription.current = null;
        }
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location required', 'Enable location permissions to go online.');
        return;
      }

      const initialPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });

      await updateLocation(initialPosition.coords.latitude, initialPosition.coords.longitude, currentJob?.orderId);

      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10
        },
        (position) => {
          void updateLocation(position.coords.latitude, position.coords.longitude, currentJob?.orderId);
        }
      );
    };

    void startTracking();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, [availabilityStatus, currentJob?.orderId, updateLocation]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Driver Home</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Availability</Text>
          <Text style={styles.status}>Status: {availabilityStatus ?? 'OFFLINE'}</Text>
          <View style={styles.row}>
            <Pressable style={[styles.toggleButton, styles.onlineButton]} onPress={() => void setAvailability('ONLINE')}>
              <Text style={styles.toggleButtonText}>Go Online</Text>
            </Pressable>
            <Pressable style={[styles.toggleButton, styles.offlineButton]} onPress={() => void setAvailability('OFFLINE')}>
              <Text style={[styles.toggleButtonText, { color: colors.accent }]}>Go Offline</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Current Job</Text>
          {currentJob ? (
            <>
              <Text style={styles.info}>Trip ID: {currentJob.id}</Text>
              <Text style={styles.info}>Pickup: {currentJob.order?.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {currentJob.order?.dropAddress}</Text>
              <Text style={styles.info}>Stage: {currentJob.status}</Text>
            </>
          ) : (
            <Text style={styles.info}>No active trip. Stay online to receive offers.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Queued Job</Text>
          {nextJob ? (
            <>
              <Text style={styles.info}>Order ID: {nextJob.id}</Text>
              <Text style={styles.info}>Pickup: {nextJob.pickupAddress}</Text>
              <Text style={styles.info}>Drop: {nextJob.dropAddress}</Text>
            </>
          ) : (
            <Text style={styles.info}>No queued order right now.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: typography.heading, color: colors.accent, fontSize: 28 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  cardTitle: { fontFamily: typography.bodyBold, color: colors.accent },
  status: { fontFamily: typography.body, color: colors.secondary },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  toggleButton: {
    flex: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  onlineButton: { backgroundColor: colors.secondary },
  offlineButton: {
    backgroundColor: '#FFEDD5',
    borderWidth: 1,
    borderColor: '#FDBA74'
  },
  toggleButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.white
  },
  info: { fontFamily: typography.body, color: colors.mutedText }
});
