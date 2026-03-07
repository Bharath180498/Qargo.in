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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingProfile'>;

export function OnboardingProfileScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const updateProfile = useOnboardingStore((state) => state.updateProfile);
  const storeFullName = useOnboardingStore((state) => state.fullName);
  const storePhone = useOnboardingStore((state) => state.phone);
  const storeEmail = useOnboardingStore((state) => state.email);
  const storeCity = useOnboardingStore((state) => state.city);
  const error = useOnboardingStore((state) => state.error);

  const [fullName, setFullName] = useState(storeFullName);
  const [phone, setPhone] = useState(storePhone);
  const [email, setEmail] = useState(storeEmail);
  const [city, setCity] = useState(storeCity);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (hasLocalEdits) {
      return;
    }

    setFullName(storeFullName);
    setPhone(storePhone);
    setEmail(storeEmail);
    setCity(storeCity);
  }, [hasLocalEdits, storeCity, storeEmail, storeFullName, storePhone]);

  const save = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Required details missing', 'Enter full name and phone to continue.');
      return;
    }

    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim()
      });
      setHasLocalEdits(false);
      navigation.navigate('OnboardingVehicle');
    } catch {
      const latestError = useOnboardingStore.getState().error;
      Alert.alert('Could not save', latestError ?? 'Please check details and retry.');
    }
  };

  return (
    <FormScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Profile</Text>
        <View style={styles.card}>
          <AnimatedTextField
            label="Full name"
            value={fullName}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setFullName(value);
            }}
            placeholder="Ravi Kumar"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Phone"
            value={phone}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setPhone(value);
            }}
            keyboardType="phone-pad"
            placeholder="+91 90000 00000"
            autoCapitalize="none"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Email"
            value={email}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setEmail(value);
            }}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@example.com"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="City"
            value={city}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setCity(value);
            }}
            placeholder="Bengaluru"
            returnKeyType="done"
          />

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
  button: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  buttonText: { fontFamily: typography.bodyBold, color: colors.white }
});
