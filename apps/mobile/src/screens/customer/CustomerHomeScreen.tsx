import { useEffect, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { type RoutePoint, isOngoingOrderStatus, useCustomerStore } from '../../store/useCustomerStore';
import { useSessionStore } from '../../store/useSessionStore';
import { CustomerSideDrawer, type DrawerRoute } from '../../components/CustomerSideDrawer';
import api from '../../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CustomerHome'>;

const RECENT_DROPS: RoutePoint[] = [
  {
    address: 'KR Market, Bengaluru',
    lat: 12.9622,
    lng: 77.5777
  },
  {
    address: 'Peenya Industrial Area, Bengaluru',
    lat: 13.0307,
    lng: 77.5169
  },
  {
    address: 'Electronic City Phase 1, Bengaluru',
    lat: 12.8399,
    lng: 77.677
  }
];

const SERVICES = [
  { key: '3w', title: '3-Wheeler', subtitle: 'Light cargo', accent: '#F97316' },
  { key: 'mini', title: 'Mini Truck', subtitle: 'Most booked', accent: '#0F766E' },
  { key: 'truck', title: 'Truck', subtitle: 'Bulk loads', accent: '#1D4ED8' },
  { key: 'city', title: 'City-to-City', subtitle: 'Intercity', accent: '#7C3AED' }
] as const;
const MAX_CONCURRENT_RIDES = 3;
const ONGOING_ORDER_STATUSES = new Set(['CREATED', 'MATCHING', 'ASSIGNED', 'AT_PICKUP', 'LOADING', 'IN_TRANSIT']);

export function CustomerHomeScreen({ navigation }: Props) {
  const user = useSessionStore((state) => state.user);
  const setDraftRoute = useCustomerStore((state) => state.setDraftRoute);
  const activeOrderId = useCustomerStore((state) => state.activeOrderId);
  const activeOrderStatus = useCustomerStore((state) => state.activeOrderStatus);
  const refreshOrder = useCustomerStore((state) => state.refreshOrder);
  const dismissActiveOrder = useCustomerStore((state) => state.dismissActiveOrder);
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    if (activeOrderId) {
      void refreshOrder();
    }
  }, [activeOrderId, refreshOrder]);

  useEffect(() => {
    if (activeOrderId && activeOrderStatus === 'CANCELLED') {
      dismissActiveOrder();
    }
  }, [activeOrderId, activeOrderStatus, dismissActiveOrder]);

  const hasOngoingOrder = Boolean(activeOrderId && isOngoingOrderStatus(activeOrderStatus));
  const hasSummaryPending = Boolean(activeOrderId && activeOrderStatus === 'DELIVERED');
  const hasOpenOrder = hasOngoingOrder || hasSummaryPending;
  const bookingLockLabel = hasOngoingOrder ? 'Active rides running' : 'Pick-up and drop';
  const bookingLockTitle = hasOngoingOrder
    ? 'Book another load (up to 3 concurrent rides)'
    : 'Where should we deliver?';

  const navigateFromDrawer = (route: DrawerRoute) => {
    navigation.navigate(route);
  };

  const startBookingFlow = async (drop?: RoutePoint) => {
    if (activeOrderId) {
      try {
        await refreshOrder();
      } catch {
        // Keep local state if refresh fails.
      }
    }

    let ongoingCount = 0;
    if (user?.id) {
      try {
        const response = await api.get('/orders', {
          params: { customerId: user.id }
        });
        const payload = Array.isArray(response.data) ? response.data : [];
        ongoingCount = payload.filter((item) => ONGOING_ORDER_STATUSES.has(String(item?.status ?? ''))).length;
      } catch {
        // Keep a permissive fallback so network errors do not block booking.
      }
    }

    if (ongoingCount >= MAX_CONCURRENT_RIDES) {
      Alert.alert(
        'Ride limit reached',
        'You can run up to 3 active rides at once. Complete or cancel one ride to create another.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'Open Ride History',
            onPress: () => navigation.navigate('CustomerRides')
          }
        ]
      );
      return;
    }

    setDraftRoute({
      pickup: null,
      drop: drop ?? null,
      goodsDescription: 'General merchandise',
      goodsValue: 45000
    });

    navigation.navigate('CustomerPickupConfirm');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          alwaysBounceHorizontal={false}
          bounces={false}
          directionalLockEnabled
        >
          <View style={styles.topBar}>
            <Pressable style={styles.menuButton} onPress={() => setDrawerVisible(true)}>
              <Text style={styles.menuButtonText}>≡</Text>
            </Pressable>
            <Text style={styles.topBarTitle}>Home</Text>
            <View style={styles.topBarSpacer} />
          </View>

          <View style={styles.headlineSection}>
            <Text style={styles.headlineEyebrow}>QARGO</Text>
            <Text style={styles.headlineTitle}>Move goods, on demand.</Text>
            <Text style={styles.headlineSubtitle}>Book quickly, track live, deliver reliably.</Text>
          </View>

          {hasOngoingOrder ? (
            <View style={styles.ongoingCard}>
              <View style={styles.ongoingHeader}>
                <Text style={styles.ongoingTitle}>Ongoing trip</Text>
                <Text style={styles.ongoingStatus}>{activeOrderStatus ?? 'MATCHING'}</Text>
              </View>
              <Text style={styles.ongoingSubtitle}>Your current booking is active. Resume to track driver and payment.</Text>
              <View style={styles.ongoingActions}>
                <Pressable style={styles.ongoingPrimaryButton} onPress={() => navigation.navigate('CustomerTracking')}>
                  <Text style={styles.ongoingPrimaryText}>Resume trip</Text>
                </Pressable>
                <Pressable style={styles.ongoingSecondaryButton} onPress={() => navigation.navigate('CustomerPayment')}>
                  <Text style={styles.ongoingSecondaryText}>Payments</Text>
                </Pressable>
              </View>
            </View>
          ) : hasOpenOrder ? (
            <View style={styles.ongoingCard}>
              <View style={styles.ongoingHeader}>
                <Text style={styles.ongoingTitle}>Trip completed</Text>
                <Text style={styles.ongoingStatus}>{activeOrderStatus ?? 'DELIVERED'}</Text>
              </View>
              <Text style={styles.ongoingSubtitle}>Review trip summary and tip driver before your next booking.</Text>
              <View style={styles.ongoingActions}>
                <Pressable style={styles.ongoingPrimaryButton} onPress={() => navigation.navigate('CustomerTracking')}>
                  <Text style={styles.ongoingPrimaryText}>View summary</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Pressable style={styles.searchCard} onPress={() => void startBookingFlow()}>
            <View>
              <Text style={styles.searchLabel}>{bookingLockLabel}</Text>
              <Text style={styles.searchTitle}>{bookingLockTitle}</Text>
            </View>
            <View style={styles.searchArrowWrap}>
              <Text style={styles.searchArrow}>{'>'}</Text>
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vehicle Services</Text>
            <Text style={styles.sectionCaption}>India-first load plans</Text>
          </View>

          <View style={styles.servicesGrid}>
            {SERVICES.map((service) => (
              <Pressable key={service.key} style={styles.serviceCard} onPress={() => void startBookingFlow()}>
                <View style={[styles.serviceIcon, { backgroundColor: service.accent }]}>
                  <Text style={styles.serviceIconText}>{service.title.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.serviceSubtitle}>{service.subtitle}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Drops</Text>
            <Text style={styles.sectionCaption}>Fast re-booking</Text>
          </View>

          <View style={styles.recentList}>
            {RECENT_DROPS.map((place) => (
              <Pressable key={place.address} style={styles.recentCard} onPress={() => void startBookingFlow(place)}>
                <View style={styles.recentDot} />
                <View style={styles.recentCopy}>
                  <Text style={styles.recentMain}>{place.address.split(',')[0]}</Text>
                  <Text style={styles.recentSub}>{place.address}</Text>
                </View>
                <Text style={styles.recentArrow}>{'>'}</Text>
              </Pressable>
            ))}
          </View>

          <LinearGradient
            colors={['#F1F5F9', '#FFEDD5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.promoCard}
          >
            <Text style={styles.promoTitle}>Festive freight offer</Text>
            <Text style={styles.promoText}>Save up to 18% on mini-truck routes in Bengaluru this month.</Text>
          </LinearGradient>
        </ScrollView>
      </View>

      <CustomerSideDrawer
        visible={drawerVisible}
        activeRoute="CustomerHome"
        onClose={() => setDrawerVisible(false)}
        onNavigate={navigateFromDrawer}
        showTracking={hasOpenOrder}
        onNavigateTracking={() => navigation.navigate('CustomerTracking')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFF8F1',
    overflow: 'hidden'
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF8F1',
    alignItems: 'center',
    overflow: 'hidden'
  },
  scrollView: {
    width: '100%'
  },
  scroll: {
    width: '100%',
    maxWidth: 440,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuButtonText: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    fontSize: 18,
    lineHeight: 22
  },
  topBarTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#1E293B',
    fontSize: 16
  },
  topBarSpacer: {
    width: 40,
    height: 40
  },
  headlineSection: {
    gap: 4,
    paddingTop: 2,
    paddingBottom: 2
  },
  headlineEyebrow: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F766E',
    fontSize: 11,
    letterSpacing: 1.1
  },
  headlineTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#1E293B',
    fontSize: 22,
    lineHeight: 28
  },
  headlineSubtitle: {
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18
  },
  searchCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  searchLabel: {
    fontFamily: 'Manrope_700Bold',
    color: '#9A3412',
    fontSize: 12
  },
  searchTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#7C2D12',
    fontSize: 17,
    marginTop: 2
  },
  searchArrowWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchArrow: {
    fontFamily: 'Manrope_700Bold',
    color: '#ECFEFF',
    fontSize: 16
  },
  ongoingCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
    padding: 14,
    gap: 8
  },
  ongoingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ongoingTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#166534',
    fontSize: 16
  },
  ongoingStatus: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F766E',
    fontSize: 12
  },
  ongoingSubtitle: {
    fontFamily: 'Manrope_500Medium',
    color: '#14532D',
    fontSize: 13
  },
  ongoingActions: {
    flexDirection: 'row',
    gap: 8
  },
  ongoingPrimaryButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10
  },
  ongoingPrimaryText: {
    fontFamily: 'Manrope_700Bold',
    color: '#ECFEFF',
    fontSize: 13
  },
  ongoingSecondaryButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF'
  },
  ongoingSecondaryText: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F766E',
    fontSize: 13
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline'
  },
  sectionTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#0F172A',
    fontSize: 18
  },
  sectionCaption: {
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 12
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10
  },
  serviceCard: {
    width: '49%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 5
  },
  serviceIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center'
  },
  serviceIconText: {
    fontFamily: 'Manrope_700Bold',
    color: '#FFFFFF',
    fontSize: 11
  },
  serviceTitle: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    fontSize: 14
  },
  serviceSubtitle: {
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 12
  },
  recentList: {
    gap: 8
  },
  recentCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  recentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0F766E'
  },
  recentCopy: {
    flex: 1
  },
  recentMain: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F172A',
    fontSize: 14
  },
  recentSub: {
    fontFamily: 'Manrope_500Medium',
    color: '#64748B',
    fontSize: 12
  },
  recentArrow: {
    fontFamily: 'Manrope_700Bold',
    color: '#0F766E',
    fontSize: 16
  },
  promoCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDBA74',
    padding: 14,
    marginBottom: 12
  },
  promoTitle: {
    fontFamily: 'Sora_700Bold',
    color: '#7C2D12',
    fontSize: 16
  },
  promoText: {
    marginTop: 4,
    fontFamily: 'Manrope_500Medium',
    color: '#9A3412',
    fontSize: 12
  }
});
