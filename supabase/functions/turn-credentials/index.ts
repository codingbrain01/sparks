const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = Deno.env.get('METERED_API_KEY')
  const appName = Deno.env.get('METERED_APP_NAME')

  if (!apiKey || !appName) {
    return new Response(JSON.stringify({ error: 'TURN credentials are not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const meteredRes = await fetch(
    `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
  )

  if (!meteredRes.ok) {
    return new Response(JSON.stringify({ error: 'Unable to fetch TURN credentials' }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const iceServers = await meteredRes.json()

  return new Response(JSON.stringify({ iceServers }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
