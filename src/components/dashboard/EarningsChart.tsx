'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EarningsChartProps {
  data: number[];
  timeRange: '90d' | '12m';
  onRangeChange: (range: '90d' | '12m') => void;
}

export default function EarningsChart({ data, timeRange, onRangeChange }: EarningsChartProps) {
  // Transform data for Recharts
  const chartData = data.map((value, index) => {
    const now = new Date();
    const monthsBack = data.length - 1 - index;
    const date = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    
    return {
      month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      earnings: value,
      formattedEarnings: `$${value.toLocaleString()}`
    };
  });

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
    if (active && payload && payload.length) {
      const earnings = payload[0].value;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg border border-slate-700">
          <p className="text-xs text-slate-300 mb-1">{label}</p>
          <p className="text-lg font-bold">
            ${earnings.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Earnings Over Time</h2>
        <div className="flex gap-2 text-xs">
          <button 
            onClick={() => onRangeChange('90d')}
            className={`border rounded-lg px-2 py-1 ${
              timeRange === '90d' 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-600' 
                : 'border-slate-200'
            }`}
          >
            90d
          </button>
          <button 
            onClick={() => onRangeChange('12m')}
            className={`border rounded-lg px-2 py-1 ${
              timeRange === '12m' 
                ? 'border-indigo-500 bg-indigo-50 text-indigo-600' 
                : 'border-slate-200'
            }`}
          >
            12m
          </button>
        </div>
      </div>
      <div className="p-5">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="earnings" 
              fill="#6366f1" 
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
