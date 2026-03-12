import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { getSecurityHeaders, secureErrorResponse, secureSuccessResponse } from '../_shared/security.ts'

serve(async (req) => {
  const secureHeaders = getSecurityHeaders()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: secureHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('Token de autenticação não fornecido')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Usuário não autenticado')

    const secretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!secretKey) throw new Error('Stripe não configurado')

    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    })

    const body = await req.json().catch(() => ({}))
    const returnUrl = body?.return_url ? String(body.return_url) : null
    if (!returnUrl) throw new Error('return_url obrigatório')

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (profileError) throw profileError

    let customerId = profile?.stripe_customer_id ? String(profile.stripe_customer_id) : ''
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { supabase_user_id: user.id }
      })
      customerId = customer.id

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)

      if (updateError) throw updateError
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return secureSuccessResponse({ url: session.url })
  } catch (error) {
    return secureErrorResponse(error)
  }
})

