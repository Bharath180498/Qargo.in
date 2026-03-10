'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { NavShell } from '../../components/nav-shell';
import { fetcher, postJson } from '../../lib/api';

interface PricingRule {
  id: string;
  minDriverRating: number;
  maxDriverRating: number;
  multiplier: number;
}

export default function PricingPage() {
  const { data, mutate } = useSWR<PricingRule[]>('/pricing/rules', fetcher);

  const [minDriverRating, setMinDriverRating] = useState('4.5');
  const [maxDriverRating, setMaxDriverRating] = useState('4.8');
  const [multiplier, setMultiplier] = useState('0.97');

  const createRule = async () => {
    await postJson('/pricing/rules', {
      minDriverRating: Number(minDriverRating),
      maxDriverRating: Number(maxDriverRating),
      multiplier: Number(multiplier)
    });

    await mutate();
  };

  return (
    <NavShell>
      <section className="grid gap-5 lg:grid-cols-[1fr,1.2fr]">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
          <h2 className="font-sora text-xl text-slate-100">Create Pricing Rule</h2>
          <p className="mt-1 font-manrope text-sm text-slate-400">
            Configure rating-based multipliers to tune conversion and utilization.
          </p>

          <div className="mt-5 space-y-3">
            <label className="block">
              <span className="font-manrope text-sm text-slate-300">Min Rating</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-slate-200"
                value={minDriverRating}
                onChange={(event) => setMinDriverRating(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="font-manrope text-sm text-slate-300">Max Rating</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-slate-200"
                value={maxDriverRating}
                onChange={(event) => setMaxDriverRating(event.target.value)}
              />
            </label>
            <label className="block">
              <span className="font-manrope text-sm text-slate-300">Multiplier</span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-manrope text-slate-200"
                value={multiplier}
                onChange={(event) => setMultiplier(event.target.value)}
              />
            </label>

            <button
              className="mt-2 rounded-md border border-cyan-500/50 bg-cyan-500/15 px-4 py-2 font-manrope text-sm font-semibold text-cyan-200"
              onClick={() => void createRule()}
            >
              Save Rule
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur">
          <h2 className="font-sora text-xl text-slate-100">Active Rules</h2>
          <div className="mt-4 space-y-3">
            {(data ?? []).map((rule) => (
              <article key={rule.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                <p className="font-manrope text-sm text-slate-300">
                  Rating {rule.minDriverRating} to {rule.maxDriverRating}
                </p>
                <p className="font-sora text-xl text-cyan-300">x{rule.multiplier}</p>
              </article>
            ))}
            {(data?.length ?? 0) === 0 ? (
              <p className="font-manrope text-slate-400">No custom rules. Fallback defaults are active.</p>
            ) : null}
          </div>
        </div>
      </section>
    </NavShell>
  );
}
