import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { amount, currency, receipt, userId, coins } = await req.json()

        // Validate inputs
        if (!amount || !currency) {
            throw new Error('Missing required fields: amount or currency')
        }

        const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
        const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')

        if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
            throw new Error('Server misconfiguration: Razorpay keys not found')
        }

        // Create Basic Auth Header
        const authHeader = `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`

        // Call Razorpay API
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                amount: amount * 100, // Razorpay expects amount in paise (sub-unit)
                currency: currency,
                receipt: receipt,
                payment_capture: 1, // Auto-capture
                notes: {
                    userId: userId,
                    coins: coins // Pass coin count for webhook to credit
                }
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('Razorpay API Error:', data);
            throw new Error(data.error?.description || 'Failed to create Razorpay order')
        }

        // Return the Order ID and details to the client
        return new Response(
            JSON.stringify(data),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        console.error('Edge Function Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
