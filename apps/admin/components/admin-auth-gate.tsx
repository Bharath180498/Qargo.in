'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken } from '../lib/api';

export function AdminAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="mx-4 mt-4 rounded-lg border border-slate-800 bg-slate-900/80 p-6 text-center font-manrope text-slate-300 backdrop-blur">
        Authenticating admin session...
      </div>
    );
  }

  return <>{children}</>;
}
