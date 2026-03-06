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

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingProfile'>;

export function OnboardingProfileScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const load = useOnboardingStore((state) => state.load);
  const updateProfile = useOnboardingStore((state) => state.updateProfile);
  const store = useOnboardingStore((state) => ({
    fullName: state.fullName,
    phone: state.phone,
    email: state.email,
    city: state.city
  }));

  const [fullName, setFullName] = useState(store.fullName);
  const [phone, setPhone] = useState(store.phone);
  const [email, setEmail] = useState(store.email);
  const [city, setCity] = useState(store.city);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setFullName(store.fullName);
    setPhone(store.phone);
    setEmail(store.email);
    setCity(store.city);
  }, [store.city, store.email, store.fullName, store.phone]);

  const save = async () => {
    try {
      await updateProfile({ fullName, phone, email, city });
      navigation.navigate('OnboardingVehicle');
    } catch {
      Alert.alert('Could not save', 'Please check details and retry.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Profile</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
          <Text style={styles.label}>Phone</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" />
          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} />

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
