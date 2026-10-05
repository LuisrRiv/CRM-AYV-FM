import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// SHA-256 hashing required by Meta Conversions API
async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(value.trim().toLowerCase())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Clean and normalize phone number for Meta (E.164 without '+')
function cleanPhone(rawPhone: string): string {
  let cleaned = rawPhone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    cleaned = '52' + cleaned // Add Mexico country code if 10 digits
  } else if (cleaned.startsWith('521') && cleaned.length === 13) {
    cleaned = '52' + cleaned.substring(3) // Normalize 521 to 52
  }
  return cleaned
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { 
      phone, 
      name, 
      email, 
      stage, 
      eventName, 
      value, 
      currency = 'MXN', 
      leadId,
      testEventCode 
    } = body

    if (!phone && !email) {
      return new Response(JSON.stringify({ error: 'Se requiere al menos un teléfono o correo electrónico para la atribución en Meta.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Dataset ID and Access Token from Environment or defaults
    const datasetId = Deno.env.get('META_DATASET_ID') || '1761413277793954'
    const accessToken = Deno.env.get('META_ACCESS_TOKEN') || 'EAAKOniz5arsBSj66oDBnC88xysA6BWkzqe1p84mIZC8NwbT5yFjAFCo3XpfbF7ubtPg4ZBpgQdFO3SBrHyhTKVOMJ5ckh3WeIoTZAFqrfSKjZC5AsZCtZADaE3higjdlabZCZCLys8kY5dP7dNZCAzettSDRv5mTNH2tF9MpRt26XWWydk6j0Wsbz7ZA2bPj11eQZDZD'

    // Determine Meta Standard Event Name based on CRM stage or explicit eventName
    let resolvedEvent = eventName
    if (!resolvedEvent) {
      const upperStage = (stage || '').toUpperCase()
      if (upperStage === 'CITA') {
        resolvedEvent = 'Schedule'
      } else if (upperStage === 'DISPERSADO') {
        resolvedEvent = 'Purchase'
      } else if (upperStage === 'EN PROCESO') {
        resolvedEvent = 'Lead'
      } else {
        resolvedEvent = 'Contact'
      }
    }

    // Prepare hashed user data
    const userData: Record<string, any> = {}

    if (phone) {
      const normalizedPhone = cleanPhone(phone)
      if (normalizedPhone) {
        userData.ph = [await sha256(normalizedPhone)]
      }
    }

    if (email) {
      userData.em = [await sha256(email)]
    }

    if (name && typeof name === 'string') {
      const parts = name.trim().split(/\s+/)
      if (parts[0]) {
        userData.fn = [await sha256(parts[0])]
      }
      if (parts.length > 1) {
        userData.ln = [await sha256(parts.slice(1).join(' '))]
      }
    }

    // Build event object
    const eventTime = Math.floor(Date.now() / 1000)
    const eventPayload: Record<string, any> = {
      event_name: resolvedEvent,
      event_time: eventTime,
      action_source: 'system_generated',
      user_data: userData,
      custom_data: {
        currency: currency,
        value: typeof value === 'number' ? value : (resolvedEvent === 'Purchase' ? 10000 : 0),
        crm_stage: stage || '',
        lead_id: leadId ? String(leadId) : undefined
      }
    }

    const metaBody: Record<string, any> = {
      data: [eventPayload]
    }

    // If testing code is provided, include it so it shows in the "Test Events" tab of Meta
    const activeTestCode = testEventCode || Deno.env.get('META_TEST_EVENT_CODE')
    if (activeTestCode) {
      metaBody.test_event_code = activeTestCode
    }

    console.log(`[Meta CAPI] Enviando evento '${resolvedEvent}' para lead stage '${stage}' a dataset ${datasetId}`)

    // Call Meta Graph API
    const metaApiUrl = `https://graph.facebook.com/v20.0/${datasetId}/events?access_token=${encodeURIComponent(accessToken)}`
    const metaResponse = await fetch(metaApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metaBody)
    })

    const metaResult = await metaResponse.json()

    if (!metaResponse.ok) {
      console.error('[Meta CAPI Error]:', metaResult)
      return new Response(JSON.stringify({ 
        success: false, 
        error: metaResult.error?.message || 'Error al enviar evento a Meta',
        details: metaResult
      }), {
        status: metaResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('[Meta CAPI Success]:', metaResult)
    return new Response(JSON.stringify({ 
      success: true, 
      event: resolvedEvent,
      events_received: metaResult.events_received,
      data: metaResult 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error('[Meta CAPI Exception]:', err)
    return new Response(JSON.stringify({ error: err.message || 'Error inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
