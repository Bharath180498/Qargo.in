import { useState } from 'react';
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
import type { AuthStackParamList } from '../../types';
import { useDriverSessionStore } from '../../store/useDriverSessionStore';
import { AnimatedTextField } from '../../components/AnimatedTextField';
import { FormScreen } from '../../components/FormScreen';

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverPhone'>;

export function DriverPhoneScreen({ navigation }: Props) {
  const requestOtp = useDriverSessionStore((state) => state.requestOtp);
  const loading = useDriverSessionStore((state) => state.loading);
  const error = useDriverSessionStore((state) => state.error);
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
      Alert.alert('Request failed', error ?? 'Could not send OTP. Retry in a moment.');
    }
  };

  return (
    <FormScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Drive with Qargo</Text>
        <Text style={styles.subtitle}>Sign in to manage jobs, queue offers, and earnings.</Text>

        <View style={styles.formCard}>
          <AnimatedTextField
            label="Full name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+919000000101"
            keyboardType="phone-pad"
            autoCapitalize="none"
            returnKeyType="done"
          />

          <Pressable style={styles.button} onPress={() => void continueToOtp()} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </Pressable>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {lastOtpCode ? (
            <Text style={styles.mockHint}>Demo OTP (mock mode): {lastOtpCode}</Text>
          ) : (
            <Text style={styles.mockHint}>OTP will be delivered via configured provider.</Text>
          )}
        </View>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  container: {
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
  errorText: {
    fontFamily: typography.body,
    color: '#B91C1C',
    fontSize: 12
  },
  mockHint: {
    fontFamily: typography.body,
    color: colors.mutedText,
    fontSize: 12
  }
});
