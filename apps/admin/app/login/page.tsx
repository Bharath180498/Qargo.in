'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminToken, postJson, setAdminToken } from '../../lib/api';

interface AdminLoginResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    role: string;
    name: string;
  };
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const existing = getAdminToken();
    if (existing) {
      router.replace('/operations');
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await postJson<AdminLoginResponse>(
        '/auth/admin/passcode',
        { passcode },
        { auth: false }
      );

      setAdminToken(response.token);
      router.replace('/operations');
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message === 'Request failed: 401'
            ? 'Invalid passcode'
            : submitError.message
          : 'Login failed'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10 sm:px-6">
      <section className="w-full rounded-xl border border-slate-800 bg-slate-900/80 p-8 backdrop-blur">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-300">Qargo Ops</p>
        <h1 className="mt-2 font-sora text-3xl text-slate-100">Admin Login</h1>
        <p className="mt-1 font-manrope text-sm text-slate-400">Use launch passcode to access operations.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block">
            <span className="font-manrope text-sm font-semibold text-slate-300">Passcode</span>
            <input
              type="password"
              required
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-slate-200 outline-none ring-cyan-600/40 focus:ring"
              placeholder="Enter admin passcode"
            />
          </label>

          {error ? <p className="font-manrope text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-manrope text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </section>
    </div>
  );
}
