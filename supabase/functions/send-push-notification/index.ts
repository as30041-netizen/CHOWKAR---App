import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// FCM v1 API uses Service Account credentials
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL')
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n')

// Legacy API fallback
const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface PushPayload {
    userId: string
    title: string
    body: string
    data?: Record<string, string>
    type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
    relatedJobId?: string
    skipDb?: boolean // Add this to prevent infinite loops when called by DB trigger
}

// Generate OAuth2 access token for FCM v1 API
async function getAccessToken(): Promise<string> {
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
        throw new Error('Firebase service account credentials not configured')
    }

    // Create JWT for service account
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
        iss: FIREBASE_CLIENT_EMAIL,
        sub: FIREBASE_CLIENT_EMAIL,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
        scope: 'https://www.googleapis.com/auth/firebase.messaging'
    }

    // Encode header and payload
    const encoder = new TextEncoder()
    const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const signatureInput = `${headerB64}.${payloadB64}`

    // Import private key and sign
    const pemContents = FIREBASE_PRIVATE_KEY
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '')

    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0))

    const key = await crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    )

    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        encoder.encode(signatureInput)
    )

    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const jwt = `${signatureInput}.${signatureB64}`

    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    })

    const tokenData = await tokenResponse.json()
    if (!tokenData.access_token) {
        throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`)
    }

    return tokenData.access_token
}

// Send using FCM v1 API
async function sendWithV1API(token: string, title: string, body: string, data?: Record<string, string>) {
    const accessToken = await getAccessToken()

    const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                message: {
                    token: token,
                    notification: {
                        title,
                        body,
                    },
                    data: data || {},
                    android: {
                        priority: 'high',
                        notification: {
                            sound: 'default',
                            channelId: 'chowkar_notifications',
                        }
                    }
                }
            }),
        }
    )

    return await response.json()
}

// Send using Legacy API (fallback)
async function sendWithLegacyAPI(token: string, title: string, body: string, data?: Record<string, string>) {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({
            to: token,
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

    return await response.json()
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
        const { userId, title, body, data, type = 'INFO', relatedJobId, skipDb = false } = payload

        if (!userId || !title || !body) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: userId, title, body' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

        let dbInsertError = null

        // 1. INSERT INTO DB (Single Source of Truth)
        // Skip if requested (usually because the DB Trigger already did the insert)
        if (!skipDb) {
            const { error: insertError } = await supabase
                .from('notifications')
                .insert({
                    user_id: userId,
                    title: title,
                    message: body,
                    type: type,
                    related_job_id: relatedJobId || null,
                    read: false
                })

            if (insertError) {
                console.error('Failed to insert notification into DB:', insertError)
                dbInsertError = insertError
            } else {
                console.log('Notification saved to DB')
            }
        } else {
            console.log('Skipping DB insert (requested by skipDb flag)')
        }

        // 2. FETCH PUSH TOKEN
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
            // Even if no push token, we successfully saved to DB (which is good!)
            return new Response(
                JSON.stringify({
                    success: true,
                    message: 'Notification saved to DB, but user has no push token.'
                }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            )
        }

        // 3. SEND FCM PUSH
        let fcmResult: any
        let apiUsed: string

        // Build data object for deep linking
        const fcmData = {
            ...(data || {}),
            type: (data?.type || type || 'INFO').toString(),
            jobId: (data?.jobId || relatedJobId || '').toString(),
            click_action: 'OPEN_ACTIVITY_1' // Legacy but helpful for some background listeners
        }

        // Try v1 API first, fall back to legacy
        if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
            console.log('Using FCM v1 API', { userId, fcmData })
            apiUsed = 'v1'
            try {
                fcmResult = await sendWithV1API(profile.push_token, title, body, fcmData)
            } catch (v1Error) {
                console.error('FCM v1 API failed:', v1Error)
                if (FCM_SERVER_KEY) {
                    console.log('Falling back to Legacy API')
                    apiUsed = 'legacy'
                    fcmResult = await sendWithLegacyAPI(profile.push_token, title, body, fcmData)
                } else {
                    throw v1Error
                }
            }
        } else if (FCM_SERVER_KEY) {
            console.log('Using FCM Legacy API', { userId, fcmData })
            apiUsed = 'legacy'
            fcmResult = await sendWithLegacyAPI(profile.push_token, title, body, fcmData)
        } else {
            return new Response(
                JSON.stringify({ error: 'FCM not configured. Set FIREBASE_PROJECT_ID + credentials OR FCM_SERVER_KEY' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            )
        }

        console.log('FCM Response:', fcmResult)

        // Check if token is invalid and remove it (works for both APIs)
        const isInvalidToken =
            fcmResult.error?.code === 'messaging/invalid-registration-token' ||
            fcmResult.error?.code === 'messaging/registration-token-not-registered' ||
            (fcmResult.failure === 1 && fcmResult.results?.[0]?.error === 'NotRegistered')

        if (isInvalidToken) {
            console.log('Removing invalid push token for user:', userId)
            await supabase
                .from('profiles')
                .update({ push_token: null })
                .eq('id', userId)
        }

        return new Response(
            JSON.stringify({ success: true, apiUsed, fcm: fcmResult, dbInsert: !dbInsertError && !skipDb }),
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
