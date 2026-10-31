# The Salt Road

A text-first merchant trading game set across the twenty cities of the Amber Reach. Buy low where the harvest is heavy, sell dear where the cupboards are bare, and keep your beasts, waterskins, and reputation in good order.

Built as a zero-dependency browser game: plain HTML, CSS, and ES modules. No build step, package manager, or external art is required.

## The wager

Start in Rivermeet with **320 crowns** and a pair of boots. Grow your **net worth to 3,000 crowns** — cash plus the local value of your cargo — to retire with a fortune worth keeping.

## Features

- **20 connected cities**, each with its own exports, imports, market character, and illustrated skyline.
- **10 trade goods**: wheat, corn, barley, oats, hay, rice, salt, honey, wool, and saffron.
- **Six ways to travel**: on foot, donkey, horse, camel, ox, and horse-drawn wagon, each balancing pace, cargo capacity, and daily water/food costs.
- **Living markets** whose prices and stock drift as days pass and roads are travelled.
- **Life, energy, hunger, and thirst** bars. Supplies drain on the road; run dry and your health follows.
- **Road encounters** with meaningful choices: tolls, highwaymen, shrines, stranded travellers, abandoned carts, dust storms, and more.
- **Town services**: fresh water, a hot meal, and a bed for the night.
- **Autosave** after every trade and journey, plus a resumable ledger and a best-fortune record.

## Playing

Open `index.html` through any static web server, or double-click it if your browser permits ES modules from `file://` (a local server is recommended).

```bash
python3 -m http.server 8000
# then visit http://localhost:8000/
```

### Controls

- **Market** — choose a trade size (`1 / 5 / 10 / MAX`), then buy or sell each good. Green `local` goods are cheap here; red `wanted` goods sell high.
- **Roads** — compare distance, days, risk, and supply costs, then set out on a route.
- **Caravan** — review cargo, profit and loss, and trade in your rig at the caravan yard.
- **Atlas** — inspect any city, its specialities, and the roads that connect it. Select a city on the map to plan a route.
- **How to play** — the `?` button opens the merchant’s primer.
- **New game** — start a fresh ledger after confirmation.

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | App shell and start screen |
| `styles.css` | Theme, layout, responsive rules, modals |
| `data.js` | Goods, cities, roads, transports, weather |
| `engine.js` | State, markets, cargo, trade quotes, travel math, saves |
| `journey.js` | Travel resolution, road events, rescue logic |
| `views.js` | Merchant card, vitals, rig, cargo, hero, map and route rail |
| `panels.js` | Market, roads, caravan, and atlas panels |
| `modals.js` | Travel, event, help, restart, and retirement dialogs |
| `app.js` | Rendering orchestration, actions, sound, toasts |
| `art.js` | Procedural city illustrations and the SVG world map |
| `icons.js` | Inline SVG icon set |

## Notes

- The game saves to `localStorage` under `saltroad.save.v1`.
- Sound is generated with the Web Audio API and can be muted in the top bar.
- Layout adapts from wide desktop down to a 320 px mobile screen, with bottom navigation on small displays.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/reliq9-star/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/reliq9-star/PlayGround)

- 🎮 [Open the project](https://omgithub.com/reliq9-star/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=reliq9-star%2FPlayGround).
- 💻 [Explore the source](https://github.com/reliq9-star/PlayGround).
- 🛠️ [Check build runs](https://github.com/reliq9-star/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/reliq9-star/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/reliq9-star).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
