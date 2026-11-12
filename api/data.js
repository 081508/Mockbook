// Vercel serverless function: GET /api/data?watch=nba,nfl
// Returns upcoming and in-play games with odds, plus live and final scores.
// Data comes from The Odds API (https://the-odds-api.com). The key stays on the server.

const LEAGUES = {
  nba: { key: "basketball_nba", sport: "nba", label: "NBA" },
  nfl: { key: "americanfootball_nfl", sport: "nfl", label: "NFL" },
  cbb: { key: "basketball_ncaab", sport: "cbb", label: "CBB" },
  cfb: { key: "americanfootball_ncaaf", sport: "cfb", label: "CFB" },
  epl: { key: "soccer_epl", sport: "soccer", label: "Premier League" },
  laliga: { key: "soccer_spain_la_liga", sport: "soccer", label: "La Liga" },
  seriea: { key: "soccer_italy_serie_a", sport: "soccer", label: "Serie A" },
  bundesliga: { key: "soccer_germany_bundesliga", sport: "soccer", label: "Bundesliga" },
  ligue1: { key: "soccer_france_ligue_one", sport: "soccer", label: "Ligue 1" },
  mls: { key: "soccer_usa_mls", sport: "soccer", label: "MLS" },
  ucl: { key: "soccer_uefa_champs_league", sport: "soccer", label: "Champions League" },
};
// Set LEAGUES=nba,nfl,epl on the server to limit which leagues are fetched (saves API credits).
const picked = (process.env.LEAGUES || "").split(",").map((s) => s.trim()).filter((k) => LEAGUES[k]);
const ACTIVE = picked.length ? picked : Object.keys(LEAGUES);
const PREFERRED_BOOKS = ["draftkings", "fanduel", "betmgm", "caesars", "espnbet", "williamhill_us"];
const BASE = "https://api.the-odds-api.com/v4/sports";
const ODDS_TTL = Number(process.env.ODDS_TTL_SECONDS || 1800) * 1000;  // refresh odds every 30 min
const SCORES_TTL = Number(process.env.SCORES_TTL_SECONDS || 60) * 1000; // refresh scores every 60 s

const cache = new Map();
async function cached(key, ttl, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttl) return hit.v;
  try {
    const v = await load();
    cache.set(key, { t: Date.now(), v });
    return v;
  } catch (err) {
    if (hit) return hit.v; // serve stale data rather than failing
    throw err;
  }
}

async function api(path, params) {
  const url = new URL(BASE + path);
  url.search = new URLSearchParams({ apiKey: process.env.ODDS_API_KEY, ...params }).toString();
  const res = await fetch(url);
  if (res.status === 404) return []; // league not in season
  if (!res.ok) throw new Error(`Odds API ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

function outcomes(event, marketKey) {
  const books = [
    ...PREFERRED_BOOKS.map((k) => event.bookmakers.find((b) => b.key === k)).filter(Boolean),
    ...event.bookmakers,
  ];
  for (const b of books) {
    const m = b.markets.find((x) => x.key === marketKey);
    if (m) return m.outcomes;
  }
  return null;
}

function normalizeGame(ev, lg) {
  const home = ev.home_team, away = ev.away_team;
  const game = { id: ev.id, sport: LEAGUES[lg].sport, lg, label: LEAGUES[lg].label, home, away, ko: Date.parse(ev.commence_time) };
  const ml = outcomes(ev, "h2h");
  if (ml) {
    const h = ml.find((o) => o.name === home), a = ml.find((o) => o.name === away);
    if (h && a) {
      game.ml = { home: h.price, away: a.price };
      const d = ml.find((o) => o.name === "Draw"); // soccer is a 3-way market
      if (d) game.ml.draw = d.price;
    }
  }
  const sp = outcomes(ev, "spreads");
  if (sp) {
    const h = sp.find((o) => o.name === home), a = sp.find((o) => o.name === away);
    if (h && a && typeof h.point === "number") game.sp = { line: h.point, home: h.price, away: a.price };
  }
  const tot = outcomes(ev, "totals");
  if (tot) {
    const o = tot.find((x) => x.name === "Over"), u = tot.find((x) => x.name === "Under");
    if (o && u && typeof o.point === "number") game.tot = { line: o.point, over: o.price, under: u.price };
  }
  return game;
}

function normalizeScore(ev, sport) {
  if (!ev.scores) return null;
  const h = ev.scores.find((s) => s.name === ev.home_team), a = ev.scores.find((s) => s.name === ev.away_team);
  if (!h || !a) return null;
  return { id: ev.id, sport, home: ev.home_team, away: ev.away_team, h: Number(h.score), a: Number(a.score), completed: !!ev.completed };
}

module.exports = async (req, res) => {
  if (!process.env.ODDS_API_KEY) {
    return res.status(503).json({ error: "ODDS_API_KEY is not set on the server." });
  }
  const watch = String(req.query.watch || "").split(",").filter((k) => ACTIVE.includes(k));
  const errors = [];
  try {
    const keys = ACTIVE;
    const oddsRuns = await Promise.allSettled(
      keys.map((k) =>
        cached("odds:" + k, ODDS_TTL, () =>
          api(`/${LEAGUES[k].key}/odds`, { regions: "us", markets: "h2h,spreads,totals", oddsFormat: "american" })
        ).then((list) => list.map((e) => normalizeGame(e, k)))
      )
    );
    const games = [];
    oddsRuns.forEach((r, i) => (r.status === "fulfilled" ? games.push(...r.value) : errors.push(keys[i] + ": " + r.reason.message)));

    // Only spend score requests on sports that have a game in progress or a pending bet.
    const now = Date.now();
    const scoreSports = new Set([...watch, ...games.filter((g) => g.ko <= now).map((g) => g.lg)]);
    const scores = {};
    const scoreRuns = await Promise.allSettled(
      [...scoreSports].map((k) =>
        cached("scores:" + k, SCORES_TTL, () => api(`/${LEAGUES[k].key}/scores`, { daysFrom: 3 })).then((list) =>
          list.map((e) => normalizeScore(e, k)).filter(Boolean)
        )
      )
    );
    scoreRuns.forEach((r, i) => {
      if (r.status === "fulfilled") r.value.forEach((s) => (scores[s.id] = s));
      else errors.push([...scoreSports][i] + ": " + r.reason.message);
    });

    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(200).json({ updatedAt: Date.now(), games, scores, errors });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
