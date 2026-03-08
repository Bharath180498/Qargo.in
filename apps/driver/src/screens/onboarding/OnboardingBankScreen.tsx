import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { OnboardingCoachBanner } from '../../components/OnboardingCoachBanner';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingBank'>;

interface PickedImage {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

async function pickQrImageFromLibrary(): Promise<PickedImage | null> {
  try {
    const ImagePicker = require('expo-image-picker') as {
      MediaTypeOptions?: { Images?: unknown };
      requestMediaLibraryPermissionsAsync: () => Promise<{ granted: boolean }>;
      launchImageLibraryAsync: (options: Record<string, unknown>) => Promise<{
        canceled: boolean;
        assets?: PickedImage[];
      }>;
    };

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Allow photo library access to upload QR image.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images,
      allowsEditing: true,
      quality: 0.8
    });

    if (result.canceled || !result.assets?.[0]) {
      return null;
    }

    return result.assets[0];
  } catch {
    throw new Error(
      'QR picker is unavailable. Install dependency with: npx expo install expo-image-picker'
    );
  }
}

export function OnboardingBankScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const updateBank = useOnboardingStore((state) => state.updateBank);
  const uploadPaymentMethodQr = useOnboardingStore((state) => state.uploadPaymentMethodQr);
  const setPreferredPaymentMethod = useOnboardingStore((state) => state.setPreferredPaymentMethod);
  const removePaymentMethod = useOnboardingStore((state) => state.removePaymentMethod);
  const paymentMethods = useOnboardingStore((state) => state.paymentMethods);
  const storeAccountHolderName = useOnboardingStore((state) => state.accountHolderName);
  const storeBankName = useOnboardingStore((state) => state.bankName);
  const storeAccountNumber = useOnboardingStore((state) => state.accountNumber);
  const storeIfscCode = useOnboardingStore((state) => state.ifscCode);
  const storeUpiId = useOnboardingStore((state) => state.upiId);
  const error = useOnboardingStore((state) => state.error);

  const [accountHolderName, setAccountHolderName] = useState(storeAccountHolderName);
  const [bankName, setBankName] = useState(storeBankName);
  const [accountNumber, setAccountNumber] = useState(storeAccountNumber);
  const [ifscCode, setIfscCode] = useState(storeIfscCode);
  const [upiId, setUpiId] = useState(storeUpiId);
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
  }, [
    hasLocalEdits,
    storeAccountHolderName,
    storeAccountNumber,
    storeBankName,
    storeIfscCode,
    storeUpiId
  ]);

  const pickAndUploadQr = async () => {
    const normalizedUpi = upiId.trim().toLowerCase();
    const upiPattern = /^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i;

    if (!normalizedUpi || !upiPattern.test(normalizedUpi)) {
      Alert.alert('UPI first', 'Enter a valid UPI ID before adding QR code.');
      return;
    }

    let asset: PickedImage | null = null;
    try {
      asset = await pickQrImageFromLibrary();
    } catch (error: unknown) {
      Alert.alert('QR upload setup required', String((error as Error)?.message ?? 'Unable to open image picker.'));
      return;
    }

    if (!asset) {
      return;
    }

    try {
      await uploadPaymentMethodQr({
        fileUri: asset.uri,
        fileName: asset.fileName || undefined,
        contentType: asset.mimeType || 'image/jpeg',
        upiId: normalizedUpi,
        label: `QR ${paymentMethods.length + 1}`,
        isPreferred: paymentMethods.length === 0
      });
    } catch {
      Alert.alert('Upload failed', useOnboardingStore.getState().error ?? 'Could not add QR code.');
    }
  };

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

    if (paymentMethods.length === 0) {
      Alert.alert('Add at least one QR', 'Upload one UPI QR image so customers can pay directly.');
      return;
    }

    try {
      await updateBank({
        accountHolderName: accountHolderName.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: normalizedUpi
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
        <OnboardingCoachBanner step={3} total={5} tipKey="onboarding.help.payout" />
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
            label="Primary UPI ID"
            value={upiId}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setUpiId(value);
            }}
            autoCapitalize="none"
            placeholder="ravi@okhdfcbank"
            returnKeyType="done"
          />

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>UPI QR Codes</Text>
            <Pressable style={styles.uploadQrButton} onPress={() => void pickAndUploadQr()} disabled={loading}>
              <Text style={styles.uploadQrButtonText}>Upload QR</Text>
            </Pressable>
          </View>

          <View style={styles.methodList}>
            {paymentMethods.length === 0 ? (
              <Text style={styles.helperText}>No QR added yet. Upload one or more QR codes.</Text>
            ) : (
              paymentMethods.map((method) => (
                <View key={method.id} style={[styles.methodCard, method.isPreferred && styles.methodCardPreferred]}>
                  <View style={styles.methodTopRow}>
                    <View style={styles.methodMeta}>
                      <Text style={styles.methodTitle}>{method.label ?? 'UPI QR'}</Text>
                      <Text style={styles.methodSubtitle}>{method.upiId}</Text>
                    </View>
                    {method.isPreferred ? <Text style={styles.preferredBadge}>Preferred</Text> : null}
                  </View>
                  {method.qrImageUrl ? (
                    <Image source={{ uri: method.qrImageUrl }} style={styles.qrPreview} />
                  ) : (
                    <Text style={styles.helperText}>QR uploaded (preview unavailable in current storage mode)</Text>
                  )}
                  <View style={styles.methodActions}>
                    {!method.isPreferred ? (
                      <Pressable
                        style={styles.methodActionButton}
                        onPress={() => void setPreferredPaymentMethod(method.id)}
                        disabled={loading}
                      >
                        <Text style={styles.methodActionText}>Set preferred</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.methodActionButton, styles.methodActionDanger]}
                      onPress={() => void removePaymentMethod(method.id)}
                      disabled={loading}
                    >
                      <Text style={[styles.methodActionText, styles.methodActionDangerText]}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

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
  sectionHeader: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  sectionTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 14
  },
  uploadQrButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: colors.secondary
  },
  uploadQrButtonText: {
    fontFamily: typography.bodyBold,
    color: colors.secondary,
    fontSize: 12
  },
  methodList: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  methodCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.xs,
    backgroundColor: colors.paper
  },
  methodCardPreferred: {
    borderColor: '#0F766E',
    backgroundColor: '#ECFDF5'
  },
  methodTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  methodMeta: {
    gap: 2
  },
  methodTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 13
  },
  methodSubtitle: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  preferredBadge: {
    fontFamily: typography.bodyBold,
    fontSize: 11,
    color: '#0F766E',
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999
  },
  qrPreview: {
    width: 128,
    height: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white
  },
  methodActions: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  methodActionButton: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD'
  },
  methodActionDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5'
  },
  methodActionText: {
    fontFamily: typography.bodyBold,
    color: '#1D4ED8',
    fontSize: 12
  },
  methodActionDangerText: {
    color: '#B91C1C'
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
