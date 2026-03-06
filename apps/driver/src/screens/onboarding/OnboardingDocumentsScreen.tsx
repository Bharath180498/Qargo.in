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

export function OnboardingDocumentsScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const uploadDoc = useOnboardingStore((state) => state.uploadDoc);
  const submit = useOnboardingStore((state) => state.submit);
  const uploadedDocs = useOnboardingStore((state) => state.uploadedDocs);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadedSet = useMemo(() => new Set(uploadedDocs), [uploadedDocs]);
  const allUploaded = requiredDocs.every((doc) => uploadedSet.has(doc));

  const upload = async (type: string) => {
    try {
      await uploadDoc(type);
    } catch {
      Alert.alert('Upload failed', 'Could not upload document metadata. Retry.');
    }
  };

  const submitForReview = async () => {
    try {
      await submit();
      navigation.navigate('OnboardingStatus');
    } catch {
      Alert.alert('Submit failed', 'Please complete all onboarding details before submitting.');
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
                <Pressable style={styles.uploadButton} onPress={() => void upload(docType)}>
                  <Text style={styles.uploadButtonText}>{isUploaded ? 'Re-upload' : 'Upload'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        <Pressable style={[styles.submitButton, !allUploaded && styles.submitButtonDisabled]} onPress={() => void submitForReview()} disabled={loading || !allUploaded}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitButtonText}>Submit for KYC Review</Text>}
        </Pressable>

        {!allUploaded ? (
          <Text style={styles.hint}>All required documents must be uploaded before submission.</Text>
        ) : null}
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
  }
});
