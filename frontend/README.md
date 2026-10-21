# Spill the Tea — Scorecard

Three files, no build step:

```
index.html   structure, loads style.css and app.js
style.css    all styling
app.js       all app logic (state, storage calls, screen rendering)
```

## Running it locally

Open `index.html` directly in a browser, or serve the folder with
any static server (e.g. `npx serve .` from inside the folder).

## Hosting it for real

Any static host works — this is just HTML/CSS/JS, no server needed
for the app itself. Easiest options, roughly in order of simplicity:

- **GitHub Pages** — push this folder to a repo, turn on Pages in
  repo settings, done.
- **Netlify / Vercel** — drag-and-drop the folder in their dashboard,
  or connect the repo for auto-deploys on every push.
- **Cloudflare Pages** — similar to Netlify/Vercel.

Splitting into three files doesn't make any of these harder — a
static host serves a folder just as easily as it serves one file.

## Saved games

The current player's game is saved in that browser's `localStorage` as
the scorecard changes, including the selected week. Reloading the page
restores the game; **Start Over** clears the saved game. This is a
per-browser save, needs no backend, and does not sync between devices.
