# Admin Dashboard (Next.js)

## Run
```bash
npm run dev:admin
```

## Features
- Passcode-protected admin login (`/login`)
- Operations console (`/operations`) with live bookings/rides monitor
- Support inbox (`/support`) for ticket triage and replies
- KPI analytics and dispatch trend chart
- Driver approval queue
- Pricing rule management
- Dispute and fraud queue view

API base URL is controlled by `NEXT_PUBLIC_API_URL` (default `http://localhost:3001/api`).
