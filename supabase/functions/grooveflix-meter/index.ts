import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { getSecurityHeaders, secureErrorResponse, secureSuccessResponse } from '../_shared/security.ts'

async function getSizeBytes(url: string): Promise<number | null> {
  const head = await fetch(url, { method: 'HEAD' })
  if (head.ok) {
    const len = head.headers.get('content-length')
    if (len) {
      const n = Number(len)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  const range = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' } })
  if (!range.ok) return null
  const contentRange = range.headers.get('content-range') || range.headers.get('Content-Range')
  if (!contentRange) return null
  const m = String(contentRange).match(/\/(\d+)\s*$/)
  if (!m) return null
  const total = Number(m[1])
  if (!Number.isFinite(total) || total <= 0) return null
  return total
}

serve(async (req) => {
  const secureHeaders = getSecurityHeaders()

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: secureHeaders })
  }

  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) throw new Error('Token de autenticação não fornecido')

    const body = await req.json()
    const urlRaw = body?.url ? String(body.url) : ''
    if (!urlRaw) throw new Error('url obrigatória')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('Usuário não autenticado')

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    const status = String(profile?.subscription_status || '').toLowerCase()
    if (status !== 'trialing') {
      return secureSuccessResponse({ ok: true, status })
    }

    const bytes = await getSizeBytes(urlRaw)
    if (!bytes) {
      return secureSuccessResponse({ ok: true, status: 'trialing', used: 'unknown' })
    }

    const deltaGb = bytes / (1024 * 1024 * 1024)
    const { data, error } = await supabase.rpc('increment_trial_usage', { delta_gb: deltaGb })
    if (error) throw error

    return secureSuccessResponse({ ok: true, ...data })
  } catch (error) {
    return secureErrorResponse(error)
  }
})

