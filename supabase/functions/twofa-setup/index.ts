import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TwoFactorResponse {
  success: boolean
  secret?: string
  qrCode?: string
  backupCodes?: string[]
  error?: string
}

function generateSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  for (let i = 0; i < 16; i++) {
    secret += chars[Math.floor(Math.random() * chars.length)];
  }
  return secret;
}

function generateBackupCodes(count = 8) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    codes.push(`${code.slice(0, 3)}-${code.slice(3)}`);
  }
  return codes;
}

function base32Encode(str: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of str) {
    bits += char.charCodeAt(0).toString(2).padStart(8, '0');
  }
  let encoded = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    encoded += alphabet[parseInt(bits.slice(i, i + 5), 2)];
  }
  return encoded;
}

function generateOTPAuthURL(email: string, secret: string, issuer = 'RareGroove') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateQRCodeDataURL(data: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action, userId, code } = await req.json()

    if (action === 'generate') {
      const secret = generateSecret()
      const backupCodes = generateBackupCodes()
      
      const existing = await supabase
        .from('user_2fa')
        .select('id')
        .eq('user_id', userId || user.id)
        .single()

      if (existing.data) {
        await supabase
          .from('user_2fa')
          .update({
            secret,
            backup_codes: backupCodes,
            is_enabled: false,
            is_verified: false,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId || user.id)
      } else {
        await supabase
          .from('user_2fa')
          .insert({
            user_id: userId || user.id,
            secret,
            backup_codes: backupCodes
          })
      }

      const email = user.email || 'user@raregroove.com'
      const otpUrl = generateOTPAuthURL(email, secret)
      const qrCodeUrl = generateQRCodeDataURL(otpUrl)

      const response: TwoFactorResponse = {
        success: true,
        secret,
        qrCode: qrCodeUrl,
        backupCodes
      }

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'enable' || action === 'verify') {
      const targetUserId = userId || user.id
      
      const { data: twofaData, error: fetchError } = await supabase
        .from('user_2fa')
        .select('secret, backup_codes')
        .eq('user_id', targetUserId)
        .single()

      if (fetchError || !twofaData) {
        return new Response(
          JSON.stringify({ success: false, error: '2FA não configurado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: verifyResult } = await supabase.rpc('verify_2fa_code', {
        p_user_id: targetUserId,
        p_code: code
      })

      if (action === 'enable' && verifyResult) {
        await supabase
          .from('user_2fa')
          .update({ is_enabled: true, is_verified: true })
          .eq('user_id', targetUserId)

        return new Response(
          JSON.stringify({ success: true, message: '2FA ativado com sucesso' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (action === 'verify') {
        return new Response(
          JSON.stringify({ success: verifyResult || false, verified: verifyResult }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (action === 'disable') {
      await supabase
        .from('user_2fa')
        .update({ is_enabled: false, is_verified: false })
        .eq('user_id', user.id)

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'status') {
      const { data } = await supabase
        .from('user_2fa')
        .select('is_enabled, is_verified, created_at, last_used_at')
        .eq('user_id', user.id)
        .single()

      return new Response(
        JSON.stringify({
          success: true,
          enabled: data?.is_enabled || false,
          verified: data?.is_verified || false,
          lastUsed: data?.last_used_at
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação desconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('2FA Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
