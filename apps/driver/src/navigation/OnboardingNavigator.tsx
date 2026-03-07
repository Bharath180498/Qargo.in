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
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false
      }}
    >
      <Stack.Screen
        name="OnboardingProfile"
        component={OnboardingProfileScreen}
        options={{
          title: 'Profile',
          headerBackVisible: false
        }}
      />
      <Stack.Screen
        name="OnboardingVehicle"
        component={OnboardingVehicleScreen}
        options={{ title: 'Vehicle' }}
      />
      <Stack.Screen
        name="OnboardingBank"
        component={OnboardingBankScreen}
        options={{ title: 'Payout Details' }}
      />
      <Stack.Screen
        name="OnboardingDocuments"
        component={OnboardingDocumentsScreen}
        options={{ title: 'Documents' }}
      />
      <Stack.Screen
        name="OnboardingStatus"
        component={OnboardingStatusScreen}
        options={{ title: 'Verification Status' }}
      />
    </Stack.Navigator>
  );
}
