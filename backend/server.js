require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");

const app = express();

const GITHUB_USER = process.env.GITHUB_USER || "Sajedur0";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || "";
const CACHE_TTL = parseInt(process.env.CACHE_TTL || "60", 10);
const MAX_PAGES = 10;
const REQUEST_TIMEOUT = 20000;
const START_TIME = Date.now();

const sseClients = new Set();

function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

app.use(helmet());
app.use(compression());
app.use(morgan("short"));
app.use(cors({ origin: /./, methods: ["GET", "POST"] }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, try again later" },
});
app.use("/api/", limiter);

const ghHeaders = {
  Accept: "application/vnd.github.v3+json",
  "User-Agent": "Sajedur0-Portfolio",
};
if (GITHUB_TOKEN) ghHeaders.Authorization = `token ${GITHUB_TOKEN}`;

const cache = {
  repos: null,
  count: 0,
  ts: 0,
  etag: null,
  lastStatus: "pending",
  lastError: null,
  refreshing: false,
  fetchCount: 0,
  lastFetchDuration: 0,
};

function cacheGet() {
  if (cache.repos !== null && Date.now() - cache.ts < CACHE_TTL * 1000) {
    return { repos: cache.repos, count: cache.count };
  }
  return { repos: null, count: 0 };
}

function cacheSet(repos, etag, status, error) {
  cache.repos = repos;
  cache.count = repos.length;
  cache.ts = Date.now();
  if (etag !== undefined) cache.etag = etag;
  if (status !== undefined) cache.lastStatus = status;
  if (error !== undefined) cache.lastError = error;
}

async function fetchWithRetry(url, options, retries = 2, delay = 1000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      if (attempt < retries) {
        console.warn(`Attempt ${attempt + 1} failed for ${url}: ${e.message}. Retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        delay *= 2;
      } else {
        throw e;
      }
    }
  }
}

async function doFetch() {
  const fetchStart = Date.now();
  const headers = { ...ghHeaders };
  if (cache.etag) headers["If-None-Match"] = cache.etag;

  let page = 1;
  let allRepos = [];
  let newEtag = null;

  while (page <= MAX_PAGES) {
    const url = `https://api.github.com/users/${GITHUB_USER}/repos?sort=updated&per_page=100&page=${page}`;
    let res;
    try {
      res = await fetchWithRetry(url, { headers });
    } catch (e) {
      console.warn(`Connection failed on page ${page} after retries: ${e.message}`);
      break;
    }

    if (res.status === 304) {
      cacheSet(cache.repos, cache.etag, "ok");
      cache.lastFetchDuration = Date.now() - fetchStart;
      console.log("304 Not Modified — serving cached data");
      return { repos: cache.repos, count: cache.count };
    }
    if (res.status === 403) {
      const retryAfter = res.headers.get("Retry-After") || "?";
      console.warn(`Rate limited. Retry-After: ${retryAfter}s`);
      cacheSet(cache.repos || [], cache.etag, "rate_limited");
      break;
    }
    if (res.status === 401) {
      console.error("Invalid GITHUB_TOKEN");
      cacheSet(cache.repos || [], undefined, "auth_error");
      break;
    }
    if (res.status !== 200) {
      console.warn(`GitHub API ${res.status} on page ${page}`);
      break;
    }

    if (!newEtag) newEtag = res.headers.get("etag");

    let data;
    try {
      data = await res.json();
    } catch {
      console.warn(`Invalid JSON on page ${page}`);
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;

    allRepos = allRepos.concat(data);
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining) console.log(`Rate limit remaining: ${remaining}`);

    if (data.length < 100) break;
    page++;
  }

  cache.lastFetchDuration = Date.now() - fetchStart;

  if (allRepos.length > 0) {
    cacheSet(allRepos, newEtag, "ok");
    cache.fetchCount++;
    console.log(`Fetched ${allRepos.length} repos (pages: ${page}) in ${cache.lastFetchDuration}ms`);
    return { repos: allRepos, count: allRepos.length };
  }

  if (cache.repos) {
    console.log(`Serving ${cache.repos.length} stale repos after API error`);
    cacheSet(cache.repos, cache.etag, "stale", "fetch_failed");
    return { repos: cache.repos, count: cache.count };
  }

  cacheSet([], undefined, "empty");
  return { repos: [], count: 0 };
}

async function fetchRepos() {
  const cached = cacheGet();
  if (cached.repos !== null) return cached;

  if (cache.refreshing) {
    await new Promise((r) => setTimeout(r, 1000));
    const c = cacheGet();
    return c.repos !== null ? c : { repos: [], count: 0 };
  }

  cache.refreshing = true;
  try {
    return await doFetch();
  } finally {
    cache.refreshing = false;
  }
}

setInterval(
  async () => {
    try {
      await fetchRepos();
      console.log("Background refresh done");
    } catch (e) {
      console.error("Background refresh failed:", e.message);
    }
  },
  Math.max((CACHE_TTL - 30) * 1000, 60000)
);

app.get("/api/repos", async (req, res) => {
  try {
    const { repos, count } = await fetchRepos();
    const result = repos.map((r) => ({
      name: r.name || "",
      description: r.description || "No description available.",
      language: r.language || "N/A",
      html_url: r.html_url || "",
      stars: r.stargazers_count || 0,
      forks: r.forks_count || 0,
    }));
    res.set("Cache-Control", "public, max-age=60");
    res.json({ count, repos: result });
  } catch (e) {
    console.error("Error in /api/repos:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/repos/count", async (req, res) => {
  try {
    const { count } = await fetchRepos();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ count });
  } catch (e) {
    console.error("Error in /api/repos/count:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

async function forceRefresh() {
  cache.repos = null;
  cache.ts = 0;
  const result = await fetchRepos();
  const mapped = result.repos.map((r) => ({
    name: r.name || "",
    description: r.description || "No description available.",
    language: r.language || "N/A",
    html_url: r.html_url || "",
    stars: r.stargazers_count || 0,
    forks: r.forks_count || 0,
  }));
  broadcastSSE("repos-updated", { count: result.count, repos: mapped });
  return result;
}

app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const event = req.headers["x-github-event"];
  const delivery = req.headers["x-github-delivery"];
  console.log(`Webhook received: event=${event} delivery=${delivery}`);

  if (WEBHOOK_SECRET) {
    const sig = req.headers["x-hub-signature-256"];
    if (!sig) return res.status(401).json({ error: "Missing signature" });
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(req.body);
    const expected = `sha256=${hmac.digest("hex")}`;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      console.warn("Webhook signature mismatch");
      return res.status(401).json({ error: "Invalid signature" });
    }
  }

  res.status(200).json({ ok: true });

  try {
    let payload;
    try { payload = JSON.parse(req.body.toString()); } catch { return; }

    const action = payload.action;
    const repoName = payload.repository?.full_name;

    if (event === "ping") {
      console.log(`Ping received for ${repoName}`);
      return;
    }

    if (event === "repository" && ["created", "deleted", "renamed"].includes(action)) {
      console.log(`Repo ${action}: ${repoName} — refreshing cache`);
      await forceRefresh();
    } else if (event === "push") {
      console.log(`Push to ${repoName} — refreshing cache`);
      await forceRefresh();
    }
  } catch (e) {
    console.error("Webhook processing error:", e.message);
  }
});

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write("event: connected\ndata: {}\n\n");

  sseClients.add(res);
  console.log(`SSE client connected (total: ${sseClients.size})`);

  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 30000);

  req.on("close", () => {
    sseClients.delete(res);
    clearInterval(keepAlive);
    console.log(`SSE client disconnected (total: ${sseClients.size})`);
  });
});

app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "ok",
    uptime: Math.floor((Date.now() - START_TIME) / 1000),
    pid: process.pid,
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heap_used: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
      heap_total: `${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
    },
    cache: {
      fresh: cache.repos !== null && Date.now() - cache.ts < CACHE_TTL * 1000,
      age_seconds: cache.ts ? Math.floor((Date.now() - cache.ts) / 1000) : -1,
      ttl: CACHE_TTL,
      repos: cache.count,
      fetch_count: cache.fetchCount,
      last_fetch_ms: cache.lastFetchDuration,
    },
    github: {
      user: GITHUB_USER,
      token_set: !!GITHUB_TOKEN,
      webhook_secret_set: !!WEBHOOK_SECRET,
      last_status: cache.lastStatus,
      last_error: cache.lastError,
    },
    sse: {
      clients: sseClients.size,
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Worker ${process.pid} running on http://0.0.0.0:${PORT}`);
    fetchRepos();
  });

  function gracefulShutdown(signal) {
    console.log(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log("Server closed.");
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    process.exit(1);
  });
}

module.exports = app;
