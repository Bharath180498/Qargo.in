import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../../theme';
import type { OnboardingStackParamList } from '../../types';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { AnimatedTextField } from '../../components/AnimatedTextField';
import { FormScreen } from '../../components/FormScreen';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingBank'>;

export function OnboardingBankScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const updateBank = useOnboardingStore((state) => state.updateBank);
  const storeAccountHolderName = useOnboardingStore((state) => state.accountHolderName);
  const storeBankName = useOnboardingStore((state) => state.bankName);
  const storeAccountNumber = useOnboardingStore((state) => state.accountNumber);
  const storeIfscCode = useOnboardingStore((state) => state.ifscCode);
  const storeUpiId = useOnboardingStore((state) => state.upiId);
  const storeUpiQrImageUrl = useOnboardingStore((state) => state.upiQrImageUrl);
  const error = useOnboardingStore((state) => state.error);

  const [accountHolderName, setAccountHolderName] = useState(storeAccountHolderName);
  const [bankName, setBankName] = useState(storeBankName);
  const [accountNumber, setAccountNumber] = useState(storeAccountNumber);
  const [ifscCode, setIfscCode] = useState(storeIfscCode);
  const [upiId, setUpiId] = useState(storeUpiId);
  const [upiQrImageUrl, setUpiQrImageUrl] = useState(storeUpiQrImageUrl);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (hasLocalEdits) {
      return;
    }

    setAccountHolderName(storeAccountHolderName);
    setBankName(storeBankName);
    setAccountNumber(storeAccountNumber);
    setIfscCode(storeIfscCode);
    setUpiId(storeUpiId);
    setUpiQrImageUrl(storeUpiQrImageUrl);
  }, [
    hasLocalEdits,
    storeAccountHolderName,
    storeAccountNumber,
    storeBankName,
    storeIfscCode,
    storeUpiId,
    storeUpiQrImageUrl
  ]);

  const save = async () => {
    const normalizedUpi = upiId.trim().toLowerCase();
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

    if (!accountHolderName.trim() || !bankName.trim() || !accountNumber.trim() || !ifscCode.trim() || !normalizedUpi) {
      Alert.alert('Required details missing', 'Complete required payout details to continue.');
      return;
    }

    if (!upiPattern.test(normalizedUpi)) {
      Alert.alert('Invalid UPI ID', 'Enter a valid UPI ID (example: driver@okaxis).');
      return;
    }

    try {
      await updateBank({
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: normalizedUpi,
        upiQrImageUrl: upiQrImageUrl.trim()
      });
      setHasLocalEdits(false);
      navigation.navigate('OnboardingDocuments');
    } catch {
      const latestError = useOnboardingStore.getState().error;
      Alert.alert('Could not save', latestError ?? 'Please check payout details and retry.');
    }
  };

  return (
    <FormScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Payout</Text>
        <View style={styles.card}>
          <AnimatedTextField
            label="Account Holder"
            value={accountHolderName}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setAccountHolderName(value);
            }}
            placeholder="Ravi Kumar"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Bank Name"
            value={bankName}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setBankName(value);
            }}
            placeholder="HDFC Bank"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Account Number"
            value={accountNumber}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setAccountNumber(value);
            }}
            keyboardType="number-pad"
            placeholder="123456789000"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="IFSC Code"
            value={ifscCode}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setIfscCode(value);
            }}
            autoCapitalize="characters"
            placeholder="HDFC0000123"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="UPI ID (required)"
            value={upiId}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setUpiId(value);
            }}
            autoCapitalize="none"
            placeholder="ravi@okhdfcbank"
            returnKeyType="done"
          />
          <AnimatedTextField
            label="UPI QR image URL (optional)"
            value={upiQrImageUrl}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setUpiQrImageUrl(value);
            }}
            autoCapitalize="none"
            placeholder="https://.../your-upi-qr.png"
            returnKeyType="done"
          />
          <Text style={styles.helperText}>
            UPI ID is mandatory. Add QR image URL if you want customers to scan your preferred QR directly.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable style={styles.button} onPress={() => void save()} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.buttonText}>Save & Continue</Text>
            )}
          </Pressable>
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs
  },
  errorText: {
    fontFamily: typography.body,
    color: colors.danger,
    fontSize: 12
  },
  helperText: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  buttonText: { fontFamily: typography.bodyBold, color: colors.white }
});
