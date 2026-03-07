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
import type { VehicleType } from '@porter/shared';
import { colors, radius, spacing, typography } from '../../theme';
import type { OnboardingStackParamList } from '../../types';
import { useOnboardingStore } from '../../store/useOnboardingStore';
import { AnimatedTextField } from '../../components/AnimatedTextField';
import { FormScreen } from '../../components/FormScreen';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'OnboardingVehicle'>;

const vehicleOptions: VehicleType[] = ['THREE_WHEELER', 'MINI_TRUCK', 'TRUCK'];

export function OnboardingVehicleScreen({ navigation }: Props) {
  const loading = useOnboardingStore((state) => state.loading);
  const updateVehicle = useOnboardingStore((state) => state.updateVehicle);
  const load = useOnboardingStore((state) => state.load);
  const storeVehicleType = useOnboardingStore((state) => state.vehicleType);
  const storeVehicleNumber = useOnboardingStore((state) => state.vehicleNumber);
  const storeLicenseNumber = useOnboardingStore((state) => state.licenseNumber);
  const storeAadhaarNumber = useOnboardingStore((state) => state.aadhaarNumber);
  const storeRcNumber = useOnboardingStore((state) => state.rcNumber);
  const error = useOnboardingStore((state) => state.error);

  const [vehicleType, setVehicleType] = useState<VehicleType>(storeVehicleType);
  const [vehicleNumber, setVehicleNumber] = useState(storeVehicleNumber);
  const [licenseNumber, setLicenseNumber] = useState(storeLicenseNumber);
  const [aadhaarNumber, setAadhaarNumber] = useState(storeAadhaarNumber);
  const [rcNumber, setRcNumber] = useState(storeRcNumber);
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (hasLocalEdits) {
      return;
    }

    setVehicleType(storeVehicleType);
    setVehicleNumber(storeVehicleNumber);
    setLicenseNumber(storeLicenseNumber);
    setAadhaarNumber(storeAadhaarNumber);
    setRcNumber(storeRcNumber);
  }, [
    hasLocalEdits,
    storeAadhaarNumber,
    storeLicenseNumber,
    storeRcNumber,
    storeVehicleNumber,
    storeVehicleType
  ]);

  const save = async () => {
    if (!vehicleNumber.trim() || !licenseNumber.trim()) {
      Alert.alert('Required details missing', 'Enter vehicle number and license number to continue.');
      return;
    }

    try {
      await updateVehicle({
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseNumber: licenseNumber.trim().toUpperCase(),
        aadhaarNumber: aadhaarNumber.trim(),
        rcNumber: rcNumber.trim().toUpperCase()
      });
      setHasLocalEdits(false);
      navigation.navigate('OnboardingBank');
    } catch {
      const latestError = useOnboardingStore.getState().error;
      Alert.alert('Could not save', latestError ?? 'Please check vehicle details and retry.');
    }
  };

  return (
    <FormScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Onboarding: Vehicle</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Vehicle Type</Text>
          <View style={styles.vehicleRow}>
            {vehicleOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.vehicleChip, vehicleType === option && styles.vehicleChipActive]}
                onPress={() => {
                  setHasLocalEdits(true);
                  setVehicleType(option);
                }}
              >
                <Text style={[styles.vehicleChipText, vehicleType === option && styles.vehicleChipTextActive]}>
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <AnimatedTextField
            label="Vehicle Number"
            value={vehicleNumber}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setVehicleNumber(value);
            }}
            autoCapitalize="characters"
            placeholder="KA01AB1234"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="License Number"
            value={licenseNumber}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setLicenseNumber(value);
            }}
            autoCapitalize="characters"
            placeholder="DL0420120012345"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="Aadhaar Number"
            value={aadhaarNumber}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setAadhaarNumber(value);
            }}
            keyboardType="number-pad"
            placeholder="123412341234"
            returnKeyType="next"
          />
          <AnimatedTextField
            label="RC Number"
            value={rcNumber}
            onChangeText={(value) => {
              setHasLocalEdits(true);
              setRcNumber(value);
            }}
            autoCapitalize="characters"
            placeholder="KA01RC1234"
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
