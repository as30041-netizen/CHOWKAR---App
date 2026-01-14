import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
    // 1. Verify Request Method
    if (req.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 })
    }

    try {
        // 2. Get Headers & Body
        const signature = req.headers.get('x-razorpay-signature')
        const eventId = req.headers.get('x-razorpay-event-id') // IDEMPOTENCY KEY
        const secret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
        const bodyText = await req.text()

        if (!signature || !secret || !eventId) {
            console.error('Missing signature, secret, or event ID')
            return new Response('Configuration Error or Missing Header', { status: 500 })
        }

        // 3. Verify Signature (HMAC SHA256)
        // The library expects (hash, key, message, inputEncoding, outputEncoding)
        // Or simpler: verification based on node buffer eq

        // Manual HMAC Verification using Web Crypto API (Standard Deno way)
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
            console.error('Invalid Signature. Expected:', expectedSignature, 'Got:', signature)
            return new Response('Invalid Signature', { status: 401 })
        }

        // 4. Process Event
        const event = JSON.parse(bodyText)
        console.log(`Received Event: ${event.event} (ID: ${eventId})`)

        if (event.event === 'order.paid') {
            const { order, payment } = event.payload
            const notes = order.entity.notes
            const userId = notes?.userId
            const coins = notes?.coins ? parseInt(notes.coins) : 0

            if (userId && coins > 0) {
                const supabaseUrl = Deno.env.get('SUPABASE_URL')!
                const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
                const supabase = createClient(supabaseUrl, supabaseKey)

                // CALL IDEMPOTENT RPC
                const { data, error } = await supabase.rpc('admin_process_payment_webhook', {
                    p_event_id: eventId,
                    p_user_id: userId,
                    p_amount: coins,
                    p_order_id: order.entity.id,
                    p_raw_event: event
                })

                if (error) {
                    console.error('RPC Error:', error)
                    return new Response('Internal Server Error', { status: 500 })
                }

                console.log('Payment Process Result:', data)
            } else {
                console.error('Missing userId or coins in metadata', notes)
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { "Content-Type": "application/json" },
            status: 200
        })

    } catch (err) {
        console.error('Webhook Error:', err.message)
        return new Response(`Error: ${err.message}`, { status: 400 })
    }
})
