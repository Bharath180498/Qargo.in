import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../../services/api';
import { isOngoingOrderStatus, useCustomerStore } from '../../store/useCustomerStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { RootStackParamList } from '../../types/navigation';
import { CustomerSideDrawer, type DrawerRoute } from '../../components/CustomerSideDrawer';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerProfile'>;

interface OrderSummaryRow {
  status: string;
  finalPrice?: number;
  estimatedPrice?: number;
}

export function CustomerProfileScreen({ navigation }: Props) {
  const user = useSessionStore((state) => state.user);
  const activeOrderId = useCustomerStore((state) => state.activeOrderId);
  const [orders, setOrders] = useState<OrderSummaryRow[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const supportNumber = '9844259899';

  const loadStats = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    const response = await api.get('/orders', {
      params: {
        customerId: user.id
      }
    });

    setOrders(Array.isArray(response.data) ? (response.data as OrderSummaryRow[]) : []);
  }, [user?.id]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const stats = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter((item) => item.status === 'DELIVERED').length;
    const ongoing = orders.filter((item) => isOngoingOrderStatus(item.status)).length;
    const spend = orders
      .filter((item) => item.status === 'DELIVERED')
      .reduce((sum, item) => sum + Number(item.finalPrice ?? item.estimatedPrice ?? 0), 0);

    return {
      total,
      completed,
      ongoing,
      spend
    };
  }, [orders]);

  const navigateFromDrawer = (route: DrawerRoute) => {
    navigation.navigate(route);
  };

  const callSupport = async () => {
    const telUrl = `tel:${supportNumber}`;
    try {
      const canOpen = await Linking.canOpenURL(telUrl);
      if (!canOpen) {
        Alert.alert('Support', `Please call ${supportNumber} for assistance.`);
        return;
      }
      await Linking.openURL(telUrl);
    } catch {
      Alert.alert('Support', `Please call ${supportNumber} for assistance.`);
    }
  };

  const showChatSoon = () => {
    Alert.alert('Customer Care Chat', `Coming soon.\nFor now call ${supportNumber} for assistance.`);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => setDrawerVisible(true)}>
            <Text style={styles.backText}>≡</Text>
          </Pressable>
          <Text style={styles.title}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          bounces={false}
          directionalLockEnabled
        >
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.name?.slice(0, 1)?.toUpperCase() ?? 'Q'}</Text>
            </View>
            <View style={styles.profileCopy}>
              <Text style={styles.name}>{user?.name ?? 'Qargo Customer'}</Text>
              <Text style={styles.meta}>{user?.phone ?? '+91 90000 00001'}</Text>
              <Text style={styles.meta}>Role: {user?.role ?? 'CUSTOMER'}</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats.total}</Text>
              <Text style={styles.metricLabel}>Total rides</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats.completed}</Text>
              <Text style={styles.metricLabel}>Delivered</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{stats.ongoing}</Text>
              <Text style={styles.metricLabel}>Ongoing</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>INR {stats.spend.toFixed(0)}</Text>
              <Text style={styles.metricLabel}>Total spend</Text>
            </View>
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Quick actions</Text>

            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('CustomerRides')}>
              <Text style={styles.actionText}>View ride history</Text>
              <Text style={styles.actionArrow}>{'>'}</Text>
            </Pressable>

            <Pressable
              style={[styles.actionButton, activeOrderId ? undefined : styles.actionButtonDisabled]}
              onPress={() => activeOrderId && navigation.navigate('CustomerTracking')}
            >
              <Text style={[styles.actionText, !activeOrderId ? styles.actionTextDisabled : undefined]}>
                {activeOrderId ? 'Resume active trip' : 'No active trip to resume'}
              </Text>
              <Text style={[styles.actionArrow, !activeOrderId ? styles.actionTextDisabled : undefined]}>{'>'}</Text>
            </Pressable>

            <Pressable style={styles.actionButton} onPress={() => navigation.navigate('CustomerHome')}>
              <Text style={styles.actionText}>Back to booking home</Text>
              <Text style={styles.actionArrow}>{'>'}</Text>
            </Pressable>
          </View>

          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Support</Text>

            <Pressable style={styles.actionButton} onPress={() => void callSupport()}>
              <Text style={styles.actionText}>Call {supportNumber}</Text>
              <Text style={styles.actionArrow}>{'>'}</Text>
            </Pressable>

            <Pressable style={[styles.actionButton, styles.actionButtonDisabled]} onPress={showChatSoon}>
              <Text style={[styles.actionText, styles.actionTextDisabled]}>Customer Care Chat (Coming soon)</Text>
              <Text style={[styles.actionArrow, styles.actionTextDisabled]}>{'>'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>

      <CustomerSideDrawer
        visible={drawerVisible}
        activeRoute="CustomerProfile"
        onClose={() => setDrawerVisible(false)}
        onNavigate={navigateFromDrawer}
        showTracking={Boolean(activeOrderId)}
        onNavigateTracking={() => navigation.navigate('CustomerTracking')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF8F1' },
  container: {
    flex: 1,
    alignItems: 'center',
    overflow: 'hidden'
  },
  scrollView: {
    width: '100%'
  },
  headerRow: {
    width: '100%',
    maxWidth: 460,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center'
  },
  backText: {
    color: '#FFF',
    fontSize: 20,
    fontFamily: 'Manrope_700Bold'
  },
  title: {
    fontFamily: 'Sora_700Bold',
    fontSize: 22,
    color: '#7C2D12'
  },
  headerSpacer: {
    width: 36,
    height: 36
  },
  scroll: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontFamily: 'Sora_700Bold',
    color: '#FFF',
    fontSize: 22
  },
  profileCopy: {
    gap: 2
  },
  name: {
    fontFamily: 'Sora_700Bold',
    fontSize: 18,
    color: '#0F172A'
  },
  meta: {
    fontFamily: 'Manrope_500Medium',
    color: '#475569',
    fontSize: 13
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10
  },
  metricCard: {
    width: '49%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 2
  },
  metricValue: {
    fontFamily: 'Sora_700Bold',
    color: '#1E3A8A',
    fontSize: 16
  },
  metricLabel: {
    fontFamily: 'Manrope_500Medium',
    color: '#1D4ED8',
    fontSize: 12
  },
  actionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 10
  },
  actionsTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#334155',
    fontSize: 16
  },
  actionButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actionButtonDisabled: {
    opacity: 0.6
  },
  actionText: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    fontSize: 13
  },
  actionTextDisabled: {
    color: '#64748B'
  },
  actionArrow: {
    fontFamily: 'Manrope_700Bold',
    color: '#334155',
    fontSize: 16
  }
});
