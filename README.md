# Mockbook

A mock sportsbook with virtual money. It lists real upcoming NBA, NFL, college basketball,
college football and soccer games with real odds, locks betting at kickoff, and settles your bets
automatically from real final scores. The page polls the server every 30 seconds.

## How it works

- `public/index.html`: the app. Your bankroll, bets and history are saved in your browser.
- `api/data.js`: a serverless function that calls The Odds API and returns games, odds, and
  live and final scores. Your API key lives only on the server.

## Deploy (about 5 minutes)

1. Get a free API key at https://the-odds-api.com.
2. Put this folder in a new GitHub repository, then import it at https://vercel.com/new.
   (Or run `npx vercel` in this folder.)
3. In Vercel, open Project Settings, then Environment Variables, and add `ODDS_API_KEY`.
4. Redeploy. Open the site. The header should show "Live feed".

To run locally: `npx vercel dev` with a `.env` file copied from `.env.example`.

## Leagues

NBA, NFL, college basketball (CBB), college football (CFB), and soccer: Premier League, La Liga,
Serie A, Bundesliga, Ligue 1, MLS and the Champions League. Soccer uses a 3-way moneyline
(home, draw, away). Spreads and totals can land exactly on the line, which is a push: a single
bet is refunded, and a parlay leg that pushes is dropped from the parlay.

To fetch fewer leagues, set `LEAGUES` on the server, for example `LEAGUES=nba,nfl,epl`.
Valid ids: nba, nfl, cbb, cfb, epl, laliga, seriea, bundesliga, ligue1, mls, ucl.
Leagues that are out of season return no games and cost nothing to show.

## API usage and cost

The free Odds API plan includes 500 credits per month. Each league's odds request costs 3 credits
(one region, three markets) and each scores request costs 2. Defaults to protect your quota:

- Odds are cached for 30 minutes (`ODDS_TTL_SECONDS`).
- Scores are fetched only for leagues that have a game in progress or a pending bet,
  and cached for 60 seconds (`SCORES_TTL_SECONDS`).
- Responses are also cached at the edge for 30 seconds, so many visitors share one fetch.
- The function only calls the API when someone loads the page, so an unused site spends nothing.

With all 11 leagues and a 30-minute odds cache, an all-day open site uses about 1,500 odds
credits per day. That is far beyond the free plan. Ways to cut it: pick only the leagues you
care about with `LEAGUES`, and raise `ODDS_TTL_SECONDS` (for example 3600). Four leagues at one hour
use about 290 credits per day. For continuous use of everything, choose a paid plan.

## Notes

- Bets on a game that never receives a final score are voided and refunded after 4 days.
- Scores come from The Odds API, which keeps three days of history.
- Odds are the best available from DraftKings, FanDuel, BetMGM and others, in that order.
- Spreads and totals depend on what the API returns for each game. Missing markets show a dash.
