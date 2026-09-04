require('dotenv').config();
const express=require('express');
const session=require('express-session');
const path=require('path');
const crypto=require('crypto');
const {Pool}=require('pg');
const {createClient}=require('@supabase/supabase-js');
const WebSocket=require('ws');

const app=express();
const PORT=Number(process.env.PORT)||10000;
const isProduction=process.env.NODE_ENV==='production';
const DATABASE_URL=process.env.DATABASE_URL;
const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET=process.env.SUPABASE_BUCKET||'omh-uploads';
const ADMIN_PASSWORD=String(process.env.ADMIN_PASSWORD||'');
const SESSION_SECRET=process.env.SESSION_SECRET||'';

if(isProduction){
  const missing=[];
  if(!DATABASE_URL)missing.push('DATABASE_URL');
  if(!SUPABASE_URL)missing.push('SUPABASE_URL');
  if(!SUPABASE_SERVICE_ROLE_KEY)missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if(ADMIN_PASSWORD.length<12)missing.push('ADMIN_PASSWORD (12+ chars)');
  if(SESSION_SECRET.length<32)missing.push('SESSION_SECRET (32+ chars)');
  if(missing.length){console.error('Missing/invalid production environment variables:',missing.join(', '));process.exit(1);}
}

const pool=new Pool({connectionString:DATABASE_URL||'postgres://localhost/omh',ssl:DATABASE_URL?{rejectUnauthorized:false}:false,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
const supabase=(SUPABASE_URL&&SUPABASE_SERVICE_ROLE_KEY)?createClient(SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},realtime:{transport:WebSocket}}):null;

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(express.json({limit:'8mb'}));
app.use(express.urlencoded({extended:true,limit:'8mb'}));
app.use(express.static(path.join(__dirname,'public'),{etag:false,lastModified:false,maxAge:0}));
app.use(session({secret:SESSION_SECRET||'development-only-secret-change-me',resave:false,saveUninitialized:false,proxy:true,cookie:{secure:'auto',httpOnly:true,sameSite:'lax',maxAge:86400000}}));

function requireAdmin(req,res,next){if(req.session?.isAdmin)return next();return res.status(401).json({error:'Unauthorized'});}
function clientIp(req){return String(req.ip||req.headers['x-forwarded-for']||'unknown').split(',')[0].trim();}
function cleanText(v,max=5000){return String(v??'').trim().slice(0,max);}
function requireFields(body,fields){for(const f of fields)if(!cleanText(body?.[f]))return f;return null;}
function int(v,def=0){const n=Number.parseInt(v,10);return Number.isFinite(n)?n:def;}
function validStatus(v){return v==='inactive'?'inactive':'active';}
function validImageDataUrl(v){return typeof v==='string'&&/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<=6*1024*1024;}
function detectImage(b){if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return ['png','image/png'];if(b.length>=3&&b.subarray(0,3).equals(Buffer.from([255,216,255])))return ['jpg','image/jpeg'];if(b.length>=6&&['GIF87a','GIF89a'].includes(b.toString('ascii',0,6)))return ['gif','image/gif'];if(b.length>=12&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return ['webp','image/webp'];return null;}
async function q(text,params=[]){return pool.query(text,params);}
async function one(text,params=[]){const r=await q(text,params);return r.rows[0]||null;}

async function init(){
  await q(`CREATE TABLE IF NOT EXISTS categories(id BIGSERIAL PRIMARY KEY,name TEXT NOT NULL,icon_url TEXT DEFAULT '',description TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'active',display_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS subcategories(id BIGSERIAL PRIMARY KEY,category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,name TEXT NOT NULL,icon_url TEXT DEFAULT '',description TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'active',display_order INTEGER NOT NULL DEFAULT 0,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS services(id BIGSERIAL PRIMARY KEY,category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,subcategory_id BIGINT REFERENCES subcategories(id) ON DELETE CASCADE,title TEXT NOT NULL,description TEXT DEFAULT '',price TEXT DEFAULT '',unit TEXT DEFAULT '',image_url TEXT DEFAULT '',icon_url TEXT DEFAULT '',status TEXT NOT NULL DEFAULT 'active',display_order INTEGER NOT NULL DEFAULT 0,category TEXT DEFAULT '',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS announcements(id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL,start_date TIMESTAMPTZ,end_date TIMESTAMPTZ,status TEXT NOT NULL DEFAULT 'active',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS reviews(id BIGSERIAL PRIMARY KEY,customer_name TEXT NOT NULL,content TEXT NOT NULL,avatar TEXT,status TEXT NOT NULL DEFAULT 'pending',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await q(`CREATE TABLE IF NOT EXISTS contact_settings(id BIGSERIAL PRIMARY KEY,whatsapp_url TEXT DEFAULT '',telegram_url TEXT DEFAULT '',telegram_channel TEXT DEFAULT '',whatsapp_channel TEXT DEFAULT '',brand_name TEXT DEFAULT 'OMH Social Services',brand_subtitle TEXT DEFAULT 'مرجع خدمات نوین دیجیتال',logo_url TEXT DEFAULT '/images/logo.png',hero_title TEXT DEFAULT '',hero_description TEXT DEFAULT '',about_text TEXT DEFAULT '',updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const cs=await one('SELECT id FROM contact_settings ORDER BY id LIMIT 1');
  if(!cs)await q(`INSERT INTO contact_settings(whatsapp_url,telegram_url,telegram_channel,whatsapp_channel,hero_title,hero_description,about_text) VALUES($1,$2,$3,$4,$5,$6,$7)`,['https://wa.me/93748070273','https://t.me/omhsocial','https://t.me/OMHSocialServices','https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O','حضور دیجیتال خود را به سطح بالاتری ببرید','خدمات شبکه‌های اجتماعی، طراحی وب‌سایت، اپلیکیشن و خدمات دیجیتال با ظاهر حرفه‌ای و مدرن.','کیفیت، اعتبار، سرعت و رضایت مشتری اولویت اصلی ماست.']);
  const count=await one('SELECT COUNT(*)::int AS n FROM categories');
  if(!count?.n){for(const [i,n] of ['Facebook','Instagram','WhatsApp','Telegram','TikTok'].entries())await q('INSERT INTO categories(name,display_order) VALUES($1,$2)',[n,i]);}
  if(supabase){try{const {data}=await supabase.storage.getBucket(BUCKET);if(!data){await supabase.storage.createBucket(BUCKET,{public:true,fileSizeLimit:4194304,allowedMimeTypes:['image/png','image/jpeg','image/webp','image/gif']});}}catch(e){console.warn('Storage bucket check:',e.message);}}
}

const loginAttempts=new Map();
app.post('/api/admin/login',async(req,res)=>{try{const password=String(req.body?.password||'');const ip=clientIp(req),now=Date.now(),a=loginAttempts.get(ip)||{count:0,until:0};if(a.until>now)return res.status(429).json({error:'تلاش‌های ورود زیاد است. چند دقیقه بعد دوباره کوشش کنید.'});if(!password)return res.status(400).json({error:'Password required'});if(password!==ADMIN_PASSWORD){a.count++;if(a.count>=5){a.count=0;a.until=now+10*60*1000;}loginAttempts.set(ip,a);return res.status(401).json({error:'Invalid password'});}loginAttempts.delete(ip);await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));req.session.isAdmin=true;await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));res.json({success:true});}catch(e){console.error(e);res.status(500).json({error:'Login server error'});}});
app.post('/api/admin/logout',(req,res)=>req.session.destroy(()=>res.json({success:true})));
app.get('/api/admin/check',(req,res)=>res.json({isAdmin:!!req.session?.isAdmin}));
app.get('/healthz',async(req,res)=>{try{await one('SELECT 1');res.status(200).json({ok:true,database:true,storage:!!supabase});}catch(e){res.status(503).json({ok:false,database:false});}});

app.post('/api/admin/upload-image',requireAdmin,async(req,res)=>{try{if(!supabase)return res.status(503).json({error:'Storage is not configured.'});const data=String(req.body?.data||'');if(!validImageDataUrl(data))return res.status(400).json({error:'تصویر نامعتبر است. PNG/JPEG/WebP/GIF و حداکثر 4MB مجاز است.'});const raw=Buffer.from(data.split(',')[1],'base64');if(raw.length>4*1024*1024)return res.status(413).json({error:'حجم تصویر باید کمتر از 4MB باشد.'});const detected=detectImage(raw);if(!detected)return res.status(400).json({error:'محتوای فایل تصویر معتبر نیست.'});const name=`${Date.now().toString(36)}-${crypto.randomBytes(10).toString('hex')}.${detected[0]}`;const {error}=await supabase.storage.from(BUCKET).upload(name,raw,{contentType:detected[1],upsert:false,cacheControl:'31536000'});if(error)throw error;const {data:pub}=supabase.storage.from(BUCKET).getPublicUrl(name);res.json({success:true,url:pub.publicUrl,path:name});}catch(e){console.error('Image upload error:',e);res.status(500).json({error:'آپلود تصویر انجام نشد.'});}});

app.get('/api/catalog',async(req,res)=>{try{const cats=(await q(`SELECT * FROM categories WHERE status='active' ORDER BY display_order,id`)).rows;const subs=(await q(`SELECT * FROM subcategories WHERE status='active' ORDER BY display_order,id`)).rows;const sv=(await q(`SELECT * FROM services WHERE status='active' ORDER BY display_order,id`)).rows;res.json(cats.map(c=>({...c,subcategories:subs.filter(s=>String(s.category_id)===String(c.id)).map(s=>({...s,services:sv.filter(v=>String(v.subcategory_id)===String(s.id))}))})));}catch(e){console.error(e);res.status(500).json({error:'Database error'});}});
app.get('/api/categories',async(req,res)=>res.json((await q("SELECT * FROM categories WHERE status='active' ORDER BY display_order,id")).rows));
app.get('/api/categories/all',requireAdmin,async(req,res)=>res.json((await q('SELECT * FROM categories ORDER BY display_order,id')).rows));
app.post('/api/categories',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['name']))return res.status(400).json({error:'نام Category الزامی است.'});const r=await q('INSERT INTO categories(name,icon_url,description,status,display_order) VALUES($1,$2,$3,$4,$5) RETURNING id',[cleanText(req.body.name,200),cleanText(req.body.icon_url,2000),cleanText(req.body.description),validStatus(req.body.status),int(req.body.display_order)]);res.json({id:r.rows[0].id,success:true});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/categories/:id',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['name']))return res.status(400).json({error:'نام Category الزامی است.'});await q('UPDATE categories SET name=$1,icon_url=$2,description=$3,status=$4,display_order=$5 WHERE id=$6',[cleanText(req.body.name,200),cleanText(req.body.icon_url,2000),cleanText(req.body.description),validStatus(req.body.status),int(req.body.display_order),req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/categories/:id',requireAdmin,async(req,res)=>{try{await q('DELETE FROM categories WHERE id=$1',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/subcategories',async(req,res)=>res.json((await q('SELECT * FROM subcategories ORDER BY category_id,display_order,id')).rows));
app.get('/api/subcategories/all',requireAdmin,async(req,res)=>res.json((await q('SELECT * FROM subcategories ORDER BY category_id,display_order,id')).rows));
async function validHierarchy(cid,sid){return !!(await one('SELECT 1 FROM subcategories WHERE id=$1 AND category_id=$2',[sid,cid]));}
app.post('/api/subcategories',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['name','category_id']))return res.status(400).json({error:'Category و نام Subcategory الزامی است.'});if(!(await one('SELECT 1 FROM categories WHERE id=$1',[req.body.category_id])))return res.status(400).json({error:'Category معتبر نیست.'});const r=await q('INSERT INTO subcategories(category_id,name,icon_url,description,status,display_order) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[req.body.category_id,cleanText(req.body.name,200),cleanText(req.body.icon_url,2000),cleanText(req.body.description),validStatus(req.body.status),int(req.body.display_order)]);res.json({id:r.rows[0].id,success:true});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/subcategories/:id',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['name','category_id']))return res.status(400).json({error:'Category و نام Subcategory الزامی است.'});if(!(await one('SELECT 1 FROM categories WHERE id=$1',[req.body.category_id])))return res.status(400).json({error:'Category معتبر نیست.'});await q('UPDATE subcategories SET category_id=$1,name=$2,icon_url=$3,description=$4,status=$5,display_order=$6 WHERE id=$7',[req.body.category_id,cleanText(req.body.name,200),cleanText(req.body.icon_url,2000),cleanText(req.body.description),validStatus(req.body.status),int(req.body.display_order),req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/subcategories/:id',requireAdmin,async(req,res)=>{try{await q('DELETE FROM subcategories WHERE id=$1',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/services',async(req,res)=>res.json((await q(`SELECT s.*,c.name AS category_name,sc.name AS subcategory_name FROM services s LEFT JOIN categories c ON c.id=s.category_id LEFT JOIN subcategories sc ON sc.id=s.subcategory_id WHERE s.status='active' ORDER BY s.display_order,s.id`)).rows));
app.get('/api/services/all',requireAdmin,async(req,res)=>res.json((await q(`SELECT s.*,c.name AS category_name,sc.name AS subcategory_name FROM services s LEFT JOIN categories c ON c.id=s.category_id LEFT JOIN subcategories sc ON sc.id=s.subcategory_id ORDER BY c.display_order,sc.display_order,s.display_order,s.id`)).rows));
app.post('/api/services',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['title','category_id','subcategory_id']))return res.status(400).json({error:'عنوان، Category و Subcategory الزامی است.'});if(!(await validHierarchy(req.body.category_id,req.body.subcategory_id)))return res.status(400).json({error:'Category و Subcategory با هم مطابقت ندارند.'});const r=await q(`INSERT INTO services(category_id,subcategory_id,title,description,price,unit,image_url,icon_url,status,display_order,category) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,[req.body.category_id,req.body.subcategory_id,cleanText(req.body.title,300),cleanText(req.body.description),cleanText(req.body.price,100),cleanText(req.body.unit,100),cleanText(req.body.image_url,3000),cleanText(req.body.icon_url,3000),validStatus(req.body.status),int(req.body.display_order),cleanText(req.body.category,200)]);res.json({id:r.rows[0].id,success:true});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/services/:id',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['title','category_id','subcategory_id']))return res.status(400).json({error:'عنوان، Category و Subcategory الزامی است.'});if(!(await validHierarchy(req.body.category_id,req.body.subcategory_id)))return res.status(400).json({error:'Category و Subcategory با هم مطابقت ندارند.'});await q(`UPDATE services SET category_id=$1,subcategory_id=$2,title=$3,description=$4,price=$5,unit=$6,image_url=$7,icon_url=$8,status=$9,display_order=$10,category=$11,updated_at=NOW() WHERE id=$12`,[req.body.category_id,req.body.subcategory_id,cleanText(req.body.title,300),cleanText(req.body.description),cleanText(req.body.price,100),cleanText(req.body.unit,100),cleanText(req.body.image_url,3000),cleanText(req.body.icon_url,3000),validStatus(req.body.status),int(req.body.display_order),cleanText(req.body.category,200),req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/services/:id',requireAdmin,async(req,res)=>{try{await q('DELETE FROM services WHERE id=$1',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/announcements',async(req,res)=>res.json((await q(`SELECT * FROM announcements WHERE status='active' AND (start_date IS NULL OR start_date<=NOW()) AND (end_date IS NULL OR end_date>NOW()) ORDER BY created_at DESC`)).rows));
app.get('/api/announcements/all',requireAdmin,async(req,res)=>res.json((await q('SELECT * FROM announcements ORDER BY created_at DESC')).rows));
app.post('/api/announcements',requireAdmin,async(req,res)=>{try{if(requireFields(req.body,['title','content']))return res.status(400).json({error:'عنوان و متن اعلان الزامی است.'});const r=await q('INSERT INTO announcements(title,content,start_date,end_date,status) VALUES($1,$2,$3,$4,$5) RETURNING id',[cleanText(req.body.title,300),cleanText(req.body.content),req.body.start_date||null,req.body.end_date||null,validStatus(req.body.status)]);res.json({id:r.rows[0].id,success:true});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/announcements/:id',requireAdmin,async(req,res)=>{try{await q('UPDATE announcements SET title=$1,content=$2,start_date=$3,end_date=$4,status=$5,updated_at=NOW() WHERE id=$6',[cleanText(req.body.title,300),cleanText(req.body.content),req.body.start_date||null,req.body.end_date||null,validStatus(req.body.status),req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/announcements/:id',requireAdmin,async(req,res)=>{try{await q('DELETE FROM announcements WHERE id=$1',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/reviews',async(req,res)=>res.json((await q("SELECT * FROM reviews WHERE status='approved' ORDER BY created_at DESC")).rows));
app.get('/api/reviews/all',requireAdmin,async(req,res)=>res.json((await q('SELECT * FROM reviews ORDER BY created_at DESC')).rows));
app.post('/api/reviews',async(req,res)=>{try{if(requireFields(req.body,['customer_name','content']))return res.status(400).json({error:'نام و متن نظر الزامی است.'});const r=await q(`INSERT INTO reviews(customer_name,content,avatar,status) VALUES($1,$2,$3,'pending') RETURNING id`,[cleanText(req.body.customer_name,150),cleanText(req.body.content,2000),cleanText(req.body.avatar,3000)||null]);res.json({id:r.rows[0].id,success:true});}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/reviews/:id',requireAdmin,async(req,res)=>{try{await q('UPDATE reviews SET customer_name=$1,content=$2,avatar=$3,status=$4,updated_at=NOW() WHERE id=$5',[cleanText(req.body.customer_name,150),cleanText(req.body.content,2000),cleanText(req.body.avatar,3000)||null,req.body.status==='approved'?'approved':'pending',req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.delete('/api/reviews/:id',requireAdmin,async(req,res)=>{try{await q('DELETE FROM reviews WHERE id=$1',[req.params.id]);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/contact-settings',async(req,res)=>res.json(await one('SELECT * FROM contact_settings ORDER BY id DESC LIMIT 1')||{}));
app.put('/api/contact-settings',requireAdmin,async(req,res)=>{try{const keys=['whatsapp_url','telegram_url','telegram_channel','whatsapp_channel','brand_name','brand_subtitle','logo_url','hero_title','hero_description','about_text'];const vals=keys.map(k=>cleanText(req.body[k],5000));const set=keys.map((k,i)=>`${k}=$${i+1}`).join(',');await q(`UPDATE contact_settings SET ${set},updated_at=NOW() WHERE id=(SELECT id FROM contact_settings ORDER BY id DESC LIMIT 1)`,vals);res.json({success:true});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/dashboard/stats',requireAdmin,async(req,res)=>{try{const names=['categories','subcategories','services','reviews','announcements'];const out={};for(const n of names)out[n]=(await one(`SELECT COUNT(*)::int AS n FROM ${n}`)).n;out.pendingReviews=(await one("SELECT COUNT(*)::int AS n FROM reviews WHERE status='pending'")).n;res.json(out);}catch(e){res.status(500).json({error:e.message});}});

app.get('/admin',(req,res)=>res.sendFile(path.join(__dirname,'public/admin.html'),{headers:{'Cache-Control':'no-store'}}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public/index.html')));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'خطای داخلی سرور'});});

init().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`OMH Social Services running on ${PORT}`))).catch(e=>{console.error('Startup failed:',e);process.exit(1);});
