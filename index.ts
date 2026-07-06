// supabase/functions/m3u8-proxy/index.ts

// ============================================
// تنظیمات - این بخش را مطابق نیاز تغییر دهید
// ============================================
const CONFIG = {
  // آدرس سرور مبدأ (بدون اسلش انتهایی)
  TARGET_BASE_URL: "https://example.com/live/stream",
  
  // هدرهای مجاز برای ارسال به کلاینت
  ALLOWED_HEADERS: [
    "content-type",
    "content-length",
    "cache-control",
    "accept-ranges",
    "content-range",
  ],
};

// ============================================
// تابع اصلی Edge Function
// ============================================
Deno.serve(async (req: Request) => {
  try {
    // دریافت مسیر درخواستی
    const url = new URL(req.url);
    const path = url.pathname.replace("/m3u8-proxy", ""); // حذف نام تابع از مسیر
    
    // اگر مسیر خالی بود، روت اصلی را نشان بده
    const targetPath = path || "/index.m3u8";
    
    // ساخت آدرس کامل سرور مبدأ
    const targetUrl = `${CONFIG.TARGET_BASE_URL}${targetPath}`;
    
    console.log(`🔄 پراکسی کردن: ${targetUrl}`);
    
    // ارسال درخواست به سرور مبدأ
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "M3U8-Proxy/1.0",
        // می‌توانید هدرهای اضافی مثل Referer را هم اضافه کنید
        // "Referer": "https://example.com",
      },
    });
    
    // اگر پاسخ موفق نبود
    if (!response.ok) {
      return new Response(
        `خطا در دریافت محتوا از سرور مبدأ: ${response.status}`,
        { status: response.status }
      );
    }
    
    // دریافت محتوای پاسخ
    const contentType = response.headers.get("content-type") || "";
    const body = await response.arrayBuffer();
    
    // ==========================================
    // پردازش ویژه برای فایل‌های M3U8
    // ==========================================
    let finalBody = body;
    
    if (contentType.includes("application/vnd.apple.mpegurl") || 
        contentType.includes("audio/mpegurl") ||
        targetPath.endsWith(".m3u8") ||
        targetPath.endsWith(".m3u")) {
      
      // تبدیل به متن برای پردازش
      const text = new TextDecoder().decode(body);
      
      // تصحیح مسیرهای نسبی در پلی‌لیست
      // مثال: "segment_001.ts" -> "/m3u8-proxy/segment_001.ts"
      const basePath = `/m3u8-proxy/`;
      
      const processedText = text
        .split("\n")
        .map(line => {
          // خطوطی که با # شروع می‌شوند (تگ‌های M3U8) را نادیده بگیر
          if (line.startsWith("#")) return line;
          
          // خطوط خالی را نادیده بگیر
          if (!line.trim()) return line;
          
          // اگر آدرس مطلق (شامل http:// یا https://) است، تغییری نده
          if (line.includes("://")) return line;
          
          // اگر آدرس با / شروع شده، آن را به مسیر پراکسی تبدیل کن
          if (line.startsWith("/")) {
            return `${basePath}${line.substring(1)}`;
          }
          
          // در غیر این صورت (مسیر نسبی)، به مسیر پراکسی تبدیل کن
          return `${basePath}${line}`;
        })
        .join("\n");
      
      finalBody = new TextEncoder().encode(processedText);
    }
    
    // ==========================================
    // ساخت پاسخ نهایی
    // ==========================================
    const responseHeaders = new Headers();
    
    // انتقال هدرهای مجاز از سرور مبدأ
    CONFIG.ALLOWED_HEADERS.forEach(header => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });
    
    // تنظیم هدر CORS برای دسترسی از مرورگر
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    responseHeaders.set("Access-Control-Allow-Headers", "Range, Content-Type");
    
    return new Response(finalBody, {
      status: response.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error("❌ خطا:", error);
    return new Response(
      `خطای داخلی سرور: ${error.message}`,
      { status: 500 }
    );
  }
});
