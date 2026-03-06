# System Architecture

## Monorepo
- `apps/backend`: NestJS API + dispatch + realtime + adapters
- `apps/mobile`: Expo customer app
- `apps/driver`: Expo driver app
- `apps/admin`: Next.js operations dashboard
- `packages/shared`: shared constants and domain types

## Backend Services (modular monolith, microservice-ready)
- `auth`: mock login/JWT token issuance
- `auth`: OTP + session auth (mock fallback kept for local/dev)
- `driver-onboarding`: profile, vehicle, bank, onboarding submission
- `kyc`: document upload metadata, provider verification, admin review flow
- `orders`: booking, cancellation, e-way bill attachment
- `drivers`: online/offline state, geo updates, nearby lookup
- `dispatch`: route-ETA weighted offers + accept/reject/expire + queued next-job offers
- `trips`: lifecycle transitions, waiting charge automation, rating
- `payments`: payment intent + confirmation adapters
- `insurance`: quote engine (basic/premium/high-value)
- `ewaybill`: GST/e-way bill generation adapter
- `realtime`: Socket.io broadcasts for location/trip events
- `pricing`: rating multipliers and dynamic rule management

## Dispatch Strategy
Driver score uses weighted signals:
- proximity (45%)
- rating (25%)
- idle time (20%)
- vehicle match (10%)

If no online driver is available, dispatch can queue the next order for a busy driver (job chaining).

## Data and Realtime
- PostgreSQL stores orders/trips/payments/ratings/drivers
- Redis stores geo indexes and queued next jobs
- Socket.io pushes location and trip updates to subscribed clients

## Compliance and Integrations
- Insurance and e-way bill modules are adapter-first with mock provider implementations.
- KYC, route ETA, and push notifications are adapter-first with mock fallback.
- Production rollout can swap providers using env-configured clients and webhook flows.
