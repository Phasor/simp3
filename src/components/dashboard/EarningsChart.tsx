'use client';

import { useEffect, useRef } from 'react';

interface EarningsChartProps {
  data: number[];
  timeRange: '90d' | '12m';
  onRangeChange: (range: '90d' | '12m') => void;
}

export default function EarningsChart({ data, timeRange, onRangeChange }: EarningsChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !data.length) return;

    const svg = svgRef.current;
    // Clear previous content
    svg.innerHTML = '';

    const W = 640;
    const H = 240;
    const p = 32;
    const bw = 40;
    const max = Math.max(...data);

    data.forEach((value, index) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const height = (value / max) * (H - p * 2);
      
      rect.setAttribute('x', String(p + index * (bw + 10)));
      rect.setAttribute('y', String(H - p - height));
      rect.setAttribute('width', String(bw));
      rect.setAttribute('height', String(height));
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', '#6366f1');
      
      svg.appendChild(rect);
    });
  }, [data]);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Earnings Over Time</h2>
        <div className="flex gap-2 text-xs">
          <button 
            onClick={() => onRangeChange('90d')}
            className={`border rounded-lg px-2 py-1 ${
              timeRange === '90d' 
                ? 'border-primary-500 bg-primary-50 text-primary-600' 
                : 'border-slate-200'
            }`}
          >
            90d
          </button>
          <button 
            onClick={() => onRangeChange('12m')}
            className={`border rounded-lg px-2 py-1 ${
              timeRange === '12m' 
                ? 'border-primary-500 bg-primary-50 text-primary-600' 
                : 'border-slate-200'
            }`}
          >
            12m
          </button>
        </div>
      </div>
      <div className="p-5">
        <svg 
          ref={svgRef}
          viewBox="0 0 640 240" 
          className="w-full h-56"
        />
      </div>
    </div>
  );
}
