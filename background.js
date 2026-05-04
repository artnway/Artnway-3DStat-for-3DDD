/* Date & bucket helpers */
const extApi = globalThis.browser || globalThis.chrome;
const IS_FIREFOX = /\bfirefox\//i.test(String(globalThis.navigator?.userAgent || ""));
const MSK_OFFSET_MS = 3 * 3600 * 1000;
const FRONTEND_BASE_URLS = [
  "https://3ddd.ru",
  "https://3dsky.org"
];
const DEFAULT_FRONTEND_BASE_URL = FRONTEND_BASE_URLS[0];

function normalizeFrontendBaseUrl(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/\/+$/, "");
  if (raw === "https://3ddd.ru") return "https://3ddd.ru";
  if (raw === "https://3dsky.org") return "https://3dsky.org";
  return null;
}

function extractFrontendBaseUrlFromUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.origin === "https://3ddd.ru" || url.origin === "https://3dsky.org") {
      return url.origin;
    }
  } catch {}
  return null;
}

async function getPreferredFrontendBaseUrl() {
  try {
    const stored = await extApi.storage.local.get(["frontendBaseUrl"]);
    const normalized = normalizeFrontendBaseUrl(stored?.frontendBaseUrl);
    if (normalized) return normalized;
  } catch {}
  return DEFAULT_FRONTEND_BASE_URL;
}

async function setPreferredFrontendBaseUrl(value) {
  const normalized = normalizeFrontendBaseUrl(value);
  if (!normalized) return;
  await extApi.storage.local.set({ frontendBaseUrl: normalized });
}

function getFrontendStorageKey(baseUrl) {
  return baseUrl === "https://3dsky.org" ? "lastObservedFrontend3dskyAt" : "lastObservedFrontend3dddAt";
}

async function getFrontendCandidateBaseUrls(preferredBaseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const preferred = normalizeFrontendBaseUrl(preferredBaseUrl) || DEFAULT_FRONTEND_BASE_URL;
  const ordered = [];
  const push = (baseUrl) => {
    const normalized = normalizeFrontendBaseUrl(baseUrl);
    if (!normalized || ordered.includes(normalized)) return;
    ordered.push(normalized);
  };

  push(preferred);

  try {
    const tabs = await extApi.tabs.query({ url: FRONTEND_BASE_URLS.map((base) => `${base}/*`) });
    const seenFromTabs = tabs
      .map((tab) => extractFrontendBaseUrlFromUrl(tab?.url))
      .filter(Boolean);
    for (const baseUrl of seenFromTabs) push(baseUrl);
  } catch {}

  for (const baseUrl of FRONTEND_BASE_URLS) push(baseUrl);
  return ordered;
}

async function getObservedFrontendActivity() {
  try {
    const stored = await extApi.storage.local.get([
      "lastObservedFrontend3dddAt",
      "lastObservedFrontend3dskyAt",
      "frontendBaseUrl"
    ]);
    return {
      "https://3ddd.ru": Number(stored?.lastObservedFrontend3dddAt || 0),
      "https://3dsky.org": Number(stored?.lastObservedFrontend3dskyAt || 0),
      preferredBaseUrl: normalizeFrontendBaseUrl(stored?.frontendBaseUrl) || DEFAULT_FRONTEND_BASE_URL
    };
  } catch {
    return {
      "https://3ddd.ru": 0,
      "https://3dsky.org": 0,
      preferredBaseUrl: DEFAULT_FRONTEND_BASE_URL
    };
  }
}

function toMskShiftedDate(input) {
  const ms = input instanceof Date ? input.getTime() : Number(input || 0);
  return new Date(ms + MSK_OFFSET_MS);
}

function parseDateUtcPlus3(text) {
  const m = String(text).trim().match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) return null;
  const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
  const HH = Number(m[4]), MM = Number(m[5]);
  const utcMs = Date.UTC(yyyy, mm - 1, dd, HH - 3, MM, 0, 0);
  return new Date(utcMs);
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

function bucketHourKey(dUtc) {
  const msk = toMskShiftedDate(dUtc);
  const y = msk.getUTCFullYear();
  const m = String(msk.getUTCMonth() + 1).padStart(2, "0");
  const d = String(msk.getUTCDate()).padStart(2, "0");
  const h = String(msk.getUTCHours()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:00`;
}

function bucketHourLabel(dUtc) {
  const msk = toMskShiftedDate(dUtc);
  const H = String(msk.getUTCHours()).padStart(2, "0");
  return `${H}:00`;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
function getChromeRuntimeLastErrorMessage() {
  return String(globalThis.chrome?.runtime?.lastError?.message || "");
}
async function sendRuntimeMessageNoThrow(message) {
  try {
    await extApi.runtime.sendMessage(message);
  } catch {}
}
async function getTabById(tabId) {
  if (typeof extApi.tabs?.get !== "function") {
    throw new Error("API tabs.get недоступен.");
  }
  if ((globalThis.browser && extApi === globalThis.browser) || extApi.tabs.get.length <= 1) {
    return await extApi.tabs.get(tabId);
  }
  return await new Promise((resolve, reject) => {
    extApi.tabs.get(tabId, (tab) => {
      const errorMessage = getChromeRuntimeLastErrorMessage();
      if (errorMessage) {
        reject(new Error(errorMessage));
        return;
      }
      resolve(tab);
    });
  });
}
async function executeScriptCompat({ tabId, func }) {
  if (extApi.scripting?.executeScript) {
    const options = {
      target: { tabId },
      func
    };
    if (!IS_FIREFOX) options.world = "MAIN";
    return await extApi.scripting.executeScript(options);
  }
  if (extApi.tabs?.executeScript) {
    const code = `(${String(func)})();`;
    const results = await extApi.tabs.executeScript(tabId, { code });
    return [{ result: Array.isArray(results) ? results[0] : results }];
  }
  throw new Error("Не удалось выполнить скрипт на странице: executeScript API недоступен.");
}
function elapsedMs(startTs) {
  return Date.now() - startTs;
}
function decodeJwtPayload(token) {
  try {
    const raw = String(token || "").trim();
    const parts = raw.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
function isJwtExpired(token, skewSec = 60) {
  const payload = decodeJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp)) return false;
  return exp <= Math.floor(Date.now() / 1000) + skewSec;
}
function firstNonEmpty(values) {
  for (const v of values) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

/* Object identity & aggregation helpers */
function incomeObjectKey(o) {
  const explicitId = firstNonEmpty([
    o?.id,
    o?.saleId,
    o?.sale_id,
    o?.incomeId,
    o?.income_id,
    o?.transactionId,
    o?.transaction_id,
    o?.orderId,
    o?.order_id
  ]);
  const modelKey = firstNonEmpty([
    o?.modelId,
    o?.model_id,
    o?.slug,
    o?.article,
    o?.articleId,
    o?.article_id,
    o?.title,
    o?.titleEn
  ]);

  // Важно: не используем декоративные поля вроде firstImage/title как обязательную часть ключа,
  // иначе одна и та же продажа может считаться "новой" при повторном refresh.
  if (explicitId) {
    return [
      "id",
      explicitId,
      o?.date || "",
      String(o?.royaltyAmount ?? "")
    ].join("|");
  }

  return [
    "fallback",
    o?.date || "",
    modelKey,
    String(o?.royaltyAmount ?? ""),
    o?.regSite || ""
  ].join("|");
}

function buildObjectKeyCountMap(objects, keyFn) {
  const counts = new Map();
  for (const object of objects || []) {
    const key = keyFn(object);
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function subtractObjectsByKeyMultiplicity(objects, preferredObjects, keyFn) {
  const remaining = buildObjectKeyCountMap(preferredObjects, keyFn);
  const out = [];
  for (const object of objects || []) {
    const key = keyFn(object);
    const left = key ? (remaining.get(key) || 0) : 0;
    if (key && left > 0) {
      if (left === 1) remaining.delete(key);
      else remaining.set(key, left - 1);
      continue;
    }
    out.push(object);
  }
  return out;
}

function mergeObjectsByKeyMultiplicity(primaryObjects, secondaryObjects, keyFn) {
  const out = Array.isArray(primaryObjects) ? [...primaryObjects] : [];
  const primaryCounts = buildObjectKeyCountMap(primaryObjects, keyFn);
  const keptSecondaryCounts = new Map();

  for (const object of secondaryObjects || []) {
    const key = keyFn(object);
    if (!key) {
      out.push(object);
      continue;
    }

    const alreadyKept = keptSecondaryCounts.get(key) || 0;
    const allowedFromSecondary = Math.max(0, (primaryCounts.get(key) || 0) - alreadyKept);
    if (allowedFromSecondary > 0) {
      keptSecondaryCounts.set(key, alreadyKept + 1);
      continue;
    }

    out.push(object);
  }

  return out;
}

function dedupeObjectsByKey(objects, keyFn) {
  const seen = new Set();
  const out = [];
  for (const o of objects || []) {
    const key = keyFn(o);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}
function dedupeIncomeObjects(objects) {
  return dedupeObjectsByKey(objects, incomeObjectKey);
}

function compactSaleObject(item) {
  if (!item || typeof item !== "object") return null;
  const compact = {
    date: String(item?.date || ""),
    royaltyAmount: Number(item?.royaltyAmount || 0)
  };

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
  if (explicitId) compact.id = explicitId;

  const modelId = firstNonEmpty([item?.modelId, item?.model_id]);
  if (modelId) compact.modelId = modelId;

  const article = firstNonEmpty([item?.article, item?.articleId, item?.article_id]);
  if (article) compact.article = article;

  const slug = firstNonEmpty([item?.slug]);
  if (slug) compact.slug = slug;

  const title = firstNonEmpty([item?.title]);
  if (title) compact.title = title;

  const titleEn = firstNonEmpty([item?.titleEn]);
  if (titleEn) compact.titleEn = titleEn;

  const regSite = firstNonEmpty([item?.regSite, item?.site]);
  if (regSite) compact.regSite = regSite;

  const firstImage = firstNonEmpty([item?.firstImage]);
  if (firstImage) compact.firstImage = firstImage;

  return compact;
}

function compactSalesArray(objects) {
  return (Array.isArray(objects) ? objects : [])
    .map(compactSaleObject)
    .filter(Boolean);
}

function compactWithdrawCacheMap(cacheMap) {
  const out = {};
  for (const [wid, entry] of Object.entries(cacheMap || {})) {
    if (!wid) continue;
    out[wid] = {
      objects: compactSalesArray(entry?.objects),
      cachedAt: Number(entry?.cachedAt || 0) || Date.now()
    };
  }
  return out;
}

function mergeSalesWithWithdrawPriority(incomeObjects, withdrawObjects) {
  const normalizedWithdraw = Array.isArray(withdrawObjects) ? [...withdrawObjects] : [];
  const filteredIncome = subtractObjectsByKeyMultiplicity(incomeObjects, normalizedWithdraw, incomeObjectKey);
  return {
    incomeOnly: filteredIncome,
    withdrawOnly: normalizedWithdraw,
    combined: [...filteredIncome, ...normalizedWithdraw]
  };
}
function incMap(map, key, delta) {
  map.set(key, (map.get(key) || 0) + delta);
}

function ensureModelAgg(models, key, title, titleEn, slug, img, regSite) {
  if (!models.has(key)) models.set(key, { title, titleEn, slug, img, regSite, count: 0, sum: 0 });
  return models.get(key);
}

function topN(modelsMap, n) {
  return Array.from(modelsMap.values())
    .sort((a, b) => (b.sum - a.sum) || (b.count - a.count))
    .slice(0, n);
}

function finalizeChart(map, labelsOrder = null, labelFormatter = null) {
  if (labelsOrder) {
    const labels = [];
    const values = [];
    for (const key of labelsOrder) {
      labels.push(labelFormatter ? labelFormatter(key) : key);
      values.push(Math.round(((map.get(key) || 0) * 100)) / 100);
    }
    return { labels, values };
  }

  const entries = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  return {
    labels: entries.map(([k]) => labelFormatter ? labelFormatter(k) : k),
    values: entries.map(([, v]) => Math.round(v * 100) / 100)
  };
}

function pct(a, b) {
  if (!b) return a ? 100 : 0;
  return ((a - b) / b) * 100;
}

function modelUrl(slug) {
  if (!slug) return "https://3ddd.ru/3dmodels";
  return `https://3ddd.ru/3dmodels/show/${slug}/`;
}

function stripHtmlTags(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntitiesBasic(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => {
      const num = Number(code);
      return Number.isFinite(num) ? String.fromCodePoint(num) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const num = Number.parseInt(code, 16);
      return Number.isFinite(num) ? String.fromCodePoint(num) : _;
    })
    .trim();
}

function parseUploadedModelsCountFromHtml(html) {
  const text = String(html || "");
  const blockMatch = text.match(/<div[^>]*class=["'][^"']*\byou_bought\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const blockText = stripHtmlTags(blockMatch?.[1] || "");
  const sources = [
    blockText,
    stripHtmlTags(text.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "")
  ];

  for (const source of sources) {
    if (!source) continue;
    const localizedMatch = source.match(/(?:Моделей\s+загружено|Models\s+uploaded)\s*:\s*([\d\s]+)/i);
    if (localizedMatch) {
      const value = Number(String(localizedMatch[1] || "").replace(/[^\d]/g, ""));
      if (Number.isFinite(value) && value >= 0) return value;
    }
  }

  const fallbackValue = Number(String(blockText || "").replace(/[^\d]/g, ""));
  if (Number.isFinite(fallbackValue) && fallbackValue >= 0) return fallbackValue;
  return null;
}

function parseAuthorProfileFromHtml(html, baseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const text = String(html || "");
  const nameHtml =
    text.match(/<span[^>]*class=["'][^"']*\busername\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]
    || text.match(/id=["']private_data_block["'][\s\S]*?<div[^>]*class=["'][^"']*\bname\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
    || "";

  const balanceHtml =
    text.match(/<div[^>]*class=["'][^"']*\baccount-block\b[^"']*["'][^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/div>/i)?.[1]
    || text.match(/<div[^>]*class=["'][^"']*\bstat\b[^"']*["'][\s\S]*?<a[^>]+href=["'][^"']*\/user\/income_new[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)?.[1]
    || "";

  let avatar =
    text.match(/<div[^>]*class=["'][^"']*\bperson\b[^"']*["'][^>]*>\s*<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*class=["'][^"']*\bavatar\b/i)?.[1]
    || text.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*class=["'][^"']*\bavatar\b[^"']*\bround-avatar\b/i)?.[1]
    || text.match(/<div[^>]*class=["'][^"']*\bperson\b[^"']*["'][\s\S]*?background-image\s*:\s*url\((['"]?)([^)'"]+)\1\)/i)?.[2]
    || "";

  const profile = {
    name: decodeHtmlEntitiesBasic(stripHtmlTags(nameHtml || "")),
    balance: decodeHtmlEntitiesBasic(stripHtmlTags(balanceHtml || "")),
    avatar: ""
  };

  if (avatar) {
    try {
      profile.avatar = new URL(avatar, `${normalizeFrontendBaseUrl(baseUrl) || DEFAULT_FRONTEND_BASE_URL}/`).href;
    } catch {
      profile.avatar = avatar;
    }
  }

  return profile;
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

function parseLocalizedModelTitleFromHtml(html) {
  const text = String(html || "");
  if (!text.trim()) return "";
  const h1Match = text.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Value = normalizeParsedModelTitle(h1Match?.[1] || "");
  if (h1Value && !isGenericModelTitle(h1Value)) return h1Value;

  const metaPatterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:title["']/i
  ];
  for (const pattern of metaPatterns) {
    const match = text.match(pattern);
    const value = normalizeParsedModelTitle(match?.[1] || "");
    if (value && !isGenericModelTitle(value)) return value;
  }
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const titleValue = normalizeParsedModelTitle(titleMatch?.[1] || "");
  if (titleValue && !isGenericModelTitle(titleValue)) return titleValue;
  return "";
}

async function fetchLocalizedModelTitle(slug, language = "ru") {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return "";
  const baseUrl = language === "en" ? "https://3dsky.org" : "https://3ddd.ru";
  const cacheKey = `${language === "en" ? "en" : "ru"}:${safeSlug}`;
  if (LOCALIZED_MODEL_TITLE_CACHE.has(cacheKey)) {
    return LOCALIZED_MODEL_TITLE_CACHE.get(cacheKey) || "";
  }
  try {
    const response = await fetch(`${baseUrl}/3dmodels/show/${safeSlug}/`, {
      method: "GET",
      credentials: "include",
      cache: "force-cache"
    });
    if (!response.ok) return "";
    const title = parseLocalizedModelTitleFromHtml(await response.text());
    if (title) LOCALIZED_MODEL_TITLE_CACHE.set(cacheKey, title);
    return title;
  } catch {
    return "";
  }
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function approximatelyEqual(a, b, epsilon = 0.01) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= (Number(epsilon || 0) + 1e-9);
}

function buildDayOrderFromWindow(startMs, endMs) {
  const order = [];
  const start = new Date(startMs);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(endMs);
  end.setUTCHours(0, 0, 0, 0);
  for (let ts = start.getTime(); ts <= end.getTime(); ts += 24 * 60 * 60 * 1000) {
    order.push(bucketDayLabel(new Date(ts)));
  }
  return order;
}

function detectSaleSite(item) {
  const raw = String(item?.regSite || item?.site || "").trim().toLowerCase();
  if (raw.includes("sky")) return "3DSky";
  if (raw.includes("3ddd")) return "3DDD";
  return Number(item?.royaltyAmount || 0) > 215 ? "3DSky" : "3DDD";
}

const BACKGROUND_RANKS = [
  { key: "normal", title: "Обычный статус", threshold: 0 },
  { key: "amber", title: "Янтарь", threshold: 100 },
  { key: "amethyst", title: "Аметист", threshold: 250 },
  { key: "sapphire", title: "Сапфир", threshold: 500 },
  { key: "emerald", title: "Изумруд", threshold: 1000 },
  { key: "ruby", title: "Рубин", threshold: 2000 },
  { key: "topaz", title: "Топаз", threshold: 3000 },
  { key: "diamond", title: "Бриллиант", threshold: 5000 },
  { key: "bronze", title: "Бронза", threshold: 8000 },
  { key: "silver", title: "Серебро", threshold: 12000 },
  { key: "gold", title: "Золото", threshold: 16000 },
  { key: "aquamarine", title: "Звезда аквамарин", threshold: 30000 },
  { key: "goldstar", title: "Золотая звезда", threshold: 60000 },
  { key: "blackstar", title: "Чёрная звезда", threshold: 100000 }
];

function getCurrentAndNextRank(totalSales) {
  const count = Number(totalSales || 0);
  let current = BACKGROUND_RANKS[0];
  let next = null;
  for (const rank of BACKGROUND_RANKS) {
    if (count >= rank.threshold) {
      current = rank;
      continue;
    }
    next = rank;
    break;
  }
  return { current, next: next || null };
}

/* Background runtime state */
const ENDPOINT_MODE = new Map(); // endpoint -> "POST" | "GET"

/* Background runtime diagnostics */
// Идея: не "штурмовать" API, а держать ровный темп запросов.
// Если ловим 429 — ставим общий cooldown по Retry-After и чуть увеличиваем gap.
const API_THROTTLE = {
  nextTs: 0,
  cooldownUntil: 0,
  gapMs: 1000,       // ещё чуть мягче стартуем, чтобы снизить число 429 и сетевых сбоев на длинных сериях
  minGapMs: 800,
  maxGapMs: 8000,
  okStreak: 0
};
const API_STATS = {
  requests: 0,
  byStatus: {},
  byEndpoint: {}
};
const DEBUG_LOG_LIMIT = 220;
const DEBUG_LOGS = [];
const REQUEST_TRACE_LIMIT = 120;
const REQUEST_TRACES = [];
const LOCALIZED_MODEL_TITLE_CACHE = new Map();
const CACHE_KEYS = {
  dash: "cachedDashboard",
  updatedAt: "cachedUpdatedAt",
  lastError: "cachedLastError",
  incomeObjects: "cachedIncomeObjects",
  withdrawStatById: "cachedWithdrawStatById",
  withdrawStatIndex: "cachedWithdrawStatIndex"
};
let refreshState = null;
let refreshInFlight = null;

function resetApiStats() {
  API_STATS.requests = 0;
  API_STATS.byStatus = {};
  API_STATS.byEndpoint = {};
}
function emitRefreshProgress(progress) {
  refreshState = Object.assign({ at: Date.now() }, progress || {});
  try {
    void sendRuntimeMessageNoThrow({ type: "REFRESH_PROGRESS", progress: refreshState });
  } catch {}
}
function clearRefreshProgress() {
  refreshState = null;
}
function getRefreshProgress() {
  return refreshState;
}
function addDebugLog(level, message, extra = null) {
  DEBUG_LOGS.push({
    at: Date.now(),
    level: String(level || "info"),
    message: String(message || ""),
    extra: extra ?? null
  });
  if (DEBUG_LOGS.length > DEBUG_LOG_LIMIT) {
    DEBUG_LOGS.splice(0, DEBUG_LOGS.length - DEBUG_LOG_LIMIT);
  }
}
function addRequestTrace(entry) {
  REQUEST_TRACES.push(Object.assign({ at: Date.now() }, entry || {}));
  if (REQUEST_TRACES.length > REQUEST_TRACE_LIMIT) {
    REQUEST_TRACES.splice(0, REQUEST_TRACES.length - REQUEST_TRACE_LIMIT);
  }
}
async function getDebugInfo() {
  const cached = await getCachedPack();
  const tokenInfo = await extApi.storage.local.get(["jwtTokenSource", "jwtTokenObservedAt", "appSettings", "frontendBaseUrl"]);
  const frontendSession = await detectActiveFrontendSession();
  return {
    generatedAt: Date.now(),
    refreshState: getRefreshProgress(),
    apiThrottle: {
      nextTs: API_THROTTLE.nextTs,
      cooldownUntil: API_THROTTLE.cooldownUntil,
      gapMs: API_THROTTLE.gapMs,
      minGapMs: API_THROTTLE.minGapMs,
      maxGapMs: API_THROTTLE.maxGapMs,
      okStreak: API_THROTTLE.okStreak
    },
    apiStats: cloneApiStats(),
    token: {
      source: tokenInfo?.jwtTokenSource || null,
      observedAt: tokenInfo?.jwtTokenObservedAt || null
    },
    frontendSession,
    frontendBaseUrl: tokenInfo?.frontendBaseUrl || null,
    settings: tokenInfo?.appSettings || null,
    cached: {
      updatedAt: cached?.updatedAt || null,
      hasDashboard: !!cached?.dashboard,
      lastError: cached?.lastError || null,
      meta: cached?.dashboard?.meta || null
    },
    dataSources: cached?.dashboard?.meta?.dataSources || null,
    topBlockAudit: cached?.dashboard?.meta?.topBlockAudit || null,
    logs: DEBUG_LOGS.slice(),
    requests: REQUEST_TRACES.slice()
  };
}
function formatEtaText(ms) {
  const totalSec = Math.max(1, Math.round(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `примерно ${sec} сек`;
  if (sec === 0) return `примерно ${min} мин`;
  return `примерно ${min} мин ${sec} сек`;
}
function bumpApiStat(status, endpoint) {
  const statusKey = String(status);
  API_STATS.byStatus[statusKey] = (API_STATS.byStatus[statusKey] || 0) + 1;
  if (!API_STATS.byEndpoint[endpoint]) API_STATS.byEndpoint[endpoint] = { requests: 0, byStatus: {} };
  API_STATS.byEndpoint[endpoint].byStatus[statusKey] = (API_STATS.byEndpoint[endpoint].byStatus[statusKey] || 0) + 1;
}
function markApiRequest(endpoint) {
  API_STATS.requests += 1;
  if (!API_STATS.byEndpoint[endpoint]) API_STATS.byEndpoint[endpoint] = { requests: 0, byStatus: {} };
  API_STATS.byEndpoint[endpoint].requests += 1;
}
function cloneApiStats() {
  return JSON.parse(JSON.stringify(API_STATS));
}

/* Network recovery & API transport */
function isAuthTokenError(errorLike) {
  const msg = errorLike?.message || String(errorLike || "");
  return msg.includes("Invalid JWT Token") || msg.includes("Expired JWT Token");
}
function isNetworkFetchError(errorLike) {
  const msg = errorLike?.message || String(errorLike || "");
  return msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Таймаут запроса") || msg.includes("AbortError") || msg.includes("Watchdog timeout");
}
function createWatchdogError(scope, timeoutMs, detail = "") {
  const suffix = detail ? ` (${detail})` : "";
  const error = new Error(`Watchdog timeout: ${scope} не отвечает дольше ${formatEtaText(timeoutMs)}${suffix}`);
  error.name = "WatchdogTimeoutError";
  error.watchdog = true;
  error.watchdogScope = scope;
  error.timeoutMs = timeoutMs;
  return error;
}
async function runWithWatchdog(taskFactory, { scope, timeoutMs, onTimeout = null, extra = null }) {
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve().then(taskFactory),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          addDebugLog("error", "Watchdog timeout", {
            scope,
            timeoutMs,
            ...(extra || null)
          });
          try { onTimeout?.(); } catch {}
          reject(createWatchdogError(scope, timeoutMs));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function extractBearerToken(rawValue) {
  const token = String(rawValue || "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.split(".").length < 3) return null;
  return token;
}
async function storeObservedBearerToken(rawValue, source = "unknown") {
  const token = extractBearerToken(rawValue);
  if (!token || isJwtExpired(token, 30)) return false;

  const stored = await extApi.storage.local.get(["jwtToken"]);
  const current = String(stored?.jwtToken || "").trim();
  if (current === token && !isJwtExpired(current, 30)) return true;
  const payload = {
    jwtToken: token,
    jwtTokenSource: source,
    jwtTokenObservedAt: Date.now()
  };
  const frontendBaseUrl = extractFrontendBaseUrlFromUrl(source);
  if (frontendBaseUrl) {
    payload[getFrontendStorageKey(frontendBaseUrl)] = Date.now();
  }

  await extApi.storage.local.set(payload);
  if (frontendBaseUrl) {
    await setPreferredFrontendBaseUrl(frontendBaseUrl);
  }
  addDebugLog("info", "Captured bearer token from observed request", { source });
  return true;
}

async function throttleBeforeRequest() {
  const now = Date.now();
  const t = Math.max(API_THROTTLE.nextTs, API_THROTTLE.cooldownUntil);
  if (now < t) await sleep(t - now);
  API_THROTTLE.nextTs = Date.now() + API_THROTTLE.gapMs;
}

function throttleOn429(res) {
  const ra = res.headers?.get?.("Retry-After");
  const waitMs = (ra && /^\d+$/.test(ra)) ? Number(ra) * 1000 : 2000;
  API_THROTTLE.cooldownUntil = Math.max(API_THROTTLE.cooldownUntil, Date.now() + waitMs);

  // Мягко увеличиваем интервал после 429
  API_THROTTLE.gapMs = Math.min(API_THROTTLE.maxGapMs, API_THROTTLE.gapMs + 200);
  API_THROTTLE.okStreak = 0;

  console.warn(`429 cooldown ${Math.round(waitMs/1000)}s, gapMs=${API_THROTTLE.gapMs}`);
  addDebugLog("warn", "API rate limit cooldown", {
    waitMs,
    gapMs: API_THROTTLE.gapMs
  });
}

function throttleOnOk() {
  API_THROTTLE.okStreak++;
  // Если долго без 429 — чуть ускоряемся обратно
  if (API_THROTTLE.okStreak >= 3) {
    API_THROTTLE.gapMs = Math.max(API_THROTTLE.minGapMs, API_THROTTLE.gapMs - 25);
    API_THROTTLE.okStreak = 0;
  }
}
async function callEndpoint({ endpoint, token, pageSize, pageNumber, extraBody = null, extraQuery = null, onRecovering = null }) {
  const MAX_RETRIES = 10;
  const BASE_DELAY_MS = 900;
  const MAX_DELAY_MS = 3000;
  const REQUEST_TIMEOUT_MS = endpoint === "withdraw_stat" ? 30000 : 20000;
  const MAX_NETWORK_RETRIES = endpoint === "withdraw_stat" ? 2 : 1;

  const buildGetUrl = () => {
    const url = new URL(`https://author-stats.3ddd.ru/api/${endpoint}`);
    url.searchParams.set("pageSize", String(pageSize));
    url.searchParams.set("pageNumber", String(pageNumber));
    if (extraQuery) {
      for (const [k, v] of Object.entries(extraQuery)) {
        if (v !== undefined && v !== null && String(v).length) url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  };

  const fetchWithTimeout = async (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`timeout:${endpoint}`), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, init, { signal: controller.signal }));
    } catch (e) {
      if (e?.name === "AbortError") {
        throw new Error(`Таймаут запроса (${endpoint}) после ${Math.round(REQUEST_TIMEOUT_MS / 1000)} сек`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  const doGetOnce = async () => fetchWithTimeout(buildGetUrl(), {
    method: "GET",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "authorization": `Bearer ${token}`
    }
  });

  const doPostOnce = async () => fetchWithTimeout(`https://author-stats.3ddd.ru/api/${endpoint}`, {
    method: "POST",
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "content-type": "application/json",
      "authorization": `Bearer ${token}`
    },
    body: JSON.stringify(Object.assign({ pageSize, pageNumber }, (extraBody || {})))
  });

  const parseJsonSafe = async (res) => {
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { text, json };
  };


  const requestOnce = async () => {
    const mode = ENDPOINT_MODE.get(endpoint);

    if (mode === "GET") return doGetOnce();
    if (mode === "POST") return doPostOnce();

    // режим неизвестен — пробуем POST один раз
    const resPost = await doPostOnce();
    if (resPost.status === 405) {
      ENDPOINT_MODE.set(endpoint, "GET");
      return doGetOnce();
    }
    ENDPOINT_MODE.set(endpoint, "POST");
    return resPost;
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    await throttleBeforeRequest();
    markApiRequest(endpoint);
    const requestStartedAt = Date.now();
    const requestMeta = {
      endpoint,
      attempt: attempt + 1,
      pageNumber,
      pageSize,
      wid: extraBody?.transaction_withdraw_id || extraQuery?.transaction_withdraw_id || null
    };
    let res;
    try {
      res = await requestOnce();
    } catch (e) {
      const durationMs = elapsedMs(requestStartedAt);
      addRequestTrace(Object.assign({}, requestMeta, {
        ok: false,
        status: null,
        durationMs,
        error: e?.message || String(e)
      }));
      if (isNetworkFetchError(e) && attempt < MAX_NETWORK_RETRIES) {
        const retryDelayMs = Math.min(4000, 1200 * (attempt + 1));
        addDebugLog("warn", "Transient network error, retrying request", {
          endpoint,
          attempt: attempt + 1,
          retryDelayMs,
          message: e?.message || String(e)
        });
        try {
          onRecovering?.({
            type: "network",
            endpoint,
            attempt: attempt + 1,
            retryDelayMs,
            message: e?.message || String(e)
          });
        } catch {}
        await sleep(retryDelayMs);
        continue;
      }
      throw e;
    }
    const durationMs = elapsedMs(requestStartedAt);

    if (res.status === 429) {
      bumpApiStat(429, endpoint);
      throttleOn429(res);
      try {
        onRecovering?.({
          type: "rate_limit",
          endpoint,
          attempt: attempt + 1,
          retryDelayMs: Math.max(500, API_THROTTLE.cooldownUntil - Date.now()),
          status: 429,
          message: "Сервер временно ограничил частоту запросов"
        });
      } catch {}
      addRequestTrace(Object.assign({}, requestMeta, {
        ok: false,
        status: 429,
        durationMs,
        error: "Rate limited"
      }));
      continue;
    }

    const { text, json } = await parseJsonSafe(res);

    if (!res.ok) {
      bumpApiStat(res.status, endpoint);
      const msg = json?.message || text || `HTTP ${res.status}`;
      addRequestTrace(Object.assign({}, requestMeta, {
        ok: false,
        status: res.status,
        durationMs,
        error: msg
      }));
      throw new Error(`API ошибка (${endpoint}): ${msg}`);
    }
    if (!json || json.success !== true) {
      addRequestTrace(Object.assign({}, requestMeta, {
        ok: false,
        status: res.status,
        durationMs,
        error: `API вернуло неожиданный ответ (${endpoint})`
      }));
      throw new Error(`API вернуло неожиданный ответ (${endpoint})`);
    }
    bumpApiStat(res.status, endpoint);
    throttleOnOk();
    addRequestTrace(Object.assign({}, requestMeta, {
      ok: true,
      status: res.status,
      durationMs
    }));
    return json;
  }

  throw new Error(`API 429: слишком много запросов (${endpoint}) — исчерпаны повторы`);
}

async function getStoredToken() {
  const stored = await extApi.storage.local.get(["jwtToken"]);
  const token = stored?.jwtToken || null;
  if (!token) return null;
  if (isJwtExpired(token)) {
    await extApi.storage.local.remove(["jwtToken", "jwtTokenSource", "jwtTokenObservedAt"]);
    return null;
  }
  return token;
}

async function getStoredWithdrawIds() {
  const stored = await extApi.storage.local.get(["withdrawIds"]);
  const raw = (stored?.withdrawIds || "").trim();
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function waitForTabComplete(tabId, timeoutMs = 15000, progress = null) {
  return new Promise((resolve, reject) => {
    let done = false;
    let timer = null;

    const cleanup = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };

    const finish = () => {
      cleanup();
      resolve();
    };

    const fail = (message) => {
      if (progress) {
        emitRefreshProgress({
          phase: progress.phase || "page_watchdog",
          label: progress.label || "Идёт восстановление соединения",
          current: progress.current ?? 0,
          total: progress.total ?? null,
          detail: progress.detail || message
        });
      }
      addDebugLog("error", "Page load watchdog timeout", {
        tabId,
        timeoutMs,
        message
      });
      cleanup();
      reject(new Error(message));
    };

    const onUpdated = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };

    chrome.tabs.onUpdated.addListener(onUpdated);

    void getTabById(tabId)
      .then((tt) => {
        if (tt?.status === "complete") finish();
      })
      .catch((error) => {
        fail(error?.message || "Не удалось получить вкладку.");
      });

    timer = setTimeout(() => fail("Таймаут ожидания загрузки страницы 3ddd."), timeoutMs);
  });
}

async function loadPageHtmlViaTab(url, {
  progress = null,
  timeoutMs = 20000,
  allowReload = true
} = {}) {
  const safeBaseUrl = extractFrontendBaseUrlFromUrl(url) || DEFAULT_FRONTEND_BASE_URL;
  const urlPattern = `${safeBaseUrl}/*`;
  const tabs = await extApi.tabs.query({ url: [urlPattern] }).catch(() => []);
  const preferredTab = tabs.find((tab) => extractFrontendBaseUrlFromUrl(tab?.url) === safeBaseUrl);
  let createdTabId = null;
  let tabId = preferredTab?.id || tabs[0]?.id || null;

  try {
    if (!tabId) {
      const createdTab = await extApi.tabs.create({ url, active: false });
      createdTabId = createdTab?.id || null;
      tabId = createdTab?.id || null;
    } else if (allowReload) {
      try {
        await extApi.tabs.update(tabId, { url });
      } catch {
        try { await extApi.tabs.reload(tabId, { bypassCache: true }); } catch {}
      }
    }

    if (!tabId) {
      throw new Error("Не удалось подготовить вкладку для чтения страницы.");
    }

    await waitForTabComplete(tabId, timeoutMs, progress);

    const executionResult = await executeScriptCompat({
      tabId,
      func: () => document.documentElement?.outerHTML || ""
    });
    return String(executionResult?.[0]?.result || "");
  } finally {
    if (createdTabId) {
      try { await extApi.tabs.remove(createdTabId); } catch {}
    }
  }
}

/* Token & tab acquisition */
async function probeFrontendSession(baseUrl) {
  const safeBaseUrl = normalizeFrontendBaseUrl(baseUrl);
  if (!safeBaseUrl) {
    return { baseUrl: null, authenticated: false, finalUrl: null, status: null, error: "invalid_base_url" };
  }

  const probeUrl = `${safeBaseUrl}/user/income_new?codex_probe=${Date.now()}`;
  try {
    const res = await fetch(probeUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      redirect: "follow"
    });
    const finalUrl = String(res?.url || probeUrl);
    const text = await res.text();
    const loginDetected =
      /\/auth\/login/i.test(finalUrl) ||
      /name=["']password["']|type=["']password["']|\/auth\/login/i.test(text);
    return {
      baseUrl: safeBaseUrl,
      authenticated: !!res.ok && !loginDetected,
      finalUrl,
      status: res.status,
      error: null
    };
  } catch (e) {
    addDebugLog("warn", "frontend session probe failed", {
      baseUrl: safeBaseUrl,
      message: e?.message || String(e)
    });
    return {
      baseUrl: safeBaseUrl,
      authenticated: false,
      finalUrl: null,
      status: null,
      error: e?.message || String(e)
    };
  }
}

async function detectActiveFrontendSession() {
  const observed = await getObservedFrontendActivity();
  const candidateBaseUrls = await getFrontendCandidateBaseUrls(observed.preferredBaseUrl);
  const tabs = await extApi.tabs.query({ url: FRONTEND_BASE_URLS.map((base) => `${base}/*`) }).catch(() => []);
  const openTabSignals = {
    "https://3ddd.ru": tabs.some((tab) => extractFrontendBaseUrlFromUrl(tab?.url) === "https://3ddd.ru"),
    "https://3dsky.org": tabs.some((tab) => extractFrontendBaseUrlFromUrl(tab?.url) === "https://3dsky.org")
  };

  const probeResults = [];
  for (const baseUrl of candidateBaseUrls) {
    probeResults.push(await probeFrontendSession(baseUrl));
  }

  const authenticated = probeResults.filter((item) => item.authenticated).map((item) => item.baseUrl);
  let state = "none";
  if (authenticated.length === 1) state = authenticated[0] === "https://3dsky.org" ? "3dsky" : "3ddd";
  else if (authenticated.length > 1) state = "both";

  if (state === "none" && IS_FIREFOX) {
    const openBases = FRONTEND_BASE_URLS.filter((baseUrl) => openTabSignals[baseUrl]);
    if (openBases.length === 1) {
      state = openBases[0] === "https://3dsky.org" ? "3dsky" : "3ddd";
      addDebugLog("info", "Firefox fallback picked frontend session from open tab", {
        baseUrl: openBases[0]
      });
    } else if (openBases.length > 1) {
      state = "both";
      addDebugLog("info", "Firefox fallback picked multiple frontend sessions from open tabs", {
        baseUrls: openBases
      });
    }
  }

  let preferredBaseUrl = null;
  if (state === "3ddd") preferredBaseUrl = "https://3ddd.ru";
  else if (state === "3dsky") preferredBaseUrl = "https://3dsky.org";
  else if (state === "both") {
    const byObserved = authenticated
      .map((baseUrl) => ({ baseUrl, at: Number(observed[baseUrl] || 0) }))
      .sort((a, b) => b.at - a.at)[0];
    preferredBaseUrl =
      (byObserved?.at ? byObserved.baseUrl : null) ||
      (authenticated.includes(observed.preferredBaseUrl) ? observed.preferredBaseUrl : null) ||
      (authenticated.find((baseUrl) => openTabSignals[baseUrl]) || null) ||
      authenticated[0];
  }

  const result = {
    state,
    preferredBaseUrl: preferredBaseUrl || observed.preferredBaseUrl || DEFAULT_FRONTEND_BASE_URL,
    candidateBaseUrls,
    signals: {
      observed3dddAt: Number(observed["https://3ddd.ru"] || 0),
      observed3dskyAt: Number(observed["https://3dsky.org"] || 0),
      openTab3ddd: openTabSignals["https://3ddd.ru"],
      openTab3dsky: openTabSignals["https://3dsky.org"],
      probe3ddd: probeResults.find((item) => item.baseUrl === "https://3ddd.ru")?.authenticated || false,
      probe3dsky: probeResults.find((item) => item.baseUrl === "https://3dsky.org")?.authenticated || false
    },
    probeResults
  };

  addDebugLog("info", "Frontend session detected", {
    state: result.state,
    preferredBaseUrl: result.preferredBaseUrl,
    signals: result.signals
  });
  return result;
}

async function autoToken() {
  const frontendSession = await detectActiveFrontendSession();
  if (frontendSession.state === "none") {
    throw new Error("Не найдена активная сессия 3DDD / 3DSky. Сначала войди в аккаунт на 3ddd.ru или 3dsky.org, затем повтори попытку.");
  }

  const preferredBaseUrl = frontendSession.preferredBaseUrl || await getPreferredFrontendBaseUrl();
  const candidateBaseUrls = frontendSession.candidateBaseUrls?.length
    ? [preferredBaseUrl, ...frontendSession.candidateBaseUrls.filter((baseUrl) => baseUrl !== preferredBaseUrl)]
    : await getFrontendCandidateBaseUrls(preferredBaseUrl);
  const incomePath = "/user/income_new";
  const incomePatterns = FRONTEND_BASE_URLS.map((base) => `${base}${incomePath}*`);
  let token = null;
  let resolvedBaseUrl = null;

  for (let domainIndex = 0; domainIndex < candidateBaseUrls.length && !token; domainIndex++) {
    const activeBaseUrl = candidateBaseUrls[domainIndex];
    const tabs = await extApi.tabs.query({ url: incomePatterns });
    let createdTabId = null;
    const matchingTab = tabs.find((tab) => extractFrontendBaseUrlFromUrl(tab?.url) === activeBaseUrl);
    let tabId = matchingTab?.id || null;

    const navigateIncomePage = async (attemptNo) => {
      const url = `${activeBaseUrl}${incomePath}?codex_refresh=${Date.now()}_${attemptNo}`;
      if (!tabId) {
        const t = await extApi.tabs.create({ url, active: false });
        createdTabId = t.id;
        tabId = t.id;
        return;
      }
      try {
        await extApi.tabs.update(tabId, { url });
      } catch {
        await extApi.tabs.reload(tabId, { bypassCache: true });
      }
    };

    const pageAttempts = 3;
    for (let pageAttempt = 1; pageAttempt <= pageAttempts && !token; pageAttempt++) {
      emitRefreshProgress({
        phase: "token",
        label: "Обновляет доступ к API",
        current: pageAttempt,
        total: pageAttempts,
        detail: `Пробую получить токен, попытка ${pageAttempt} из ${pageAttempts} (${new URL(activeBaseUrl).host})`
      });
      try {
        await navigateIncomePage(pageAttempt);
        await waitForTabComplete(tabId, 25000, {
          phase: "token_watchdog",
          label: "Идёт восстановление соединения",
          current: pageAttempt,
          total: pageAttempts,
          detail: `Страница ${new URL(activeBaseUrl).host} загружается слишком долго. Повторяю попытку ${pageAttempt} из ${pageAttempts}.`
        });
        await sleep(1200);

        token = await runWithWatchdog(async () => {
          for (let attempt = 0; attempt < 30; attempt++) {
            const [{ result }] = await executeScriptCompat({
              tabId,
              func: () => {
                const norm = (v) => String(v || "").replace(/^Bearer\s+/i, "").trim();
                const decodePayload = (token) => {
                  try {
                    const parts = String(token || "").split(".");
                    if (parts.length < 2) return null;
                    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
                    const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
                    return JSON.parse(atob(padded));
                  } catch {
                    return null;
                  }
                };
                const looksLikeJwt = (s) => {
                  const t = norm(s);
                  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(t) && t.length > 60;
                };
                const isFreshJwt = (s) => {
                  const t = norm(s);
                  if (!looksLikeJwt(t)) return false;
                  const exp = Number(decodePayload(t)?.exp);
                  if (!Number.isFinite(exp)) return true;
                  return exp > Math.floor(Date.now() / 1000) + 60;
                };

                const candidates = [];

                const pullFromStorage = (store) => {
                  if (!store) return;
                  const keys = ["access_token","accessToken","token","jwt","auth_token","Authorization"];
                  for (const k of keys) {
                    const v = store.getItem(k);
                    if (v) candidates.push(v);
                  }
                  for (let i = 0; i < store.length; i++) {
                    const k = store.key(i);
                    if (!k) continue;
                    if (!/token|auth|jwt|access/i.test(k)) continue;
                    const v = store.getItem(k);
                    if (v) candidates.push(v);
                  }
                };

                pullFromStorage(window.localStorage);
                pullFromStorage(window.sessionStorage);

                for (const v of [...candidates]) {
                  if (typeof v === "string" && v.startsWith("{") && v.includes("token")) {
                    try {
                      const obj = JSON.parse(v);
                      const cand = obj.access_token || obj.token || obj.jwt || obj.accessToken;
                      if (cand) candidates.push(cand);
                    } catch {}
                  }
                }

                try {
                  const ck = document.cookie || "";
                  ck.split(";").forEach((p) => {
                    const val = p.split("=").slice(1).join("=");
                    if (val) candidates.push(decodeURIComponent(val));
                  });
                } catch {}

                try {
                  const w = window.wrappedJSObject || window;
                  const maybe = [
                    w.__NUXT__?.state?.auth?.token,
                    w.__INITIAL_STATE__?.auth?.token,
                    w.__APP_STATE__?.auth?.token
                  ].filter(Boolean);
                  for (const v of maybe) candidates.push(v);
                } catch {}

                for (const c of candidates) {
                  const t = norm(c);
                  if (isFreshJwt(t)) return { token: t, hasExpiredCandidate: false };
                }
                for (const c of candidates) {
                  const t = norm(c);
                  if (looksLikeJwt(t)) return { token: null, hasExpiredCandidate: true };
                }
                return { token: null, hasExpiredCandidate: false };
              }
            });

            if (result?.token) {
              return result.token;
            }

            await sleep(result?.hasExpiredCandidate ? 700 : 350);
          }
          return null;
        }, {
          scope: "token pickup",
          timeoutMs: 22000,
          extra: { pageAttempt, frontendBaseUrl: activeBaseUrl },
          onTimeout: () => {
            emitRefreshProgress({
              phase: "token_watchdog",
              label: "Идёт восстановление соединения",
              current: pageAttempt,
              total: pageAttempts,
              detail: `Страница ${new URL(activeBaseUrl).host} открыта, но токен не появляется слишком долго.`
            });
          }
        });
      } catch (e) {
        addDebugLog("warn", "autoToken page attempt failed", {
          pageAttempt,
          frontendBaseUrl: activeBaseUrl,
          message: e?.message || String(e)
        });
        if (pageAttempt >= pageAttempts) break;
        continue;
      }
    }

    if (createdTabId) {
      try { await extApi.tabs.remove(createdTabId); } catch {}
    }

    if (token) {
      resolvedBaseUrl = activeBaseUrl;
      break;
    }
  }

  if (!token) throw new Error("Не нашёл свежий токен на странице. Убедись, что ты залогинен на 3ddd.ru или 3dsky.org. Если сессия только что обновилась, повтори через пару секунд.");
  await setPreferredFrontendBaseUrl(resolvedBaseUrl || preferredBaseUrl);
  return token;
}

/* Withdraw history discovery */
async function autoWithdrawIds(token) {
  const preferredBaseUrl = await getPreferredFrontendBaseUrl();
  // 1) Сначала пробуем быстрый и полный способ: fetch всех страниц withdraw_history
  try {
    const baseUrl = `${preferredBaseUrl}/user/withdraw_history`;

    async function fetchHtml(url) {
      const r = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store"
      });
      if (!r.ok) throw new Error(`HTTP ${r.status} при загрузке ${url}`);
      return await r.text();
    }

    function extractIdsFromHtml(html) {
      const out = [];
      const re = /href="\/user\/withdraw_stat\/([A-Z0-9]+)"/g;
      let m;
      while ((m = re.exec(html)) !== null) out.push(m[1]);
      return out;
    }

    function detectMaxPage(html) {
      // Ищем все вхождения page=N и берём максимум
      const re = /withdraw_history\?page=(\d+)/g;
      let m, max = 1;
      while ((m = re.exec(html)) !== null) {
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > max) max = n;
      }
      return max;
    }

    const firstHtml = await fetchHtml(baseUrl);
    const maxPage = detectMaxPage(firstHtml);

    const ids = new Set(extractIdsFromHtml(firstHtml));

    // Пробегаем все страницы, которые нашли
    for (let p = 2; p <= maxPage; p++) {
      const html = await fetchHtml(`${baseUrl}?page=${p}`);
      for (const id of extractIdsFromHtml(html)) ids.add(id);
    }

    const all = Array.from(ids);
    if (!all.length) throw new Error("Не нашёл withdraw_stat ссылки в таблице.");

    // Можно (не обязательно) отсортировать для стабильности
    all.sort();

    return all.join(", ");
  } catch (e) {
    // 2) Fallback: старый табовый способ (на случай блокировок fetch/cookies)
    console.warn("autoWithdrawIds: fetch-режим не сработал, fallback на tab method:", e);

    const tabs = await extApi.tabs.query({ url: FRONTEND_BASE_URLS.map((base) => `${base}/user/withdraw_history*`) });
    let createdTabId = null;
    const preferredTab = tabs.find((tab) => extractFrontendBaseUrlFromUrl(tab?.url) === preferredBaseUrl);
    let activeBaseUrl = preferredTab
      ? preferredBaseUrl
      : (extractFrontendBaseUrlFromUrl(tabs[0]?.url) || preferredBaseUrl);
    let tabId = preferredTab?.id || tabs[0]?.id || null;

    if (!tabId) {
      const t = await extApi.tabs.create({ url: `${activeBaseUrl}/user/withdraw_history`, active: false });
      createdTabId = t.id;
      tabId = t.id;
    } else {
      try { await extApi.tabs.reload(tabId, { bypassCache: true }); } catch {}
    }

    await waitForTabComplete(tabId, 15000);

    const [{ result: html }] = await executeScriptCompat({
      tabId,
      func: () => document.documentElement?.outerHTML || ""
    });

    if (createdTabId) {
      try { await extApi.tabs.remove(createdTabId); } catch {}
    }

    const text = String(html || "");
    const cand = Array.from(new Set((text.match(/\b[A-Z0-9]{6,20}\b/g) || []))).filter(x => /[0-9]/.test(x));

    const good = [];
    for (const id of cand.slice(0, 40)) {
      try {
        const json = await callEndpoint({
          endpoint: "withdraw_stat",
          token,
          pageSize: 1,
          pageNumber: 1,
          extraBody: { transaction_withdraw_id: id },
          extraQuery: { transaction_withdraw_id: id }
        });
        if (json && json.success === true) good.push(id);
      } catch {}
      if (good.length >= 10) break;
    }

    if (!good.length) throw new Error("Не смог найти withdraw id автоматически. Вставь его вручную (из Network запроса withdraw_stat).");
    return good.join(", ");
  }
}

async function fetchWithdrawHistoryPage(page = 1, baseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const safeBaseUrl = normalizeFrontendBaseUrl(baseUrl) || DEFAULT_FRONTEND_BASE_URL;
  const url = page > 1 ? `${safeBaseUrl}/user/withdraw_history?page=${page}` : `${safeBaseUrl}/user/withdraw_history`;
  const REQUEST_TIMEOUT_MS = 25000;
  const MAX_RETRIES = 8;
  const BASE_PAGE_GAP_MS = 1400;
  const pageIndex = Math.max(1, Number(page) || 1);
  const tabProgress = {
    phase: "withdraw_history",
    label: "Проверяет «Историю вывода»",
    current: page,
    total: null,
    detail: `Открывает страницу ${page} через вкладку браузера`
  };

  await sleep(BASE_PAGE_GAP_MS + Math.min(1200, (pageIndex - 1) * 35));

  const fetchWithTimeout = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`timeout:withdraw_history:${page}`), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
    } catch (e) {
      if (e?.name === "AbortError") {
        throw new Error(`Таймаут запроса (withdraw_history) после ${Math.round(REQUEST_TIMEOUT_MS / 1000)} сек`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const r = await fetchWithTimeout();
      if (r.status === 429) {
        const retryAfter = r.headers?.get?.("Retry-After");
        const retryDelayMs = retryAfter && /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Math.min(12000, 2500 + attempt * 1800);
        addDebugLog("warn", "withdraw_history rate limited", {
          page,
          attempt: attempt + 1,
          retryDelayMs
        });
        emitRefreshProgress({
          phase: "withdraw_history_recovery",
          label: "Идёт восстановление соединения",
          current: page,
          total: null,
          detail: `История вывода, страница ${page}. Лимит запросов (429), повтор через ${formatEtaText(retryDelayMs)}`
        });
        await sleep(retryDelayMs);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} при загрузке ${url}`);
      return await r.text();
    } catch (e) {
      if ((isNetworkFetchError(e) || String(e?.message || "").includes("HTTP 429")) && attempt < MAX_RETRIES) {
        const retryDelayMs = Math.min(10000, 1800 + attempt * 1400);
        addDebugLog("warn", "withdraw_history page retry scheduled", {
          page,
          attempt: attempt + 1,
          retryDelayMs,
          message: e?.message || String(e)
        });
        emitRefreshProgress({
          phase: "withdraw_history_recovery",
          label: "Идёт восстановление соединения",
          current: page,
          total: null,
          detail: `История вывода, страница ${page}. Плохая связь или сервер не отвечает, повтор через ${formatEtaText(retryDelayMs)}`
        });
        await sleep(retryDelayMs);
        continue;
      }
      throw e;
    }
  }

  addDebugLog("warn", "withdraw_history fetch exhausted, falling back to tab mode", {
    page,
    url
  });
  return await loadPageHtmlViaTab(url, {
    progress: tabProgress,
    timeoutMs: REQUEST_TIMEOUT_MS
  });
}

async function fetchUploadedModelsCount(baseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const safeBaseUrl = normalizeFrontendBaseUrl(baseUrl) || DEFAULT_FRONTEND_BASE_URL;
  const url = `${safeBaseUrl}/user/models`;
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`timeout:user_models:${attempt + 1}`), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await sleep(1200 + attempt * 1000);
          continue;
        }
        throw new Error(`HTTP ${response.status} при загрузке ${url}`);
      }
      const html = await response.text();
      const count = parseUploadedModelsCountFromHtml(html);
      if (Number.isFinite(count) && count >= 0) return count;
      throw new Error("Не удалось извлечь количество загруженных моделей со страницы /user/models");
    } catch (error) {
      const isRetryable =
        error?.name === "AbortError" ||
        isNetworkFetchError(error) ||
        /HTTP (429|5\d\d)\b/.test(String(error?.message || ""));
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(1200 + attempt * 1000);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

async function fetchAuthorProfile(baseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const safeBaseUrl = normalizeFrontendBaseUrl(baseUrl) || DEFAULT_FRONTEND_BASE_URL;
  const url = `${safeBaseUrl}/user/`;
  const REQUEST_TIMEOUT_MS = 20000;
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(`timeout:user_profile:${attempt + 1}`), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        signal: controller.signal
      });
      if (!response.ok) {
        if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
          await sleep(1200 + attempt * 1000);
          continue;
        }
        throw new Error(`HTTP ${response.status} при загрузке ${url}`);
      }
      const html = await response.text();
      const profile = parseAuthorProfileFromHtml(html, safeBaseUrl);
      if (profile.name || profile.balance || profile.avatar) return profile;
      throw new Error("Не удалось извлечь профиль автора со страницы /user/");
    } catch (error) {
      const isRetryable =
        error?.name === "AbortError" ||
        isNetworkFetchError(error) ||
        /HTTP (429|5\d\d)\b/.test(String(error?.message || ""));
      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(1200 + attempt * 1000);
        continue;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}
function extractWithdrawIdsFromHtml(html) {
  const out = [];
  const re = /href="\/user\/withdraw_stat\/([A-Z0-9]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}
function detectWithdrawHistoryMaxPage(html) {
  const re = /withdraw_history\?page=(\d+)/g;
  let m, max = 1;
  while ((m = re.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}
async function detectWithdrawIdsIncremental(baseUrl = DEFAULT_FRONTEND_BASE_URL) {
  const knownIds = await getStoredWithdrawIds();
  const knownSet = new Set(knownIds);
  const merged = [];
  const mergedSet = new Set();
  const newIds = [];
  let pagesChecked = 0;
  let stoppedOnKnown = false;
  let firstKnownPage = null;
  const pagesAfterKnownSafety = 1;
  let pagesAfterKnownRead = 0;

  const pushIds = (ids) => {
    for (const id of ids) {
      if (!mergedSet.has(id)) {
        mergedSet.add(id);
        merged.push(id);
      }
    }
  };
  const persistMergedIdsProgress = async () => {
    if (!merged.length) return;
    try {
      await extApi.storage.local.set({ withdrawIds: Array.from(new Set(merged)).join(", ") });
    } catch {}
  };

  const firstHtml = await fetchWithdrawHistoryPage(1, baseUrl);
  const maxPage = detectWithdrawHistoryMaxPage(firstHtml);
  emitRefreshProgress({
    phase: "withdraw_history",
    label: "Проверяет «Историю вывода»",
    current: 1,
    total: maxPage,
    detail: `Страница 1 из ${maxPage}`
  });
  const firstIds = extractWithdrawIdsFromHtml(firstHtml);
  pagesChecked = 1;
  pushIds(firstIds);
  await persistMergedIdsProgress();

  if (firstIds.some(id => knownSet.has(id))) {
    stoppedOnKnown = true;
    firstKnownPage = 1;
  } else {
    newIds.push(...firstIds.filter(id => !knownSet.has(id)));
  }

  for (let page = 2; page <= maxPage; page++) {
    if (stoppedOnKnown && pagesAfterKnownRead >= pagesAfterKnownSafety) break;

    emitRefreshProgress({
      phase: "withdraw_history",
      label: "Проверяет «Историю вывода»",
      current: page,
      total: maxPage,
      detail: `Страница ${page} из ${maxPage}`
    });
    const html = await fetchWithdrawHistoryPage(page, baseUrl);
    const ids = extractWithdrawIdsFromHtml(html);
    pagesChecked += 1;
    pushIds(ids);
    await persistMergedIdsProgress();

    const pageHasKnown = ids.some(id => knownSet.has(id));
    if (!stoppedOnKnown && pageHasKnown) {
      stoppedOnKnown = true;
      firstKnownPage = page;
    }

    if (stoppedOnKnown) {
      pagesAfterKnownRead += 1;
    } else {
      newIds.push(...ids.filter(id => !knownSet.has(id)));
    }
  }

  for (const id of knownIds) {
    if (!mergedSet.has(id)) merged.push(id);
  }

  const dedupedNew = Array.from(new Set(newIds));
  const mergedIds = Array.from(new Set(merged));

  if (mergedIds.length) {
    await extApi.storage.local.set({ withdrawIds: mergedIds.join(", ") });
  }

  return {
    allIds: mergedIds,
    newIds: dedupedNew,
    stats: {
      knownCount: knownIds.length,
      totalAfterMerge: mergedIds.length,
      newCount: dedupedNew.length,
      pagesChecked,
      stoppedOnKnown,
      firstKnownPage
    }
  };
}
/* Remote data collection */
async function fetchPagedObjects(token, endpoint, opts = null) {
  const startedAt = Date.now();
  const pageSize = 100;
  let pageNumber = 1;
  let pagesFetched = 0;
  const out = [];

  while (true) {
    const json = await callEndpoint({ endpoint, token, pageSize, pageNumber, extraBody: opts?.extraBody || null, extraQuery: opts?.extraQuery || null });

    const objects =
      json?.data?.objects ||
      json?.data?.items ||
      json?.data?.rows ||
      json?.data ||
      [];

    const arr = Array.isArray(objects) ? objects : (Array.isArray(objects?.objects) ? objects.objects : []);
    pagesFetched += 1;
    out.push(...arr);

    if (arr.length < pageSize) break;
    pageNumber += 1;
    if (pageNumber > 5000) break;
  }

  return {
    objects: out,
    pagesFetched,
    timingMs: elapsedMs(startedAt)
  };
}

async function fetchIncomeObjectsIncremental(token) {
  const startedAt = Date.now();
  const cachedIncome = await getIncomeCache();
  const cachedKeyCounts = buildObjectKeyCountMap(cachedIncome, incomeObjectKey);
  const seenKeyCounts = new Map();
  const pageSize = 200;
  let pageNumber = 1;
  let pagesFetched = 0;
  let stoppedOnKnown = false;
  let firstKnownPage = null;
  const newObjects = [];
  const emitIncomePageProgress = (detail) => {
    emitRefreshProgress({
      phase: "income",
      label: "Загружает данные из «Списка продаж»",
      current: pageNumber,
      total: null,
      detail
    });
  };

  while (true) {
    emitIncomePageProgress(`Страница ${pageNumber}`);
    let json;
    try {
      json = await runWithWatchdog(() => callEndpoint({
          endpoint: "income",
          token,
          pageSize,
          pageNumber,
          onRecovering: ({ type, retryDelayMs, message, status }) => {
            const suffix = type === "rate_limit"
              ? `Лимит запросов (${status || 429}), повтор через ${formatEtaText(retryDelayMs)}`
              : `Плохая связь или сервер не отвечает, повтор через ${formatEtaText(retryDelayMs)}`;
            emitRefreshProgress({
              phase: "income_recovery",
              label: "Идёт восстановление соединения",
              current: pageNumber,
              total: null,
              detail: `Список продаж, страница ${pageNumber}. ${suffix}`
            });
            addDebugLog("warn", "income recovery status", {
              pageNumber,
              type,
              retryDelayMs,
              message: message || null
            });
          }
        }), {
        scope: "income page",
        timeoutMs: 65000,
        extra: { pageNumber },
        onTimeout: () => {
          emitRefreshProgress({
            phase: "income_watchdog",
            label: "Идёт восстановление соединения",
            current: pageNumber,
            total: null,
            detail: `Список продаж, страница ${pageNumber}, ответ слишком долго не приходит. Останавливаю попытку.`
          });
        }
      });
    } catch (e) {
      addDebugLog("error", "income page failed", {
        pageNumber,
        message: e?.message || String(e)
      });
      throw e;
    }
    const objects =
      json?.data?.objects ||
      json?.data?.items ||
      json?.data?.rows ||
      json?.data ||
      [];
    const arr = Array.isArray(objects) ? objects : (Array.isArray(objects?.objects) ? objects.objects : []);
    pagesFetched += 1;
    let pageNewCount = 0;

    for (const item of arr) {
      const key = incomeObjectKey(item);
      if (!key) {
        newObjects.push(item);
        pageNewCount += 1;
        continue;
      }
      const seenCount = (seenKeyCounts.get(key) || 0) + 1;
      seenKeyCounts.set(key, seenCount);
      if (seenCount <= (cachedKeyCounts.get(key) || 0)) {
        continue;
      }
      newObjects.push(item);
      pageNewCount += 1;
    }

    if (pageNewCount === 0 && cachedIncome.length) {
      stoppedOnKnown = true;
      firstKnownPage = pageNumber;
    }

    if (stoppedOnKnown || arr.length < pageSize) break;
    pageNumber += 1;
    if (pageNumber > 5000) break;
  }

  const mergedObjects = mergeObjectsByKeyMultiplicity(newObjects, cachedIncome, incomeObjectKey);
  if (newObjects.length || !cachedIncome.length) {
    await setIncomeCache(mergedObjects);
  }

  const cachedKeys = buildObjectKeyCountMap(cachedIncome, incomeObjectKey);
  const networkKeys = buildObjectKeyCountMap(newObjects, incomeObjectKey);

  return {
    objects: mergedObjects,
    pagesFetched,
    timingMs: elapsedMs(startedAt),
    sourceKeySets: {
      cache: cachedKeys,
      network: networkKeys
    },
    cacheStats: {
      cachedCount: cachedIncome.length,
      newCount: newObjects.length,
      totalAfterMerge: mergedObjects.length,
      stoppedOnKnown,
      firstKnownPage
    }
  };
}

/* Full remote collection pipeline */
function countObjectsByOrigin(objects, sourceKeySets) {
  const result = {
    total: Array.isArray(objects) ? objects.length : 0,
    cache: 0,
    network: 0,
    unknown: 0
  };
  const cacheKeys = sourceKeySets?.cache || new Map();
  const networkKeys = sourceKeySets?.network || new Map();

  for (const object of objects || []) {
    const key = incomeObjectKey(object);
    if (!key) {
      result.unknown += 1;
      continue;
    }
    const networkLeft = networkKeys.get(key) || 0;
    if (networkLeft > 0) {
      result.network += 1;
      if (networkLeft === 1) networkKeys.delete(key);
      else networkKeys.set(key, networkLeft - 1);
      continue;
    }
    const cacheLeft = cacheKeys.get(key) || 0;
    if (cacheLeft > 0) {
      result.cache += 1;
      if (cacheLeft === 1) cacheKeys.delete(key);
      else cacheKeys.set(key, cacheLeft - 1);
      continue;
    }
    result.unknown += 1;
  }

  return result;
}

async function fetchAllData(token) {
  const startedAt = Date.now();
  const preferredFrontendBaseUrl = await getPreferredFrontendBaseUrl();
  emitRefreshProgress({
    phase: "income",
    label: "Загружает данные из «Списка продаж»",
    current: 0,
    total: null,
    detail: "Подготавливает кэш продаж"
  });
  const income = await fetchIncomeObjectsIncremental(token);
  let withdrawIds = await getStoredWithdrawIds();
  let withdrawHistoryStats = {
    knownCount: withdrawIds.length,
    totalAfterMerge: withdrawIds.length,
    newCount: 0,
    pagesChecked: 0,
    stoppedOnKnown: false,
    firstKnownPage: null
  };

  try {
    const withdrawDiscovery = await detectWithdrawIdsIncremental(preferredFrontendBaseUrl);
    withdrawIds = withdrawDiscovery.allIds;
    withdrawHistoryStats = withdrawDiscovery.stats;
  } catch (e) {
    console.warn("withdraw_history incremental detect failed, using stored ids:", e);
  }

  let withdraw = {
    objects: [],
    pagesFetched: 0,
    error: null,
    timingMs: 0,
    perIdMs: {},
    sourceKeySets: {
      cache: new Set(),
      network: new Set()
    },
    cacheStats: { totalIds: withdrawIds.length, hits: 0, misses: 0, hitIds: [], missIds: [], newIdsDetected: withdrawHistoryStats.newCount }
  };

  if (withdrawIds.length) {
    const withdrawStartedAt = Date.now();
    const cachedById = await getWithdrawStatCache();
    const cachedObjects = [];
    const queue = [];
    let networkAbortError = null;
    let completedMisses = 0;
    let degradedToSingle = false;
    let recoveryAttempts = 0;
    let recoveryCooldownUntil = 0;
    let successStreakAfterRecovery = 0;
    const widAttempts = Object.create(null);
    const cacheStats = {
      totalIds: withdrawIds.length,
      hits: 0,
      misses: 0,
      hitIds: [],
      missIds: [],
      newIdsDetected: withdrawHistoryStats.newCount
    };

    for (const wid of withdrawIds) {
      const cachedEntry = cachedById?.[wid];
      if (cachedEntry && Array.isArray(cachedEntry.objects)) {
        cacheStats.hits += 1;
        cacheStats.hitIds.push(wid);
        cachedObjects.push(...cachedEntry.objects.map(o => ({ ...o, __withdrawId: wid })));
      } else {
        cacheStats.misses += 1;
        cacheStats.missIds.push(wid);
        queue.push(wid);
      }
    }
    const totalMissesCount = queue.length;

    const baseConcurrency = 2; // умеренный параллелизм: ускоряет загрузку, но не слишком давит API
    let currentConcurrency = baseConcurrency;

    function emitWithdrawProgress(detailOverride = null) {
      const avgMs = completedMisses > 0 ? (Date.now() - withdrawStartedAt) / completedMisses : 0;
      const left = Math.max(0, totalMissesCount - completedMisses);
      const etaMs = avgMs * left;
      emitRefreshProgress({
        phase: "withdraw_stat",
        label: detailOverride ? "Идёт восстановление соединения" : "Загружает данные из «Истории вывода»",
        current: completedMisses,
        total: totalMissesCount,
        detail: detailOverride || (
          left > 0
            ? `Обработано ${completedMisses} из ${totalMissesCount}, осталось ${formatEtaText(etaMs)}`
            : `Обработано ${completedMisses} из ${totalMissesCount}, завершаю сборку`
        )
      });
    }

    async function beginNetworkRecovery(wid, errorLike) {
      recoveryAttempts += 1;
      currentConcurrency = 1;
      degradedToSingle = true;
      successStreakAfterRecovery = 0;
      const waitMs = Math.min(7000, 1800 + (recoveryAttempts - 1) * 1400);
      recoveryCooldownUntil = Math.max(recoveryCooldownUntil, Date.now() + waitMs);
      addDebugLog("warn", "Network recovery started", {
        waitMs,
        wid,
        concurrency: currentConcurrency,
        message: errorLike?.message || String(errorLike)
      });
      emitWithdrawProgress(`Идёт восстановление соединения. Повторяю запросы, параллелизм снижен до ${currentConcurrency}.`);
      await sleep(waitMs);
    }

    async function worker(workerIndex) {
      const localAll = [];
      let localPages = 0;
      let localErr = "";
      const localPerIdMs = {};
      while (queue.length) {
        if (workerIndex >= currentConcurrency) {
          await sleep(220);
          continue;
        }
        if (Date.now() < recoveryCooldownUntil) {
          await sleep(Math.min(350, recoveryCooldownUntil - Date.now()));
          continue;
        }
        const wid = queue.shift();
        if (!wid) break;
        const widStartedAt = Date.now();
        let finishedWid = false;
        try {
          const r = await runWithWatchdog(() => fetchPagedObjects(token, "withdraw_stat", {
              extraBody: { transaction_withdraw_id: wid },
              extraQuery: { transaction_withdraw_id: wid }
            }), {
            scope: "withdraw_stat wid",
            timeoutMs: 120000,
            extra: { wid },
            onTimeout: () => {
              emitWithdrawProgress(`Идёт восстановление соединения. withdraw_stat отвечает слишком долго, повторяю запросы и снижаю параллелизм.`);
            }
          });
          localPages += r.pagesFetched;
          await setWithdrawStatCacheEntries({
            [wid]: { objects: r.objects, cachedAt: Date.now() }
          });
          localAll.push(...r.objects.map(o => ({ ...o, __withdrawId: wid })));
          finishedWid = true;
          delete widAttempts[wid];
          if (currentConcurrency < baseConcurrency) {
            successStreakAfterRecovery += 1;
            if (successStreakAfterRecovery >= 3) {
              currentConcurrency = baseConcurrency;
              successStreakAfterRecovery = 0;
              addDebugLog("info", "Network recovery stabilized, restoring concurrency", {
                concurrency: currentConcurrency
              });
            }
          }
        } catch (e) {
          if (isAuthTokenError(e)) throw e;
          if (isNetworkFetchError(e)) {
            widAttempts[wid] = (widAttempts[wid] || 0) + 1;
            console.warn("withdraw_stat network issue, attempting recovery:", wid, e);
            addDebugLog("warn", "withdraw_stat network issue", {
              wid,
              attempt: widAttempts[wid],
              message: e?.message || String(e)
            });
            if (widAttempts[wid] <= 2) {
              queue.unshift(wid);
              await beginNetworkRecovery(wid, e);
              continue;
            }
            networkAbortError = e;
            addDebugLog("error", "withdraw_stat recovery exhausted for wid", {
              wid,
              message: e?.message || String(e)
            });
          }
          console.warn("withdraw_stat wid failed:", wid, e);
          addDebugLog("warn", "withdraw_stat wid failed", {
            wid,
            message: e?.message || String(e)
          });
          localErr += `${wid}: ${e?.message || String(e)}\n`;
          finishedWid = true;
        } finally {
          if (finishedWid) {
            localPerIdMs[wid] = elapsedMs(widStartedAt);
            completedMisses += 1;
            emitWithdrawProgress();
          } else if (Date.now() < recoveryCooldownUntil) {
            emitWithdrawProgress(`Идёт восстановление соединения. Повторяю запросы, параллелизм снижен до ${currentConcurrency}.`);
          } else {
            emitWithdrawProgress();
          }
        }
      }
      return { localAll, localPages, localErr, localPerIdMs };
    }

    emitWithdrawProgress();
    const results = await Promise.all(Array.from({ length: baseConcurrency }, (_, index) => worker(index)));
    const fetchedAll = results.flatMap(r => r.localAll);
    const pages = results.reduce((s, r) => s + r.localPages, 0);
    const err = results.map(r => r.localErr).join("").trim();
    const perIdMs = Object.assign({}, ...results.map(r => r.localPerIdMs));
    const mergedWithdrawObjects = mergeObjectsByKeyMultiplicity(fetchedAll, cachedObjects, incomeObjectKey);
    const cachedKeys = buildObjectKeyCountMap(cachedObjects, incomeObjectKey);
    const networkKeys = buildObjectKeyCountMap(fetchedAll, incomeObjectKey);

    withdraw = {
      objects: mergedWithdrawObjects,
      pagesFetched: pages,
      error: networkAbortError
        ? `Не все данные withdraw_stat удалось восстановить после сетевого сбоя. Уже собранная часть сохранена в кэш.${degradedToSingle ? " Во время восстановления параллелизм был снижен." : ""}\n${err}`.trim()
        : (err || null),
      timingMs: elapsedMs(withdrawStartedAt),
      perIdMs,
      sourceKeySets: {
        cache: cachedKeys,
        network: networkKeys
      },
      cacheStats
    };
  } else {
    withdraw = {
      objects: [],
      pagesFetched: 0,
      error: "Не задан transaction_withdraw_id для withdraw_stat (нажми Токен → Авто-найти или вставь вручную).",
      timingMs: 0,
      perIdMs: {},
      sourceKeySets: {
        cache: new Set(),
        network: new Set()
      },
      cacheStats: { totalIds: 0, hits: 0, misses: 0, hitIds: [], missIds: [], newIdsDetected: 0 }
    };
  }

  const mergedSales = mergeSalesWithWithdrawPriority(income.objects, withdraw.objects);
  if (mergedSales.incomeOnly.length !== income.objects.length) {
    await setIncomeCache(mergedSales.incomeOnly);
  }

  const taggedIncome = mergedSales.incomeOnly.map(o => ({ ...o, __source: "income" }));
  const taggedWithdraw = mergedSales.withdrawOnly.map(o => ({ ...o, __source: "withdraw_stat" }));
  const incomeSources = countObjectsByOrigin(mergedSales.incomeOnly, income.sourceKeySets);
  const withdrawSources = countObjectsByOrigin(mergedSales.withdrawOnly, withdraw.sourceKeySets);
  const dataSources = {
    totalRows: mergedSales.combined.length,
    income: incomeSources,
    withdraw_stat: withdrawSources,
    cacheRows: incomeSources.cache + withdrawSources.cache,
    networkRows: incomeSources.network + withdrawSources.network,
    unknownRows: incomeSources.unknown + withdrawSources.unknown
  };

  let uploadedModelsTotal = null;
  try {
    uploadedModelsTotal = await fetchUploadedModelsCount(preferredFrontendBaseUrl);
  } catch (error) {
    addDebugLog("warn", "user/models count fetch failed", {
      frontendBaseUrl: preferredFrontendBaseUrl,
      message: error?.message || String(error)
    });
  }

  let authorProfile = null;
  try {
    authorProfile = await fetchAuthorProfile(preferredFrontendBaseUrl);
  } catch (error) {
    addDebugLog("warn", "user profile fetch failed", {
      frontendBaseUrl: preferredFrontendBaseUrl,
      message: error?.message || String(error)
    });
  }

  return {
    objects: [...taggedIncome, ...taggedWithdraw],
    pagesFetched: { income: income.pagesFetched, withdraw_stat: withdraw.pagesFetched },
    withdrawError: withdraw.error,
    timings: {
      totalMs: elapsedMs(startedAt),
      incomeMs: income.timingMs || 0,
      withdrawMs: withdraw.timingMs || 0,
      withdrawPerIdMs: withdraw.perIdMs || {}
    },
    apiStats: cloneApiStats(),
    cacheStats: {
      income: income.cacheStats,
      withdrawHistory: withdrawHistoryStats,
      withdrawStat: withdraw.cacheStats,
      merged: {
        incomeBeforeMerge: income.objects.length,
        incomeAfterMerge: mergedSales.incomeOnly.length,
        withdrawAfterMerge: mergedSales.withdrawOnly.length,
        combinedAfterMerge: mergedSales.combined.length
      },
      dataSources,
      uploadedModelsTotal
    },
    dataSources,
    newSalesCount: income.cacheStats?.newCount || 0,
    uploadedModelsTotal,
    authorProfile
  };
}

/* Dashboard shaping */
function buildDashboard(objects) {
  const now = Date.now();

  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d  = 7 * ms24h;
  const ms30d = 30 * ms24h;

  // "Сегодня" — с 00:00 по UTC+3
  const nowUtc = new Date(now);
  const nowMs = nowUtc.getTime();
  // Берём текущий момент, сдвигаем его в UTC+3 и уже по нему определяем границу московского дня.
  const nowMsk = toMskShiftedDate(nowMs);
  const startTodayUtc = new Date(Date.UTC(
    nowMsk.getUTCFullYear(),
    nowMsk.getUTCMonth(),
    nowMsk.getUTCDate(),
    0, 0, 0, 0
  ) - MSK_OFFSET_MS);
  const startPrevDayUtc = new Date(startTodayUtc.getTime() - ms24h);

  const windows = {
    today:  { start: startTodayUtc.getTime(), end: nowMs },
    prevDay:{ start: startPrevDayUtc.getTime(), end: startTodayUtc.getTime() },
    w7:     { start: nowMs - ms7d, end: nowMs },
    prev7:  { start: nowMs - 2 * ms7d, end: nowMs - ms7d },
    d30:    { start: nowMs - ms30d, end: nowMs },
    prev30: { start: nowMs - 2 * ms30d, end: nowMs - ms30d },
    h24:    { start: nowMs - ms24h, end: nowMs },
    prev24: { start: nowMs - 2 * ms24h, end: nowMs - ms24h },
    all:    { start: -Infinity, end: Infinity }
  };

  const sums = {
    today: 0, prevDay: 0,
    w7: 0, prev7: 0,
    d30: 0, prev30: 0,
    h24: 0, prev24: 0,
    all: 0
  };
  const counts = {
    h24: 0,
    w7: 0,
    d30: 0,
    all: 0,
};

  // charts
  const chart24 = new Map();   // hours
  const chart7 = new Map();    // days
  const chart30 = new Map();   // days
  const chartAll = new Map();  // months
  const chartOverview = new Map(); // all-time days
  const chartOverviewCount = new Map(); // all-time day counts
  let minDataTs = null;
  let maxDataTs = null;

  // top models maps for each window + prev window for delta
  const topMaps = {
    h24: { cur: new Map(), prev: new Map() },
    d7:  { cur: new Map(), prev: new Map() },
    d30: { cur: new Map(), prev: new Map() },
    all: { cur: new Map(), prev: new Map() } // prev unused
  };

  // prebuild label order for 24h (hour buckets) and days for 7/30
  const hoursOrder = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(nowMs - i * 3600 * 1000);
    hoursOrder.push(bucketHourKey(d));
  }
  const daysOrder7 = buildDayOrderFromWindow(windows.w7.start, nowMs);
  const daysOrder30 = buildDayOrderFromWindow(windows.d30.start, nowMs);

  for (const o of objects) {
    const sum = Number(o.royaltyAmount) || 0;
    const dt = parseDateUtcPlus3(o.date);
    if (!dt) continue;
    const t = dt.getTime();
    const slug = o.slug || "";
    const title = o.title || o.titleEn || slug || "(без названия)";
    const titleEn = o.titleEn || o.title || slug || "(untitled)";
    const img = o.firstImage || "";
    const regSite = o.regSite || "";

    // sums + counts
    sums.all += sum;
    counts.all += 1;

    if (t >= windows.today.start && t < windows.today.end) sums.today += sum;
    if (t >= windows.prevDay.start && t < windows.prevDay.end) sums.prevDay += sum;

    if (t >= windows.w7.start && t < windows.w7.end) { sums.w7 += sum; counts.w7 += 1; }
    if (t >= windows.prev7.start && t < windows.prev7.end) sums.prev7 += sum;

    if (t >= windows.d30.start && t < windows.d30.end) { sums.d30 += sum; counts.d30 += 1; }
    if (t >= windows.prev30.start && t < windows.prev30.end) sums.prev30 += sum;

    if (t >= windows.h24.start && t < windows.h24.end) { sums.h24 += sum; counts.h24 += 1; }
    if (t >= windows.prev24.start && t < windows.prev24.end) sums.prev24 += sum;

    // charts
    if (t >= windows.h24.start && t < windows.h24.end) incMap(chart24, bucketHourKey(dt), sum);
    if (t >= windows.w7.start && t < windows.w7.end) incMap(chart7, bucketDayLabel(dt), sum);
    if (t >= windows.d30.start && t < windows.d30.end) incMap(chart30, bucketDayLabel(dt), sum);
    incMap(chartAll, bucketMonthLabel(dt), sum);
    incMap(chartOverview, bucketDayLabel(dt), sum);
    incMap(chartOverviewCount, bucketDayLabel(dt), 1);
    if (minDataTs === null || t < minDataTs) minDataTs = t;
    if (maxDataTs === null || t > maxDataTs) maxDataTs = t;

    // top models
    const key = slug || title;
    if (t >= windows.h24.start && t < windows.h24.end) {
      const m = ensureModelAgg(topMaps.h24.cur, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }
    if (t >= windows.prev24.start && t < windows.prev24.end) {
      const m = ensureModelAgg(topMaps.h24.prev, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }

    if (t >= windows.w7.start && t < windows.w7.end) {
      const m = ensureModelAgg(topMaps.d7.cur, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }
    if (t >= windows.prev7.start && t < windows.prev7.end) {
      const m = ensureModelAgg(topMaps.d7.prev, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }

    if (t >= windows.d30.start && t < windows.d30.end) {
      const m = ensureModelAgg(topMaps.d30.cur, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }
    if (t >= windows.prev30.start && t < windows.prev30.end) {
      const m = ensureModelAgg(topMaps.d30.prev, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }

    {
      const m = ensureModelAgg(topMaps.all.cur, key, title, titleEn, slug, img, regSite);
      m.count += 1; m.sum += sum;
    }
  }

  // Cards
  const cards = {
    today: { sum: roundMoney(sums.today), deltaPct: pct(sums.today, sums.prevDay) },
    week:  { sum: roundMoney(sums.w7),    deltaPct: pct(sums.w7, sums.prev7) },
    month: { sum: roundMoney(sums.d30),   deltaPct: pct(sums.d30, sums.prev30) },
    top30: null
  };

  const top30 = topN(topMaps.d30.cur, 1)[0];
  if (top30) {
    cards.top30 = {
      title: top30.title,
      titleEn: top30.titleEn,
      slug: top30.slug,
      url: modelUrl(top30.slug),
      img: top30.img,
        count: top30.count,
        sum: roundMoney(top30.sum)
      };
  }

  // Charts output
  const charts = {
    "24h": finalizeChart(chart24, hoursOrder, (key) => key.slice(11)),
    "7d":  finalizeChart(chart7, daysOrder7),
    "30d": finalizeChart(chart30, daysOrder30),
    "all": finalizeChart(chartAll),
    "overview": (() => {
      if (minDataTs === null || maxDataTs === null) return { labels: [], values: [], counts: [] };
      const start = new Date(minDataTs);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(maxDataTs);
      end.setUTCHours(0, 0, 0, 0);
      const order = [];
      for (let ts = start.getTime(); ts <= end.getTime(); ts += ms24h) {
        order.push(bucketDayLabel(new Date(ts)));
      }
      const base = finalizeChart(chartOverview, order);
      return Object.assign({}, base, {
        counts: order.map((key) => Math.round(Number(chartOverviewCount.get(key) || 0)))
      });
    })()
  };

  // Top lists
  function buildTop(scaleKey, curMap, prevMapOrNull) {
    const top = topN(curMap, 5);
    const out = [];
    for (const m of top) {
      const prev = prevMapOrNull ? prevMapOrNull.get(m.slug || m.title) : null;
      const prevSum = prev ? prev.sum : 0;
      out.push({
        title: m.title,
        titleEn: m.titleEn,
        slug: m.slug,
        url: modelUrl(m.slug),
        img: m.img,
        count: m.count,
        sum: roundMoney(m.sum),
        deltaPct: pct(m.sum, prevSum)
      });
    }
    return out;
  }

  const top = {
    "24h": buildTop("24h", topMaps.h24.cur, topMaps.h24.prev),
    "7d":  buildTop("7d", topMaps.d7.cur, topMaps.d7.prev),
    "30d": buildTop("30d", topMaps.d30.cur, topMaps.d30.prev),
    "all": buildTop("all", topMaps.all.cur, null)
  };

// stats для UI (саммари под графиком + всего моделей)
const stats = {
  totalSalesAll: counts.all,           // ВСЕ продажи (все строки)
  uniqueModelsAll: topMaps.all.cur.size, // уникальные модели
  scales: {
    "24h": { count: counts.h24, sum: Math.round(sums.h24 * 100) / 100 },
    "7d":  { count: counts.w7,  sum: roundMoney(sums.w7) },
    "30d": { count: counts.d30, sum: roundMoney(sums.d30) },
    "all": { count: counts.all, sum: roundMoney(sums.all) }
  }
};

  return { cards, charts, top, stats };
}

/* Dashboard execution */
function validateDashboardConsistency(dash) {
  const warnings = [];
  const cards = dash?.cards || {};
  const stats = dash?.stats?.scales || {};
  const charts = dash?.charts || {};

  const chartSum = (scaleKey) => roundMoney((charts?.[scaleKey]?.values || []).reduce((sum, value) => sum + (Number(value) || 0), 0));

  if (!approximatelyEqual(cards?.week?.sum, stats?.["7d"]?.sum)) {
    warnings.push({
      code: "week_sum_mismatch",
      message: "Карточка за 7 дней расходится со stats.scales[7d]",
      card: roundMoney(cards?.week?.sum),
      stats: roundMoney(stats?.["7d"]?.sum)
    });
  }

  if (!approximatelyEqual(cards?.month?.sum, stats?.["30d"]?.sum)) {
    warnings.push({
      code: "month_sum_mismatch",
      message: "Карточка за 30 дней расходится со stats.scales[30d]",
      card: roundMoney(cards?.month?.sum),
      stats: roundMoney(stats?.["30d"]?.sum)
    });
  }

  for (const scaleKey of ["24h", "7d", "30d", "all"]) {
    const summed = roundMoney(chartSum(scaleKey));
    const statsSum = roundMoney(stats?.[scaleKey]?.sum);
    const epsilon = scaleKey === "all" ? 0.02 : 0.01;
    if (!approximatelyEqual(summed, statsSum, epsilon)) {
      warnings.push({
        code: `chart_${scaleKey}_sum_mismatch`,
        message: `Сумма графика ${scaleKey} расходится со stats.scales[${scaleKey}]`,
        chart: summed,
        stats: statsSum
      });
    }
  }

  return {
    ok: warnings.length === 0,
    warnings,
    checkedAt: Date.now()
  };
}

function buildTopBlockAudit(objects, dash) {
  const now = Date.now();
  const ms24h = 24 * 60 * 60 * 1000;
  const ms7d = 7 * ms24h;
  const ms30d = 30 * ms24h;
  const cards = dash?.cards || {};
  const top = dash?.top || {};
  const stats = dash?.stats || {};
  const overviewLabels = Array.isArray(dash?.charts?.overview?.labels) ? dash.charts.overview.labels : [];
  const overviewValues = Array.isArray(dash?.charts?.overview?.values) ? dash.charts.overview.values : [];

  const nowMsk = toMskShiftedDate(now);
  const startTodayUtc = new Date(Date.UTC(
    nowMsk.getUTCFullYear(),
    nowMsk.getUTCMonth(),
    nowMsk.getUTCDate(),
    0, 0, 0, 0
  ) - MSK_OFFSET_MS);
  const startPrevDayUtc = new Date(startTodayUtc.getTime() - ms24h);
  const currentYear = nowMsk.getUTCFullYear();
  const elapsedMonths = Math.max(1, nowMsk.getUTCMonth() + 1);
  const yearStartUtc = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0, 0) - MSK_OFFSET_MS);

  const sums = {
    today: 0, prevDay: 0,
    w7: 0, prev7: 0,
    d30: 0, prev30: 0,
    ytd: 0
  };
  const counts = {
    monthSales: 0,
    prevMonthSales: 0,
    site3ddd: 0,
    site3dsky: 0
  };
  const topMaps = {
    d7: { cur: new Map(), prev: new Map() },
    d30: { cur: new Map(), prev: new Map() }
  };

  for (const item of objects || []) {
    const dt = parseDateUtcPlus3(item?.date);
    if (!dt) continue;
    const time = dt.getTime();
    const sum = Number(item?.royaltyAmount || 0);
    const slug = item?.slug || "";
    const title = item?.title || item?.titleEn || slug || "(без названия)";
    const titleEn = item?.titleEn || item?.title || slug || "(untitled)";
    const img = item?.firstImage || "";
    const regSite = item?.regSite || "";
    const key = slug || title;

    if (time >= startTodayUtc.getTime() && time < now) sums.today += sum;
    else if (time >= startPrevDayUtc.getTime() && time < startTodayUtc.getTime()) sums.prevDay += sum;

    if (time >= now - ms7d && time < now) sums.w7 += sum;
    else if (time >= now - 2 * ms7d && time < now - ms7d) sums.prev7 += sum;

    if (time >= now - ms30d && time < now) {
      sums.d30 += sum;
      counts.monthSales += 1;
      if (detectSaleSite(item) === "3DSky") counts.site3dsky += 1;
      else counts.site3ddd += 1;
    } else if (time >= now - 2 * ms30d && time < now - ms30d) {
      sums.prev30 += sum;
      counts.prevMonthSales += 1;
    }

    if (time >= yearStartUtc.getTime()) sums.ytd += sum;

    if (time >= now - ms7d && time < now) {
      const model = ensureModelAgg(topMaps.d7.cur, key, title, titleEn, slug, img, regSite);
      model.count += 1;
      model.sum += sum;
    } else if (time >= now - 2 * ms7d && time < now - ms7d) {
      const model = ensureModelAgg(topMaps.d7.prev, key, title, titleEn, slug, img, regSite);
      model.count += 1;
      model.sum += sum;
    }

    if (time >= now - ms30d && time < now) {
      const model = ensureModelAgg(topMaps.d30.cur, key, title, titleEn, slug, img, regSite);
      model.count += 1;
      model.sum += sum;
    } else if (time >= now - 2 * ms30d && time < now - ms30d) {
      const model = ensureModelAgg(topMaps.d30.prev, key, title, titleEn, slug, img, regSite);
      model.count += 1;
      model.sum += sum;
    }
  }

  if (!(objects || []).length) {
    for (let i = 0; i < overviewLabels.length; i += 1) {
      const label = String(overviewLabels[i] || "");
      if (label.startsWith(`${currentYear}-`)) sums.ytd += Number(overviewValues[i] || 0);
    }
  }

  const siteTotal = Math.max(1, counts.site3ddd + counts.site3dsky);
  const site3dddPct = Math.round((counts.site3ddd / siteTotal) * 100);
  const site3dskyPct = 100 - site3dddPct;
  const top7Expected = topN(topMaps.d7.cur, 1)[0] || null;
  const top30Expected = topN(topMaps.d30.cur, 1)[0] || null;
  const rankExpected = (() => {
    const totalSales = Number(stats?.totalSalesAll || 0);
    const rankInfo = getCurrentAndNextRank(totalSales);
    return {
      totalSales,
      current: rankInfo.current,
      next: rankInfo.next,
      left: rankInfo.next ? Math.max(0, rankInfo.next.threshold - totalSales) : 0
    };
  })();

  const blocks = {
    today: {
      title: "Заработано сегодня",
      source: "dashboard-vs-raw",
      ok: approximatelyEqual(cards?.today?.sum, sums.today) &&
        approximatelyEqual(cards?.today?.deltaPct, pct(sums.today, sums.prevDay), 0.05),
      actual: {
        amount: roundMoney(cards?.today?.sum),
        deltaPct: roundMoney(cards?.today?.deltaPct)
      },
      expected: {
        amount: roundMoney(sums.today),
        deltaPct: roundMoney(pct(sums.today, sums.prevDay)),
        previousAmount: roundMoney(sums.prevDay)
      }
    },
    week_sales: {
      title: "Заработано за 7 дней",
      source: "dashboard-vs-raw",
      ok: approximatelyEqual(cards?.week?.sum, sums.w7) &&
        approximatelyEqual(cards?.week?.deltaPct, pct(sums.w7, sums.prev7), 0.05),
      actual: {
        amount: roundMoney(cards?.week?.sum),
        deltaPct: roundMoney(cards?.week?.deltaPct)
      },
      expected: {
        amount: roundMoney(sums.w7),
        deltaPct: roundMoney(pct(sums.w7, sums.prev7)),
        previousAmount: roundMoney(sums.prev7)
      }
    },
    month_sales: {
      title: "Заработано за 30 дней",
      source: "dashboard-vs-raw",
      ok: approximatelyEqual(cards?.month?.sum, sums.d30) &&
        approximatelyEqual(cards?.month?.deltaPct, pct(sums.d30, sums.prev30), 0.05),
      actual: {
        amount: roundMoney(cards?.month?.sum),
        deltaPct: roundMoney(cards?.month?.deltaPct)
      },
      expected: {
        amount: roundMoney(sums.d30),
        deltaPct: roundMoney(pct(sums.d30, sums.prev30)),
        previousAmount: roundMoney(sums.prev30)
      }
    },
    site_split: {
      title: "3DDD / 3DSky",
      source: "raw-sales",
      ok: Number(counts.monthSales) === Number(counts.site3ddd + counts.site3dsky) &&
        Number(site3dddPct + site3dskyPct) === 100,
      actual: {
        count: counts.monthSales,
        deltaPct: roundMoney(pct(counts.monthSales, counts.prevMonthSales)),
        dddCount: counts.site3ddd,
        skyCount: counts.site3dsky,
        dddPct: site3dddPct,
        skyPct: site3dskyPct
      },
      expected: {
        count: counts.monthSales,
        deltaPct: roundMoney(pct(counts.monthSales, counts.prevMonthSales)),
        previousCount: counts.prevMonthSales,
        dddCount: counts.site3ddd,
        skyCount: counts.site3dsky,
        dddPct: site3dddPct,
        skyPct: site3dskyPct
      }
    },
    top7: {
      title: "Топ модель за 7 дней",
      source: "dashboard-vs-raw",
      ok: (!top7Expected && !(top?.["7d"]?.[0])) || (
        String(top?.["7d"]?.[0]?.title || "") === String(top7Expected?.title || "") &&
        Number(top?.["7d"]?.[0]?.count || 0) === Number(top7Expected?.count || 0) &&
        approximatelyEqual(top?.["7d"]?.[0]?.sum, top7Expected?.sum)
      ),
      actual: top?.["7d"]?.[0]
        ? {
            title: String(top["7d"][0].title || ""),
            count: Number(top["7d"][0].count || 0),
            sum: roundMoney(top["7d"][0].sum)
          }
        : null,
      expected: top7Expected
        ? {
            title: String(top7Expected.title || ""),
            count: Number(top7Expected.count || 0),
            sum: roundMoney(top7Expected.sum)
          }
        : null
    },
    top30: {
      title: "Топ модель за 30 дней",
      source: "dashboard-vs-raw",
      ok: (!top30Expected && !(top?.["30d"]?.[0])) || (
        String(top?.["30d"]?.[0]?.title || "") === String(top30Expected?.title || "") &&
        Number(top?.["30d"]?.[0]?.count || 0) === Number(top30Expected?.count || 0) &&
        approximatelyEqual(top?.["30d"]?.[0]?.sum, top30Expected?.sum)
      ),
      actual: top?.["30d"]?.[0]
        ? {
            title: String(top["30d"][0].title || ""),
            count: Number(top["30d"][0].count || 0),
            sum: roundMoney(top["30d"][0].sum)
          }
        : null,
      expected: top30Expected
        ? {
            title: String(top30Expected.title || ""),
            count: Number(top30Expected.count || 0),
            sum: roundMoney(top30Expected.sum)
          }
        : null
    },
    year_total: {
      title: "Заработано с начала года",
      source: "raw-sales",
      ok: elapsedMonths >= 1 &&
        approximatelyEqual(roundMoney((sums.ytd / elapsedMonths) * elapsedMonths), roundMoney(sums.ytd), 0.05),
      actual: {
        amount: roundMoney(sums.ytd),
        avgMonth: roundMoney(sums.ytd / elapsedMonths),
        months: elapsedMonths
      },
      expected: {
        amount: roundMoney(sums.ytd),
        avgMonth: roundMoney(sums.ytd / elapsedMonths),
        months: elapsedMonths
      }
    },
    next_rank: {
      title: "Продаж до следующего уровня",
      source: "raw-sales",
      ok: !rankExpected.next || rankExpected.left === Math.max(0, rankExpected.next.threshold - rankExpected.totalSales),
      actual: {
        totalSales: rankExpected.totalSales,
        left: rankExpected.left,
        current: rankExpected.current?.title || null,
        next: rankExpected.next?.title || null
      },
      expected: {
        totalSales: rankExpected.totalSales,
        left: rankExpected.left,
        current: rankExpected.current?.title || null,
        next: rankExpected.next?.title || null
      }
    }
  };

  const warnings = Object.entries(blocks)
    .filter(([, block]) => !block.ok)
    .map(([key, block]) => ({
      code: `${key}_audit_mismatch`,
      title: block.title,
      actual: block.actual,
      expected: block.expected
    }));

  return {
    ok: warnings.length === 0,
    checkedAt: Date.now(),
    blocks,
    warnings
  };
}

function finalizeDashboardRun(allData, runStartedAt) {
  const dash = buildDashboard(allData.objects);
  const uploadedModelsTotal = Number(allData?.uploadedModelsTotal);
  if (Number.isFinite(uploadedModelsTotal) && uploadedModelsTotal >= 0) {
    dash.stats = Object.assign({}, dash.stats || {}, {
      uniqueModelsDerivedAll: Number(dash?.stats?.uniqueModelsAll || 0),
      uniqueModelsAll: uploadedModelsTotal
    });
  }
  const validation = validateDashboardConsistency(dash);
  const topBlockAudit = buildTopBlockAudit(allData.objects, dash);
  dash.meta = {
    pagesFetched: allData.pagesFetched,
    withdrawError: allData.withdrawError,
    timings: Object.assign({}, allData.timings, { runDashboardMs: elapsedMs(runStartedAt) }),
    apiStats: allData.apiStats,
    cacheStats: allData.cacheStats,
    dataSources: allData.dataSources || null,
    uploadedModelsTotal: Number.isFinite(uploadedModelsTotal) && uploadedModelsTotal >= 0 ? uploadedModelsTotal : null,
    validation,
    topBlockAudit,
    newSalesCount: allData.newSalesCount || 0,
    authorProfile: allData.authorProfile || null
  };
  if (!validation.ok) {
    addDebugLog("warn", "Dashboard validation warnings", {
      warnings: validation.warnings
    });
  }
  if (!topBlockAudit.ok) {
    addDebugLog("warn", "Top block audit warnings", {
      warnings: topBlockAudit.warnings
    });
  }
  emitRefreshProgress({
    phase: "done",
    label: "Обновление завершено",
    current: 1,
    total: 1,
    detail: `Новых продаж: ${dash.meta.newSalesCount || 0}`
  });
  console.info("runDashboard timings", dash.meta.timings);
  console.info("runDashboard apiStats", dash.meta.apiStats);
  console.info("runDashboard cacheStats", dash.meta.cacheStats);
  return dash;
}

async function runDashboard(mode) {
  const runStartedAt = Date.now();
  resetApiStats();
  emitRefreshProgress({
    phase: "prepare",
    label: "Подготавливает обновление",
    current: 0,
    total: null,
    detail: "Проверяет доступ к API"
  });
  // mode: "auto" | "manual" (manual = don't auto token refresh)
  let token = await getStoredToken();

  if (!token && mode !== "manual") {
    emitRefreshProgress({
      phase: "token",
      label: "Обновляет доступ к API",
      current: 0,
      total: null,
      detail: "Подхватывает новый токен"
    });
    token = await autoToken();
    await extApi.storage.local.set({ jwtToken: token });
  }

  if (!token) throw new Error("Не задан токен. Открой «Токен» и вставь JWT или нажми «Автоподхватить».");

  const loadDashboard = async (activeToken) => {
    const all = await fetchAllData(activeToken);
    return finalizeDashboardRun(all, runStartedAt);
  };

  try {
    return await loadDashboard(token);
  } catch (e) {
    if (isAuthTokenError(e) && mode !== "manual") {
      const newToken = await autoToken();
      await extApi.storage.local.set({ jwtToken: newToken });
      return await loadDashboard(newToken);
    }
    throw e;
  }
}

/* Runtime messaging */
async function ensureStoredJwtToken() {
  let token = await getStoredToken();
  if (token) return token;
  token = await autoToken();
  await extApi.storage.local.set({ jwtToken: token });
  return token;
}

function sendErrorResponse(sendResponse, errorLike) {
  sendResponse({ ok: false, error: errorLike?.message || String(errorLike) });
}

function respondAsync(sendResponse, task) {
  (async () => {
    try {
      sendResponse(await task());
    } catch (e) {
      sendErrorResponse(sendResponse, e);
    }
  })();
  return true;
}

function handleRuntimeMessage(msg, sendResponse) {
  switch (msg?.type) {
    case "AUTO_WITHDRAW_IDS":
      return respondAsync(sendResponse, async () => {
        const token = await ensureStoredJwtToken();
        const withdrawIds = await autoWithdrawIds(token);
        return { ok: true, withdrawIds };
      });

    case "AUTO_TOKEN":
      return respondAsync(sendResponse, async () => {
        const token = await autoToken();
        return { ok: true, token };
      });

    case "GET_CACHED":
      return respondAsync(sendResponse, async () => {
        const pack = await getCachedPack();
        return { ok: true, ...pack };
      });

    case "GET_CACHED_SALES_OBJECTS":
      return respondAsync(sendResponse, async () => {
        const data = await getCachedSalesPayload();
        return { ok: true, data };
      });

    case "GET_REFRESH_STATE":
      sendResponse({ ok: true, progress: getRefreshProgress() });
      return true;

    case "REFRESH_NOW":
      return respondAsync(sendResponse, async () => {
        const result = await refreshAndCache(msg?.mode || "auto", "popup");
        if (!result.ok) throw new Error(result.error || "Refresh failed");
        return { ok: true, dashboard: result.dashboard, updatedAt: result.updatedAt };
      });

    case "RUN_DASHBOARD":
      return respondAsync(sendResponse, async () => {
        const data = await runDashboard(msg?.mode || "auto");
        return { ok: true, data };
      });

    case "GET_DEBUG_INFO":
      return respondAsync(sendResponse, async () => {
        const data = await getDebugInfo();
        return { ok: true, data };
      });

    case "GET_LOCALIZED_MODEL_TITLE":
      return respondAsync(sendResponse, async () => {
        const slug = String(msg?.slug || "").trim();
        const language = msg?.language === "en" ? "en" : "ru";
        const title = await fetchLocalizedModelTitle(slug, language);
        return { ok: true, title };
      });

    default:
      return false;
  }
}

extApi.runtime.onMessage.addListener((msg, _sender, sendResponse) => handleRuntimeMessage(msg, sendResponse));

/* Passive token observation */
if (extApi.webRequest?.onBeforeSendHeaders) {
  extApi.webRequest.onBeforeSendHeaders.addListener(
    (details) => {
      try {
        const headers = details?.requestHeaders || [];
        const authHeader = headers.find((h) => String(h?.name || "").toLowerCase() === "authorization");
        if (!authHeader?.value) return;
        void storeObservedBearerToken(authHeader.value, `webRequest:${details.url}`).catch(() => {});
      } catch {}
    },
    {
      urls: [
        "https://3dsky.org/*",
        "https://users.3ddd.ru/api/*",
        "https://users.3dsky.org/api/*",
        "https://author-stats.3ddd.ru/*"
      ]
    },
    ["requestHeaders", "extraHeaders"]
  );
}

/* Cache & refresh orchestration */
const APP_DB = {
  name: "3dstat-db",
  version: 1,
  stores: {
    withdrawSalesByWid: "withdrawSalesByWid",
    meta: "meta"
  }
};

let appDbPromise = null;
let withdrawCacheMigrationPromise = null;

function getWithdrawStatEntryKey(wid) {
  return `cachedWithdrawStat:${String(wid || "").trim()}`;
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function idbTransactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted"));
  });
}

function openAppDb() {
  if (appDbPromise) return appDbPromise;
  appDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_DB.name, APP_DB.version);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(APP_DB.stores.withdrawSalesByWid)) {
        db.createObjectStore(APP_DB.stores.withdrawSalesByWid, { keyPath: "wid" });
      }
      if (!db.objectStoreNames.contains(APP_DB.stores.meta)) {
        db.createObjectStore(APP_DB.stores.meta, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  }).catch((error) => {
    appDbPromise = null;
    throw error;
  });
  return appDbPromise;
}

async function idbGetAllWithdrawEntries() {
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.withdrawSalesByWid, "readonly");
  const store = tx.objectStore(APP_DB.stores.withdrawSalesByWid);
  const rows = await idbRequest(store.getAll());
  await idbTransactionDone(tx);
  return Array.isArray(rows) ? rows : [];
}

async function idbPutWithdrawEntries(entriesMap) {
  const pairs = Object.entries(entriesMap || {});
  if (!pairs.length) return;
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.withdrawSalesByWid, "readwrite");
  const store = tx.objectStore(APP_DB.stores.withdrawSalesByWid);
  for (const [wid, entry] of pairs) {
    const safeWid = String(wid || "").trim();
    if (!safeWid) continue;
    store.put({
      wid: safeWid,
      cachedAt: Number(entry?.cachedAt || 0) || Date.now(),
      objects: compactSalesArray(entry?.objects)
    });
  }
  await idbTransactionDone(tx);
}

async function idbClearWithdrawEntries() {
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.withdrawSalesByWid, "readwrite");
  tx.objectStore(APP_DB.stores.withdrawSalesByWid).clear();
  await idbTransactionDone(tx);
}

async function idbCountWithdrawEntries() {
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.withdrawSalesByWid, "readonly");
  const store = tx.objectStore(APP_DB.stores.withdrawSalesByWid);
  const count = await idbRequest(store.count());
  await idbTransactionDone(tx);
  return Number(count || 0);
}

async function idbGetMetaValue(key) {
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.meta, "readonly");
  const store = tx.objectStore(APP_DB.stores.meta);
  const row = await idbRequest(store.get(String(key || "")));
  await idbTransactionDone(tx);
  return row?.value;
}

async function idbSetMetaValue(key, value) {
  const db = await openAppDb();
  const tx = db.transaction(APP_DB.stores.meta, "readwrite");
  const store = tx.objectStore(APP_DB.stores.meta);
  store.put({ key: String(key || ""), value });
  await idbTransactionDone(tx);
}

async function setWithdrawCacheStorageSignal(extra = {}) {
  await extApi.storage.local.set({
    [CACHE_KEYS.withdrawStatIndex]: Object.assign({
      version: 3,
      backend: "idb",
      updatedAt: Date.now()
    }, extra || {})
  });
}

async function resolveWithdrawStatStorageCache() {
  const stored = await extApi.storage.local.get([CACHE_KEYS.withdrawStatIndex, CACHE_KEYS.withdrawStatById]);
  const index = stored?.[CACHE_KEYS.withdrawStatIndex];
  if (index?.version === 2 && Array.isArray(index?.wids) && index.wids.length) {
    const entryKeys = index.wids
      .map((wid) => String(wid || "").trim())
      .filter(Boolean)
      .map(getWithdrawStatEntryKey);
    const entries = entryKeys.length ? await extApi.storage.local.get(entryKeys) : {};
    const out = {};
    for (const wid of index.wids) {
      const safeWid = String(wid || "").trim();
      if (!safeWid) continue;
      const entry = entries?.[getWithdrawStatEntryKey(safeWid)];
      if (!entry || typeof entry !== "object") continue;
      out[safeWid] = {
        objects: compactSalesArray(entry?.objects),
        cachedAt: Number(entry?.cachedAt || 0) || Date.now()
      };
    }
    return { cacheMap: out, storedIndex: index };
  }
  const raw = stored?.[CACHE_KEYS.withdrawStatById];
  return {
    cacheMap: raw && typeof raw === "object" ? compactWithdrawCacheMap(raw) : {},
    storedIndex: index || null
  };
}

async function cleanupWithdrawStatStorageCache(storedIndex = null) {
  const keysToRemove = [CACHE_KEYS.withdrawStatById];
  if (storedIndex?.version === 2 && Array.isArray(storedIndex?.wids) && storedIndex.wids.length) {
    for (const wid of storedIndex.wids) {
      const safeWid = String(wid || "").trim();
      if (!safeWid) continue;
      keysToRemove.push(getWithdrawStatEntryKey(safeWid));
    }
  }
  keysToRemove.push(CACHE_KEYS.withdrawStatIndex);
  await extApi.storage.local.remove(Array.from(new Set(keysToRemove)));
}

async function ensureWithdrawCacheMigratedToIndexedDb() {
  if (withdrawCacheMigrationPromise) return withdrawCacheMigrationPromise;
  withdrawCacheMigrationPromise = (async () => {
    const currentCount = await idbCountWithdrawEntries();
    const { cacheMap, storedIndex } = await resolveWithdrawStatStorageCache();
    const hasLocalCache = Object.keys(cacheMap || {}).length > 0;
    if (currentCount > 0) {
      if (hasLocalCache || storedIndex?.version === 2) {
        await cleanupWithdrawStatStorageCache(storedIndex);
        await setWithdrawCacheStorageSignal({ migrated: true });
      }
      return;
    }
    if (!hasLocalCache) return;
    await idbPutWithdrawEntries(cacheMap);
    await idbSetMetaValue("withdrawCacheMigratedAt", Date.now());
    await cleanupWithdrawStatStorageCache(storedIndex);
    await setWithdrawCacheStorageSignal({
      migrated: true,
      widCount: Object.keys(cacheMap).length
    });
  })().finally(() => {
    withdrawCacheMigrationPromise = null;
  });
  return withdrawCacheMigrationPromise;
}

/* Cache storage helpers */
async function getCachedPack() {
  const v = await extApi.storage.local.get([CACHE_KEYS.dash, CACHE_KEYS.updatedAt, CACHE_KEYS.lastError]);
  return {
    dashboard: v?.[CACHE_KEYS.dash] || null,
    updatedAt: v?.[CACHE_KEYS.updatedAt] || null,
    lastError: v?.[CACHE_KEYS.lastError] || null
  };
}

async function setCachedPack({ dashboard, updatedAt, lastError }) {
  const obj = {};
  if (dashboard !== undefined) obj[CACHE_KEYS.dash] = dashboard;
  if (updatedAt !== undefined) obj[CACHE_KEYS.updatedAt] = updatedAt;
  if (lastError !== undefined) obj[CACHE_KEYS.lastError] = lastError;
  await extApi.storage.local.set(obj);
}

async function getWithdrawStatCache() {
  try {
    await ensureWithdrawCacheMigratedToIndexedDb();
    const rows = await idbGetAllWithdrawEntries();
    const out = {};
    for (const row of rows) {
      const safeWid = String(row?.wid || "").trim();
      if (!safeWid) continue;
      out[safeWid] = {
        objects: compactSalesArray(row?.objects),
        cachedAt: Number(row?.cachedAt || 0) || Date.now()
      };
    }
    if (Object.keys(out).length) return out;
  } catch (error) {
    addDebugLog("warn", "IndexedDB withdraw cache read failed, falling back to storage.local", {
      message: error?.message || String(error)
    });
  }

  const { cacheMap } = await resolveWithdrawStatStorageCache();
  return compactWithdrawCacheMap(cacheMap);
}

async function writeWithdrawStatCacheV2(cacheMap) {
  const normalizedCache = compactWithdrawCacheMap(cacheMap);
  const payload = {
    [CACHE_KEYS.withdrawStatIndex]: {
      version: 2,
      wids: Object.keys(normalizedCache),
      updatedAt: Date.now()
    }
  };
  for (const [wid, entry] of Object.entries(normalizedCache)) {
    payload[getWithdrawStatEntryKey(wid)] = {
      wid,
      cachedAt: Number(entry?.cachedAt || 0) || Date.now(),
      objects: compactSalesArray(entry?.objects)
    };
  }
  await extApi.storage.local.set(payload);
  return normalizedCache;
}

async function getIncomeCache() {
  const v = await extApi.storage.local.get([CACHE_KEYS.incomeObjects]);
  const raw = v?.[CACHE_KEYS.incomeObjects];
  return Array.isArray(raw) ? raw : [];
}

async function setIncomeCache(objects) {
  await extApi.storage.local.set({
    [CACHE_KEYS.incomeObjects]: Array.isArray(objects) ? objects : []
  });
}

async function getCachedSalesPayload() {
  const incomeObjects = await getIncomeCache();
  const withdrawById = await getWithdrawStatCache();
  const withdrawObjects = Object.values(withdrawById)
    .flatMap((entry) => Array.isArray(entry?.objects) ? entry.objects : []);
  const merged = mergeSalesWithWithdrawPriority(incomeObjects, withdrawObjects);
  return {
    incomeObjects,
    withdrawObjects,
    combinedObjects: merged.combined
  };
}

async function setWithdrawStatCacheEntries(entries) {
  if (!entries || !Object.keys(entries).length) return;
  const normalizedEntries = compactWithdrawCacheMap(entries);
  try {
    await ensureWithdrawCacheMigratedToIndexedDb();
    await idbPutWithdrawEntries(normalizedEntries);
    await idbSetMetaValue("withdrawCacheLastWriteAt", Date.now());
    await setWithdrawCacheStorageSignal();
    return;
  } catch (error) {
    addDebugLog("warn", "IndexedDB withdraw cache write failed, falling back to storage.local", {
      message: error?.message || String(error)
    });
  }

  const stored = await extApi.storage.local.get([CACHE_KEYS.withdrawStatIndex, CACHE_KEYS.withdrawStatById]);
  const hasV2Index = stored?.[CACHE_KEYS.withdrawStatIndex]?.version === 2;
  const legacyCache = stored?.[CACHE_KEYS.withdrawStatById] && typeof stored[CACHE_KEYS.withdrawStatById] === "object"
    ? compactWithdrawCacheMap(stored[CACHE_KEYS.withdrawStatById])
    : {};
  const current = compactWithdrawCacheMap(await resolveWithdrawStatStorageCache().then((result) => result.cacheMap));
  const merged = Object.assign({}, current, normalizedEntries);
  const needsFullMigration = !hasV2Index && Object.keys(legacyCache).length > 0;
  if (needsFullMigration) {
    await writeWithdrawStatCacheV2(merged);
    await extApi.storage.local.remove([CACHE_KEYS.withdrawStatById]);
    return;
  }

  const payload = {
    [CACHE_KEYS.withdrawStatIndex]: {
      version: 2,
      wids: Object.keys(merged),
      updatedAt: Date.now()
    }
  };
  for (const [wid, entry] of Object.entries(normalizedEntries)) {
    payload[getWithdrawStatEntryKey(wid)] = {
      wid,
      cachedAt: Number(entry?.cachedAt || 0) || Date.now(),
      objects: compactSalesArray(entry?.objects)
    };
  }
  await extApi.storage.local.set(payload);
  if (stored?.[CACHE_KEYS.withdrawStatById]) {
    await extApi.storage.local.remove([CACHE_KEYS.withdrawStatById]);
  }
}

async function refreshAndCache(mode = "auto", reason = "manual") {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      addDebugLog("info", "Refresh started", { mode, reason });
      const dash = await runDashboard(mode);
      const now = Date.now();

      dash.meta = Object.assign({}, dash.meta || {}, { cached: true, refreshReason: reason });

      await setCachedPack({ dashboard: dash, updatedAt: now, lastError: null });
      addDebugLog("info", "Refresh completed", {
        mode,
        reason,
        updatedAt: now,
        newSalesCount: dash?.meta?.newSalesCount || 0
      });
      return { ok: true, dashboard: dash, updatedAt: now, lastError: null };
    } catch (e) {
      const msg = e?.message || String(e);
      addDebugLog("error", "Refresh failed", { mode, reason, message: msg });
      emitRefreshProgress({
        phase: "error",
        label: "Ошибка обновления",
        current: 0,
        total: null,
        detail: msg
      });
      await setCachedPack({ lastError: msg });
      return { ok: false, error: msg };
    } finally {
      refreshInFlight = null;
      setTimeout(() => clearRefreshProgress(), 1500);
    }
  })();

  return refreshInFlight;
}
