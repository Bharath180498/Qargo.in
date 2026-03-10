import {
  PrismaClient,
  UserRole,
  VehicleType,
  VerificationStatus,
  AvailabilityStatus,
  OrderStatus,
  OnboardingStatus,
  TripStatus,
  SupportTicketStatus,
  SupportMessageSenderType
} from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const customer = await prisma.user.upsert({
    where: { phone: '+919999999001' },
    update: {},
    create: {
      name: 'Acme Logistics Customer',
      phone: '+919999999001',
      email: 'customer@porter.local',
      role: UserRole.CUSTOMER,
      rating: 4.9
    }
  });

  const admin = await prisma.user.upsert({
    where: { phone: '+919999999002' },
    update: {},
    create: {
      name: 'Ops Admin',
      phone: '+919999999002',
      email: 'admin@porter.local',
      role: UserRole.ADMIN,
      rating: 5
    }
  });

  void admin;

  const demoCustomer = await prisma.user.upsert({
    where: { phone: '+919000000001' },
    update: {
      role: UserRole.CUSTOMER,
      name: 'Customer Demo'
    },
    create: {
      name: 'Customer Demo',
      phone: '+919000000001',
      email: 'customer.demo@porter.local',
      role: UserRole.CUSTOMER,
      rating: 4.9
    }
  });

  const driverDemoUser = await prisma.user.upsert({
    where: { phone: '+919000000101' },
    update: {
      role: UserRole.DRIVER,
      name: 'Driver Demo'
    },
    create: {
      name: 'Driver Demo',
      phone: '+919000000101',
      email: 'driver.demo@porter.local',
      role: UserRole.DRIVER,
      rating: 4.8
    }
  });

  const driverUsers = await Promise.all(
    [
      { idx: 1, name: 'Ravi Kumar', rating: 4.9, vehicleType: VehicleType.MINI_TRUCK },
      { idx: 2, name: 'Sanjay Patel', rating: 4.6, vehicleType: VehicleType.THREE_WHEELER },
      { idx: 3, name: 'Imran Khan', rating: 4.2, vehicleType: VehicleType.TRUCK }
    ].map((driver) =>
      prisma.user.upsert({
        where: { phone: `+91999999910${driver.idx}` },
        update: { rating: driver.rating },
        create: {
          name: driver.name,
          phone: `+91999999910${driver.idx}`,
          email: `driver${driver.idx}@porter.local`,
          role: UserRole.DRIVER,
          rating: driver.rating
        }
      })
    )
  );

  await Promise.all(
    driverUsers.map((user, idx) =>
      prisma.driverProfile.upsert({
        where: { userId: user.id },
        update: {
          verificationStatus: VerificationStatus.APPROVED,
          availabilityStatus: AvailabilityStatus.ONLINE,
          idleSince: new Date(Date.now() - (idx + 1) * 60 * 60 * 1000),
          currentLat: 12.9716 + idx * 0.01,
          currentLng: 77.5946 + idx * 0.01
        },
        create: {
          userId: user.id,
          vehicleType: [VehicleType.MINI_TRUCK, VehicleType.THREE_WHEELER, VehicleType.TRUCK][idx],
          vehicleNumber: `KA01AB10${idx + 1}`,
          licenseNumber: `DL${idx + 1}234567890`,
          verificationStatus: VerificationStatus.APPROVED,
          availabilityStatus: AvailabilityStatus.ONLINE,
          idleSince: new Date(Date.now() - (idx + 1) * 60 * 60 * 1000),
          currentLat: 12.9716 + idx * 0.01,
          currentLng: 77.5946 + idx * 0.01,
          vehicles: {
            create: {
              type: [VehicleType.MINI_TRUCK, VehicleType.THREE_WHEELER, VehicleType.TRUCK][idx],
              capacityKg: [1500, 600, 9000][idx],
              insuranceStatus: 'ACTIVE'
            }
          }
        }
      })
    )
  );

  const demoDriverProfile = await prisma.driverProfile.upsert({
    where: { userId: driverDemoUser.id },
    update: {
      vehicleType: VehicleType.MINI_TRUCK,
      vehicleNumber: 'KA01DM0101',
      licenseNumber: 'DL0420120010101',
      aadhaarNumber: '123412341010',
      verificationStatus: VerificationStatus.APPROVED,
      availabilityStatus: AvailabilityStatus.OFFLINE,
      currentLat: 12.9716,
      currentLng: 77.5946,
      idleSince: new Date()
    },
    create: {
      userId: driverDemoUser.id,
      vehicleType: VehicleType.MINI_TRUCK,
      vehicleNumber: 'KA01DM0101',
      licenseNumber: 'DL0420120010101',
      aadhaarNumber: '123412341010',
      verificationStatus: VerificationStatus.APPROVED,
      availabilityStatus: AvailabilityStatus.OFFLINE,
      currentLat: 12.9716,
      currentLng: 77.5946,
      idleSince: new Date()
    }
  });

  await prisma.driverOnboarding.upsert({
    where: { userId: driverDemoUser.id },
    update: {
      status: OnboardingStatus.APPROVED,
      fullName: driverDemoUser.name,
      phone: driverDemoUser.phone,
      vehicleType: VehicleType.MINI_TRUCK,
      vehicleNumber: demoDriverProfile.vehicleNumber,
      licenseNumber: demoDriverProfile.licenseNumber,
      aadhaarNumber: demoDriverProfile.aadhaarNumber,
      accountHolderName: 'Driver Demo',
      bankName: 'HDFC Bank',
      accountNumber: '123456789000',
      ifscCode: 'HDFC0000123',
      approvedAt: new Date()
    },
    create: {
      userId: driverDemoUser.id,
      status: OnboardingStatus.APPROVED,
      fullName: driverDemoUser.name,
      phone: driverDemoUser.phone,
      vehicleType: VehicleType.MINI_TRUCK,
      vehicleNumber: demoDriverProfile.vehicleNumber,
      licenseNumber: demoDriverProfile.licenseNumber,
      aadhaarNumber: demoDriverProfile.aadhaarNumber,
      accountHolderName: 'Driver Demo',
      bankName: 'HDFC Bank',
      accountNumber: '123456789000',
      ifscCode: 'HDFC0000123',
      submittedAt: new Date(),
      approvedAt: new Date()
    }
  });

  const bookingCreated = await prisma.order.upsert({
    where: { id: 'seed-order-created' },
    update: {
      customerId: customer.id,
      pickupAddress: 'Koramangala, Bengaluru',
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropAddress: 'Whitefield, Bengaluru',
      dropLat: 12.9698,
      dropLng: 77.7499,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Furniture packages',
      goodsType: 'Household',
      goodsValue: 45000,
      estimatedPrice: 920,
      status: OrderStatus.CREATED
    },
    create: {
      id: 'seed-order-created',
      customerId: customer.id,
      pickupAddress: 'Koramangala, Bengaluru',
      pickupLat: 12.9352,
      pickupLng: 77.6245,
      dropAddress: 'Whitefield, Bengaluru',
      dropLat: 12.9698,
      dropLng: 77.7499,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Furniture packages',
      goodsType: 'Household',
      goodsValue: 45000,
      estimatedPrice: 920,
      status: OrderStatus.CREATED
    }
  });

  const bookingMatching = await prisma.order.upsert({
    where: { id: 'seed-order-matching' },
    update: {
      customerId: demoCustomer.id,
      pickupAddress: 'HSR Layout, Bengaluru',
      pickupLat: 12.9116,
      pickupLng: 77.6446,
      dropAddress: 'Electronic City, Bengaluru',
      dropLat: 12.8399,
      dropLng: 77.6770,
      vehicleType: VehicleType.THREE_WHEELER,
      goodsDescription: 'Retail cartons',
      goodsType: 'Retail',
      goodsValue: 18000,
      estimatedPrice: 610,
      status: OrderStatus.MATCHING
    },
    create: {
      id: 'seed-order-matching',
      customerId: demoCustomer.id,
      pickupAddress: 'HSR Layout, Bengaluru',
      pickupLat: 12.9116,
      pickupLng: 77.6446,
      dropAddress: 'Electronic City, Bengaluru',
      dropLat: 12.8399,
      dropLng: 77.6770,
      vehicleType: VehicleType.THREE_WHEELER,
      goodsDescription: 'Retail cartons',
      goodsType: 'Retail',
      goodsValue: 18000,
      estimatedPrice: 610,
      status: OrderStatus.MATCHING
    }
  });

  const bookingAssigned = await prisma.order.upsert({
    where: { id: 'seed-order-assigned' },
    update: {
      customerId: customer.id,
      pickupAddress: 'Indiranagar, Bengaluru',
      pickupLat: 12.9784,
      pickupLng: 77.6408,
      dropAddress: 'Bellandur, Bengaluru',
      dropLat: 12.9250,
      dropLng: 77.6762,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Office equipment',
      goodsType: 'Electronics',
      goodsValue: 72000,
      estimatedPrice: 1180,
      status: OrderStatus.ASSIGNED
    },
    create: {
      id: 'seed-order-assigned',
      customerId: customer.id,
      pickupAddress: 'Indiranagar, Bengaluru',
      pickupLat: 12.9784,
      pickupLng: 77.6408,
      dropAddress: 'Bellandur, Bengaluru',
      dropLat: 12.9250,
      dropLng: 77.6762,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Office equipment',
      goodsType: 'Electronics',
      goodsValue: 72000,
      estimatedPrice: 1180,
      status: OrderStatus.ASSIGNED
    }
  });

  const bookingTransit = await prisma.order.upsert({
    where: { id: 'seed-order-transit' },
    update: {
      customerId: demoCustomer.id,
      pickupAddress: 'Yelahanka, Bengaluru',
      pickupLat: 13.1007,
      pickupLng: 77.5963,
      dropAddress: 'MG Road, Bengaluru',
      dropLat: 12.9757,
      dropLng: 77.6055,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Medical supplies',
      goodsType: 'Healthcare',
      goodsValue: 56000,
      estimatedPrice: 1420,
      status: OrderStatus.IN_TRANSIT,
      waitingCharge: 45
    },
    create: {
      id: 'seed-order-transit',
      customerId: demoCustomer.id,
      pickupAddress: 'Yelahanka, Bengaluru',
      pickupLat: 13.1007,
      pickupLng: 77.5963,
      dropAddress: 'MG Road, Bengaluru',
      dropLat: 12.9757,
      dropLng: 77.6055,
      vehicleType: VehicleType.MINI_TRUCK,
      goodsDescription: 'Medical supplies',
      goodsType: 'Healthcare',
      goodsValue: 56000,
      estimatedPrice: 1420,
      status: OrderStatus.IN_TRANSIT,
      waitingCharge: 45
    }
  });

  const bookingDelivered = await prisma.order.upsert({
    where: { id: 'seed-order-delivered' },
    update: {
      customerId: customer.id,
      pickupAddress: 'Jayanagar, Bengaluru',
      pickupLat: 12.9291,
      pickupLng: 77.5933,
      dropAddress: 'Peenya, Bengaluru',
      dropLat: 13.0330,
      dropLng: 77.5260,
      vehicleType: VehicleType.TRUCK,
      goodsDescription: 'Industrial material',
      goodsType: 'Manufacturing',
      goodsValue: 140000,
      estimatedPrice: 2680,
      finalPrice: 2780,
      status: OrderStatus.DELIVERED
    },
    create: {
      id: 'seed-order-delivered',
      customerId: customer.id,
      pickupAddress: 'Jayanagar, Bengaluru',
      pickupLat: 12.9291,
      pickupLng: 77.5933,
      dropAddress: 'Peenya, Bengaluru',
      dropLat: 13.0330,
      dropLng: 77.5260,
      vehicleType: VehicleType.TRUCK,
      goodsDescription: 'Industrial material',
      goodsType: 'Manufacturing',
      goodsValue: 140000,
      estimatedPrice: 2680,
      finalPrice: 2780,
      status: OrderStatus.DELIVERED
    }
  });

  await prisma.trip.upsert({
    where: { id: 'seed-trip-assigned' },
    update: {
      orderId: bookingAssigned.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.ASSIGNED,
      etaMinutes: 13
    },
    create: {
      id: 'seed-trip-assigned',
      orderId: bookingAssigned.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.ASSIGNED,
      etaMinutes: 13
    }
  });

  await prisma.trip.upsert({
    where: { id: 'seed-trip-transit' },
    update: {
      orderId: bookingTransit.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.IN_TRANSIT,
      etaMinutes: 21,
      pickupTime: new Date(Date.now() - 45 * 60 * 1000),
      loadingStart: new Date(Date.now() - 34 * 60 * 1000),
      loadingEnd: new Date(Date.now() - 26 * 60 * 1000),
      waitingCharge: 45
    },
    create: {
      id: 'seed-trip-transit',
      orderId: bookingTransit.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.IN_TRANSIT,
      etaMinutes: 21,
      pickupTime: new Date(Date.now() - 45 * 60 * 1000),
      loadingStart: new Date(Date.now() - 34 * 60 * 1000),
      loadingEnd: new Date(Date.now() - 26 * 60 * 1000),
      waitingCharge: 45
    }
  });

  await prisma.trip.upsert({
    where: { id: 'seed-trip-delivered' },
    update: {
      orderId: bookingDelivered.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.COMPLETED,
      etaMinutes: 18,
      pickupTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
      loadingStart: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
      loadingEnd: new Date(Date.now() - 4.2 * 60 * 60 * 1000),
      deliveryTime: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      distanceKm: 31.2,
      durationMinutes: 124
    },
    create: {
      id: 'seed-trip-delivered',
      orderId: bookingDelivered.id,
      driverId: demoDriverProfile.id,
      status: TripStatus.COMPLETED,
      etaMinutes: 18,
      pickupTime: new Date(Date.now() - 5 * 60 * 60 * 1000),
      loadingStart: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
      loadingEnd: new Date(Date.now() - 4.2 * 60 * 60 * 1000),
      deliveryTime: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      distanceKm: 31.2,
      durationMinutes: 124
    }
  });

  const customerSupportTicket = await prisma.supportTicket.upsert({
    where: { id: 'seed-support-customer-open' },
    update: {
      requesterUserId: demoCustomer.id,
      requesterRole: UserRole.CUSTOMER,
      orderId: bookingTransit.id,
      tripId: 'seed-trip-transit',
      subject: 'Driver delayed near final drop',
      description: 'Driver has stopped for 20 minutes and ETA is increasing.',
      status: SupportTicketStatus.IN_PROGRESS,
      resolvedAt: null
    },
    create: {
      id: 'seed-support-customer-open',
      requesterUserId: demoCustomer.id,
      requesterRole: UserRole.CUSTOMER,
      orderId: bookingTransit.id,
      tripId: 'seed-trip-transit',
      subject: 'Driver delayed near final drop',
      description: 'Driver has stopped for 20 minutes and ETA is increasing.',
      status: SupportTicketStatus.IN_PROGRESS
    }
  });

  const driverSupportTicket = await prisma.supportTicket.upsert({
    where: { id: 'seed-support-driver-waiting' },
    update: {
      requesterUserId: driverDemoUser.id,
      requesterRole: UserRole.DRIVER,
      orderId: bookingAssigned.id,
      tripId: 'seed-trip-assigned',
      subject: 'Unable to contact pickup point',
      description: 'Pickup contact is unreachable. Please advise next step.',
      status: SupportTicketStatus.WAITING_FOR_USER,
      resolvedAt: null
    },
    create: {
      id: 'seed-support-driver-waiting',
      requesterUserId: driverDemoUser.id,
      requesterRole: UserRole.DRIVER,
      orderId: bookingAssigned.id,
      tripId: 'seed-trip-assigned',
      subject: 'Unable to contact pickup point',
      description: 'Pickup contact is unreachable. Please advise next step.',
      status: SupportTicketStatus.WAITING_FOR_USER
    }
  });

  const customerResolvedTicket = await prisma.supportTicket.upsert({
    where: { id: 'seed-support-customer-resolved' },
    update: {
      requesterUserId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      orderId: bookingDelivered.id,
      tripId: 'seed-trip-delivered',
      subject: 'Invoice copy request',
      description: 'Need GST invoice copy for finance filing.',
      status: SupportTicketStatus.RESOLVED,
      resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    },
    create: {
      id: 'seed-support-customer-resolved',
      requesterUserId: customer.id,
      requesterRole: UserRole.CUSTOMER,
      orderId: bookingDelivered.id,
      tripId: 'seed-trip-delivered',
      subject: 'Invoice copy request',
      description: 'Need GST invoice copy for finance filing.',
      status: SupportTicketStatus.RESOLVED,
      resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-1' },
    update: {
      ticketId: customerSupportTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: demoCustomer.id,
      message: 'Driver has stopped for 20 minutes and ETA is increasing.'
    },
    create: {
      id: 'seed-support-msg-1',
      ticketId: customerSupportTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: demoCustomer.id,
      message: 'Driver has stopped for 20 minutes and ETA is increasing.'
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-2' },
    update: {
      ticketId: customerSupportTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Ops team is coordinating with driver. We will update ETA shortly.'
    },
    create: {
      id: 'seed-support-msg-2',
      ticketId: customerSupportTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Ops team is coordinating with driver. We will update ETA shortly.'
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-3' },
    update: {
      ticketId: driverSupportTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: driverDemoUser.id,
      message: 'Pickup contact is unreachable. Please advise next step.'
    },
    create: {
      id: 'seed-support-msg-3',
      ticketId: driverSupportTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: driverDemoUser.id,
      message: 'Pickup contact is unreachable. Please advise next step.'
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-4' },
    update: {
      ticketId: driverSupportTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Please wait 5 minutes and retry. We are contacting customer side as well.'
    },
    create: {
      id: 'seed-support-msg-4',
      ticketId: driverSupportTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Please wait 5 minutes and retry. We are contacting customer side as well.'
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-5' },
    update: {
      ticketId: customerResolvedTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: customer.id,
      message: 'Need GST invoice copy for finance filing.'
    },
    create: {
      id: 'seed-support-msg-5',
      ticketId: customerResolvedTicket.id,
      senderType: SupportMessageSenderType.USER,
      senderUserId: customer.id,
      message: 'Need GST invoice copy for finance filing.'
    }
  });

  await prisma.supportTicketMessage.upsert({
    where: { id: 'seed-support-msg-6' },
    update: {
      ticketId: customerResolvedTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Invoice sent to your registered email. Marking this ticket as resolved.'
    },
    create: {
      id: 'seed-support-msg-6',
      ticketId: customerResolvedTicket.id,
      senderType: SupportMessageSenderType.ADMIN,
      senderUserId: admin.id,
      message: 'Invoice sent to your registered email. Marking this ticket as resolved.'
    }
  });

  void bookingCreated;
  void bookingMatching;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
