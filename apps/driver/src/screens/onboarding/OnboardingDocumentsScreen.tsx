import { useEffect, useMemo } from 'react';
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
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../../theme';
import type { OnboardingStackParamList } from '../../types';
import { useOnboardingStore } from '../../store/useOnboardingStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingDocuments'>;

const requiredDocs = ['AADHAAR_FRONT', 'LICENSE_FRONT', 'RC_FRONT', 'SELFIE'];

function normalizeType(value: string) {
  return value.trim().toUpperCase();
}

export function OnboardingDocumentsScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const uploadDoc = useOnboardingStore((state) => state.uploadDoc);
  const submit = useOnboardingStore((state) => state.submit);
  const uploadedDocs = useOnboardingStore((state) => state.uploadedDocs);
  const fullName = useOnboardingStore((state) => state.fullName);
  const phone = useOnboardingStore((state) => state.phone);
  const vehicleType = useOnboardingStore((state) => state.vehicleType);
  const vehicleNumber = useOnboardingStore((state) => state.vehicleNumber);
  const licenseNumber = useOnboardingStore((state) => state.licenseNumber);
  const accountHolderName = useOnboardingStore((state) => state.accountHolderName);
  const bankName = useOnboardingStore((state) => state.bankName);
  const accountNumber = useOnboardingStore((state) => state.accountNumber);
  const ifscCode = useOnboardingStore((state) => state.ifscCode);
  const upiId = useOnboardingStore((state) => state.upiId);
  const error = useOnboardingStore((state) => state.error);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadedSet = useMemo(
    () => new Set(uploadedDocs.map((docType) => normalizeType(docType))),
    [uploadedDocs]
  );
  const missingDocs = useMemo(
    () => requiredDocs.filter((doc) => !uploadedSet.has(normalizeType(doc))),
    [uploadedSet]
  );
  const allUploaded = missingDocs.length === 0;
  const missingOnboardingFields = useMemo(
    () =>
      [
        ['full name', fullName],
        ['phone', phone],
        ['vehicle type', vehicleType],
        ['vehicle number', vehicleNumber],
        ['license number', licenseNumber],
        ['account holder', accountHolderName],
        ['bank name', bankName],
        ['account number', accountNumber],
        ['IFSC code', ifscCode],
        ['UPI ID', upiId]
      ]
        .filter(([, value]) => !String(value ?? '').trim())
        .map(([label]) => label),
    [
      accountHolderName,
      accountNumber,
      bankName,
      fullName,
      ifscCode,
      licenseNumber,
      phone,
      upiId,
      vehicleNumber,
      vehicleType
    ]
  );

  const upload = async (type: string) => {
    try {
      await uploadDoc(type);
    } catch {
      Alert.alert('Upload failed', 'Could not upload document metadata. Retry.');
    }
  };

  const submitForReview = async () => {
    if (!allUploaded) {
      Alert.alert(
        'Upload remaining documents',
        `Please upload: ${missingDocs.map((item) => item.replace(/_/g, ' ')).join(', ')}`
      );
      return;
    }

    if (missingOnboardingFields.length > 0) {
      Alert.alert(
        'Complete onboarding details',
        `Missing: ${missingOnboardingFields.join(', ')}`
      );
      return;
    }

    try {
      await submit();
      navigation.navigate('OnboardingStatus');
    } catch {
      const latestError = useOnboardingStore.getState().error;
      Alert.alert(
        'Submit failed',
        latestError ??
          error ??
          'Please complete profile, vehicle, and payout details before submitting for review.'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Onboarding: Documents</Text>
        <Text style={styles.subtitle}>Upload required KYC docs to submit verification.</Text>

        <View style={styles.card}>
          {requiredDocs.map((docType) => {
            const isUploaded = uploadedSet.has(docType);
            return (
              <View key={docType} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.docTitle}>{docType.replace(/_/g, ' ')}</Text>
                  <Text style={[styles.docState, isUploaded ? styles.docStateOk : styles.docStatePending]}>
                    {isUploaded ? 'Uploaded' : 'Pending'}
                  </Text>
                </View>
                <Pressable style={styles.uploadButton} onPress={() => void upload(docType)} disabled={loading}>
                  <Text style={styles.uploadButtonText}>{isUploaded ? 'Re-upload' : 'Upload'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable style={[styles.submitButton, !allUploaded && styles.submitButtonDisabled]} onPress={() => void submitForReview()} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>Submit for KYC Review</Text>}
        </Pressable>

        {!allUploaded ? (
          <Text style={styles.hint}>
            Missing: {missingDocs.map((item) => item.replace(/_/g, ' ')).join(', ')}
          </Text>
        ) : null}
        {missingOnboardingFields.length > 0 ? (
          <Text style={styles.hint}>
            Complete before submit: {missingOnboardingFields.join(', ')}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  subtitle: { fontFamily: typography.body, color: colors.mutedText },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: '#FFF7ED'
  },
  rowText: {
    gap: 2,
    flex: 1
  },
  docTitle: {
    fontFamily: typography.bodyBold,
    color: colors.accent,
    fontSize: 13
  },
  docState: {
    fontFamily: typography.body,
    fontSize: 12
  },
  docStateOk: {
    color: colors.success
  },
  docStatePending: {
    color: colors.warning
  },
  uploadButton: {
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  uploadButtonText: {
    color: colors.white,
    fontFamily: typography.bodyBold,
    fontSize: 12
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonText: {
    color: colors.white,
    fontFamily: typography.bodyBold
  },
  hint: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  },
  error: {
    fontFamily: typography.body,
    color: '#B91C1C',
    fontSize: 12
  }
});
