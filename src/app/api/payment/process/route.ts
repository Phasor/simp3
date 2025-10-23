import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createPaymentService } from '@/lib/services/paymentService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { creatorId, amount, days } = body;

    // Validate required fields
    if (!creatorId || !amount || !days) {
      return NextResponse.json(
        { error: 'Missing required fields: creatorId, amount, days' },
        { status: 400 }
      );
    }

    // Validate amount and days are positive numbers
    const amountNum = parseFloat(amount);
    const daysNum = parseInt(days);
    
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid amount' },
        { status: 400 }
      );
    }

    if (isNaN(daysNum) || daysNum <= 0) {
      return NextResponse.json(
        { error: 'Invalid days' },
        { status: 400 }
      );
    }

    // Get current user
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_type, display_name')
      .eq('auth_user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Verify user is a fan
    if (profile.user_type !== 'FAN') {
      return NextResponse.json(
        { error: 'Only fans can purchase chat access' },
        { status: 403 }
      );
    }

    // Verify creator exists
    const { data: creator, error: creatorError } = await supabase
      .from('profiles')
      .select('id, display_name, user_type')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found' },
        { status: 404 }
      );
    }

    if (creator.user_type !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Invalid creator' },
        { status: 400 }
      );
    }

    // Get creator's chat rules to validate the payment amount
    const { data: chatRules, error: rulesError } = await supabase
      .from('chat_rules')
      .select('min_spend_cents, access_days')
      .eq('creator_id', creatorId)
      .single();

    // Use default values if no chat rules found
    const requiredAmountCents = chatRules?.min_spend_cents || 10000; // Default $100
    const requiredDays = chatRules?.access_days || 30; // Default 30 days
    
    // Validate that the payment amount matches the creator's required amount
    const providedAmountCents = Math.round(amountNum * 100);
    if (providedAmountCents !== requiredAmountCents) {
      return NextResponse.json(
        { 
          error: `Invalid payment amount. Required: $${requiredAmountCents / 100}, provided: $${providedAmountCents / 100}`,
          requiredAmount: requiredAmountCents / 100,
          providedAmount: providedAmountCents / 100
        },
        { status: 400 }
      );
    }

    // Validate that the access days match the creator's settings
    if (daysNum !== requiredDays) {
      return NextResponse.json(
        { 
          error: `Invalid access duration. Required: ${requiredDays} days, provided: ${daysNum} days`,
          requiredDays,
          providedDays: daysNum
        },
        { status: 400 }
      );
    }

    // Process payment
    const paymentService = createPaymentService(
      process.env.NODE_ENV === 'production' ? 'production' : 'development'
    );

    const paymentResult = await paymentService.processPayment({
      creatorId,
      fanId: profile.id,
      amountCents: requiredAmountCents, // Use validated amount from creator's chat rules
      accessDays: daysNum,
      description: `Chat access to ${creator.display_name} for ${daysNum} days`
    });

    if (!paymentResult.success) {
      return NextResponse.json(
        { 
          error: paymentResult.error || 'Payment failed',
          success: false 
        },
        { status: 400 }
      );
    }

    // Use service role to create purchase record and grant access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase service role credentials');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabaseAdmin = createSupabaseClient(supabaseUrl, supabaseServiceKey);

    // Get or create a "Chat Access" task for this creator
    let chatAccessTask;
    const { data: existingTask, error: taskFetchError } = await supabaseAdmin
      .from('tasks')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('title', 'Chat Access')
      .maybeSingle();

    if (taskFetchError && taskFetchError.code !== 'PGRST116') {
      console.error('Error checking for chat access task:', taskFetchError);
      return NextResponse.json(
        { error: 'Failed to process payment' },
        { status: 500 }
      );
    }

    if (existingTask) {
      chatAccessTask = existingTask;
    } else {
      // First create a placeholder media asset for the chat access task
      const { data: mediaAsset, error: mediaError } = await supabaseAdmin
        .from('media_assets')
        .insert({
          type: 'IMAGE',
          title: 'Chat Access',
          playback_ref: 'chat-access-placeholder',
          creator_id: creatorId,
          thumbnail_url: null,
          file_size: null,
          mime_type: 'application/json'
        })
        .select('id')
        .single();

      if (mediaError) {
        console.error('Error creating placeholder media asset:', mediaError);
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }

      // Create a chat access task for this creator
      const { data: newTask, error: taskCreateError } = await supabaseAdmin
        .from('tasks')
        .insert({
          creator_id: creatorId,
          slug: `chat-access-${creatorId}`,
          title: 'Chat Access',
          description: `Direct messaging access with ${creator.display_name}`,
          price_cents: requiredAmountCents,
          points: 0,
          media_id: mediaAsset.id,
          active: true
        })
        .select('id')
        .single();

      if (taskCreateError) {
        console.error('Error creating chat access task:', taskCreateError);
        return NextResponse.json(
          { error: 'Failed to process payment' },
          { status: 500 }
        );
      }
      chatAccessTask = newTask;
    }

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchases')
      .insert({
        profile_id: profile.id,
        task_id: chatAccessTask.id, // Use the chat access task ID
        amount_cents: requiredAmountCents,
        processor: paymentService.getCurrentProcessor() as 'CCBILL' | 'SEGPAY' | 'EPOCH',
        processor_tx_id: paymentResult.transactionId!
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('Error creating purchase record:', purchaseError);
      return NextResponse.json(
        { error: 'Failed to record purchase' },
        { status: 500 }
      );
    }

    // Calculate access expiry
    const accessUntil = new Date();
    accessUntil.setDate(accessUntil.getDate() + daysNum);

    // Grant or update chat access
    const { error: accessError } = await supabaseAdmin
      .from('chat_access')
      .upsert({
        creator_id: creatorId,
        fan_id: profile.id,
        state: 'granted' as const,
        access_until: accessUntil.toISOString(),
        last_qualifying_purchase_id: purchase.id,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'creator_id,fan_id'
      });

    if (accessError) {
      console.error('Error granting chat access:', accessError);
      return NextResponse.json(
        { error: 'Payment processed but failed to grant access. Please contact support.' },
        { status: 500 }
      );
    }

    // Create or update conversation record so it appears in ChatInbox
    const { error: conversationError } = await supabaseAdmin
      .from('conversations')
      .upsert({
        creator_id: creatorId,
        fan_id: profile.id,
        last_message_at: new Date().toISOString(),
        last_message_preview: null,
        message_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'creator_id,fan_id'
      });

    if (conversationError) {
      console.error('Error creating conversation record:', conversationError);
      // Don't fail the payment for this - access is already granted
      console.warn('⚠️ Conversation record creation failed, but chat access was granted successfully');
    }

    console.log(`✅ Payment successful: Fan ${profile.id} purchased ${daysNum} days access to creator ${creatorId}`);

    return NextResponse.json({
      success: true,
      transactionId: paymentResult.transactionId,
      accessUntil: accessUntil.toISOString(),
      message: 'Payment successful! Chat access has been granted.'
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
