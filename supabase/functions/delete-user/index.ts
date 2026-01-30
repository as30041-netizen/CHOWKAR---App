import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

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
        // 1. Validate User Session
        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
        const authHeader = req.headers.get('Authorization')

        if (!authHeader) {
            throw new Error('No authorization header')
        }

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

        if (authError || !user) {
            throw new Error('Unauthorized')
        }

        const userId = user.id
        console.log(`[DeleteUser] Request initiated for user: ${userId}`)

        // 2. Perform Account Deletion (Hard Delete from Auth)
        // This will trigger cascading deletes on any tables with ON DELETE CASCADE directed at the profiles table
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.error(`[DeleteUser] Failed to delete user ${userId}:`, deleteError)
            throw deleteError
        }

        console.log(`[DeleteUser] Successfully deleted user: ${userId} and all associated data via cascade.`)

        return new Response(
            JSON.stringify({ success: true, message: 'Account deleted permanently' }),
            { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )

    } catch (error: any) {
        console.error('[DeleteUser] Error:', error.message)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
    }
})
