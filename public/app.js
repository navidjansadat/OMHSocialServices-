/* =========================================================
   OMH SOCIAL SERVICES
   Frontend Controller
   ========================================================= */

"use strict";

/* =========================================================
   CONFIG
   ========================================================= */

const CONFIG = {

  /*
   * این لینک‌ها را بعداً هم می‌توانی از همین قسمت تغییر بدهی.
   */

  whatsapp:
    "https://wa.me/93748070273",

  telegram:
    "https://t.me/omhsocial",

  whatsappChannel:
    "https://whatsapp.com/channel/0029VbC27wl9mrGcV1D6aa3O",

  whatsappGroup:
    "https://chat.whatsapp.com/LhwXxaXGEy5F4pq0GdqV5s?s=cl&p=a&ilr=0",

  telegramChannel:
    "https://t.me/OMHSocialServices",

  telegramUser:
    "https://t.me/omhsocial"

};


/* =========================================================
   SOCIAL SERVICES
   =========================================================
   قیمت‌ها عمداً خالی گذاشته شده‌اند.
   بعداً می‌توانی هر سرویس را از پنل مدیریت اضافه/تغییر بدهی.
   ========================================================= */

const defaultServices = [

  {
    id: "facebook",
    title: "Facebook Service",
    subtitle: "خدمات حرفه‌ای فیسبوک",
    icon: "📘",

    items: [
      {
        name: "Facebook Followers",
        description: "افزایش فالوور فیسبوک",
        price: ""
      },

      {
        name: "Facebook Views",
        description: "افزایش بازدید پست و ویدیو",
        price: ""
      },

      {
        name: "Facebook Likes",
        description: "افزایش لایک پست‌ها",
        price: ""
      },

      {
        name: "Facebook Comments",
        description: "افزایش کامنت",
        price: ""
      }
    ]
  },


  {
    id: "instagram",
    title: "Instagram Service",
    subtitle: "خدمات حرفه‌ای اینستاگرام",
    icon: "📸",

    items: [
      {
        name: "Instagram Followers",
        description: "افزایش فالوور اینستاگرام",
        price: ""
      },

      {
        name: "Instagram Views",
        description: "افزایش بازدید Reels و پست",
        price: ""
      },

      {
        name: "Instagram Likes",
        description: "افزایش لایک",
        price: ""
      },

      {
        name: "Instagram Comments",
        description: "افزایش کامنت",
        price: ""
      }
    ]
  },


  {
    id: "whatsapp",
    title: "WhatsApp Service",
    subtitle: "خدمات کانال و گروپ واتساپ",
    icon: "💬",

    items: [
      {
        name: "WhatsApp Followers",
        description: "افزایش دنبال‌کننده کانال",
        price: ""
      },

      {
        name: "WhatsApp Members",
        description: "افزایش اعضای گروپ",
        price: ""
      },

      {
        name: "WhatsApp Views",
        description: "افزایش بازدید محتوا",
        price: ""
      }
    ]
  },


  {
    id: "telegram",
    title: "Telegram Service",
    subtitle: "خدمات کانال و گروپ تلگرام",
    icon: "✈️",

    items: [
      {
        name: "Telegram Members",
        description: "افزایش ممبر کانال و گروپ",
        price: ""
      },

      {
        name: "Telegram Views",
        description: "افزایش بازدید پست",
        price: ""
      },

      {
        name: "Telegram Reactions",
        description: "افزایش ری‌اکشن پست",
        price: ""
      }
    ]
  },


  {
    id: "tiktok",
    title: "TikTok Service",
    subtitle: "خدمات حرفه‌ای تیک‌تاک",
    icon: "🎵",

    items: [
      {
        name: "TikTok Followers",
        description: "افزایش فالوور تیک‌تاک",
        price: ""
      },

      {
        name: "TikTok Views",
        description: "افزایش بازدید ویدیو",
        price: ""
      },

      {
        name: "TikTok Likes",
        description: "افزایش لایک ویدیو",
        price: ""
      },

      {
        name: "TikTok Comments",
        description: "افزایش کامنت",
        price: ""
      }
    ]
  }

];


/* =========================================================
   HELPERS
   ========================================================= */

const $ = selector =>
  document.querySelector(selector);


const $$ = selector =>
  [...document.querySelectorAll(selector)];


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


/* =========================================================
   LOAD SETTINGS
   ========================================================= */

function loadLocalSettings() {

  try {

    const saved =
      localStorage.getItem("omh_site_settings");

    if (!saved) return {};

    return JSON.parse(saved);

  } catch (error) {

    console.warn(
      "OMH settings could not be loaded:",
      error
    );

    return {};
  }

}


/* =========================================================
   SERVICES
   ========================================================= */

function loadServices() {

  const grid =
    $("#serviceGrid");

  if (!grid) return;


  let services = defaultServices;


  /*
   * اگر پنل مدیریت قبلاً خدمات را در LocalStorage
   * ذخیره کرده باشد، همان استفاده می‌شود.
   */

  try {

    const saved =
      localStorage.getItem("omh_services");

    if (saved) {

      const parsed =
        JSON.parse(saved);

      if (
        Array.isArray(parsed) &&
        parsed.length
      ) {

        services = parsed;

      }

    }

  } catch (error) {

    console.warn(
      "Could not load services:",
      error
    );

  }


  grid.innerHTML =
    services
      .map(service => {

        const items =
          Array.isArray(service.items)
            ? service.items
            : [];


        return `

          <div
            class="service-group reveal"
            data-service-group="${escapeHTML(service.id)}"
          >

            <div class="group-head">

              <div class="group-title">

                <div class="group-icon">
                  ${escapeHTML(service.icon || "📱")}
                </div>

                <div>

                  <h3>
                    ${escapeHTML(service.title)}
                  </h3>

                  <p>
                    ${escapeHTML(service.subtitle || "")}
                  </p>

                </div>

              </div>

            </div>


            <div class="service-cards">

              ${
                items.length
                  ? items.map(renderServiceCard).join("")
                  : `
                    <div class="card">

                      <div class="icon">
                        ⚙️
                      </div>

                      <h4>
                        سرویس جدید
                      </h4>

                      <p>
                        این بخش از پنل مدیریت قابل تنظیم است.
                      </p>

                    </div>
                  `
              }

            </div>

          </div>

        `;

      })
      .join("");


  attachOrderButtons();

}


function renderServiceCard(item) {

  const price =
    item.price
      ? `
        <strong class="price">
          ${escapeHTML(item.price)}
        </strong>
      `
      : `
        <span class="muted">
          قیمت از پنل مدیریت تعیین می‌شود
        </span>
      `;


  return `

    <article class="card">

      <div class="icon">
        📊
      </div>

      <h4>
        ${escapeHTML(item.name || "Service")}
      </h4>

      <p>
        ${escapeHTML(item.description || "")}
      </p>

      ${price}

      <a
        href="#contact"
        class="order-link"
        data-service="${escapeHTML(item.name || "")}"
      >

        سفارش این سرویس

        <span>
          ←
        </span>

      </a>

    </article>

  `;

}


/* =========================================================
   ORDER BUTTONS
   ========================================================= */

function attachOrderButtons() {

  $$(".order-link, .service-request")
    .forEach(button => {

      button.addEventListener(
        "click",
        function () {

          const service =
            this.dataset.service || "";

          const serviceInput =
            document.querySelector(
              '#orderForm input[name="service"]'
            );


          if (serviceInput) {

            serviceInput.value =
              service;

          }

        }
      );

    });

}


/* =========================================================
   CONTACT LINKS
   ========================================================= */

function setupContactLinks() {

  const wa = $("#wa");
  const tg = $("#tg");
  const wac = $("#wac");
  const tgc = $("#tgc");
  const wag = $("#wag");
  const tgp = $("#tgp");


  if (wa)
    wa.href = CONFIG.whatsapp;


  if (tg)
    tg.href = CONFIG.telegram;


  if (wac)
    wac.href = CONFIG.whatsappChannel;


  if (tgc)
    tgc.href = CONFIG.telegramChannel;


  if (wag)
    wag.href = CONFIG.whatsappGroup;


  if (tgp)
    tgp.href = CONFIG.telegramUser;

}


/* =========================================================
   WHATSAPP ORDER
   ========================================================= */

function buildWhatsAppMessage(data) {

  return `سلام، می‌خواهم سفارش ثبت کنم.

نام:
${data.name || "-"}

سرویس:
${data.service || "-"}

تعداد:
${data.quantity || "-"}

شماره/آیدی تماس:
${data.contact || "-"}

توضیحات:
${data.message || "-"}

از طریق سایت OMH Social Services`;


}


function openWhatsAppOrder(data) {

  const message =
    encodeURIComponent(
      buildWhatsAppMessage(data)
    );


  const number =
    CONFIG.whatsapp
      .replace("https://wa.me/", "")
      .replace(/\D/g, "");


  window.open(
    `https://wa.me/${number}?text=${message}`,
    "_blank"
  );

}


/* =========================================================
   TELEGRAM ORDER
   ========================================================= */

function openTelegramOrder() {

  window.open(
    CONFIG.telegram,
    "_blank"
  );

}


/* =========================================================
   ORDER FORM
   ========================================================= */

function setupOrderForm() {

  const form =
    $("#orderForm");

  if (!form) return;


  form.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();


      const formData =
        new FormData(form);


      const data = {

        name:
          formData.get("name"),

        contact:
          formData.get("contact"),

        service:
          formData.get("service"),

        quantity:
          formData.get("quantity"),

        message:
          formData.get("message")

      };


      const message =
        $("#orderMsg");


      if (message) {

        message.textContent =
          "در حال انتقال به WhatsApp...";

      }


      openWhatsAppOrder(data);


      setTimeout(() => {

        if (message) {

          message.textContent =
            "اگر WhatsApp باز نشد، از دکمه WhatsApp در بخش ارتباط با ما استفاده کنید.";

        }

      }, 1500);

    }
  );

}


/* =========================================================
   REVIEWS
   ========================================================= */

function getReviews() {

  try {

    const saved =
      localStorage.getItem("omh_reviews");

    if (saved) {

      const parsed =
        JSON.parse(saved);

      if (Array.isArray(parsed))
        return parsed;

    }

  } catch (error) {

    console.warn(
      "Could not load reviews:",
      error
    );

  }


  return [

    {
      name: "مشتری OMH",
      rating: 5,
      comment:
        "خدمات سریع و برخورد بسیار خوب. تشکر از تیم OMH."
    },

    {
      name: "مشتری OMH",
      rating: 5,
      comment:
        "سفارش من به‌صورت منظم انجام شد و از خدمات راضی هستم."
    }

  ];

}


function renderStars(rating) {

  const count =
    Math.max(
      1,
      Math.min(
        5,
        Number(rating) || 5
      )
    );


  return "★".repeat(count);

}


function renderReviews() {

  const container =
    $("#reviewList");

  if (!container) return;


  const reviews =
    getReviews();


  if (!reviews.length) {

    container.innerHTML = `

      <div class="review">

        <b>
          هنوز نظری ثبت نشده است.
        </b>

        <p>
          اولین نفری باشید که تجربه خود را ثبت می‌کند.
        </p>

      </div>

    `;

    return;

  }


  container.innerHTML =
    reviews
      .slice(0, 8)
      .map(review => `

        <article class="review">

          <b>
            ${escapeHTML(review.name || "مشتری")}
          </b>

          <div class="stars">
            ${renderStars(review.rating)}
          </div>

          <p>
            ${escapeHTML(review.comment || "")}
          </p>

        </article>

      `)
      .join("");

}


/* =========================================================
   REVIEW FORM
   ========================================================= */

function setupReviewForm() {

  const form =
    $("#reviewForm");

  if (!form) return;


  form.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();


      const formData =
        new FormData(form);


      const review = {

        name:
          formData.get("name"),

        rating:
          Number(formData.get("rating")),

        comment:
          formData.get("comment"),

        date:
          new Date().toISOString()

      };


      try {

        const reviews =
          getReviews();


        reviews.unshift(review);


        localStorage.setItem(
          "omh_reviews",
          JSON.stringify(
            reviews
          )
        );


        renderReviews();


        form.reset();


        const msg =
          $("#reviewMsg");


        if (msg) {

          msg.textContent =
            "نظر شما با موفقیت ثبت شد.";

        }

      } catch (error) {

        console.error(error);

        const msg =
          $("#reviewMsg");


        if (msg) {

          msg.textContent =
            "ثبت نظر انجام نشد. دوباره تلاش کنید.";

        }

      }

    }
  );

}


/* =========================================================
   SETTINGS
   ========================================================= */

function applySettings() {

  const settings =
    loadLocalSettings();


  if (
    settings.brand &&
    $("#brand")
  ) {

    $("#brand").textContent =
      settings.brand;

  }


  if (
    settings.whatsapp
  ) {

    CONFIG.whatsapp =
      settings.whatsapp;

  }


  if (
    settings.telegram
  ) {

    CONFIG.telegram =
      settings.telegram;

  }


  if (
    settings.whatsappChannel
  ) {

    CONFIG.whatsappChannel =
      settings.whatsappChannel;

  }


  if (
    settings.whatsappGroup
  ) {

    CONFIG.whatsappGroup =
      settings.whatsappGroup;

  }


  if (
    settings.telegramChannel
  ) {

    CONFIG.telegramChannel =
      settings.telegramChannel;

  }


  if (
    settings.telegramUser
  ) {

    CONFIG.telegramUser =
      settings.telegramUser;

  }

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function setupMobileMenu() {

  const button =
    $(".mobile-menu-btn");

  const nav =
    $(".main-nav");

  if (!button || !nav) return;


  button.addEventListener(
    "click",
    () => {

      nav.classList.toggle(
        "mobile-open"
      );

    }
  );


  nav.querySelectorAll("a")
    .forEach(link => {

      link.addEventListener(
        "click",
        () => {

          nav.classList.remove(
            "mobile-open"
          );

        }
      );

    });

}


/* =========================================================
   SMOOTH SCROLL
   ========================================================= */

function setupSmoothLinks() {

  $$('a[href^="#"]')
    .forEach(link => {

      link.addEventListener(
        "click",
        function (event) {

          const id =
            this.getAttribute("href");


          if (
            !id ||
            id === "#"
          ) return;


          const target =
            document.querySelector(id);


          if (!target) return;


          event.preventDefault();


          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }
      );

    });

}


/* =========================================================
   SCROLL REVEAL
   ========================================================= */

function setupReveal() {

  const elements =
    $$(".reveal");


  if (!elements.length)
    return;


  if (
    !("IntersectionObserver" in window)
  ) {

    elements.forEach(
      element =>
        element.style.opacity = "1"
    );

    return;

  }


  const observer =
    new IntersectionObserver(
      entries => {

        entries.forEach(entry => {

          if (
            entry.isIntersecting
          ) {

            entry.target.style.opacity =
              "1";

            entry.target.style.transform =
              "translateY(0)";

            observer.unobserve(
              entry.target
            );

          }

        });

      },
      {
        threshold: .08
      }
    );


  elements.forEach(element => {

    element.style.opacity = "0";

    element.style.transform =
      "translateY(25px)";

    element.style.transition =
      "opacity .7s ease, transform .7s ease";

    observer.observe(element);

  });

}


/* =========================================================
   YEAR
   ========================================================= */

function setYear() {

  const year =
    $("#year");

  if (year) {

    year.textContent =
      new Date().getFullYear();

  }

}


/* =========================================================
   PREVENT BROKEN LINKS
   ========================================================= */

function setupExternalLinks() {

  $$('a[target="_blank"]')
    .forEach(link => {

      link.setAttribute(
        "rel",
        "noopener noreferrer"
      );

    });

}


/* =========================================================
   INIT
   ========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    applySettings();

    setupContactLinks();

    loadServices();

    renderReviews();

    setupOrderForm();

    setupReviewForm();

    setupMobileMenu();

    setupSmoothLinks();

    setupExternalLinks();

    setYear();

    setupReveal();

  }
);
