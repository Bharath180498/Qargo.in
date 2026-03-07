import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';
import { useDriverAppStore } from '../../store/useDriverAppStore';
import { useOnboardingStore } from '../../store/useOnboardingStore';

export function ProfileScreen() {
  const user = useDriverSessionStore((state) => state.user);
  const onboardingStatus = useDriverSessionStore((state) => state.onboardingStatus);
  const refreshOnboardingStatus = useDriverSessionStore((state) => state.refreshOnboardingStatus);
  const logout = useDriverSessionStore((state) => state.logout);
  const driverProfileId = useDriverAppStore((state) => state.driverProfileId);
  const bootstrap = useDriverAppStore((state) => state.bootstrap);
  const disconnectRealtime = useDriverAppStore((state) => state.disconnectRealtime);
  const loadOnboarding = useOnboardingStore((state) => state.load);
  const updateBank = useOnboardingStore((state) => state.updateBank);
  const onboardingLoading = useOnboardingStore((state) => state.loading);
  const accountHolderName = useOnboardingStore((state) => state.accountHolderName);
  const bankName = useOnboardingStore((state) => state.bankName);
  const accountNumber = useOnboardingStore((state) => state.accountNumber);
  const ifscCode = useOnboardingStore((state) => state.ifscCode);
  const onboardingUpiId = useOnboardingStore((state) => state.upiId);
  const onboardingUpiQrImageUrl = useOnboardingStore((state) => state.upiQrImageUrl);
  const onboardingError = useOnboardingStore((state) => state.error);
  const [upiId, setUpiId] = useState('');
  const [upiQrImageUrl, setUpiQrImageUrl] = useState('');
  const [savingPayout, setSavingPayout] = useState(false);

  useEffect(() => {
    void Promise.all([refreshOnboardingStatus(), bootstrap(), loadOnboarding()]);
  }, [bootstrap, loadOnboarding, refreshOnboardingStatus]);

  useEffect(() => {
    setUpiId(onboardingUpiId);
    setUpiQrImageUrl(onboardingUpiQrImageUrl);
  }, [onboardingUpiId, onboardingUpiQrImageUrl]);

  const savePayoutPreferences = async () => {
    const normalizedUpi = upiId.trim().toLowerCase();
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      Alert.alert('Bank details missing', 'Complete payout bank setup first, then add UPI preferences.');
      return;
    }

    if (!normalizedUpi || !upiPattern.test(normalizedUpi)) {
      Alert.alert('Invalid UPI', 'Enter a valid UPI ID (example: driver@okaxis).');
      return;
    }

    try {
      setSavingPayout(true);
      await updateBank({
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        upiId: normalizedUpi,
        upiQrImageUrl: upiQrImageUrl.trim()
      });
      Alert.alert('Saved', 'Payout UPI preferences updated.');
    } catch {
      Alert.alert('Save failed', useOnboardingStore.getState().error ?? 'Unable to save payout details.');
    } finally {
      setSavingPayout(false);
    }
  };

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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout Preferences</Text>
          <Text style={styles.fieldLabel}>UPI ID</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            autoCapitalize="none"
            placeholder="driver@okaxis"
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.fieldLabel}>UPI QR Image URL (optional)</Text>
          <TextInput
            style={styles.input}
            value={upiQrImageUrl}
            onChangeText={setUpiQrImageUrl}
            autoCapitalize="none"
            placeholder="https://.../qr.png"
            placeholderTextColor={colors.mutedText}
          />
          <Text style={styles.helperText}>
            Customers can pay directly to this UPI. QR URL is shown in customer payment screen.
          </Text>
          {onboardingLoading ? <ActivityIndicator color={colors.primary} /> : null}
          {onboardingError ? <Text style={styles.errorText}>{onboardingError}</Text> : null}
          <Pressable style={styles.secondaryButton} onPress={() => void savePayoutPreferences()} disabled={savingPayout}>
            {savingPayout ? <ActivityIndicator color={colors.secondary} /> : <Text style={styles.secondaryText}>Save Payout Preferences</Text>}
          </Pressable>
        </View>

        <Pressable
          style={styles.secondaryButton}
          onPress={() => void Promise.all([refreshOnboardingStatus(), bootstrap(), loadOnboarding()])}
        >
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
  sectionTitle: { fontFamily: typography.bodyBold, color: colors.accent, fontSize: 15, marginBottom: 4 },
  fieldLabel: { fontFamily: typography.bodyBold, color: colors.mutedText, fontSize: 12 },
  fieldValue: { fontFamily: typography.body, color: colors.accent },
  status: { color: colors.secondary, fontFamily: typography.bodyBold },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontFamily: typography.body,
    color: colors.accent,
    backgroundColor: colors.paper
  },
  helperText: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  errorText: {
    fontFamily: typography.body,
    color: colors.danger,
    fontSize: 12
  },
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
