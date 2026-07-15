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
    const { phone, message } = await req.json()

    if (!phone) {
      return new Response(JSON.stringify({ error: 'El número telefónico es requerido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!message) {
      return new Response(JSON.stringify({ error: 'El contenido del mensaje es requerido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const wasapiApiKey = Deno.env.get('WASAPI_API_KEY')
    const wasapiFromId = Deno.env.get('WASAPI_FROM_ID')

    if (!wasapiApiKey) {
      return new Response(JSON.stringify({ error: 'La variable de entorno WASAPI_API_KEY no está configurada en Supabase.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Format phone: keep only digits
    let cleanedPhone = phone.replace(/\D/g, '')
    if (cleanedPhone.length === 10) {
      cleanedPhone = '52' + cleanedPhone // Default Mexico prefix if it's 10 digits
    }

    // Prepare body for Wasapi
    const body: Record<string, any> = {
      wa_id: cleanedPhone,
      message: message
    }

    if (wasapiFromId) {
      body.from_id = parseInt(wasapiFromId, 10)
    }

    console.log(`Enviando mensaje vía Wasapi a: ${cleanedPhone}`)

    const response = await fetch('https://api-ws.wasapi.io/api/v1/whatsapp-messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${wasapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error('Respuesta de error de Wasapi:', responseData)
      return new Response(JSON.stringify({ error: responseData.message || 'Error en la API de Wasapi' }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ success: true, data: responseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error en Edge Function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
