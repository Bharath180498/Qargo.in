import { useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';

export function EarningsScreen() {
  const earnings = useDriverAppStore((state) => state.earnings);
  const refreshEarnings = useDriverAppStore((state) => state.refreshEarnings);

  useEffect(() => {
    void refreshEarnings();
  }, [refreshEarnings]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Earnings</Text>

        <View style={styles.card}>
          <Text style={styles.metricLabel}>Net Payout (30d)</Text>
          <Text style={styles.metricValue}>INR {earnings?.summary.netPayout.toFixed(2) ?? '0.00'}</Text>
          <Text style={styles.metricSub}>Trips: {earnings?.tripCount ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.row}>Gross Fare: INR {earnings?.summary.grossFare.toFixed(2) ?? '0.00'}</Text>
          <Text style={styles.row}>Waiting Charges: INR {earnings?.summary.waitingCharges.toFixed(2) ?? '0.00'}</Text>
          <Text style={styles.row}>Commission: INR {earnings?.summary.commission.toFixed(2) ?? '0.00'}</Text>
        </View>
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
  metricLabel: { fontFamily: typography.bodyBold, color: colors.accent },
  metricValue: { fontFamily: typography.heading, color: colors.primary, fontSize: 34 },
  metricSub: { fontFamily: typography.body, color: colors.mutedText },
  row: { fontFamily: typography.body, color: colors.mutedText }
});
