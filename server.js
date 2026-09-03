require('dotenv').config();

const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database('./database.sqlite');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const sessionSecret =
  process.env.SESSION_SECRET ||
  'change-this-secret-please-set-in-render';

app.set('trust proxy', 1);

const sessionCookieSecure = process.env.NODE_ENV === 'production';

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: sessionCookieSecure,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 86400000
    }
  })
);

function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin === true) {
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized'
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve(this);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
      } else {
        resolve(row);
      }
    });
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS categories(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS subcategories(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id)
        REFERENCES categories(id)
        ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS services(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      subcategory_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      price TEXT,
      unit TEXT,
      image_url TEXT,
      icon_url TEXT,
      status TEXT DEFAULT 'active',
      display_order INTEGER DEFAULT 0,
      category TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const sql of [
    `ALTER TABLE services ADD COLUMN category_id INTEGER`,
    `ALTER TABLE services ADD COLUMN subcategory_id INTEGER`
  ]) {
    try {
      await run(sql);
    } catch (error) {}
  }

  await run(`
    CREATE TABLE IF NOT EXISTS announcements(
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

  await run(`
    CREATE TABLE IF NOT EXISTS reviews(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      content TEXT NOT NULL,
      avatar TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS contact_settings(
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

  let cs = await get(
    'SELECT * FROM contact_settings LIMIT 1'
  );

  if (!cs) {
    await run(
      `
      INSERT INTO contact_settings(
        whatsapp_url,
        telegram_url,
        telegram_channel,
        whatsapp_channel,
        hero_title,
        hero_description,
        about_text
      )
      VALUES(?,?,?,?,?,?,?)
      `,
      [
        'https://wa.me/93748070273',
        'https://t.me/omhsocial',
        'https://t.me/OMHSocialServices',
        'https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O',
        'حضور دیجیتال خود را به سطح بالاتری ببرید',
        'خدمات شبکه‌های اجتماعی، طراحی وب‌سایت، اپلیکیشن و خدمات دیجیتال با ظاهر حرفه‌ای و مدرن.',
        'کیفیت، اعتبار، سرعت و رضایت مشتری اولویت اصلی ماست.'
      ]
    );
  }

  let cats = await all('SELECT * FROM categories');

  if (!cats.length) {
    for (
      const [i, n] of [
        'Facebook',
        'Instagram',
        'WhatsApp',
        'Telegram',
        'TikTok'
      ].entries()
    ) {
      await run(
        'INSERT INTO categories(name,display_order) VALUES(?,?)',
        [n, i]
      );
    }
  }

  const legacy = await all(`
    SELECT *
    FROM services
    WHERE subcategory_id IS NULL
      AND category IS NOT NULL
      AND TRIM(category) <> ''
  `);

  for (const v of legacy) {
    let c = await get(
      `
      SELECT *
      FROM categories
      WHERE lower(name)=lower(?)
      LIMIT 1
      `,
      [v.category]
    );

    if (!c) {
      const r = await run(
        'INSERT INTO categories(name,status) VALUES(?,?)',
        [v.category, 'active']
      );

      c = await get(
        'SELECT * FROM categories WHERE id=?',
        [r.lastID]
      );
    }

    let sc = await get(
      `
      SELECT *
      FROM subcategories
      WHERE category_id=?
      ORDER BY id
      LIMIT 1
      `,
      [c.id]
    );

    if (!sc) {
      const r = await run(
        `
        INSERT INTO subcategories(
          category_id,
          name,
          status
        )
        VALUES(?,?,?)
        `,
        [c.id, 'خدمات عمومی', 'active']
      );

      sc = await get(
        'SELECT * FROM subcategories WHERE id=?',
        [r.lastID]
      );
    }

    await run(
      `
      UPDATE services
      SET category_id=?,
          subcategory_id=?
      WHERE id=?
      `,
      [c.id, sc.id, v.id]
    );
  }
}

app.post('/api/admin/login', async (req, res) => {
  try {
    const password = String(
      (req.body && req.body.password) || ''
    ).trim();

    const adminPassword = String(
      process.env.ADMIN_PASSWORD || 'admin123'
    ).trim();

    if (!password) {
      return res.status(400).json({
        error: 'رمز مدیریت را وارد کنید.'
      });
    }

    if (password !== adminPassword) {
      return res.status(401).json({
        error: 'رمز مدیریت نادرست است.'
      });
    }

    req.session.regenerate(error => {
      if (error) {
        console.error(
          'Session regenerate error:',
          error
        );

        return res.status(500).json({
          error: 'خطا در ایجاد نشست ورود.'
        });
      }

      req.session.isAdmin = true;

      req.session.save(saveError => {
        if (saveError) {
          console.error(
            'Session save error:',
            saveError
          );

          return res.status(500).json({
            error: 'خطا در ذخیره ورود.'
          });
        }

        return res.json({
          success: true
        });
      });
    });
  } catch (error) {
    console.error(
      'Admin login error:',
      error
    );

    return res.status(500).json({
      error: 'خطای سرور در ورود.'
    });
  }
});

app.post('/api/admin/logout', (req, res) => {
  if (!req.session) {
    return res.json({
      success: true
    });
  }

  req.session.destroy(error => {
    if (error) {
      return res.status(500).json({
        error: 'خطا در خروج.'
      });
    }

    res.clearCookie('connect.sid');

    return res.json({
      success: true
    });
  });
});

app.get('/api/admin/check', (req, res) => {
  res.json({
    isAdmin: req.session?.isAdmin === true
  });
});

app.get('/api/catalog', async (req, res) => {
  try {
    const cats = await all(`
      SELECT *
      FROM categories
      WHERE status='active'
      ORDER BY display_order,id
    `);

    const subs = await all(`
      SELECT *
      FROM subcategories
      WHERE status='active'
      ORDER BY display_order,id
    `);

    const sv = await all(`
      SELECT *
      FROM services
      WHERE status='active'
      ORDER BY display_order,id
    `);

    res.json(
      cats.map(c => ({
        ...c,
        subcategories: subs
          .filter(
            s =>
              Number(s.category_id) ===
              Number(c.id)
          )
          .map(s => ({
            ...s,
            services: sv.filter(
              v =>
                Number(v.subcategory_id) ===
                Number(s.id)
            )
          }))
      }))
    );
  } catch (error) {
    res.status(500).json({
      error: 'Database error'
    });
  }
});

app.get('/api/categories', async (req, res) => {
  res.json(
    await all(`
      SELECT *
      FROM categories
      WHERE status="active"
      ORDER BY display_order,id
    `)
  );
});

app.get(
  '/api/categories/all',
  requireAdmin,
  async (req, res) => {
    res.json(
      await all(`
        SELECT *
        FROM categories
        ORDER BY display_order,id
      `)
    );
  }
);

app.post(
  '/api/categories',
  requireAdmin,
  async (req, res) => {
    try {
      const x = await run(
        `
        INSERT INTO categories(
          name,
          icon_url,
          description,
          status,
          display_order
        )
        VALUES(?,?,?,?,?)
        `,
        [
          req.body.name,
          req.body.icon_url || '',
          req.body.description || '',
          req.body.status || 'active',
          +req.body.display_order || 0
        ]
      );

      res.json({
        id: x.lastID,
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  '/api/categories/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        `
        UPDATE categories
        SET name=?,
            icon_url=?,
            description=?,
            status=?,
            display_order=?
        WHERE id=?
        `,
        [
          req.body.name,
          req.body.icon_url || '',
          req.body.description || '',
          req.body.status || 'active',
          +req.body.display_order || 0,
          req.params.id
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/categories/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        'DELETE FROM categories WHERE id=?',
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/api/subcategories', async (req, res) => {
  res.json(
    await all(`
      SELECT *
      FROM subcategories
      ORDER BY category_id,display_order,id
    `)
  );
});

app.get(
  '/api/subcategories/all',
  requireAdmin,
  async (req, res) => {
    res.json(
      await all(`
        SELECT *
        FROM subcategories
        ORDER BY category_id,display_order,id
      `)
    );
  }
);

app.post(
  '/api/subcategories',
  requireAdmin,
  async (req, res) => {
    try {
      const x = await run(
        `
        INSERT INTO subcategories(
          category_id,
          name,
          icon_url,
          description,
          status,
          display_order
        )
        VALUES(?,?,?,?,?,?)
        `,
        [
          +req.body.category_id,
          req.body.name,
          req.body.icon_url || '',
          req.body.description || '',
          req.body.status || 'active',
          +req.body.display_order || 0
        ]
      );

      res.json({
        id: x.lastID,
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  '/api/subcategories/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        `
        UPDATE subcategories
        SET category_id=?,
            name=?,
            icon_url=?,
            description=?,
            status=?,
            display_order=?
        WHERE id=?
        `,
        [
          +req.body.category_id,
          req.body.name,
          req.body.icon_url || '',
          req.body.description || '',
          req.body.status || 'active',
          +req.body.display_order || 0,
          req.params.id
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/subcategories/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        'DELETE FROM subcategories WHERE id=?',
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/api/services', async (req, res) => {
  res.json(
    await all(`
      SELECT
        s.*,
        c.name category_name,
        sc.name subcategory_name
      FROM services s
      LEFT JOIN categories c
        ON c.id=s.category_id
      LEFT JOIN subcategories sc
        ON sc.id=s.subcategory_id
      WHERE s.status='active'
      ORDER BY s.display_order,s.id
    `)
  );
});

app.get(
  '/api/services/all',
  requireAdmin,
  async (req, res) => {
    res.json(
      await all(`
        SELECT
          s.*,
          c.name category_name,
          sc.name subcategory_name
        FROM services s
        LEFT JOIN categories c
          ON c.id=s.category_id
        LEFT JOIN subcategories sc
          ON sc.id=s.subcategory_id
        ORDER BY
          c.display_order,
          sc.display_order,
          s.display_order,
          s.id
      `)
    );
  }
);

app.post(
  '/api/services',
  requireAdmin,
  async (req, res) => {
    try {
      const x = await run(
        `
        INSERT INTO services(
          category_id,
          subcategory_id,
          title,
          description,
          price,
          unit,
          image_url,
          icon_url,
          status,
          display_order,
          category
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?)
        `,
        [
          +req.body.category_id || null,
          +req.body.subcategory_id || null,
          req.body.title,
          req.body.description || '',
          req.body.price || '',
          req.body.unit || '',
          req.body.image_url || '',
          req.body.icon_url || '',
          req.body.status || 'active',
          +req.body.display_order || 0,
          req.body.category || ''
        ]
      );

      res.json({
        id: x.lastID,
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  '/api/services/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        `
        UPDATE services
        SET category_id=?,
            subcategory_id=?,
            title=?,
            description=?,
            price=?,
            unit=?,
            image_url=?,
            icon_url=?,
            status=?,
            display_order=?,
            category=?,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        `,
        [
          +req.body.category_id || null,
          +req.body.subcategory_id || null,
          req.body.title,
          req.body.description || '',
          req.body.price || '',
          req.body.unit || '',
          req.body.image_url || '',
          req.body.icon_url || '',
          req.body.status || 'active',
          +req.body.display_order || 0,
          req.body.category || '',
          req.params.id
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/services/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        'DELETE FROM services WHERE id=?',
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/api/announcements', async (req, res) => {
  res.json(
    await all(`
      SELECT *
      FROM announcements
      WHERE status='active'
        AND (
          start_date IS NULL
          OR start_date<=datetime('now')
        )
        AND (
          end_date IS NULL
          OR end_date>datetime('now')
        )
      ORDER BY created_at DESC
    `)
  );
});

app.get(
  '/api/announcements/all',
  requireAdmin,
  async (req, res) => {
    res.json(
      await all(`
        SELECT *
        FROM announcements
        ORDER BY created_at DESC
      `)
    );
  }
);

app.post(
  '/api/announcements',
  requireAdmin,
  async (req, res) => {
    try {
      const x = await run(
        `
        INSERT INTO announcements(
          title,
          content,
          start_date,
          end_date,
          status
        )
        VALUES(?,?,?,?,?)
        `,
        [
          req.body.title,
          req.body.content,
          req.body.start_date || null,
          req.body.end_date || null,
          req.body.status || 'active'
        ]
      );

      res.json({
        id: x.lastID,
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.put(
  '/api/announcements/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        `
        UPDATE announcements
        SET title=?,
            content=?,
            start_date=?,
            end_date=?,
            status=?,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        `,
        [
          req.body.title,
          req.body.content,
          req.body.start_date || null,
          req.body.end_date || null,
          req.body.status || 'active',
          req.params.id
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/announcements/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        'DELETE FROM announcements WHERE id=?',
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/api/reviews', async (req, res) => {
  res.json(
    await all(`
      SELECT *
      FROM reviews
      WHERE status='approved'
      ORDER BY created_at DESC
    `)
  );
});

app.get(
  '/api/reviews/all',
  requireAdmin,
  async (req, res) => {
    res.json(
      await all(`
        SELECT *
        FROM reviews
        ORDER BY created_at DESC
      `)
    );
  }
);

app.post('/api/reviews', async (req, res) => {
  try {
    const x = await run(
      `
      INSERT INTO reviews(
        customer_name,
        content,
        avatar,
        status
      )
      VALUES(?,?,?,'pending')
      `,
      [
        req.body.customer_name,
        req.body.content,
        req.body.avatar || null
      ]
    );

    res.json({
      id: x.lastID,
      success: true
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

app.put(
  '/api/reviews/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        `
        UPDATE reviews
        SET customer_name=?,
            content=?,
            avatar=?,
            status=?,
            updated_at=CURRENT_TIMESTAMP
        WHERE id=?
        `,
        [
          req.body.customer_name,
          req.body.content,
          req.body.avatar || null,
          req.body.status,
          req.params.id
        ]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.delete(
  '/api/reviews/:id',
  requireAdmin,
  async (req, res) => {
    try {
      await run(
        'DELETE FROM reviews WHERE id=?',
        [req.params.id]
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/api/contact-settings', async (req, res) => {
  res.json(
    await get(`
      SELECT *
      FROM contact_settings
      ORDER BY id DESC
      LIMIT 1
    `) || {}
  );
});

app.put(
  '/api/contact-settings',
  requireAdmin,
  async (req, res) => {
    try {
      const keys = [
        'whatsapp_url',
        'telegram_url',
        'telegram_channel',
        'whatsapp_channel',
        'brand_name',
        'brand_subtitle',
        'logo_url',
        'hero_title',
        'hero_description',
        'about_text'
      ];

      const values = keys.map(
        key => req.body[key] || ''
      );

      await run(
        `
        UPDATE contact_settings
        SET ${keys.map(k => `${k}=?`).join(',')},
            updated_at=CURRENT_TIMESTAMP
        WHERE id=(
          SELECT id
          FROM contact_settings
          ORDER BY id DESC
          LIMIT 1
        )
        `,
        values
      );

      res.json({
        success: true
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get(
  '/api/dashboard/stats',
  requireAdmin,
  async (req, res) => {
    try {
      res.json({
        categories: (
          await get(
            'SELECT COUNT(*) n FROM categories'
          )
        ).n,

        subcategories: (
          await get(
            'SELECT COUNT(*) n FROM subcategories'
          )
        ).n,

        services: (
          await get(
            'SELECT COUNT(*) n FROM services'
          )
        ).n,

        reviews: (
          await get(
            'SELECT COUNT(*) n FROM reviews'
          )
        ).n,

        announcements: (
          await get(
            'SELECT COUNT(*) n FROM announcements'
          )
        ).n,

        pendingReviews: (
          await get(
            `
            SELECT COUNT(*) n
            FROM reviews
            WHERE status='pending'
            `
          )
        ).n
      });
    } catch (error) {
      res.status(500).json({
        error: error.message
      });
    }
  }
);

app.get('/admin', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public/admin.html')
  );
});

app.get('*', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public/index.html')
  );
});

init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(
        'OMH Social Services on ' + PORT
      );
    });
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
