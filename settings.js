// ===== Settings constants & runtime state =====
const APP_SETTINGS_KEY = "appSettings";
const UI_LANGUAGE_KEY = "uiLanguage";
const WITHDRAW_CACHE_INDEX_KEY = "cachedWithdrawStatIndex";
const WITHDRAW_CACHE_LEGACY_KEY = "cachedWithdrawStatById";
const WITHDRAW_CACHE_PREFIX = "cachedWithdrawStat:";
const DEFAULT_SETTINGS = {
  theme: "ddd-light",
  themeVersion: 2,
  top_blocks: ["today", "week_sales"],
  chart_style: "classic",
  avgLine: false,
  trendLine: false,
  autoRefresh: false
};
const AVAILABLE_TOP_BLOCKS = new Set([
  "today",
  "week_sales",
  "month_sales",
  "site_split",
  "top30",
  "top7",
  "year_total",
  "next_rank"
]);

const PREVIEW_SERIES = [38, 52, 44, 84, 58, 36, 49, 72, 77, 64, 42, 47, 63, 57, 41, 82, 69, 65, 48, 43, 61, 88, 73, 81, 67, 79];
const RANKS = [
  { key: "normal", title: "Обычный статус", threshold: 0, icon: "" },
  { key: "amber", title: "Янтарь", threshold: 100, icon: "https://3ddd.ru/ng-assets/images/user_rating/yantar.svg" },
  { key: "amethyst", title: "Аметист", threshold: 250, icon: "https://3ddd.ru/ng-assets/images/user_rating/ametist.svg" },
  { key: "sapphire", title: "Сапфир", threshold: 500, icon: "https://3ddd.ru/ng-assets/images/user_rating/sapfir.svg" },
  { key: "emerald", title: "Изумруд", threshold: 1000, icon: "https://3ddd.ru/ng-assets/images/user_rating/izumrud.svg" },
  { key: "ruby", title: "Рубин", threshold: 2000, icon: "https://3ddd.ru/ng-assets/images/user_rating/rubin.svg" },
  { key: "topaz", title: "Топаз", threshold: 3000, icon: "https://3ddd.ru/ng-assets/images/user_rating/topaz.svg" },
  { key: "diamond", title: "Бриллиант", threshold: 5000, icon: "https://3ddd.ru/ng-assets/images/user_rating/briliant.svg" },
  { key: "bronze", title: "Бронза", threshold: 8000, icon: "https://3ddd.ru/ng-assets/images/user_rating/bronze.svg" },
  { key: "silver", title: "Серебро", threshold: 12000, icon: "https://3ddd.ru/ng-assets/images/user_rating/silver.svg" },
  { key: "gold", title: "Золото", threshold: 16000, icon: "https://3ddd.ru/ng-assets/images/user_rating/gold.svg" },
  { key: "aquamarine", title: "Звезда аквамарин", threshold: 30000, icon: "https://3ddd.ru/ng-assets/images/user_rating/star_aquamarin.svg" },
  { key: "goldstar", title: "Золотая звезда", threshold: 60000, icon: "https://3ddd.ru/ng-assets/images/user_rating/star_gold.svg" },
  { key: "blackstar", title: "Чёрная звезда", threshold: 100000, icon: "https://3ddd.ru/ng-assets/images/user_rating/star_black.svg" }
];
let currentSettings = { ...DEFAULT_SETTINGS };
let cachedDashboard = null;
let cachedSalesObjects = [];
let currentLanguage = "ru";
let currentFrontendBaseUrl = "https://3ddd.ru";
let currentLanguageMode = "auto";

const I18N = {
  ru: {
    pageTitle: "3DStat — Настройки",
    heroTitle: "Настройки приложения",
    heroSub: "Здесь собраны визуальные и диагностические настройки приложения: темы, верхние блоки, стиль графика и инструменты для диагностики.",
    topBlocksTitle: "Блоки вверху приложения",
    topBlocksSub: "Можно выбрать только 2 блока.",
    themesTitle: "Цвета",
    themesSub: "Четыре базовые темы: светлая палитра 3DDD, глубокая Navy, нейтральная Dark и нежная Pinky.",
    themeLightMetric: "Заработано сегодня",
    themePinkyMetric: "Заработано сегодня",
    themeNavyMetric: "Заработано за 7 дней",
    themeDarkMetric: "Заработано за 30 дней",
    chartStyleTitle: "Стиль графика",
    chartStyleSub: "Выбери стиль основного графика.",
    chartClassic: "Классическая линия",
    chartSmooth: "Плавная линия",
    chartBar: "Столбцы",
    avgLineTitle: "Включить среднюю линию",
    avgLineSub: "Показывать усредняющую линию поверх основного графика.",
    trendLineTitle: "Включить линию тренда",
    trendLineSub: "Показывает общее направление графика за выбранный период: рост, снижение или стабильность.",
    toggleMutualHint: "Среднюю линию и линию тренда нельзя включить одновременно.",
    autoRefreshTitle: "Автообновление",
    autoRefreshSub: "Автообновление последних данных",
    inDevelopment: "В разработке",
    debugTitle: "Диагностика",
    debugSub: "Открывает диагностический блок с полезными данными для разбора багов и зависаний.",
    debugToggleSub: "Открывает аккордеон со служебными данными приложения и сохранённой статистикой.",
    debugSummary: "Диагностические данные",
    debugLoading: "Загрузка диагностики...",
    debugRefresh: "Обновить диагностику",
    debugCopy: "Скопировать",
    telegram: "Telegram",
    telegramAria: "Открыть Telegram-канал",
    footerCopyPrefix: "© Кирилл",
    footerCopySuffix: "Брагин 2026",
    debugNoData: "Нет диагностических данных.",
    debugSavedError: "Последняя сохранённая ошибка",
    debugSectionErrors: "Ошибки",
    debugSectionEvents: "События",
    debugSectionNetwork: "Сеть",
    debugSectionAudit: "Audit верхних блоков",
    debugSectionContext: "Контекст",
    debugNoErrors: "Ошибок пока не зафиксировано.",
    debugCurrentStep: "Текущий шаг",
    debugLastSuccess: "Последний успешный шаг",
    debugNoActiveRefresh: "Нет активного обновления",
    debugNoEvents: "Событий пока нет.",
    debugNoRequests: "История запросов пока пуста.",
    debugStatus: "Статус",
    debugCheckedBlocks: "Проверено блоков",
    debugPopupCards: "верхние карточки popup",
    debugWarnings: "Warnings",
    debugCalcMismatch: "расхождения в расчётах",
    debugAuditEmpty: "Audit верхних блоков пока пуст.",
    debugTokenSource: "Источник токена",
    debugNotSeen: "Не замечен",
    debugCache: "Кэш",
    debugCachePresent: "dashboard есть",
    debugCacheMissing: "dashboard нет",
    debugNotUpdated: "Не обновлялся",
    debugApiRequests: "API запросы",
    debugSessionTotal: "Всего за текущую сессию",
    debugFrontendSession: "Frontend-сессия",
    debugNotDetected: "Не определён",
    debugIncomeRows: "Строки из income",
    debugWithdrawRows: "Строки из withdraw_stat",
    debugTotalCache: "Всего из кэша",
    debugCacheShort: "кэш",
    debugNetworkShort: "сеть",
    debugUnknownShort: "неизвестно",
    debugThrottle: "Throttle",
    debugApiStats: "API stats",
    debugRawSettings: "Settings",
    debugRawFrontendSession: "Frontend session",
    debugCachedMeta: "Cached meta",
    debugActual: "Actual",
    debugExpected: "Expected",
    debugLoadError: "Ошибка загрузки диагностики",
    debugFetchFailed: "Не удалось получить диагностику",
    footerNote: "Настройки сохраняются локально и сразу применяются там, где логика уже подключена.",
    themeSaved: "Сохранено",
    topBlockLimit: "Можно выбрать только 2 блока",
    debugUpdated: "Диагностика обновлена",
    debugCopied: "Диагностика скопирована",
    debugCopyFailed: "Не удалось скопировать",
    settingsLoading: "Загружаем настройки...",
    noData: "Нет данных",
    salesWord: "продаж",
    siteSplitTitle: "Продаж за 30 дней",
    nextRankTitle: "Продаж до следующего уровня",
    currentRank: "Текущий",
    maxRank: "Максимум",
    maxReached: "Круче некуда!",
    totalSales: "всего продаж",
    todayRevenue: "Заработано сегодня",
    weekRevenue: "Заработано за 7 дней",
    monthRevenue: "Заработано за 30 дней",
    ytdRevenue: "Заработано с начала года",
    topModel30: "Топ модель за 30 дней",
    topModel7: "Топ модель за 7 дней",
    vsPrevDay: "к предыдущим суткам",
    vsPrev7d: "к предыдущим 7 дням",
    vsPrev30d: "к предыдущим 30 дням",
    avgMonthIncome: "средний доход в месяц",
    rank_normal: "Обычный статус",
    rank_amber: "Янтарь",
    rank_amethyst: "Аметист",
    rank_sapphire: "Сапфир",
    rank_emerald: "Изумруд",
    rank_ruby: "Рубин",
    rank_topaz: "Топаз",
    rank_diamond: "Бриллиант",
    rank_bronze: "Бронза",
    rank_silver: "Серебро",
    rank_gold: "Золото",
    rank_aquamarine: "Звезда аквамарин",
    rank_goldstar: "Золотая звезда",
    rank_blackstar: "Чёрная звезда",
    rankBeyondMax: "Круче только яйца",
    languageButtonTitle: "Переключить язык: авто / русский / английский",
    languageChanged: "Язык интерфейса: {mode}",
    languageModeAuto: "Авто",
    languageModeRu: "Русский",
    languageModeEn: "English"
  },
  en: {
    pageTitle: "3DStat — Settings",
    heroTitle: "App settings",
    heroSub: "This page contains the visual and diagnostic settings of the app: themes, top blocks, chart style, and debugging tools.",
    topBlocksTitle: "Top blocks in the app",
    topBlocksSub: "You can select only 2 blocks.",
    themesTitle: "Themes",
    themesSub: "Four base themes: the light 3DDD palette, deep Navy, neutral Dark, and soft Pinky.",
    themeLightMetric: "Revenue today",
    themePinkyMetric: "Revenue today",
    themeNavyMetric: "Revenue for 7 days",
    themeDarkMetric: "Revenue for 30 days",
    chartStyleTitle: "Chart style",
    chartStyleSub: "Choose the style of the main chart.",
    chartClassic: "Classic line",
    chartSmooth: "Smooth line",
    chartBar: "Bars",
    avgLineTitle: "Enable average line",
    avgLineSub: "Show an average line over the main chart.",
    trendLineTitle: "Enable trend line",
    trendLineSub: "Shows the overall direction of the chart for the selected period: growth, decline, or stability.",
    toggleMutualHint: "The average line and the trend line cannot be enabled at the same time.",
    autoRefreshTitle: "Auto refresh",
    autoRefreshSub: "Automatically refresh the latest data",
    inDevelopment: "In development",
    debugTitle: "Diagnostics",
    debugSub: "Opens a diagnostic block with useful data for investigating bugs and stalls.",
    debugToggleSub: "Opens an accordion with service data from the app and saved statistics.",
    debugSummary: "Diagnostic data",
    debugLoading: "Loading diagnostics...",
    debugRefresh: "Refresh diagnostics",
    debugCopy: "Copy",
    telegram: "Telegram",
    telegramAria: "Open Telegram channel",
    footerCopyPrefix: "© Kirill",
    footerCopySuffix: "Bragin 2026",
    debugNoData: "No diagnostic data.",
    debugSavedError: "Last saved error",
    debugSectionErrors: "Errors",
    debugSectionEvents: "Events",
    debugSectionNetwork: "Network",
    debugSectionAudit: "Top block audit",
    debugSectionContext: "Context",
    debugNoErrors: "No errors have been recorded yet.",
    debugCurrentStep: "Current step",
    debugLastSuccess: "Last successful step",
    debugNoActiveRefresh: "No active refresh",
    debugNoEvents: "No events yet.",
    debugNoRequests: "Request history is empty.",
    debugStatus: "Status",
    debugCheckedBlocks: "Blocks checked",
    debugPopupCards: "top popup cards",
    debugWarnings: "Warnings",
    debugCalcMismatch: "calculation mismatches",
    debugAuditEmpty: "The top block audit is empty.",
    debugTokenSource: "Token source",
    debugNotSeen: "Not seen",
    debugCache: "Cache",
    debugCachePresent: "dashboard present",
    debugCacheMissing: "dashboard missing",
    debugNotUpdated: "Not updated",
    debugApiRequests: "API requests",
    debugSessionTotal: "Total for current session",
    debugFrontendSession: "Frontend session",
    debugNotDetected: "Not detected",
    debugIncomeRows: "Rows from income",
    debugWithdrawRows: "Rows from withdraw_stat",
    debugTotalCache: "Total from cache",
    debugCacheShort: "cache",
    debugNetworkShort: "network",
    debugUnknownShort: "unknown",
    debugThrottle: "Throttle",
    debugApiStats: "API stats",
    debugRawSettings: "Settings",
    debugRawFrontendSession: "Frontend session",
    debugCachedMeta: "Cached meta",
    debugActual: "Actual",
    debugExpected: "Expected",
    debugLoadError: "Diagnostics load error",
    debugFetchFailed: "Failed to fetch diagnostics",
    footerNote: "Settings are stored locally and applied immediately where the logic is already connected.",
    themeSaved: "Saved",
    topBlockLimit: "You can select only 2 blocks",
    debugUpdated: "Diagnostics updated",
    debugCopied: "Diagnostics copied",
    debugCopyFailed: "Copy failed",
    settingsLoading: "Loading settings...",
    noData: "No data",
    salesWord: "sales",
    siteSplitTitle: "Sales for 30 days",
    nextRankTitle: "Sales to the next rank",
    currentRank: "Current",
    maxRank: "Maximum",
    maxReached: "No higher rank!",
    totalSales: "total sales",
    todayRevenue: "Revenue today",
    weekRevenue: "Revenue for 7 days",
    monthRevenue: "Revenue for 30 days",
    ytdRevenue: "Revenue since the start of the year",
    topModel30: "Top model for 30 days",
    topModel7: "Top model for 7 days",
    vsPrevDay: "vs previous day",
    vsPrev7d: "vs previous 7 days",
    vsPrev30d: "vs previous 30 days",
    avgMonthIncome: "average income per month",
    rank_normal: "Regular status",
    rank_amber: "Amber",
    rank_amethyst: "Amethyst",
    rank_sapphire: "Sapphire",
    rank_emerald: "Emerald",
    rank_ruby: "Ruby",
    rank_topaz: "Topaz",
    rank_diamond: "Diamond",
    rank_bronze: "Bronze",
    rank_silver: "Silver",
    rank_gold: "Gold",
    rank_aquamarine: "Aquamarine star",
    rank_goldstar: "Gold star",
    rank_blackstar: "Black star",
    rankBeyondMax: "Only eggs are cooler",
    languageButtonTitle: "Switch language: auto / Russian / English",
    languageChanged: "Interface language: {mode}",
    languageModeAuto: "Auto",
    languageModeRu: "Russian",
    languageModeEn: "English"
  }
};

// ===== DOM & theme utilities =====
function $(selector) {
  return document.querySelector(selector);
}

function getUiLocale() {
  return currentLanguage === "en" ? "en-US" : "ru-RU";
}

function getFrontendLanguage(frontendBaseUrl) {
  return String(frontendBaseUrl || "").includes("3dsky.org") ? "en" : "ru";
}

function resolveLanguage(frontendBaseUrl = currentFrontendBaseUrl, languageMode = currentLanguageMode) {
  if (languageMode === "ru" || languageMode === "en") return languageMode;
  return getFrontendLanguage(frontendBaseUrl);
}

function getNextLanguageMode(mode = currentLanguageMode) {
  if (mode === "auto") return "ru";
  if (mode === "ru") return "en";
  return "auto";
}

function getLanguageButtonLabel(mode = currentLanguageMode) {
  if (mode === "auto") return "AUTO";
  return String(mode || "ru").toUpperCase();
}

function normalizeFrontendBaseUrl(frontendBaseUrl) {
  return String(frontendBaseUrl || "").includes("3dsky.org") ? "https://3dsky.org" : "https://3ddd.ru";
}

function tr(key, vars = {}) {
  const dict = I18N[currentLanguage] || I18N.ru;
  const fallback = I18N.ru[key];
  const template = dict[key] || fallback || key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

function getModelDisplayTitle(item) {
  const titleRu = String(item?.title || "").trim();
  const titleEn = String(item?.titleEn || "").trim();
  if (currentLanguage === "en") return titleEn || titleRu || tr("noData");
  return titleRu || titleEn || tr("noData");
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function localizeRankTitle(rank) {
  const key = String(rank?.key || "");
  const dict = I18N[currentLanguage] || I18N.ru;
  return dict[`rank_${key}`] || rank?.title || "";
}

async function loadFrontendLanguage() {
  try {
    const stored = await chrome.storage.local.get(["frontendBaseUrl", UI_LANGUAGE_KEY]);
    currentFrontendBaseUrl = normalizeFrontendBaseUrl(stored?.frontendBaseUrl || "");
    currentLanguageMode = ["auto", "ru", "en"].includes(stored?.[UI_LANGUAGE_KEY]) ? stored[UI_LANGUAGE_KEY] : "auto";
    currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
  } catch {
    currentFrontendBaseUrl = "https://3ddd.ru";
    currentLanguageMode = "auto";
    currentLanguage = "ru";
  }
  document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
}

function applySettingsLocale() {
  document.title = tr("pageTitle");
  setText("settingsHeroTitle", tr("heroTitle"));
  setText("settingsHeroSub", tr("heroSub"));
  setText("topBlocksTitle", tr("topBlocksTitle"));
  setText("topBlocksSub", tr("topBlocksSub"));
  setText("themesTitle", tr("themesTitle"));
  setText("themesSub", tr("themesSub"));
  setText("themeLightMetric", tr("themeLightMetric"));
  setText("themePinkyMetric", tr("themePinkyMetric"));
  setText("themeNavyMetric", tr("themeNavyMetric"));
  setText("themeDarkMetric", tr("themeDarkMetric"));
  setText("chartStyleTitle", tr("chartStyleTitle"));
  setText("chartStyleSub", tr("chartStyleSub"));
  setText("chartStyleClassic", tr("chartClassic"));
  setText("chartStyleSmooth", tr("chartSmooth"));
  setText("chartStyleBar", tr("chartBar"));
  setText("avgLineTitle", tr("avgLineTitle"));
  setText("avgLineSub", tr("avgLineSub"));
  setText("trendLineTitle", tr("trendLineTitle"));
  setText("trendLineSub", tr("trendLineSub"));
  setText("autoRefreshTitle", tr("autoRefreshTitle"));
  setText("autoRefreshSub", tr("autoRefreshSub"));
  setText("debugTitle", tr("debugTitle"));
  setText("debugSub", tr("debugSub"));
  setText("debugToggleBtn", tr("debugTitle"));
  setText("debugToggleSub", tr("debugToggleSub"));
  setText("debugSummary", tr("debugSummary"));
  setText("refreshDebugBtn", tr("debugRefresh"));
  setText("copyDebugBtn", tr("debugCopy"));
  setText("footerCopyPrefix", tr("footerCopyPrefix"));
  setText("footerCopySuffix", tr("footerCopySuffix"));
  setText("telegramLinkText", tr("telegram"));
  setText("settingsFooterNote", tr("footerNote"));
  setText("langBtn", getLanguageButtonLabel(currentLanguageMode));

  const avgRow = $("#avgLineRow");
  if (avgRow) avgRow.title = tr("toggleMutualHint");
  const trendRow = $("#trendLineRow");
  if (trendRow) trendRow.title = tr("toggleMutualHint");
  const autoRow = $("#autoRefreshRow");
  if (autoRow) autoRow.title = tr("inDevelopment");
  const debugLog = $("#debugLog");
  if (debugLog && !debugLog.dataset.copyText) {
    debugLog.textContent = tr("debugLoading");
  }
  const langButton = $("#langBtn");
  if (langButton) {
    langButton.title = tr("languageButtonTitle");
    langButton.setAttribute("aria-label", tr("languageButtonTitle"));
  }
  const telegramButton = $("#telegramLink");
  if (telegramButton) {
    telegramButton.setAttribute("aria-label", tr("telegramAria"));
  }
}

function applyTheme(theme) {
  document.body.dataset.theme = theme || DEFAULT_SETTINGS.theme;
}

function themeColor(name, fallback = "") {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

function setupCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || 320));
  const height = Math.max(1, Math.round(rect.height || 140));
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

function setSaveNote(text, isSaved = true) {
  const note = $("#saveNote");
  if (!note) return;
  note.textContent = text;
  note.style.color = isSaved ? themeColor("--text", "#0f172a") : themeColor("--muted", "#64748b");
}

function flashSaved(text = tr("themeSaved")) {
  setSaveNote(text, true);
  clearTimeout(flashSaved._timer);
  flashSaved._timer = setTimeout(() => setSaveNote(tr("themeSaved"), true), 1200);
}

function fmtNumber(n) {
  return new Intl.NumberFormat(getUiLocale()).format(Math.round(Number(n) || 0));
}

function fmtMoney(n) {
  return new Intl.NumberFormat(getUiLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n) || 0);
}

function safeUrl(url) {
  try {
    const u = new URL(String(url || ""), "https://3ddd.ru/");
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {}
  return "https://3ddd.ru/3dmodels";
}

function pct(a, b) {
  if (!b) return a ? 100 : 0;
  return ((a - b) / b) * 100;
}

function formatDeltaBadge(value) {
  const num = Number(value || 0);
  if (Math.abs(num) < 0.01) {
    return { cls: "neutral", text: "0%" };
  }
  return {
    cls: num > 0 ? "up" : "down",
    text: `${num > 0 ? "+" : ""}${num.toFixed(1)}%`
  };
}

function metricCardHtml(title, amount, delta, note) {
  const deltaCls = delta?.cls || "neutral";
  const deltaText = delta?.text || "• 0%";
  const icon = deltaCls === "down" ? "↓" : (deltaCls === "up" ? "↑" : "•");
  const hideIcon = delta?.hideIcon === true;
  return `
    <div class="metric-preview-card">
      <div>
        <div class="metric-title">${title}</div>
        <div class="metric-value">
          <span class="metric-value-number">${fmtMoney(amount)}</span>
          <span class="metric-value-unit">₽</span>
        </div>
      </div>
      <div class="metric-footer">
        <div class="metric-badge ${deltaCls}${hideIcon ? " no-icon" : ""}">
          ${hideIcon ? `<span class="metric-badge-icon metric-badge-icon-placeholder" aria-hidden="true"></span>` : `<span class="metric-badge-icon">${icon}</span>`}
          <span>${deltaText}</span>
        </div>
        <div class="metric-note">${note}</div>
      </div>
    </div>
  `;
}

function topBlockMarkerHtml() {
  return `<span class="block-order-indicator" aria-hidden="true"></span>`;
}

// ===== Settings normalization & storage =====
function parseDateUtcPlus3(text) {
  const m = String(text || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4]);
  const MM = Number(m[5]);
  const utcMs = Date.UTC(yyyy, mm - 1, dd, HH - 3, MM, 0, 0);
  return new Date(utcMs);
}

function normalizeSettings(input) {
  const normalized = Object.assign({}, DEFAULT_SETTINGS, input || {});
  let needsSave = false;
  const sourceTopBlocks = Array.isArray(input?.top_blocks) ? input.top_blocks : null;

  if (normalized.themeVersion !== 2) {
    if (normalized.theme === "ddd-dark") {
      normalized.theme = "ddd-navy";
    }
    normalized.themeVersion = 2;
    needsSave = true;
  }

  if (!Array.isArray(normalized.top_blocks)) {
    normalized.top_blocks = [...DEFAULT_SETTINGS.top_blocks];
    needsSave = true;
  }

  const sanitizedTopBlocks = normalized.top_blocks
    .map((item) => String(item || "").trim())
    .filter((item) => item && AVAILABLE_TOP_BLOCKS.has(item))
    .slice(0, 2);

  normalized.top_blocks = sanitizedTopBlocks.length
    ? sanitizedTopBlocks
    : [...DEFAULT_SETTINGS.top_blocks];

  if (
    !sourceTopBlocks ||
    sanitizedTopBlocks.length !== sourceTopBlocks.length ||
    sanitizedTopBlocks.some((item, index) => item !== String(sourceTopBlocks[index] || "").trim())
  ) {
    needsSave = true;
  }

  return { settings: normalized, needsSave };
}

function applySettingsState(input) {
  const normalized = normalizeSettings(input || {});
  currentSettings = normalized.settings;
  applyTheme(currentSettings.theme);
  return normalized;
}

async function loadSettings() {
  const stored = await chrome.storage.local.get([APP_SETTINGS_KEY]);
  const normalized = applySettingsState(stored?.[APP_SETTINGS_KEY] || {});
  if (normalized.needsSave) {
    await chrome.storage.local.set({ [APP_SETTINGS_KEY]: currentSettings });
  }
  return currentSettings;
}

async function loadCachedDashboard() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_CACHED" });
    cachedDashboard = resp?.ok ? (resp.dashboard || null) : null;
  } catch {
    cachedDashboard = null;
  }
  return cachedDashboard;
}

async function loadCachedSalesObjects() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_CACHED_SALES_OBJECTS" });
    cachedSalesObjects = Array.isArray(resp?.data?.combinedObjects) ? resp.data.combinedObjects : [];
  } catch {
    cachedSalesObjects = [];
  }
  return cachedSalesObjects;
}

async function persistSettings(patch) {
  applySettingsState(Object.assign({}, currentSettings, patch || {}));
  await chrome.storage.local.set({ [APP_SETTINGS_KEY]: currentSettings });
  flashSaved();
}

// ===== Top block settings & metrics =====
function updateChoiceState() {
  document.querySelectorAll(".choice[data-setting]").forEach((node) => {
    const key = node.dataset.setting;
    const value = node.dataset.value;
    if (key === "top_blocks") return;
    node.classList.toggle("active", String(currentSettings[key]) === String(value));
  });
}

function updateTopBlockState() {
  const selected = Array.isArray(currentSettings.top_blocks) ? currentSettings.top_blocks : [];
  document.querySelectorAll('.choice[data-setting="top_blocks"]').forEach((node) => {
    const value = node.dataset.value;
    const order = selected.indexOf(value);
    const active = order >= 0;
    const locked = !active && selected.length >= 2;
    const marker = node.querySelector(".block-order-indicator");
    node.classList.toggle("active", active);
    node.classList.toggle("disabled", locked);
    if (marker) {
      marker.textContent = active ? String(order + 1) : "";
      marker.classList.toggle("active", active);
      marker.classList.toggle("disabled", !active);
    }
  });
}

function detectSaleSite(item) {
  const raw = String(item?.regSite || item?.site || "").trim().toLowerCase();
  if (raw.includes("sky")) return "3DSky";
  if (raw.includes("3ddd")) return "3DDD";
  return Number(item?.royaltyAmount || 0) > 215 ? "3DSky" : "3DDD";
}

function calculateRollingRevenueMetrics(objects, days) {
  const safeDays = Math.max(1, Number(days) || 1);
  const nowMs = Date.now();
  const windowMs = safeDays * 24 * 60 * 60 * 1000;
  const currentStart = nowMs - windowMs;
  const previousStart = nowMs - windowMs * 2;
  let currentSum = 0;
  let previousSum = 0;

  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    const sum = Number(item?.royaltyAmount || 0);
    if (time >= currentStart && time < nowMs) currentSum += sum;
    else if (time >= previousStart && time < currentStart) previousSum += sum;
  }

  return {
    currentSum,
    previousSum,
    deltaPct: pct(currentSum, previousSum)
  };
}

function getCurrentAndNextRank(totalSales) {
  const count = Number(totalSales || 0);
  let current = RANKS[0];
  let next = null;
  for (const rank of RANKS) {
    if (count >= rank.threshold) {
      current = rank;
      continue;
    }
    next = rank;
    break;
  }
  return { current, next: next || null };
}

function getDashboardSources() {
  const dashboard = cachedDashboard || {};
  return {
    dashboard,
    objects: cachedSalesObjects.length
      ? cachedSalesObjects
      : (Array.isArray(dashboard?.objects) ? dashboard.objects : []),
    cards: dashboard?.cards || {},
    top: dashboard?.top || {},
    stats: dashboard?.stats || {}
  };
}

function calculateYearAndSiteMetrics(objects, dashboard) {
  const now = new Date();
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const nowMs = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = nowMs - thirtyDaysMs;
  const prevThirtyDaysAgo = nowMs - thirtyDaysMs * 2;

  let ytdSum = 0;
  let site3ddd = 0;
  let site3dsky = 0;
  let monthSalesCount = 0;
  let prevMonthSalesCount = 0;

  for (const item of objects) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    const sum = Number(item?.royaltyAmount || 0);

    if (time >= yearStart.getTime()) {
      ytdSum += sum;
    }
    if (time >= thirtyDaysAgo) {
      monthSalesCount += 1;
      const site = detectSaleSite(item);
      if (site === "3DSky") site3dsky += 1;
      else site3ddd += 1;
    } else if (time >= prevThirtyDaysAgo) {
      prevMonthSalesCount += 1;
    }
  }

  if (!objects.length) {
    const overviewLabels = Array.isArray(dashboard?.charts?.overview?.labels) ? dashboard.charts.overview.labels : [];
    const overviewValues = Array.isArray(dashboard?.charts?.overview?.values) ? dashboard.charts.overview.values : [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < overviewLabels.length; i++) {
      const label = String(overviewLabels[i] || "");
      if (label.startsWith(`${currentYear}-`)) {
        ytdSum += Number(overviewValues[i] || 0);
      }
    }
  }

  return {
    ytdSum,
    site3ddd,
    site3dsky,
    monthSalesCount,
    prevMonthSalesCount,
    elapsedMonths: Math.max(1, now.getUTCMonth() + 1)
  };
}

function calculateRankMetrics(totalSalesAll) {
  const rankInfo = getCurrentAndNextRank(totalSalesAll);
  return {
    totalSales: totalSalesAll,
    current: rankInfo.current,
    next: rankInfo.next,
    left: rankInfo.next ? Math.max(0, rankInfo.next.threshold - totalSalesAll) : 0
  };
}

function buildTopBlockMetrics() {
  const { dashboard, objects, cards, top, stats } = getDashboardSources();
  const yearAndSite = calculateYearAndSiteMetrics(objects, dashboard);
  const monthFallback = calculateRollingRevenueMetrics(objects, 30);
  const avgMonthYtd = yearAndSite.ytdSum / yearAndSite.elapsedMonths;
  const totalSiteSales = Math.max(1, yearAndSite.site3ddd + yearAndSite.site3dsky);
  const site3dddPct = Math.round((yearAndSite.site3ddd / totalSiteSales) * 100);
  const site3dskyPct = 100 - site3dddPct;

  const totalSalesAll = Number(stats?.totalSalesAll || 0);
  const rankMetrics = calculateRankMetrics(totalSalesAll);

  return {
    today: {
      amount: Number(cards?.today?.sum || 0),
      delta: formatDeltaBadge(cards?.today?.deltaPct || 0)
    },
    week_sales: {
      amount: Number(cards?.week?.sum || 0),
      delta: formatDeltaBadge(cards?.week?.deltaPct || 0)
    },
    month_sales: {
      amount: Number((cards?.month?.sum ?? monthFallback.currentSum ?? stats?.scales?.["30d"]?.sum) || 0),
      delta: formatDeltaBadge((cards?.month?.deltaPct ?? monthFallback.deltaPct) || 0)
    },
    site_split: {
      dddCount: yearAndSite.site3ddd,
      skyCount: yearAndSite.site3dsky,
      count: yearAndSite.monthSalesCount,
      delta: formatDeltaBadge(pct(yearAndSite.monthSalesCount, yearAndSite.prevMonthSalesCount)),
      dddPct: site3dddPct,
      skyPct: site3dskyPct
    },
    top30: top?.["30d"]?.[0] || null,
    top7: top?.["7d"]?.[0] || null,
    year_total: {
      amount: yearAndSite.ytdSum,
      avgMonth: avgMonthYtd
    },
    next_rank: rankMetrics
  };
}

function topPreviewHtml(item, innerTitle) {
  if (!item) {
    return `
      <div class="top-preview-card empty">
        <div class="top-empty">${tr("noData")}</div>
      </div>
    `;
  }
  const delta = formatDeltaBadge(item?.deltaPct || 0);
  const title = getModelDisplayTitle(item);
  const count = Number(item?.count || 0);
  const sum = Number(item?.sum || 0);
  const img = item?.img ? `<img class="top-thumb top-thumb-img" src="${safeUrl(item.img)}" alt="">` : `<div class="top-thumb"></div>`;
  const deltaIcon = delta.cls === "down" ? "↓" : (delta.cls === "up" ? "↑" : "•");
  return `
    <div class="top-preview-card">
      <div class="metric-title">${innerTitle}</div>
      <div class="top-preview">
        <div class="top-preview-row top-preview-row-main">
          <div class="top-preview-left">
            ${img}
            <div class="top-copy">
              <div class="top-name">${title}</div>
              <div class="top-meta">${fmtNumber(count)} ${tr("salesWord")}</div>
            </div>
          </div>
        </div>
        <div class="top-preview-row top-preview-row-stats">
          <div class="metric-badge ${delta.cls} top-delta">
            <span class="metric-badge-icon">${deltaIcon}</span>
            <span>${delta.text}</span>
          </div>
          <div class="top-sum">
            <span class="top-sum-number">${fmtMoney(sum)}</span>
            <span class="top-sum-unit">₽</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMetricChoice(value, previewTitle, amount, delta, note) {
  return `
    <button class="choice metric-choice popup-like-choice" data-setting="top_blocks" data-value="${value}">
      ${topBlockMarkerHtml()}
      <div class="choice-title">${previewTitle}</div>
      ${metricCardHtml(previewTitle, amount, delta, note)}
    </button>
  `;
}

function renderTopModelChoice(value, choiceTitle, item, innerTitle) {
  return `
    <button class="choice metric-choice popup-like-choice" data-setting="top_blocks" data-value="${value}">
      ${topBlockMarkerHtml()}
      <div class="choice-title">${choiceTitle}</div>
      ${topPreviewHtml(item, innerTitle)}
    </button>
  `;
}

function renderSiteSplitChoice(metric) {
  const deltaIcon = metric.delta.cls === "down" ? "↓" : (metric.delta.cls === "up" ? "↑" : "•");
  return `
    <button class="choice metric-choice popup-like-choice" data-setting="top_blocks" data-value="site_split">
      ${topBlockMarkerHtml()}
      <div class="choice-title">3DDD / 3DSky</div>
      <div class="site-split-card">
        <div class="metric-title">${tr("siteSplitTitle")}</div>
        <div class="site-split-layout">
          <div class="site-split-left">
            <div class="site-split-value">${fmtNumber(metric.count)}</div>
            <div class="metric-badge ${metric.delta.cls} site-split-badge">
              <span class="metric-badge-icon">${deltaIcon}</span>
              <span>${metric.delta.text}</span>
            </div>
          </div>
          <div class="site-split-right">
            <div
              class="donut-preview"
              style="--donut-angle:${metric.dddPct}%;--donut-primary:var(--chart-line);--donut-secondary:var(--settings-donut-secondary);--donut-label:'${metric.dddCount}/${metric.skyCount}';"
              aria-label="3DDD ${metric.dddPct}%, 3DSky ${metric.skyPct}%">
            </div>
            <div class="site-split-legend">
              <span><i class="swatch" style="background:var(--chart-line);"></i>3DDD — ${metric.dddPct}%</span>
              <span><i class="swatch" style="background:var(--settings-donut-secondary);"></i>3DSky — ${metric.skyPct}%</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  `;
}

function renderNextRankChoice(metric) {
  const nextRank = metric.next;
  const currentRank = metric.current;
  const currentTitle = currentRank ? localizeRankTitle(currentRank) : tr("currentRank");
  const nextTitle = nextRank ? localizeRankTitle(nextRank) : tr("rankBeyondMax");
  const nextIconHtml = nextRank?.icon
    ? `<img class="rank-badge-img" src="${nextRank.icon}" alt="${nextTitle}">`
    : (currentRank?.icon ? `<img class="rank-badge-img" src="${currentRank.icon}" alt="${currentTitle}">` : `<div class="rank-badge-fallback">★</div>`);
  const currentIconHtml = currentRank?.icon
    ? `<img class="rank-badge-img" src="${currentRank.icon}" alt="${currentTitle}">`
    : `<div class="rank-badge-fallback">★</div>`;

  if (!nextRank) {
    return `
      <button class="choice metric-choice popup-like-choice" data-setting="top_blocks" data-value="next_rank">
        ${topBlockMarkerHtml()}
        <div class="choice-title">${tr("nextRankTitle")}</div>
        <div class="rank-preview-card">
          <div class="rank-preview-inner">
            <div class="metric-title">${tr("nextRankTitle")}</div>
            <div class="rank-preview-body rank-preview-body-max">
              <div class="rank-max-state">
                ${currentIconHtml.replace('class="rank-badge-img"', 'class="rank-badge-img rank-max-icon"').replace('class="rank-badge-fallback"', 'class="rank-badge-fallback rank-max-icon"')}
                <div class="rank-max-title">${tr("rankBeyondMax")}</div>
              </div>
              <div class="rank-footer">
                <div class="metric-badge neutral no-icon rank-total-badge">
                  <span>${fmtNumber(metric.totalSales)}</span>
                </div>
                <div class="rank-total">${tr("totalSales")}</div>
              </div>
            </div>
          </div>
        </div>
      </button>
    `;
  }

  return `
    <button class="choice metric-choice popup-like-choice" data-setting="top_blocks" data-value="next_rank">
      ${topBlockMarkerHtml()}
      <div class="choice-title">${tr("nextRankTitle")}</div>
      <div class="rank-preview-card">
        <div class="rank-preview-inner">
          <div class="metric-title">${tr("nextRankTitle")}</div>
          <div class="rank-preview-body">
            <div class="rank-track">
              <div class="rank-node rank-node-current">
                ${currentIconHtml}
                <span class="rank-node-title">${currentTitle}</span>
              </div>
              <div class="rank-arrow">→</div>
              <div class="rank-node rank-node-next">
                ${nextIconHtml}
                <span class="rank-node-title">${nextTitle}</span>
              </div>
              <div class="rank-center-value">${nextRank ? fmtNumber(metric.left) : "★"}</div>
            </div>
            <div class="rank-copy">
              ${nextRank ? "" : `<div class="rank-main">${tr("maxReached")}</div>`}
              <div class="rank-footer">
                <div class="metric-badge neutral no-icon rank-total-badge">
                  <span>${fmtNumber(metric.totalSales)}</span>
                </div>
                <div class="rank-total">${tr("totalSales")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  `;
}

function renderTopBlockChoices() {
  const root = $("#topBlockChoices");
  if (!root) return;
  const m = buildTopBlockMetrics();

  root.innerHTML = `
    ${renderMetricChoice("today", tr("todayRevenue"), m.today.amount, m.today.delta, tr("vsPrevDay"))}
    ${renderMetricChoice("week_sales", tr("weekRevenue"), m.week_sales.amount, m.week_sales.delta, tr("vsPrev7d"))}
    ${renderMetricChoice("month_sales", tr("monthRevenue"), m.month_sales.amount, m.month_sales.delta, tr("vsPrev30d"))}
    ${renderMetricChoice("year_total", tr("ytdRevenue"), m.year_total.amount, { cls: "neutral", text: `${fmtMoney(m.year_total.avgMonth)} ₽`, hideIcon: true }, tr("avgMonthIncome"))}
    ${renderTopModelChoice("top30", tr("topModel30"), m.top30, tr("topModel30"))}
    ${renderTopModelChoice("top7", tr("topModel7"), m.top7, tr("topModel7"))}
    ${renderSiteSplitChoice(m.site_split)}
    ${renderNextRankChoice(m.next_rank)}
  `;
}

// ===== Toggle state =====
function updateToggleState() {
  const avg = $("#avgLineToggle");
  const trend = $("#trendLineToggle");
  const auto = $("#autoRefreshToggle");
  if (avg) avg.checked = !!currentSettings.avgLine;
  if (trend) trend.checked = !!currentSettings.trendLine;
  if (auto) auto.checked = !!currentSettings.autoRefresh;
}

// ===== Chart preview rendering =====
function drawGrid(ctx, width, height, plot) {
  ctx.strokeStyle = themeColor("--line-soft", "#eef2f7");
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = plot.top + (plot.height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.left + plot.width, y);
    ctx.stroke();
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildPoints(width, height) {
  const plot = { left: 20, top: 22, width: width - 32, height: height - 42 };
  const max = Math.max(...PREVIEW_SERIES, 1);
  const min = Math.min(...PREVIEW_SERIES, 0);
  const span = Math.max(1, max - min);
  const stepX = plot.width / Math.max(1, PREVIEW_SERIES.length - 1);
  const points = PREVIEW_SERIES.map((value, index) => ({
    x: plot.left + stepX * index,
    y: plot.top + plot.height - ((value - min) / span) * plot.height,
    value
  }));
  return { plot, points };
}

function tracePreviewPath(ctx, points, style) {
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }
    if (style === "smooth") {
      const prev = points[index - 1];
      const prevPrev = points[index - 2] || prev;
      const next = points[index + 1] || point;
      const tension = 0.22;
      const cp1x = prev.x + (point.x - prevPrev.x) * tension;
      const minY = Math.min(prev.y, point.y);
      const maxY = Math.max(prev.y, point.y);
      const cp1y = clamp(prev.y + (point.y - prevPrev.y) * tension, minY, maxY);
      const cp2x = point.x - (next.x - prev.x) * tension;
      const cp2y = clamp(point.y - (next.y - prev.y) * tension, minY, maxY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, point.x, point.y);
      return;
    }
    ctx.lineTo(point.x, point.y);
  });
}

function tracePreviewPathFromSecond(ctx, points, style) {
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    if (style === "smooth") {
      const prev = points[index - 1];
      const prevPrev = points[index - 2] || prev;
      const next = points[index + 1] || point;
      const tension = 0.22;
      const cp1x = prev.x + (point.x - prevPrev.x) * tension;
      const minY = Math.min(prev.y, point.y);
      const maxY = Math.max(prev.y, point.y);
      const cp1y = clamp(prev.y + (point.y - prevPrev.y) * tension, minY, maxY);
      const cp2x = point.x - (next.x - prev.x) * tension;
      const cp2y = clamp(point.y - (next.y - prev.y) * tension, minY, maxY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, point.x, point.y);
      continue;
    }
    ctx.lineTo(point.x, point.y);
  }
}

function getPreviewAverage() {
  return PREVIEW_SERIES.reduce((sum, value) => sum + value, 0) / Math.max(1, PREVIEW_SERIES.length);
}

function getPreviewTrendEndpoints() {
  const n = PREVIEW_SERIES.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = Number(PREVIEW_SERIES[i] || 0);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (!denominator) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  return {
    first: intercept,
    last: intercept + slope * (n - 1)
  };
}

function previewValueToY(value, min, span, plot) {
  return plot.top + plot.height - ((value - min) / span) * plot.height;
}

function drawPreviewOverlay(ctx, plot, min, span, points) {
  if (currentSettings.avgLine) {
    const avgValue = getPreviewAverage();
    const avgY = previewValueToY(avgValue, min, span, plot);
    ctx.save();
    ctx.strokeStyle = themeColor("--chart-avg-line", "rgba(100,116,139,0.75)");
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(plot.left, avgY);
    ctx.lineTo(plot.left + plot.width, avgY);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (currentSettings.trendLine) {
    const trend = getPreviewTrendEndpoints();
    if (!trend || !points.length) return;
    ctx.save();
    ctx.strokeStyle = themeColor("--chart-trend-line", "rgba(71,85,105,0.82)");
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, previewValueToY(trend.first, min, span, plot));
    ctx.lineTo(points[points.length - 1].x, previewValueToY(trend.last, min, span, plot));
    ctx.stroke();
    ctx.restore();
  }
}

function drawClassicPreview(canvas) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const { plot, points } = buildPoints(width, height);
  const min = Math.min(...PREVIEW_SERIES, 0);
  const span = Math.max(1, Math.max(...PREVIEW_SERIES, 1) - min);
  drawGrid(ctx, width, height, plot);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, plot.top + plot.height);
  ctx.lineTo(points[0].x, points[0].y);
  tracePreviewPathFromSecond(ctx, points, "classic");
  ctx.lineTo(plot.left + plot.width, plot.top + plot.height);
  ctx.lineTo(plot.left, plot.top + plot.height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.top + plot.height);
  gradient.addColorStop(0, themeColor("--chart-fill-start", "rgba(15,23,42,0.12)"));
  gradient.addColorStop(1, themeColor("--chart-fill-end", "rgba(15,23,42,0.02)"));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = themeColor("--chart-line", "#111827");
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  tracePreviewPath(ctx, points, "classic");
  ctx.stroke();

  drawPreviewOverlay(ctx, plot, min, span, points);

  const last = points[points.length - 1];
  ctx.fillStyle = themeColor("--chart-point", "#111827");
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawSmoothPreview(canvas) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const { plot, points } = buildPoints(width, height);
  const min = Math.min(...PREVIEW_SERIES, 0);
  const span = Math.max(1, Math.max(...PREVIEW_SERIES, 1) - min);
  drawGrid(ctx, width, height, plot);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, plot.top + plot.height);
  ctx.lineTo(points[0].x, points[0].y);
  tracePreviewPathFromSecond(ctx, points, "smooth");
  ctx.lineTo(plot.left + plot.width, plot.top + plot.height);
  ctx.lineTo(plot.left, plot.top + plot.height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, plot.top, 0, plot.top + plot.height);
  gradient.addColorStop(0, themeColor("--chart-fill-start", "rgba(59,130,246,0.14)"));
  gradient.addColorStop(1, themeColor("--chart-fill-end", "rgba(59,130,246,0.02)"));
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  tracePreviewPath(ctx, points, "smooth");
  ctx.strokeStyle = themeColor("--chart-line", "#0f172a");
  ctx.lineWidth = 2.8;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  drawPreviewOverlay(ctx, plot, min, span, points);

  const last = points[points.length - 1];
  ctx.fillStyle = themeColor("--chart-point", "#111827");
  ctx.beginPath();
  ctx.arc(last.x, last.y, 3.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBarPreview(canvas) {
  const { ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const { plot } = buildPoints(width, height);
  const min = Math.min(...PREVIEW_SERIES, 0);
  const span = Math.max(1, Math.max(...PREVIEW_SERIES, 1) - min);
  drawGrid(ctx, width, height, plot);
  const groups = 12;
  const groupSize = Math.ceil(PREVIEW_SERIES.length / groups);
  const values = [];
  for (let i = 0; i < PREVIEW_SERIES.length; i += groupSize) {
    const slice = PREVIEW_SERIES.slice(i, i + groupSize);
    values.push(slice.reduce((sum, value) => sum + value, 0) / Math.max(1, slice.length));
  }
  const max = Math.max(...values, 1);
  const gap = 6;
  const barWidth = Math.max(10, (plot.width - gap * (values.length - 1)) / values.length);
  values.forEach((value, index) => {
    const h = (value / max) * (plot.height - 8);
    const x = plot.left + index * (barWidth + gap);
    const y = plot.top + plot.height - h;
    ctx.fillStyle = index === values.length - 1
      ? themeColor("--chart-line", "#111827")
      : themeColor("--mini-bar", "#d5dde7");
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, h, 8);
    ctx.fill();
  });

  const barPoints = values.map((value, index) => ({
    x: plot.left + index * (barWidth + gap) + barWidth / 2,
    y: plot.top + plot.height - ((value - 0) / Math.max(1, max - 0)) * (plot.height - 8)
  }));
  drawPreviewOverlay(ctx, plot, min, span, barPoints);
}

function renderChartPreviews() {
  document.querySelectorAll("canvas[data-preview]").forEach((canvas) => {
    const kind = canvas.dataset.preview;
    if (kind === "bar") drawBarPreview(canvas);
    else if (kind === "smooth") drawSmoothPreview(canvas);
    else drawClassicPreview(canvas);
  });
}

// ===== Settings interactions =====
function bindChoices() {
  document.querySelectorAll(".choice[data-setting]").forEach((node) => {
    node.addEventListener("click", async () => {
      const key = node.dataset.setting;
      const value = node.dataset.value;
      if (key === "top_blocks") {
        const selected = Array.isArray(currentSettings.top_blocks) ? [...currentSettings.top_blocks] : [];
        const existingIndex = selected.indexOf(value);
        if (existingIndex >= 0) {
          selected.splice(existingIndex, 1);
          await persistSettings({ top_blocks: selected });
          updateTopBlockState();
          return;
        }
        if (selected.length >= 2) {
          flashSaved(tr("topBlockLimit"));
          updateTopBlockState();
          return;
        }
        selected.push(value);
        await persistSettings({ top_blocks: selected });
        updateTopBlockState();
        return;
      }
      await persistSettings({ [key]: value });
      updateChoiceState();
    });
  });
}

function bindToggles() {
  $("#avgLineToggle")?.addEventListener("change", async (e) => {
    const checked = !!e.target.checked;
    const patch = checked ? { avgLine: true, trendLine: false } : { avgLine: false };
    await persistSettings(patch);
    updateToggleState();
  });

  $("#trendLineToggle")?.addEventListener("change", async (e) => {
    const checked = !!e.target.checked;
    const patch = checked ? { trendLine: true, avgLine: false } : { trendLine: false };
    await persistSettings(patch);
    updateToggleState();
  });

  $("#autoRefreshToggle")?.addEventListener("change", async (e) => {
    await persistSettings({ autoRefresh: !!e.target.checked });
    updateToggleState();
  });
}

// ===== Debug formatting & safety =====
function formatDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("ru-RU");
}

function formatDuration(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return "—";
  if (value < 1000) return `${Math.round(value)} мс`;
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)} сек`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeDebugString(value) {
  return String(value ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9._-]+\b/g, "[redacted-jwt]")
    .replace(/("?(?:wid|transaction_withdraw_id|jwtToken|authorization|cookie|session|token)"?\s*:\s*)"[^"]*"/gi, '$1"[redacted]"')
    .replace(/((?:wid|transaction_withdraw_id|jwtToken|authorization|cookie|session|token)\s*[=:]\s*)[^\s,]+/gi, "$1[redacted]");
}

function sanitizeDebugValue(value) {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeDebugString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeDebugValue(item));
  if (typeof value === "object") {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      if (/(^|_)(jwt|token|authorization|cookie|session)(_|$)/i.test(key)) {
        out[key] = "[redacted]";
      } else if (/(^|_)(wid|transaction_withdraw_id)(_|$)/i.test(key)) {
        out[key] = "[hidden]";
      } else {
        out[key] = sanitizeDebugValue(val);
      }
    }
    return out;
  }
  return value;
}

function buildSafeSettings(settings) {
  const safe = settings || {};
  return {
    theme: safe.theme || null,
    chart_style: safe.chart_style || null,
    avgLine: !!safe.avgLine,
    trendLine: !!safe.trendLine,
    autoRefresh: !!safe.autoRefresh,
    top_blocks: Array.isArray(safe.top_blocks) ? safe.top_blocks.slice(0, 2) : []
  };
}

function buildSafeCached(cached) {
  const meta = cached?.meta || {};
  return {
    updatedAt: cached?.updatedAt || null,
    hasDashboard: !!cached?.hasDashboard,
    lastError: sanitizeDebugString(cached?.lastError || ""),
    metaSummary: {
      refreshReason: meta?.refreshReason || null,
      cached: !!meta?.cached,
      partialSync: !!meta?.partialSync,
      newSalesCount: Number(meta?.newSalesCount || 0),
      withdrawError: sanitizeDebugString(meta?.withdrawError || ""),
      validation: sanitizeDebugValue(meta?.validation || null),
      topBlockAudit: sanitizeDebugValue(meta?.topBlockAudit || null)
    }
  };
}

function buildSafeDataSources(dataSources) {
  const safe = dataSources || {};
  const income = safe.income || {};
  const withdraw = safe.withdraw_stat || {};
  return {
    totalRows: Number(safe.totalRows || 0),
    cacheRows: Number(safe.cacheRows || 0),
    networkRows: Number(safe.networkRows || 0),
    unknownRows: Number(safe.unknownRows || 0),
    income: {
      total: Number(income.total || 0),
      cache: Number(income.cache || 0),
      network: Number(income.network || 0),
      unknown: Number(income.unknown || 0)
    },
    withdraw_stat: {
      total: Number(withdraw.total || 0),
      cache: Number(withdraw.cache || 0),
      network: Number(withdraw.network || 0),
      unknown: Number(withdraw.unknown || 0)
    }
  };
}

function buildSafeTopBlockAudit(audit) {
  const safe = audit || {};
  const blocks = safe.blocks && typeof safe.blocks === "object" ? safe.blocks : {};
  const sanitizeBlock = (block) => ({
    title: sanitizeDebugString(block?.title || ""),
    source: sanitizeDebugString(block?.source || ""),
    ok: !!block?.ok,
    actual: sanitizeDebugValue(block?.actual || null),
    expected: sanitizeDebugValue(block?.expected || null)
  });
  return {
    ok: !!safe.ok,
    checkedAt: safe.checkedAt || null,
    warnings: Array.isArray(safe.warnings) ? safe.warnings.map((item) => sanitizeDebugValue(item)) : [],
    blocks: Object.fromEntries(Object.entries(blocks).map(([key, block]) => [key, sanitizeBlock(block)]))
  };
}

function buildSafeFrontendSession(frontendSession, frontendBaseUrl) {
  const safe = frontendSession || {};
  const probeResults = Array.isArray(safe.probeResults) ? safe.probeResults : [];
  const signals = safe.signals && typeof safe.signals === "object" ? safe.signals : {};
  return {
    state: sanitizeDebugString(safe.state || "unknown"),
    preferredBaseUrl: sanitizeDebugString(safe.preferredBaseUrl || frontendBaseUrl || ""),
    source: sanitizeDebugString(safe.tokenSource || safe.source || ""),
    signals: sanitizeDebugValue(signals),
    probeResults: probeResults.map((item) => ({
      baseUrl: sanitizeDebugString(item?.baseUrl || ""),
      ok: !!item?.ok,
      redirectedToLogin: !!item?.redirectedToLogin,
      status: Number(item?.status || 0) || null,
      error: sanitizeDebugString(item?.error || "")
    }))
  };
}

function stringifyCompact(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function pickRecentLogs(data, levels, limit = 12) {
  const all = Array.isArray(data?.logs) ? data.logs : [];
  const levelSet = new Set(levels);
  return all.filter((entry) => levelSet.has(String(entry?.level || "").toLowerCase())).slice(-limit).reverse();
}

function pickRecentRequests(data, limit = 12) {
  const all = Array.isArray(data?.requests) ? data.requests : [];
  return all.slice(-limit).reverse();
}

function getLastSuccessfulStep(data) {
  const all = Array.isArray(data?.logs) ? data.logs : [];
  const completed = [...all].reverse().find((entry) => {
    const level = String(entry?.level || "").toLowerCase();
    const message = String(entry?.message || "");
    return level === "info" && (message === "Refresh completed" || message.includes("completed"));
  });
  if (completed) return completed;
  return [...all].reverse().find((entry) => String(entry?.level || "").toLowerCase() === "info") || null;
}

function getRequestTags(req) {
  const tags = [];
  const status = Number(req?.status);
  const errorText = String(req?.error || "").toLowerCase();
  if (errorText.includes("таймаут") || errorText.includes("timeout")) {
    tags.push({ tone: "warn", label: "timeout" });
  }
  if (status === 429) tags.push({ tone: "warn", label: "429" });
  if (status === 401) tags.push({ tone: "danger", label: "401" });
  if (status >= 500) tags.push({ tone: "danger", label: String(status) });
  if (!tags.length && req?.ok) tags.push({ tone: "ok", label: "ok" });
  if (!tags.length && status) tags.push({ tone: "muted", label: String(status) });
  return tags;
}

function formatDebugPayload(data) {
  if (!data) return "Нет диагностических данных.";
  const lines = [];
  const refresh = data.refreshState || null;
  const cached = buildSafeCached(data.cached || null);
  const dataSources = buildSafeDataSources(data.dataSources || null);
  const topBlockAudit = buildSafeTopBlockAudit(data.topBlockAudit || cached?.metaSummary?.topBlockAudit || null);
  const frontendSession = buildSafeFrontendSession(data.frontendSession || null, data.frontendBaseUrl || null);
  const safeSettings = buildSafeSettings(data.settings || null);
  const errorLogs = pickRecentLogs(data, ["error", "warn"], 12);
  const eventLogs = pickRecentLogs(data, ["info"], 16);
  const requestLogs = pickRecentRequests(data, 14);
  const lastSuccessful = getLastSuccessfulStep(data);

  lines.push(`Сформировано: ${formatDateTime(data.generatedAt) || "—"}`);
  lines.push("");
  lines.push("=== Ошибки ===");
  if (cached?.lastError) {
    lines.push(`Последняя сохранённая ошибка: ${cached.lastError}`);
    lines.push("");
  }
  if (errorLogs.length) {
    for (const entry of errorLogs) {
      const stamp = formatDateTime(entry.at) || "—";
      lines.push(`[${stamp}] ${String(entry.level || "info").toUpperCase()} ${entry.message}`);
      const extra = stringifyCompact(sanitizeDebugValue(entry.extra));
      if (extra) lines.push(extra);
      lines.push("");
    }
  } else {
    lines.push("Ошибок пока не зафиксировано.");
    lines.push("");
  }

  lines.push("=== События ===");
  if (refresh) {
    lines.push(`Текущий шаг: ${refresh.label || refresh.phase || "—"}`);
    if (refresh.detail) lines.push(`Детали: ${refresh.detail}`);
    if (refresh.current != null || refresh.total != null) {
      lines.push(`Прогресс: ${refresh.current ?? 0}${refresh.total != null ? ` / ${refresh.total}` : ""}`);
    }
    lines.push(`Обновлено: ${formatDateTime(refresh.at) || "—"}`);
    lines.push("");
  } else {
    lines.push("Сейчас активного обновления нет.");
    lines.push("");
  }
  lines.push(`Последний успешный шаг: ${lastSuccessful?.message || "—"}`);
  lines.push(`Когда: ${formatDateTime(lastSuccessful?.at) || "Нет данных"}`);
  lines.push("");
  if (eventLogs.length) {
    for (const entry of eventLogs) {
      const stamp = formatDateTime(entry.at) || "—";
      lines.push(`[${stamp}] ${entry.message}`);
      const extra = stringifyCompact(sanitizeDebugValue(entry.extra));
      if (extra) lines.push(extra);
      lines.push("");
    }
  } else {
    lines.push("События пока пусты.");
    lines.push("");
  }

  lines.push("=== Сеть ===");
  if (requestLogs.length) {
    for (const req of requestLogs) {
      const stamp = formatDateTime(req.at) || "—";
      const status = req.status == null ? "—" : String(req.status);
      const state = req.ok ? "OK" : "FAIL";
      lines.push(
        `[${stamp}] ${state} ${req.endpoint || "endpoint?"} status=${status} ${formatDuration(req.durationMs)} page=${req.pageNumber ?? "—"} attempt=${req.attempt ?? "—"}`
      );
      if (req.error) lines.push(`Ошибка: ${sanitizeDebugString(req.error)}`);
      lines.push("");
    }
  } else {
    lines.push("История запросов пока пуста.");
    lines.push("");
  }

  lines.push("=== Контекст ===");
  lines.push(`Источник токена: ${data.token?.source || "—"}`);
  lines.push(`Токен замечен: ${formatDateTime(data.token?.observedAt) || "—"}`);
  lines.push(`Frontend-сессия: ${frontendSession.state || "—"}`);
  lines.push(`Предпочитаемый frontend: ${frontendSession.preferredBaseUrl || "—"}`);
  lines.push(`Последнее обновление кэша: ${formatDateTime(cached?.updatedAt) || "—"}`);
  lines.push(`Кэш dashboard: ${cached?.hasDashboard ? "да" : "нет"}`);
  lines.push(`Всего API-запросов: ${data.apiStats?.requests ?? 0}`);
  lines.push("");
  lines.push("Источники данных:");
  lines.push(`Всего строк в итоговой статистике: ${dataSources.totalRows}`);
  lines.push(`Из income: ${dataSources.income.total} (кэш: ${dataSources.income.cache}, сеть: ${dataSources.income.network})`);
  lines.push(`Из withdraw_stat: ${dataSources.withdraw_stat.total} (кэш: ${dataSources.withdraw_stat.cache}, сеть: ${dataSources.withdraw_stat.network})`);
  lines.push(`Всего из кэша: ${dataSources.cacheRows}`);
  lines.push(`Всего из сети: ${dataSources.networkRows}`);
  if (dataSources.unknownRows) lines.push(`Неопределённый источник: ${dataSources.unknownRows}`);
  lines.push("");
  lines.push("Audit верхних блоков:");
  lines.push(`Статус: ${topBlockAudit.ok ? "ok" : "warning"}`);
  lines.push(`Проверено: ${formatDateTime(topBlockAudit.checkedAt) || "—"}`);
  for (const [key, block] of Object.entries(topBlockAudit.blocks || {})) {
    lines.push(`- ${block.title || key}: ${block.ok ? "ok" : "warning"}`);
    if (block.source) lines.push(`  Источник: ${block.source}`);
    lines.push(`  Actual: ${JSON.stringify(block.actual || null)}`);
    lines.push(`  Expected: ${JSON.stringify(block.expected || null)}`);
  }
  if (Array.isArray(topBlockAudit.warnings) && topBlockAudit.warnings.length) {
    lines.push("Warnings:");
    lines.push(JSON.stringify(topBlockAudit.warnings, null, 2));
  }
  lines.push("");
  lines.push("Throttle:");
  lines.push(JSON.stringify(data.apiThrottle || null, null, 2));
  lines.push("");
  lines.push("API stats:");
  lines.push(JSON.stringify(data.apiStats || null, null, 2));
  lines.push("");
  lines.push("Settings:");
  lines.push(JSON.stringify(safeSettings, null, 2));
  lines.push("");
  lines.push("Frontend session:");
  lines.push(JSON.stringify(frontendSession, null, 2));
  lines.push("");
  lines.push("Cached meta:");
  lines.push(JSON.stringify(cached || null, null, 2));
  return lines.join("\n");
}

function formatDebugHtml(data) {
  if (!data) return `<div class="debug-empty">${escapeHtml(tr("debugNoData"))}</div>`;

  const refresh = data.refreshState || null;
  const cached = buildSafeCached(data.cached || null);
  const dataSources = buildSafeDataSources(data.dataSources || null);
  const topBlockAudit = buildSafeTopBlockAudit(data.topBlockAudit || cached?.metaSummary?.topBlockAudit || null);
  const frontendSession = buildSafeFrontendSession(data.frontendSession || null, data.frontendBaseUrl || null);
  const safeSettings = buildSafeSettings(data.settings || null);
  const errorLogs = pickRecentLogs(data, ["error", "warn"], 12);
  const eventLogs = pickRecentLogs(data, ["info"], 16);
  const requestLogs = pickRecentRequests(data, 14);
  const lastSuccessful = getLastSuccessfulStep(data);

  const errorItems = cached?.lastError
    ? [{
        at: cached?.updatedAt || data.generatedAt,
        level: "error",
        message: tr("debugSavedError"),
        extra: cached.lastError
      }, ...errorLogs]
    : errorLogs;

  const renderLogItem = (entry) => {
    const level = String(entry?.level || "info").toLowerCase();
    const tone = level === "error" ? "danger" : level === "warn" ? "warn" : "muted";
    const extra = stringifyCompact(sanitizeDebugValue(entry?.extra));
    return `
      <div class="debug-item debug-item-${tone}">
        <div class="debug-item-head">
          <span class="debug-tag debug-tag-${tone}">${escapeHtml(level.toUpperCase())}</span>
          <span class="debug-time">${escapeHtml(formatDateTime(entry?.at) || "—")}</span>
        </div>
        <div class="debug-item-title">${escapeHtml(entry?.message || "—")}</div>
        ${extra ? `<pre class="debug-pre">${escapeHtml(extra)}</pre>` : ""}
      </div>
    `;
  };

  const renderRequestItem = (req) => {
    const tags = getRequestTags(req).map((tag) => `<span class="debug-tag debug-tag-${escapeHtml(tag.tone)}">${escapeHtml(tag.label)}</span>`).join("");
    const tone = req?.ok ? "ok" : "warn";
    return `
      <div class="debug-item debug-item-${tone}">
        <div class="debug-item-head">
          <div class="debug-request-main">
            <span class="debug-item-title">${escapeHtml(req?.endpoint || "endpoint?")}</span>
            ${tags}
          </div>
          <span class="debug-time">${escapeHtml(formatDateTime(req?.at) || "—")}</span>
        </div>
        <div class="debug-meta">
          <span>status: ${escapeHtml(req?.status == null ? "—" : String(req.status))}</span>
          <span>${escapeHtml(formatDuration(req?.durationMs))}</span>
          <span>page: ${escapeHtml(req?.pageNumber ?? "—")}</span>
          <span>attempt: ${escapeHtml(req?.attempt ?? "—")}</span>
        </div>
        ${req?.error ? `<div class="debug-error-text">${escapeHtml(sanitizeDebugString(req.error))}</div>` : ""}
      </div>
    `;
  };

  const auditEntries = Object.entries(topBlockAudit.blocks || {});
  const renderAuditItem = ([key, block]) => `
    <div class="debug-item debug-item-${block?.ok ? "ok" : "warn"}">
      <div class="debug-item-head">
        <span class="debug-item-title">${escapeHtml(block?.title || key)}</span>
        <div class="debug-request-main">
          ${block?.source ? `<span class="debug-tag debug-tag-muted">${escapeHtml(block.source)}</span>` : ""}
          <span class="debug-tag debug-tag-${block?.ok ? "ok" : "warn"}">${block?.ok ? "ok" : "warning"}</span>
        </div>
      </div>
      <pre class="debug-pre">${escapeHtml(tr("debugActual"))}:
${escapeHtml(JSON.stringify(block?.actual || null, null, 2))}</pre>
      <pre class="debug-pre">${escapeHtml(tr("debugExpected"))}:
${escapeHtml(JSON.stringify(block?.expected || null, null, 2))}</pre>
    </div>
  `;

  return `
    <div class="debug-panel">
      <div class="debug-section">
        <div class="debug-section-title">${escapeHtml(tr("debugSectionErrors"))}</div>
        ${errorItems.length ? errorItems.map(renderLogItem).join("") : `<div class="debug-empty">${escapeHtml(tr("debugNoErrors"))}</div>`}
      </div>

      <div class="debug-section">
        <div class="debug-section-title">${escapeHtml(tr("debugSectionEvents"))}</div>
        <div class="debug-summary-grid">
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugCurrentStep"))}</div>
            <div class="debug-summary-value">${escapeHtml(refresh?.label || refresh?.phase || tr("debugNoActiveRefresh"))}</div>
            ${refresh?.detail ? `<div class="debug-summary-note">${escapeHtml(refresh.detail)}</div>` : ""}
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugLastSuccess"))}</div>
            <div class="debug-summary-value">${escapeHtml(lastSuccessful?.message || "—")}</div>
            <div class="debug-summary-note">${escapeHtml(formatDateTime(lastSuccessful?.at) || tr("debugNoData"))}</div>
          </div>
        </div>
        ${eventLogs.length ? eventLogs.map(renderLogItem).join("") : `<div class="debug-empty">${escapeHtml(tr("debugNoEvents"))}</div>`}
      </div>

      <div class="debug-section">
        <div class="debug-section-title">${escapeHtml(tr("debugSectionNetwork"))}</div>
        ${requestLogs.length ? requestLogs.map(renderRequestItem).join("") : `<div class="debug-empty">${escapeHtml(tr("debugNoRequests"))}</div>`}
      </div>

      <div class="debug-section">
        <div class="debug-section-title">${escapeHtml(tr("debugSectionAudit"))}</div>
        <div class="debug-summary-grid">
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugStatus"))}</div>
            <div class="debug-summary-value">${topBlockAudit.ok ? "ok" : "warning"}</div>
            <div class="debug-summary-note">${escapeHtml(formatDateTime(topBlockAudit.checkedAt) || tr("debugNoData"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugCheckedBlocks"))}</div>
            <div class="debug-summary-value">${escapeHtml(auditEntries.length)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugPopupCards"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugWarnings"))}</div>
            <div class="debug-summary-value">${escapeHtml(topBlockAudit.warnings?.length || 0)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugCalcMismatch"))}</div>
          </div>
        </div>
        <div class="debug-subsection">
          ${auditEntries.length ? auditEntries.map(renderAuditItem).join("") : `<div class="debug-empty">${escapeHtml(tr("debugAuditEmpty"))}</div>`}
        </div>
      </div>

      <div class="debug-section">
        <div class="debug-section-title">${escapeHtml(tr("debugSectionContext"))}</div>
        <div class="debug-summary-grid">
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugTokenSource"))}</div>
            <div class="debug-summary-value">${escapeHtml(data.token?.source || "—")}</div>
            <div class="debug-summary-note">${escapeHtml(formatDateTime(data.token?.observedAt) || tr("debugNotSeen"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugCache"))}</div>
            <div class="debug-summary-value">${cached?.hasDashboard ? tr("debugCachePresent") : tr("debugCacheMissing")}</div>
            <div class="debug-summary-note">${escapeHtml(formatDateTime(cached?.updatedAt) || tr("debugNotUpdated"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugApiRequests"))}</div>
            <div class="debug-summary-value">${escapeHtml(data.apiStats?.requests ?? 0)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugSessionTotal"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugFrontendSession"))}</div>
            <div class="debug-summary-value">${escapeHtml(frontendSession.state || "—")}</div>
            <div class="debug-summary-note">${escapeHtml(frontendSession.preferredBaseUrl || tr("debugNotDetected"))}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugIncomeRows"))}</div>
            <div class="debug-summary-value">${escapeHtml(dataSources.income.total)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugCacheShort"))} ${escapeHtml(dataSources.income.cache)} · ${escapeHtml(tr("debugNetworkShort"))} ${escapeHtml(dataSources.income.network)}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugWithdrawRows"))}</div>
            <div class="debug-summary-value">${escapeHtml(dataSources.withdraw_stat.total)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugCacheShort"))} ${escapeHtml(dataSources.withdraw_stat.cache)} · ${escapeHtml(tr("debugNetworkShort"))} ${escapeHtml(dataSources.withdraw_stat.network)}</div>
          </div>
          <div class="debug-summary-card">
            <div class="debug-summary-label">${escapeHtml(tr("debugTotalCache"))}</div>
            <div class="debug-summary-value">${escapeHtml(dataSources.cacheRows)}</div>
            <div class="debug-summary-note">${escapeHtml(tr("debugNetworkShort"))} ${escapeHtml(dataSources.networkRows)}${dataSources.unknownRows ? ` · ${escapeHtml(tr("debugUnknownShort"))} ${escapeHtml(dataSources.unknownRows)}` : ""}</div>
          </div>
        </div>
        <pre class="debug-pre">${escapeHtml(tr("debugThrottle"))}:
${escapeHtml(JSON.stringify(data.apiThrottle || null, null, 2))}</pre>
        <pre class="debug-pre">${escapeHtml(tr("debugApiStats"))}:
${escapeHtml(JSON.stringify(data.apiStats || null, null, 2))}</pre>
        <pre class="debug-pre">${escapeHtml(tr("debugRawSettings"))}:
${escapeHtml(JSON.stringify(safeSettings, null, 2))}</pre>
        <pre class="debug-pre">${escapeHtml(tr("debugRawFrontendSession"))}:
${escapeHtml(JSON.stringify(frontendSession, null, 2))}</pre>
        <pre class="debug-pre">${escapeHtml(tr("debugCachedMeta"))}:
${escapeHtml(JSON.stringify(cached || null, null, 2))}</pre>
      </div>
    </div>
  `;
}

async function loadDebugInfo() {
  const logNode = $("#debugLog");
  if (!logNode) return;
  const hadRenderedContent = !!logNode.dataset.copyText;
  const prevScrollTop = logNode.scrollTop;
  const prevWindowScrollY = window.scrollY;
  const prevWindowScrollX = window.scrollX;
  if (!hadRenderedContent) {
    logNode.textContent = tr("debugLoading");
  }
  try {
    const resp = await chrome.runtime.sendMessage({ type: "GET_DEBUG_INFO" });
    if (!resp?.ok) throw new Error(resp?.error || tr("debugFetchFailed"));
    logNode.dataset.copyText = formatDebugPayload(resp.data);
    logNode.innerHTML = formatDebugHtml(resp.data);
    requestAnimationFrame(() => {
      logNode.scrollTop = prevScrollTop;
      window.scrollTo(prevWindowScrollX, prevWindowScrollY);
    });
  } catch (error) {
    const message = `${tr("debugLoadError")}:\n${error?.message || String(error)}`;
    logNode.dataset.copyText = message;
    logNode.textContent = message;
    requestAnimationFrame(() => {
      logNode.scrollTop = prevScrollTop;
      window.scrollTo(prevWindowScrollX, prevWindowScrollY);
    });
  }
}

// ===== Debug interactions =====
function bindDebugPanel() {
  const details = $("#debugDetails");
  const toggleBtn = $("#debugToggleBtn");
  const refreshBtn = $("#refreshDebugBtn");
  const copyBtn = $("#copyDebugBtn");
  let autoRefreshTimer = null;

  const startAutoRefresh = () => {
    if (autoRefreshTimer) return;
    autoRefreshTimer = setInterval(() => {
      if (!details?.open) return;
      loadDebugInfo().catch(() => {});
    }, 2500);
  };

  const stopAutoRefresh = () => {
    if (!autoRefreshTimer) return;
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  };

  toggleBtn?.addEventListener("click", async () => {
    details.open = !details.open;
    if (details.open) {
      await loadDebugInfo();
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  details?.addEventListener("toggle", async () => {
    if (details.open) {
      await loadDebugInfo();
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  });

  refreshBtn?.addEventListener("click", async () => {
    await loadDebugInfo();
    flashSaved(tr("debugUpdated"));
  });

  copyBtn?.addEventListener("click", async () => {
    const text = $("#debugLog")?.dataset.copyText || $("#debugLog")?.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      flashSaved(tr("debugCopied"));
    } catch {
      flashSaved(tr("debugCopyFailed"));
    }
  });

}

function bindLanguageButton() {
  $("#langBtn")?.addEventListener("click", async () => {
    const nextMode = getNextLanguageMode(currentLanguageMode);
    currentLanguageMode = nextMode;
    currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
    document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
    applySettingsLocale();
    refreshSettingsUI({ rerenderTopBlocks: true });
    flashSaved(tr("languageChanged", { mode: tr(`languageMode${nextMode[0].toUpperCase()}${nextMode.slice(1)}`) }));
    await chrome.storage.local.set({ [UI_LANGUAGE_KEY]: nextMode });
  });
}

// ===== Page refresh helpers =====
function refreshSettingsUI({ rerenderTopBlocks = false } = {}) {
  if (rerenderTopBlocks) {
    renderTopBlockChoices();
  }
  updateChoiceState();
  updateTopBlockState();
  updateToggleState();
  renderChartPreviews();
}

async function initializeSettingsPage() {
  await loadFrontendLanguage();
  applySettingsLocale();
  setSaveNote(tr("settingsLoading"), false);
  await loadSettings();
  await loadCachedDashboard();
  await loadCachedSalesObjects();
  refreshSettingsUI({ rerenderTopBlocks: true });
  bindChoices();
  bindToggles();
  bindDebugPanel();
  bindLanguageButton();
  setSaveNote(tr("themeSaved"), true);
}

// ===== Bootstrap =====
window.addEventListener("resize", () => renderChartPreviews());

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  const hasWithdrawCacheChange = Object.keys(changes || {}).some((key) => key === WITHDRAW_CACHE_INDEX_KEY || key === WITHDRAW_CACHE_LEGACY_KEY || key.startsWith(WITHDRAW_CACHE_PREFIX));
  if (changes.frontendBaseUrl || changes[UI_LANGUAGE_KEY]) {
    if (changes.frontendBaseUrl) {
      currentFrontendBaseUrl = normalizeFrontendBaseUrl(changes.frontendBaseUrl.newValue || "");
    }
    if (changes[UI_LANGUAGE_KEY]) {
      currentLanguageMode = ["auto", "ru", "en"].includes(changes[UI_LANGUAGE_KEY].newValue) ? changes[UI_LANGUAGE_KEY].newValue : "auto";
    }
    currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
    document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
    applySettingsLocale();
    refreshSettingsUI({ rerenderTopBlocks: true });
  }
  if (changes.cachedIncomeObjects || hasWithdrawCacheChange) {
    void loadCachedSalesObjects().then(() => {
      refreshSettingsUI({ rerenderTopBlocks: true });
    });
  }
  if (!changes[APP_SETTINGS_KEY]) return;
  applySettingsState(changes[APP_SETTINGS_KEY].newValue || {});
  refreshSettingsUI();
  setSaveNote(tr("themeSaved"), true);
});

document.addEventListener("DOMContentLoaded", initializeSettingsPage);
