import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverAppStore } from '../../store/useDriverAppStore';

const PLAN_OPTIONS: Array<{
  plan: 'GO' | 'PRO' | 'ENTERPRISE';
  title: string;
  fee: string;
  copy: string;
}> = [
  {
    plan: 'GO',
    title: 'Go',
    fee: 'INR 500 / month',
    copy: 'For regular city drivers'
  },
  {
    plan: 'PRO',
    title: 'Pro',
    fee: 'INR 1000 / month',
    copy: 'Priority support and pro tools'
  },
  {
    plan: 'ENTERPRISE',
    title: 'Enterprise',
    fee: 'Contact sales',
    copy: 'For fleet partners and high-volume bookings'
  }
];

function formatInr(value?: number) {
  const safeValue = Number(value ?? 0);
  return `INR ${safeValue.toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function EarningsScreen() {
  const earnings = useDriverAppStore((state) => state.earnings);
  const refreshEarnings = useDriverAppStore((state) => state.refreshEarnings);
  const setSubscriptionPlan = useDriverAppStore((state) => state.setSubscriptionPlan);
  const [updatingPlan, setUpdatingPlan] = useState(false);

  useEffect(() => {
    void refreshEarnings();
  }, [refreshEarnings]);

  const subscription = earnings?.subscription;
  const selectedPlan = subscription?.plan ?? 'GO';
  const trialMessage = useMemo(() => {
    if (!subscription?.trial) {
      return 'Loading subscription details...';
    }

    if (subscription.trial.isActive) {
      return `Trial active • ${subscription.trial.daysLeft} day(s) left • Ends ${formatDate(subscription.trial.endsAt)}`;
    }

    return `Trial completed on ${formatDate(subscription.trial.endsAt)}`;
  }, [subscription?.trial]);

  const onSelectPlan = async (plan: 'GO' | 'PRO' | 'ENTERPRISE') => {
    if (updatingPlan || plan === selectedPlan) {
      return;
    }

    try {
      setUpdatingPlan(true);
      await setSubscriptionPlan(plan);
      Alert.alert('Plan updated', `Driver subscription switched to ${plan}.`);
    } catch {
      Alert.alert('Could not update plan', 'Please retry in a few seconds.');
    } finally {
      setUpdatingPlan(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Earnings</Text>
        <Text style={styles.subtitle}>Drivers keep 100% trip earnings. Subscription starts after 90-day trial.</Text>

        <View style={[styles.card, styles.highlightCard]}>
          <Text style={styles.metricLabel}>Take-home (30d)</Text>
          <Text style={styles.metricValue}>{formatInr(earnings?.summary.takeHomeAfterSubscription ?? earnings?.summary.netPayout)}</Text>
          <Text style={styles.metricSub}>Trips completed: {earnings?.tripCount ?? 0}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Breakdown</Text>
          <Text style={styles.row}>Gross Fare: {formatInr(earnings?.summary.grossFare)}</Text>
          <Text style={styles.row}>Waiting Charges: {formatInr(earnings?.summary.waitingCharges)}</Text>
          <Text style={styles.row}>Trip Commission: {formatInr(earnings?.summary.commission)}</Text>
          <Text style={styles.row}>
            Subscription Fee (range): {formatInr(earnings?.summary.subscriptionFee)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subscription</Text>
          <Text style={styles.subscriptionHint}>{trialMessage}</Text>
          <Text style={styles.subscriptionHint}>Current Plan: {selectedPlan}</Text>
          <Text style={styles.subscriptionHint}>
            Current Monthly Fee:{' '}
            {subscription?.monthlyFeeInr ? `INR ${subscription.monthlyFeeInr}` : 'Contact sales'}
          </Text>
          <Text style={styles.subscriptionHint}>{subscription?.note ?? 'Select a plan below.'}</Text>

          <View style={styles.planGrid}>
            {PLAN_OPTIONS.map((option) => {
              const active = option.plan === selectedPlan;
              return (
                <Pressable
                  key={option.plan}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => void onSelectPlan(option.plan)}
                  disabled={updatingPlan}
                >
                  <Text style={[styles.planTitle, active && styles.planTitleActive]}>{option.title}</Text>
                  <Text style={[styles.planFee, active && styles.planTitleActive]}>{option.fee}</Text>
                  <Text style={[styles.planCopy, active && styles.planTitleActive]}>{option.copy}</Text>
                </Pressable>
              );
            })}
          </View>

          {updatingPlan ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.secondary} />
              <Text style={styles.loadingText}>Updating plan...</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 460, alignSelf: 'center' },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  subtitle: { fontFamily: typography.body, color: colors.mutedText, marginTop: -4 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  highlightCard: {
    borderColor: colors.secondary,
    backgroundColor: '#EEFFF9'
  },
  cardTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent
  },
  metricLabel: { fontFamily: typography.bodyBold, color: colors.accent },
  metricValue: { fontFamily: typography.heading, color: colors.primary, fontSize: 34 },
  metricSub: { fontFamily: typography.body, color: colors.mutedText },
  row: { fontFamily: typography.body, color: colors.mutedText },
  subscriptionHint: { fontFamily: typography.body, color: colors.mutedText },
  planGrid: {
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  planCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    backgroundColor: '#FFF9F2',
    gap: 2
  },
  planCardActive: {
    borderColor: colors.secondary,
    backgroundColor: '#0B6B5A'
  },
  planTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 16
  },
  planFee: {
    fontFamily: typography.bodyBold,
    color: colors.primary
  },
  planCopy: {
    fontFamily: typography.body,
    color: colors.mutedText
  },
  planTitleActive: {
    color: colors.white
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  loadingText: {
    fontFamily: typography.body,
    color: colors.mutedText
  }
});
