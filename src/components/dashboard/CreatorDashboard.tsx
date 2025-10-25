'use client';

import { useState } from 'react';
import StatsCards from './StatsCards';
import EarningsChart from './EarningsChart';
import TopFans from './TopFans';
import QuickActions from './QuickActions';
import { useDashboardData } from '@/lib/hooks/useDashboardData';

interface CreatorDashboardProps {
  creatorHandle: string;
  displayName: string;
}

export default function CreatorDashboard({ creatorHandle, displayName }: CreatorDashboardProps) {
  const [timeRange, setTimeRange] = useState<'90d' | '12m'>('90d');
  const { data, loading, error } = useDashboardData();

  if (loading) {
    return (
      <div className="bg-slate-50 text-slate-900 font-sans min-h-screen">
        <main className="max-w-6xl mx-auto px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="typ-h1 text-slate-900 mb-2">
              Welcome back, {displayName}!
            </h1>
            <p className="typ-body text-slate-600">
              Loading your dashboard...
            </p>
          </div>
          <div className="animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-200 p-4 shadow">
                  <div className="h-4 bg-slate-200 rounded mb-2"></div>
                  <div className="h-8 bg-slate-200 rounded mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-2/3"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow h-80"></div>
                <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow h-64"></div>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow h-80"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-50 text-slate-900 font-sans min-h-screen">
        <main className="max-w-6xl mx-auto px-4 py-6 md:px-6">
          <div className="mb-6">
            <h1 className="typ-h1 text-slate-900 mb-2">
              Welcome back, {displayName}!
            </h1>
            <p className="typ-body text-red-600">
              Error loading dashboard: {error}
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Use last 3 months of data for 90d view, all 12 months for 12m view
  const chartData = timeRange === '90d' 
    ? data.chartData.slice(-3)
    : data.chartData;

  return (
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen">
      <main className="max-w-6xl mx-auto px-4 py-6 md:px-6">
        {/* Welcome Header */}
        <div className="mb-6">
          <h1 className="typ-h1 text-slate-900 mb-2">
            Welcome back, {displayName}!
          </h1>
          <p className="typ-body text-slate-600">
            Here&apos;s how your creator profile is performing
          </p>
        </div>

        {/* Stats Cards */}
        <StatsCards 
          totalEarnings={data.totalEarnings}
          monthlyEarnings={data.monthlyEarnings}
          chatUnlocks={data.chatUnlocks}
          activeFans={data.activeFans}
          avgPerUnlock={data.avgPerUnlock}
          returningFans={data.returningFans}
          newFans={data.newFans}
        />

        {/* Main Content Grid */}
        <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Earnings Chart */}
            <EarningsChart 
              data={chartData}
              timeRange={timeRange}
              onRangeChange={setTimeRange}
            />

            {/* Top Fans */}
            <TopFans fans={data.topFans} />
          </div>

          <div className="space-y-6">
            {/* Quick Actions */}
            <QuickActions creatorHandle={creatorHandle} />
          </div>
        </section>
      </main>
    </div>
  );
}
