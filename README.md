# OMH Social Services — Render Ready

سایت Dynamic و RTL برای OMH Social Services.

## اجرای محلی
```bash
npm install
ADMIN_PASSWORD="your-password" SESSION_SECRET="your-long-secret" npm start
```
سایت: `http://localhost:3000`
پنل: `http://localhost:3000/admin`

## Deploy روی Render
این پروژه فایل `render.yaml` دارد و برای Render Web Service آماده است.

1. پروژه را در GitHub داخل یک Repository جدید قرار دهید.
2. در Render گزینه **New → Blueprint** را انتخاب کنید و Repository را وصل کنید؛ یا Web Service بسازید.
3. اگر Blueprint استفاده شود، Build و Start و Persistent Disk از `render.yaml` خوانده می‌شود.
4. مقدار `ADMIN_PASSWORD` را در Render تعیین کنید (حداقل ۸ کاراکتر؛ بهتر است طولانی و تصادفی باشد).
5. `SESSION_SECRET` در Blueprint به‌صورت خودکار تولید می‌شود.
6. Persistent Disk روی مسیر `/opt/render/project/src/data` قرار می‌گیرد تا `data/omh.db` پایدار بماند.

## نکته مهم درباره Render Free
Persistent Disk روی پلن‌های پولی Render در دسترس است. اگر سرویس روی پلن Free اجرا شود، SQLite برای نگهداری دائمی داده‌ها مناسب نیست و با Restart/Deploy ممکن است داده‌ها از بین بروند. برای سفارش‌ها، نظرات و تنظیمات واقعی، از پلنی با Persistent Disk استفاده کنید یا بعداً دیتابیس PostgreSQL را جایگزین کنید.

## امکانات
- خدمات Dynamic و قابل افزودن/ویرایش/حذف
- قیمت‌های قابل تغییر از پنل
- مدیریت شماره‌ها و لینک‌های WhatsApp/Telegram
- ثبت سفارش مشتری و مدیریت وضعیت سفارش
- ثبت و تأیید/حذف نظرات مشتری
- مدیریت بخش‌ها از طریق دسته‌بندی خدمات
- طراحی RTL، Responsive و انیمیشن‌های سبک
