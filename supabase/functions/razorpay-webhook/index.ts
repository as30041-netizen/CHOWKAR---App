import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
    console.log('[Webhook] Request received:', req.method);

    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    try {
        const signature = req.headers.get('x-razorpay-signature')
        const eventId = req.headers.get('x-razorpay-event-id')
        const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
        const bodyText = await req.text()

        console.log('[Webhook] Event ID:', eventId);
        console.log('[Webhook] Signature present:', !!signature);
        console.log('[Webhook] Secret present:', !!secret);

        if (!signature || !secret || !eventId) {
            console.error('[Webhook] Missing required headers or configuration');
            return new Response('Configuration Error or Missing Header', { status: 500 })
        }

        // 3. Verify Signature
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
            console.error('[Webhook] Invalid Signature. Expected:', expectedSignature, 'Got:', signature);
            // In development, you might want to bypass signature check, but for production it MUST stay.
            return new Response('Invalid Signature', { status: 401 })
        }

        const event = JSON.parse(bodyText)
        console.log(`[Webhook] Processing Event: ${event.event}`);

        // Handle ONLY order.paid to prevent double-crediting (payment.captured is redundant for this flow)
        if (event.event === 'order.paid') {
            const payload = event.payload;
            const order = payload.order?.entity;
            const payment = payload.payment?.entity;

            // Extract notes from either order or payment
            const notes = order?.notes || payment?.notes;
            const userId = notes?.userId;
            const type = notes?.type || 'coins';
            const coins = notes?.coins ? Number(notes.coins) : 0;

            console.log('[Webhook] Extracted Metadata:', { userId, type, coins, orderId: order?.id, paymentId: payment?.id });

            if (userId && coins > 0) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseKey)

                let rpcName = 'admin_process_payment_webhook'
                let rpcArgs: any = {
                    p_event_id: eventId,
                    p_user_id: userId,
                    p_amount: coins,
                    p_order_id: order?.id || payment?.order_id || 'unknown',
                    p_raw_event: event
                }

                if (type === 'premium') {
                    rpcName = 'admin_activate_premium'
                    rpcArgs = {
                        p_event_id: eventId,
                        p_user_id: userId,
                        p_order_id: order?.id || payment?.order_id || 'unknown',
                        p_raw_event: event
                    }
                }

                console.log(`[Webhook] Calling RPC: ${rpcName}`, rpcArgs);
                const { data, error } = await supabase.rpc(rpcName, rpcArgs)

                if (error) {
                    console.error('[Webhook] RPC Error:', error);
                    return new Response('Internal Server Error', { status: 500 })
                }

                console.log('[Webhook] Success:', data)
            } else {
                console.warn('[Webhook] Missing userId or coins in metadata', { userId, coins });
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200
        })

    } catch (err) {
        console.error('[Webhook] Runtime Error:', err.message)
        return new Response(`Error: ${err.message}`, { status: 400 })
    }
})

