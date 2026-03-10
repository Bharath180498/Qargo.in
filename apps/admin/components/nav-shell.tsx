'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminAuthGate } from './admin-auth-gate';
import { clearAdminToken } from '../lib/api';

const navItems = [
  { href: '/operations', label: 'Operations' },
  { href: '/', label: 'Analytics' },
  { href: '/support', label: 'Support Inbox' },
  { href: '/drivers', label: 'Driver Approvals' },
  { href: '/kyc', label: 'KYC Reviews' },
  { href: '/pricing', label: 'Pricing Rules' },
  { href: '/disputes', label: 'Disputes & Fraud' }
];

export function NavShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = () => {
    clearAdminToken();
    router.replace('/login');
  };

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const activeLabel = navItems.find((item) => isActive(item.href))?.label ?? 'Dashboard';

  return (
    <AdminAuthGate>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-b border-slate-800 bg-slate-950 px-4 py-5 lg:border-b-0 lg:border-r lg:px-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-300">Qargo Ops</p>
              <h1 className="mt-1 font-sora text-xl text-slate-100">Control Tower</h1>
              <p className="mt-1 font-manrope text-xs text-slate-400">Dispatch, support and compliance cockpit.</p>
            </div>

            <nav className="mt-4 grid gap-1">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-2 font-manrope text-sm font-semibold transition ${
                      active
                        ? 'bg-orange-500/20 text-orange-100 ring-1 ring-orange-400/40'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-50'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-manrope text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
              >
                Logout
              </button>
            </div>
          </aside>

          <div className="min-w-0">
            <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-manrope text-xs uppercase tracking-[0.18em] text-slate-400">Marketplace Ops</p>
                  <p className="font-sora text-lg text-slate-100">Live Operational Dashboard</p>
                </div>
                <p className="font-manrope text-xs text-slate-400">Section: {activeLabel}</p>
              </div>
            </header>

            <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </div>
    </AdminAuthGate>
  );
}
