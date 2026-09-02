'use strict';
const express=require('express');
const path=require('path');
const fs=require('fs');
const session=require('express-session');
const Database=require('better-sqlite3');
const helmet=require('helmet');
const rateLimit=require('express-rate-limit');

const app=express();
const PORT=process.env.PORT||3000;
const dataDir=path.join(__dirname,'data');
fs.mkdirSync(dataDir,{recursive:true});
const db=new Database(path.join(dataDir,'omh.db'));
db.pragma('journal_mode=WAL');
db.pragma('foreign_keys=ON');

app.set('trust proxy',1);
app.disable('x-powered-by');
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:true,limit:'1mb'}));
app.use(rateLimit({windowMs:15*60*1000,max:300,standardHeaders:true,legacyHeaders:false}));
app.use(session({
  secret:process.env.SESSION_SECRET||'dev-only-change-this-secret',
  resave:false,saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:1000*60*60*12}
}));

app.use(express.static(path.join(__dirname,'public'),{extensions:['html']}));

db.exec(`
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS services(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 category TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
 unit TEXT NOT NULL DEFAULT 'AFN', price TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT '✨',
 image TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,rating INTEGER NOT NULL DEFAULT 5,
 comment TEXT NOT NULL,approved INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,service TEXT NOT NULL DEFAULT '',quantity TEXT NOT NULL DEFAULT '',
 contact TEXT NOT NULL,message TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements(
 id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, expires_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const defaults={
 brand:'OMH Social Services',tagline:'مرجع خدمات نوین دیجیتال',
 description:'بهترین و سریع‌ترین خدمات دیجیتال با تمرکز بر کیفیت، اعتبار و امنیت.',
 heroTitle:'حضور دیجیتال خود را به سطح بالاتری ببرید',
 heroText:'خدمات شبکه‌های اجتماعی، شماره‌های مجازی، اکانت‌های قدیمی و طراحی دیجیتال؛ همه در یک مرجع.',
 aboutTitle:'چرا OMH Social Services؟',
 aboutText:'کیفیت، اعتبار، سرعت و رضایت مشتری اولویت اصلی ماست. خدمات و اطلاعات سایت از پنل مدیریت کاملاً قابل تغییر است.',
 whatsapp:'93748070273',
 whatsappChannel:'https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O',
 whatsappGroup:'https://chat.whatsapp.com/LhwXxaXGEy5F4pq0GdqV5s?s=cl&p=a&ilr=0',
 telegramChannel:'https://t.me/OMHSocialServices',telegram:'@omhsocial',
 email:'omhsocialservices@gmail.com',payment:'کریدیت و مومو'
};
for(const [k,v] of Object.entries(defaults)) db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)').run(k,v);

const starterCats=['Facebook Service','Instagram Service','WhatsApp Service','Telegram Service','TikTok Service','Virtual Numbers','Accounts','Digital & Design Services'];
const catInsert=db.prepare('INSERT INTO services(category,name,description,unit,price,icon,active,sort) VALUES(?,?,?,?,?,?,?,?)');
for(const c of starterCats){if(!db.prepare('SELECT 1 FROM services WHERE category=? LIMIT 1').get(c))catInsert.run(c,'','','AFN','','✨',1,0);}

function getSettings(){return Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));}
function admin(req,res,next){if(req.session.admin===true)return next();return res.status(401).json({error:'Unauthorized'});}
function clean(v,max=2000){return String(v??'').trim().slice(0,max);}

app.get('/api/public',(req,res)=>{
 const services=db.prepare('SELECT id,category,name,description,unit,price,icon,image,active,sort FROM services WHERE active=1 AND name<>\'\' ORDER BY category,sort,id').all();
 const reviews=db.prepare('SELECT id,name,rating,comment,created_at FROM reviews WHERE approved=1 ORDER BY id DESC LIMIT 20').all();
 const announcements=db.prepare('SELECT id,text,expires_at,active,created_at FROM announcements WHERE active=1 AND expires_at>datetime("now") ORDER BY id DESC').all();
 res.json({settings:getSettings(),services,reviews,announcements});
});

app.post('/api/orders',(req,res)=>{
 const name=clean(req.body.name,120),contact=clean(req.body.contact,160);
 if(!name||!contact)return res.status(400).json({error:'نام و راه ارتباطی الزامی است.'});
 const r=db.prepare('INSERT INTO orders(name,service,quantity,contact,message) VALUES(?,?,?,?,?)').run(name,clean(req.body.service,200),clean(req.body.quantity,100),contact,clean(req.body.message,2000));
 res.json({ok:true,id:r.lastInsertRowid});
});

app.post('/api/reviews',(req,res)=>{
 const name=clean(req.body.name,100),comment=clean(req.body.comment,1000),rating=Math.max(1,Math.min(5,Number(req.body.rating)||5));
 if(!name||!comment)return res.status(400).json({error:'نام و نظر الزامی است.'});
 db.prepare('INSERT INTO reviews(name,rating,comment,approved) VALUES(?,?,?,0)').run(name,rating,comment);
 res.json({ok:true,message:'نظر شما ثبت شد و پس از بررسی نمایش داده می‌شود.'});
});

app.post('/api/login',(req,res)=>{
 const password=String(req.body.password||'');
 const expected=process.env.ADMIN_PASSWORD;
 if(!expected)return res.status(500).json({error:'ADMIN_PASSWORD در Render تنظیم نشده است.'});
 if(password!==expected)return res.status(401).json({error:'رمز نادرست است.'});
 req.session.admin=true;res.json({ok:true});
});
app.post('/api/logout',admin,(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get('/api/admin',admin,(req,res)=>{
 res.json({settings:getSettings(),services:db.prepare('SELECT * FROM services ORDER BY category,sort,id').all(),reviews:db.prepare('SELECT * FROM reviews ORDER BY id DESC').all(),orders:db.prepare('SELECT * FROM orders ORDER BY id DESC').all(),announcements:db.prepare('SELECT * FROM announcements ORDER BY id DESC').all()});
});

app.put('/api/settings',admin,(req,res)=>{
 const q=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
 const tx=db.transaction(obj=>{for(const [k,v] of Object.entries(obj||{})){if(/^[a-zA-Z][a-zA-Z0-9_]*$/.test(k))q.run(k,clean(v,5000));}});
 tx(req.body);res.json({ok:true});
});

app.post('/api/services',admin,(req,res)=>{
 const category=clean(req.body.category,120);if(!category)return res.status(400).json({error:'نام بخش الزامی است.'});
 const r=db.prepare('INSERT INTO services(category,name,description,unit,price,icon,image,active,sort) VALUES(?,?,?,?,?,?,?,?,?)').run(category,clean(req.body.name,160),clean(req.body.description,1000),clean(req.body.unit,30)||'AFN',clean(req.body.price,100),clean(req.body.icon,30)||'✨',clean(req.body.image,1000),req.body.active===false?0:1,Number(req.body.sort)||0);
 res.json({ok:true,id:r.lastInsertRowid});
});
app.put('/api/services/:id',admin,(req,res)=>{
 const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({error:'شناسه نامعتبر است.'});
 db.prepare('UPDATE services SET category=?,name=?,description=?,unit=?,price=?,icon=?,image=?,active=?,sort=? WHERE id=?').run(
  clean(req.body.category,120),clean(req.body.name,160),clean(req.body.description,1000),clean(req.body.unit,30)||'AFN',clean(req.body.price,100),clean(req.body.icon,30)||'✨',clean(req.body.image,1000),req.body.active?1:0,Number(req.body.sort)||0,id);
 res.json({ok:true});
});
app.delete('/api/services/:id',admin,(req,res)=>{db.prepare('DELETE FROM services WHERE id=?').run(Number(req.params.id));res.json({ok:true})});
app.post('/api/categories',admin,(req,res)=>{const c=clean(req.body.category,120);if(!c)return res.status(400).json({error:'نام بخش الزامی است.'});catInsert.run(c,'','','AFN','','✨',1,0);res.json({ok:true});});
app.delete('/api/categories/:category',admin,(req,res)=>{db.prepare('DELETE FROM services WHERE category=?').run(clean(req.params.category,120));res.json({ok:true})});

app.put('/api/reviews/:id',admin,(req,res)=>{db.prepare('UPDATE reviews SET approved=? WHERE id=?').run(req.body.approved?1:0,Number(req.params.id));res.json({ok:true})});
app.delete('/api/reviews/:id',admin,(req,res)=>{db.prepare('DELETE FROM reviews WHERE id=?').run(Number(req.params.id));res.json({ok:true})});
app.put('/api/orders/:id',admin,(req,res)=>{const allowed=['new','processing','done','cancelled'];const s=allowed.includes(req.body.status)?req.body.status:'new';db.prepare('UPDATE orders SET status=? WHERE id=?').run(s,Number(req.params.id));res.json({ok:true})});
app.delete('/api/orders/:id',admin,(req,res)=>{db.prepare('DELETE FROM orders WHERE id=?').run(Number(req.params.id));res.json({ok:true})});

app.post('/api/announcements',admin,(req,res)=>{const text=clean(req.body.text,500);if(!text)return res.status(400).json({error:'متن اعلان الزامی است.'});let expires=String(req.body.expires_at||'').trim();const d=new Date(expires);if(!expires||Number.isNaN(d.getTime()))return res.status(400).json({error:'زمان پایان اعلان نامعتبر است.'});db.prepare('INSERT INTO announcements(text,expires_at,active) VALUES(?,?,?)').run(text,d.toISOString(),req.body.active===false?0:1);res.json({ok:true})});
app.put('/api/announcements/:id',admin,(req,res)=>{const id=Number(req.params.id),text=clean(req.body.text,500),d=new Date(String(req.body.expires_at||''));if(!text||Number.isNaN(d.getTime()))return res.status(400).json({error:'اطلاعات اعلان نامعتبر است.'});db.prepare('UPDATE announcements SET text=?,expires_at=?,active=? WHERE id=?').run(text,d.toISOString(),req.body.active?1:0,id);res.json({ok:true})});
app.delete('/api/announcements/:id',admin,(req,res)=>{db.prepare('DELETE FROM announcements WHERE id=?').run(Number(req.params.id));res.json({ok:true})});

app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public','admin.html')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`OMH Social Services running on ${PORT}`));
