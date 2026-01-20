import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    console.error('[Verify] New Request Received');
    console.log('[Verify] Headers Trace:', JSON.stringify(Object.fromEntries(req.headers.entries())));

    try {
        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

        if (RAZORPAY_KEY_ID) {
            console.error(`[Verify] Key ID: ${RAZORPAY_KEY_ID.substring(0, 4)}...${RAZORPAY_KEY_ID.substring(RAZORPAY_KEY_ID.length - 4)} (Len: ${RAZORPAY_KEY_ID.length})`);
        } else {
            console.error('[Verify] Key ID is MISSING in env');
        }

        if (RAZORPAY_KEY_SECRET) {
            console.error(`[Verify] Key Secret: ${RAZORPAY_KEY_SECRET.substring(0, 4)}...${RAZORPAY_KEY_SECRET.substring(RAZORPAY_KEY_SECRET.length - 4)} (Len: ${RAZORPAY_KEY_SECRET.length})`);
        } else {
            console.error('[Verify] Key Secret is MISSING in env');
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = await req.json()
        console.log('[Verify] Body:', { razorpay_order_id, razorpay_payment_id, userId })

        // 2. Fetch Order Details from Razorpay to get "coins" from notes
        // This is safer than trusting the frontend's "coins" value
        const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`
        const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
            headers: { 'Authorization': authHeader }
        })

        if (!orderResponse.ok) {
            throw new Error('Failed to fetch order details from Razorpay')
        }

        const orderData = await orderResponse.json()
        const coins = Number(orderData.notes?.coins || 0)
        const type = orderData.notes?.type || 'coins'
        const noteUserId = orderData.notes?.userId

        console.log('[Verify] Order Details:', { coins, type, noteUserId })

        if (noteUserId !== userId) {
            throw new Error('User ID mismatch between order and request')
        }

        // 3. Verify Signature
        // Signature = hmac_sha256(orderId + "|" + paymentId, secret)
        const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;
        console.log('[Verify] Signing Payload Trace:', signaturePayload);

        const encoder = new TextEncoder()
        const keyData = encoder.encode(RAZORPAY_KEY_SECRET)
        const msgData = encoder.encode(signaturePayload)

        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        )
        const signed = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
        const hashArray = Array.from(new Uint8Array(signed))
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        console.log('[Verify] Expected Signature generated (len):', expectedSignature.length);

        if (expectedSignature !== razorpay_signature) {
            console.error('[Verify] Signature Mismatch!', {
                expected: expectedSignature,
                received: razorpay_signature
            })
            return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401
            })
        }

        // 4. Signature is Valid -> Credit Wallet
        // We reuse the atomic RPC. It handles idempotency (if webhook arrives first)
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        let rpcName = 'admin_process_payment_webhook'
        let rpcArgs: any = {
            p_event_id: razorpay_payment_id,
            p_user_id: userId,
            p_amount: coins,
            p_order_id: razorpay_order_id,
            p_raw_event: { source: 'direct_verification', payment_id: razorpay_payment_id, order: orderData }
        }

        if (type === 'premium') {
            rpcName = 'admin_activate_premium'
            rpcArgs = {
                p_event_id: razorpay_payment_id,
                p_user_id: userId,
                p_order_id: razorpay_order_id,
                p_raw_event: { source: 'direct_verification', payment_id: razorpay_payment_id, order: orderData }
            }
        }

        console.log(`[Verify] Calling RPC: ${rpcName}`, rpcArgs);
        const { data, error } = await supabase.rpc(rpcName, rpcArgs)

        if (error) {
            console.error('[Verify] RPC Error:', error)
            throw error
        }

        console.log('[Verify] Success:', data)

        return new Response(JSON.stringify({ success: true, data }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err) {
        console.error('[Verify] Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})
