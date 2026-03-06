import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '../types';
import { OnboardingProfileScreen } from '../screens/onboarding/OnboardingProfileScreen';
import { OnboardingVehicleScreen } from '../screens/onboarding/OnboardingVehicleScreen';
import { OnboardingBankScreen } from '../screens/onboarding/OnboardingBankScreen';
import { OnboardingDocumentsScreen } from '../screens/onboarding/OnboardingDocumentsScreen';
import { OnboardingStatusScreen } from '../screens/onboarding/OnboardingStatusScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="OnboardingProfile" component={OnboardingProfileScreen} />
      <Stack.Screen name="OnboardingVehicle" component={OnboardingVehicleScreen} />
      <Stack.Screen name="OnboardingBank" component={OnboardingBankScreen} />
      <Stack.Screen name="OnboardingDocuments" component={OnboardingDocumentsScreen} />
      <Stack.Screen name="OnboardingStatus" component={OnboardingStatusScreen} />
    </Stack.Navigator>
  );
}
