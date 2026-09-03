document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  const $ = (selector, parent = document) =>
    parent.querySelector(selector);

  const $$ = (selector, parent = document) =>
    [...parent.querySelectorAll(selector)];

  let categories = [];
  let subcategories = [];
  let services = [];
  let announcements = [];
  let reviews = [];

  /* =========================================================
     HELPERS
  ========================================================= */

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showMessage(message, type = "success") {
    let box = $("#adminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "adminMessage";

      Object.assign(box.style, {
        position: "fixed",
        top: "20px",
        left: "20px",
        right: "20px",
        zIndex: "999999",
        maxWidth: "520px",
        margin: "auto",
        padding: "14px 18px",
        borderRadius: "14px",
        textAlign: "center",
        fontSize: "13px",
        fontWeight: "700",
        color: "#fff",
        boxShadow: "0 15px 45px rgba(0,0,0,.35)",
        backdropFilter: "blur(15px)"
      });

      document.body.appendChild(box);
    }

    box.textContent = message;

    box.style.background =
      type === "error"
        ? "rgba(185,45,45,.95)"
        : "rgba(18,150,110,.95)";

    clearTimeout(box._timer);

    box._timer = setTimeout(() => {
      if (box && box.parentNode) {
        box.remove();
      }
    }, 3500);
  }

  function getFormData(form) {
    const data = {};

    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });

    return data;
  }

  /* =========================================================
     API
  ========================================================= */

  async function api(url, options = {}) {
    const config = {
      credentials: "same-origin",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.headers || {})
      }
    };

    let response;

    try {
      response = await fetch(url, config);
    } catch (error) {
      throw new Error(
        "ارتباط با سرور برقرار نشد. اینترنت یا سرور را بررسی کنید."
      );
    }

    let data = {};

    const contentType =
      response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }
    } else {
      try {
        const text = await response.text();

        if (text) {
          data = {
            message: text
          };
        }
      } catch (_) {}
    }

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `خطای سرور: ${response.status}`
      );
    }

    return data;
  }

  /* =========================================================
     LOGIN / LOGOUT
  ========================================================= */

  function showLogin() {
    const login = $("#loginScreen");
    const panel = $("#adminPanel");

    if (login) {
      login.hidden = false;
      login.style.display = "";
      login.classList.remove("hidden");
      login.classList.add("active");
    }

    if (panel) {
      panel.hidden = true;
      panel.style.display = "none";
      panel.classList.remove("active");
      panel.classList.add("hidden");
    }
  }

  function showPanel() {
    const login = $("#loginScreen");
    const panel = $("#adminPanel");

    /*
      مهم:
      از hidden + style + class همزمان استفاده می‌کنیم
      تا CSS قبلی نتواند پنل را مخفی نگه دارد.
    */

    if (login) {
      login.hidden = true;
      login.style.display = "none";
      login.classList.remove("active");
      login.classList.add("hidden");
    }

    if (panel) {
      panel.hidden = false;
      panel.style.display = "block";
      panel.classList.remove("hidden");
      panel.classList.add("active");

      /*
        اگر خود پنل داخل یک wrapper مخفی باشد،
        والدهای مستقیم را هم بررسی می‌کنیم.
      */
      let parent = panel.parentElement;

      for (let i = 0; i < 3 && parent; i++) {
        if (
          parent.id === "adminApp" ||
          parent.id === "adminContainer" ||
          parent.classList.contains("admin-wrapper")
        ) {
          parent.hidden = false;
          parent.style.display = "";
          parent.classList.remove("hidden");
        }

        parent = parent.parentElement;
      }
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function checkLogin() {
    try {
      const data = await api("/api/admin/check");

      if (
        data &&
        (
          data.isAdmin === true ||
          data.isAuthenticated === true ||
          data.authenticated === true ||
          data.loggedIn === true
        )
      ) {
        showPanel();

        /*
          اگر API اطلاعات خطا بدهد، خود ورود نباید
          دوباره به صفحه لاگین برگردد.
        */
        await loadAll();

        return true;
      }

      showLogin();
      return false;

    } catch (error) {
      showLogin();
      return false;
    }
  }

  async function login() {
    const form = $("#loginForm");

    if (!form) {
      showMessage(
        "فرم ورود پیدا نشد.",
        "error"
      );
      return;
    }

    const passwordInput =
      form.querySelector(
        'input[name="password"], input[type="password"]'
      );

    if (!passwordInput) {
      showMessage(
        "فیلد رمز عبور پیدا نشد.",
        "error"
      );
      return;
    }

    const password =
      String(passwordInput.value || "").trim();

    if (!password) {
      showMessage(
        "رمز مدیریت را وارد کنید.",
        "error"
      );

      passwordInput.focus();
      return;
    }

    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    const originalText =
      button
        ? button.textContent
        : "ورود";

    if (button) {
      button.disabled = true;
      button.textContent = "در حال ورود...";
    }

    try {
      const result = await api(
        "/api/admin/login",
        {
          method: "POST",
          body: JSON.stringify({
            password
          })
        }
      );

      /*
        اگر سرور Login موفق داده باشد،
        مستقیماً پنل را باز می‌کنیم.
      */

      if (
        result &&
        (
          result.success === false ||
          result.ok === false ||
          result.isAdmin === false
        )
      ) {
        throw new Error(
          result.error ||
          result.message ||
          "رمز مدیریت نادرست است."
        );
      }

      showMessage("ورود موفق بود.");

      /*
        اول پنل را نمایش بده
        سپس اطلاعات را بارگذاری کن.
      */
      showPanel();

      /*
        کمی صبر برای ثبت Cookie Session
      */
      await new Promise(resolve =>
        setTimeout(resolve, 100)
      );

      try {
        await loadAll();
      } catch (loadError) {
        console.error(
          "Admin data loading error:",
          loadError
        );

        /*
          ورود موفق بوده؛ فقط یکی از APIها مشکل دارد.
          پنل نباید بسته شود.
        */

        showMessage(
          "ورود موفق شد، اما دریافت بعضی اطلاعات با مشکل مواجه شد.",
          "error"
        );
      }

    } catch (error) {
      console.error(
        "Admin login error:",
        error
      );

      showMessage(
        error.message ||
        "ورود انجام نشد.",
        "error"
      );

    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  async function logout() {
    try {
      await api(
        "/api/admin/logout",
        {
          method: "POST"
        }
      );
    } catch (error) {
      console.warn(
        "Logout API error:",
        error
      );
    }

    showLogin();

    const form = $("#loginForm");

    if (form) {
      form.reset();
    }

    showMessage("از پنل خارج شدید.");
  }

  /* =========================================================
     LOAD DATA
  ========================================================= */

  async function loadCategories() {
    try {
      const data =
        await api("/api/categories/all");

      categories =
        Array.isArray(data)
          ? data
          : Array.isArray(data.categories)
            ? data.categories
            : [];

      renderCategories();
      fillCategorySelects();

    } catch (error) {
      console.error(
        "Categories:",
        error
      );

      categories = [];

      renderCategories();
      fillCategorySelects();

      throw error;
    }
  }

  async function loadSubcategories() {
    try {
      const data =
        await api("/api/subcategories/all");

      subcategories =
        Array.isArray(data)
          ? data
          : Array.isArray(data.subcategories)
            ? data.subcategories
            : [];

      renderSubcategories();
      fillSubcategorySelects();

    } catch (error) {
      console.error(
        "Subcategories:",
        error
      );

      subcategories = [];

      renderSubcategories();
      fillSubcategorySelects();

      throw error;
    }
  }

  async function loadServices() {
    try {
      const data =
        await api("/api/services/all");

      services =
        Array.isArray(data)
          ? data
          : Array.isArray(data.services)
            ? data.services
            : [];

      renderServices();

    } catch (error) {
      console.error(
        "Services:",
        error
      );

      services = [];

      renderServices();

      throw error;
    }
  }

  async function loadAnnouncements() {
    try {
      const data =
        await api("/api/announcements/all");

      announcements =
        Array.isArray(data)
          ? data
          : Array.isArray(data.announcements)
            ? data.announcements
            : [];

      renderAnnouncements();

    } catch (error) {
      console.error(
        "Announcements:",
        error
      );

      announcements = [];

      renderAnnouncements();

      throw error;
    }
  }

  async function loadReviews() {
    try {
      const data =
        await api("/api/reviews/all");

      reviews =
        Array.isArray(data)
          ? data
          : Array.isArray(data.reviews)
            ? data.reviews
            : [];

      renderReviews();

    } catch (error) {
      console.error(
        "Reviews:",
        error
      );

      reviews = [];

      renderReviews();

      throw error;
    }
  }

  async function loadSettings() {
    try {
      const data =
        await api("/api/contact-settings");

      fillSettings(
        data || {}
      );

    } catch (error) {
      console.error(
        "Settings:",
        error
      );

      throw error;
    }
  }

  async function loadStats() {
    try {
      const data =
        await api("/api/dashboard/stats");

      const mapping = {
        categories: [
          "#categoryCount",
          "#categoriesCount"
        ],

        subcategories: [
          "#subcategoryCount",
          "#subcategoriesCount"
        ],

        services: [
          "#serviceCount",
          "#servicesCount"
        ],

        reviews: [
          "#reviewCount",
          "#reviewsCount"
        ],

        announcements: [
          "#announcementCount",
          "#announcementsCount"
        ],

        pendingReviews: [
          "#pendingReviewCount"
        ]
      };

      Object.entries(mapping)
        .forEach(([key, selectors]) => {
          selectors.forEach(selector => {
            const element = $(selector);

            if (element) {
              element.textContent =
                data?.[key] ?? 0;
            }
          });
        });

    } catch (error) {
      console.warn(
        "Stats:",
        error
      );
    }
  }

  async function loadAll() {
    /*
      Promise.allSettled باعث می‌شود اگر مثلاً
      Reviews API خراب باشد، پنل کلاً متوقف نشود.
    */

    const results =
      await Promise.allSettled([
        loadCategories(),
        loadSubcategories(),
        loadServices(),
        loadAnnouncements(),
        loadReviews(),
        loadSettings(),
        loadStats()
      ]);

    const failed =
      results.filter(
        item => item.status === "rejected"
      );

    if (failed.length) {
      console.warn(
        "Some admin APIs failed:",
        failed
      );
    }

    /*
      دوباره Selectها را پر می‌کنیم
      چون ترتیب APIها ممکن است متفاوت باشد.
    */

    fillCategorySelects();
    fillSubcategorySelects();
  }

  /* =========================================================
     SELECTS
  ========================================================= */

  function fillCategorySelects() {
    const selects = $$(
      'select[name="category_id"], #categorySelect, #serviceCategory'
    );

    selects.forEach(select => {
      const current =
        select.value;

      select.innerHTML =
        '<option value="">انتخاب دسته‌بندی</option>';

      categories.forEach(category => {
        const option =
          document.createElement("option");

        option.value =
          category.id;

        option.textContent =
          category.name;

        select.appendChild(option);
      });

      if (current) {
        select.value =
          current;
      }
    });
  }

  function fillSubcategorySelects() {
    const selects = $$(
      'select[name="subcategory_id"], #subcategorySelect, #serviceSubcategory'
    );

    selects.forEach(select => {
      const current =
        select.value;

      select.innerHTML =
        '<option value="">انتخاب زیردسته</option>';

      subcategories.forEach(sub => {
        const category =
          categories.find(
            category =>
              Number(category.id) ===
              Number(sub.category_id)
          );

        const option =
          document.createElement("option");

        option.value =
          sub.id;

        option.textContent =
          category
            ? `${category.name} — ${sub.name}`
            : sub.name;

        select.appendChild(option);
      });

      if (current) {
        select.value =
          current;
      }
    });
  }

  /* =========================================================
     RENDER CATEGORIES
  ========================================================= */

  function renderCategories() {
    const container =
      $("#categoryList") ||
      $("#categoriesList");

    if (!container) return;

    if (!categories.length) {
      container.innerHTML =
        '<div class="empty-state">هیچ دسته‌بندی وجود ندارد.</div>';
      return;
    }

    container.innerHTML =
      categories
        .map(category => `
          <div class="admin-item">

            <div class="admin-item-info">

              ${
                category.icon_url
                  ? `
                    <img
                      src="${escapeHtml(category.icon_url)}"
                      class="admin-item-icon"
                      alt=""
                    >
                  `
                  : `
                    <div class="admin-item-icon placeholder-icon">
                      ◈
                    </div>
                  `
              }

              <div>
                <strong>
                  ${escapeHtml(category.name)}
                </strong>

                <small>
                  ${escapeHtml(
                    category.description || ""
                  )}
                </small>
              </div>

            </div>

            <div class="admin-item-actions">

              <button
                type="button"
                data-edit-category="${category.id}"
              >
                ویرایش
              </button>

              <button
                type="button"
                data-delete-category="${category.id}"
                class="danger"
              >
                حذف
              </button>

            </div>

          </div>
        `)
        .join("");
  }

  /* =========================================================
     RENDER SUBCATEGORIES
  ========================================================= */

  function renderSubcategories() {
    const container =
      $("#subcategoryList") ||
      $("#subcategoriesList");

    if (!container) return;

    if (!subcategories.length) {
      container.innerHTML =
        '<div class="empty-state">هیچ زیردسته‌ای وجود ندارد.</div>';
      return;
    }

    container.innerHTML =
      subcategories
        .map(sub => {
          const category =
            categories.find(
              c =>
                Number(c.id) ===
                Number(sub.category_id)
            );

          return `
            <div class="admin-item">

              <div class="admin-item-info">

                ${
                  sub.icon_url
                    ? `
                      <img
                        src="${escapeHtml(sub.icon_url)}"
                        class="admin-item-icon"
                        alt=""
                      >
                    `
                    : `
                      <div class="admin-item-icon placeholder-icon">
                        ◈
                      </div>
                    `
                }

                <div>
                  <strong>
                    ${escapeHtml(sub.name)}
                  </strong>

                  <small>
                    ${
                      category
                        ? escapeHtml(category.name)
                        : "بدون دسته"
                    }
                  </small>
                </div>

              </div>

              <div class="admin-item-actions">

                <button
                  type="button"
                  data-edit-subcategory="${sub.id}"
                >
                  ویرایش
                </button>

                <button
                  type="button"
                  data-delete-subcategory="${sub.id}"
                  class="danger"
                >
                  حذف
                </button>

              </div>

            </div>
          `;
        })
        .join("");
  }

  /* =========================================================
     RENDER SERVICES
  ========================================================= */

  function renderServices() {
    const container =
      $("#serviceList") ||
      $("#servicesList");

    if (!container) return;

    if (!services.length) {
      container.innerHTML =
        '<div class="empty-state">هیچ سرویسی وجود ندارد.</div>';
      return;
    }

    container.innerHTML =
      services
        .map(service => {

          const categoryName =
            service.category_name ||
            service.category ||
            "";

          const subcategoryName =
            service.subcategory_name ||
            service.subcategory ||
            "";

          const icon =
            service.icon_url ||
            service.image_url ||
            "";

          return `
            <div class="admin-item">

              <div class="admin-item-info">

                ${
                  icon
                    ? `
                      <img
                        src="${escapeHtml(icon)}"
                        class="admin-item-icon"
                        alt=""
                      >
                    `
                    : `
                      <div class="admin-item-icon placeholder-icon">
                        ◎
                      </div>
                    `
                }

                <div>

                  <strong>
                    ${escapeHtml(
                      service.title ||
                      service.name ||
                      ""
                    )}
                  </strong>

                  <small>

                    ${escapeHtml(
                      categoryName
                    )}

                    ${
                      subcategoryName
                        ? " / " +
                          escapeHtml(
                            subcategoryName
                          )
                        : ""
                    }

                    ${
                      service.price
                        ? " — " +
                          escapeHtml(
                            service.price
                          )
                        : ""
                    }

                  </small>

                </div>

              </div>

              <div class="admin-item-actions">

                <button
                  type="button"
                  data-edit-service="${service.id}"
                >
                  ویرایش
                </button>

                <button
                  type="button"
                  data-delete-service="${service.id}"
                  class="danger"
                >
                  حذف
                </button>

              </div>

            </div>
          `;
        })
        .join("");
  }

  /* =========================================================
     RENDER ANNOUNCEMENTS
  ========================================================= */

  function renderAnnouncements() {
    const container =
      $("#announcementList") ||
      $("#announcementsList");

    if (!container) return;

    if (!announcements.length) {
      container.innerHTML =
        '<div class="empty-state">هیچ اعلانی وجود ندارد.</div>';
      return;
    }

    container.innerHTML =
      announcements
        .map(item => `
          <div class="admin-item">

            <div class="admin-item-info">

              <div class="admin-item-icon placeholder-icon">
                📢
              </div>

              <div>

                <strong>
                  ${escapeHtml(
                    item.title
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    item.content
                  )}
                </small>

              </div>

            </div>

            <div class="admin-item-actions">

              <button
                type="button"
                data-edit-announcement="${item.id}"
              >
                ویرایش
              </button>

              <button
                type="button"
                data-delete-announcement="${item.id}"
                class="danger"
              >
                حذف
              </button>

            </div>

          </div>
        `)
        .join("");
  }

  /* =========================================================
     RENDER REVIEWS
  ========================================================= */

  function renderReviews() {
    const container =
      $("#reviewList") ||
      $("#reviewsList");

    if (!container) return;

    if (!reviews.length) {
      container.innerHTML =
        '<div class="empty-state">هیچ نظری وجود ندارد.</div>';
      return;
    }

    container.innerHTML =
      reviews
        .map(review => `
          <div class="admin-item">

            <div class="admin-item-info">

              ${
                review.avatar
                  ? `
                    <img
                      src="${escapeHtml(review.avatar)}"
                      class="admin-item-icon"
                      alt=""
                    >
                  `
                  : `
                    <div class="admin-item-icon placeholder-icon">
                      👤
                    </div>
                  `
              }

              <div>

                <strong>
                  ${escapeHtml(
                    review.customer_name
                  )}
                </strong>

                <small>
                  ${escapeHtml(
                    review.content
                  )}
                </small>

                <small>
                  وضعیت:
                  ${escapeHtml(
                    review.status
                  )}
                </small>

              </div>

            </div>

            <div class="admin-item-actions">

              ${
                review.status !== "approved"
                  ? `
                    <button
                      type="button"
                      data-approve-review="${review.id}"
                    >
                      تأیید
                    </button>
                  `
                  : ""
              }

              <button
                type="button"
                data-delete-review="${review.id}"
                class="danger"
              >
                حذف
              </button>

            </div>

          </div>
        `)
        .join("");
  }

  /* =========================================================
     SETTINGS
  ========================================================= */

  function fillSettings(data) {
    const fields = [
      "whatsapp_url",
      "telegram_url",
      "telegram_channel",
      "whatsapp_channel",
      "brand_name",
      "brand_subtitle",
      "logo_url",
      "hero_title",
      "hero_description",
      "about_text"
    ];

    fields.forEach(name => {
      const input =
        document.querySelector(
          `[name="${name}"]`
        );

      if (!input) return;

      input.value =
        data?.[name] ?? "";
    });
  }

  /* =========================================================
     SAVE FORMS
  ========================================================= */

  async function saveForm(
    form,
    url,
    method = "POST"
  ) {
    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    const originalText =
      button
        ? button.textContent
        : "ذخیره";

    if (button) {
      button.disabled = true;
      button.textContent =
        "در حال ذخیره...";
    }

    try {
      const data =
        getFormData(form);

      await api(url, {
        method,
        body: JSON.stringify(data)
      });

      showMessage(
        method === "POST"
          ? "با موفقیت ثبت شد."
          : "با موفقیت ذخیره شد."
      );

      /*
        حالت ویرایش را پاک می‌کنیم
      */

      delete form.dataset.editId;

      form.reset();

      if (button) {
        button.textContent =
          "ذخیره";
      }

      await loadAll();

    } catch (error) {
      console.error(
        "Save error:",
        error
      );

      showMessage(
        "ثبت نشد: " +
        (
          error.message ||
          "خطای نامشخص"
        ),
        "error"
      );

    } finally {
      if (button) {
        button.disabled = false;

        if (
          !form.dataset.editId
        ) {
          button.textContent =
            originalText;
        }
      }
    }
  }

  /* =========================================================
     EDIT
  ========================================================= */

  function fillEditForm(
    form,
    item
  ) {
    if (!form || !item) return;

    form.dataset.editId =
      item.id;

    Object.entries(item)
      .forEach(([key, value]) => {
        const input =
          form.querySelector(
            `[name="${key}"]`
          );

        if (!input) return;

        if (
          input.tagName === "SELECT"
        ) {
          input.value =
            value ?? "";
        } else {
          input.value =
            value ?? "";
        }
      });

    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    if (button) {
      button.textContent =
        "ذخیره تغییرات";
    }

    form.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  }

  function editCategory(id) {
    const item =
      categories.find(
        c =>
          Number(c.id) ===
          Number(id)
      );

    fillEditForm(
      $("#categoryForm"),
      item
    );
  }

  function editSubcategory(id) {
    const item =
      subcategories.find(
        s =>
          Number(s.id) ===
          Number(id)
      );

    fillEditForm(
      $("#subcategoryForm"),
      item
    );
  }

  function editService(id) {
    const item =
      services.find(
        s =>
          Number(s.id) ===
          Number(id)
      );

    fillEditForm(
      $("#serviceForm"),
      item
    );
  }

  function editAnnouncement(id) {
    const item =
      announcements.find(
        a =>
          Number(a.id) ===
          Number(id)
      );

    fillEditForm(
      $("#announcementForm"),
      item
    );
  }

  /* =========================================================
     DELETE
  ========================================================= */

  async function deleteItem(
    url,
    question
  ) {
    if (
      !window.confirm(
        question
      )
    ) {
      return;
    }

    try {
      await api(url, {
        method: "DELETE"
      });

      showMessage(
        "با موفقیت حذف شد."
      );

      await loadAll();

    } catch (error) {
      console.error(
        "Delete error:",
        error
      );

      showMessage(
        "حذف نشد: " +
        error.message,
        "error"
      );
    }
  }

  /* =========================================================
     APPROVE REVIEW
  ========================================================= */

  async function approveReview(id) {
    const review =
      reviews.find(
        r =>
          Number(r.id) ===
          Number(id)
      );

    if (!review) {
      showMessage(
        "نظر پیدا نشد.",
        "error"
      );
      return;
    }

    try {
      await api(
        `/api/reviews/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            customer_name:
              review.customer_name,

            content:
              review.content,

            avatar:
              review.avatar || "",

            status:
              "approved"
          })
        }
      );

      showMessage(
        "نظر تأیید شد."
      );

      await loadAll();

    } catch (error) {
      console.error(
        "Approve review:",
        error
      );

      showMessage(
        "تأیید نشد: " +
        error.message,
        "error"
      );
    }
  }

  /* =========================================================
     LOGIN FORM
  ========================================================= */

  function bindLogin() {
    const form =
      $("#loginForm");

    if (!form) {
      console.warn(
        "loginForm not found"
      );
      return;
    }

    /*
      جلوگیری از چند بار bind شدن
    */

    if (
      form.dataset.bound === "true"
    ) {
      return;
    }

    form.dataset.bound =
      "true";

    form.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        event.stopPropagation();

        login();
      }
    );
  }

  /* =========================================================
     LOGOUT
  ========================================================= */

  function bindLogout() {
    $$(
      "#logoutBtn, [data-action='logout']"
    ).forEach(button => {

      if (
        button.dataset.bound === "true"
      ) {
        return;
      }

      button.dataset.bound =
        "true";

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          logout();
        }
      );
    });
  }

  /* =========================================================
     FORMS
  ========================================================= */

  function bindForms() {

    const categoryForm =
      $("#categoryForm");

    if (categoryForm) {
      categoryForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          const id =
            categoryForm.dataset.editId;

          saveForm(
            categoryForm,
            id
              ? `/api/categories/${id}`
              : "/api/categories",
            id
              ? "PUT"
              : "POST"
          );
        }
      );
    }

    const subcategoryForm =
      $("#subcategoryForm");

    if (subcategoryForm) {
      subcategoryForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          const id =
            subcategoryForm.dataset.editId;

          saveForm(
            subcategoryForm,
            id
              ? `/api/subcategories/${id}`
              : "/api/subcategories",
            id
              ? "PUT"
              : "POST"
          );
        }
      );
    }

    const serviceForm =
      $("#serviceForm");

    if (serviceForm) {
      serviceForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          const id =
            serviceForm.dataset.editId;

          saveForm(
            serviceForm,
            id
              ? `/api/services/${id}`
              : "/api/services",
            id
              ? "PUT"
              : "POST"
          );
        }
      );
    }

    const announcementForm =
      $("#announcementForm");

    if (announcementForm) {
      announcementForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          const id =
            announcementForm.dataset.editId;

          saveForm(
            announcementForm,
            id
              ? `/api/announcements/${id}`
              : "/api/announcements",
            id
              ? "PUT"
              : "POST"
          );
        }
      );
    }

    const settingsForm =
      $("#settingsForm") ||
      $("#contactSettingsForm");

    if (settingsForm) {
      settingsForm.addEventListener(
        "submit",
        event => {
          event.preventDefault();

          saveForm(
            settingsForm,
            "/api/contact-settings",
            "PUT"
          );
        }
      );
    }
  }

  /* =========================================================
     CATEGORY → SUBCATEGORY
  ========================================================= */

  function bindCategoryChanges() {

    $$(
      'select[name="category_id"], #categorySelect, #serviceCategory'
    ).forEach(select => {

      select.addEventListener(
        "change",
        () => {

          const categoryId =
            Number(
              select.value
            );

          /*
            فقط زیردسته مربوط به همین
            دسته‌بندی نمایش داده شود.
          */

          const target =
            select.form?.querySelector(
              'select[name="subcategory_id"], #subcategorySelect, #serviceSubcategory'
            ) ||
            document.querySelector(
              'select[name="subcategory_id"], #subcategorySelect, #serviceSubcategory'
            );

          if (!target) return;

          target.innerHTML =
            '<option value="">انتخاب زیردسته</option>';

          subcategories
            .filter(
              sub =>
                Number(
                  sub.category_id
                ) === categoryId
            )
            .forEach(sub => {

              const option =
                document.createElement(
                  "option"
                );

              option.value =
                sub.id;

              option.textContent =
                sub.name;

              target.appendChild(
                option
              );
            });
        }
      );
    });
  }

  /* =========================================================
     ACTION BUTTONS
  ========================================================= */

  function bindActions() {

    document.addEventListener(
      "click",
      event => {

        const target =
          event.target.closest(
            "[data-edit-category]," +
            "[data-delete-category]," +
            "[data-edit-subcategory]," +
            "[data-delete-subcategory]," +
            "[data-edit-service]," +
            "[data-delete-service]," +
            "[data-edit-announcement]," +
            "[data-delete-announcement]," +
            "[data-approve-review]," +
            "[data-delete-review]"
          );

        if (!target) return;

        if (
          target.dataset.editCategory
        ) {
          editCategory(
            target.dataset.editCategory
          );
          return;
        }

        if (
          target.dataset.deleteCategory
        ) {
          deleteItem(
            `/api/categories/${target.dataset.deleteCategory}`,
            "این دسته‌بندی و اطلاعات وابسته حذف شود؟"
          );
          return;
        }

        if (
          target.dataset.editSubcategory
        ) {
          editSubcategory(
            target.dataset.editSubcategory
          );
          return;
        }

        if (
          target.dataset.deleteSubcategory
        ) {
          deleteItem(
            `/api/subcategories/${target.dataset.deleteSubcategory}`,
            "این زیردسته حذف شود؟"
          );
          return;
        }

        if (
          target.dataset.editService
        ) {
          editService(
            target.dataset.editService
          );
          return;
        }

        if (
          target.dataset.deleteService
        ) {
          deleteItem(
            `/api/services/${target.dataset.deleteService}`,
            "این سرویس حذف شود؟"
          );
          return;
        }

        if (
          target.dataset.editAnnouncement
        ) {
          editAnnouncement(
            target.dataset.editAnnouncement
          );
          return;
        }

        if (
          target.dataset.deleteAnnouncement
        ) {
          deleteItem(
            `/api/announcements/${target.dataset.deleteAnnouncement}`,
            "این اعلان حذف شود؟"
          );
          return;
        }

        if (
          target.dataset.approveReview
        ) {
          approveReview(
            target.dataset.approveReview
          );
          return;
        }

        if (
          target.dataset.deleteReview
        ) {
          deleteItem(
            `/api/reviews/${target.dataset.deleteReview}`,
            "این نظر حذف شود؟"
          );
        }

      }
    );
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function bindNavigation() {

    $$(
      "[data-section], .admin-nav a"
    ).forEach(link => {

      link.addEventListener(
        "click",
        event => {

          const selector =
            link.dataset.section ||
            link.getAttribute("href");

          if (
            !selector ||
            !selector.startsWith("#")
          ) {
            return;
          }

          const section =
            document.querySelector(
              selector
            );

          if (!section) {
            return;
          }

          event.preventDefault();

          $$(".admin-section, .panel-section")
            .forEach(item => {
              item.classList.remove(
                "active"
              );
            });

          section.classList.add(
            "active"
          );

          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      );
    });
  }

  /* =========================================================
     START
  ========================================================= */

  bindLogin();
  bindLogout();
  bindForms();
  bindActions();
  bindNavigation();
  bindCategoryChanges();

  /*
    ابتدا صفحه لاگین را آماده می‌کنیم
    تا پنل مخفی قبلی مزاحم نباشد.
  */

  showLogin();

  /*
    بررسی Session
  */

  checkLogin();
});
