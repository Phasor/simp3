import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile || profile.user_type !== 'CREATOR') {
      return NextResponse.json({ error: 'Creator profile not found' }, { status: 404 });
    }

    // First get all task IDs for this creator
    const { data: creatorTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id')
      .eq('creator_id', profile.id);

    if (tasksError) {
      console.error('Error fetching creator tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch creator tasks' }, { status: 500 });
    }

    const taskIds = creatorTasks?.map(task => task.id) || [];

    let purchases = [];
    let purchaseError = null;

    // Only fetch purchases if there are tasks
    if (taskIds.length > 0) {
      const result = await supabase
        .from('purchases')
        .select(`
          *,
          profile:profiles!purchases_profile_id_fkey(id, display_name, email)
        `)
        .in('task_id', taskIds)
        .order('created_at', { ascending: false });
      
      purchases = result.data;
      purchaseError = result.error;
    }

    if (purchaseError) {
      console.error('Error fetching purchases:', purchaseError);
      return NextResponse.json({ error: 'Failed to fetch purchases' }, { status: 500 });
    }

    const purchaseData = purchases || [];
    
    // Calculate earnings
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let totalEarnings = 0;
    let monthlyEarnings = 0;
    let chatUnlocks = 0;

    purchaseData.forEach(purchase => {
      const amount = purchase.amount_cents / 100; // Convert to dollars
      totalEarnings += amount;
      chatUnlocks++;

      const purchaseDate = new Date(purchase.created_at);
      if (purchaseDate.getMonth() === currentMonth && purchaseDate.getFullYear() === currentYear) {
        monthlyEarnings += amount;
      }
    });

    // Get all chat access records for this creator for fan-related stats
    const { data: chatAccessRecords, error: accessError } = await supabase
      .from('chat_access')
      .select(`
        *,
        fan:profiles!chat_access_fan_id_fkey(id, display_name, email)
      `)
      .eq('creator_id', profile.id);

    if (accessError) {
      console.error('Error fetching chat access:', accessError);
      return NextResponse.json({ error: 'Failed to fetch access records' }, { status: 500 });
    }

    // Get active fans (fans with current access)
    const activeFans = chatAccessRecords?.filter(record => 
      record.state === 'granted' && new Date(record.access_until) > new Date()
    ) || [];

    // Calculate returning vs new fans (simplified - based on creation date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newFans = activeFans.filter(record => 
      new Date(record.created_at) > thirtyDaysAgo
    ).length;
    const returningFans = activeFans.length - newFans;

    // Calculate average per unlock
    const avgPerUnlock = chatUnlocks > 0 ? totalEarnings / chatUnlocks : 0;

    // Get top fans data
    const fanEarnings = new Map<string, { fan: any, totalSpent: number, unlocks: number, lastActive: string }>();
    
    purchaseData.forEach(purchase => {
      const fanId = purchase.profile_id;
      const amount = purchase.amount_cents / 100;
      
      if (fanEarnings.has(fanId)) {
        const existing = fanEarnings.get(fanId)!;
        existing.totalSpent += amount;
        existing.unlocks += 1;
        if (new Date(purchase.created_at) > new Date(existing.lastActive)) {
          existing.lastActive = purchase.created_at;
        }
      } else {
        fanEarnings.set(fanId, {
          fan: purchase.profile,
          totalSpent: amount,
          unlocks: 1,
          lastActive: purchase.created_at
        });
      }
    });

    // Convert to array and sort by total spent
    const topFans = Array.from(fanEarnings.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map((fanData, index) => ({
        id: fanData.fan.id,
        username: fanData.fan.display_name || fanData.fan.email.split('@')[0],
        unlocks: fanData.unlocks,
        lastActive: formatTimeAgo(fanData.lastActive),
        totalSpent: fanData.totalSpent,
        rank: index + 1
      }));

    // Generate earnings chart data (last 12 months)
    const chartData = [];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthlyTotal = purchaseData
        .filter(purchase => {
          const purchaseDate = new Date(purchase.created_at);
          return purchaseDate >= monthStart && purchaseDate <= monthEnd;
        })
        .reduce((sum, purchase) => sum + (purchase.amount_cents / 100), 0);

      chartData.push(monthlyTotal);
    }

    const response = {
      totalEarnings: Math.round(totalEarnings * 100) / 100,
      monthlyEarnings: Math.round(monthlyEarnings * 100) / 100,
      chatUnlocks,
      activeFans: activeFans.length,
      avgPerUnlock: Math.round(avgPerUnlock * 100) / 100,
      returningFans,
      newFans,
      topFans,
      chartData
    };


    return NextResponse.json(response);

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'today';
  if (diffInDays === 1) return '1d ago';
  if (diffInDays < 7) return `${diffInDays}d ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
  return `${Math.floor(diffInDays / 30)}mo ago`;
}
