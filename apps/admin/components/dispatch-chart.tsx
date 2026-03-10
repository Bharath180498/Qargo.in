'use client';

import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

export function DispatchChart() {
  return <DispatchChartWithData labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} values={[74, 69, 61, 58, 54, 57, 52]} />;
}

export function DispatchChartWithData({
  labels,
  values
}: {
  labels: string[];
  values: number[];
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 backdrop-blur">
      <h3 className="font-sora text-lg text-slate-100">Dispatch Latency Trend</h3>
      <p className="mb-3 font-manrope text-xs text-slate-400">Median time to assign a driver (seconds)</p>
      <Line
        data={{
          labels,
          datasets: [
            {
              label: 'Assignment Time',
              data: values,
              borderColor: '#22d3ee',
              backgroundColor: 'rgba(34, 211, 238, 0.2)',
              tension: 0.35
            }
          ]
        }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              ticks: {
                color: '#94a3b8'
              },
              grid: {
                color: 'rgba(71, 85, 105, 0.35)'
              }
            },
            x: {
              ticks: {
                color: '#94a3b8'
              },
              grid: {
                color: 'rgba(71, 85, 105, 0.2)'
              }
            }
          }
        }}
      />
    </div>
  );
}
