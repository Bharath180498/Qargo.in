import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { DriverTabParamList } from '../types';
import { HomeScreen } from '../screens/tabs/HomeScreen';
import { EarningsScreen } from '../screens/tabs/EarningsScreen';
import { HistoryScreen } from '../screens/tabs/HistoryScreen';
import { ProfileScreen } from '../screens/tabs/ProfileScreen';
import { colors, typography } from '../theme';

const Tab = createBottomTabNavigator<DriverTabParamList>();

export function DriverTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedText,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#FAD4B4',
          backgroundColor: '#FFF8F1'
        },
        tabBarLabelStyle: {
          fontFamily: typography.body,
          fontSize: 12
        }
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
