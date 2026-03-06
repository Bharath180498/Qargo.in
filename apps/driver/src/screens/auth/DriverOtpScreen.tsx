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

type Props = NativeStackScreenProps<AuthStackParamList, 'DriverOtp'>;

export function DriverOtpScreen({ route }: Props) {
  const verifyOtp = useDriverSessionStore((state) => state.verifyOtp);
  const loading = useDriverSessionStore((state) => state.loading);

  const [code, setCode] = useState('123456');

  const verify = async () => {
    try {
      await verifyOtp({
        phone: route.params.phone,
        code,
        name: route.params.name
      });
    } catch {
      Alert.alert('Invalid OTP', 'Please check the OTP and retry.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Verify OTP</Text>
        <Text style={styles.subtitle}>Sent to {route.params.phone}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Enter code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
          />

          <Pressable style={styles.button} onPress={() => void verify()} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Verify & Continue</Text>}
          </Pressable>
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
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
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
    fontSize: 22,
    color: colors.accent,
    letterSpacing: 5,
    backgroundColor: '#FFF7ED'
  },
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.secondary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  buttonText: {
    color: colors.white,
    fontFamily: typography.bodyBold
  }
});
