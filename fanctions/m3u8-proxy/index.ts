import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // مدیریت درخواست‌های OPTIONS برای CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // گرفتن URL اصلی از پارامتر کوئری (مثال: ?url=https://example.com/video.m3u8)
    const urlObj = new URL(req.url)
    const targetUrl = urlObj.searchParams.get('url')

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing "url" parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // واکشی فایل m3u8 اصلی
    const response = await fetch(targetUrl)
    const m3u8Content = await response.text()

    // بازگرداندن محتوا با هدر مناسب استریم ویدیو
    return new Response(m3u8Content, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-mpegURL',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

