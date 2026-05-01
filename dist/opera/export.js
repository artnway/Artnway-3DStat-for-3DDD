const APP_SETTINGS_KEY = "appSettings";
const EXPORT_SETTINGS_KEY = "exportSettings";
const UI_LANGUAGE_KEY = "uiLanguage";
const WITHDRAW_CACHE_INDEX_KEY = "cachedWithdrawStatIndex";
const WITHDRAW_CACHE_LEGACY_KEY = "cachedWithdrawStatById";
const WITHDRAW_CACHE_PREFIX = "cachedWithdrawStat:";
const DEFAULT_THEME = "ddd-light";
const DEFAULT_EXPORT_SETTINGS = {
  period: "30d",
  sheets: ["summary", "sales", "daily", "monthly", "top"],
  fields: ["date", "model", "site", "amount"],
  customFrom: "",
  customTo: ""
};
const AVAILABLE_SHEETS = ["summary", "sales", "daily", "monthly", "top"];
const AVAILABLE_FIELDS = ["date", "model", "site", "amount"];
const MSK_OFFSET_MS = 3 * 3600 * 1000;
let currentAppSettings = { theme: DEFAULT_THEME };
let currentExportSettings = { ...DEFAULT_EXPORT_SETTINGS };
let cachedDashboard = null;
let cachedObjects = [];
let previewState = null;
let currentLanguage = "ru";
let currentFrontendBaseUrl = "https://3ddd.ru";
let currentLanguageMode = "auto";

const I18N = {
  ru: {
    pageTitle: "3DStat — Экспорт",
    workbookTitle: "3DStat",
    heroTitle: "Экспорт в Excel",
    heroSub: "Собери удобную выгрузку по продажам: выбери период, листы Excel и поля таблицы.<br>Экспорт строится по тем же сохранённым данным, что и основная статистика приложения.",
    periodTitle: "Период",
    periodSub: "Периоды считаются по той же логике, что и статистика в приложении. Для пользовательского диапазона можно выбрать свои даты.",
    period_today: "Сегодня",
    period_7d: "7 дней",
    period_30d: "30 дней",
    period_ytd: "С начала года",
    period_all: "Всё время",
    period_custom: "Свой диапазон",
    from: "От",
    to: "До",
    sheetsTitle: "Листы Excel",
    sheetsSub: "Можно отключить лишние листы и оставить только те, что реально нужны.",
    fieldsTitle: "Поля таблицы «Продажи»",
    fieldsSub: "Настрой, какие колонки попадут в основной лист с продажами.",
    previewTitle: "Превью экспорта",
    previewSub: "Перед выгрузкой можно увидеть, что именно войдёт в файл.",
    readyTitle: "Готово к экспорту",
    readySub: "Файл будет сохранён в формате <code>.xls</code> и откроется в Excel или совместимых таблицах.",
    settings: "Настройки",
    downloadXls: "Скачать .xls",
    telegram: "Telegram",
    telegramAria: "Открыть Telegram-канал",
    footerCopyPrefix: "© Кирилл",
    footerCopySuffix: "Брагин 2026",
    footerNote: "Экспорт использует ту же сохранённую статистику, что и основная панель приложения.",
    sheet_summary: "Сводка",
    sheet_sales: "Продажи",
    sheet_daily: "Дни",
    sheet_monthly: "Месяцы",
    sheet_top: "Топ модели",
    field_date: "Дата и время продажи",
    field_model: "Название модели",
    field_site: "Сайт продажи",
    field_amount: "Сумма авторских",
    field_date_short: "Дата и время",
    field_model_short: "Модель",
    field_site_short: "Сайт",
    field_amount_short: "Сумма",
    rangeReady: "Готов к выгрузке",
    rangeInvalid: "Проверь даты диапазона",
    nothingSelected: "Не выбрано",
    previewPeriod: "Период",
    previewSheets: "Листы",
    previewSales: "Продажи",
    previewMonths: "Месяцы",
    previewDays: "Дни",
    rowsOnSalesSheet: "строк на листе «Продажи»",
    rowsOnMonthsSheet: "строк на листе «Месяцы»",
    rowsOnDaysSheet: "строк на листе «Дни»",
    fileContents: "Что попадёт в файл",
    topModelsTitle: "Топ модели",
    sheetsLabel: "Листы",
    salesFieldsLabel: "Поля «Продажи»",
    averageCheck: "Средний чек",
    summaryPullsFrom: "Сводка",
    summaryFromMonthly: "тянет данные из листов «Месяцы» и «Топ модели»",
    summaryFromDaily: "тянет данные из листов «Дни» и «Топ модели»",
    notSelected: "не выбраны",
    noSalesForPeriod: "Для выбранного периода продаж пока нет.",
    top5Models: "Топ 5 моделей периода",
    noTitle: "Без названия",
    exportDate: "Дата экспорта",
    exportSummaryTitle: "Сводка экспорта",
    keyMetrics: "Ключевые показатели",
    salesCount: "Количество продаж",
    totalRevenue: "Общая сумма",
    salesChannels: "Каналы продаж",
    income3ddd: "Доход 3DDD",
    income3dsky: "Доход 3DSky",
    topModelPeriod: "Топ модель периода",
    name: "Название",
    month: "Месяц",
    day: "День",
    growthDecline: "Рост / падение",
    exportRangeInvalid: "Проверь диапазон",
    selectSheet: "Выбери хотя бы один лист",
    filePrepared: "Файл подготовлен",
    saved: "Сохранено",
    fileNamePrefix: "statistika_prodazh_3ddd",
    languageButtonTitle: "Переключить язык: авто / русский / английский",
    languageChanged: "Язык интерфейса: {mode}",
    languageModeAuto: "Авто",
    languageModeRu: "Русский",
    languageModeEn: "English"
  },
  en: {
    pageTitle: "3DStat — Export",
    workbookTitle: "3DDD Sales Statistics",
    heroTitle: "Export to Excel",
    heroSub: "Build a convenient sales export: choose a period, Excel sheets, and table fields.<br>The export uses the same saved data as the main statistics panel.",
    periodTitle: "Period",
    periodSub: "Periods follow the same logic as the statistics in the app. For a custom range, you can pick your own dates.",
    period_today: "Today",
    period_7d: "7 days",
    period_30d: "30 days",
    period_ytd: "Year to date",
    period_all: "All time",
    period_custom: "Custom range",
    from: "From",
    to: "To",
    sheetsTitle: "Excel sheets",
    sheetsSub: "You can disable unnecessary sheets and keep only the ones you really need.",
    fieldsTitle: "“Sales” table fields",
    fieldsSub: "Choose which columns go to the main sales sheet.",
    previewTitle: "Export preview",
    previewSub: "Preview what will be included in the file before downloading.",
    readyTitle: "Ready to export",
    readySub: "The file will be saved in <code>.xls</code> format and will open in Excel or compatible spreadsheet apps.",
    settings: "Settings",
    downloadXls: "Download .xls",
    telegram: "Telegram",
    telegramAria: "Open Telegram channel",
    footerCopyPrefix: "© Kirill",
    footerCopySuffix: "Bragin 2026",
    footerNote: "The export uses the same saved statistics as the main app panel.",
    sheet_summary: "Summary",
    sheet_sales: "Sales",
    sheet_daily: "Days",
    sheet_monthly: "Months",
    sheet_top: "Top models",
    field_date: "Sale date and time",
    field_model: "Model name",
    field_site: "Sale site",
    field_amount: "Author royalty",
    field_date_short: "Date & time",
    field_model_short: "Model",
    field_site_short: "Site",
    field_amount_short: "Amount",
    rangeReady: "Ready to export",
    rangeInvalid: "Check the date range",
    nothingSelected: "Nothing selected",
    previewPeriod: "Period",
    previewSheets: "Sheets",
    previewSales: "Sales",
    previewMonths: "Months",
    previewDays: "Days",
    rowsOnSalesSheet: "rows on the “Sales” sheet",
    rowsOnMonthsSheet: "rows on the “Months” sheet",
    rowsOnDaysSheet: "rows on the “Days” sheet",
    fileContents: "What goes into the file",
    topModelsTitle: "Top models",
    sheetsLabel: "Sheets",
    salesFieldsLabel: "“Sales” fields",
    averageCheck: "Average check",
    summaryPullsFrom: "Summary",
    summaryFromMonthly: "pulls data from the “Months” and “Top models” sheets",
    summaryFromDaily: "pulls data from the “Days” and “Top models” sheets",
    notSelected: "not selected",
    noSalesForPeriod: "There are no sales for the selected period yet.",
    top5Models: "Top 5 models for the period",
    noTitle: "Untitled",
    exportDate: "Export date",
    exportSummaryTitle: "Export summary",
    keyMetrics: "Key metrics",
    salesCount: "Sales count",
    totalRevenue: "Total revenue",
    salesChannels: "Sales channels",
    income3ddd: "3DDD revenue",
    income3dsky: "3DSky revenue",
    topModelPeriod: "Top model of the period",
    name: "Name",
    month: "Month",
    day: "Day",
    growthDecline: "Growth / decline",
    exportRangeInvalid: "Check the range",
    selectSheet: "Select at least one sheet",
    filePrepared: "File prepared",
    saved: "Saved",
    fileNamePrefix: "3ddd_sales_statistics",
    languageButtonTitle: "Switch language: auto / Russian / English",
    languageChanged: "Interface language: {mode}",
    languageModeAuto: "Auto",
    languageModeRu: "Russian",
    languageModeEn: "English"
  }
};

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

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setHtml(id, value) {
  const node = document.getElementById(id);
  if (node) node.innerHTML = value;
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

function applyExportLocale() {
  document.title = tr("pageTitle");
  setText("exportHeroTitle", tr("heroTitle"));
  setHtml("exportHeroSub", tr("heroSub"));
  setText("periodTitle", tr("periodTitle"));
  setText("periodSub", tr("periodSub"));
  setText("periodToday", tr("period_today"));
  setText("period7d", tr("period_7d"));
  setText("period30d", tr("period_30d"));
  setText("periodYtd", tr("period_ytd"));
  setText("periodAll", tr("period_all"));
  setText("periodCustom", tr("period_custom"));
  setText("customFromLabel", tr("from"));
  setText("customToLabel", tr("to"));
  setText("sheetsTitle", tr("sheetsTitle"));
  setText("sheetsSub", tr("sheetsSub"));
  setText("sheetSummaryLabel", tr("sheet_summary"));
  setText("sheetSalesLabel", tr("sheet_sales"));
  setText("sheetDailyLabel", tr("sheet_daily"));
  setText("sheetMonthlyLabel", tr("sheet_monthly"));
  setText("sheetTopLabel", tr("sheet_top"));
  setText("fieldsTitle", tr("fieldsTitle"));
  setText("fieldsSub", tr("fieldsSub"));
  setText("fieldDateLabel", tr("field_date"));
  setText("fieldModelLabel", tr("field_model"));
  setText("fieldSiteLabel", tr("field_site"));
  setText("fieldAmountLabel", tr("field_amount"));
  setText("previewTitle", tr("previewTitle"));
  setText("previewSub", tr("previewSub"));
  setText("readyTitle", tr("readyTitle"));
  setHtml("readySub", tr("readySub"));
  setText("openSettingsBtn", tr("settings"));
  setText("downloadExportBtn", tr("downloadXls"));
  setText("footerCopyPrefix", tr("footerCopyPrefix"));
  setText("footerCopySuffix", tr("footerCopySuffix"));
  setText("telegramLinkText", tr("telegram"));
  setText("exportFooterNote", tr("footerNote"));
  setText("langBtn", getLanguageButtonLabel(currentLanguageMode));
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

function setSaveNote(text, isSaved = true) {
  const node = $("#saveNote");
  if (!node) return;
  node.textContent = text;
  node.style.color = isSaved ? "var(--text)" : "var(--muted)";
}

function flashSaved(text = tr("saved")) {
  setSaveNote(text, true);
  clearTimeout(flashSaved._timer);
  flashSaved._timer = setTimeout(() => setSaveNote(tr("saved"), true), 1200);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme || DEFAULT_THEME;
}

function fmtMoney(value) {
  return new Intl.NumberFormat(getUiLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value) || 0);
}

function fmtNumber(value) {
  return new Intl.NumberFormat(getUiLocale()).format(Math.round(Number(value) || 0));
}

function rub(value) {
  return `${fmtMoney(value)} ₽`;
}

function getSheetNames() {
  return {
    summary: tr("sheet_summary"),
    sales: tr("sheet_sales"),
    daily: tr("sheet_daily"),
    monthly: tr("sheet_monthly"),
    top: tr("sheet_top")
  };
}

function sanitizeExportSettings(input) {
  const settings = Object.assign({}, DEFAULT_EXPORT_SETTINGS, input || {});
  settings.period = ["today", "7d", "30d", "ytd", "all", "custom"].includes(settings.period) ? settings.period : DEFAULT_EXPORT_SETTINGS.period;
  settings.sheets = Array.isArray(settings.sheets) ? settings.sheets.filter((item) => AVAILABLE_SHEETS.includes(item)) : [...DEFAULT_EXPORT_SETTINGS.sheets];
  settings.fields = Array.isArray(settings.fields) ? settings.fields.filter((item) => AVAILABLE_FIELDS.includes(item)) : [...DEFAULT_EXPORT_SETTINGS.fields];
  if (!settings.sheets.length) settings.sheets = [...DEFAULT_EXPORT_SETTINGS.sheets];
  if (!settings.fields.length) settings.fields = [...DEFAULT_EXPORT_SETTINGS.fields];
  settings.customFrom = String(settings.customFrom || "").trim();
  settings.customTo = String(settings.customTo || "").trim();
  const range = getSelectedRange(settings);
  const canUseMonthly = isMonthlyPeriodAvailable(range);
  if (!canUseMonthly) {
    settings.sheets = settings.sheets.filter((item) => item !== "monthly");
  }
  if (settings.sheets.includes("summary")) {
    settings.sheets = Array.from(new Set([
      ...settings.sheets,
      "daily",
      "top",
      ...(canUseMonthly ? ["monthly"] : [])
    ]));
  }
  if (settings.sheets.includes("monthly")) {
    settings.sheets = Array.from(new Set([...settings.sheets, "daily"]));
  }
  return settings;
}

function parseDateUtcPlus3(text) {
  const m = String(text || "").trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const HH = Number(m[4]);
  const MM = Number(m[5]);
  return new Date(Date.UTC(yyyy, mm - 1, dd, HH - 3, MM, 0, 0));
}

function toMskShiftedDate(input) {
  const ms = input instanceof Date ? input.getTime() : Number(input || 0);
  return new Date(ms + MSK_OFFSET_MS);
}

function bucketDayLabel(dateUtc) {
  const msk = toMskShiftedDate(dateUtc);
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(msk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function detectSaleSite(item) {
  const raw = String(item?.regSite || item?.site || "").trim().toLowerCase();
  if (raw.includes("sky")) return "3DSky";
  if (raw.includes("3ddd")) return "3DDD";
  return Number(item?.royaltyAmount || 0) > 215 ? "3DSky" : "3DDD";
}

function firstNonEmpty(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function incomeObjectKey(item) {
  const explicitId = firstNonEmpty([
    item?.id,
    item?.saleId,
    item?.sale_id,
    item?.incomeId,
    item?.income_id,
    item?.transactionId,
    item?.transaction_id,
    item?.orderId,
    item?.order_id
  ]);
  const modelKey = firstNonEmpty([
    item?.modelId,
    item?.model_id,
    item?.slug,
    item?.article,
    item?.articleId,
    item?.article_id,
    item?.title,
    item?.titleEn
  ]);
  if (explicitId) {
    return ["id", explicitId, item?.date || "", String(item?.royaltyAmount ?? "")].join("|");
  }
  return ["fallback", item?.date || "", modelKey, String(item?.royaltyAmount ?? ""), item?.regSite || ""].join("|");
}

function buildObjectKeyCountMap(objects, keyFn) {
  const counts = new Map();
  for (const item of objects || []) {
    const key = keyFn(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function subtractObjectsByKeyMultiplicity(objects, preferredObjects, keyFn) {
  const remaining = buildObjectKeyCountMap(preferredObjects, keyFn);
  const out = [];
  for (const item of objects || []) {
    const key = keyFn(item);
    const left = key ? (remaining.get(key) || 0) : 0;
    if (key && left > 0) {
      if (left === 1) remaining.delete(key);
      else remaining.set(key, left - 1);
      continue;
    }
    out.push(item);
  }
  return out;
}

function mergeSalesWithWithdrawPriority(incomeObjects, withdrawObjects) {
  const normalizedWithdraw = Array.isArray(withdrawObjects) ? [...withdrawObjects] : [];
  const filteredIncome = subtractObjectsByKeyMultiplicity(incomeObjects, normalizedWithdraw, incomeObjectKey);
  return [...filteredIncome, ...normalizedWithdraw];
}

function getMskNow() {
  return toMskShiftedDate(Date.now());
}

function getPresetRange(period) {
  const nowMs = Date.now();
  const nowMsk = getMskNow();
  const startTodayUtcMs = Date.UTC(
    nowMsk.getUTCFullYear(),
    nowMsk.getUTCMonth(),
    nowMsk.getUTCDate(),
    0, 0, 0, 0
  ) - MSK_OFFSET_MS;
  const msDay = 24 * 60 * 60 * 1000;
  if (period === "today") {
    return { start: startTodayUtcMs, end: nowMs, label: tr("period_today") };
  }
  if (period === "7d") {
    return { start: nowMs - 7 * msDay, end: nowMs, label: tr("period_7d") };
  }
  if (period === "30d") {
    return { start: nowMs - 30 * msDay, end: nowMs, label: tr("period_30d") };
  }
  if (period === "ytd") {
    return {
      start: Date.UTC(nowMsk.getUTCFullYear(), 0, 1, 0, 0, 0, 0) - MSK_OFFSET_MS,
      end: nowMs,
      label: tr("period_ytd")
    };
  }
  return { start: -Infinity, end: Infinity, label: tr("period_all") };
}

function parseLocalDateInput(value, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
  const date = new Date(`${value}${suffix}`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function getSelectedRange(settings) {
  if (settings.period !== "custom") return getPresetRange(settings.period);
  const from = parseLocalDateInput(settings.customFrom, false);
  const to = parseLocalDateInput(settings.customTo, true);
  if (from == null || to == null || from > to) {
    return { start: null, end: null, label: tr("period_custom") };
  }
  return {
    start: from,
    end: to,
    label: `${settings.customFrom} — ${settings.customTo}`
  };
}

function isMonthlyPeriodAvailable(range) {
  if (range?.start == null || range?.end == null) return false;
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return true;
  const spanMs = Math.max(0, range.end - range.start);
  return spanMs > 30 * 24 * 60 * 60 * 1000;
}

function loadCachedSalesObjectsFromPayload(payload) {
  const income = Array.isArray(payload?.incomeObjects) ? payload.incomeObjects : [];
  const withdraw = Array.isArray(payload?.withdrawObjects) ? payload.withdrawObjects : [];
  const combined = Array.isArray(payload?.combinedObjects) ? payload.combinedObjects : null;
  if (combined) {
    return {
      incomeOnly: income,
      withdrawOnly: withdraw,
      combined
    };
  }
  return mergeSalesWithWithdrawPriority(income, withdraw);
}

function loadStateFromStorage(stored) {
  currentAppSettings = Object.assign({ theme: DEFAULT_THEME }, stored?.[APP_SETTINGS_KEY] || {});
  currentExportSettings = sanitizeExportSettings(stored?.[EXPORT_SETTINGS_KEY] || {});
  cachedDashboard = stored?.cachedDashboard || null;
  cachedObjects = loadCachedSalesObjectsFromPayload(stored?.__salesPayload || {}).combined || [];
  applyTheme(currentAppSettings.theme || DEFAULT_THEME);
}

async function persistExportSettings() {
  currentExportSettings = sanitizeExportSettings(currentExportSettings);
  await chrome.storage.local.set({ [EXPORT_SETTINGS_KEY]: currentExportSettings });
  flashSaved();
}

function filterObjectsByRange(objects, range) {
  if (range.start == null || range.end == null) return [];
  return (objects || []).filter((item) => {
    const date = parseDateUtcPlus3(item?.date);
    if (!date) return false;
    const time = date.getTime();
    return time >= range.start && time <= range.end;
  });
}

function buildTopModels(objects) {
  const models = new Map();
  for (const item of objects || []) {
    const key = String(item?.slug || item?.title || item?.titleEn || tr("noTitle"));
    const current = models.get(key) || { title: item?.title || item?.titleEn || tr("noTitle"), count: 0, sum: 0 };
    current.count += 1;
    current.sum += Number(item?.royaltyAmount || 0);
    models.set(key, current);
  }
  return Array.from(models.values())
    .sort((a, b) => (b.sum - a.sum) || (b.count - a.count) || a.title.localeCompare(b.title, getUiLocale()))
    .slice(0, 20);
}

function buildDailyRows(objects) {
  const days = new Map();
  for (const item of objects || []) {
    const date = parseDateUtcPlus3(item?.date);
    if (!date) continue;
    const key = bucketDayLabel(date);
    const current = days.get(key) || { date: key, monthLabel: formatMonthLabelFromDayKey(key), count: 0, sum: 0 };
    current.count += 1;
    current.sum += Number(item?.royaltyAmount || 0);
    days.set(key, current);
  }
  return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function formatMonthLabelFromDayKey(key) {
  const match = String(key || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(key || "");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(getUiLocale(), { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function buildMonthlyRows(dailyRows) {
  const labels = Array.from(new Set((dailyRows || []).map((item) => item.monthLabel)));
  return labels.map((label) => ({ monthLabel: label }));
}

function buildSummary(objects, range) {
  const salesCount = objects.length;
  const totalRevenue = objects.reduce((sum, item) => sum + (Number(item?.royaltyAmount || 0)), 0);
  const avgCheck = salesCount ? totalRevenue / salesCount : 0;
  let revenue3ddd = 0;
  let revenue3dsky = 0;
  for (const item of objects) {
    if (detectSaleSite(item) === "3DSky") revenue3dsky += Number(item?.royaltyAmount || 0);
    else revenue3ddd += Number(item?.royaltyAmount || 0);
  }
  const topModel = buildTopModels(objects)[0] || null;
  return {
    periodLabel: range.label,
    salesCount,
    totalRevenue,
    avgCheck,
    revenue3ddd,
    revenue3dsky,
    topModel
  };
}

function getSelectedSheetLabels(settings) {
  const titles = getSheetNames();
  return settings.sheets.map((item) => titles[item]).filter(Boolean);
}

function getSelectedFieldLabels(settings) {
  const labels = {
    date: tr("field_date_short"),
    model: tr("field_model_short"),
    site: tr("field_site_short"),
    amount: tr("field_amount_short")
  };
  return settings.fields.map((item) => labels[item]).filter(Boolean);
}

function buildPreviewState() {
  const range = getSelectedRange(currentExportSettings);
  const objects = filterObjectsByRange(cachedObjects, range);
  const summary = buildSummary(objects, range);
  const dailyRows = buildDailyRows(objects);
  const monthlyRows = buildMonthlyRows(dailyRows);
  const topModels = buildTopModels(objects);
  previewState = {
    range,
    objects,
    summary,
    dailyRows,
    monthlyRows,
    topModels,
    sheetLabels: getSelectedSheetLabels(currentExportSettings),
    fieldLabels: getSelectedFieldLabels(currentExportSettings)
  };
  return previewState;
}

function renderPreview() {
  const state = buildPreviewState();
  const sheetNames = getSheetNames();
  const summaryNode = $("#previewSummary");
  const sheetsNode = $("#previewSheets");
  const topNode = $("#previewTop");
  const rangeValid = state.range.start != null && state.range.end != null;

  summaryNode.innerHTML = `
    <div class="preview-card">
      <div class="preview-label">${tr("previewPeriod")}</div>
      <div class="preview-value">${state.summary.periodLabel}</div>
      <div class="preview-note">${rangeValid ? tr("rangeReady") : tr("rangeInvalid")}</div>
    </div>
    <div class="preview-card">
      <div class="preview-label">${tr("previewSheets")}</div>
      <div class="preview-value">${fmtNumber(state.sheetLabels.length)}</div>
      <div class="preview-note">${state.sheetLabels.join(" · ") || tr("nothingSelected")}</div>
    </div>
    <div class="preview-card">
      <div class="preview-label">${tr("previewSales")}</div>
      <div class="preview-value">${fmtNumber(state.summary.salesCount)}</div>
      <div class="preview-note">${tr("rowsOnSalesSheet")}</div>
    </div>
    ${state.sheetLabels.includes(sheetNames.monthly) ? `
    <div class="preview-card">
      <div class="preview-label">${tr("previewMonths")}</div>
      <div class="preview-value">${fmtNumber(state.monthlyRows.length)}</div>
      <div class="preview-note">${tr("rowsOnMonthsSheet")}</div>
    </div>` : `
    <div class="preview-card">
      <div class="preview-label">${tr("previewDays")}</div>
      <div class="preview-value">${fmtNumber(state.dailyRows.length)}</div>
      <div class="preview-note">${tr("rowsOnDaysSheet")}</div>
    </div>`}
  `;

  sheetsNode.innerHTML = `
    <div class="preview-list-title">${tr("fileContents")}</div>
    <ul>
      <li><b>${tr("sheetsLabel")}:</b> ${state.sheetLabels.join(", ") || tr("notSelected")}</li>
      <li><b>${tr("salesFieldsLabel")}:</b> ${state.fieldLabels.join(", ") || tr("notSelected")}</li>
      <li><b>3DDD / 3DSky:</b> ${rub(state.summary.revenue3ddd)} / ${rub(state.summary.revenue3dsky)}</li>
      <li><b>${tr("averageCheck")}:</b> ${rub(state.summary.avgCheck)}</li>
      <li><b>${tr("summaryPullsFrom")}:</b> ${state.sheetLabels.includes(sheetNames.monthly) ? tr("summaryFromMonthly") : tr("summaryFromDaily")}</li>
    </ul>
  `;

  if (!state.topModels.length) {
    topNode.innerHTML = `<div class="preview-list-title">${tr("topModelsTitle")}</div><div class="empty-state">${tr("noSalesForPeriod")}</div>`;
    return;
  }

  const topRows = state.topModels.slice(0, 5).map((item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${fmtNumber(item.count)}</td>
      <td>${fmtMoney(item.sum)}</td>
    </tr>
  `).join("");

  topNode.innerHTML = `
    <div class="preview-list-title">${tr("top5Models")}</div>
    <table class="preview-table">
      <thead>
        <tr><th>${tr("field_model_short")}</th><th>${tr("salesCount")}</th><th>${tr("field_amount_short")}</th></tr>
      </thead>
      <tbody>${topRows}</tbody>
    </table>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatLocalDateTime(dateText) {
  const date = parseDateUtcPlus3(dateText);
  if (!date) return String(dateText || "");
  return new Intl.DateTimeFormat(getUiLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatDayForExport(label) {
  const date = new Date(`${label}T00:00:00`);
  if (Number.isNaN(date.getTime())) return label;
  return new Intl.DateTimeFormat(getUiLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function sheetRow(cells) {
  return `<Row>${cells.map((cell) => {
    const type = cell?.type || (typeof cell?.value === "number" ? "Number" : "String");
    const style = cell?.style ? ` ss:StyleID="${cell.style}"` : "";
    const formula = cell?.formula ? ` ss:Formula="${escapeXml(cell.formula)}"` : "";
    const mergeAcross = Number.isFinite(cell?.mergeAcross) ? ` ss:MergeAcross="${Number(cell.mergeAcross)}"` : "";
    return `<Cell${style}${formula}${mergeAcross}><Data ss:Type="${type}">${escapeXml(cell?.value ?? "")}</Data></Cell>`;
  }).join("")}</Row>`;
}

function sheetColumns(widths) {
  return (widths || []).map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${Number(width) || 120}"/>`).join("");
}

function buildSummarySheet(state) {
  const useMonthly = currentExportSettings.sheets.includes("monthly");
  const sheetNames = getSheetNames();
  const sourceSheetName = useMonthly ? sheetNames.monthly : sheetNames.daily;
  const sourceCountColumn = useMonthly ? 2 : 3;
  const sourceSumColumn = useMonthly ? 3 : 4;
  const sourceLastRow = Math.max(2, (useMonthly ? state.monthlyRows.length : state.dailyRows.length) + 1);
  const topFirstRow = state.topModels.length ? 2 : null;
  const rows = [
    sheetRow([{ value: tr("workbookTitle"), style: "Title", mergeAcross: 1 }]),
    sheetRow([{ value: tr("exportSummaryTitle"), style: "Subtitle", mergeAcross: 1 }]),
    sheetRow([{ value: "", style: "Spacer" }, { value: "", style: "Spacer" }]),
    sheetRow([{ value: tr("previewPeriod"), style: "MetaLabel" }, { value: state.summary.periodLabel, style: "MetaValue" }]),
    sheetRow([{ value: tr("exportDate"), style: "MetaLabel" }, { value: new Intl.DateTimeFormat(getUiLocale(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()), style: "MetaValue" }]),
    sheetRow([{ value: "", style: "Spacer" }, { value: "", style: "Spacer" }]),
    sheetRow([{ value: tr("keyMetrics"), style: "Section", mergeAcross: 1 }]),
    sheetRow([{ value: tr("salesCount"), style: "Header" }, { value: state.summary.salesCount, type: "Number", style: "KpiNumber", formula: `=SUM('${sourceSheetName}'!R2C${sourceCountColumn}:R${sourceLastRow}C${sourceCountColumn})` }]),
    sheetRow([{ value: tr("totalRevenue"), style: "Header" }, { value: round2(state.summary.totalRevenue), type: "Number", style: "KpiCurrency", formula: `=SUM('${sourceSheetName}'!R2C${sourceSumColumn}:R${sourceLastRow}C${sourceSumColumn})` }]),
    sheetRow([{ value: tr("averageCheck"), style: "Header" }, { value: round2(state.summary.avgCheck), type: "Number", style: "KpiCurrency", formula: "=IF(R[-2]C=0,0,R[-1]C/R[-2]C)" }]),
    sheetRow([{ value: "", style: "Spacer" }, { value: "", style: "Spacer" }]),
    sheetRow([{ value: tr("salesChannels"), style: "Section", mergeAcross: 1 }]),
    sheetRow([{ value: tr("income3ddd"), style: "Header" }, { value: round2(state.summary.revenue3ddd), type: "Number", style: "Currency" }]),
    sheetRow([{ value: tr("income3dsky"), style: "Header" }, { value: round2(state.summary.revenue3dsky), type: "Number", style: "Currency" }]),
    sheetRow([{ value: "", style: "Spacer" }, { value: "", style: "Spacer" }]),
    sheetRow([{ value: tr("topModelPeriod"), style: "Section", mergeAcross: 1 }]),
    sheetRow([{ value: tr("name"), style: "Header" }, { value: state.summary.topModel?.title || "—", style: "EmphasisText", formula: topFirstRow ? `='${sheetNames.top}'!R${topFirstRow}C1` : null }]),
    sheetRow([{ value: tr("salesCount"), style: "Header" }, { value: state.summary.topModel?.count || 0, type: "Number", style: "KpiNumber", formula: topFirstRow ? `='${sheetNames.top}'!R${topFirstRow}C2` : null }]),
    sheetRow([{ value: tr("field_amount_short"), style: "Header" }, { value: round2(state.summary.topModel?.sum || 0), type: "Number", style: "KpiCurrency", formula: topFirstRow ? `='${sheetNames.top}'!R${topFirstRow}C3` : null }])
  ];
  return { name: sheetNames.summary, columns: [220, 260], rows };
}

function buildSalesSheet(state) {
  const fieldMeta = {
    date: { title: tr("field_date_short"), width: 170, value: (item) => formatLocalDateTime(item?.date) },
    model: { title: tr("field_model_short"), width: 360, value: (item) => String(item?.title || item?.titleEn || tr("noTitle")) },
    site: { title: tr("field_site_short"), width: 120, value: (item) => detectSaleSite(item) },
    amount: { title: tr("field_amount_short"), width: 140, value: (item) => round2(item?.royaltyAmount || 0), type: "Number", style: "Currency" }
  };
  const selectedFields = currentExportSettings.fields.filter((field) => fieldMeta[field]);
  const rows = [sheetRow(selectedFields.map((field) => ({ value: fieldMeta[field].title, style: "Header" })))];
  for (const item of state.objects) {
    rows.push(sheetRow(selectedFields.map((field) => ({
      value: fieldMeta[field].value(item),
      type: fieldMeta[field].type,
      style: fieldMeta[field].style
    }))));
  }
  return { name: getSheetNames().sales, columns: selectedFields.map((field) => fieldMeta[field].width), rows };
}

function buildDailySheet(state) {
  const rows = [
    sheetRow([{ value: tr("month"), style: "Header" }, { value: tr("day"), style: "Header" }, { value: tr("salesCount"), style: "Header" }, { value: tr("field_amount_short"), style: "Header" }])
  ];
  for (const item of state.dailyRows) {
    rows.push(sheetRow([
      { value: item.monthLabel },
      { value: formatDayForExport(item.date) },
      { value: item.count, type: "Number" },
      { value: round2(item.sum), type: "Number", style: "Currency" }
    ]));
  }
  return { name: getSheetNames().daily, columns: [140, 140, 120, 150], rows };
}

function buildMonthlySheet(state) {
  const sheetNames = getSheetNames();
  const dailyLastRow = Math.max(2, state.dailyRows.length + 1);
  const rows = [
    sheetRow([
      { value: tr("month"), style: "Header" },
      { value: tr("salesCount"), style: "Header" },
      { value: tr("field_amount_short"), style: "Header" },
      { value: tr("growthDecline"), style: "Header" }
    ])
  ];
  state.monthlyRows.forEach((item, index) => {
    const rowIndex = index + 2;
    rows.push(sheetRow([
      { value: item.monthLabel },
      { value: 0, type: "Number", formula: `=SUMIF('${sheetNames.daily}'!R2C1:R${dailyLastRow}C1,RC1,'${sheetNames.daily}'!R2C3:R${dailyLastRow}C3)` },
      { value: 0, type: "Number", style: "Currency", formula: `=SUMIF('${sheetNames.daily}'!R2C1:R${dailyLastRow}C1,RC1,'${sheetNames.daily}'!R2C4:R${dailyLastRow}C4)` },
      index === 0
        ? { value: "—" }
        : { value: 0, type: "Number", style: "Percent", formula: `=IF(R[-1]C[-1]=0,0,(RC[-1]-R[-1]C[-1])/R[-1]C[-1])` }
    ]));
  });
  return { name: sheetNames.monthly, columns: [160, 120, 150, 150], rows };
}

function buildTopSheet(state) {
  const rows = [
    sheetRow([{ value: tr("field_model_short"), style: "Header" }, { value: tr("salesCount"), style: "Header" }, { value: tr("field_amount_short"), style: "Header" }])
  ];
  for (const item of state.topModels) {
    rows.push(sheetRow([
      { value: item.title },
      { value: item.count, type: "Number" },
      { value: round2(item.sum), type: "Number", style: "Currency" }
    ]));
  }
  return { name: getSheetNames().top, columns: [380, 120, 150], rows };
}

function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function sanitizeSheetName(name) {
  return String(name || "Sheet")
    .replace(/[\\/:?*\[\]]/g, " ")
    .slice(0, 31) || "Sheet";
}

function buildWorkbookXml(sheets) {
  const worksheets = sheets.map((sheet) => `
    <Worksheet ss:Name="${escapeXml(sanitizeSheetName(sheet.name))}">
      <Table>
        ${sheetColumns(sheet.columns)}
        ${sheet.rows.join("\n")}
      </Table>
    </Worksheet>
  `).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#E2E8F0" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CBD5E1"/>
      </Borders>
    </Style>
    <Style ss:ID="Title">
      <Font ss:Bold="1" ss:Size="18" ss:Color="#0F172A"/>
      <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="Subtitle">
      <Font ss:Bold="1" ss:Size="12" ss:Color="#64748B"/>
    </Style>
    <Style ss:ID="Section">
      <Font ss:Bold="1" ss:Size="12" ss:Color="#0F172A"/>
      <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C7D2FE"/>
      </Borders>
    </Style>
    <Style ss:ID="MetaLabel">
      <Font ss:Bold="1" ss:Color="#64748B"/>
    </Style>
    <Style ss:ID="MetaValue">
      <Font ss:Color="#0F172A"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="Spacer">
      <Font ss:Size="6"/>
    </Style>
    <Style ss:ID="Currency">
      <NumberFormat ss:Format="Standard"/>
    </Style>
    <Style ss:ID="Percent">
      <NumberFormat ss:Format="0.0%"/>
    </Style>
    <Style ss:ID="KpiNumber">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
    <Style ss:ID="KpiCurrency">
      <Font ss:Bold="1" ss:Size="14" ss:Color="#0F172A"/>
      <Alignment ss:Horizontal="Right"/>
      <NumberFormat ss:Format="Standard"/>
    </Style>
    <Style ss:ID="EmphasisText">
      <Font ss:Bold="1" ss:Color="#0F172A"/>
      <Alignment ss:Horizontal="Right"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;
}

function buildExportSheets(state) {
  const out = [];
  if (currentExportSettings.sheets.includes("daily")) out.push(buildDailySheet(state));
  if (currentExportSettings.sheets.includes("monthly")) out.push(buildMonthlySheet(state));
  if (currentExportSettings.sheets.includes("top")) out.push(buildTopSheet(state));
  if (currentExportSettings.sheets.includes("sales")) out.push(buildSalesSheet(state));
  if (currentExportSettings.sheets.includes("summary")) out.unshift(buildSummarySheet(state));
  return out;
}

function buildFileName(state) {
  const label = state.summary.periodLabel
    .replace(/\s+/g, "_")
    .replace(/[^\w\u0400-\u04FF-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "") || "export";
  const stamp = new Date();
  const parts = [
    stamp.getFullYear(),
    String(stamp.getMonth() + 1).padStart(2, "0"),
    String(stamp.getDate()).padStart(2, "0"),
    "-",
    String(stamp.getHours()).padStart(2, "0"),
    String(stamp.getMinutes()).padStart(2, "0")
  ].join("");
  return `${tr("fileNamePrefix")}_${label}_${parts}.xls`;
}

function downloadBlob(content, fileName) {
  const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindPeriodChoices() {
  document.querySelectorAll('[data-setting="period"]').forEach((node) => {
    node.addEventListener("click", async () => {
      currentExportSettings.period = node.dataset.value;
      currentExportSettings = sanitizeExportSettings(currentExportSettings);
      updatePeriodUi();
      renderPreview();
      await persistExportSettings();
    });
  });
}

function updatePeriodUi() {
  document.querySelectorAll('[data-setting="period"]').forEach((node) => {
    node.classList.toggle("active", node.dataset.value === currentExportSettings.period);
  });
  $("#customRange")?.classList.toggle("visible", currentExportSettings.period === "custom");
  $("#customFrom").value = currentExportSettings.customFrom || "";
  $("#customTo").value = currentExportSettings.customTo || "";
  updateCheckboxUi();
}

function bindCheckboxGroup(selector, key, available) {
  document.querySelectorAll(selector).forEach((input) => {
    input.addEventListener("change", async () => {
      const value = input.dataset.sheet || input.dataset.field;
      let next = Array.isArray(currentExportSettings[key]) ? [...currentExportSettings[key]] : [];
      if (input.checked) {
        if (!next.includes(value) && available.includes(value)) next.push(value);
      } else {
        next = next.filter((item) => item !== value);
      }
      if (!next.length) {
        input.checked = true;
        return;
      }
      currentExportSettings[key] = next;
      currentExportSettings = sanitizeExportSettings(currentExportSettings);
      updateCheckboxUi();
      renderPreview();
      await persistExportSettings();
    });
  });
}

function updateCheckboxUi() {
  document.querySelectorAll("#sheetChoices input[type=checkbox]").forEach((input) => {
    const isMonthly = input.dataset.sheet === "monthly";
    const range = getSelectedRange(currentExportSettings);
    const monthlyAvailable = isMonthlyPeriodAvailable(range);
    input.checked = currentExportSettings.sheets.includes(input.dataset.sheet);
    input.disabled = isMonthly && !monthlyAvailable;
    input.closest(".checkbox-row")?.classList.toggle("disabled", isMonthly && !monthlyAvailable);
  });
  document.querySelectorAll("#fieldChoices input[type=checkbox]").forEach((input) => {
    input.checked = currentExportSettings.fields.includes(input.dataset.field);
  });
}

function bindCustomRange() {
  ["#customFrom", "#customTo"].forEach((selector) => {
    $(selector)?.addEventListener("change", async (event) => {
      currentExportSettings[event.target.id] = String(event.target.value || "");
      currentExportSettings = sanitizeExportSettings(currentExportSettings);
      updatePeriodUi();
      renderPreview();
      await persistExportSettings();
    });
  });
}

async function loadInitialState() {
  const stored = await chrome.storage.local.get([
    APP_SETTINGS_KEY,
    EXPORT_SETTINGS_KEY,
    "cachedDashboard"
  ]);
  const salesResp = await chrome.runtime.sendMessage({ type: "GET_CACHED_SALES_OBJECTS" });
  stored.__salesPayload = salesResp?.ok ? (salesResp.data || {}) : {};
  loadStateFromStorage(stored);
}

function bindActions() {
  $("#openSettingsBtn")?.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("settings.html") });
  });

  $("#downloadExportBtn")?.addEventListener("click", () => {
    const state = buildPreviewState();
    if (state.range.start == null || state.range.end == null) {
      setSaveNote(tr("exportRangeInvalid"), false);
      return;
    }
    const sheets = buildExportSheets(state);
    if (!sheets.length) {
      setSaveNote(tr("selectSheet"), false);
      return;
    }
    const workbook = buildWorkbookXml(sheets);
    downloadBlob(workbook, buildFileName(state));
    flashSaved(tr("filePrepared"));
  });

  $("#langBtn")?.addEventListener("click", async () => {
    const nextMode = getNextLanguageMode(currentLanguageMode);
    currentLanguageMode = nextMode;
    currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
    document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
    applyExportLocale();
    updatePeriodUi();
    updateCheckboxUi();
    renderPreview();
    flashSaved(tr("languageChanged", { mode: tr(`languageMode${nextMode[0].toUpperCase()}${nextMode.slice(1)}`) }));
    await chrome.storage.local.set({ [UI_LANGUAGE_KEY]: nextMode });
  });
}

function bindStorageSync() {
  chrome.storage.onChanged?.addListener((changes, area) => {
    if (area !== "local") return;
    const hasWithdrawCacheChange = Object.keys(changes || {}).some((key) =>
      key === WITHDRAW_CACHE_INDEX_KEY ||
      key === WITHDRAW_CACHE_LEGACY_KEY ||
      key.startsWith(WITHDRAW_CACHE_PREFIX)
    );
    if (changes?.[APP_SETTINGS_KEY]) {
      currentAppSettings = Object.assign({ theme: DEFAULT_THEME }, changes[APP_SETTINGS_KEY].newValue || {});
      applyTheme(currentAppSettings.theme || DEFAULT_THEME);
    }
    if (changes?.[EXPORT_SETTINGS_KEY]) {
      currentExportSettings = sanitizeExportSettings(changes[EXPORT_SETTINGS_KEY].newValue || {});
      updatePeriodUi();
      updateCheckboxUi();
      renderPreview();
    }
    if (changes?.cachedDashboard) {
      cachedDashboard = changes.cachedDashboard.newValue || null;
      renderPreview();
    }
    if (changes?.cachedIncomeObjects || hasWithdrawCacheChange) {
      void chrome.runtime.sendMessage({ type: "GET_CACHED_SALES_OBJECTS" }).then((resp) => {
        cachedObjects = loadCachedSalesObjectsFromPayload(resp?.ok ? (resp.data || {}) : {}).combined || [];
        renderPreview();
      });
    }
    if (changes?.frontendBaseUrl || changes?.[UI_LANGUAGE_KEY]) {
      if (changes?.frontendBaseUrl) {
        currentFrontendBaseUrl = normalizeFrontendBaseUrl(changes.frontendBaseUrl.newValue || "");
      }
      if (changes?.[UI_LANGUAGE_KEY]) {
        currentLanguageMode = ["auto", "ru", "en"].includes(changes[UI_LANGUAGE_KEY].newValue) ? changes[UI_LANGUAGE_KEY].newValue : "auto";
      }
      currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
      document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
      applyExportLocale();
      updatePeriodUi();
      updateCheckboxUi();
      renderPreview();
    }
  });
}

async function init() {
  await loadFrontendLanguage();
  applyExportLocale();
  await loadInitialState();
  updatePeriodUi();
  updateCheckboxUi();
  renderPreview();
  bindPeriodChoices();
  bindCheckboxGroup("#sheetChoices input[type=checkbox]", "sheets", AVAILABLE_SHEETS);
  bindCheckboxGroup("#fieldChoices input[type=checkbox]", "fields", AVAILABLE_FIELDS);
  bindCustomRange();
  bindActions();
  bindStorageSync();
}

init().catch((error) => {
  console.error(error);
  setSaveNote(error?.message || String(error), false);
});
