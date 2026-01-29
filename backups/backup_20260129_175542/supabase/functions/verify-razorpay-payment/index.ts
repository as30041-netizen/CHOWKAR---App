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

    console.log('[Verify] New Request Received');

    try {
        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')?.trim();
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')?.trim();

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            console.error('[Verify] Server misconfiguration: Razorpay keys not found in Env');
            throw new Error('Server misconfiguration: Razorpay keys not found')
        }

        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, userId } = await req.json()
        console.log('[Verify] Processing Payment:', { razorpay_order_id, razorpay_payment_id, userId })

        // 2. Fetch Order Details from Razorpay to get "coins" from notes
        // This is safer than trusting the frontend's "coins" value
        const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`
        const orderResponse = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
            headers: { 'Authorization': authHeader }
        })

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            console.error('[Verify] Razorpay Order Fetch Error:', errorData);
            throw new Error('Failed to fetch order details from Razorpay')
        }

        const orderData = await orderResponse.json()
        const amount = Number(orderData.amount || 0)
        const coins = Number(orderData.notes?.coins || 0)
        const type = orderData.notes?.type || 'coins'
        const noteUserId = orderData.notes?.userId

        // Robust Plan Detection: Use Amount as the primary source of truth for premium
        let planId = orderData.notes?.planId;

        if (type === 'premium') {
            if (amount >= 12000) planId = 'SUPER';
            else if (amount >= 9000) planId = 'PRO_POSTER';
            else if (amount >= 4000) planId = 'WORKER_PLUS';
            else planId = planId || 'WORKER_PLUS';
        }

        console.log('[Verify] Order Metadata:', { amount, planId, type, noteUserId })

        if (noteUserId && noteUserId !== userId) {
            console.warn('[Verify] User ID mismatch', { noteUserId, userId });
            // We proceed with userId from notes if available for consistency
        }

        // 3. Verify Signature
        // Signature = hmac_sha256(orderId + "|" + paymentId, secret)
        const signaturePayload = `${razorpay_order_id}|${razorpay_payment_id}`;

        const encoder = new TextEncoder()
        const keyData = encoder.encode(RAZORPAY_KEY_SECRET)
        const msgData = encoder.encode(signaturePayload)

        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        )
        const signed = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
        const hashArray = Array.from(new Uint8Array(signed))
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        if (expectedSignature !== razorpay_signature) {
            console.error('[Verify] Signature Mismatch!');
            return new Response(JSON.stringify({
                error: 'Invalid payment signature',
                details: 'The payment signature provided by the client does not match the server-calculated signature.',
                debug: {
                    received: razorpay_signature?.substring(0, 5) + '...',
                    hasSecret: !!RAZORPAY_KEY_SECRET,
                    secretLen: RAZORPAY_KEY_SECRET?.length
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403 // Use 403 Forbidden to distinguish from Supabase Gateway 401
            })
        }

        // 4. Signature is Valid -> Update Subscription using unified service
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabaseClient = createClient(supabaseUrl, supabaseKey)

        let result;

        if (type === 'premium') {
            // Use new unified subscription service
            console.log(`[Verify] Calling update_user_subscription for plan: ${planId}`);
            const { data, error } = await supabaseClient.rpc('update_user_subscription', {
                p_user_id: userId,
                p_new_plan: planId,
                p_source: 'PAYMENT',
                p_duration_days: 30,
                p_metadata: {
                    payment_id: razorpay_payment_id,
                    order_id: razorpay_order_id,
                    amount: orderData.amount,
                    currency: orderData.currency,
                    verified_by: 'verify-razorpay-payment'
                }
            });

            if (error) {
                console.error('[Verify] Subscription Update Error:', error)
                throw error
            }

            result = data;
        } else {
            // Wallet/coins flow (existing logic)
            console.log(`[Verify] Processing coin purchase: ${coins}`);
            const { data, error } = await supabaseClient.rpc('admin_process_payment_webhook', {
                p_event_id: razorpay_payment_id,
                p_user_id: userId,
                p_amount: coins,
                p_order_id: razorpay_order_id,
                p_raw_event: { source: 'direct_verification', payment_id: razorpay_payment_id, order: orderData }
            });

            if (error) {
                console.error('[Verify] Wallet RPC Error:', error)
                throw error
            }

            result = data;
        }

        console.log('[Verify] Payment processed successfully:', result)

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (err) {
        console.error('[Verify] Error Trace:', err.message)
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
        })
    }
})

