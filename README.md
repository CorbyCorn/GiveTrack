# GiveTrack

Employee charitable giving dashboard for Isara. Built with React + Vite, deployed on Vercel.

**Live site:** https://givetrack.vercel.app

## Quick start

```bash
npm install
npm run dev
```

Opens at http://localhost:5173. Login with any `@isara.io` email.

## Project structure

```
src/
  App.jsx      # Entire application (all UI, logic, data)
  main.jsx     # React entry point
index.html     # HTML template
vite.config.js # Vite configuration
public/
  hero.jpg     # Bottom section photo
  banner.jpg   # Banner image
```

The app is a single-page React application — all components, state, and data live in `src/App.jsx`.

### Key concepts

- **Data storage:** All data (donations, budgets, submissions, tracker) is stored in `localStorage`, seeded from `DEMO_DATA` constants on first load.
- **Tabs:** Overview, Impact (3D globe), Donate, Team, Admin (Tracker, Budgets, Management)
- **Globe:** Uses `react-globe.gl` with arcs showing donation flows from SF to charity locations worldwide.
- **Responsive:** Uses `useIsMobile()` hook with inline style ternaries — no CSS media queries.

## Deployment

The app deploys to Vercel as a static site using prebuilt output.

### Deploy steps

```bash
# 1. Build
npm run build

# 2. Copy build output to Vercel output directory
rm -rf .vercel/output/static
cp -R dist .vercel/output/static

# 3. Swap project.json to GiveTrack project
# Replace the contents of .vercel/project.json with:
# {"projectId":"prj_4Uhq75n3WnQFchW2yTnhppY3KYpa","orgId":"team_uuwZikWQh37dJwdI6QGSlf6D","projectName":"givetrack"}

# 4. Deploy
npx vercel deploy --prebuilt --prod --yes

# 5. Swap project.json back to default (openai-credit-tracker)
# {"projectId":"prj_xnIN8sLXRGxdAn491WZmrMHgcLhX","orgId":"team_uuwZikWQh37dJwdI6QGSlf6D","projectName":"openai-credit-tracker"}
```

### Vercel project IDs

| Project | ID |
|---|---|
| givetrack | `prj_4Uhq75n3WnQFchW2yTnhppY3KYpa` |
| openai-credit-tracker (default) | `prj_xnIN8sLXRGxdAn491WZmrMHgcLhX` |

## Editing the app

Almost everything you'd want to change is in `src/App.jsx`:

- **Demo data / donations:** Search for `DEMO_DATA` (~line 300)
- **Organization images:** Search for `ORG_IMAGES` (~line 88)
- **Organization websites:** Search for `ORG_WEBSITES` (~line 282)
- **Color theme:** Search for `const C =` (~line 28)
- **Globe settings:** Search for `GlobeTab` function
- **Login emails:** Search for `@isara.io` in the login handler
- **Payroll cycles:** Search for `CYCLES`

## Notes

- This repo also contains files for the OpenAI Credit Tracker (Next.js app) which shares the same Vercel org. Those files (`src/app/`, `src/components/`, `src/lib/`, `middleware.ts`, etc.) are unrelated to GiveTrack.
- GiveTrack is purely client-side — no API keys or environment variables needed.
- The `.env.local` and `.env.example` files are for the credit tracker, not GiveTrack.
