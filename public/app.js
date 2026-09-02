// ==================== STATE ====================
let state = {
    services: [],
    categories: [],
    announcements: [],
    reviews: [],
    contactSettings: {}
};

// ==================== DOM REFERENCES ====================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ==================== API HELPERS ====================
const API = {
    async get(endpoint) {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    },
    
    async post(endpoint, data) {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }
};

// ==================== HAMBURGER MENU ====================
const hamburger = $('#hamburger');
const navMenu = $('#navMenu');

if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close menu on link click
    navMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

// ==================== HEADER SCROLL EFFECT ====================
const header = $('#header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
    lastScroll = currentScroll;
});

// ==================== ANNOUNCEMENTS ====================
async function loadAnnouncements() {
    try {
        const data = await API.get('/api/announcements');
        state.announcements = data;
        renderAnnouncements(data);
    } catch (err) {
        console.error('Error loading announcements:', err);
    }
}

function renderAnnouncements(announcements) {
    const track = $('#announcementTrack');
    if (!track) return;
    
    if (!announcements || announcements.length === 0) {
        track.innerHTML = `<span class="announcement-item">📢 خوش آمدید به OMH Social Services</span>`;
        return;
    }
    
    const html = announcements.map(a => `
        <span class="announcement-item">
            ${a.title} — ${a.content}
            ${a.end_date ? `<span class="countdown" data-end="${a.end_date}"></span>` : ''}
        </span>
    `).join('');
    
    track.innerHTML = html;
    
    // Countdown timers
    track.querySelectorAll('.countdown[data-end]').forEach(el => {
        updateCountdown(el);
        setInterval(() => updateCountdown(el), 1000);
    });
}

function updateCountdown(el) {
    const end = new Date(el.dataset.end);
    const now = new Date();
    const diff = Math.max(0, end - now);
    
    if (diff === 0) {
        el.textContent = '⏰ پایان یافته';
        return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    el.textContent = `⏱ ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ==================== SERVICES ====================
async function loadServices() {
    try {
        const data = await API.get('/api/services');
        state.services = data;
        renderServices(data);
    } catch (err) {
        console.error('Error loading services:', err);
    }
}

function renderServices(services) {
    const container = $('#servicesContainer');
    if (!container) return;
    
    if (!services || services.length === 0) {
        container.innerHTML = `
            <div class="service-card glass-card" style="grid-column: 1/-1; text-align: center; padding: 48px;">
                <p style="color: #4a6a4a; font-size: 1.1rem;">هیچ سرویسی در حال حاضر موجود نیست.</p>
            </div>
        `;
        return;
    }
    
    const html = services.map(s => {
        const iconHtml = s.icon_url 
            ? `<img src="${s.icon_url}" alt="${s.title}" />` 
            : `<i class="fas fa-cube"></i>`;
        
        return `
            <div class="service-card reveal">
                <div class="service-icon">${iconHtml}</div>
                <span class="service-category">${s.category || 'عمومی'}</span>
                <h3>${s.title}</h3>
                <p class="service-description">${s.description || ''}</p>
                ${s.price ? `<div class="service-price">${s.price}</div>` : ''}
                ${s.unit ? `<div class="service-unit">${s.unit}</div>` : ''}
                <div class="service-actions">
                    <a href="#contact" class="btn btn-primary btn-sm order-btn" data-service="${s.title}">سفارش ←</a>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Set service name on order button click
    container.querySelectorAll('.order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const serviceName = btn.dataset.service;
            const serviceInput = $('#serviceName');
            if (serviceInput) {
                serviceInput.value = serviceName;
            }
        });
    });
    
    // Reveal animations
    observeReveal();
}

// ==================== CATEGORIES ====================
async function loadCategories() {
    try {
        const data = await API.get('/api/categories');
        state.categories = data;
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

// ==================== REVIEWS ====================
async function loadReviews() {
    try {
        const data = await API.get('/api/reviews');
        state.reviews = data;
        renderReviews(data);
    } catch (err) {
        console.error('Error loading reviews:', err);
    }
}

function renderReviews(reviews) {
    const container = $('#reviewsContainer');
    if (!container) return;
    
    if (!reviews || reviews.length === 0) {
        container.innerHTML = `
            <div class="review-card glass-card" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                <p style="color: #4a6a4a;">هنوز نظری ثبت نشده است.</p>
            </div>
        `;
        return;
    }
    
    const colors = ['#2d8f4e', '#1a6b3a', '#3a9f5e', '#0a4a2a'];
    
    const html = reviews.map((r, i) => {
        const initial = r.customer_name ? r.customer_name.charAt(0) : '?';
        const color = colors[i % colors.length];
        
        const avatarHtml = r.avatar 
            ? `<img src="${r.avatar}" alt="${r.customer_name}" />` 
            : initial;
        
        return `
            <div class="review-card reveal">
                <div class="review-header">
                    <div class="review-avatar" style="background: ${color};">${avatarHtml}</div>
                    <div>
                        <div class="review-name">${r.customer_name || 'ناشناس'}</div>
                        <div class="review-date">${r.created_at ? new Date(r.created_at).toLocaleDateString('fa-IR') : ''}</div>
                    </div>
                </div>
                <p class="review-content">«${r.content || ''}»</p>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    observeReveal();
}

// ==================== CONTACT SETTINGS ====================
async function loadContactSettings() {
    try {
        const data = await API.get('/api/contact-settings');
        state.contactSettings = data;
        applyContactSettings(data);
    } catch (err) {
        console.error('Error loading contact settings:', err);
    }
}

function applyContactSettings(settings) {
    // WhatsApp link
    const whatsappLink = $('#whatsappLink');
    if (whatsappLink && settings.whatsapp_url) {
        whatsappLink.href = settings.whatsapp_url;
    }
    
    // Telegram link
    const telegramLink = $('#telegramLink');
    if (telegramLink && settings.telegram_url) {
        telegramLink.href = settings.telegram_url;
    }
    
    // Telegram channel
    const telegramChannel = $('#telegramChannel');
    if (telegramChannel && settings.telegram_channel) {
        telegramChannel.href = settings.telegram_channel;
    }
    
    // WhatsApp channel
    const whatsappChannel = $('#whatsappChannel');
    if (whatsappChannel && settings.whatsapp_channel) {
        whatsappChannel.href = settings.whatsapp_channel;
    }
    
    // Hero title
    const heroTitle = $('#heroTitle');
    if (heroTitle && settings.hero_title) {
        heroTitle.textContent = settings.hero_title;
    }
    
    // Hero description
    const heroDesc = $('#heroDescription');
    if (heroDesc && settings.hero_description) {
        heroDesc.textContent = settings.hero_description;
    }
    
    // Logo
    if (settings.logo_url) {
        document.querySelectorAll('.header-logo, .footer-logo, .orbit-logo').forEach(el => {
            if (el) el.src = settings.logo_url;
        });
    }
    
    // Brand name
    if (settings.brand_name) {
        document.querySelectorAll('.brand-title, .footer-title').forEach(el => {
            if (el) el.textContent = settings.brand_name;
        });
    }
    
    // Brand subtitle
    if (settings.brand_subtitle) {
        document.querySelectorAll('.brand-subtitle, .footer-subtitle').forEach(el => {
            if (el) el.textContent = settings.brand_subtitle;
        });
    }
}

// ==================== ORDER FORM ====================
const orderForm = $('#orderForm');
if (orderForm) {
    orderForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = $('#customerName').value.trim();
        const contact = $('#contactMethod').value.trim();
        const service = $('#serviceName').value.trim();
        const quantity = $('#quantity').value.trim();
        const link = $('#pageLink').value.trim();
        const notes = $('#orderNotes').value.trim();
        
        if (!name || !contact || !service || !quantity) {
            alert('لطفاً تمام فیلدهای ضروری را پر کنید.');
            return;
        }
        
        const message = `سلام، می‌خواهم سفارش ثبت کنم.

📋 اطلاعات سفارش:
👤 نام: ${name}
📱 راه ارتباطی: ${contact}
📦 سرویس: ${service}
🔢 تعداد: ${quantity}
🔗 لینک: ${link || 'ندارد'}
📝 توضیحات: ${notes || 'ندارد'}`;
        
        const encoded = encodeURIComponent(message);
        const settings = state.contactSettings;
        const whatsappUrl = settings.whatsapp_url || 'https://wa.me/1234567890';
        const finalUrl = whatsappUrl.includes('?') 
            ? `${whatsappUrl}&text=${encoded}`
            : `${whatsappUrl}?text=${encoded}`;
        
        window.open(finalUrl, '_blank');
        
        // Reset form
        orderForm.reset();
    });
}

// ==================== SCROLL REVEAL ====================
function observeReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    document.querySelectorAll('.reveal').forEach(el => {
        observer.observe(el);
    });
}

// ==================== FOOTER YEAR ====================
const yearEl = $('#currentYear');
if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
}

// ==================== INIT ====================
async function init() {
    try {
        await Promise.all([
            loadAnnouncements(),
            loadServices(),
            loadCategories(),
            loadReviews(),
            loadContactSettings()
        ]);
    } catch (err) {
        console.error('Init error:', err);
    }
    
    // Observe initial elements
    setTimeout(observeReveal, 100);
}

// Start app
document.addEventListener('DOMContentLoaded', init);
