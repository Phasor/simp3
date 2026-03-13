import { NextResponse } from 'next/server'
import { PrivyClient } from '@privy-io/server-auth'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

// Use service role for webhook — no user session available
function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const PRIVY_APP_ID = process.env.PRIVY_APP_ID
  const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET
  const PRIVY_WEBHOOK_SECRET = process.env.PRIVY_WEBHOOK_SECRET

  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET || !PRIVY_WEBHOOK_SECRET) {
    console.warn('[payment/webhook] Privy not configured — rejecting webhook')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  const rawBody = await req.text()

  // Build headers object for Privy signature verification
  const headersObj: Record<string, string> = {}
  req.headers.forEach((value, key) => { headersObj[key] = value })

  // Verify webhook signature
  const privy = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET)
  try {
    privy.verifyWebhook(rawBody, headersObj as Parameters<typeof privy.verifyWebhook>[1], PRIVY_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[payment/webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(rawBody) as { type: string; data: Record<string, unknown> }
  const supabase = getServiceSupabase()

  // ── wallet.created ────────────────────────────────────────────────────────
  // Fires when Privy creates an embedded wallet. We use /api/wallet/create to
  // store wallet_address, but this provides a reliable backup.
  if (event.type === 'wallet.created') {
    const walletData = event.data as {
      wallet?: { id?: string; address?: string }
      user?: { id?: string }
    }
    const walletId = walletData.wallet?.id
    const walletAddress = walletData.wallet?.address

    if (walletId && walletAddress) {
      // Update any profile that has this privy_wallet_id set but no address yet
      await supabase
        .from('profiles')
        .update({ wallet_address: walletAddress })
        .eq('privy_wallet_id', walletId)
        .is('wallet_address', null)

      console.log('[payment/webhook] wallet.created backup sync:', walletAddress)
    }
  }

  // ── transaction.confirmed ─────────────────────────────────────────────────
  // Fires when a transaction lands on-chain. Send dom notification email.
  if (event.type === 'transaction.confirmed') {
    const txData = event.data as { transaction?: { hash?: string } }
    const txHash = txData.transaction?.hash

    if (!txHash) {
      return NextResponse.json({ received: true })
    }

    const { data: completion } = await supabase
      .from('task_completions')
      .select('id, task_id, fan_id, amount_usdc, tribute_message')
      .eq('payment_tx_hash', txHash)
      .maybeSingle()

    if (!completion) {
      console.warn('[payment/webhook] No completion found for tx:', txHash)
      return NextResponse.json({ received: true })
    }

    // Fetch task + dom for notification
    const { data: task } = await supabase
      .from('tasks')
      .select('title, creator_id')
      .eq('id', completion.task_id)
      .single()

    if (task) {
      const { data: dom } = await supabase
        .from('profiles')
        .select('email, display_name')
        .eq('id', task.creator_id)
        .single()

      await sendDomNotification({
        domEmail: dom?.email ?? null,
        domName: dom?.display_name ?? 'Dom',
        taskTitle: task.title,
        amountUsdc: completion.amount_usdc ?? 0,
        txHash,
      })
    }

    console.log('[payment/webhook] transaction.confirmed processed:', txHash)
  }

  // ── transaction.failed / transaction.reverted ─────────────────────────────
  // Clean up the pending completion so the sub can retry.
  if (event.type === 'transaction.failed' || event.type === 'transaction.reverted') {
    const txData = event.data as { transaction?: { hash?: string } }
    const txHash = txData.transaction?.hash

    if (txHash) {
      await supabase
        .from('task_completions')
        .delete()
        .eq('payment_tx_hash', txHash)

      await supabase
        .from('purchases')
        .delete()
        .eq('usdc_tx_hash', txHash)

      console.log('[payment/webhook] Cleaned up failed tx:', txHash)
    }
  }

  return NextResponse.json({ received: true })
}

async function sendDomNotification({
  domEmail,
  domName,
  taskTitle,
  amountUsdc,
  txHash,
}: {
  domEmail: string | null
  domName: string
  taskTitle: string
  amountUsdc: number
  txHash: string
}) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY || !domEmail) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Tribute <noreply@tribute.app>',
      to: domEmail,
      subject: `Payment confirmed — $${amountUsdc} USDC received`,
      html: `
        <p>Hello ${domName},</p>
        <p>A sub's tribute of <strong>$${amountUsdc} USDC</strong> for <em>"${taskTitle}"</em> has been confirmed on-chain.</p>
        <p>Transaction hash: <code>${txHash}</code></p>
        <p>Log into your dashboard to review any pending completions.</p>
        <p>— Tribute</p>
      `,
    }),
  })
}
