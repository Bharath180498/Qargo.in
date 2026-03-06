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
import type { VehicleType } from '@porter/shared';
import { colors, radius, spacing, typography } from '../../theme';
import type { OnboardingStackParamList } from '../../types';
import { useOnboardingStore } from '../../store/useOnboardingStore';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingVehicle'>;

const vehicleOptions: VehicleType[] = ['THREE_WHEELER', 'MINI_TRUCK', 'TRUCK'];

export function OnboardingVehicleScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const updateVehicle = useOnboardingStore((state) => state.updateVehicle);
  const load = useOnboardingStore((state) => state.load);
  const state = useOnboardingStore((store) => ({
    vehicleType: store.vehicleType,
    vehicleNumber: store.vehicleNumber,
    licenseNumber: store.licenseNumber,
    aadhaarNumber: store.aadhaarNumber,
    rcNumber: store.rcNumber
  }));

  const [vehicleType, setVehicleType] = useState<VehicleType>(state.vehicleType);
  const [vehicleNumber, setVehicleNumber] = useState(state.vehicleNumber);
  const [licenseNumber, setLicenseNumber] = useState(state.licenseNumber);
  const [aadhaarNumber, setAadhaarNumber] = useState(state.aadhaarNumber);
  const [rcNumber, setRcNumber] = useState(state.rcNumber);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setVehicleType(state.vehicleType);
    setVehicleNumber(state.vehicleNumber);
    setLicenseNumber(state.licenseNumber);
    setAadhaarNumber(state.aadhaarNumber);
    setRcNumber(state.rcNumber);
  }, [state.aadhaarNumber, state.licenseNumber, state.rcNumber, state.vehicleNumber, state.vehicleType]);

  const save = async () => {
    try {
      await updateVehicle({
        vehicleType,
        vehicleNumber,
        licenseNumber,
        aadhaarNumber,
        rcNumber
      });
      navigation.navigate('OnboardingBank');
    } catch {
      Alert.alert('Could not save', 'Please check vehicle details and retry.');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Vehicle</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.vehicleRow}>
            {vehicleOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.vehicleChip, vehicleType === option && styles.vehicleChipActive]}
                onPress={() => setVehicleType(option)}
              >
                <Text style={[styles.vehicleChipText, vehicleType === option && styles.vehicleChipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Vehicle Number</Text>
          <TextInput style={styles.input} value={vehicleNumber} onChangeText={setVehicleNumber} />
          <Text style={styles.label}>License Number</Text>
          <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} />
          <Text style={styles.label}>Aadhaar Number</Text>
          <TextInput style={styles.input} value={aadhaarNumber} onChangeText={setAadhaarNumber} keyboardType="number-pad" />
          <Text style={styles.label}>RC Number</Text>
          <TextInput style={styles.input} value={rcNumber} onChangeText={setRcNumber} />

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
  vehicleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  vehicleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#FFF7ED'
  },
  vehicleChipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary
  },
  vehicleChipText: {
    fontFamily: typography.body,
    color: colors.accent,
    fontSize: 12
  },
  vehicleChipTextActive: {
    color: colors.white
  },
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
