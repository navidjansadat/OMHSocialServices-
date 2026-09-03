document.addEventListener("DOMContentLoaded", () => {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];

  let categories = [];
  let subcategories = [];
  let services = [];
  let announcements = [];
  let reviews = [];
  let editing = null;

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },
      ...options
    });

    let data = {};
    try {
      data = await response.json();
    } catch (_) {}

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `خطای سرور: ${response.status}`
      );
    }

    return data;
  };

  const showMessage = (message, type = "success") => {
    let box = $("#adminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "adminMessage";
      box.style.cssText = `
        position:fixed;
        top:20px;
        left:20px;
        right:20px;
        z-index:99999;
        max-width:520px;
        margin:auto;
        padding:14px 18px;
        border-radius:14px;
        text-align:center;
        font-size:13px;
        font-weight:700;
        backdrop-filter:blur(15px);
      `;
      document.body.appendChild(box);
    }

    box.textContent = message;
    box.style.background =
      type === "error"
        ? "rgba(180,40,40,.92)"
        : "rgba(20,145,105,.92)";
    box.style.color = "#fff";

    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.remove();
    }, 3500);
  };

  const formData = form => {
    const data = {};

    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });

    return data;
  };

  async function checkLogin() {
    try {
      const data = await api("/api/admin/check");

      if (data.isAdmin) {
        showPanel();
        await loadAll();
      } else {
        showLogin();
      }
    } catch (error) {
      showLogin();
    }
  }

  function showLogin() {
    const login = $("#loginScreen");
    const panel = $("#adminPanel");

    if (login) login.style.display = "";
    if (panel) panel.style.display = "none";
  }

  function showPanel() {
    const login = $("#loginScreen");
    const panel = $("#adminPanel");

    if (login) login.style.display = "none";
    if (panel) panel.style.display = "";
  }

  async function login() {
    const form = $("#loginForm");

    if (!form) return;

    const passwordInput =
      form.querySelector(
        'input[name="password"], input[type="password"]'
      );

    const password =
      passwordInput?.value?.trim() || "";

    if (!password) {
      showMessage("رمز مدیریت را وارد کنید.", "error");
      return;
    }

    const button =
      form.querySelector("button[type='submit']");

    if (button) {
      button.disabled = true;
      button.textContent = "در حال ورود...";
    }

    try {
      await api("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });

      showMessage("ورود موفق بود.");
      showPanel();
      await loadAll();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "ورود";
      }
    }
  }

  async function logout() {
    try {
      await api("/api/admin/logout", {
        method: "POST"
      });
    } catch (_) {}

    location.reload();
  }

  async function loadCategories() {
    categories = await api("/api/categories/all");
    renderCategories();
    fillCategorySelects();
  }

  async function loadSubcategories() {
    subcategories =
      await api("/api/subcategories/all");

    renderSubcategories();
    fillCategorySelects();
    fillSubcategorySelects();
  }

  async function loadServices() {
    services =
      await api("/api/services/all");

    renderServices();
    fillCategorySelects();
    fillSubcategorySelects();
  }

  async function loadAnnouncements() {
    announcements =
      await api("/api/announcements/all");

    renderAnnouncements();
  }

  async function loadReviews() {
    reviews =
      await api("/api/reviews/all");

    renderReviews();
  }

  async function loadSettings() {
    const data =
      await api("/api/contact-settings");

    fillSettings(data);
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

      Object.entries(mapping).forEach(
        ([key, selectors]) => {
          selectors.forEach(selector => {
            const element = $(selector);
            if (element) {
              element.textContent =
                data[key] ?? 0;
            }
          });
        }
      );
    } catch (_) {}
  }

  async function loadAll() {
    try {
      await Promise.all([
        loadCategories(),
        loadSubcategories(),
        loadServices(),
        loadAnnouncements(),
        loadReviews(),
        loadSettings(),
        loadStats()
      ]);
    } catch (error) {
      showMessage(
        "خطا در دریافت اطلاعات: " +
        error.message,
        "error"
      );
    }
  }

  function fillCategorySelects() {
    const selects = $$(
      'select[name="category_id"], #categorySelect, #serviceCategory'
    );

    selects.forEach(select => {
      const current = select.value;

      select.innerHTML =
        '<option value="">انتخاب دسته‌بندی</option>';

      categories.forEach(category => {
        const option =
          document.createElement("option");

        option.value = category.id;
        option.textContent = category.name;

        select.appendChild(option);
      });

      if (current) {
        select.value = current;
      }
    });
  }

  function fillSubcategorySelects() {
    const selects = $$(
      'select[name="subcategory_id"], #subcategorySelect, #serviceSubcategory'
    );

    selects.forEach(select => {
      const current = select.value;

      select.innerHTML =
        '<option value="">انتخاب زیردسته</option>';

      subcategories.forEach(sub => {
        const category =
          categories.find(
            c =>
              Number(c.id) ===
              Number(sub.category_id)
          );

        const option =
          document.createElement("option");

        option.value = sub.id;
        option.textContent =
          category
            ? `${category.name} — ${sub.name}`
            : sub.name;

        select.appendChild(option);
      });

      if (current) {
        select.value = current;
      }
    });
  }

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
      categories.map(category => `
        <div class="admin-item">
          <div class="admin-item-info">
            ${
              category.icon_url
                ? `<img src="${escapeHtml(category.icon_url)}" class="admin-item-icon">`
                : `<div class="admin-item-icon placeholder-icon">◈</div>`
            }

            <div>
              <strong>
                ${escapeHtml(category.name)}
              </strong>

              <small>
                ${escapeHtml(category.description || "")}
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
      `).join("");
  }

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
      subcategories.map(sub => {
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
                  ? `<img src="${escapeHtml(sub.icon_url)}" class="admin-item-icon">`
                  : `<div class="admin-item-icon placeholder-icon">◈</div>`
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
      }).join("");
  }

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
      services.map(service => `
        <div class="admin-item">
          <div class="admin-item-info">
            ${
              service.icon_url
                ? `<img src="${escapeHtml(service.icon_url)}" class="admin-item-icon">`
                : service.image_url
                  ? `<img src="${escapeHtml(service.image_url)}" class="admin-item-icon">`
                  : `<div class="admin-item-icon placeholder-icon">◎</div>`
            }

            <div>
              <strong>
                ${escapeHtml(service.title)}
              </strong>

              <small>
                ${
                  escapeHtml(
                    service.category_name ||
                    service.category ||
                    ""
                  )
                }

                ${
                  service.subcategory_name
                    ? " / " +
                      escapeHtml(
                        service.subcategory_name
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
      `).join("");
  }

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
      announcements.map(item => `
        <div class="admin-item">
          <div class="admin-item-info">
            <div class="admin-item-icon placeholder-icon">
              📢
            </div>

            <div>
              <strong>
                ${escapeHtml(item.title)}
              </strong>

              <small>
                ${escapeHtml(item.content)}
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
      `).join("");
  }

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
      reviews.map(review => `
        <div class="admin-item">
          <div class="admin-item-info">
            ${
              review.avatar
                ? `<img src="${escapeHtml(review.avatar)}" class="admin-item-icon">`
                : `<div class="admin-item-icon placeholder-icon">👤</div>`
            }

            <div>
              <strong>
                ${escapeHtml(review.customer_name)}
              </strong>

              <small>
                ${escapeHtml(review.content)}
              </small>

              <small>
                وضعیت:
                ${escapeHtml(review.status)}
              </small>
            </div>
          </div>

          <div class="admin-item-actions">
            <button
              type="button"
              data-approve-review="${review.id}"
            >
              تأیید
            </button>

            <button
              type="button"
              data-delete-review="${review.id}"
              class="danger"
            >
              حذف
            </button>
          </div>
        </div>
      `).join("");
  }

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

      if (input) {
        input.value = data[name] || "";
      }
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function saveForm(form, url, method = "POST") {
    const button =
      form.querySelector(
        'button[type="submit"]'
      );

    if (button) {
      button.disabled = true;
      button.dataset.originalText =
        button.textContent;
      button.textContent =
        "در حال ذخیره...";
    }

    try {
      const data = formData(form);

      await api(url, {
        method,
        body: JSON.stringify(data)
      });

      showMessage(
        method === "POST"
          ? "با موفقیت ثبت شد."
          : "با موفقیت ذخیره شد."
      );

      form.reset();

      editing = null;

      await loadAll();
    } catch (error) {
      showMessage(
        "ثبت نشد: " + error.message,
        "error"
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent =
          button.dataset.originalText ||
          "ذخیره";
      }
    }
  }

  function bindLogin() {
    const form = $("#loginForm");

    if (!form) return;

    form.addEventListener("submit", event => {
      event.preventDefault();
      login();
    });
  }

  function bindLogout() {
    $$(
      "#logoutBtn, [data-action='logout']"
    ).forEach(button => {
      button.addEventListener(
        "click",
        logout
      );
    });
  }

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
            id ? "PUT" : "POST"
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
            id ? "PUT" : "POST"
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
            id ? "PUT" : "POST"
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
            id ? "PUT" : "POST"
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

  function bindCategoryChanges() {
    $$(
      'select[name="category_id"], #categorySelect, #serviceCategory'
    ).forEach(select => {
      select.addEventListener(
        "change",
        () => {
          const target =
            document.querySelector(
              'select[name="subcategory_id"], #subcategorySelect, #serviceSubcategory'
            );

          if (!target) return;

          const categoryId =
            Number(select.value);

          target.innerHTML =
            '<option value="">انتخاب زیردسته</option>';

          subcategories
            .filter(
              sub =>
                Number(sub.category_id) ===
                categoryId
            )
            .forEach(sub => {
              const option =
                document.createElement(
                  "option"
                );

              option.value = sub.id;
              option.textContent =
                sub.name;

              target.appendChild(option);
            });
        }
      );
    });
  }

  function editCategory(id) {
    const item =
      categories.find(
        c => Number(c.id) === Number(id)
      );

    const form =
      $("#categoryForm");

    if (!item || !form) return;

    form.dataset.editId = item.id;

    Object.entries(item).forEach(
      ([key, value]) => {
        const input =
          form.querySelector(
            `[name="${key}"]`
          );

        if (input) {
          input.value = value ?? "";
        }
      }
    );

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

  function editSubcategory(id) {
    const item =
      subcategories.find(
        s => Number(s.id) === Number(id)
      );

    const form =
      $("#subcategoryForm");

    if (!item || !form) return;

    form.dataset.editId = item.id;

    Object.entries(item).forEach(
      ([key, value]) => {
        const input =
          form.querySelector(
            `[name="${key}"]`
          );

        if (input) {
          input.value = value ?? "";
        }
      }
    );

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

  function editService(id) {
    const item =
      services.find(
        s => Number(s.id) === Number(id)
      );

    const form =
      $("#serviceForm");

    if (!item || !form) return;

    form.dataset.editId = item.id;

    Object.entries(item).forEach(
      ([key, value]) => {
        const input =
          form.querySelector(
            `[name="${key}"]`
          );

        if (input) {
          input.value = value ?? "";
        }
      }
    );

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

  function editAnnouncement(id) {
    const item =
      announcements.find(
        a => Number(a.id) === Number(id)
      );

    const form =
      $("#announcementForm");

    if (!item || !form) return;

    form.dataset.editId = item.id;

    Object.entries(item).forEach(
      ([key, value]) => {
        const input =
          form.querySelector(
            `[name="${key}"]`
          );

        if (input) {
          input.value = value ?? "";
        }
      }
    );

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

  async function deleteItem(
    url,
    message = "حذف شود؟"
  ) {
    if (!confirm(message)) return;

    try {
      await api(url, {
        method: "DELETE"
      });

      showMessage("با موفقیت حذف شد.");
      await loadAll();
    } catch (error) {
      showMessage(
        "حذف نشد: " + error.message,
        "error"
      );
    }
  }

  async function approveReview(id) {
    const review =
      reviews.find(
        r => Number(r.id) === Number(id)
      );

    if (!review) return;

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
            status: "approved"
          })
        }
      );

      showMessage("نظر تأیید شد.");
      await loadAll();
    } catch (error) {
      showMessage(
        "تأیید نشد: " +
        error.message,
        "error"
      );
    }
  }

  function bindActions() {
    document.addEventListener(
      "click",
      event => {
        const target =
          event.target.closest(
            "[data-edit-category], [data-delete-category], [data-edit-subcategory], [data-delete-subcategory], [data-edit-service], [data-delete-service], [data-edit-announcement], [data-delete-announcement], [data-approve-review], [data-delete-review]"
          );

        if (!target) return;

        if (
          target.dataset.editCategory
        ) {
          editCategory(
            target.dataset.editCategory
          );
        }

        if (
          target.dataset.deleteCategory
        ) {
          deleteItem(
            `/api/categories/${target.dataset.deleteCategory}`,
            "این دسته‌بندی و اطلاعات وابسته حذف شود؟"
          );
        }

        if (
          target.dataset.editSubcategory
        ) {
          editSubcategory(
            target.dataset.editSubcategory
          );
        }

        if (
          target.dataset.deleteSubcategory
        ) {
          deleteItem(
            `/api/subcategories/${target.dataset.deleteSubcategory}`,
            "این زیردسته حذف شود؟"
          );
        }

        if (
          target.dataset.editService
        ) {
          editService(
            target.dataset.editService
          );
        }

        if (
          target.dataset.deleteService
        ) {
          deleteItem(
            `/api/services/${target.dataset.deleteService}`,
            "این سرویس حذف شود؟"
          );
        }

        if (
          target.dataset.editAnnouncement
        ) {
          editAnnouncement(
            target.dataset.editAnnouncement
          );
        }

        if (
          target.dataset.deleteAnnouncement
        ) {
          deleteItem(
            `/api/announcements/${target.dataset.deleteAnnouncement}`,
            "این اعلان حذف شود؟"
          );
        }

        if (
          target.dataset.approveReview
        ) {
          approveReview(
            target.dataset.approveReview
          );
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

          if (!selector?.startsWith("#"))
            return;

          const section =
            document.querySelector(
              selector
            );

          if (!section) return;

          event.preventDefault();

          $$(".admin-section, .panel-section")
            .forEach(item => {
              item.classList.remove(
                "active"
              );
            });

          section.classList.add("active");

          section.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }
      );
    });
  }

  bindLogin();
  bindLogout();
  bindForms();
  bindActions();
  bindNavigation();
  bindCategoryChanges();

  checkLogin();
});
