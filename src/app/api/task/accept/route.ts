import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encodeFunctionData, parseUnits } from 'viem'

export const runtime = 'nodejs'

// Use Base Sepolia (testnet) in dev, Base mainnet in production
const IS_DEV = process.env.NODE_ENV === 'development'
const USDC_CONTRACT = IS_DEV
  ? '0x036CbD53842c5426634e7929541eC2318f3dCF7e'   // Base Sepolia test USDC
  : '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'   // Base mainnet USDC
const CAIP2_CHAIN = IS_DEV ? 'eip155:84532' : 'eip155:8453'

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

function privyHeaders() {
  const id = process.env.PRIVY_APP_ID!
  const secret = process.env.PRIVY_APP_SECRET!
  return {
    Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`,
    'privy-app-id': id,
    'Content-Type': 'application/json',
  }
}

async function sendPrivyTransaction(
  walletId: string,
  toAddress: string,
  amountUsdc: number
): Promise<{ txHash: string } | { error: string; status: number }> {
  const calldata = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: 'transfer',
    args: [toAddress as `0x${string}`, parseUnits(String(amountUsdc), 6)],
  })

  const res = await fetch(`https://auth.privy.io/api/v1/wallets/${walletId}/rpc`, {
    method: 'POST',
    headers: privyHeaders(),
    body: JSON.stringify({
      method: 'eth_sendTransaction',
      caip2: CAIP2_CHAIN,
      params: {
        transaction: {
          to: USDC_CONTRACT,
          data: calldata,
          value: '0x0',
        },
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[task/accept] Privy transaction error:', res.status, body)
    // Surface user-friendly messages for common failures
    if (res.status === 400 && body.includes('insufficient')) {
      return { error: 'Insufficient USDC balance in your wallet', status: 402 }
    }
    return { error: 'Payment failed — please try again', status: 502 }
  }

  const data = await res.json()
  const txHash = data?.data?.hash as string | undefined
  if (!txHash) {
    console.error('[task/accept] Privy returned no tx hash:', data)
    return { error: 'Payment failed — no transaction hash returned', status: 502 }
  }

  return { txHash }
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_type, age_verified, wallet_address, privy_wallet_id')
    .eq('auth_user_id', user.id)
    .single()

  if (!profile || profile.user_type !== 'FAN') {
    return NextResponse.json({ error: 'Only subs can accept tasks' }, { status: 403 })
  }

  if (!profile.age_verified) {
    return NextResponse.json({ error: 'Age verification required', code: 'AGE_UNVERIFIED' }, { status: 403 })
  }

  const { taskId, tributeMessage } = await req.json()
  if (!taskId || !tributeMessage) {
    return NextResponse.json({ error: 'taskId and tributeMessage are required' }, { status: 400 })
  }

  // Fetch task + dom wallet
  const { data: task } = await supabase
    .from('tasks')
    .select('id, task_type, price_usdc, creator_id, status')
    .eq('id', taskId)
    .maybeSingle()

  if (!task || task.status !== 'PUBLISHED') {
    return NextResponse.json({ error: 'Task not found or not available' }, { status: 404 })
  }

  const { data: dom } = await supabase
    .from('profiles')
    .select('id, wallet_address, display_name, email')
    .eq('id', task.creator_id)
    .single()

  if (!dom?.wallet_address) {
    return NextResponse.json({
      error: "Dom hasn't set up a payout wallet yet — contact them directly",
      code: 'DOM_NO_WALLET',
    }, { status: 422 })
  }

  const amountUsdc = task.price_usdc ?? 0
  const PRIVY_CONFIGURED = !!(process.env.PRIVY_APP_ID && process.env.PRIVY_APP_SECRET)

  let txHash: string

  if (PRIVY_CONFIGURED && profile.privy_wallet_id) {
    // === REAL PAYMENT: Privy server-side USDC transfer ===
    const result = await sendPrivyTransaction(profile.privy_wallet_id, dom.wallet_address, amountUsdc)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    txHash = result.txHash
    console.log('[task/accept] Real Privy tx sent:', txHash)
  } else {
    // === STUB: no Privy wallet or keys missing ===
    if (PRIVY_CONFIGURED && !profile.privy_wallet_id) {
      console.warn('[task/accept] Sub has no privy_wallet_id — using stub. Run wallet creation first.')
    } else {
      console.warn('[task/accept] Privy not configured — using stub payment')
    }
    txHash = `0xSTUB_${Date.now()}_${Math.random().toString(36).slice(2)}`
  }

  // Determine initial completion status
  // CONTENT auto-approves on payment (no completion step needed)
  // REPETITION, SUBMISSION, EVIDENCE all start as ACCEPTED — sub must complete the task
  const initialStatus = task.task_type === 'CONTENT' ? 'APPROVED' : 'ACCEPTED'

  const { data: completion, error: completionError } = await supabase
    .from('task_completions')
    .insert({
      task_id: taskId,
      fan_id: profile.id,
      status: initialStatus,
      payment_tx_hash: txHash,
      amount_usdc: amountUsdc,
      tribute_message: tributeMessage,
      accepted_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (completionError) {
    console.error('[task/accept] task_completion insert error:', completionError)
    return NextResponse.json({ error: completionError.message }, { status: 500 })
  }

  // Record purchase for accounting (15% platform fee tracked at payout time)
  await supabase.from('purchases').insert({
    fan_id: profile.id,
    task_id: taskId,
    usdc_tx_hash: txHash,
    amount_usdc: amountUsdc,
    purchase_type: 'TASK',
  })

  // Send dom notification email (non-blocking, stub if no RESEND_API_KEY)
  notifyDom({
    domEmail: dom.email,
    domName: dom.display_name ?? 'Dom',
    taskTitle: '', // fetched below if needed
    amountUsdc,
    txHash,
  }).catch(err => console.warn('[task/accept] Dom email failed:', err))

  return NextResponse.json({
    completionId: completion.id,
    status: initialStatus,
    taskType: task.task_type,
    txHash,
  })
}

async function notifyDom({
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
  if (!RESEND_API_KEY || !domEmail) {
    console.warn('[task/accept] Resend not configured or no dom email — skipping notification')
    return
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Tribute <noreply@tribute.app>',
      to: domEmail,
      subject: `A sub has submitted a tribute — $${amountUsdc} USDC`,
      html: `
        <p>Hello ${domName},</p>
        <p>A sub has accepted a task and sent you <strong>$${amountUsdc} USDC</strong>.</p>
        <p>Transaction: <code>${txHash}</code></p>
        <p>Log into your dashboard to review any pending completions.</p>
        <p>— Tribute</p>
      `,
    }),
  })
}
