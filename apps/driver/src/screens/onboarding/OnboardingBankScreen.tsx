import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, spacing, typography } from '../../theme';
import type { OnboardingStackParamList } from '../../types';
import { useOnboardingStore } from '../../store/useOnboardingStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingBank'>;

export function OnboardingBankScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const updateBank = useOnboardingStore((state) => state.updateBank);
  const state = useOnboardingStore((store) => ({
    accountHolderName: store.accountHolderName,
    bankName: store.bankName,
    accountNumber: store.accountNumber,
    ifscCode: store.ifscCode,
    upiId: store.upiId
  }));

  const [accountHolderName, setAccountHolderName] = useState(state.accountHolderName);
  const [bankName, setBankName] = useState(state.bankName);
  const [accountNumber, setAccountNumber] = useState(state.accountNumber);
  const [ifscCode, setIfscCode] = useState(state.ifscCode);
  const [upiId, setUpiId] = useState(state.upiId);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setAccountHolderName(state.accountHolderName);
    setBankName(state.bankName);
    setAccountNumber(state.accountNumber);
    setIfscCode(state.ifscCode);
    setUpiId(state.upiId);
  }, [state.accountHolderName, state.accountNumber, state.bankName, state.ifscCode, state.upiId]);

  const save = async () => {
    try {
      await updateBank({
        accountHolderName,
        bankName,
        accountNumber,
        ifscCode,
        upiId
      });
      navigation.navigate('OnboardingDocuments');
    } catch {
      Alert.alert('Could not save', 'Please check payout details and retry.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Payout</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Account Holder</Text>
          <TextInput style={styles.input} value={accountHolderName} onChangeText={setAccountHolderName} />
          <Text style={styles.label}>Bank Name</Text>
          <TextInput style={styles.input} value={bankName} onChangeText={setBankName} />
          <Text style={styles.label}>Account Number</Text>
          <TextInput style={styles.input} value={accountNumber} onChangeText={setAccountNumber} keyboardType="number-pad" />
          <Text style={styles.label}>IFSC Code</Text>
          <TextInput style={styles.input} value={ifscCode} onChangeText={setIfscCode} autoCapitalize="characters" />
          <Text style={styles.label}>UPI ID (optional)</Text>
          <TextInput style={styles.input} value={upiId} onChangeText={setUpiId} autoCapitalize="none" />

          <Pressable style={styles.button} onPress={() => void save()} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save & Continue</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { fontFamily: typography.heading, fontSize: 28, color: colors.accent },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs
  },
  label: { fontFamily: typography.bodyBold, color: colors.accent },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#FFF7ED',
    fontFamily: typography.body
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
