import { NavigationContainer } from '@react-navigation/native';
import { useFonts as useSoraFonts, Sora_700Bold } from '@expo-google-fonts/sora';
import {
  useFonts as useManropeFonts,
  Manrope_500Medium,
  Manrope_700Bold
} from '@expo-google-fonts/manrope';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { DriverTabs } from './src/navigation/DriverTabs';
import { OnboardingNavigator } from './src/navigation/OnboardingNavigator';
import { ensureDriverPushRegistered, unregisterDriverPushToken } from './src/services/pushNotifications';
import { useDriverAppStore } from './src/store/useDriverAppStore';
import { useDriverSessionStore } from './src/store/useDriverSessionStore';
import { colors } from './src/theme';

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.paper
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function App() {
  const token = useDriverSessionStore((state) => state.token);
  const user = useDriverSessionStore((state) => state.user);
  const onboardingStatus = useDriverSessionStore((state) => state.onboardingStatus);
  const loading = useDriverSessionStore((state) => state.loading);
  const refreshOnboardingStatus = useDriverSessionStore((state) => state.refreshOnboardingStatus);
  const driverProfileId = useDriverAppStore((state) => state.driverProfileId);
  const lastRegisteredDriverIdRef = useRef<string | undefined>(undefined);

  const [soraLoaded] = useSoraFonts({ Sora_700Bold });
  const [manropeLoaded] = useManropeFonts({ Manrope_500Medium, Manrope_700Bold });

  useEffect(() => {
    if (token && user?.id) {
      void refreshOnboardingStatus();
    }
  }, [refreshOnboardingStatus, token, user?.id]);

  useEffect(() => {
    if (token && driverProfileId) {
      lastRegisteredDriverIdRef.current = driverProfileId;
      void ensureDriverPushRegistered(driverProfileId);
      return;
    }

    if (!token && lastRegisteredDriverIdRef.current) {
      const previousDriverId = lastRegisteredDriverIdRef.current;
      lastRegisteredDriverIdRef.current = undefined;
      void unregisterDriverPushToken(previousDriverId);
    }
  }, [token, driverProfileId]);

  const blockForOnboardingRefresh = Boolean(token && loading && !onboardingStatus);

  if (!soraLoaded || !manropeLoaded || blockForOnboardingRefresh) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {!token ? (
        <AuthNavigator />
      ) : onboardingStatus === 'APPROVED' ? (
        <DriverTabs />
      ) : (
        <OnboardingNavigator />
      )}
    </NavigationContainer>
  );
}
