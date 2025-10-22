'use client';

import { useState } from 'react';

interface QuickActionsProps {
  creatorHandle: string;
}

export default function QuickActions({ creatorHandle }: QuickActionsProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const creatorPermalink = `https://simp3.app/@${creatorHandle}`;

  const handleCopyPermalink = async () => {
    try {
      await navigator.clipboard.writeText(creatorPermalink);
      // You might want to add a toast notification here
      alert('Copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleTweet = () => {
    const text = encodeURIComponent('I just launched paid chat on #simp3 — come say hi!');
    const url = encodeURIComponent(creatorPermalink);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleDownloadEarnings = async () => {
    setIsDownloading(true);
    
    try {
      // Fetch detailed earnings data
      const response = await fetch('/api/dashboard/earnings-export');
      if (!response.ok) {
        throw new Error('Failed to fetch earnings data');
      }
      
      const data = await response.json();
      
      // Create CSV content
      const rows = [
        ['date', 'fan', 'amount_usd', 'type'],
        ...data.map((item: any) => [
          new Date(item.created_at).toISOString().split('T')[0],
          `@${item.fan_username}`,
          (item.amount_cents / 100).toFixed(2),
          'unlock'
        ])
      ];
      
      const csv = rows.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `simp3_earnings_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Error downloading earnings:', error);
      alert('Failed to download earnings data. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-semibold">Quick Actions</h2>
      </div>
      <div className="px-5 pb-5 grid grid-cols-1 gap-3">
        <button 
          onClick={handleTweet}
          className="rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          Tweet my link
        </button>
        
        <button 
          onClick={handleCopyPermalink}
          className="rounded-xl bg-primary-600 text-white text-sm px-3 py-2 hover:bg-primary-500 transition-colors"
        >
          Copy permalink
        </button>
        
        <button 
          onClick={handleDownloadEarnings}
          disabled={isDownloading}
          className="rounded-xl border border-slate-200 bg-white text-slate-800 text-sm px-3 py-2 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          {isDownloading ? 'Downloading...' : 'Download earnings (.csv)'}
        </button>
        
        <div className="grid grid-cols-2 gap-3">
          <a 
            href="/chat" 
            className="rounded-xl border border-slate-200 bg-white text-center text-slate-800 text-sm px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            Open chat
          </a>
          <a 
            href={`/creator/${creatorHandle}/landing`}
            className="rounded-xl border border-slate-200 bg-white text-center text-slate-800 text-sm px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            View profile
          </a>
        </div>
        
      </div>
    </div>
  );
}
