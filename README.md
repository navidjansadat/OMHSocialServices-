# OMH Social Services — Render Ready

نسخه نهایی سایت OMH Social Services با پنل مدیریت.

## Deploy روی Render
1. کل پوشه را در GitHub آپلود کن.
2. در Render یک Web Service بساز یا Blueprint را از `render.yaml` استفاده کن.
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Environment Variables:
   - `SESSION_SECRET` یک مقدار طولانی و تصادفی
   - `ADMIN_PASSWORD` رمز ورود پنل، حداقل ۸ کاراکتر
6. بعد از Deploy برو به `/admin`.

## امکانات پنل
- تغییر نام و شعار سایت
- تغییر عنوان و متن صفحه اصلی
- تغییر شماره WhatsApp
- تغییر لینک کانال و گروپ WhatsApp
- تغییر Telegram و کانال Telegram
- تغییر ایمیل و روش پرداخت
- افزودن/حذف بخش خدمات
- افزودن/حذف/ویرایش هر سرویس
- تغییر قیمت، واحد، آیکن، توضیحات و ترتیب سرویس
- فعال/غیرفعال کردن سرویس
- مدیریت و تایید نظرات
- مدیریت وضعیت سفارش‌ها

نکته: اگر روی Render بدون Persistent Disk از SQLite استفاده شود، اطلاعات دیتابیس ممکن است هنگام بعضی redeploy/restartها پایدار نماند. برای داده‌های دائمی، Persistent Disk یا دیتابیس PostgreSQL توصیه می‌شود.
