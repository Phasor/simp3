'use client';

interface StatsCardsProps {
  totalEarnings: number;
  monthlyEarnings: number;
  chatUnlocks: number;
  activeFans: number;
  avgPerUnlock: number;
  returningFans: number;
  newFans: number;
}

export default function StatsCards({
  totalEarnings,
  monthlyEarnings,
  chatUnlocks,
  activeFans,
  avgPerUnlock,
  returningFans,
  newFans
}: StatsCardsProps) {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <article className="rounded-2xl bg-white border border-slate-200 p-4 shadow">
        <p className="typ-overline text-slate-500">Total Earnings</p>
        <div className="mt-2 typ-h2 font-extrabold">${totalEarnings.toLocaleString()}</div>
        <p className="typ-caption text-slate-500 mt-1">Net of platform fees</p>
      </article>
      
      <article className="rounded-2xl bg-white border border-slate-200 p-4 shadow">
        <p className="typ-overline text-slate-500">Earnings (This Month)</p>
        <div className="mt-2 typ-h2 font-extrabold">${monthlyEarnings.toLocaleString()}</div>
        <p className="typ-caption text-slate-500 mt-1">From {chatUnlocks} unlocks</p>
      </article>
      
      <article className="rounded-2xl bg-white border border-slate-200 p-4 shadow">
        <p className="typ-overline text-slate-500">Chat Unlocks</p>
        <div className="mt-2 typ-h2 font-extrabold">{chatUnlocks}</div>
        <p className="typ-caption text-slate-500 mt-1">Avg ${avgPerUnlock} / unlock</p>
      </article>
      
      <article className="rounded-2xl bg-white border border-slate-200 p-4 shadow">
        <p className="typ-overline text-slate-500">Active Fans</p>
        <div className="mt-2 typ-h2 font-extrabold">{activeFans}</div>
        <p className="typ-caption text-slate-500 mt-1">{returningFans} returning · {newFans} new</p>
      </article>
    </section>
  );
}
