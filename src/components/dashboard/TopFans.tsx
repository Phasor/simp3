'use client';

interface Fan {
  id: string;
  username: string;
  unlocks: number;
  lastActive: string;
  totalSpent: number;
  rank: number;
}

interface TopFansProps {
  fans: Fan[];
}

export default function TopFans({ fans }: TopFansProps) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Top Fans (This Month)</h2>
        <a href="#" className="text-xs text-primary-600 hover:underline">View all</a>
      </div>
      <ul className="px-3 py-2 divide-y divide-slate-100">
        {fans.map((fan) => (
          <li key={fan.id} className="flex items-center justify-between px-2 py-2">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-full grid place-items-center text-sm ${
                fan.rank === 1 
                  ? 'bg-gradient-to-tr from-amber-400 to-yellow-300' 
                  : 'bg-slate-200'
              }`}>
                {fan.rank === 1 ? '👑' : fan.rank}
              </div>
              <div>
                <p className="text-sm font-medium">@{fan.username}</p>
                <p className="text-xs text-slate-500">
                  {fan.unlocks} unlock{fan.unlocks !== 1 ? 's' : ''} · Last active {fan.lastActive}
                </p>
              </div>
            </div>
            <p className="text-sm font-semibold">${fan.totalSpent}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
