# Hosting Mockbook on Vercel (free)

Mockbook needs a host that can run its small server function (`api/data.js`). Opening
`index.html` from your computer will not work and shows "HTTP 404". Follow these steps.

## 1. Unzip the project
Unzip `mockbook.zip`. You should see a folder `mockbook` containing:
`api/`, `public/`, `package.json`, `vercel.json`, `README.md`, `.env.example`.

## 2. Get a free API key
1. Go to https://the-odds-api.com and sign up for the free Starter plan (no credit card).
2. They email you an API key. Keep it private.

## 3. Put the project on GitHub
1. Create a free account at https://github.com.
2. Create a new repository named `mockbook`.
3. Upload the contents of the `mockbook` folder (use "uploading an existing file" and drag
   everything in). Make sure `api/` and `public/` are included.
4. Check the repository on GitHub: `api/data.js` and `public/index.html` must be visible
   at the top level (not inside an extra `mockbook` folder).

## 4. Deploy on Vercel
1. Create a free account at https://vercel.com and sign in with GitHub.
2. Click Add New, then Project, and import your `mockbook` repository.
3. Leave the build settings alone. Do not click Deploy yet.

## 5. Add your settings (Environment Variables)

| Name | Value |
|---|---|
| `ODDS_API_KEY` | the key from step 2 |
| `LEAGUES` | `nba` (or e.g. `nba,epl`; ids: nba, nfl, cbb, cfb, epl, laliga, seriea, bundesliga, ligue1, mls, ucl) |
| `ODDS_TTL_SECONDS` | `3600` |
| `SCORES_TTL_SECONDS` | `300` |

The last three keep you inside the free 500 monthly API credits.

## 6. Deploy and open it
Click Deploy, wait about a minute, then open the `.vercel.app` address Vercel shows you.
The header should say "Live feed". Keep the page open in a browser tab: it checks for new
odds and scores on its own and settles your bets when games finish. Your bankroll and bets are
saved in your browser.

## Troubleshooting
- **HTTP 404:** you are not on Vercel, or `api/` is not at the top of the repo. Fix: in Vercel,
  Settings, General, set Root Directory to `mockbook`, then redeploy. Test by adding `/api/data`
  to your address; you should see JSON or a message about the key, not a 404 page.
- **"ODDS_API_KEY is not set":** add the variable in Vercel Settings, then redeploy.
- **Odds API 401:** the key is wrong. **429:** you used up your monthly credits.
- **No games listed:** the chosen league may be out of season.
- Tailwind shows a console warning about production use. It is harmless for a personal project.

## Changing settings later
Vercel project, Settings, Environment Variables. Edit a value, then redeploy.

## Notes
- Everyone with your link shares your API credits. Share it only with people you want using it.
- Vercel's free Hobby plan is for personal, non-commercial use.
- Nothing here involves real money.
