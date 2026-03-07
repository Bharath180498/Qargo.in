import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import api from '../../services/api';
import { isOngoingOrderStatus, useCustomerStore } from '../../store/useCustomerStore';
import { useSessionStore } from '../../store/useSessionStore';
import type { RootStackParamList } from '../../types/navigation';
import { CustomerSideDrawer, type DrawerRoute } from '../../components/CustomerSideDrawer';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerRides'>;

interface OrderRow {
  id: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  finalPrice?: number;
  estimatedPrice?: number;
  createdAt: string;
}

function readableStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function readableDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.toLocaleDateString()} · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

export function CustomerRidesScreen({ navigation }: Props) {
  const user = useSessionStore((state) => state.user);
  const activeOrderId = useCustomerStore((state) => state.activeOrderId);
  const setActiveOrder = useCustomerStore((state) => state.setActiveOrder);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.get('/orders', {
        params: {
          customerId: user.id
        }
      });
      const payload = Array.isArray(response.data) ? (response.data as OrderRow[]) : [];
      setOrders(payload);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const ongoing = useMemo(() => orders.filter((item) => isOngoingOrderStatus(item.status)), [orders]);
  const history = useMemo(() => orders.filter((item) => !isOngoingOrderStatus(item.status)), [orders]);

  const openTracking = (order: OrderRow) => {
    setActiveOrder(order.id, order.status);
    navigation.navigate('CustomerTracking');
  };

  const navigateFromDrawer = (route: DrawerRoute) => {
    navigation.navigate(route);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => setDrawerVisible(true)}>
            <Text style={styles.backText}>≡</Text>
          </Pressable>
          <Text style={styles.title}>Ride History</Text>
          <Pressable style={styles.refreshButton} onPress={() => void loadOrders()}>
            <Text style={styles.refreshText}>{loading ? '...' : 'Refresh'}</Text>
          </Pressable>
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
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ongoing</Text>
            {ongoing.length === 0 ? (
              <Text style={styles.emptyCopy}>No ongoing trips right now.</Text>
            ) : (
              ongoing.map((order) => (
                <Pressable key={order.id} style={styles.card} onPress={() => openTracking(order)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardStatus}>{readableStatus(order.status)}</Text>
                    <Text style={styles.cardPrice}>INR {Number(order.finalPrice ?? order.estimatedPrice ?? 0).toFixed(0)}</Text>
                  </View>
                  <Text style={styles.cardLine}>From: {order.pickupAddress}</Text>
                  <Text style={styles.cardLine}>To: {order.dropAddress}</Text>
                  <Text style={styles.cardMeta}>{order.id === activeOrderId ? 'Active on this device' : readableDate(order.createdAt)}</Text>
                </Pressable>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Completed & Cancelled</Text>
            {history.length === 0 ? (
              <Text style={styles.emptyCopy}>No previous rides yet.</Text>
            ) : (
              history.map((order) => (
                <View key={order.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardStatus}>{readableStatus(order.status)}</Text>
                    <Text style={styles.cardPrice}>INR {Number(order.finalPrice ?? order.estimatedPrice ?? 0).toFixed(0)}</Text>
                  </View>
                  <Text style={styles.cardLine}>From: {order.pickupAddress}</Text>
                  <Text style={styles.cardLine}>To: {order.dropAddress}</Text>
                  <Text style={styles.cardMeta}>{readableDate(order.createdAt)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <CustomerSideDrawer
        visible={drawerVisible}
        activeRoute="CustomerRides"
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
  refreshButton: {
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  refreshText: {
    fontFamily: 'Manrope_700Bold',
    color: '#1D4ED8',
    fontSize: 12
  },
  scroll: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 14
  },
  section: {
    gap: 10
  },
  sectionTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 17,
    color: '#334155'
  },
  emptyCopy: {
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 13
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 4
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardStatus: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    fontSize: 13
  },
  cardPrice: {
    fontFamily: 'Sora_700Bold',
    color: '#0F766E',
    fontSize: 14
  },
  cardLine: {
    fontFamily: 'Manrope_500Medium',
    color: '#334155',
    fontSize: 13
  },
  cardMeta: {
    marginTop: 2,
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 12
  }
});
