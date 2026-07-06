// supabase/functions/m3u8-proxy/index.ts

// ============================================
// تابع اصلی Edge Function
// ============================================
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    
    // ==========================================
    // دریافت آدرس M3U8 از پارامتر url
    // ==========================================
    const targetUrl = url.searchParams.get("url");
    
    if (!targetUrl) {
      return new Response(
        JSON.stringify({
          error: "پارامتر url الزامی است",
          example: "/m3u8-proxy?url=https://example.com/stream.m3u8"
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    
    // اعتبارسنجی ساده آدرس
    try {
      new URL(targetUrl);
    } catch {
      return new Response(
        JSON.stringify({ error: "آدرس وارد شده معتبر نیست" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
    
    console.log(`🔄 پراکسی کردن: ${targetUrl}`);
    
    // ==========================================
    // ارسال درخواست به سرور مبدأ
    // ==========================================
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "M3U8-Proxy/1.0",
        // هدرهای اصلی درخواست کلاینت را هم ارسال کن
        ...Object.fromEntries(
          Array.from(req.headers.entries())
            .filter(([key]) => 
              ["referer", "origin", "cookie"].includes(key.toLowerCase())
            )
        ),
      },
    });
    
    if (!response.ok) {
      return new Response(
        `خطا در دریافت محتوا: ${response.status} ${response.statusText}`,
        { status: response.status }
      );
    }
    
    // ==========================================
    // دریافت محتوا و پردازش
    // ==========================================
    const contentType = response.headers.get("content-type") || "";
    const body = await response.arrayBuffer();
    let finalBody = body;
    
    // تشخیص فایل M3U8
    const isM3U8 = 
      contentType.includes("application/vnd.apple.mpegurl") ||
      contentType.includes("audio/mpegurl") ||
      targetUrl.includes(".m3u8") ||
      targetUrl.includes(".m3u");
    
    if (isM3U8) {
      const text = new TextDecoder().decode(body);
      
      // ==========================================
      // پردازش پلی‌لیست M3U8
      // ==========================================
      const baseUrl = new URL(targetUrl);
      const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf("/") + 1);
      
      const processedLines = text
        .split("\n")
        .map(line => {
          // خطوط خالی یا کامنت‌های اطلاعاتی را نگه دار
          if (!line.trim() || line.startsWith("#EXT")) {
            return line;
          }
          
          // اگر آدرس مطلق است، تغییر نده
          if (line.includes("://")) {
            return line;
          }
          
          // ساخت آدرس جدید از طریق پروکسی
          let absoluteUrl: string;
          if (line.startsWith("/")) {
            // آدرس مطلق نسبی به دامنه
            absoluteUrl = baseUrl.origin + line;
          } else {
            // آدرس نسبی
            absoluteUrl = basePath + line;
          }
          
          // تبدیل به آدرس پروکسی شده
          const proxyUrl = `/m3u8-proxy?url=${encodeURIComponent(absoluteUrl)}`;
          return proxyUrl;
        })
        .join("\n");
      
      finalBody = new TextEncoder().encode(processedLines);
    }
    
    // ==========================================
    // ساخت پاسخ نهایی
    // ==========================================
    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    });
    
    // انتقال هدرهای مفید از سرور مبدأ
    const usefulHeaders = ["content-type", "cache-control", "accept-ranges"];
    usefulHeaders.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });
    
    // اگر محتوای M3U8 است، نوع آن را به‌روزرسانی کن
    if (isM3U8) {
      responseHeaders.set("content-type", "application/vnd.apple.mpegurl");
    }
    
    return new Response(finalBody, {
      status: response.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error("❌ خطا:", error);
    return new Response(
      JSON.stringify({ 
        error: "خطای داخلی سرور", 
        details: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" }
      }
    );
  }
});

// ============================================
// پشتیبانی از درخواست OPTIONS (C
