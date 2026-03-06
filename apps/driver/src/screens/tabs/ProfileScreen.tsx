import { useEffect } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';
import { useDriverAppStore } from '../../store/useDriverAppStore';

export function ProfileScreen() {
  const user = useDriverSessionStore((state) => state.user);
  const onboardingStatus = useDriverSessionStore((state) => state.onboardingStatus);
  const refreshOnboardingStatus = useDriverSessionStore((state) => state.refreshOnboardingStatus);
  const logout = useDriverSessionStore((state) => state.logout);
  const driverProfileId = useDriverAppStore((state) => state.driverProfileId);
  const bootstrap = useDriverAppStore((state) => state.bootstrap);
  const disconnectRealtime = useDriverAppStore((state) => state.disconnectRealtime);

  useEffect(() => {
    void Promise.all([refreshOnboardingStatus(), bootstrap()]);
  }, [bootstrap, refreshOnboardingStatus]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Driver Profile</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Name</Text>
          <Text style={styles.fieldValue}>{user?.name ?? '—'}</Text>
          <Text style={styles.fieldLabel}>Phone</Text>
          <Text style={styles.fieldValue}>{user?.phone ?? '—'}</Text>
          <Text style={styles.fieldLabel}>Driver Profile ID</Text>
          <Text style={styles.fieldValue}>{driverProfileId ?? 'Not available yet'}</Text>
          <Text style={styles.fieldLabel}>Onboarding Status</Text>
          <Text style={[styles.fieldValue, styles.status]}>{onboardingStatus ?? 'NOT_STARTED'}</Text>
        </View>

        <Pressable style={styles.secondaryButton} onPress={() => void Promise.all([refreshOnboardingStatus(), bootstrap()])}>
          <Text style={styles.secondaryText}>Refresh Status</Text>
        </Pressable>

        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert('Logout', 'End your driver session?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: () => {
                  disconnectRealtime();
                  void logout();
                }
              }
            ]);
          }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs
  },
  fieldLabel: { fontFamily: typography.bodyBold, color: colors.mutedText, fontSize: 12 },
  fieldValue: { fontFamily: typography.body, color: colors.accent },
  status: { color: colors.secondary, fontFamily: typography.bodyBold },
  secondaryButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.secondary,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#ECFDF5'
  },
  secondaryText: {
    fontFamily: typography.bodyBold,
    color: colors.secondary
  },
  logoutButton: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: '#FEE2E2'
  },
  logoutText: {
    fontFamily: typography.bodyBold,
    color: '#991B1B'
  }
});
