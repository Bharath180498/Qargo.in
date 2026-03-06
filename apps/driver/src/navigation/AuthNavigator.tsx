import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../types';
import { DriverPhoneScreen } from '../screens/auth/DriverPhoneScreen';
import { DriverOtpScreen } from '../screens/auth/DriverOtpScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverPhone" component={DriverPhoneScreen} />
      <Stack.Screen name="DriverOtp" component={DriverOtpScreen} />
    </Stack.Navigator>
  );
}
