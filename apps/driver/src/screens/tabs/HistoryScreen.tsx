import { useMemo } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';

export function HistoryScreen() {
  const earnings = useDriverAppStore((state) => state.earnings);

  const trips = useMemo(() => earnings?.recentTrips ?? [], [earnings?.recentTrips]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Trip History</Text>

        {trips.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.empty}>No completed trips found.</Text>
          </View>
        ) : null}

        {trips.map((trip) => (
          <View key={trip.tripId} style={styles.card}>
            <Text style={styles.tripTitle}>Trip {trip.tripId.slice(0, 8)}</Text>
            <Text style={styles.tripMeta}>Order: {trip.orderId.slice(0, 8)}</Text>
            <Text style={styles.tripMeta}>Fare: INR {trip.fare.toFixed(2)}</Text>
            <Text style={styles.tripMeta}>
              Delivered: {trip.deliveredAt ? new Date(trip.deliveredAt).toLocaleString() : 'N/A'}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 460, alignSelf: 'center' },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  empty: { fontFamily: typography.body, color: colors.mutedText },
  tripTitle: { fontFamily: typography.bodyBold, color: colors.accent },
  tripMeta: { fontFamily: typography.body, color: colors.mutedText }
});
