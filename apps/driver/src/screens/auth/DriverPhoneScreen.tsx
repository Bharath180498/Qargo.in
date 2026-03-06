import { useState } from 'react';
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
import type { AuthStackParamList } from '../../types';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverPhone'>;

export function DriverPhoneScreen({ navigation }: Props) {
  const requestOtp = useDriverSessionStore((state) => state.requestOtp);
  const loading = useDriverSessionStore((state) => state.loading);
  const lastOtpCode = useDriverSessionStore((state) => state.lastOtpCode);

  const [name, setName] = useState('Driver Demo');
  const [phone, setPhone] = useState('+919000000101');

  const continueToOtp = async () => {
    if (!phone.trim()) {
      Alert.alert('Phone required', 'Enter a valid phone number to continue.');
      return;
    }

    try {
      await requestOtp(phone.trim(), name.trim() || undefined);
      navigation.navigate('DriverOtp', {
        phone: phone.trim(),
        role: 'DRIVER',
        name: name.trim() || undefined
      });
    } catch {
      Alert.alert('Request failed', 'Could not send OTP. Retry in a moment.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Drive with SamaanGaadi</Text>
        <Text style={styles.subtitle}>Sign in to manage jobs, queue offers, and earnings.</Text>

        <View style={styles.formCard}>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
          />

          <Text style={styles.label}>Phone number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+919000000101"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />

          <Pressable style={styles.button} onPress={() => void continueToOtp()} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </Pressable>

          {lastOtpCode ? (
            <Text style={styles.mockHint}>Demo OTP (mock mode): {lastOtpCode}</Text>
          ) : (
            <Text style={styles.mockHint}>OTP will be delivered via configured provider.</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper
  },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg
  },
  title: {
    fontFamily: typography.heading,
    fontSize: 30,
    color: colors.accent
  },
  subtitle: {
    fontFamily: typography.body,
    color: colors.mutedText
  },
  formCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm
  },
  label: {
    fontFamily: typography.bodyBold,
    color: colors.accent
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: typography.body,
    color: colors.accent,
    backgroundColor: '#FFF7ED'
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  buttonText: {
    color: colors.white,
    fontFamily: typography.bodyBold
  },
  mockHint: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  }
});
