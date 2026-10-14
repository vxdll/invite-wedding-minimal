/* =========================================================
   script.js — читает config.json и заполняет страницу.
   Дизайн живёт в index.html + style.css, данные — в config.json.
   Этот файл под клиента НЕ меняется.
   ========================================================= */

// Аналог async Main() в C#: загрузили конфиг → отрисовали всё.
async function main() {
  let config;
  try {
    // fetch работает только через веб-сервер (GitHub Pages, Netlify
    // или локально `python -m http.server`). При открытии файла
    // двойным кликом (file://) браузер запрещает чтение config.json.
    const response = await fetch("config.json", { cache: "no-store" });
    config = await response.json();
  } catch (err) {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:sans-serif">Не удалось загрузить config.json. ' +
      "Откройте сайт через веб-сервер: <code>python -m http.server</code>, затем http://localhost:8000</p>";
    console.error(err);
    return;
  }

  applyTheme(config.theme);
  renderMeta(config.meta);
  renderCover(config.couple, config.event);
  renderInvitation(config.invitation);
  renderCountdown(config.event);
  renderCalendar(config.event, config.couple);
  renderProgram(config.program);
  renderLocation(config.location);
  renderDresscode(config.dresscode);
  renderGallery(config.gallery);
  renderWishes(config.wishes);
  renderRsvp(config.rsvp);
  renderContacts(config.contacts);
  renderFooter(config.footer);

  hideEmptyBlocks(config);
  setupReveal();
}

/* ---------- Вспомогательные функции ---------- */

// Короткая запись document.getElementById
const $ = (id) => document.getElementById(id);

// Создать элемент с классом и текстом. textContent (а не innerHTML)
// защищает от того, что в данных окажется HTML-код.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Пустой ли раздел конфига: нет ключа, пустой массив или пустая строка
function isEmpty(value) {
  return value == null || value === "" || (Array.isArray(value) && value.length === 0);
}

// Блоки с атрибутом data-block="ключ" скрываются, если в конфиге этого ключа нет.
// Так одна и та же HTML-разметка подходит и для полного, и для урезанного тарифа.
function hideEmptyBlocks(config) {
  document.querySelectorAll("[data-block]").forEach((block) => {
    if (isEmpty(config[block.dataset.block])) block.hidden = true;
  });
}

/* ---------- Рендер блоков ---------- */

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement.style;
  // Каждая пара ключ/значение → CSS-переменная: accent → --accent
  const map = { background: "--bg", surface: "--surface", text: "--text", muted: "--muted", accent: "--accent" };
  for (const [key, cssVar] of Object.entries(map)) {
    if (theme[key]) root.setProperty(cssVar, theme[key]);
  }
}

function renderMeta(meta) {
  if (!meta) return;
  if (meta.title) document.title = meta.title;
  if (meta.description) document.querySelector('meta[name="description"]').content = meta.description;
}

function renderCover(couple, event) {
  if (!couple) return;
  $("name1").textContent = couple.name1;
  $("name2").textContent = couple.name2;
  $("coverDate").textContent = event?.dateText || "";

  if (couple.coverPhoto) {
    $("coverPhoto").style.backgroundImage = `url("${couple.coverPhoto}")`;
  } else {
    document.querySelector(".cover").classList.add("cover--no-photo");
  }
}

function renderInvitation(inv) {
  if (!inv) return;
  $("inviteTitle").textContent = inv.title;
  $("inviteText").textContent = inv.text;
}

function renderCountdown(event) {
  if (!event?.date) { $("countdown").hidden = true; return; }
  const target = new Date(event.date).getTime();

  function tick() {
    let diff = Math.max(0, target - Date.now());   // миллисекунды до события
    const days = Math.floor(diff / 86400000);  diff %= 86400000;
    const hours = Math.floor(diff / 3600000);  diff %= 3600000;
    const minutes = Math.floor(diff / 60000);  diff %= 60000;
    const seconds = Math.floor(diff / 1000);

    $("cdDays").textContent = days;
    $("cdHours").textContent = String(hours).padStart(2, "0");
    $("cdMinutes").textContent = String(minutes).padStart(2, "0");
    $("cdSeconds").textContent = String(seconds).padStart(2, "0");
  }
  tick();
  setInterval(tick, 1000);   // обновлять раз в секунду
}

function renderCalendar(event, couple) {
  if (!event?.date) return;

  // Берём год/месяц/день прямо из строки "2027-06-12T...", чтобы
  // часовой пояс гостя не сдвинул день.
  const [year, month, day] = event.date.slice(0, 10).split("-").map(Number);
  const months = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

  $("calMonth").textContent = `${months[month - 1]} ${year}`;
  $("calWeekday").textContent = event.weekday || "";

  const cal = $("calendar");
  ["пн","вт","ср","чт","пт","сб","вс"].forEach((d) => cal.append(el("div", "calendar__head", d)));

  // getDay(): 0 = воскресенье. Переводим в «понедельник = 0».
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let i = 0; i < firstWeekday; i++) cal.append(el("div", "calendar__day"));
  for (let d = 1; d <= daysInMonth; d++) {
    cal.append(el("div", "calendar__day" + (d === day ? " calendar__day--event" : ""), String(d)));
  }

  $("addToCalendar").addEventListener("click", () => downloadIcs(event, couple));
}

// Файл .ics открывается в календаре телефона (iPhone, Android, Outlook)
function downloadIcs(event, couple) {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + 8 * 3600000);           // длительность 8 часов
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//invite//RU", "BEGIN:VEVENT",
    `UID:${fmt(start)}-invite`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:Свадьба: ${couple.name1} и ${couple.name2}`,
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");

  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  link.download = "wedding.ics";
  link.click();
}

function renderProgram(program) {
  if (isEmpty(program)) return;
  const list = $("timeline");
  program.forEach((item) => {
    const li = el("li");
    const body = el("div", "timeline__body");
    body.append(el("div", "timeline__title", item.title));
    if (item.note) body.append(el("div", "timeline__note", item.note));
    li.append(el("div", "timeline__time", item.time), body);
    list.append(li);
  });
}

function renderLocation(loc) {
  if (!loc) return;
  $("placeName").textContent = loc.name;
  $("placeAddress").textContent = loc.address;
  if (loc.photo) $("placePhoto").style.backgroundImage = `url("${loc.photo}")`;
  else $("placePhoto").hidden = true;
  if (loc.mapUrl) $("mapLink").href = loc.mapUrl;
  else $("mapLink").hidden = true;
}

function renderDresscode(dc) {
  if (!dc) return;
  $("dressText").textContent = dc.text;
  (dc.colors || []).forEach((color) => {
    const dot = el("span");
    dot.style.background = color;
    $("palette").append(dot);
  });
}

function renderGallery(photos) {
  if (isEmpty(photos)) return;
  photos.forEach((src) => {
    const ph = el("div", "photo");
    ph.style.backgroundImage = `url("${src}")`;
    $("gallery").append(ph);
  });
}

function renderWishes(wishes) {
  if (isEmpty(wishes)) return;
  wishes.forEach((text) => $("wishes").append(el("p", "", text)));
}

function renderRsvp(rsvp) {
  if (!rsvp) return;
  $("rsvpDeadline").textContent = rsvp.deadlineText || "";

  // Чекбоксы напитков из списка в конфиге
  if (isEmpty(rsvp.drinks)) $("drinksField").hidden = true;
  (rsvp.drinks || []).forEach((drink) => {
    const label = el("label", "choice");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.name = "drinks";
    box.value = drink;
    label.append(box, " " + drink);
    $("drinks").append(label);
  });

  const form = $("rsvpForm");
  const status = $("rsvpStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();                       // не перезагружать страницу

    const data = new FormData(form);
    if (!data.get("name")?.trim() || !data.get("attend")) {
      setStatus("Пожалуйста, укажите имя и ответ о присутствии", "err");
      return;
    }

    // Собираем плоский объект: несколько напитков → одна строка через запятую
    const payload = {
      name: data.get("name").trim(),
      attend: data.get("attend") === "yes" ? "Придёт" : "Не придёт",
      guests: data.get("guests"),
      drinks: data.getAll("drinks").join(", "),
      comment: data.get("comment") || ""
    };

    if (!rsvp.endpoint) {
      // Шаг 3 ещё не подключён — показываем, что форма работает
      console.log("RSVP (демо):", payload);
      setStatus("Спасибо! Ваш ответ получен 🤍", "ok");
      form.reset();
      return;
    }

    const button = form.querySelector("button");
    button.disabled = true;
    try {
      // Отправка в Google Apps Script (подключим на шаге 3).
      // mode: "no-cors" — Google не отдаёт CORS-заголовки, ответ читать нельзя,
      // но данные доходят.
      await fetch(rsvp.endpoint, { method: "POST", mode: "no-cors", body: new URLSearchParams(payload) });
      setStatus("Спасибо! Ваш ответ получен 🤍", "ok");
      form.reset();
    } catch (err) {
      setStatus("Не получилось отправить. Проверьте интернет и попробуйте ещё раз", "err");
    } finally {
      button.disabled = false;
    }
  });

  function setStatus(text, type) {
    status.textContent = text;
    status.className = "form__status form__status--" + type;
  }
}

function renderContacts(contacts) {
  if (isEmpty(contacts)) return;
  contacts.forEach((c) => {
    const li = el("li");
    const a = el("a", "", c.phone);
    a.href = "tel:" + c.phone.replace(/[^\d+]/g, "");   // кликабельный номер
    li.append(a, el("small", "", c.name));
    $("contacts").append(li);
  });
}

function renderFooter(text) {
  if (text) $("footerText").textContent = text;
}

// Блоки .reveal плавно появляются, когда доезжают до экрана
function setupReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
}

main();
