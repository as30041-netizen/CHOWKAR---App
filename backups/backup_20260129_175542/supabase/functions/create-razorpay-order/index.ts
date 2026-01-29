import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    console.log('[Order] Request received:', req.method);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    // PRE-WARM HANDLER
    if (req.method === 'GET') {
        return new Response(JSON.stringify({ status: 'warmed' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });
    }

    try {
        const body = await req.json();
        const { amount, currency, receipt, userId, coins, type } = body;

        console.log('[Order] Creating order for:', { userId, amount, coins, type });

        // Validate inputs
        if (!amount || !currency) {
            console.error('[Order] Missing required fields:', { amount, currency });
            throw new Error('Missing required fields: amount or currency')
        }

        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            console.error('[Order] Server misconfiguration: Razorpay keys not found in Env');
            throw new Error('Server misconfiguration: Razorpay keys not found')
        }

        // Create Basic Auth Header
        const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`

        // Call Razorpay API
        console.log('[Order] Calling Razorpay API...');
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Razorpay expects amount in paise
                currency: currency,
                receipt: receipt,
                payment_capture: 1, // Auto-capture
                notes: {
                    userId: userId,
                    coins: coins || 0,
                    type: type || 'coins',
                    planId: body.planId // Pass planId for webhook
                }
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('[Order] Razorpay API Error Status:', response.status);
            console.error('[Order] Razorpay API Error Data:', data);
            throw new Error(data.error?.description || 'Failed to create Razorpay order')
        }

        console.log('[Order] Successfully created:', data.id);

        // Return the Order ID and details to the client
        return new Response(
            JSON.stringify({ ...data, key: RAZORPAY_KEY_ID }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('[Order] Edge Function Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})

