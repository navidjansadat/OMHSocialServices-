require('dotenv').config();
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'omh_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      price TEXT,
      unit TEXT,
      image_url TEXT,
      icon_url TEXT,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      start_date DATETIME,
      end_date DATETIME,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      content TEXT NOT NULL,
      avatar TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      whatsapp_url TEXT,
      telegram_url TEXT,
      telegram_channel TEXT,
      whatsapp_channel TEXT,
      brand_name TEXT DEFAULT 'OMH Social Services',
      brand_subtitle TEXT DEFAULT 'مرجع خدمات نوین دیجیتال',
      logo_url TEXT DEFAULT '/images/logo.png',
      hero_title TEXT,
      hero_description TEXT,
      about_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default contact settings if empty
  db.get("SELECT COUNT(*) as count FROM contact_settings", (err, row) => {
    if (err) {
      console.error('Error checking contact settings:', err);
      return;
    }
    if (row.count === 0) {
      db.run(`
        INSERT INTO contact_settings (
          whatsapp_url,
          telegram_url,
          telegram_channel,
          whatsapp_channel,
          hero_title,
          hero_description
        ) VALUES (
          'https://wa.me/1234567890',
          'https://t.me/omhsocial',
          'https://t.me/OMHSocialServices',
          'https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O',
          'حضور دیجیتال خود را به سطح بالاتری ببرید',
          'خدمات شبکه‌های اجتماعی، طراحی وب‌سایت، اپلیکیشن، طراحی تبلیغاتی و سایر خدمات دیجیتال.'
        )
      `);
    }
  });

  // Insert default categories if empty
  db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
    if (err) {
      console.error('Error checking categories:', err);
      return;
    }
    if (row.count === 0) {
      const categories = [
        'Facebook', 'Instagram', 'WhatsApp', 'Telegram', 'TikTok', 'Web Design', 'App Development', 'Graphic Design', 'Video Production'
      ];
      categories.forEach((name, index) => {
        db.run(
          "INSERT INTO categories (name, display_order) VALUES (?, ?)",
          [name, index]
        );
      });
    }
  });
}

// Admin authentication middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ==================== API ROUTES ====================

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (password === adminPassword) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/admin/check', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// ==================== SERVICES API ====================

app.get('/api/services', (req, res) => {
  const { category } = req.query;
  let query = "SELECT * FROM services WHERE status = 'active'";
  const params = [];
  
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  
  query += " ORDER BY display_order ASC, created_at DESC";
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching services:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/services/all', requireAdmin, (req, res) => {
  db.all("SELECT * FROM services ORDER BY category, display_order", (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/services', requireAdmin, (req, res) => {
  const { category, title, description, price, unit, image_url, icon_url, status, display_order } = req.body;
  
  db.run(
    `INSERT INTO services (category, title, description, price, unit, image_url, icon_url, status, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [category, title, description, price, unit, image_url, icon_url, status || 'active', display_order || 0],
    function(err) {
      if (err) {
        console.error('Error creating service:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

app.put('/api/services/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { category, title, description, price, unit, image_url, icon_url, status, display_order } = req.body;
  
  db.run(
    `UPDATE services SET 
      category = ?, title = ?, description = ?, price = ?, unit = ?, 
      image_url = ?, icon_url = ?, status = ?, display_order = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [category, title, description, price, unit, image_url, icon_url, status, display_order, id],
    function(err) {
      if (err) {
        console.error('Error updating service:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/services/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM services WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error deleting service:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ success: true });
  });
});

// ==================== CATEGORIES API ====================

app.get('/api/categories', (req, res) => {
  db.all(
    "SELECT * FROM categories WHERE status = 'active' ORDER BY display_order",
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/api/categories/all', requireAdmin, (req, res) => {
  db.all("SELECT * FROM categories ORDER BY display_order", (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const { name, icon_url, description, status, display_order } = req.body;
  
  db.run(
    `INSERT INTO categories (name, icon_url, description, status, display_order)
     VALUES (?, ?, ?, ?, ?)`,
    [name, icon_url, description, status || 'active', display_order || 0],
    function(err) {
      if (err) {
        console.error('Error creating category:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

app.put('/api/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, icon_url, description, status, display_order } = req.body;
  
  db.run(
    `UPDATE categories SET 
      name = ?, icon_url = ?, description = ?, status = ?, display_order = ?
     WHERE id = ?`,
    [name, icon_url, description, status, display_order, id],
    function(err) {
      if (err) {
        console.error('Error updating category:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/categories/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM categories WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error deleting category:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ success: true });
  });
});

// ==================== ANNOUNCEMENTS API ====================

app.get('/api/announcements', (req, res) => {
  const now = new Date().toISOString();
  
  db.all(
    `SELECT * FROM announcements 
     WHERE status = 'active' 
     AND (end_date IS NULL OR end_date > ?)
     ORDER BY created_at DESC`,
    [now],
    (err, rows) => {
      if (err) {
        console.error('Error fetching announcements:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/api/announcements/all', requireAdmin, (req, res) => {
  db.all("SELECT * FROM announcements ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/announcements', requireAdmin, (req, res) => {
  const { title, content, start_date, end_date, status } = req.body;
  
  db.run(
    `INSERT INTO announcements (title, content, start_date, end_date, status)
     VALUES (?, ?, ?, ?, ?)`,
    [title, content, start_date, end_date, status || 'active'],
    function(err) {
      if (err) {
        console.error('Error creating announcement:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

app.put('/api/announcements/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { title, content, start_date, end_date, status } = req.body;
  
  db.run(
    `UPDATE announcements SET 
      title = ?, content = ?, start_date = ?, end_date = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [title, content, start_date, end_date, status, id],
    function(err) {
      if (err) {
        console.error('Error updating announcement:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/announcements/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM announcements WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error deleting announcement:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ success: true });
  });
});

// ==================== REVIEWS API ====================

app.get('/api/reviews', (req, res) => {
  db.all(
    "SELECT * FROM reviews WHERE status = 'approved' ORDER BY created_at DESC",
    (err, rows) => {
      if (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json(rows);
    }
  );
});

app.get('/api/reviews/all', requireAdmin, (req, res) => {
  db.all("SELECT * FROM reviews ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/reviews', (req, res) => {
  const { customer_name, content, avatar } = req.body;
  
  db.run(
    `INSERT INTO reviews (customer_name, content, avatar, status)
     VALUES (?, ?, ?, 'pending')`,
    [customer_name, content, avatar || null],
    function(err) {
      if (err) {
        console.error('Error creating review:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ id: this.lastID, success: true });
    }
  );
});

app.put('/api/reviews/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { customer_name, content, avatar, status } = req.body;
  
  db.run(
    `UPDATE reviews SET 
      customer_name = ?, content = ?, avatar = ?, status = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [customer_name, content, avatar, status, id],
    function(err) {
      if (err) {
        console.error('Error updating review:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.run("DELETE FROM reviews WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Error deleting review:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json({ success: true });
  });
});

// ==================== CONTACT SETTINGS API ====================

app.get('/api/contact-settings', (req, res) => {
  db.get("SELECT * FROM contact_settings ORDER BY id DESC LIMIT 1", (err, row) => {
    if (err) {
      console.error('Error fetching contact settings:', err);
      res.status(500).json({ error: 'Database error' });
      return;
    }
    res.json(row || {});
  });
});

app.put('/api/contact-settings', requireAdmin, (req, res) => {
  const {
    whatsapp_url, telegram_url, telegram_channel, whatsapp_channel,
    brand_name, brand_subtitle, logo_url, hero_title, hero_description, about_text
  } = req.body;
  
  db.run(
    `UPDATE contact_settings SET 
      whatsapp_url = ?, telegram_url = ?, telegram_channel = ?, whatsapp_channel = ?,
      brand_name = ?, brand_subtitle = ?, logo_url = ?, hero_title = ?, hero_description = ?, about_text = ?,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = (SELECT id FROM contact_settings ORDER BY id DESC LIMIT 1)`,
    [whatsapp_url, telegram_url, telegram_channel, whatsapp_channel,
     brand_name, brand_subtitle, logo_url, hero_title, hero_description, about_text],
    function(err) {
      if (err) {
        console.error('Error updating contact settings:', err);
        res.status(500).json({ error: 'Database error' });
        return;
      }
      res.json({ success: true });
    }
  );
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', requireAdmin, (req, res) => {
  const stats = {};
  
  db.get("SELECT COUNT(*) as count FROM services", (err, row) => {
    if (err) {
      console.error('Error counting services:', err);
      return;
    }
    stats.services = row.count;
    
    db.get("SELECT COUNT(*) as count FROM reviews", (err, row) => {
      if (err) {
        console.error('Error counting reviews:', err);
        return;
      }
      stats.reviews = row.count;
      
      db.get("SELECT COUNT(*) as count FROM announcements WHERE status = 'active'", (err, row) => {
        if (err) {
          console.error('Error counting announcements:', err);
          return;
        }
        stats.announcements = row.count;
        
        db.get("SELECT COUNT(*) as count FROM reviews WHERE status = 'pending'", (err, row) => {
          if (err) {
            console.error('Error counting pending reviews:', err);
            return;
          }
          stats.pendingReviews = row.count;
          res.json(stats);
        });
      });
    });
  });
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OMH Social Services running on port ${PORT}`);
  console.log(`📱 Visit: http://localhost:${PORT}`);
  console.log(`🔐 Admin Panel: http://localhost:${PORT}/admin`);
});
