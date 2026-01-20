import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    try {
        const signature = req.headers.get('x-razorpay-signature')
        const eventId = req.headers.get('x-razorpay-event-id')
        const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
        const bodyText = await req.text()

        console.error(`[Webhook] Signature Received: ${signature}`);
        if (secret) {
            console.error(`[Webhook] Secret: ${secret.substring(0, 4)}...${secret.substring(secret.length - 4)} (Len: ${secret.length})`);
        } else {
            console.error('[Webhook] Secret is MISSING');
        }

        console.log('[Webhook] Request received for event:', eventId);

        if (!signature || !secret || !eventId) {
            console.error('[Webhook] Missing required headers or secret');
            return new Response('Configuration Error', { status: 500 })
        }

        // 1. Verify Signature
        const encoder = new TextEncoder()
        const keyData = encoder.encode(secret)
        const msgData = encoder.encode(bodyText)

        const cryptoKey = await crypto.subtle.importKey(
            'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
        )
        const signed = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
        const hashArray = Array.from(new Uint8Array(signed))
        const expectedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        if (expectedSignature !== signature) {
            console.error('[Webhook] Signature Mismatch!');
            return new Response('Invalid Signature', { status: 401 })
        }

        const event = JSON.parse(bodyText)
        console.log(`[Webhook] Processing event type: ${event.event}`);

        if (event.event === 'order.paid' || event.event === 'payment.captured') {
            const payload = event.payload;
            const order = payload.order?.entity;
            const payment = payload.payment?.entity;
            const notes = order?.notes || payment?.notes;

            const userId = notes?.userId;
            const coins = notes?.coins ? Number(notes.coins) : 0;
            const type = notes?.type || 'coins';

            if (userId && (coins > 0 || type === 'premium')) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseKey)

                // UNIFIED IDEMPOTENCY KEY: Prioritize payment.id for cross-function locking
                const finalEventId = payment?.id || eventId;
                console.log('[Webhook] Processing with ID:', finalEventId);

                let rpcName = 'admin_process_payment_webhook'
                let rpcArgs: any = {
                    p_event_id: finalEventId,
                    p_user_id: userId,
                    p_amount: coins,
                    p_order_id: order?.id || payment?.order_id || 'unknown',
                    p_raw_event: event
                }

                if (type === 'premium') {
                    rpcName = 'admin_activate_premium'
                    rpcArgs = {
                        p_event_id: finalEventId,
                        p_user_id: userId,
                        p_order_id: order?.id || payment?.order_id || 'unknown',
                        p_raw_event: event
                    }
                }

                console.log(`[Webhook] Calling RPC: ${rpcName}`);
                const { data, error } = await supabase.rpc(rpcName, rpcArgs)

                if (error) {
                    console.error('[Webhook] RPC Error:', error.message);
                    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
                }
                console.log('[Webhook] Balance Updated Successfully');
            } else {
                console.warn('[Webhook] Missing metadata in payload');
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200
        });

    } catch (err) {
        console.error('[Webhook] Runtime Error:', err.message)
        return new Response(JSON.stringify({ error: err.message }), { status: 400 })
    }
})
