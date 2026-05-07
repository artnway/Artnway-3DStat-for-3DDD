/* DOM & popup constants */
const $ = (q) => document.querySelector(q);
const extApi = globalThis.browser || globalThis.chrome;
const APP_SETTINGS_KEY = "appSettings";
const POPUP_UI_STATE_KEY = "popupUiState";
const SETUP_STARTED_KEY = "setupStarted";
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
  splitSiteLines: false,
  splitSiteLinesOverlaySky: false,
  previousPeriodLine: false,
  topBlocksCalendarMode: false,
  topBlocksCalendarCompareFullPeriod: false
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
const AVAILABLE_CHART_STYLES = new Set(["classic", "smooth", "bar"]);
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
const statusEl = $("#status");
const hintEl = $("#hint");
const progressTextEl = $("#progressText");
const progressBarEl = $("#progressbar");
const progressFillEl = $("#progressfill");
const statusLineEl = $("#statusline");
const onboardingEl = $("#onboarding");
const dashboardShellEl = $("#dashboardShell");

/* Popup runtime state */
let lastData = null;
let currentChartScale = "30d";
let currentTopScale = "30d";
let refreshInProgress = false;
let chartViewportInitialized = false;
const TOP_MODELS_STEP = 5;
const TOP_MODELS_MAX_VISIBLE = 20;
const topModelsVisibleByScale = {
  "24h": TOP_MODELS_STEP,
  "7d": TOP_MODELS_STEP,
  "30d": TOP_MODELS_STEP,
  "all": TOP_MODELS_STEP
};
const chartViewportByScale = {
  "24h": { start: 0, size: 1 },
  "7d": { start: 0, size: 1 },
  "30d": { start: 0, size: 1 },
  "all": { start: 0, size: 1 }
};
let chartDragState = null;
let chartSelection = null;
let lastRenderedChartState = null;
let lastUpdatedAt = null;
let currentAppSettings = { ...DEFAULT_SETTINGS };
let cachedSalesObjects = [];
let currentLanguage = "ru";
let currentFrontendBaseUrl = "https://3ddd.ru";
let currentLanguageMode = "auto";
let setupStarted = false;
const localizedModelTitleCache = new Map();
const pendingModelTitleRequests = new Map();

function isPromiseLike(value) {
  return !!value && typeof value.then === "function";
}

function getChromeRuntimeLastErrorMessage() {
  return String(globalThis.chrome?.runtime?.lastError?.message || "");
}

async function storageGet(keys) {
  if ((globalThis.browser && extApi === globalThis.browser) || extApi.storage?.local?.get?.length <= 1) {
    return await extApi.storage.local.get(keys);
  }
  return await new Promise((resolve, reject) => {
    extApi.storage.local.get(keys, (result) => {
      const errorMessage = getChromeRuntimeLastErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(result || {});
    });
  });
}

async function storageSet(payload) {
  if ((globalThis.browser && extApi === globalThis.browser) || extApi.storage?.local?.set?.length <= 1) {
    return await extApi.storage.local.set(payload);
  }
  return await new Promise((resolve, reject) => {
    extApi.storage.local.set(payload, () => {
      const errorMessage = getChromeRuntimeLastErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve();
    });
  });
}

async function sendRuntimeMessage(message) {
  const result = extApi.runtime.sendMessage(message);
  if (isPromiseLike(result)) {
    return await result;
  }
  return await new Promise((resolve, reject) => {
    extApi.runtime.sendMessage(message, (response) => {
      const errorMessage = getChromeRuntimeLastErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(response);
    });
  });
}

async function getCurrentTabCompat() {
  if (typeof extApi.tabs?.getCurrent !== "function") return null;
  const result = extApi.tabs.getCurrent();
  if (isPromiseLike(result)) {
    return await result;
  }
  return await new Promise((resolve, reject) => {
    extApi.tabs.getCurrent((tab) => {
      const errorMessage = getChromeRuntimeLastErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(tab || null);
    });
  });
}

const I18N = {
  ru: {
    onboardingKicker: "Первый запуск",
    onboardingTitle: "Вся статистика хранится только у тебя",
    onboardingLead: "Расширение собирает данные по продажам и сохраняет их локально в кэше браузера. Никто, кроме тебя, не получает к ним доступ!",
    onboardingLocalTitle: "Локальное хранение",
    onboardingLocalText: "Вся статистика, история продаж и собранные данные остаются внутри браузера на этом компьютере. Никакие внешние серверы расширения их не получают.",
    onboardingCollectTitle: "Как собираются данные",
    onboardingCollectText: "Сначала читаем свежие продажи из «Списка продаж», затем проверяем «Историю выплат» и дособираем продажи, которые уже исчезли из свежего списка.",
    onboardingUpdatesTitle: "Обновления под контролем",
    onboardingUpdatesText: "После первичной сборки данные обновляются только по кнопке «Обновить». Во время загрузки сверху будет виден статус этапа и прогресс.",
    onboardingButton: "Собрать статистику",
    onboardingHint: "Первичная загрузка может занять немного времени, если история продаж большая.",
    appTitle: "3DStat",
    appSubtitle: "Твоя личная статистика продаж",
    refresh: "Обновить",
    waitingHint: "Ожидает обновления",
    waitingProgress: "Последняя статистика появится здесь после загрузки.",
    chart: "График",
    topModels: "Топ модели",
    topModelsLoadMore: "Загрузить ещё",
    topModelsCollapse: "Свернуть",
    tab24h: "24 часа",
    tab7d: "7 дней",
    tab30d: "30 дней",
    tabAll: "Всё время",
    scale: "Масштаб",
    zoomAll: "Всё",
    prevMonth: "Предыдущий месяц",
    nextMonth: "Следующий месяц",
    showMonths: "{count}м",
    totalSoldModels: "Проданных моделей всего",
    uniqueModels: "Уникальных моделей",
    settings: "Настройки",
    export: "Экспорт",
    openInTab: "Вкладка",
    telegram: "Telegram",
    footerCopyPrefix: "© Кирилл",
    footerCopySuffix: "Брагин 2026",
    topMetrics: "Верхние показатели",
    dashboardPanel: "Основная панель",
    actions: "Действия",
    summaryMetrics: "Сводные показатели",
    authorInfo: "Информация об авторе",
    telegramAria: "Открыть Telegram-канал",
    todayRevenue: "Заработано сегодня",
    todayRevenueRolling: "Заработано за 24 часа",
    weekRevenue: "Заработано за 7 дней",
    weekRevenueCalendar: "Заработано за неделю",
    monthRevenue: "Заработано за 30 дней",
    monthRevenueCalendar: "Заработано за месяц",
    ytdRevenue: "Заработано с начала года",
    topModel30: "Топ модель за 30 дней",
    topModel7: "Топ модель за 7 дней",
    siteSplitTitle: "Продаж за 30 дней",
    topModel30Calendar: "Топ модель за месяц",
    topModel7Calendar: "Топ модель за неделю",
    siteSplitTitleCalendar: "Продаж за месяц",
    nextRankTitle: "Продаж до следующего уровня",
    previousDay: "За предыдущие 24 часа",
    previous7d: "За предыдущие 7 дней",
    previous30d: "За предыдущие 30 дней",
    previousCalendarDay: "За этот же отрезок вчерашнего дня",
    previousCalendarWeek: "За этот же отрезок прошлой недели",
    previousCalendarMonth: "За этот же отрезок прошлого месяца",
    previousTop30: "У этой модели за предыдущие 30 дней",
    previousTop7: "У этой модели за предыдущие 7 дней",
    previousTopCalendarWeek: "У этой модели за этот же отрезок прошлой недели",
    previousTopCalendarMonth: "У этой модели за этот же отрезок прошлого месяца",
    previousFullCalendarDay: "За вчерашний день",
    previousFullCalendarWeek: "За прошлую неделю",
    previousFullCalendarMonth: "За прошлый месяц",
    previousTopFullCalendarWeek: "У этой модели за прошлую неделю",
    previousTopFullCalendarMonth: "У этой модели за прошлый месяц",
    previousPeriod: "Прошлый период",
    previousPeriodRevenue: "{label}: {amount}",
    previousPeriodSales: "{label}: {count} продаж",
    vsPrevDay: "к предыдущим 24 часам",
    vsPrev7d: "к предыдущим 7 дням",
    vsPrev30d: "к предыдущим 30 дням",
    vsPrevCalendarDay: "к вчерашнему дню",
    vsPrevCalendarWeek: "к прошлой неделе",
    vsPrevCalendarMonth: "к прошлому месяцу",
    vsPrevFullCalendarDay: "к вчерашнему дню",
    vsPrevFullCalendarWeek: "к прошлой неделе",
    vsPrevFullCalendarMonth: "к прошлому месяцу",
    avgMonthIncome: "средний доход в месяц",
    monthsCountYtd: "Учтено месяцев с начала года: {count}",
    salesWord: "продаж",
    noData: "Нет данных",
    noDataPeriod: "Нет данных.",
    totalSales: "всего продаж",
    currentRank: "Текущий",
    maxRank: "Максимум",
    updatedAt: "Обновлено: {value}",
    newSales: "Новых продаж: {count}",
    partialSync: "частичная синхронизация",
    partialSyncHint: "Сеть прервалась, данные сохранены частично. Нажмите \"Обновить\", чтобы догрузить оставшиеся данные.",
    warning: "Предупреждение",
    withdrawUnavailable: "withdraw_stat недоступен",
    withdrawUnavailableHint: "Предупреждение: часть истории может быть в withdraw_stat.\n{error}",
    prepareRefresh: "Подготавливает обновление",
    prepareRefreshDetails: "Запускает загрузку данных",
    refreshErrorTitle: "Ошибка обновления",
    refreshErrorHint: "Обновление не завершилось",
    error: "Ошибка",
    languageAutoHint: "Язык интерфейса определяется автоматически по активному сайту.",
    languageButtonTitle: "Переключить язык: авто / русский / английский",
    languageChanged: "Язык интерфейса: {mode}",
    languageModeAuto: "Авто",
    languageModeRu: "Русский",
    languageModeEn: "English",
    averageLine: "Средняя линия",
    averagePerDay: "в день",
    averagePerMonth: "в месяц",
    chartSalesValue: "Продажи <b>{value}</b>",
    lastManualRefreshError: "Последняя ошибка ручного обновления:\n{error}",
    refreshFailed: "Не удалось обновить данные",
    rankBeyondMax: "Круче только яйца"
  },
  en: {
    onboardingKicker: "First launch",
    onboardingTitle: "All stats stay only with you",
    onboardingLead: "The extension collects sales data and stores it locally in your browser cache. No one but you gets access to it.",
    onboardingLocalTitle: "Stored locally",
    onboardingLocalText: "All statistics, sales history, and collected data remain inside the browser on this computer. No external extension servers receive them.",
    onboardingCollectTitle: "How data is collected",
    onboardingCollectText: "First we read fresh sales from the sales list, then check payout history and restore sales that have already disappeared from the fresh list.",
    onboardingUpdatesTitle: "Updates under your control",
    onboardingUpdatesText: "After the first sync, data refreshes only when you press Refresh. During loading, the current stage and progress are shown above.",
    onboardingButton: "Collect statistics",
    onboardingHint: "The initial load may take a little time if your sales history is large.",
    appTitle: "3DStat",
    appSubtitle: "Your personal sales statistics",
    refresh: "Refresh",
    waitingHint: "Waiting for refresh",
    waitingProgress: "Your latest statistics will appear here after loading.",
    chart: "Chart",
    topModels: "Top models",
    topModelsLoadMore: "Load more",
    topModelsCollapse: "Collapse",
    tab24h: "24 hours",
    tab7d: "7 days",
    tab30d: "30 days",
    tabAll: "All time",
    scale: "Scale",
    zoomAll: "All",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    showMonths: "{count}m",
    totalSoldModels: "Total models sold",
    uniqueModels: "Unique models",
    settings: "Settings",
    export: "Export",
    openInTab: "Open tab",
    telegram: "Telegram",
    footerCopyPrefix: "© Kirill",
    footerCopySuffix: "Bragin 2026",
    topMetrics: "Top metrics",
    dashboardPanel: "Main panel",
    actions: "Actions",
    summaryMetrics: "Summary metrics",
    authorInfo: "Author info",
    telegramAria: "Open Telegram channel",
    todayRevenue: "Revenue today",
    todayRevenueRolling: "Revenue for 24 hours",
    weekRevenue: "Revenue for 7 days",
    weekRevenueCalendar: "Revenue for a week",
    monthRevenue: "Revenue for 30 days",
    monthRevenueCalendar: "Revenue for a month",
    ytdRevenue: "Revenue since the start of the year",
    topModel30: "Top model for 30 days",
    topModel7: "Top model for 7 days",
    siteSplitTitle: "Sales for 30 days",
    topModel30Calendar: "Top model for a month",
    topModel7Calendar: "Top model for a week",
    siteSplitTitleCalendar: "Sales for a month",
    nextRankTitle: "Sales to the next rank",
    previousDay: "Previous 24 hours",
    previous7d: "Previous 7 days",
    previous30d: "Previous 30 days",
    previousCalendarDay: "Same slice of yesterday",
    previousCalendarWeek: "Same slice of the previous week",
    previousCalendarMonth: "Same slice of the previous month",
    previousTop30: "This model in the previous 30 days",
    previousTop7: "This model in the previous 7 days",
    previousTopCalendarWeek: "This model in the same slice of the previous week",
    previousTopCalendarMonth: "This model in the same slice of the previous month",
    previousFullCalendarDay: "Yesterday",
    previousFullCalendarWeek: "Last week",
    previousFullCalendarMonth: "Last month",
    previousTopFullCalendarWeek: "This model last week",
    previousTopFullCalendarMonth: "This model last month",
    previousPeriod: "Previous period",
    previousPeriodRevenue: "{label}: {amount}",
    previousPeriodSales: "{label}: {count} sales",
    vsPrevDay: "vs previous 24 hours",
    vsPrev7d: "vs previous 7 days",
    vsPrev30d: "vs previous 30 days",
    vsPrevCalendarDay: "vs yesterday",
    vsPrevCalendarWeek: "vs last week",
    vsPrevCalendarMonth: "vs last month",
    vsPrevFullCalendarDay: "vs yesterday",
    vsPrevFullCalendarWeek: "vs last week",
    vsPrevFullCalendarMonth: "vs last month",
    avgMonthIncome: "average income per month",
    monthsCountYtd: "Months counted since the start of the year: {count}",
    salesWord: "sales",
    noData: "No data",
    noDataPeriod: "No data.",
    totalSales: "total sales",
    currentRank: "Current",
    maxRank: "Maximum",
    updatedAt: "Updated: {value}",
    newSales: "New sales: {count}",
    partialSync: "partial sync",
    partialSyncHint: "The network was interrupted, so the data was saved partially. Press \"Refresh\" to load the remaining history.",
    warning: "Warning",
    withdrawUnavailable: "withdraw_stat unavailable",
    withdrawUnavailableHint: "Warning: part of the history may still be in withdraw_stat.\n{error}",
    prepareRefresh: "Preparing refresh",
    prepareRefreshDetails: "Starting data load",
    refreshErrorTitle: "Refresh error",
    refreshErrorHint: "The update did not finish",
    error: "Error",
    languageAutoHint: "The interface language follows the active site automatically.",
    languageButtonTitle: "Switch language: auto / Russian / English",
    languageChanged: "Interface language: {mode}",
    languageModeAuto: "Auto",
    languageModeRu: "Russian",
    languageModeEn: "English",
    averageLine: "Average line",
    averagePerDay: "per day",
    averagePerMonth: "per month",
    chartSalesValue: "Sales <b>{value}</b>",
    lastManualRefreshError: "Last manual refresh error:\n{error}",
    refreshFailed: "Failed to refresh data",
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
    progress_prepare_refresh: "Preparing refresh",
    progress_starting_load: "Starting data load",
    progress_checking_payout_history: "Checking payout history",
    progress_page_of_total: "Page {current} of {total}",
    progress_page_only: "Page {current}",
    progress_partial_sync_suffix: "partial sync",
    progress_network_interrupted: "The network was interrupted while loading payout history",
    progress_withdraw_timeout: "The request got stuck while loading withdraw_stat",
    progress_loading_stopped: "Loading stopped before completion",
    sessionNotFound: "No active 3DDD / 3DSky session was found. First sign in to your account on 3ddd.ru or 3dsky.org, then try again.",
    tokenNotFound: "Could not find a fresh token on the page. Make sure you are signed in on 3ddd.ru or 3dsky.org. If the session was just refreshed, try again in a few seconds.",
    tokenMissing: "Token is not set. Open the token section and paste the JWT, or use auto pickup.",
    withdrawIdMissing: "transaction_withdraw_id is not set for withdraw_stat.",
    withdrawIdAutoFindFailed: "Could not find withdraw id automatically.",
    refreshCompleted: "Refresh completed",
    accessCheck: "Checking API access",
    pickupToken: "Picking up a new token",
    incomeLoading: "Loading data from Sales List",
    payoutHistoryLoading: "Loading data from Payout History",
    incomeCachePreparing: "Preparing sales cache",
    manualRefreshError: "Manual refresh error",
    newSalesFound: "New sales: {count}"
  }
};

/* Settings & storage */
function sanitizeViewport(viewport) {
  const start = Number(viewport?.start);
  const size = Number(viewport?.size);
  const safeSize = Number.isFinite(size) ? clamp(size, 0.01, 1) : 1;
  const safeStart = Number.isFinite(start) ? clamp(start, 0, 1 - safeSize) : 0;
  return { start: safeStart, size: safeSize };
}

async function loadPopupUiState() {
  try {
    const stored = await storageGet([POPUP_UI_STATE_KEY, SETUP_STARTED_KEY]);
    const state = stored?.[POPUP_UI_STATE_KEY] || {};
    setupStarted = stored?.[SETUP_STARTED_KEY] === true || state?.setupStarted === true;
    if (["24h", "7d", "30d", "all"].includes(state.chartScale)) {
      currentChartScale = state.chartScale;
    }
    if (state?.chartViewportByScale?.all) {
      chartViewportByScale.all = sanitizeViewport(state.chartViewportByScale.all);
      chartViewportInitialized = true;
    }
  } catch {}
}

async function persistPopupUiState() {
  await storageSet({
    [SETUP_STARTED_KEY]: setupStarted,
    [POPUP_UI_STATE_KEY]: {
      setupStarted,
      chartScale: currentChartScale,
      chartViewportByScale: {
        all: sanitizeViewport(chartViewportByScale.all || { start: 0, size: 1 })
      }
    }
  });
}

async function markSetupStarted(value = true) {
  setupStarted = value === true;
  try {
    await persistPopupUiState();
  } catch {}
}

function themeColor(name, fallback = "") {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
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

function localizeRankTitle(rank) {
  const key = String(rank?.key || "");
  const dict = I18N[currentLanguage] || I18N.ru;
  return dict[`rank_${key}`] || rank?.title || "";
}

function translateProgressText(text, progress = null) {
  const raw = String(text || "");
  if (!raw || currentLanguage !== "en") return raw;

  const current = progress?.current ?? "";
  const total = progress?.total ?? "";
  const replacements = [
    ["Подготавливает обновление", tr("progress_prepare_refresh")],
    ["Запускает загрузку данных", tr("progress_starting_load")],
    ["Проверяет «Историю вывода»", tr("progress_checking_payout_history")],
    ["Загружает данные из «Списка продаж»", tr("incomeLoading")],
    ["Загружает данные из «Истории вывода»", tr("payoutHistoryLoading")],
    ["Подготавливает кэш продаж", tr("incomeCachePreparing")],
    ["Проверяет доступ к API", tr("accessCheck")],
    ["Подхватывает новый токен", tr("pickupToken")],
    ["Обновление завершено", tr("refreshCompleted")],
    ["Последняя ошибка ручного обновления", tr("manualRefreshError")],
    ["Не найдена активная сессия 3DDD / 3DSky. Сначала войди в аккаунт на 3ddd.ru или 3dsky.org, затем повтори попытку.", tr("sessionNotFound")],
    ["Не нашёл свежий токен на странице. Убедись, что ты залогинен на 3ddd.ru или 3dsky.org. Если сессия только что обновилась, повтори через пару секунд.", tr("tokenNotFound")],
    ["Не задан токен. Открой «Токен» и вставь JWT или нажми «Автоподхватить».", tr("tokenMissing")],
    ["Не задан transaction_withdraw_id для withdraw_stat (нажми Токен → Авто-найти или вставь вручную).", tr("withdrawIdMissing")],
    ["Не смог найти withdraw id автоматически. Вставь его вручную (из Network запроса withdraw_stat).", tr("withdrawIdAutoFindFailed")],
    ["Сеть оборвалась", tr("progress_network_interrupted")],
    ["запрос завис во время загрузки withdraw_stat", tr("progress_withdraw_timeout")],
    ["Загрузка остановилась до завершения", tr("progress_loading_stopped")]
  ];

  let output = raw;
  for (const [source, target] of replacements) {
    output = output.replaceAll(source, target);
  }
  output = output.replace(/Страница\s+(\d+)\s+из\s+(\d+)/g, (_, page, pages) => tr("progress_page_of_total", { current: page, total: pages }));
  output = output.replace(/Страница\s+(\d+)/g, (_, page) => tr("progress_page_only", { current: page, total }));
  output = output.replace(/Новых продаж:\s*(\d+)/g, (_, count) => tr("newSalesFound", { count }));
  if (output.includes("частичная синхронизация")) {
    output = output.replace("частичная синхронизация", tr("progress_partial_sync_suffix"));
  }
  if (current && total) {
    output = output.replace(/Page\s+\s*of\s+/g, tr("progress_page_of_total", { current, total }));
  }
  return output;
}

async function loadFrontendLanguage() {
  try {
    const stored = await storageGet(["frontendBaseUrl", UI_LANGUAGE_KEY]);
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

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function applyPopupLocale() {
  document.title = tr("appTitle");
  setText("welcomeKicker", tr("onboardingKicker"));
  setText("welcomeTitle", tr("onboardingTitle"));
  setText("welcomeLead", tr("onboardingLead"));
  setText("welcomeLocalTitle", tr("onboardingLocalTitle"));
  setText("welcomeLocalText", tr("onboardingLocalText"));
  setText("welcomeCollectTitle", tr("onboardingCollectTitle"));
  setText("welcomeCollectText", tr("onboardingCollectText"));
  setText("welcomeUpdatesTitle", tr("onboardingUpdatesTitle"));
  setText("welcomeUpdatesText", tr("onboardingUpdatesText"));
  setText("startSetup", tr("onboardingButton"));
  setText("welcomeHint", tr("onboardingHint"));
  setText("brandTitle", tr("appTitle"));
  setText("brandSubtitle", tr("appSubtitle"));
  setText("refresh", tr("refresh"));
  setText("hint", tr("waitingHint"));
  setText("progressText", tr("waitingProgress"));
  setText("chartSectionTitle", tr("chart"));
  setText("chartTab24h", tr("tab24h"));
  setText("chartTab7d", tr("tab7d"));
  setText("chartTab30d", tr("tab30d"));
  setText("chartTabAll", tr("tabAll"));
  setText("chartScaleLabel", tr("scale"));
  setText("topModelsSectionTitle", tr("topModels"));
  setText("topTab24h", tr("tab24h"));
  setText("topTab7d", tr("tab7d"));
  setText("topTab30d", tr("tab30d"));
  setText("topTabAll", tr("tabAll"));
  setText("modelsTotalLabel", tr("totalSoldModels"));
  setText("modelsUniqueLabel", tr("uniqueModels"));
  setText("settingsBtnText", tr("settings"));
  setText("exportBtnText", tr("export"));
  setText("openTabBtnText", tr("openInTab"));
  setText("telegramLinkText", tr("telegram"));
  setText("footerCopyPrefix", tr("footerCopyPrefix"));
  setText("footerCopySuffix", tr("footerCopySuffix"));
  setText("langBtn", getLanguageButtonLabel(currentLanguageMode));

  $("#onboarding")?.setAttribute("aria-label", tr("onboardingKicker"));
  $("#dashboardShell")?.setAttribute("aria-label", tr("dashboardPanel"));
  $("#topBlocks")?.setAttribute("aria-label", tr("topMetrics"));
  document.querySelector(".meta-grid")?.setAttribute("aria-label", tr("summaryMetrics"));
  document.querySelector(".bottom-actions")?.setAttribute("aria-label", tr("actions"));
  document.querySelector(".popup-footer")?.setAttribute("aria-label", tr("authorInfo"));

  const zoomButton = $("#chartZoomLabel");
  if (zoomButton) {
    zoomButton.textContent = tr("zoomAll");
    zoomButton.title = currentLanguage === "en" ? "Show all time" : "Показать всё время";
    zoomButton.setAttribute("aria-label", zoomButton.title);
  }

  const prevBtn = $("#chartMonthPrev");
  if (prevBtn) {
    prevBtn.title = tr("prevMonth");
    prevBtn.setAttribute("aria-label", tr("prevMonth"));
  }

  const nextBtn = $("#chartMonthNext");
  if (nextBtn) {
    nextBtn.title = tr("nextMonth");
    nextBtn.setAttribute("aria-label", tr("nextMonth"));
  }

  const telegramButton = $("#telegramLink");
  if (telegramButton) {
    telegramButton.setAttribute("aria-label", tr("telegramAria"));
  }

  const langButton = $("#langBtn");
  if (langButton) {
    langButton.title = tr("languageButtonTitle");
    langButton.setAttribute("aria-label", tr("languageButtonTitle"));
  }

  document.querySelectorAll(".chart-month-preset").forEach((button) => {
    const months = Number(button.dataset.months || 0);
    const text = tr("showMonths", { count: months });
    button.textContent = text;
    const label = currentLanguage === "en"
      ? `Show ${months} ${months === 1 ? "month" : "months"}`
      : `Показать ${months} ${months === 1 ? "месяц" : "месяцев"}`;
    button.title = label;
    button.setAttribute("aria-label", label);
  });
}

function applyTheme(theme) {
  if (theme === "ddd-navy" || theme === "ddd-dark" || theme === "ddd-pinky") {
    document.body.dataset.theme = theme;
    return;
  }
  document.body.dataset.theme = "ddd-light";
}

function sanitizeAppSettings(raw = {}) {
  const settings = Object.assign({}, DEFAULT_SETTINGS, raw || {});
  if (settings?.themeVersion !== 2 && settings?.theme === "ddd-dark") {
    settings.theme = "ddd-navy";
    settings.themeVersion = 2;
  }
  if (!Array.isArray(settings.top_blocks)) {
    settings.top_blocks = [...DEFAULT_SETTINGS.top_blocks];
  }
  settings.top_blocks = settings.top_blocks
    .map((item) => String(item || "").trim())
    .filter((item) => item && AVAILABLE_TOP_BLOCKS.has(item))
    .slice(0, 4);
  if (!AVAILABLE_CHART_STYLES.has(String(settings.chart_style || ""))) {
    settings.chart_style = DEFAULT_SETTINGS.chart_style;
  }
  settings.avgLine = !!settings.avgLine;
  settings.trendLine = !!settings.trendLine;
  settings.splitSiteLines = !!settings.splitSiteLines;
  settings.splitSiteLinesOverlaySky = !!settings.splitSiteLinesOverlaySky;
  settings.previousPeriodLine = !!settings.previousPeriodLine;
  if (settings.splitSiteLines) {
    settings.splitSiteLinesOverlaySky = false;
    settings.avgLine = false;
    settings.trendLine = false;
    settings.previousPeriodLine = false;
  } else if (settings.splitSiteLinesOverlaySky) {
    settings.avgLine = false;
    settings.trendLine = false;
    settings.previousPeriodLine = false;
  } else if (settings.previousPeriodLine) {
    settings.avgLine = false;
    settings.trendLine = false;
  } else if (settings.avgLine && settings.trendLine) {
    settings.trendLine = false;
  }
  settings.topBlocksCalendarMode = !!settings.topBlocksCalendarMode;
  settings.topBlocksCalendarCompareFullPeriod = !!settings.topBlocksCalendarCompareFullPeriod;
  return settings;
}

async function loadAppSettings() {
  try {
    const stored = await storageGet([APP_SETTINGS_KEY]);
    return sanitizeAppSettings(stored?.[APP_SETTINGS_KEY] || {});
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function applyAppSettingsState(settings, { rerender = false } = {}) {
  currentAppSettings = sanitizeAppSettings(settings);
  applyTheme(currentAppSettings.theme);
  if (rerender && lastData) {
    renderAll(lastData, lastUpdatedAt);
  }
}

/* Formatting helpers */
function showStatus(text, show = true) {
  statusEl.style.display = show ? "block" : "none";
  statusEl.textContent = currentLanguage === "en" ? translateProgressText(text) : text;
}

function rub(n) {
  return new Intl.NumberFormat(getUiLocale(), { style: "currency", currency: "RUB" }).format(n || 0);
}

function fmtNumber(n) {
  return new Intl.NumberFormat(getUiLocale()).format(Math.round(Number(n) || 0));
}

function fmtDecimal(n, digits = 1) {
  return new Intl.NumberFormat(getUiLocale(), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(n) || 0);
}

function fmtMoney(n) {
  return new Intl.NumberFormat(getUiLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(n) || 0);
}

function rubParts(n) {
  return {
    value: new Intl.NumberFormat(getUiLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(n) || 0),
    unit: "₽"
  };
}

function pct(a, b) {
  if (!b) return a ? 100 : 0;
  return ((a - b) / b) * 100;
}

function fmtPct(v) {
  const formatted = new Intl.NumberFormat(getUiLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(Number(v) || 0);
  const s = `${v >= 0 ? "+" : ""}${formatted}%`;
  let cls = "neutral";
  if (v > 0.01) cls = "up";
  else if (v < -0.01) cls = "down";
  return { s, cls };
}

function escapeAttr(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function toMskShiftedDate(input) {
  const base = input instanceof Date ? input.getTime() : new Date(input).getTime();
  return new Date(base + 3 * 60 * 60 * 1000);
}

function bucketDayLabel(dUtc) {
  const msk = toMskShiftedDate(dUtc);
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(msk.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function bucketMonthLabel(dUtc) {
  const msk = toMskShiftedDate(dUtc);
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function bucketHourLabel(dUtc) {
  const msk = toMskShiftedDate(dUtc);
  const hour = String(msk.getUTCHours()).padStart(2, "0");
  return `${hour}:00`;
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

function getMskDayStartUtcMs(nowMs = Date.now()) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const shifted = new Date(nowMs + offsetMs);
  return Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0, 0, 0, 0
  ) - offsetMs;
}

function getMskPeriodStartUtcMs(period, nowMs = Date.now()) {
  const offsetMs = 3 * 60 * 60 * 1000;
  const shifted = new Date(nowMs + offsetMs);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth();
  const day = shifted.getUTCDate();
  if (period === "month") {
    return Date.UTC(year, month, 1, 0, 0, 0, 0) - offsetMs;
  }
  if (period === "week") {
    const weekdayIndex = (shifted.getUTCDay() + 6) % 7;
    return Date.UTC(year, month, day - weekdayIndex, 0, 0, 0, 0) - offsetMs;
  }
  return Date.UTC(year, month, day, 0, 0, 0, 0) - offsetMs;
}

function getPreviousMskPeriodStartUtcMs(period, currentStartMs) {
  const offsetMs = 3 * 60 * 60 * 1000;
  if (period === "week") return currentStartMs - 7 * 24 * 60 * 60 * 1000;
  const shiftedStart = new Date(currentStartMs + offsetMs);
  const year = shiftedStart.getUTCFullYear();
  const month = shiftedStart.getUTCMonth();
  const day = shiftedStart.getUTCDate();
  if (period === "month") {
    return Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - offsetMs;
  }
  return Date.UTC(year, month, day - 1, 0, 0, 0, 0) - offsetMs;
}

function getAnchoredPeriodBounds(period, nowMs = Date.now(), compareFullPeriod = false) {
  const currentStart = getMskPeriodStartUtcMs(period, nowMs);
  const previousStart = getPreviousMskPeriodStartUtcMs(period, currentStart);
  const elapsedMs = Math.max(0, nowMs - currentStart);
  return {
    currentStart,
    currentEnd: nowMs,
    previousStart,
    previousEnd: compareFullPeriod ? currentStart : (previousStart + elapsedMs)
  };
}

function calculateAnchoredRevenueMetrics(objects, period, compareFullPeriod = false) {
  const bounds = getAnchoredPeriodBounds(period, Date.now(), compareFullPeriod);
  let currentSum = 0;
  let previousSum = 0;

  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    const sum = Number(item?.royaltyAmount || 0);
    if (time >= bounds.currentStart && time < bounds.currentEnd) currentSum += sum;
    else if (time >= bounds.previousStart && time < bounds.previousEnd) previousSum += sum;
  }

  return {
    currentSum,
    previousSum,
    deltaPct: pct(currentSum, previousSum)
  };
}

function calculateAnchoredSiteSplitMetrics(objects, period, compareFullPeriod = false) {
  const bounds = getAnchoredPeriodBounds(period, Date.now(), compareFullPeriod);
  let currentCount = 0;
  let previousCount = 0;
  let site3ddd = 0;
  let site3dsky = 0;

  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (time >= bounds.currentStart && time < bounds.currentEnd) {
      currentCount += 1;
      if (detectSaleSite(item) === "3DSky") site3dsky += 1;
      else site3ddd += 1;
    } else if (time >= bounds.previousStart && time < bounds.previousEnd) {
      previousCount += 1;
    }
  }

  return {
    count: currentCount,
    previousCount,
    dddCount: site3ddd,
    skyCount: site3dsky
  };
}

function getSaleModelMetricKey(item) {
  const slug = String(item?.slug || "").trim();
  if (slug) return `slug:${slug}`;
  const titleRu = String(item?.title || "").trim().toLowerCase();
  const titleEn = String(item?.titleEn || "").trim().toLowerCase();
  if (titleRu || titleEn) return `title:${titleRu || titleEn}|${titleEn || titleRu}`;
  return "";
}

function isSameModelRef(a, b) {
  const slugA = String(a?.slug || "").trim();
  const slugB = String(b?.slug || "").trim();
  if (slugA && slugB) return slugA === slugB;
  const titlesA = [a?.title, a?.titleEn].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  const titlesB = [b?.title, b?.titleEn].map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  return titlesA.some((value) => titlesB.includes(value));
}

function enrichTopModelMetric(metric, candidates = []) {
  if (!metric) return null;
  const merged = { ...metric };
  for (const candidate of candidates) {
    if (!candidate || !isSameModelRef(metric, candidate)) continue;
    if (!merged.slug && candidate.slug) merged.slug = String(candidate.slug).trim();
    if (!merged.title && candidate.title) merged.title = String(candidate.title).trim();
    if (!merged.titleEn && candidate.titleEn) merged.titleEn = String(candidate.titleEn).trim();
    const candidateImg = String(candidate?.img || candidate?.firstImage || "").trim();
    if (!merged.img && candidateImg) merged.img = candidateImg;
    if (!merged.url && candidate.url) merged.url = String(candidate.url).trim();
  }
  if (!merged.url && merged.slug) merged.url = modelUrl(merged.slug);
  return merged;
}

function aggregateModelSales(objects, startMs, endMs) {
  const map = new Map();
  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (time < startMs || time >= endMs) continue;
    const key = getSaleModelMetricKey(item);
    if (!key) continue;
    const entry = map.get(key) || {
      key,
      slug: String(item?.slug || "").trim(),
      title: String(item?.title || "").trim(),
      titleEn: String(item?.titleEn || "").trim(),
      img: String(item?.img || item?.firstImage || "").trim(),
      url: "",
      count: 0,
      sum: 0
    };
    if (!entry.slug && item?.slug) entry.slug = String(item.slug).trim();
    if (!entry.title && item?.title) entry.title = String(item.title).trim();
    if (!entry.titleEn && item?.titleEn) entry.titleEn = String(item.titleEn).trim();
    if (!entry.img && (item?.img || item?.firstImage)) entry.img = String(item?.img || item?.firstImage || "").trim();
    entry.count += 1;
    entry.sum += Number(item?.royaltyAmount || 0);
    entry.url = entry.slug ? modelUrl(entry.slug) : entry.url;
    map.set(key, entry);
  }
  return map;
}

function calculateAnchoredTopModelMetric(objects, period, compareFullPeriod = false) {
  const bounds = getAnchoredPeriodBounds(period, Date.now(), compareFullPeriod);
  const currentMap = aggregateModelSales(objects, bounds.currentStart, bounds.currentEnd);
  if (!currentMap.size) return null;
  const previousMap = aggregateModelSales(objects, bounds.previousStart, bounds.previousEnd);
  const best = Array.from(currentMap.values()).sort((a, b) => {
    if (b.sum !== a.sum) return b.sum - a.sum;
    if (b.count !== a.count) return b.count - a.count;
    return String(a.title || "").localeCompare(String(b.title || ""));
  })[0];
  const previous = previousMap.get(best.key);
  return {
    ...best,
    previousSum: Number(previous?.sum || 0),
    deltaPct: pct(best.sum, Number(previous?.sum || 0))
  };
}

function calculateTodayRevenueMetrics(objects) {
  const nowMs = Date.now();
  const todayStart = getMskDayStartUtcMs(nowMs);
  const prevStart = todayStart - 24 * 60 * 60 * 1000;
  let currentSum = 0;
  let previousSum = 0;

  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    const sum = Number(item?.royaltyAmount || 0);
    if (time >= todayStart && time < nowMs) currentSum += sum;
    else if (time >= prevStart && time < todayStart) previousSum += sum;
  }

  return {
    currentSum,
    previousSum,
    deltaPct: pct(currentSum, previousSum)
  };
}

function formatPreviousRevenueTooltip(label, amount) {
  return tr("previousPeriodRevenue", { label, amount: rub(amount) });
}

function formatPreviousSalesTooltip(label, count) {
  return tr("previousPeriodSales", { label, count: fmtNumber(count) });
}

function getTodayRevenueTitle() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("todayRevenue") : tr("todayRevenueRolling");
}

function getWeekRevenueTitle() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("weekRevenueCalendar") : tr("weekRevenue");
}

function getMonthRevenueTitle() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("monthRevenueCalendar") : tr("monthRevenue");
}

function getTop7Title() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("topModel7Calendar") : tr("topModel7");
}

function getTop30Title() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("topModel30Calendar") : tr("topModel30");
}

function getSiteSplitTitle() {
  return currentAppSettings?.topBlocksCalendarMode ? tr("siteSplitTitleCalendar") : tr("siteSplitTitle");
}

function getModelFrontendBaseUrl() {
  return currentLanguage === "en" ? "https://3dsky.org" : "https://3ddd.ru";
}

function modelUrl(slug) {
  const baseUrl = getModelFrontendBaseUrl();
  if (!slug) return `${baseUrl}/3dmodels`;
  return `${baseUrl}/3dmodels/show/${slug}/`;
}

function getModelDisplayTitle(item) {
  const titleRu = String(item?.title || "").trim();
  const titleEn = String(item?.titleEn || "").trim();
  const slug = String(item?.slug || "").trim();
  const sourceItem = slug
    ? cachedSalesObjects.find((entry) => String(entry?.slug || "").trim() === slug)
    : null;
  const fallbackRu = String(sourceItem?.title || "").trim();
  const fallbackEn = String(sourceItem?.titleEn || "").trim();
  if (currentLanguage === "en") {
    const cachedEn = slug ? localizedModelTitleCache.get(slug) : "";
    return cachedEn || titleEn || fallbackEn || titleRu || fallbackRu || "—";
  }
  return titleRu || fallbackRu || titleEn || fallbackEn || "—";
}

function normalizeParsedModelTitle(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[|\-–—]\s*3dsky(?:\.org)?$/i, "")
    .replace(/\s*[|\-–—]\s*3ddd(?:\.ru)?$/i, "")
    .trim();
}

function isGenericModelTitle(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return true;
  return text.includes("3d models for design and architecture")
    || text === "3dsky"
    || text === "3ddd"
    || text === "3dsky.org"
    || text === "3ddd.ru";
}

function parseModelTitleFromHtml(html) {
  const text = String(html || "");
  if (!text.trim()) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const candidates = [
    doc.querySelector("h1")?.textContent,
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
    doc.querySelector("title")?.textContent
  ];
  for (const raw of candidates) {
    const value = normalizeParsedModelTitle(raw || "");
    if (!value || isGenericModelTitle(value)) continue;
    return value;
  }
  return "";
}

function scheduleLocalizedModelTitleFetch(item) {
  if (currentLanguage !== "en") return;
  const slug = String(item?.slug || "").trim();
  if (!slug || localizedModelTitleCache.has(slug) || pendingModelTitleRequests.has(slug)) return;

  const request = sendRuntimeMessage({
    type: "GET_LOCALIZED_MODEL_TITLE",
    slug,
    language: "en"
  })
    .then((response) => {
      const title = String(response?.ok ? response.title || "" : "").trim();
      if (title) {
        localizedModelTitleCache.set(slug, title);
        if (lastData) {
          rerenderTopModelsView();
          renderTopBlocks(lastData);
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      pendingModelTitleRequests.delete(slug);
    });

  pendingModelTitleRequests.set(slug, request);
}

function calculateTopModelPreviousRevenue(objects, item, days) {
  if (!item) return 0;
  const safeDays = Math.max(1, Number(days) || 1);
  const nowMs = Date.now();
  const windowMs = safeDays * 24 * 60 * 60 * 1000;
  const currentStart = nowMs - windowMs;
  const previousStart = nowMs - windowMs * 2;
  let previousSum = 0;

  for (const source of objects || []) {
    const dt = parseDateUtcPlus3(source?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (time < previousStart || time >= currentStart) continue;
    const sameSlug = item?.url && safeUrl(item.url) === modelUrl(source?.slug || "");
    const itemTitles = [item?.title, item?.titleEn]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const sourceTitles = [source?.title, source?.titleEn]
      .map((value) => String(value || "").trim())
      .filter(Boolean);
    const sameTitle = itemTitles.some((title) => sourceTitles.includes(title));
    if (!sameSlug && !sameTitle) continue;
    previousSum += Number(source?.royaltyAmount || 0);
  }

  return previousSum;
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

function metricValueHtml(amount) {
  const parts = rubParts(amount);
  return `<div class="metric-value"><span class="metric-value-number">${parts.value}</span><span class="metric-value-unit">${parts.unit}</span></div>`;
}

function metricBadgeHtml(deltaText, cls, hideIcon = false, tooltipText = "") {
  const icon = cls === "down" ? "↓" : (cls === "up" ? "↑" : "•");
  const titleAttr = tooltipText ? ` title="${escapeAttr(tooltipText)}"` : "";
  return `
    <div class="metric-badge ${cls || "neutral"}${hideIcon ? " no-icon" : ""}"${titleAttr}>
      ${hideIcon ? "" : `<span class="metric-badge-icon">${icon}</span>`}
      <span>${deltaText || "—"}</span>
    </div>
  `;
}

function metricCardHtml(title, amount, deltaText, deltaCls, note, hideIcon = false, tooltipText = "") {
  return `
    <div class="card metric-card">
      <div class="metric-card-main">
        <div>
          <div class="metric-title">${title}</div>
          ${metricValueHtml(amount)}
        </div>
        <div class="metric-footer">
          ${metricBadgeHtml(deltaText, deltaCls, hideIcon, tooltipText)}
          <div class="metric-note">${note}</div>
        </div>
      </div>
    </div>
  `;
}

function topModelCardHtml(title, item) {
  if (!item) {
    return `
      <div class="card metric-card top-block-card top-block-card-empty">
        <div>
          <div class="metric-title">${title}</div>
          <div class="metric-note top-block-empty">${tr("noData")}</div>
        </div>
      </div>
    `;
  }
  scheduleLocalizedModelTitleFetch(item);
  const v = fmtPct(Number(item.deltaPct || 0));
  const sumParts = rubParts(Number(item.sum || 0));
  const modelTitle = escapeAttr(getModelDisplayTitle(item));
  const modelNameHtml = item?.url
    ? `<a class="top-block-name-link" href="${escapeAttr(safeUrl(item.url))}" target="_blank" rel="noreferrer noopener">${modelTitle}</a>`
    : modelTitle;
  const thumb = item.img
    ? `<img class="top-block-thumb" src="${safeUrl(item.img)}" alt="">`
    : `<div class="top-block-thumb"></div>`;
  return `
    <div class="card metric-card top-block-card">
      <div class="metric-title">${title}</div>
      <div class="top-block-main">
        <div class="top-block-row">
          ${thumb}
          <div class="top-block-copy">
            <div class="top-block-name">${modelNameHtml}</div>
            <div class="top-block-meta">${fmtNumber(item.count || 0)} ${tr("salesWord")}</div>
          </div>
        </div>
        <div class="top-block-stats">
          ${metricBadgeHtml(v.s, v.cls, false, item?.tooltip || "")}
          <div class="top-block-sum">
            <span class="top-block-sum-number">${sumParts.value}</span>
            <span class="top-block-sum-unit">${sumParts.unit}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function siteSplitCardHtml(siteSplit) {
  const deltaCls = siteSplit?.delta?.cls || "neutral";
  const deltaText = siteSplit?.delta?.s || "0.0%";
  const dddLabel = currentLanguage === "en" ? "3DDD" : "3DDD";
  const skyLabel = currentLanguage === "en" ? "3DSky" : "3DSky";
  return `
    <div class="card metric-card site-split-card">
      <div class="metric-title">${getSiteSplitTitle()}</div>
      <div class="site-split-layout">
        <div class="site-split-left">
          <div class="site-split-value">${fmtNumber(siteSplit?.count || 0)}</div>
          <div class="metric-footer site-split-footer">
            ${metricBadgeHtml(deltaText, deltaCls, false, siteSplit?.tooltip || "")}
          </div>
        </div>
        <div class="site-split-right">
          <div
            class="donut-preview"
            style="--donut-angle:${siteSplit?.dddPct || 0}%;--donut-primary:var(--chart-line);--donut-secondary:var(--settings-donut-secondary);--donut-label:'${Number(siteSplit?.dddCount || 0)}/${Number(siteSplit?.skyCount || 0)}';"
            aria-label="${dddLabel} ${siteSplit?.dddPct || 0}%, ${skyLabel} ${siteSplit?.skyPct || 0}%"></div>
          <div class="site-split-legend">
            <span><i class="swatch" style="background:var(--chart-line);"></i>${dddLabel} — ${siteSplit?.dddPct || 0}%</span>
            <span><i class="swatch" style="background:var(--settings-donut-secondary);"></i>${skyLabel} — ${siteSplit?.skyPct || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function nextRankCardHtml(rank) {
  const current = rank?.current;
  const next = rank?.next;
  const currentTitle = current ? localizeRankTitle(current) : tr("currentRank");
  if (!next) {
    return `
      <div class="card metric-card rank-card">
        <div class="metric-title">${tr("nextRankTitle")}</div>
        <div class="rank-max-state">
          ${current?.icon ? `<img class="rank-badge-img rank-max-icon" src="${safeUrl(current.icon)}" alt="${escapeAttr(currentTitle)}">` : `<div class="rank-badge-fallback rank-max-icon">★</div>`}
          <div class="rank-max-title">${tr("rankBeyondMax")}</div>
        </div>
        <div class="metric-footer">
          <div class="metric-badge neutral no-icon"><span>${fmtNumber(rank?.totalSales || 0)}</span></div>
          <div class="metric-note">${tr("totalSales")}</div>
        </div>
      </div>
    `;
  }
  const nextTitle = localizeRankTitle(next);
  return `
    <div class="card metric-card rank-card">
      <div class="metric-title">${tr("nextRankTitle")}</div>
      <div class="rank-track">
        <div class="rank-node">
          ${current?.icon ? `<img class="rank-badge-img" src="${safeUrl(current.icon)}" alt="${escapeAttr(currentTitle)}">` : `<div class="rank-badge-fallback">★</div>`}
          <span class="rank-node-title">${currentTitle}</span>
        </div>
        <div class="rank-center-value">${next ? fmtNumber(rank.left) : "★"}</div>
        <div class="rank-node rank-node-next">
          ${next?.icon ? `<img class="rank-badge-img" src="${safeUrl(next.icon)}" alt="${escapeAttr(nextTitle)}">` : (current?.icon ? `<img class="rank-badge-img" src="${safeUrl(current.icon)}" alt="${escapeAttr(currentTitle)}">` : `<div class="rank-badge-fallback">★</div>`)}
          <span class="rank-node-title">${nextTitle}</span>
        </div>
      </div>
      <div class="metric-footer">
        <div class="metric-badge neutral no-icon"><span>${fmtNumber(rank?.totalSales || 0)}</span></div>
        <div class="metric-note">${tr("totalSales")}</div>
      </div>
    </div>
  `;
}

function safeUrl(url) {
  try {
    const frontendBaseUrl = normalizeFrontendBaseUrl(currentFrontendBaseUrl);
    const modelBaseUrl = getModelFrontendBaseUrl();
    const u = new URL(String(url || ""), `${frontendBaseUrl}/`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return `${frontendBaseUrl}/3dmodels`;
    const host = u.hostname.toLowerCase();
    const isFrontendHost = host === "3ddd.ru" || host === "www.3ddd.ru" || host === "3dsky.org" || host === "www.3dsky.org";
    const isFrontendPage =
      u.pathname === "/" ||
      u.pathname.startsWith("/3dmodels") ||
      u.pathname.startsWith("/user") ||
      u.pathname.startsWith("/auth");
    if (isFrontendHost && isFrontendPage) {
      const normalizedBase = new URL(u.pathname.startsWith("/3dmodels") ? modelBaseUrl : frontendBaseUrl);
      u.protocol = normalizedBase.protocol;
      u.host = normalizedBase.host;
    }
    return u.toString();
  } catch {}
  return `${getModelFrontendBaseUrl()}/3dmodels`;
}

function setLinkedText(container, url, text) {
  container.textContent = "";
  const a = document.createElement("a");
  a.href = safeUrl(url);
  a.target = "_blank";
  a.rel = "noreferrer noopener";
  a.style.textDecoration = "none";
  a.style.color = "inherit";
  a.textContent = String(text || "—");
  container.appendChild(a);
}

function setSummaryMeta(container, count, sum) {
  container.textContent = "";
  const b1 = document.createElement("b");
  b1.textContent = String(count || 0);
  const b2 = document.createElement("b");
  b2.textContent = rub(sum);
  container.append(b1, ` ${tr("salesWord")} • `, b2);
}

function setChartSummary(container, count, sum) {
  if (!container) return;
  container.textContent = "";
  const salesChip = document.createElement("span");
  salesChip.className = "summary-chip";
  salesChip.innerHTML = `<strong>${fmtNumber(count || 0)}</strong>&nbsp;${tr("salesWord")}`;
  const revenueChip = document.createElement("span");
  revenueChip.className = "summary-chip";
  revenueChip.innerHTML = `<strong>${rub(sum)}</strong>`;
  container.append(salesChip, revenueChip);
}

async function loadCachedSalesObjects() {
  try {
    const resp = await sendRuntimeMessage({ type: "GET_CACHED_SALES_OBJECTS" });
    cachedSalesObjects = Array.isArray(resp?.data?.combinedObjects) ? resp.data.combinedObjects : [];
  } catch {
    cachedSalesObjects = [];
  }
  return cachedSalesObjects;
}

/* Top block metrics */
function getTopBlockSources(data) {
  return {
    objects: Array.isArray(cachedSalesObjects) ? cachedSalesObjects : [],
    cards: data?.cards || {},
    top: data?.top || {},
    stats: data?.stats || {},
    overviewLabels: Array.isArray(data?.charts?.overview?.labels) ? data.charts.overview.labels : [],
    overviewValues: Array.isArray(data?.charts?.overview?.values) ? data.charts.overview.values : []
  };
}

function calculateYearAndSiteMetrics(objects, overviewLabels, overviewValues) {
  const now = Date.now();
  const nowDate = new Date();
  const yearStart = new Date(Date.UTC(nowDate.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - thirtyDaysMs;
  const prevThirtyDaysAgo = now - thirtyDaysMs * 2;

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
    if (time >= yearStart.getTime()) ytdSum += sum;
    if (time >= thirtyDaysAgo) {
      monthSalesCount += 1;
      if (detectSaleSite(item) === "3DSky") site3dsky += 1;
      else site3ddd += 1;
    } else if (time >= prevThirtyDaysAgo) {
      prevMonthSalesCount += 1;
    }
  }

  if (!objects.length) {
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < overviewLabels.length; i++) {
      const label = String(overviewLabels[i] || "");
      if (label.startsWith(`${currentYear}-`)) ytdSum += Number(overviewValues[i] || 0);
    }
  }

  const elapsedMonths = Math.max(1, nowDate.getUTCMonth() + 1);
  const avgMonthYtd = ytdSum / elapsedMonths;
  const totalSiteSales = Math.max(1, site3ddd + site3dsky);
  const site3dddPct = Math.round((site3ddd / totalSiteSales) * 100);
  return {
    ytdSum,
    avgMonthYtd,
    elapsedMonths,
    monthSalesCount,
    prevMonthSalesCount,
    site3ddd,
    site3dsky,
    site3dddPct,
    site3dskyPct: 100 - site3dddPct
  };
}

function calculateRankMetric(totalSalesAll) {
  const totalSales = Number(totalSalesAll || 0);
  const rankInfo = getCurrentAndNextRank(totalSales);
  return {
    totalSales,
    current: rankInfo.current,
    next: rankInfo.next,
    left: rankInfo.next ? Math.max(0, rankInfo.next.threshold - totalSales) : 0
  };
}

function renderMetricTopBlock(metric) {
  return metricCardHtml(metric.title, metric.amount, metric.delta.s, metric.delta.cls, metric.note, !!metric.hideIcon, metric.tooltip || "");
}

function renderTopBlockByKey(key, metrics) {
  if (key === "today") return renderMetricTopBlock(metrics.today);
  if (key === "week_sales") return renderMetricTopBlock(metrics.week_sales);
  if (key === "month_sales") return renderMetricTopBlock(metrics.month_sales);
  if (key === "year_total") {
    return renderMetricTopBlock({
      title: tr("ytdRevenue"),
      amount: metrics.year_total.amount,
      delta: { s: `${fmtMoney(metrics.year_total.avgMonth)} ₽`, cls: "neutral" },
      note: tr("avgMonthIncome"),
      hideIcon: true,
      tooltip: metrics.year_total.tooltip
    });
  }
  if (key === "top30") return topModelCardHtml(getTop30Title(), metrics.top30);
  if (key === "top7") return topModelCardHtml(getTop7Title(), metrics.top7);
  if (key === "site_split") return siteSplitCardHtml(metrics.site_split);
  if (key === "next_rank") return nextRankCardHtml(metrics.next_rank);
  return renderMetricTopBlock(metrics.today);
}

function buildTopBlockMetrics(data) {
  const { objects, cards, top, stats, overviewLabels, overviewValues } = getTopBlockSources(data);
  const yearAndSite = calculateYearAndSiteMetrics(objects, overviewLabels, overviewValues);
  const rankMetric = calculateRankMetric(stats?.totalSalesAll);
  const topBlocksCalendarMode = !!currentAppSettings.topBlocksCalendarMode;
  const compareFullCalendarPeriod = !!currentAppSettings.topBlocksCalendarCompareFullPeriod;
  const hasObjects = objects.length > 0;
  const canUseCalendarObjects = topBlocksCalendarMode && objects.length > 0;
  const todayFallback = topBlocksCalendarMode ? calculateAnchoredRevenueMetrics(objects, "day", compareFullCalendarPeriod) : calculateRollingRevenueMetrics(objects, 1);
  const weekFallback = canUseCalendarObjects ? calculateAnchoredRevenueMetrics(objects, "week", compareFullCalendarPeriod) : calculateRollingRevenueMetrics(objects, 7);
  const monthFallback = canUseCalendarObjects ? calculateAnchoredRevenueMetrics(objects, "month", compareFullCalendarPeriod) : calculateRollingRevenueMetrics(objects, 30);
  const siteSplitFallback = canUseCalendarObjects ? calculateAnchoredSiteSplitMetrics(objects, "month", compareFullCalendarPeriod) : null;
  const top30 = canUseCalendarObjects ? (calculateAnchoredTopModelMetric(objects, "month", compareFullCalendarPeriod) || top?.["30d"]?.[0] || null) : (top?.["30d"]?.[0] || null);
  const top7 = canUseCalendarObjects ? (calculateAnchoredTopModelMetric(objects, "week", compareFullCalendarPeriod) || top?.["7d"]?.[0] || null) : (top?.["7d"]?.[0] || null);
  const dayNote = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "vsPrevFullCalendarDay" : "vsPrevCalendarDay") : tr("vsPrevDay");
  const weekNote = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "vsPrevFullCalendarWeek" : "vsPrevCalendarWeek") : tr("vsPrev7d");
  const monthNote = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "vsPrevFullCalendarMonth" : "vsPrevCalendarMonth") : tr("vsPrev30d");
  const dayTooltipLabel = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "previousFullCalendarDay" : "previousCalendarDay") : tr("previousDay");
  const weekTooltipLabel = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "previousFullCalendarWeek" : "previousCalendarWeek") : tr("previous7d");
  const monthTooltipLabel = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "previousFullCalendarMonth" : "previousCalendarMonth") : tr("previous30d");
  const top7TooltipLabel = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "previousTopFullCalendarWeek" : "previousTopCalendarWeek") : tr("previousTop7");
  const top30TooltipLabel = topBlocksCalendarMode ? tr(compareFullCalendarPeriod ? "previousTopFullCalendarMonth" : "previousTopCalendarMonth") : tr("previousTop30");
  const siteSplitCount = canUseCalendarObjects ? siteSplitFallback.count : yearAndSite.monthSalesCount;
  const siteSplitPrevCount = canUseCalendarObjects ? siteSplitFallback.previousCount : yearAndSite.prevMonthSalesCount;
  const siteSplitDddCount = canUseCalendarObjects ? siteSplitFallback.dddCount : yearAndSite.site3ddd;
  const siteSplitSkyCount = canUseCalendarObjects ? siteSplitFallback.skyCount : yearAndSite.site3dsky;
  const siteSplitTotal = Math.max(1, siteSplitDddCount + siteSplitSkyCount);
  const siteSplitDddPct = Math.round((siteSplitDddCount / siteSplitTotal) * 100);

  return {
    today: {
      amount: Number(hasObjects ? todayFallback.currentSum : (cards?.today?.sum || 0)),
      delta: fmtPct(Number(hasObjects ? todayFallback.deltaPct : (cards?.today?.deltaPct || 0))),
      note: dayNote,
      title: getTodayRevenueTitle(),
      tooltip: formatPreviousRevenueTooltip(dayTooltipLabel, todayFallback.previousSum)
    },
    week_sales: {
      amount: Number(canUseCalendarObjects ? weekFallback.currentSum : (cards?.week?.sum || 0)),
      delta: fmtPct(Number(canUseCalendarObjects ? weekFallback.deltaPct : (cards?.week?.deltaPct || 0))),
      note: weekNote,
      title: getWeekRevenueTitle(),
      tooltip: formatPreviousRevenueTooltip(weekTooltipLabel, weekFallback.previousSum)
    },
    month_sales: {
      amount: Number((canUseCalendarObjects ? monthFallback.currentSum : (cards?.month?.sum ?? monthFallback.currentSum ?? stats?.scales?.["30d"]?.sum)) || 0),
      delta: fmtPct(Number((canUseCalendarObjects ? monthFallback.deltaPct : (cards?.month?.deltaPct ?? monthFallback.deltaPct)) || 0)),
      note: monthNote,
      title: getMonthRevenueTitle(),
      tooltip: formatPreviousRevenueTooltip(monthTooltipLabel, monthFallback.previousSum)
    },
    site_split: {
      count: siteSplitCount,
      delta: fmtPct(pct(siteSplitCount, siteSplitPrevCount)),
      dddCount: siteSplitDddCount,
      skyCount: siteSplitSkyCount,
      dddPct: siteSplitDddPct,
      skyPct: 100 - siteSplitDddPct,
      tooltip: formatPreviousSalesTooltip(monthTooltipLabel, siteSplitPrevCount)
    },
    top30: (() => {
      const item = enrichTopModelMetric(top30 || null, [top?.["30d"]?.[0], ...objects]);
      return item ? { ...item, tooltip: formatPreviousRevenueTooltip(top30TooltipLabel, canUseCalendarObjects ? Number(item.previousSum || 0) : calculateTopModelPreviousRevenue(objects, item, 30)) } : null;
    })(),
    top7: (() => {
      const item = enrichTopModelMetric(top7 || null, [top?.["7d"]?.[0], ...objects]);
      return item ? { ...item, tooltip: formatPreviousRevenueTooltip(top7TooltipLabel, canUseCalendarObjects ? Number(item.previousSum || 0) : calculateTopModelPreviousRevenue(objects, item, 7)) } : null;
    })(),
    year_total: {
      amount: yearAndSite.ytdSum,
      avgMonth: yearAndSite.avgMonthYtd,
      tooltip: tr("monthsCountYtd", { count: fmtNumber(yearAndSite.elapsedMonths) })
    },
    next_rank: rankMetric
  };
}

function renderTopBlocks(data) {
  const root = $("#topBlocks");
  if (!root) return;
  const metrics = buildTopBlockMetrics(data);
  const blocks = Array.isArray(currentAppSettings?.top_blocks) && currentAppSettings.top_blocks.length
    ? currentAppSettings.top_blocks.slice(0, 4)
    : [];

  root.hidden = blocks.length === 0;
  root.classList.toggle("metrics-grid-single", blocks.length === 1);
  root.classList.toggle("metrics-grid-three", blocks.length === 3);
  root.innerHTML = blocks.map((key) => renderTopBlockByKey(key, metrics)).join("");
}

/* Chart helpers */
function setTabActive(container, scale) {
  container.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.scale === scale);
  });
}

function fmtAxisValue(v) {
  const rounded = Math.round(Number(v) || 0);
  return new Intl.NumberFormat(getUiLocale()).format(rounded);
}

function setupCanvas(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
  const cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
  if (canvas.width !== Math.round(cssWidth * dpr) || canvas.height !== Math.round(cssHeight * dpr)) {
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: cssWidth, h: cssHeight };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getChartWindowBounds(length, viewport, minWindow) {
  if (length <= 0) return { start: 0, end: 0 };
  const safeMin = Math.max(1, Math.min(minWindow, length));
  const minSizeRatio = clamp(safeMin / length, 0, 1);
  const sizeRatio = clamp(viewport?.size ?? 1, minSizeRatio, 1);
  const startRatio = clamp(viewport?.start ?? 0, 0, 1 - sizeRatio);
  const visible = Math.max(safeMin, Math.round(length * sizeRatio));
  const maxStartIndex = Math.max(0, length - visible);
  const start = Math.round(maxStartIndex * (maxStartIndex === 0 ? 0 : startRatio / (1 - sizeRatio || 1)));
  return { start, end: Math.min(length, start + visible), sizeRatio, startRatio, minSizeRatio };
}

function getScaleMinWindow(scale, length) {
  const defaults = { "24h": 6, "7d": 4, "30d": 7, "all": 10 };
  return Math.min(length, defaults[scale] || 6);
}
function getOverviewMinWindow(length) {
  return Math.min(length, 1);
}

function snapViewportToMonthGrid(viewport, length) {
  if (!length) return { start: 0, size: 1 };
  const visibleMonths = Math.max(1, Math.min(length, Math.round((viewport?.size || 1) * length)));
  const maxStartIndex = Math.max(0, length - visibleMonths);
  const startIndex = Math.max(0, Math.min(maxStartIndex, Math.round((viewport?.start || 0) * length)));
  return {
    start: startIndex / length,
    size: visibleMonths / length
  };
}

function parseIsoDateLabel(label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(label || ""))) return null;
  const date = new Date(`${label}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMskDayLabelRange(label) {
  const text = String(label || "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const startUtcMs = Date.UTC(year, month - 1, day, 0 - 3, 0, 0, 0);
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000 - 1;
  return {
    start: new Date(startUtcMs),
    end: new Date(endUtcMs)
  };
}

function isSameLocalCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatShortDayLabel(date) {
  return new Intl.DateTimeFormat(getUiLocale(), {
    day: "numeric",
    month: "short",
    year: "2-digit"
  }).format(date);
}

function formatShortMonthLabel(date) {
  return new Intl.DateTimeFormat(getUiLocale(), {
    month: "short",
    year: "2-digit"
  }).format(date);
}

function formatTooltipDate(label, mode = "day") {
  const date = parseIsoDateLabel(label);
  if (!date) return String(label || "—");
  if (mode === "month") {
    return formatShortMonthLabel(date);
  }
  const range = parseMskDayLabelRange(label);
  const fullFormatter = new Intl.DateTimeFormat(getUiLocale(), {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });
  if (!range) {
    return fullFormatter.format(date);
  }
  const start = range.start;
  const end = range.end;
  if (isSameLocalCalendarDay(start, end)) {
    return fullFormatter.format(start);
  }
  return `${fullFormatter.format(start)} — ${fullFormatter.format(end)}`;
}

function formatLocalDayRangeCompact(label) {
  const range = parseMskDayLabelRange(label);
  if (!range) {
    const date = parseIsoDateLabel(label);
    return date ? formatShortDayLabel(date) : String(label || "—");
  }
  const start = range.start;
  const end = range.end;
  const singleFormatter = new Intl.DateTimeFormat(getUiLocale(), { day: "numeric", month: "short" });
  if (isSameLocalCalendarDay(start, end)) {
    return singleFormatter.format(start);
  }
  return `${singleFormatter.format(start)}–${singleFormatter.format(end)}`;
}

function aggregateSeriesByMonth(labels, values) {
  const monthly = new Map();
  labels.forEach((label, index) => {
    const date = parseIsoDateLabel(label);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthly.get(key) || { label: `${key}-01`, value: 0 };
    entry.value += Number(values[index] || 0);
    monthly.set(key, entry);
  });
  const entries = Array.from(monthly.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: entries.map(([, item]) => item.label),
    values: entries.map(([, item]) => Math.round(item.value * 100) / 100),
    mode: "month"
  };
}

function aggregateOverviewByMonth(labels, values, counts = []) {
  const monthly = new Map();
  labels.forEach((label, index) => {
    const date = parseIsoDateLabel(label);
    if (!date) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const entry = monthly.get(key) || { label: `${key}-01`, value: 0, count: 0 };
    entry.value += Number(values[index] || 0);
    entry.count += Number(counts[index] || 0);
    monthly.set(key, entry);
  });
  const entries = Array.from(monthly.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: entries.map(([, item]) => item.label),
    values: entries.map(([, item]) => Math.round(item.value * 100) / 100),
    counts: entries.map(([, item]) => Math.round(item.count))
  };
}

function getMonthRange(label) {
  const start = parseIsoDateLabel(label);
  if (!start) return null;
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function buildAdaptiveAllTimeSeries(labels, values) {
  const parsedDates = labels.map(parseIsoDateLabel);
  const validDates = parsedDates.filter(Boolean);
  if (!labels.length || validDates.length !== labels.length) {
    return { labels, values, mode: "plain" };
  }

  const firstTime = validDates[0].getTime();
  const lastTime = validDates[validDates.length - 1].getTime();
  const spanDays = Math.max(1, Math.round((lastTime - firstTime) / (24 * 60 * 60 * 1000)));
  if (spanDays > 366) {
    return aggregateSeriesByMonth(labels, values);
  }
  return { labels, values, mode: "day" };
}

function buildXAxisTicks(labels, scale, mode = "plain") {
  if (!labels.length) return [];

  const totalTicks = scale === "24h"
    ? 4
    : 3;

  const desired = Math.max(2, Math.min(totalTicks, labels.length));
  const indices = [];
  for (let i = 0; i < desired; i++) {
    indices.push(Math.round((i * (labels.length - 1)) / Math.max(1, desired - 1)));
  }
  const uniqueIndices = Array.from(new Set(indices)).sort((a, b) => a - b);

  return uniqueIndices.map((index) => {
    const label = labels[index];
    if (scale === "24h") {
      return { index, text: String(label) };
    }

    const date = parseIsoDateLabel(label);
    if (!date) {
      return { index, text: String(label) };
    }

    return {
      index,
      text: mode === "month" ? formatShortMonthLabel(date) : formatLocalDayRangeCompact(label)
    };
  });
}

function sumNumbers(values) {
  return values.reduce((acc, value) => acc + (Number(value) || 0), 0);
}

function getMiniChartGroupSize(length) {
  if (length <= 24) return 1;
  if (length <= 72) return 2;
  return 3;
}

function aggregateMiniChartValues(values) {
  const groupSize = getMiniChartGroupSize(values.length);
  if (groupSize <= 1) return values.map((value) => Number(value || 0));

  const out = [];
  for (let i = 0; i < values.length; i += groupSize) {
    out.push(sumNumbers(values.slice(i, i + groupSize)));
  }
  return out;
}

function aggregateBarSeries(labels, values, mode, groupSize) {
  if (groupSize <= 1 || labels.length <= 1) {
    return { labels, values, mode };
  }
  const nextLabels = [];
  const nextValues = [];
  for (let i = 0; i < labels.length; i += groupSize) {
    const chunkLabels = labels.slice(i, i + groupSize);
    const chunkValues = values.slice(i, i + groupSize);
    nextLabels.push(String(chunkLabels[0] || ""));
    nextValues.push(Math.round(sumNumbers(chunkValues) * 100) / 100);
  }
  return { labels: nextLabels, values: nextValues, mode };
}

function getAverageValue(values) {
  if (!values.length) return null;
  return sumNumbers(values) / values.length;
}

function getTrendEndpoints(values) {
  const n = values.length;
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = Number(values[i] || 0);
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

function valueToChartY(value, minV, range, padT, innerH) {
  return padT + innerH - ((value - minV) / range) * innerH;
}

function getAllScaleViewportSummary(data, overviewSeries) {
  const counts = Array.isArray(overviewSeries.counts) ? overviewSeries.counts : [];
  const fullRangeSelected = overviewSeries.start === 0 && overviewSeries.end === (overviewSeries.fullLabels?.length || 0);
  return {
    count: counts.length
      ? counts.reduce((acc, value) => acc + (Number(value) || 0), 0)
      : (fullRangeSelected ? Number(data?.stats?.scales?.all?.count || 0) : 0),
    sum: Math.round(sumNumbers(overviewSeries.values) * 100) / 100
  };
}

function traceSeriesPath(ctx, points, style) {
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

function traceSeriesPathFromSecond(ctx, points, style) {
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

function drawLineChart(canvas, labels, values, options = {}) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);

  const padL = 72, padR = 18, padT = 16, padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  if (!values.length) return { points: [], padL, padR, padT, padB, innerW, innerH, labels, values };
  const style = AVAILABLE_CHART_STYLES.has(options.style) ? options.style : "classic";
  const splitSeries = options?.splitSeries && Array.isArray(options.splitSeries.dddValues) && Array.isArray(options.splitSeries.skyValues)
    ? options.splitSeries
    : null;
  const splitSeriesMode = splitSeries && options?.splitSeriesMode === "overlaySky"
    ? "overlaySky"
    : (splitSeries ? "split" : null);
  const previousPeriod = options?.previousPeriod && Array.isArray(options.previousPeriod.values) && options.previousPeriod.values.length === values.length
    ? options.previousPeriod
    : null;
  const previousPeriodSeries = previousPeriod?.values || null;
  const allSeriesValues = splitSeries
    ? (splitSeriesMode === "overlaySky"
      ? values.concat(splitSeries.skyValues || [], previousPeriodSeries || [])
      : (splitSeries.dddValues || []).concat(splitSeries.skyValues || [], previousPeriodSeries || []))
    : values.concat(previousPeriodSeries || []);
  const rawMax = Math.max(...allSeriesValues);
  const rawMin = Math.min(...allSeriesValues);
  let maxV = rawMax;
  let minV = Math.max(0, rawMin);
  if (rawMax === rawMin) {
    if (rawMax <= 0) {
      maxV = 1;
      minV = 0;
    } else {
      minV = Math.max(0, rawMax * 0.85);
    }
  }
  const range = Math.max(1, maxV - minV);

  ctx.font = "15px Roboto, sans-serif";
  ctx.textBaseline = "middle";
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const t = i / ticks;
    const y = padT + innerH - t * innerH;
    const v = minV + t * range;
    ctx.strokeStyle = themeColor("--chart-grid", "#e7e7e7");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + innerW, y);
    ctx.stroke();

  ctx.fillStyle = themeColor("--chart-axis", "#565656");
  ctx.fillText(fmtAxisValue(v), 10, y);
  }

  const barSlotWidth = values.length ? innerW / values.length : innerW;
  const points = values.map((value, i) => ({
    x: style === "bar"
      ? padL + barSlotWidth * (i + 0.5)
      : padL + (values.length === 1 ? innerW : (i / (values.length - 1)) * innerW),
    y: padT + innerH - ((value - minV) / range) * innerH
  }));
  const selectedIndex = Number.isInteger(options.selectedIndex) && options.selectedIndex >= 0
    ? clamp(options.selectedIndex, 0, points.length - 1)
    : -1;
  let averageValue = Number.isFinite(options.avgValue) ? Number(options.avgValue) : null;
  let averageY = null;
  let splitPoints = null;
  let previousPeriodPoints = null;

  if (previousPeriodSeries) {
    previousPeriodPoints = previousPeriodSeries.map((value, i) => ({
      x: style === "bar"
        ? padL + barSlotWidth * (i + 0.5)
        : padL + (previousPeriodSeries.length === 1 ? innerW : (i / (previousPeriodSeries.length - 1)) * innerW),
      y: valueToChartY(Number(value || 0), minV, range, padT, innerH)
    }));
  }

  if (style === "bar") {
    const gap = Math.max(2, Math.min(8, barSlotWidth * 0.22));
    const barWidth = Math.max(3, Math.min(24, barSlotWidth - gap));
    if (splitSeries && splitSeriesMode === "split") {
      const dddPoints = [];
      const skyPoints = [];
      values.forEach((value, index) => {
        const x = padL + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
        const dddValue = Number(splitSeries.dddValues?.[index] || 0);
        const skyValue = Number(splitSeries.skyValues?.[index] || 0);
        const dddHeight = ((dddValue - minV) / range) * innerH;
        const skyHeight = ((skyValue - minV) / range) * innerH;
        const dddY = padT + innerH - dddHeight;
        const skyY = padT + innerH - skyHeight;
        dddPoints.push({ x: x + barWidth / 2, y: dddY });
        skyPoints.push({ x: x + barWidth / 2, y: skyY });
        const bars = [
          {
            key: "ddd",
            value: dddValue,
            height: dddHeight,
            y: dddY,
            baseColor: themeColor("--mini-bar", "#d1d5db"),
            selectedColor: themeColor("--chart-line", "#2f2f2f")
          },
          {
            key: "sky",
            value: skyValue,
            height: skyHeight,
            y: skyY,
            baseColor: themeColor("--chart-sky-line-soft", "rgba(56, 189, 248, 0.42)"),
            selectedColor: themeColor("--chart-sky-line", "#38bdf8")
          }
        ].sort((a, b) => b.value - a.value);

        bars.forEach((bar, drawIndex) => {
          const isSelected = index === selectedIndex;
          ctx.save();
          ctx.globalAlpha = isSelected ? 0.96 : 0.82;
          ctx.fillStyle = isSelected ? bar.selectedColor : bar.baseColor;
          ctx.beginPath();
          ctx.roundRect(x, bar.y, barWidth, Math.max(2, bar.height), Math.min(8, barWidth / 2));
          ctx.fill();
          ctx.restore();
        });
      });
      splitPoints = { dddPoints, skyPoints };
    } else {
      values.forEach((value, index) => {
        const barHeight = ((value - minV) / range) * innerH;
        const x = padL + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
        const y = padT + innerH - barHeight;
        const isSelected = index === selectedIndex;
        ctx.fillStyle = isSelected
          ? themeColor("--chart-line", "#2f2f2f")
          : themeColor("--mini-bar", "#d1d5db");
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, Math.max(2, barHeight), Math.min(8, barWidth / 2));
        ctx.fill();
      });
      if (splitSeries && splitSeriesMode === "overlaySky") {
        const skyPoints = [];
        splitSeries.skyValues.forEach((value, index) => {
          const x = padL + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
          const skyValue = Number(value || 0);
          const skyHeight = ((skyValue - minV) / range) * innerH;
          const skyY = padT + innerH - skyHeight;
          const isSelected = index === selectedIndex;
          skyPoints.push({ x: x + barWidth / 2, y: skyY });
          ctx.save();
          ctx.globalAlpha = isSelected ? 0.96 : 0.82;
          ctx.fillStyle = isSelected
            ? themeColor("--chart-sky-line", "#38bdf8")
            : themeColor("--chart-sky-line-soft", "rgba(56, 189, 248, 0.42)");
          ctx.beginPath();
          ctx.roundRect(x, skyY, barWidth, Math.max(2, skyHeight), Math.min(8, barWidth / 2));
          ctx.fill();
          ctx.restore();
        });
        splitPoints = { totalPoints: points, skyPoints };
      }
    }
  } else {
    ctx.save();
    if (!splitSeries || splitSeriesMode === "overlaySky") {
      const fill = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      fill.addColorStop(0, themeColor("--chart-fill-start", "rgba(17,17,17,0.16)"));
      fill.addColorStop(1, themeColor("--chart-fill-end", "rgba(17,17,17,0.02)"));
      ctx.beginPath();
      ctx.moveTo(points[0].x, padT + innerH);
      ctx.lineTo(points[0].x, points[0].y);
      traceSeriesPathFromSecond(ctx, points, style);
      ctx.lineTo(points[points.length - 1].x, padT + innerH);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.restore();

    if (splitSeries && splitSeriesMode === "split") {
      const dddPoints = splitSeries.dddValues.map((value, index) => ({
        x: points[index].x,
        y: valueToChartY(Number(value || 0), minV, range, padT, innerH)
      }));
      const skyPoints = splitSeries.skyValues.map((value, index) => ({
        x: points[index].x,
        y: valueToChartY(Number(value || 0), minV, range, padT, innerH)
      }));
      splitPoints = { dddPoints, skyPoints };

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(dddPoints[0].x, padT + innerH);
      ctx.lineTo(dddPoints[0].x, dddPoints[0].y);
      traceSeriesPathFromSecond(ctx, dddPoints, style);
      ctx.lineTo(dddPoints[dddPoints.length - 1].x, padT + innerH);
      ctx.closePath();
      const dddFill = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      dddFill.addColorStop(0, themeColor("--chart-fill-start", "rgba(17,17,17,0.14)"));
      dddFill.addColorStop(1, themeColor("--chart-fill-end", "rgba(17,17,17,0.02)"));
      ctx.fillStyle = dddFill;
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(skyPoints[0].x, padT + innerH);
      ctx.lineTo(skyPoints[0].x, skyPoints[0].y);
      traceSeriesPathFromSecond(ctx, skyPoints, style);
      ctx.lineTo(skyPoints[skyPoints.length - 1].x, padT + innerH);
      ctx.closePath();
      const skyFill = ctx.createLinearGradient(0, padT, 0, padT + innerH);
      skyFill.addColorStop(0, themeColor("--chart-sky-fill-start", "rgba(56, 189, 248, 0.14)"));
      skyFill.addColorStop(1, themeColor("--chart-sky-fill-end", "rgba(56, 189, 248, 0.02)"));
      ctx.fillStyle = skyFill;
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = themeColor("--chart-line", "#2f2f2f");
      ctx.lineWidth = style === "smooth" ? 2.8 : 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      traceSeriesPath(ctx, dddPoints, style);
      ctx.stroke();

      ctx.strokeStyle = themeColor("--chart-sky-line", "#38bdf8");
      ctx.lineWidth = style === "smooth" ? 2.5 : 2;
      ctx.beginPath();
      traceSeriesPath(ctx, skyPoints, style);
      ctx.stroke();

      const lastDdd = dddPoints[dddPoints.length - 1];
      const lastSky = skyPoints[skyPoints.length - 1];
      ctx.fillStyle = themeColor("--chart-point", "#111");
      ctx.beginPath();
      ctx.arc(lastDdd.x, lastDdd.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = themeColor("--chart-sky-line", "#38bdf8");
      ctx.beginPath();
      ctx.arc(lastSky.x, lastSky.y, 3.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = themeColor("--chart-line", "#2f2f2f");
      ctx.lineWidth = style === "smooth" ? 2.8 : 2.2;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.beginPath();
      traceSeriesPath(ctx, points, style);
      ctx.stroke();

      if (style === "classic" || style === "smooth") {
        const last = points[points.length - 1];
        ctx.fillStyle = themeColor("--chart-point", "#111");
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        points.forEach((point, index) => {
          const radius = index === selectedIndex ? 4.5 : 2.8;
          ctx.fillStyle = index === selectedIndex
            ? themeColor("--chart-line", "#111")
            : themeColor("--chart-point-soft", themeColor("--mini-bar", "#9ca3af"));
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      if (splitSeries && splitSeriesMode === "overlaySky") {
        const skyPoints = splitSeries.skyValues.map((value, index) => ({
          x: points[index].x,
          y: valueToChartY(Number(value || 0), minV, range, padT, innerH)
        }));
        splitPoints = { totalPoints: points, skyPoints };
        ctx.strokeStyle = themeColor("--chart-sky-line", "#38bdf8");
        ctx.lineWidth = style === "smooth" ? 2.5 : 2;
        ctx.beginPath();
        traceSeriesPath(ctx, skyPoints, style);
        ctx.stroke();

        const lastSky = skyPoints[skyPoints.length - 1];
        ctx.fillStyle = themeColor("--chart-sky-line", "#38bdf8");
        ctx.beginPath();
        ctx.arc(lastSky.x, lastSky.y, 3.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  if (previousPeriodPoints?.length) {
    ctx.save();
    ctx.strokeStyle = themeColor("--chart-trend-line", "rgba(100,116,139,0.8)");
    ctx.lineWidth = (style === "smooth" || style === "bar") ? 2 : 1.7;
    ctx.setLineDash([7, 6]);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    traceSeriesPath(ctx, previousPeriodPoints, style === "bar" ? "smooth" : style);
    ctx.stroke();
    ctx.restore();
  }

  if (currentAppSettings.avgLine) {
    if (averageValue != null) {
      averageY = valueToChartY(averageValue, minV, range, padT, innerH);
      ctx.save();
      ctx.strokeStyle = themeColor("--chart-avg-line", "rgba(100,116,139,0.75)");
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(padL, averageY);
      ctx.lineTo(padL + innerW, averageY);
      ctx.stroke();
      ctx.restore();
    }
  } else if (currentAppSettings.trendLine) {
    const trend = getTrendEndpoints(values);
    if (trend) {
      const startX = style === "bar" ? points[0].x : padL;
      const endX = style === "bar" ? points[points.length - 1].x : (padL + innerW);
      const startY = valueToChartY(trend.first, minV, range, padT, innerH);
      const endY = valueToChartY(trend.last, minV, range, padT, innerH);
      ctx.save();
      ctx.strokeStyle = themeColor("--chart-trend-line", "rgba(236,72,153,0.8)");
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  if (selectedIndex >= 0 && points[selectedIndex]) {
    const selected = points[selectedIndex];
    ctx.save();
    ctx.strokeStyle = themeColor("--chart-select-line", "rgba(60,60,60,0.22)");
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(selected.x, padT);
    ctx.lineTo(selected.x, padT + innerH);
    ctx.stroke();

    if (splitSeriesMode === "split" && splitPoints?.dddPoints?.[selectedIndex] && splitPoints?.skyPoints?.[selectedIndex]) {
      const selectedDdd = splitPoints.dddPoints[selectedIndex];
      const selectedSky = splitPoints.skyPoints[selectedIndex];
      ctx.fillStyle = themeColor("--chart-select-fill", "#ffffff");
      ctx.beginPath();
      ctx.arc(selectedDdd.x, selectedDdd.y, 5.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = themeColor("--chart-select-stroke", "#2f2f2f");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selectedDdd.x, selectedDdd.y, 4.2, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = themeColor("--chart-select-fill", "#ffffff");
      ctx.beginPath();
      ctx.arc(selectedSky.x, selectedSky.y, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = themeColor("--chart-sky-line", "#38bdf8");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selectedSky.x, selectedSky.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (splitSeriesMode === "overlaySky" && splitPoints?.skyPoints?.[selectedIndex]) {
      const selectedSky = splitPoints.skyPoints[selectedIndex];
      if (style !== "bar") {
        ctx.fillStyle = themeColor("--chart-select-fill", "#ffffff");
        ctx.beginPath();
        ctx.arc(selected.x, selected.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = themeColor("--chart-select-stroke", "#2f2f2f");
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(selected.x, selected.y, 4.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = themeColor("--chart-select-fill", "#ffffff");
      ctx.beginPath();
      ctx.arc(selectedSky.x, selectedSky.y, 5.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = themeColor("--chart-sky-line", "#38bdf8");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selectedSky.x, selectedSky.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (style !== "bar") {
      ctx.fillStyle = themeColor("--chart-select-fill", "#ffffff");
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = themeColor("--chart-select-stroke", "#2f2f2f");
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(selected.x, selected.y, 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.fillStyle = themeColor("--chart-x-axis", "#5f5f5f");
  ctx.textBaseline = "top";
  ctx.font = "13px Roboto, sans-serif";
  const xTicks = Array.isArray(options.xTicks) ? options.xTicks : buildXAxisTicks(labels, options.scale || "all", options.mode || "plain");
  for (const tick of xTicks) {
    const x = padL + (labels.length === 1 ? innerW / 2 : (tick.index / (labels.length - 1)) * innerW);
    const txt = tick.text;
    const width = ctx.measureText(txt).width;
    ctx.fillText(txt, Math.max(padL, Math.min(padL + innerW - width, x - width / 2)), h - 20);
  }

  return {
    points,
    splitPoints,
    padL,
    padR,
    padT,
    padB,
    innerW,
    innerH,
    labels,
    values,
    style,
    averageValue,
    averageY,
    splitSeries,
    splitSeriesMode,
    previousPeriod,
    previousPeriodSeries,
    previousPeriodPoints,
    splitCountSeries: options?.splitCountSeries || null
  };
}

function drawMiniChart(canvas, values, windowStart, windowEnd) {
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  if (!values.length) return;

  const aggregatedValues = aggregateMiniChartValues(values);
  const padX = 8;
  const padY = 8;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const maxV = Math.max(...aggregatedValues);
  const safeMax = Math.max(1, maxV);
  const slotW = innerW / aggregatedValues.length;
  const barW = Math.max(6, Math.min(18, slotW * 0.74));

  ctx.fillStyle = themeColor("--mini-bar", "#d1d5db");
  for (let i = 0; i < aggregatedValues.length; i++) {
    const value = Number(aggregatedValues[i] || 0);
    const barH = Math.max(2, (value / safeMax) * innerH);
    const x = padX + i * slotW + (slotW - barW) / 2;
    const y = padY + innerH - barH;
    const radius = Math.min(4, barW / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, radius);
    ctx.fill();
  }

}

function updateChartZoomLabel() {
  const zoomLabelEl = $("#chartZoomLabel");
  const viewport = chartViewportByScale.all || { start: 0, size: 1 };
  const isFullRange = Math.abs((viewport.start || 0)) < 0.0001 && Math.abs((viewport.size || 1) - 1) < 0.0001;
  zoomLabelEl.textContent = tr("zoomAll");
  zoomLabelEl.classList.toggle("active", isFullRange);
}

function updateChartPresetButtonsState() {
  const buttons = Array.from(document.querySelectorAll(".chart-month-preset"));
  if (!buttons.length) return;
  const disabled = currentChartScale !== "all" || !lastData;
  const len = lastData
    ? aggregateOverviewByMonth(
        lastData?.charts?.overview?.labels || [],
        lastData?.charts?.overview?.values || [],
        lastData?.charts?.overview?.counts || []
      ).labels.length
    : 0;
  const viewport = chartViewportByScale.all || { start: 0, size: 1 };
  const visibleMonths = len ? Math.max(1, Math.round(viewport.size * len)) : 0;
  buttons.forEach((button) => {
    const months = Number(button.dataset.months || 0);
    button.disabled = disabled;
    button.classList.toggle("active", !disabled && getPresetViewportMonths(months) === visibleMonths);
  });
}

function setChartMonthButtonsState() {
  const disabled = currentChartScale !== "all";
  ["#chartZoomLabel", "#chartMonthPrev", "#chartMonthMode", "#chartQuarterMode", "#chartHalfYearMode", "#chartYearMode", "#chartMonthNext"].forEach((selector) => {
    const el = $(selector);
    if (el) el.disabled = disabled;
  });
  updateChartPresetButtonsState();
}

function clearChartSelection() {
  chartSelection = null;
  const tooltip = $("#chartTooltip");
  if (tooltip) tooltip.classList.remove("visible");
}

function hideChartTooltip() {
  const tooltip = $("#chartTooltip");
  if (!tooltip) return;
  tooltip.classList.remove("visible");
  tooltip.classList.remove("chart-tooltip-avg");
}

function syncAverageChartTooltip(tooltip, dateEl, sumEl, renderState) {
  if (!currentAppSettings.avgLine || !Number.isFinite(renderState.averageValue) || !Number.isFinite(renderState.averageY)) {
    return false;
  }
  const wrap = $("#chartWrapInner");
  const avgUnit = renderState.avgMode === "month" ? tr("averagePerMonth") : tr("averagePerDay");
  const avgCount = Array.isArray(renderState.counts) && renderState.counts.length
    ? getAverageValue(renderState.counts)
    : null;
  dateEl.textContent = tr("averageLine");
  sumEl.innerHTML = avgCount != null
    ? `<b>${rub(renderState.averageValue)} (${fmtDecimal(avgCount)})</b> ${avgUnit}`
    : `<b>${rub(renderState.averageValue)}</b> ${avgUnit}`;
  tooltip.classList.add("visible");
  tooltip.classList.add("chart-tooltip-avg");
  const maxLeft = Math.max(0, (wrap?.clientWidth || 0) - tooltip.offsetWidth - 8);
  const left = Math.max(8, maxLeft);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = "8px";
  return true;
}

function syncSelectedPointTooltip(tooltip, dateEl, sumEl, renderState) {
  const point = renderState.points?.[chartSelection.index];
  const label = renderState.labels?.[chartSelection.index];
  const value = renderState.values?.[chartSelection.index];
  const count = Math.max(0, Math.round(Number(renderState.counts?.[chartSelection.index] || 0)));
  const previousValue = Number(renderState.previousPeriodSeries?.[chartSelection.index] || 0);
  if (!point || label == null || value == null) {
    hideChartTooltip();
    return;
  }

  dateEl.textContent = formatTooltipDate(label, renderState.mode);
  if (renderState.splitSeries) {
    const dddValue = Number(renderState.splitSeries.dddValues?.[chartSelection.index] || 0);
    const skyValue = Number(renderState.splitSeries.skyValues?.[chartSelection.index] || 0);
    const dddCount = Math.max(0, Math.round(Number(renderState.splitCountSeries?.dddCounts?.[chartSelection.index] || 0)));
    const skyCount = Math.max(0, Math.round(Number(renderState.splitCountSeries?.skyCounts?.[chartSelection.index] || 0)));
    sumEl.innerHTML = renderState.splitSeriesMode === "overlaySky"
      ? [
          `<b>${rub(value)} (${fmtNumber(count)})</b>`,
          `<span>3DDD: ${rub(Math.max(0, value - skyValue))} (${fmtNumber(Math.max(0, count - skyCount))})</span>`,
          `<span>3DSky: ${rub(skyValue)} (${fmtNumber(skyCount)})</span>`
        ].join("<br>")
      : [
          `<b>${rub(value)} (${fmtNumber(count)})</b>`,
          `<span>3DDD: ${rub(dddValue)} (${fmtNumber(dddCount)})</span>`,
          `<span>3DSky: ${rub(skyValue)} (${fmtNumber(skyCount)})</span>`
        ].join("<br>");
  } else {
    const lines = [
      tr("chartSalesValue", { value: `${rub(value)} (${fmtNumber(count)})` })
    ];
    if (currentAppSettings.previousPeriodLine && renderState.previousPeriodSeries) {
      lines.push(`<span>${tr("previousPeriodRevenue", { label: tr("previousPeriod"), amount: rub(previousValue) })}</span>`);
    }
    sumEl.innerHTML = lines.join("<br>");
  }

  const wrap = $("#chartWrapInner");
  tooltip.classList.remove("chart-tooltip-avg");
  tooltip.classList.add("visible");
  const maxLeft = Math.max(0, (wrap?.clientWidth || 0) - tooltip.offsetWidth - 8);
  let left = point.x + 12;
  if (wrap && left > maxLeft) left = point.x - tooltip.offsetWidth - 12;
  left = Math.max(8, Math.min(maxLeft, left));
  const anchorY = renderState.splitPoints?.dddPoints?.[chartSelection.index] && renderState.splitPoints?.skyPoints?.[chartSelection.index]
    ? Math.min(
        renderState.splitPoints.dddPoints[chartSelection.index].y,
        renderState.splitPoints.skyPoints[chartSelection.index].y
      )
    : point.y;
  const top = Math.max(8, Math.min(anchorY - 16, (wrap?.clientHeight || 0) - tooltip.offsetHeight - 8));

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function syncChartTooltip(renderState) {
  const tooltip = $("#chartTooltip");
  const dateEl = $("#chartTooltipDate");
  const sumEl = $("#chartTooltipSum");
  if (!tooltip || !dateEl || !sumEl || !renderState) {
    hideChartTooltip();
    return;
  }

  if (!chartSelection || chartSelection.scale !== currentChartScale) {
    if (syncAverageChartTooltip(tooltip, dateEl, sumEl, renderState)) {
      return;
    }
    hideChartTooltip();
    return;
  }

  syncSelectedPointTooltip(tooltip, dateEl, sumEl, renderState);
}

/* Main dashboard rendering */
function getOverviewVisibleSeries(series, viewport) {
  const labels = Array.isArray(series?.labels) ? series.labels : [];
  const values = Array.isArray(series?.values) ? series.values : [];
  const counts = Array.isArray(series?.counts) ? series.counts : [];
  const bounds = getChartWindowBounds(values.length, viewport, getOverviewMinWindow(values.length));
  return {
    labels: labels.slice(bounds.start, bounds.end),
    values: values.slice(bounds.start, bounds.end),
    counts: counts.slice(bounds.start, bounds.end),
    start: bounds.start,
    end: bounds.end,
    fullLabels: labels,
    fullValues: values,
    fullCounts: counts,
    viewport: bounds
  };
}

function getAllScaleMainSeries(data, monthlySeries) {
  if (!monthlySeries.labels.length) {
    return { labels: [], values: [], mode: "plain" };
  }

  const startRange = getMonthRange(monthlySeries.labels[0]);
  const endRange = getMonthRange(monthlySeries.labels[monthlySeries.labels.length - 1]);
  const fullLabels = Array.isArray(data?.charts?.overview?.labels) ? data.charts.overview.labels : [];
  const fullValues = Array.isArray(data?.charts?.overview?.values) ? data.charts.overview.values : [];

  if (!startRange || !endRange) {
    return { labels: monthlySeries.labels, values: monthlySeries.values, mode: "month" };
  }

  const dayLabels = [];
  const dayValues = [];
  for (let i = 0; i < fullLabels.length; i++) {
    const date = parseIsoDateLabel(fullLabels[i]);
    if (!date) continue;
    if (date >= startRange.start && date <= endRange.end) {
      dayLabels.push(fullLabels[i]);
      dayValues.push(Number(fullValues[i] || 0));
    }
  }

  if (monthlySeries.labels.length > 12) {
    return { labels: monthlySeries.labels, values: monthlySeries.values, mode: "month" };
  }
  return { labels: dayLabels, values: dayValues, mode: "day" };
}

function updateViewportElement(isActive, viewportInfo) {
  const viewportEl = $("#chartViewport");
  if (!viewportInfo || viewportInfo.end <= viewportInfo.start) {
    viewportEl.classList.remove("visible");
    return;
  }
  viewportEl.classList.add("visible");
  viewportEl.classList.toggle("disabled", !isActive);
  viewportEl.style.left = `${viewportInfo.startRatio * 100}%`;
  viewportEl.style.width = `${viewportInfo.sizeRatio * 100}%`;
}

function getCurrentChartStyle() {
  return AVAILABLE_CHART_STYLES.has(currentAppSettings?.chart_style)
    ? currentAppSettings.chart_style
    : DEFAULT_SETTINGS.chart_style;
}

function getOverviewMonthlySeries(data) {
  return aggregateOverviewByMonth(
    data?.charts?.overview?.labels || [],
    data?.charts?.overview?.values || [],
    data?.charts?.overview?.counts || []
  );
}

function getOverviewViewportForScale(scale) {
  return scale === "all"
    ? (chartViewportByScale.all || { start: 0, size: 1 })
    : { start: 0, size: 1 };
}

function getAdaptiveChartSeries(data, scale, overviewSeries) {
  if (scale === "all") {
    return getAllScaleMainSeries(data, overviewSeries);
  }
  return {
    labels: data?.charts?.[scale]?.labels || [],
    values: data?.charts?.[scale]?.values || [],
    mode: "plain"
  };
}

function getSplitLineTimeBounds(scale) {
  const nowMs = Date.now();
  if (scale === "24h") return { start: nowMs - (24 * 60 * 60 * 1000), end: nowMs };
  if (scale === "7d") return { start: nowMs - (7 * 24 * 60 * 60 * 1000), end: nowMs };
  if (scale === "30d") return { start: nowMs - (30 * 24 * 60 * 60 * 1000), end: nowMs };
  return null;
}

function getSplitLineBucketLabel(date, scale, mode) {
  if (scale === "24h") return bucketHourLabel(date);
  if (scale === "all" && mode === "month") return `${bucketMonthLabel(date)}-01`;
  return bucketDayLabel(date);
}

function buildSplitLineSeries(scale, adaptiveSeries, renderSeries) {
  if ((!currentAppSettings.splitSiteLines && !currentAppSettings.splitSiteLinesOverlaySky) || !Array.isArray(cachedSalesObjects) || !cachedSalesObjects.length) {
    return null;
  }
  const sourceLabels = Array.isArray(adaptiveSeries?.labels) ? adaptiveSeries.labels : [];
  const labels = Array.isArray(renderSeries?.labels) ? renderSeries.labels : sourceLabels;
  if (!sourceLabels.length || !labels.length) return null;
  const labelSet = new Set(sourceLabels);
  const dddMap = new Map();
  const skyMap = new Map();
  const bounds = getSplitLineTimeBounds(scale);

  for (const item of cachedSalesObjects) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (bounds && (time < bounds.start || time >= bounds.end)) continue;
    const label = getSplitLineBucketLabel(dt, scale, renderSeries?.mode || adaptiveSeries?.mode || "plain");
    if (!labelSet.has(label)) continue;
    const amount = Number(item?.royaltyAmount || 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const target = detectSaleSite(item) === "3DSky" ? skyMap : dddMap;
    target.set(label, (target.get(label) || 0) + amount);
  }

  let dddValues = sourceLabels.map((label) => roundMoney(dddMap.get(label) || 0));
  let skyValues = sourceLabels.map((label) => roundMoney(skyMap.get(label) || 0));

  if (labels.length !== sourceLabels.length) {
    const groupSize = Math.max(1, Math.round(sourceLabels.length / labels.length));
    dddValues = aggregateBarSeries(sourceLabels, dddValues, renderSeries?.mode || adaptiveSeries?.mode || "plain", groupSize).values;
    skyValues = aggregateBarSeries(sourceLabels, skyValues, renderSeries?.mode || adaptiveSeries?.mode || "plain", groupSize).values;
  }

  return {
    dddValues,
    skyValues
  };
}

function buildOverlaySkySeries(scale, adaptiveSeries, renderSeries) {
  if (!currentAppSettings.splitSiteLinesOverlaySky) return null;
  return buildSplitLineSeries(scale, adaptiveSeries, renderSeries);
}

function buildSplitCountSeries(scale, adaptiveSeries, renderSeries) {
  if ((!currentAppSettings.splitSiteLines && !currentAppSettings.splitSiteLinesOverlaySky) || !Array.isArray(cachedSalesObjects) || !cachedSalesObjects.length) {
    return null;
  }
  const sourceLabels = Array.isArray(adaptiveSeries?.labels) ? adaptiveSeries.labels : [];
  const labels = Array.isArray(renderSeries?.labels) ? renderSeries.labels : sourceLabels;
  if (!sourceLabels.length || !labels.length) return null;
  const labelSet = new Set(sourceLabels);
  const dddMap = new Map();
  const skyMap = new Map();
  const bounds = getSplitLineTimeBounds(scale);

  for (const item of cachedSalesObjects) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (bounds && (time < bounds.start || time >= bounds.end)) continue;
    const label = getSplitLineBucketLabel(dt, scale, renderSeries?.mode || adaptiveSeries?.mode || "plain");
    if (!labelSet.has(label)) continue;
    const target = detectSaleSite(item) === "3DSky" ? skyMap : dddMap;
    target.set(label, (target.get(label) || 0) + 1);
  }

  let dddCounts = sourceLabels.map((label) => Math.round(Number(dddMap.get(label) || 0)));
  let skyCounts = sourceLabels.map((label) => Math.round(Number(skyMap.get(label) || 0)));
  if (labels.length !== sourceLabels.length) {
    const groupSize = Math.max(1, Math.ceil(sourceLabels.length / labels.length));
    dddCounts = aggregateBarSeries(
      sourceLabels,
      dddCounts,
      renderSeries?.mode || adaptiveSeries?.mode || "plain",
      groupSize
    ).values.map((value) => Math.round(Number(value || 0)));
    skyCounts = aggregateBarSeries(
      sourceLabels,
      skyCounts,
      renderSeries?.mode || adaptiveSeries?.mode || "plain",
      groupSize
    ).values.map((value) => Math.round(Number(value || 0)));
  }

  return {
    dddCounts,
    skyCounts
  };
}

function buildChartCountSeries(scale, adaptiveSeries, renderSeries) {
  if (!Array.isArray(cachedSalesObjects) || !cachedSalesObjects.length) {
    return Array.isArray(renderSeries?.labels) ? renderSeries.labels.map(() => 0) : [];
  }
  const sourceLabels = Array.isArray(adaptiveSeries?.labels) ? adaptiveSeries.labels : [];
  const labels = Array.isArray(renderSeries?.labels) ? renderSeries.labels : sourceLabels;
  if (!sourceLabels.length || !labels.length) return [];
  const labelSet = new Set(sourceLabels);
  const countMap = new Map();
  const bounds = getSplitLineTimeBounds(scale);

  for (const item of cachedSalesObjects) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (bounds && (time < bounds.start || time >= bounds.end)) continue;
    const label = getSplitLineBucketLabel(dt, scale, renderSeries?.mode || adaptiveSeries?.mode || "plain");
    if (!labelSet.has(label)) continue;
    countMap.set(label, (countMap.get(label) || 0) + 1);
  }

  let counts = sourceLabels.map((label) => Math.round(Number(countMap.get(label) || 0)));
  if (labels.length !== sourceLabels.length) {
    const groupSize = Math.max(1, Math.ceil(sourceLabels.length / labels.length));
    counts = aggregateBarSeries(
      sourceLabels,
      counts,
      renderSeries?.mode || adaptiveSeries?.mode || "plain",
      groupSize
    ).values.map((value) => Math.round(Number(value || 0)));
  }
  return counts;
}

function getChartTimeBounds(scale, renderSeries) {
  const fixedBounds = getSplitLineTimeBounds(scale);
  if (fixedBounds) return fixedBounds;
  const labels = Array.isArray(renderSeries?.labels) ? renderSeries.labels : [];
  if (!labels.length) return null;
  if (renderSeries?.mode === "month") {
    const first = getMonthRange(labels[0]);
    const last = getMonthRange(labels[labels.length - 1]);
    if (!first || !last) return null;
    return {
      start: first.start.getTime(),
      end: last.end.getTime() + 1
    };
  }
  if (renderSeries?.mode === "day") {
    const first = parseMskDayLabelRange(labels[0]);
    const last = parseMskDayLabelRange(labels[labels.length - 1]);
    if (!first || !last) return null;
    return {
      start: first.start.getTime(),
      end: last.end.getTime() + 1
    };
  }
  return null;
}

function bucketRevenueSeries(objects, startMs, endMs, bucketCount) {
  const safeCount = Math.max(1, Number(bucketCount) || 1);
  const series = Array.from({ length: safeCount }, () => 0);
  const span = Math.max(1, endMs - startMs);
  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    if (time < startMs || time >= endMs) continue;
    const amount = Number(item?.royaltyAmount || 0);
    if (!Number.isFinite(amount) || amount === 0) continue;
    const ratio = (time - startMs) / span;
    const index = clamp(Math.floor(ratio * safeCount), 0, safeCount - 1);
    series[index] += amount;
  }
  return series.map((value) => roundMoney(value));
}

function buildPreviousPeriodSeries(scale, renderSeries) {
  if (!currentAppSettings.previousPeriodLine || !Array.isArray(cachedSalesObjects) || !cachedSalesObjects.length) {
    return null;
  }
  const labels = Array.isArray(renderSeries?.labels) ? renderSeries.labels : [];
  if (!labels.length) return null;
  const currentBounds = getChartTimeBounds(scale, renderSeries);
  if (!currentBounds || !Number.isFinite(currentBounds.start) || !Number.isFinite(currentBounds.end)) {
    return null;
  }
  const currentSpan = Math.max(1, currentBounds.end - currentBounds.start);
  return bucketRevenueSeries(
    cachedSalesObjects,
    currentBounds.start - currentSpan,
    currentBounds.start,
    labels.length
  );
}

function getChartRenderSeries(scale, chartStyle, adaptiveSeries) {
  if (chartStyle === "bar" && scale === "all") {
    return aggregateBarSeries(
      adaptiveSeries.labels,
      adaptiveSeries.values,
      adaptiveSeries.mode,
      getMiniChartGroupSize(adaptiveSeries.labels.length)
    );
  }
  return adaptiveSeries;
}

function getChartSelectedIndex(scale) {
  return chartSelection?.scale === scale ? chartSelection.index : -1;
}

function createChartRenderState(scale, adaptiveSeries, renderSeries, chartStyle) {
  const xTicks = buildXAxisTicks(renderSeries.labels, scale, renderSeries.mode);
  const selectedIndex = getChartSelectedIndex(scale);
  const avgValue = currentAppSettings.avgLine ? getAverageValue(adaptiveSeries.values) : null;
  const splitSeries = currentAppSettings.splitSiteLinesOverlaySky
    ? buildOverlaySkySeries(scale, adaptiveSeries, renderSeries)
    : buildSplitLineSeries(scale, adaptiveSeries, renderSeries);
  const splitCountSeries = buildSplitCountSeries(scale, adaptiveSeries, renderSeries);
  const splitSeriesMode = currentAppSettings.splitSiteLinesOverlaySky ? "overlaySky" : "split";
  const countSeries = buildChartCountSeries(scale, adaptiveSeries, renderSeries);
  const previousPeriodSeries = buildPreviousPeriodSeries(scale, renderSeries);
  const renderState = drawLineChart($("#chart"), renderSeries.labels, renderSeries.values, {
    scale,
    mode: renderSeries.mode,
    avgMode: adaptiveSeries.mode,
    avgValue,
    xTicks,
    selectedIndex,
    style: chartStyle,
    splitSeries,
    splitSeriesMode,
    previousPeriod: previousPeriodSeries ? { values: previousPeriodSeries } : null
  });
  return Object.assign({}, renderState, {
    mode: renderSeries.mode,
    avgMode: adaptiveSeries.mode,
    scale,
    labels: renderSeries.labels,
    values: renderSeries.values,
    counts: countSeries,
    splitSeries,
    splitSeriesMode: splitSeries ? splitSeriesMode : null,
    previousPeriodSeries,
    splitCountSeries
  });
}

function updateRenderedChartSummary(data, scale, overviewSeries) {
  const el = $("#chartSummary");
  const summary = scale === "all"
    ? getAllScaleViewportSummary(data, overviewSeries)
    : data?.stats?.scales?.[scale];
  if (summary) {
    setChartSummary(el, summary.count, summary.sum);
  } else {
    el.textContent = "";
  }
}

function renderChart(data, scale) {
  const chartStyle = getCurrentChartStyle();
  const isAllScale = scale === "all";
  const overviewMonthly = getOverviewMonthlySeries(data);
  const overviewViewport = getOverviewViewportForScale(scale);
  const overviewSeries = getOverviewVisibleSeries(overviewMonthly, overviewViewport);
  const adaptiveSeries = getAdaptiveChartSeries(data, scale, overviewSeries);
  const renderSeries = getChartRenderSeries(scale, chartStyle, adaptiveSeries);
  const selectedIndex = getChartSelectedIndex(scale);

  lastRenderedChartState = createChartRenderState(scale, adaptiveSeries, renderSeries, chartStyle);
  drawMiniChart($("#chartMini"), overviewSeries.fullValues, overviewSeries.start, overviewSeries.end);
  updateViewportElement(isAllScale, overviewSeries.viewport);
  updateChartZoomLabel();
  setChartMonthButtonsState();
  if (selectedIndex >= renderSeries.labels.length) {
    clearChartSelection();
  }
  syncChartTooltip(lastRenderedChartState);
  updateRenderedChartSummary(data, scale, overviewSeries);
}

function createTopModelEmptyState() {
  const empty = document.createElement("div");
  empty.className = "muted";
  empty.style.marginTop = "10px";
  empty.textContent = tr("noDataPeriod");
  return empty;
}

function createTopModelThumb(item) {
  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = "";
  if (item?.img) img.src = safeUrl(item.img);
  return img;
}

function createTopModelLeft(item) {
  scheduleLocalizedModelTitleFetch(item);
  const left = document.createElement("div");
  left.className = "left";

  const name = document.createElement("div");
  name.className = "name";
  const link = document.createElement("a");
  link.href = safeUrl(item?.url);
  link.target = "_blank";
  link.rel = "noreferrer noopener";
  link.textContent = getModelDisplayTitle(item);
  name.appendChild(link);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = `${fmtNumber(item?.count || 0)} ${tr("salesWord")}`;

  const leftText = document.createElement("div");
  leftText.append(name, meta);

  left.append(createTopModelThumb(item), leftText);
  return left;
}

function createTopModelRight(item) {
  const delta = fmtPct(Number(item?.deltaPct || 0));
  const right = document.createElement("div");
  right.className = "right";

  const sum = document.createElement("div");
  sum.className = "sum";
  sum.textContent = rub(item?.sum);

  const pctEl = document.createElement("div");
  pctEl.className = `pct ${delta.cls}`;
  pctEl.textContent = `${delta.cls === "down" ? "↓" : (delta.cls === "up" ? "↑" : "•")} ${delta.s}`;

  right.append(sum, pctEl);
  return right;
}

function createTopModelRow(item) {
  const row = document.createElement("div");
  row.className = "row";
  row.append(createTopModelLeft(item), createTopModelRight(item));
  return row;
}

function getTopModelsVisibleCount(scale, totalCount = 0) {
  const current = Number(topModelsVisibleByScale[scale] || TOP_MODELS_STEP);
  return Math.max(0, Math.min(totalCount, Math.min(TOP_MODELS_MAX_VISIBLE, current)));
}

function createTopModelsToggleButton(scale, { nextVisibleCount, canLoadMore, canCollapse }) {
  const wrap = document.createElement("div");
  wrap.className = "top-list-actions";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn top-list-more-btn";
  button.textContent = canLoadMore ? tr("topModelsLoadMore") : tr("topModelsCollapse");
  button.addEventListener("click", () => {
    topModelsVisibleByScale[scale] = canLoadMore ? nextVisibleCount : TOP_MODELS_STEP;
    rerenderTopModelsView();
  });
  if (!canLoadMore && !canCollapse) return null;
  wrap.appendChild(button);
  return wrap;
}

function renderTopModels(data, scale) {
  const list = $("#topList");
  list.innerHTML = "";
  const items = data.top[scale] || [];
  if (!items.length) {
    list.appendChild(createTopModelEmptyState());
    return;
  }
  const visibleCount = getTopModelsVisibleCount(scale, items.length);
  items.slice(0, visibleCount).forEach((item) => list.appendChild(createTopModelRow(item)));
  const maxVisibleCount = Math.min(items.length, TOP_MODELS_MAX_VISIBLE);
  const nextVisibleCount = Math.min(maxVisibleCount, visibleCount + TOP_MODELS_STEP);
  const canLoadMore = visibleCount < maxVisibleCount && nextVisibleCount > visibleCount;
  const canCollapse = visibleCount >= maxVisibleCount && maxVisibleCount > TOP_MODELS_STEP;
  const toggleButton = createTopModelsToggleButton(scale, { nextVisibleCount, canLoadMore, canCollapse });
  if (toggleButton) {
    list.appendChild(toggleButton);
  }
}

function rerenderCurrentDashboard() {
  if (!lastData) return;
  renderAll(lastData, lastUpdatedAt);
}

function rerenderChartView({ persist = false } = {}) {
  if (!lastData) return;
  renderChart(lastData, currentChartScale);
  if (persist) persistPopupUiState();
}

function rerenderTopModelsView() {
  if (!lastData) return;
  renderTopModels(lastData, currentTopScale);
}

function resetTopModelsVisibleCount(scale = null) {
  if (scale) {
    topModelsVisibleByScale[scale] = TOP_MODELS_STEP;
    return;
  }
  Object.keys(topModelsVisibleByScale).forEach((key) => {
    topModelsVisibleByScale[key] = TOP_MODELS_STEP;
  });
}

function showOnboarding() {
  onboardingEl.classList.add("active");
  dashboardShellEl.classList.remove("active");
}

function showDashboard() {
  onboardingEl.classList.remove("active");
  dashboardShellEl.classList.add("active");
}

function finishBootstrap() {
  document.body.classList.remove("booting");
}

function resetProgressVisuals() {
  progressBarEl.classList.remove("visible");
  progressFillEl.style.width = "0%";
}

function setProgressText(progress) {
  hintEl.textContent = translateProgressText(progress?.label, progress) || tr("refresh");
  if (progress?.phase === "withdraw_stat" && progress.detail) {
    progressTextEl.textContent = `${translateProgressText(progress.detail, progress)}.`;
    return;
  }
  progressTextEl.textContent = translateProgressText(progress?.detail, progress) || "";
}

function updateProgressBar(progress) {
  if (Number.isFinite(progress?.current) && Number.isFinite(progress?.total) && progress.total > 0) {
    const pctValue = Math.max(3, Math.min(100, Math.round((progress.current / progress.total) * 100)));
    progressBarEl.classList.add("visible");
    progressFillEl.style.width = `${pctValue}%`;
    return;
  }
  resetProgressVisuals();
}

function setProgressState(progress = null) {
  const active = !!progress && !["done", "error"].includes(progress.phase);
  refreshInProgress = active;
  statusLineEl.classList.toggle("live", !!progress);
  const refreshBtn = $("#refresh");
  if (refreshBtn) refreshBtn.disabled = active;

  if (!progress) {
    resetProgressVisuals();
    return;
  }

  setProgressText(progress);
  updateProgressBar(progress);
}

function getRenderStatusMeta(data, updatedAt) {
  const ts = updatedAt ? new Date(updatedAt) : new Date();
  const newSales = Number(data?.meta?.newSalesCount || 0);
  const withdrawErrorText = String(data?.meta?.withdrawError || "");
  const isNetworkPartial =
    withdrawErrorText.includes("Сеть оборвалась") ||
    withdrawErrorText.includes("запрос завис во время загрузки withdraw_stat") ||
    withdrawErrorText.toLowerCase().includes("network was interrupted") ||
    withdrawErrorText.toLowerCase().includes("request got stuck while loading withdraw_stat");

  return {
    baseText: tr("updatedAt", { value: ts.toLocaleString(getUiLocale()) }),
    newSalesText: tr("newSales", { count: fmtNumber(newSales) }),
    withdrawErrorText: translateProgressText(withdrawErrorText),
    isNetworkPartial
  };
}

function applyRenderStatusMeta(meta, data) {
  if (meta.isNetworkPartial) {
    hintEl.textContent = `${meta.baseText} (${tr("partialSync")})`;
    progressTextEl.textContent = tr("partialSyncHint");
    showStatus(`${tr("warning")}:\n${meta.withdrawErrorText}`, true);
    return;
  }

  if (data?.meta?.withdrawError) {
    hintEl.textContent = `${meta.baseText} (${tr("withdrawUnavailable")})`;
    progressTextEl.textContent = meta.newSalesText;
    showStatus(tr("withdrawUnavailableHint", { error: data.meta.withdrawError }), true);
    return;
  }

  hintEl.textContent = meta.baseText;
  progressTextEl.textContent = meta.newSalesText;
}

function renderAll(data, updatedAt = null) {
  const hadData = !!lastData;
  lastData = data;
  lastUpdatedAt = updatedAt;
  resetTopModelsVisibleCount();
  if (!hadData && !chartViewportInitialized) {
    chartViewportByScale.all = { start: 0, size: 1 };
    chartViewportInitialized = true;
  }
  $("#modelsTotalCount").textContent = String(lastData?.stats?.totalSalesAll ?? 0);
  $("#modelsUniqueCount").textContent = String(lastData?.stats?.uniqueModelsAll ?? 0);

  renderTopBlocks(lastData);
  setTabActive($("#chartTabs"), currentChartScale);
  setTabActive($("#topTabs"), currentTopScale);
  renderChart(lastData, currentChartScale);
  renderTopModels(lastData, currentTopScale);
  applyRenderStatusMeta(getRenderStatusMeta(lastData, updatedAt), lastData);
  resetProgressVisuals();
  statusLineEl.classList.remove("live");
}

async function loadCached() {
  const resp = await sendRuntimeMessage({ type: "GET_CACHED" });
  if (!resp?.ok) return null;
  return resp;
}

async function syncCachedDashboard({ preserveProgress = false } = {}) {
  const cached = await loadCached();
  if (!cached?.dashboard) return false;
  showDashboard();
  renderAll(cached.dashboard, cached.updatedAt);
  if (preserveProgress) {
    const progress = await loadRefreshState();
    if (progress && !["done", "error"].includes(progress.phase)) {
      setProgressState(progress);
    }
  }
  if (cached.lastError) {
    showStatus(tr("lastManualRefreshError", { error: cached.lastError }), true);
  }
  return true;
}

async function loadRefreshState() {
  const resp = await sendRuntimeMessage({ type: "GET_REFRESH_STATE" });
  return resp?.ok ? resp.progress : null;
}

async function refreshNow(loadMode = "auto") {
  const resp = await sendRuntimeMessage({ type: "REFRESH_NOW", mode: loadMode });
  if (!resp?.ok) throw new Error(resp?.error || tr("refreshFailed"));
  return resp;
}

async function startRefresh(loadMode = "auto") {
  showDashboard();
  setProgressState({
    phase: "prepare",
    label: tr("prepareRefresh"),
    detail: tr("prepareRefreshDetails")
  });
  showStatus("", false);

  const fresh = await refreshNow(loadMode);
  await loadCachedSalesObjects();
  renderAll(fresh.dashboard, fresh.updatedAt);
  return fresh;
}

/* Viewport helpers */
function getOverviewMonthLength() {
  return aggregateOverviewByMonth(
    lastData?.charts?.overview?.labels || [],
    lastData?.charts?.overview?.values || [],
    lastData?.charts?.overview?.counts || []
  ).labels.length;
}

function getPresetViewportMonths(months) {
  return Number(months) === 12 ? 13 : Number(months);
}

function applyMonthViewport(months) {
  if (!lastData) return;
  currentChartScale = "all";
  const len = getOverviewMonthLength();
  if (!len) return;
  const safeMonths = Math.max(1, Math.min(len, getPresetViewportMonths(months)));
  const size = safeMonths / len;
  chartViewportByScale.all = { start: Math.max(0, 1 - size), size };
  setTabActive($("#chartTabs"), currentChartScale);
  clearChartSelection();
  rerenderChartView({ persist: true });
}

function canInteractWithAllScaleViewport() {
  return !!lastData && currentChartScale === "all";
}

function getOverviewMonthlyLengthFromData(data = lastData) {
  return aggregateOverviewByMonth(
    data?.charts?.overview?.labels || [],
    data?.charts?.overview?.values || [],
    data?.charts?.overview?.counts || []
  ).values.length || 0;
}

function getAllScaleViewport() {
  return chartViewportByScale.all || { start: 0, size: 1 };
}

function setAllScaleViewport(viewport) {
  chartViewportByScale.all = viewport;
}

function snapAllScaleViewport(length) {
  setAllScaleViewport(snapViewportToMonthGrid(getAllScaleViewport(), length));
}

function updateAllScaleViewportByStep(step) {
  const len = getOverviewMonthLength();
  if (!len) return false;
  const viewport = getAllScaleViewport();
  const visibleMonths = Math.max(1, Math.round(viewport.size * len));
  const maxStartIndex = Math.max(0, len - visibleMonths);
  const currentIndex = Math.round((viewport.start || 0) * len);
  const nextIndex = clamp(currentIndex + step, 0, maxStartIndex);
  setAllScaleViewport({
    start: nextIndex / len,
    size: visibleMonths / len
  });
  return true;
}

function findNearestChartPointIndex(clientX, canvas, renderState) {
  if (!renderState?.points?.length) return -1;
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const nearest = renderState.points.reduce((best, point, index) => {
    const dist = Math.abs(point.x - x);
    if (!best || dist < best.dist) return { index, dist };
    return best;
  }, null);
  return nearest ? nearest.index : -1;
}

function startViewportDrag(clientX, mode, miniWrap, viewportEl) {
  if (!canInteractWithAllScaleViewport()) return false;
  const rect = miniWrap.getBoundingClientRect();
  const viewport = getAllScaleViewport();
  chartDragState = {
    mode,
    rect,
    startX: clientX,
    viewportStart: viewport.start,
    viewportSize: viewport.size
  };
  viewportEl.classList.add("dragging");
  return true;
}

function computeDraggedViewport(clientX) {
  if (!chartDragState || !canInteractWithAllScaleViewport()) return null;
  const fullLength = getOverviewMonthlyLengthFromData();
  const minWindow = getOverviewMinWindow(fullLength);
  const deltaRatio = (clientX - chartDragState.startX) / Math.max(1, chartDragState.rect.width);
  let viewportStart = chartDragState.viewportStart;
  let viewportSize = chartDragState.viewportSize;
  const minSize = fullLength > 0 ? clamp(minWindow / fullLength, 0.03, 1) : 1;

  if (chartDragState.mode === "move") {
    viewportStart = clamp(chartDragState.viewportStart + deltaRatio, 0, 1 - viewportSize);
  } else if (chartDragState.mode === "left") {
    const newStart = clamp(
      chartDragState.viewportStart + deltaRatio,
      0,
      chartDragState.viewportStart + chartDragState.viewportSize - minSize
    );
    viewportSize = clamp(chartDragState.viewportSize + (chartDragState.viewportStart - newStart), minSize, 1);
    viewportStart = newStart;
  } else if (chartDragState.mode === "right") {
    viewportSize = clamp(chartDragState.viewportSize + deltaRatio, minSize, 1 - chartDragState.viewportStart);
    viewportStart = clamp(chartDragState.viewportStart, 0, 1 - viewportSize);
  }

  return { start: viewportStart, size: viewportSize };
}

function moveViewportToMiniChartPosition(clientX, miniWrap) {
  if (!canInteractWithAllScaleViewport()) return false;
  const rect = miniWrap.getBoundingClientRect();
  const clickRatio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
  const viewport = getAllScaleViewport();
  const newStart = clamp(clickRatio - viewport.size / 2, 0, 1 - viewport.size);
  const fullLength = getOverviewMonthlyLengthFromData();
  setAllScaleViewport(snapViewportToMonthGrid({ start: newStart, size: viewport.size }, fullLength));
  return true;
}

/* UI event wiring */
function wireTabs() {
  const chartTabsEl = $("#chartTabs");
  const topTabsEl = $("#topTabs");
  const miniWrap = $("#chartMiniWrap");
  const viewportEl = $("#chartViewport");
  const chartCanvas = $("#chart");
  const zoomLabelEl = $("#chartZoomLabel");
  const chartMonthPrevEl = $("#chartMonthPrev");
  const chartMonthNextEl = $("#chartMonthNext");
  const presetButtons = Array.from(document.querySelectorAll(".chart-month-preset"));

  const handleChartTabClick = (e) => {
    const b = e.target.closest(".tab");
    if (!b || !lastData) return;
    currentChartScale = b.dataset.scale;
    clearChartSelection();
    setTabActive(chartTabsEl, currentChartScale);
    rerenderChartView({ persist: true });
  };

  const handleTopTabClick = (e) => {
    const b = e.target.closest(".tab");
    if (!b || !lastData) return;
    currentTopScale = b.dataset.scale;
    setTabActive(topTabsEl, currentTopScale);
    rerenderTopModelsView();
  };

  const handleViewportPointerMove = (clientX) => {
    const nextViewport = computeDraggedViewport(clientX);
    if (!nextViewport) return;
    setAllScaleViewport({ start: nextViewport.start, size: nextViewport.size });
    rerenderChartView();
  };

  const stopViewportDrag = () => {
    if (chartDragState && canInteractWithAllScaleViewport()) {
      snapAllScaleViewport(getOverviewMonthlyLengthFromData());
      rerenderChartView({ persist: true });
    }
    chartDragState = null;
    viewportEl.classList.remove("dragging");
  };

  const handleViewportMouseDown = (e) => {
    if (!canInteractWithAllScaleViewport()) return;
    const handle = e.target.closest(".viewport-handle");
    const mode = handle?.dataset.handle || "move";
    startViewportDrag(e.clientX, mode, miniWrap, viewportEl);
    e.preventDefault();
  };

  const handleMiniWrapMouseDown = (e) => {
    if (!canInteractWithAllScaleViewport()) return;
    if (e.target.closest("#chartViewport")) return;
    if (!moveViewportToMiniChartPosition(e.clientX, miniWrap)) return;
    rerenderChartView({ persist: true });
    startViewportDrag(e.clientX, "move", miniWrap, viewportEl);
    e.preventDefault();
  };

  const handleChartCanvasClick = (e) => {
    const nearestIndex = findNearestChartPointIndex(e.clientX, chartCanvas, lastRenderedChartState);
    if (nearestIndex < 0) return;
    if (chartSelection?.scale === currentChartScale && chartSelection.index === nearestIndex) {
      clearChartSelection();
      rerenderChartView();
      return;
    }
    chartSelection = {
      scale: currentChartScale,
      index: nearestIndex
    };
    rerenderChartView();
  };

  const handleChartZoomReset = () => {
    setAllScaleViewport({ start: 0, size: 1 });
    if (lastData) {
      currentChartScale = "all";
      setTabActive(chartTabsEl, currentChartScale);
      rerenderChartView({ persist: true });
    }
  };

  const handlePresetButtonClick = (button) => () => {
    const months = Number(button.dataset.months || 0);
    if (!months) return;
    applyMonthViewport(months);
  };

  const handleViewportStep = (step) => () => {
    if (!canInteractWithAllScaleViewport()) return;
    if (!updateAllScaleViewportByStep(step)) return;
    rerenderChartView({ persist: true });
  };

  chartTabsEl.addEventListener("click", handleChartTabClick);
  topTabsEl.addEventListener("click", handleTopTabClick);
  viewportEl.addEventListener("mousedown", handleViewportMouseDown);
  miniWrap.addEventListener("mousedown", handleMiniWrapMouseDown);
  window.addEventListener("mousemove", (e) => handleViewportPointerMove(e.clientX));
  window.addEventListener("mouseup", stopViewportDrag);
  chartCanvas.addEventListener("click", handleChartCanvasClick);
  zoomLabelEl.addEventListener("click", handleChartZoomReset);
  presetButtons.forEach((button) => {
    button.addEventListener("click", handlePresetButtonClick(button));
  });
  chartMonthPrevEl.addEventListener("click", handleViewportStep(-1));
  chartMonthNextEl.addEventListener("click", handleViewportStep(1));
}

/* Runtime listeners */
function handleRefreshProgressMessage(msg) {
  if (msg?.type !== "REFRESH_PROGRESS") return;
  const progress = msg.progress || null;
  if (progress) {
    setupStarted = true;
    void persistPopupUiState();
  }
  showDashboard();
  setProgressState(progress);
  if (progress?.phase === "done" || progress?.phase === "error") {
    refreshInProgress = false;
    void loadCachedSalesObjects()
      .then(() => syncCachedDashboard())
      .catch(() => {});
  }
}

function handleStorageChanges(changes, area) {
  if (area !== "local") return;
  const hasWithdrawCacheChange = Object.keys(changes || {}).some((key) => key === WITHDRAW_CACHE_INDEX_KEY || key === WITHDRAW_CACHE_LEGACY_KEY || key.startsWith(WITHDRAW_CACHE_PREFIX));
  if (changes?.[APP_SETTINGS_KEY]) {
    applyAppSettingsState(changes[APP_SETTINGS_KEY].newValue || {}, { rerender: true });
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
    applyPopupLocale();
    rerenderCurrentDashboard();
  }
  if (changes?.cachedIncomeObjects || hasWithdrawCacheChange) {
    loadCachedSalesObjects().then(() => {
      rerenderCurrentDashboard();
    });
  }
  if (changes?.cachedDashboard || changes?.cachedUpdatedAt || changes?.cachedLastError) {
    if (changes?.cachedDashboard?.newValue) {
      setupStarted = true;
      void persistPopupUiState();
    }
    void loadCachedSalesObjects()
      .then(() => syncCachedDashboard({ preserveProgress: true }))
      .catch(() => {});
  }
}

function wireRuntimeListeners() {
  extApi.runtime.onMessage.addListener(handleRefreshProgressMessage);
  extApi.storage.onChanged?.addListener(handleStorageChanges);
}

async function applyPopupDisplayMode() {
  try {
    const currentTab = await getCurrentTabCompat();
    if (currentTab?.id) {
      document.body.classList.add("page-mode");
    } else {
      document.body.classList.remove("page-mode");
    }
  } catch {
    document.body.classList.remove("page-mode");
  }
}

function wireActions() {
  $("#refresh").addEventListener("click", async () => {
    try {
      await startRefresh("auto");
    } catch (e) {
      hintEl.textContent = tr("error");
      progressTextEl.textContent = tr("refreshErrorHint");
      showStatus(e?.message || String(e), true);
      setProgressState({
        phase: "error",
        label: tr("refreshErrorTitle"),
        detail: e?.message || String(e)
      });
    }
  });

  $("#startSetup").addEventListener("click", async () => {
    try {
      $("#startSetup").disabled = true;
      await markSetupStarted(true);
      await startRefresh("auto");
    } catch (e) {
      showDashboard();
      document.getElementById("welcomeHint").textContent = translateProgressText(e?.message || String(e));
      showStatus(e?.message || String(e), true);
    } finally {
      $("#startSetup").disabled = false;
    }
  });

  $("#settingsBtn")?.addEventListener("click", () => {
    extApi.tabs.create({ url: extApi.runtime.getURL("settings.html") });
  });

  $("#exportBtn")?.addEventListener("click", () => {
    extApi.tabs.create({ url: extApi.runtime.getURL("export.html") });
  });

  $("#openTabBtn")?.addEventListener("click", () => {
    extApi.tabs.create({ url: extApi.runtime.getURL("popup.html") });
  });

  $("#telegramLink")?.addEventListener("click", () => {
    extApi.tabs.create({ url: "https://t.me/Artnwayclub" });
  });

  $("#langBtn")?.addEventListener("click", async () => {
    const nextMode = getNextLanguageMode(currentLanguageMode);
    currentLanguageMode = nextMode;
    currentLanguage = resolveLanguage(currentFrontendBaseUrl, currentLanguageMode);
    document.documentElement.lang = currentLanguage === "en" ? "en" : "ru";
    applyPopupLocale();
    rerenderCurrentDashboard();
    showStatus(tr("languageChanged", { mode: tr(`languageMode${nextMode[0].toUpperCase()}${nextMode.slice(1)}`) }), true);
    await storageSet({ [UI_LANGUAGE_KEY]: nextMode });
  });

}

/* Bootstrap */
async function init() {
  try {
    await applyPopupDisplayMode();
    const settings = await loadAppSettings();
    applyAppSettingsState(settings);
    await loadFrontendLanguage();
    applyPopupLocale();
    await loadPopupUiState();
    await loadCachedSalesObjects();
    wireRuntimeListeners();
    wireTabs();
    wireActions();
    showStatus("", false);

    const progress = await loadRefreshState();
    if (progress) {
      setupStarted = true;
      await persistPopupUiState();
      showDashboard();
      finishBootstrap();
      setProgressState(progress);
      await syncCachedDashboard({ preserveProgress: true });
      if (!["done", "error"].includes(progress.phase)) return;
    }

    if (await syncCachedDashboard()) {
      setupStarted = true;
      await persistPopupUiState();
      finishBootstrap();
      return;
    }

    if (setupStarted) {
      showDashboard();
      finishBootstrap();
      return;
    }

    showOnboarding();
    finishBootstrap();
  } catch (e) {
    if (setupStarted) {
      showDashboard();
    } else {
      showOnboarding();
    }
    showStatus(e?.message || String(e), true);
    finishBootstrap();
  }
}

init();

