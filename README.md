# Grain & Gold

A text-based merchant trading game. Start with 500 gold and a sack of wheat in Aldermere, then trade your way across twenty cities until your caravan is worth 10,000.

Buy grain, flour, malt and hemp where they are grown; sell where they are scarce. Every price drifts with the day, and every road costs time, water, rations and energy.

## Play

- **Choose a destination** on the map to see the distance, days, cost and expected conditions.
- **Trade** from the Market panel. Green prices are local exports; rust prices are scarce imports.
- **Provision** with water and rations before a long road. Thirst and hunger drain daily.
- **Travel** and resolve road events as they appear. Some choices cost supplies; some pay well.
- **Upgrade** your transport in the Caravan tab: donkey, camel, horse, ox, or a horse-drawn wagon.
- **Rest** at an inn to recover energy, and watch for travellers' tips about cities paying dearly.
- Reach **10,000 gold in net worth** to become a merchant prince. You can keep trading after winning.

Life, energy, thirst and hunger all matter. At zero life, the journey ends.

## Run locally

The game is a static site with no build step. Serve the repository root:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

The provided launcher also works when `RUNTIME_DIR` points at the runtime that supplies `default-start.mjs`:

```bash
RUNTIME_DIR=/path/to/runtime PORT=8000 ./start.sh
```

## Development

Game logic lives in `src/engine.js` (pure, seeded, no DOM) and world data in `src/data.js`. Rendering and input are in `src/ui.js`. Styling and responsive layout are in `styles.css`.

Run the engine tests with Node 18+:

```bash
node --test test/engine.test.mjs
```

The UI autosaves to `localStorage` under `grain-and-gold.save.v1`.

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
