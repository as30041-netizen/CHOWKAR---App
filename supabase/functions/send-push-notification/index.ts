import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface PushPayload {
    userId: string
    title: string
    body: string
    data?: Record<string, string>
}

serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })
    }

    try {
        const payload: PushPayload = await req.json()
        const { userId, title, body, data } = payload

        if (!userId || !title || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Get user's push token from database
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('push_token')
            .eq('id', userId)
            .single()

        if (profileError) {
            console.error('Error fetching profile:', profileError)
            return new Response(
                JSON.stringify({ error: 'User not found', details: profileError }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
        }

        if (!profile?.push_token) {
            console.log('User has no push token:', userId)
            return new Response(
                JSON.stringify({ error: 'User has no push token registered' }),
                { status: 404, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // Send push notification via FCM
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify({
                to: profile.push_token,
                notification: {
                    title,
                    body,
                    sound: 'default',
                    badge: '1',
                },
                data: data || {},
                priority: 'high',
            }),
        })

        const fcmResult = await fcmResponse.json()
        console.log('FCM Response:', fcmResult)

        // Check if token is invalid and remove it
        if (fcmResult.failure === 1 && fcmResult.results?.[0]?.error === 'NotRegistered') {
            console.log('Removing invalid push token for user:', userId)
            await supabase
                .from('profiles')
                .update({ push_token: null })
                .eq('id', userId)
        }

        return new Response(
            JSON.stringify({ success: true, fcm: fcmResult }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
