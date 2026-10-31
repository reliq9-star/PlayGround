// Grain & Gold — interface, input, and persistence.
import {
  createGame, currentTransport, capacityOf, totalGoods, netWorth, marketRows,
  buyGoods, sellGoods, maxAffordable, buySupplies, drink, eat,
  buyTransport, equipTransport, restAtInn, camp, tavernMeal, wellWater, healer,
  routeQuote, startTravel, resolveEvent, activeEvent, activeTips, seasonFor,
  weatherFor, checkStatus, continueTrading, saveText, loadGame, priceAt,
  INN_COST, MEAL_COST, WELL_COST, HEALER_COST,
} from './engine.js';
import {
  CITIES, CITY_BY_ID, GOODS, GOOD_BY_ID, TRANSPORTS, TRANSPORT_BY_ID, TARGET_WEALTH,
} from './data.js';

const STORAGE_KEY = 'grain-and-gold.save.v1';
const SAVE_VERSION = 1;
const numberFormat = new Intl.NumberFormat('en-US');

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const fmt = (value) => numberFormat.format(Math.round(Number(value) || 0));
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

const el = {
  gold: $('#goldValue'),
  goalText: $('#goalText'),
  goalBar: $('#goalBar'),
  goalFill: $('#goalFill'),
  lifeVal: $('#lifeVal'), lifeFill: $('#lifeFill'),
  energyVal: $('#energyVal'), energyFill: $('#energyFill'),
  thirstVal: $('#thirstVal'), thirstFill: $('#thirstFill'),
  hungerVal: $('#hungerVal'), hungerFill: $('#hungerFill'),
  dayChip: $('#dayChip'),
  weatherChip: $('#weatherChip'),
  journalChip: $('#journalChip'),
  transportBadge: $('#transportBadge'),
  capacityBadge: $('#capacityBadge'),
  seasonBadge: $('#seasonBadge'),
  netWorthBadge: $('#netWorthBadge'),
  cityName: $('#currentCityName'),
  cityRegion: $('#currentCityRegion'),
  cityBlurb: $('#currentCityBlurb'),
  hereStamp: $('#hereStamp'),
  tradeHints: $('#tradeHints'),
  services: $('#services'),
  quickServices: $('#quickServices'),
  map: $('#map'),
  mapHint: $('#mapHint'),
  destination: $('#destination'),
  rumours: $('#rumours'),
  journal: $('#journal'),
  journalStats: $('#journalStats'),
  marketCity: $('#marketCity'),
  marketTable: $('#marketTable'),
  marketView: $('#marketView'),
  caravanView: $('#caravanView'),
  caravanScroll: $('#caravanScroll'),
  qtyPicker: $('#qtyPicker'),
  overlayRoot: $('#overlayRoot'),
  helpBtn: $('#helpBtn'),
  newGameBtn: $('#newGameBtn'),
};

let state = null;
let savedGame = null;

const ui = {
  selectedCity: null,
  qty: 1,
  marketTab: 'market',
  mobileTab: 'road',
  overlayKind: null,
  overlayStatus: null,
};

// ------------------------------------------------------------------ helpers

const busy = () => Boolean(state && (state.travel || state.event || state.status !== 'playing'));

function nearestCity(fromId, preferUnvisited = true) {
  const origin = CITY_BY_ID[fromId];
  if (!origin) return null;
  const candidates = CITIES.filter((city) => city.id !== fromId);
  const scored = candidates.map((city) => {
    const distance = Math.hypot(city.x - origin.x, city.y - origin.y);
    const unvisited = state ? !state.visited.includes(city.id) : true;
    return { city, distance, score: distance + (preferUnvisited && !unvisited ? 600 : 0) };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.length ? scored[0].city.id : null;
}

function suggestDestination() {
  if (!state) return null;
  return nearestCity(state.cityId, true);
}

function tickMeter(fill, valueEl, value, lowThreshold = 25) {
  const safe = clamp(value, 0, 100);
  fill.style.width = `${safe}%`;
  valueEl.textContent = String(Math.round(safe));
  const meter = fill.closest('.meter');
  if (meter) meter.classList.toggle('is-low', safe <= lowThreshold);
}

function goalPercent() {
  if (!state) return 0;
  return clamp((netWorth(state) / TARGET_WEALTH) * 100, 0, 100);
}

function saveGame() {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEY, saveText(state));
  } catch {
    /* storage unavailable — the game still works for this session */
  }
}

function readSave() {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (!text) return null;
    const loaded = loadGame(text);
    if (!loaded || loaded.status === undefined) return null;
    return loaded;
  } catch {
    return null;
  }
}

function clearSave() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ render

function render() {
  if (!state) return;
  renderHud();
  renderCityCard();
  renderMap();
  renderDestination();
  renderRumours();
  renderJournal();
  renderMarket();
  renderCaravan();
  syncMarketTab();
}

function renderHud() {
  const t = currentTransport(state);
  const worth = netWorth(state);
  el.gold.textContent = fmt(state.gold);
  el.goalText.textContent = `${fmt(worth)} / ${fmt(TARGET_WEALTH)}`;
  el.goalFill.style.width = `${goalPercent()}%`;
  el.goalBar.setAttribute('aria-valuenow', String(Math.round(worth)));
  el.dayChip.textContent = `Day ${state.day}`;
  el.weatherChip.textContent = weatherFor(state);
  el.journalChip.textContent = `Day ${state.day} · ${seasonFor(state)}`;
  el.transportBadge.textContent = t.name;
  el.capacityBadge.textContent = `${totalGoods(state)}/${t.capacity}`;
  el.seasonBadge.textContent = seasonFor(state);
  el.netWorthBadge.textContent = `Net worth ${fmt(worth)}`;

  tickMeter(el.lifeFill, el.lifeVal, state.life);
  tickMeter(el.energyFill, el.energyVal, state.energy);
  tickMeter(el.thirstFill, el.thirstVal, state.thirst);
  tickMeter(el.hungerFill, el.hungerVal, state.hunger);
}

function renderCityCard() {
  const travelling = Boolean(state.travel);
  const city = CITY_BY_ID[travelling ? state.travel.destId : state.cityId];
  el.cityName.textContent = city.name;
  el.cityRegion.textContent = city.region;
  if (travelling) {
    el.hereStamp.textContent = 'En route';
    el.cityBlurb.textContent = `The road to ${city.name} runs on — ${state.travel.daysLeft} day${state.travel.daysLeft === 1 ? '' : 's'} from the gate. Markets wait at the end of the journey.`;
  } else {
    el.hereStamp.textContent = 'You are here';
    el.cityBlurb.textContent = city.blurb;
  }

  const cheap = city.exports.map((id) => GOOD_BY_ID[id].name.toLowerCase()).join(', ');
  const dear = city.imports.map((id) => GOOD_BY_ID[id].name.toLowerCase()).join(', ');
  el.tradeHints.innerHTML = `
    <span class="hint hint--cheap">Cheap: ${escapeHtml(cheap)}</span>
    <span class="hint hint--dear">In demand: ${escapeHtml(dear)}</span>
  `;

  const locked = busy();
  const serviceMarkup = [
    { id: 'inn', label: 'Sleep', cost: INN_COST, title: 'A bed at the inn: energy +48, life +10. One day passes.' },
    { id: 'meal', label: 'Meal', cost: MEAL_COST, title: 'A hot meal at the tavern: hunger +45.' },
    { id: 'well', label: 'Water', cost: WELL_COST, title: 'Cold well water: thirst +45.' },
    { id: 'healer', label: 'Healer', cost: HEALER_COST, title: 'Herbs and a poultice: life +35.', disabled: state.life >= 100 },
    { id: 'camp', label: 'Camp', cost: 0, title: 'Sleep rough for free: energy +22. One day passes.' },
  ].map((service) => {
    const disabled = locked || (service.cost > 0 && state.gold < service.cost) || service.disabled;
    return `<button type="button" class="service" data-service="${service.id}" title="${escapeHtml(service.title)}" ${disabled ? 'disabled' : ''}>
      <span>${service.label}</span><em>${service.cost ? `${service.cost}g` : 'free'}</em>
    </button>`;
  }).join('');

  el.services.innerHTML = serviceMarkup;
  el.quickServices.innerHTML = `
    <div class="quick-services__label">
      <span class="eyebrow">${travelling ? 'On the road' : 'In town'}</span>
      <strong>${travelling ? `Bound for ${escapeHtml(city.name)}` : escapeHtml(city.name)}</strong>
      <span class="quick-services__note">${travelling ? 'Reach the gate to trade and rest.' : 'Prices change when you sleep.'}</span>
    </div>
    <div class="services services--wide">${serviceMarkup}</div>
  `;
}

const LAND_PATH = 'M 62 205 C 48 160 78 118 130 96 C 168 80 196 44 250 46 C 292 47 314 62 350 72 C 390 84 420 58 466 66 C 512 74 538 92 570 108 C 610 128 634 166 630 206 C 626 246 646 276 622 312 C 598 348 556 354 516 372 C 478 389 438 406 388 400 C 342 394 312 412 266 404 C 220 396 188 412 146 394 C 104 376 66 346 54 306 C 42 266 76 246 62 205 Z';

const MAP_ART = `
  <defs>
    <linearGradient id="landGrad" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#f1e3c5"/>
      <stop offset="0.55" stop-color="#e8d4ac"/>
      <stop offset="1" stop-color="#dec79b"/>
    </linearGradient>
    <radialGradient id="desertWash" cx="0.6" cy="0.6" r="0.6">
      <stop offset="0" stop-color="#d9b477" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#d9b477" stop-opacity="0"/>
    </radialGradient>
    <filter id="mapSoft" x="-8%" y="-8%" width="116%" height="116%">
      <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="#6b4b20" flood-opacity="0.25"/>
    </filter>
  </defs>

  <path class="land-outline" d="${LAND_PATH}"/>
  <path class="land" filter="url(#mapSoft)" d="${LAND_PATH}"/>
  <path d="M 400 288 C 445 260 505 248 565 264 C 612 277 628 316 604 356 C 576 398 486 406 436 386 C 396 370 382 322 400 288 Z" fill="url(#desertWash)"/>

  <path class="river" d="M 252 66 C 238 102 214 130 196 166 C 178 202 182 240 152 280 C 132 306 120 330 106 352"/>
  <path class="river" d="M 312 84 C 302 120 320 152 306 186 C 296 212 306 240 292 270 C 286 284 292 298 300 312"/>
  <path class="river river--thin" d="M 350 118 C 360 156 342 188 348 222 C 352 242 346 256 348 270"/>

  <g class="mountain" aria-hidden="true">
    <path d="M 228 78 l 12 -17 l 12 17"/>
    <path d="M 256 92 l 10 -14 l 10 14"/>
    <path d="M 204 96 l 9 -12 l 9 12"/>
    <path d="M 302 66 l 11 -15 l 11 15"/>
    <path d="M 330 80 l 8 -11 l 8 11"/>
    <path d="M 282 92 l 14 -19 l 14 19"/>
    <path d="M 312 110 l 9 -12 l 9 12"/>
  </g>

  <g class="tree" aria-hidden="true">
    <circle cx="92" cy="266" r="2.3"/><circle cx="101" cy="272" r="1.7"/><circle cx="83" cy="278" r="1.6"/>
    <circle cx="146" cy="238" r="2"/><circle cx="156" cy="244" r="1.5"/>
    <circle cx="212" cy="262" r="1.8"/><circle cx="222" cy="268" r="1.4"/>
    <circle cx="108" cy="342" r="2.1"/><circle cx="118" cy="348" r="1.6"/><circle cx="97" cy="350" r="1.5"/>
    <circle cx="184" cy="372" r="1.8"/><circle cx="194" cy="378" r="1.4"/>
    <circle cx="360" cy="250" r="2"/><circle cx="370" cy="255" r="1.5"/>
    <circle cx="320" cy="384" r="1.7"/><circle cx="331" cy="390" r="1.4"/>
  </g>

  <g class="dune" aria-hidden="true">
    <path d="M 432 306 q 20 -10 40 0"/>
    <path d="M 456 324 q 18 -9 36 0"/>
    <path d="M 486 346 q 22 -10 44 0"/>
    <path d="M 520 286 q 18 -9 36 0"/>
    <path d="M 548 312 q 20 -10 40 0"/>
    <path d="M 414 360 q 16 -8 32 0"/>
  </g>

  <text class="sea-label" x="68" y="58">THE SUNDERED SEA</text>

  <g class="map-scale" transform="translate(58 408)" aria-hidden="true">
    <line x1="0" y1="0" x2="125" y2="0"/>
    <line x1="0" y1="-3" x2="0" y2="3"/>
    <line x1="62.5" y1="-2" x2="62.5" y2="2"/>
    <line x1="125" y1="-3" x2="125" y2="3"/>
    <text x="0" y="-7">0</text>
    <text x="125" y="-7" text-anchor="end">100 miles</text>
  </g>

  <g class="compass" transform="translate(626 68)" aria-hidden="true">
    <circle cx="0" cy="0" r="15"/>
    <circle cx="0" cy="0" r="11" stroke-dasharray="1 2"/>
    <path d="M 0 -9 L 3 2 L 0 0 L -3 2 Z" fill="#80693f" stroke="none"/>
    <text x="0" y="-18" text-anchor="middle">N</text>
  </g>
`;

function cityLabelPosition(city) {
  const anchor = city.x > 560 ? 'end' : city.x < 95 ? 'start' : 'middle';
  const x = city.x + (anchor === 'end' ? -9 : anchor === 'start' ? 9 : 0);
  const y = city.y + (city.y > 372 ? -11 : 17);
  return { x, y, anchor };
}

function renderMap() {
  if (!state || !ui.selectedCity) return;
  const currentId = state.cityId;
  const selectedId = ui.selectedCity;
  const t = currentTransport(state);

  // Faint trading roads between each city and its two nearest neighbours.
  const segments = new Map();
  for (const city of CITIES) {
    const nearest = CITIES
      .filter((other) => other.id !== city.id)
      .map((other) => ({ other, d: Math.hypot(other.x - city.x, other.y - city.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    for (const { other } of nearest) {
      const key = [city.id, other.id].sort().join('|');
      if (!segments.has(key)) segments.set(key, [city, other]);
    }
  }
  const roads = Array.from(segments.values()).map(([a, b]) => (
    `<line class="route" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`
  )).join('');

  const selected = CITY_BY_ID[selectedId];
  const current = CITY_BY_ID[currentId];
  const selectedRoad = selected && selected.id !== currentId
    ? `<line class="route route--selected" x1="${current.x}" y1="${current.y}" x2="${selected.x}" y2="${selected.y}"/>`
    : '';

  const cityMarkup = CITIES.map((city) => {
    const isCurrent = city.id === currentId;
    const isSelected = city.id === selectedId;
    const isVisited = state.visited.includes(city.id);
    const pos = cityLabelPosition(city);
    const days = routeQuote(state, city.id)?.days || 0;
    const classes = ['city', isCurrent ? 'is-current' : '', isSelected ? 'is-selected' : '', isVisited ? 'is-visited' : ''].filter(Boolean).join(' ');
    return `
      <g class="${classes}" data-city="${city.id}" tabindex="0" role="button" aria-label="${escapeHtml(city.name)}, ${escapeHtml(city.region)}">
        <title>${escapeHtml(city.name)} — ${escapeHtml(city.region)}${isCurrent ? ' (you are here)' : `. About ${days} day${days === 1 ? '' : 's'} by ${escapeHtml(t.name.toLowerCase())}.`}</title>
        <circle class="city-hit" cx="${city.x}" cy="${city.y}" r="20"/>
        <circle class="city-halo" cx="${city.x}" cy="${city.y}" r="11"/>
        ${isCurrent ? `<circle class="city-pulse" cx="${city.x}" cy="${city.y}" r="9"/>` : ''}
        <circle class="city-dot" cx="${city.x}" cy="${city.y}" r="5.4"/>
        <text class="city-label" x="${pos.x}" y="${pos.y}" text-anchor="${pos.anchor}">${escapeHtml(city.name)}</text>
      </g>`;
  }).join('');

  el.map.innerHTML = `${MAP_ART}
    <g aria-hidden="true">${roads}${selectedRoad}</g>
    <g>${cityMarkup}</g>
  `;

  el.mapHint.textContent = selected && selected.id !== currentId
    ? `${selected.name} · ${routeQuote(state, selected.id)?.days || 0} days`
    : 'Choose a pin to plan a route';
}

function riskLabel(risk) {
  if (risk >= 0.42) return { label: 'Dangerous', className: 'is-high' };
  if (risk >= 0.27) return { label: 'Watchful', className: 'is-medium' };
  return { label: 'Low risk', className: '' };
}

function cargoAdvice(destId) {
  const carried = GOODS
    .filter((good) => (state.goods[good.id] || 0) > 0)
    .map((good) => {
      const here = priceAt(state, state.cityId, good.id).sell;
      const there = priceAt(state, destId, good.id).sell;
      return { good, here, there, diff: there - here };
    })
    .sort((a, b) => b.diff - a.diff);

  if (!carried.length) return 'Your caravan is empty. Buy something cheap first.';
  const best = carried[0];
  if (best.diff > 0) {
    return `${best.good.name}: ${best.there}g there vs ${best.here}g here (+${best.diff}g a sack).`;
  }
  return `No special demand for your cargo in ${CITY_BY_ID[destId].name}.`;
}

function renderDestination() {
  if (!state) return;

  if (state.travel) {
    const dest = CITY_BY_ID[state.travel.destId];
    const daysLeft = state.travel.daysLeft;
    el.destination.innerHTML = `
      <div class="dest-card">
        <div class="dest-card__head">
          <div>
            <span class="eyebrow">On the road</span>
            <h3>${escapeHtml(dest.name)}</h3>
            <span class="region">${escapeHtml(dest.region)}</span>
          </div>
          <span class="risk ${state.travel.eventIds.length ? 'is-high' : ''}"><i></i>Roadside</span>
        </div>
        <p class="dest-blurb">The road to ${escapeHtml(dest.name)} runs on, ${daysLeft} day${daysLeft === 1 ? '' : 's'} from the gate.</p>
        <div class="route-stats">
          <div><dt>Remaining</dt><dd>${daysLeft} day${daysLeft === 1 ? '' : 's'}</dd></div>
          <div><dt>Distance</dt><dd>${state.travel.distance} mi</dd></div>
          <div><dt>Energy</dt><dd>${Math.round(state.energy)}</dd></div>
          <div><dt>Water</dt><dd>${state.water}</dd></div>
        </div>
        <p class="event-card__travel">Resolve the encounter in your journal to continue.</p>
      </div>`;
    return;
  }

  if (!ui.selectedCity || ui.selectedCity === state.cityId) {
    const city = CITY_BY_ID[state.cityId];
    const cheap = city.exports.map((id) => GOOD_BY_ID[id].name.toLowerCase()).join(' and ');
    el.destination.innerHTML = `
      <div class="here-card">
        <h3>You are in ${escapeHtml(city.name)}</h3>
        <p>${escapeHtml(city.name)} is known for ${escapeHtml(cheap)}. Fill your waterskins, then choose a pin on the map.</p>
        <div class="hint-line">Select a destination →</div>
      </div>`;
    return;
  }

  const dest = CITY_BY_ID[ui.selectedCity];
  const quote = routeQuote(state, ui.selectedCity);
  if (!quote) {
    el.destination.innerHTML = '';
    return;
  }
  const risk = riskLabel(quote.risk);
  const shortWater = state.water < quote.waterNeeded;
  const shortFood = state.rations < quote.foodNeeded;
  const lowEnergy = state.energy < quote.energy;
  const warnings = [];
  if (shortWater) warnings.push(`You carry ${state.water} waterskin${state.water === 1 ? '' : 's'} but the road wants about ${quote.waterNeeded}.`);
  if (shortFood) warnings.push(`You carry ${state.rations} ration${state.rations === 1 ? '' : 's'} but the road wants about ${quote.foodNeeded}.`);
  if (lowEnergy) warnings.push(`You have ${Math.round(state.energy)} energy; the journey will cost about ${quote.energy}.`);

  el.destination.innerHTML = `
    <div class="dest-card">
      <div class="dest-card__head">
        <div>
          <span class="eyebrow">Destination</span>
          <h3>${escapeHtml(dest.name)}</h3>
          <span class="region">${escapeHtml(dest.region)}</span>
        </div>
        <span class="risk ${risk.className}"><i></i>${risk.label}</span>
      </div>
      <p class="dest-blurb">${escapeHtml(dest.blurb)}</p>
      <div class="route-stats">
        <div><dt>Distance</dt><dd>${quote.distance} <small>mi</small></dd></div>
        <div><dt>Journey</dt><dd>${quote.days} <small>days</small></dd></div>
        <div><dt>Energy</dt><dd>−${quote.energy}</dd></div>
        <div><dt>Provisions</dt><dd title="About ${quote.waterNeeded} waterskins and ${quote.foodNeeded} rations">${quote.waterNeeded}w · ${quote.foodNeeded}f</dd></div>
      </div>
      <div class="cargo-tip"><span>Cargo</span>${escapeHtml(cargoAdvice(dest.id))}</div>
      ${warnings.length ? `<p class="travel-warning">${escapeHtml(warnings[0])}</p>` : ''}
      <button type="button" class="btn btn--primary btn--wide" data-travel="${dest.id}" ${busy() ? 'disabled' : ''}>
        Set out for ${escapeHtml(dest.name)}
      </button>
    </div>`;
}

function renderRumours() {
  const tips = activeTips(state).slice(-3);
  if (!tips.length) {
    el.rumours.innerHTML = '';
    return;
  }
  el.rumours.innerHTML = tips.map((tip) => (
    `<div class="rumour">${escapeHtml(tip.city.name)} is paying dear for ${escapeHtml(tip.good.name.toLowerCase())}.</div>`
  )).join('');
}

function renderJournal() {
  const entries = state.log.slice(-60);
  let html = entries.map((entry) => `
    <div class="entry entry--${entry.kind || 'system'}">
      <span class="entry__day">D${entry.day}</span>
      <div class="entry__body">${escapeHtml(entry.text)}</div>
    </div>`).join('');

  if (!entries.length) html = '<p class="entry-empty">The first page of your ledger is still blank.</p>';

  if (state.event) {
    const ev = activeEvent(state);
    if (ev) {
      html += `
        <div class="event-card" id="eventCard">
          <div class="event-card__kicker">On the road · Day ${state.event.day}</div>
          <h3>${escapeHtml(ev.title)}</h3>
          <p class="event-card__text">${escapeHtml(ev.text)}</p>
          <div class="event-choices">
            ${ev.choices.map((choice, index) => `
              <button type="button" class="event-choice" data-choice="${index}">
                ${escapeHtml(choice.label)}<span>→</span>
              </button>`).join('')}
          </div>
          <div class="event-card__travel">Your caravan waits.</div>
        </div>`;
    }
  }

  el.journal.innerHTML = html;
  el.journal.scrollTop = el.journal.scrollHeight;
  el.journalStats.textContent = `${fmt(state.stats.miles)} miles · ${state.visited.length}/20 cities · ${state.stats.trades} trades`;
}

function renderMarket() {
  const city = CITY_BY_ID[state.cityId];
  el.marketCity.textContent = state.travel
    ? `On the road to ${CITY_BY_ID[state.travel.destId].name}`
    : `${city.name} market`;
  el.marketView.classList.toggle('is-blocked', busy());

  const rows = marketRows(state);
  el.marketTable.innerHTML = `
    <div class="mkt-head"><span>Good</span><span>Buy/Sell</span><span>Own</span><span style="text-align:right">Trade</span></div>
    ${rows.map((row) => {
      const tag = row.rumored ? 'Rumoured demand' : row.exported ? 'Grown here' : row.imported ? 'Scarce here' : '—';
      const classes = ['mkt-row', row.exported ? 'is-export' : '', row.imported ? 'is-import' : '', row.rumored ? 'is-rumoured' : ''].filter(Boolean).join(' ');
      const full = totalGoods(state) >= capacityOf(state);
      const buyDisabled = busy() || state.gold < row.price || full;
      const sellDisabled = busy() || row.owned <= 0;
      return `
        <div class="${classes}">
          <div class="mkt-good">
            <span class="mkt-name">${escapeHtml(row.name)}</span>
            <span class="mkt-tag">${tag}</span>
          </div>
          <div class="mkt-price" title="Buy for ${row.price} gold, sell for ${row.sell} gold">
            <strong>${row.price}</strong><span class="sell">${row.trend === 'up' ? '▲' : row.trend === 'down' ? '▼' : '·'} sell ${row.sell}</span>
          </div>
          <div class="mkt-own ${row.owned ? 'has' : ''}">${row.owned || '—'}</div>
          <div class="mkt-acts">
            <button type="button" class="mkt-btn mkt-btn--buy" data-buy="${row.id}" ${buyDisabled ? 'disabled' : ''} title="Buy ${row.name}">Buy</button>
            <button type="button" class="mkt-btn mkt-btn--sell" data-sell="${row.id}" ${sellDisabled ? 'disabled' : ''} title="Sell ${row.name}">Sell</button>
          </div>
        </div>`;
    }).join('')}
  `;
}

function renderCaravan() {
  const t = currentTransport(state);
  const carried = GOODS.filter((good) => (state.goods[good.id] || 0) > 0);
  const cargoValue = carried.reduce((sum, good) => sum + state.goods[good.id] * good.base, 0);
  const total = totalGoods(state);
  const locked = busy();

  const inventory = carried.length
    ? carried.map((good) => `
        <div class="inv-row">
          <span>${escapeHtml(good.name)} <span class="qty">×<strong>${state.goods[good.id]}</strong></span></span>
          <span class="inv-value">${fmt(state.goods[good.id] * good.base)}g</span>
        </div>`).join('')
    : '<p class="inv-empty">Your caravan is empty. Buy low somewhere green.</p>';

  const supplyCards = [
    { id: 'water', name: 'Waterskins', count: state.water, price: 1, use: 'Drink' },
    { id: 'rations', name: 'Rations', count: state.rations, price: 2, use: 'Eat' },
  ].map((supply) => `
    <div class="supply">
      <div class="supply__head"><strong>${supply.name}</strong><span class="num">${supply.count}</span></div>
      <div class="supply__actions">
        <button type="button" data-buy-supply="${supply.id}" data-amount="1" ${locked || state.gold < supply.price ? 'disabled' : ''}>+1</button>
        <button type="button" data-buy-supply="${supply.id}" data-amount="5" ${locked || state.gold < supply.price * 5 ? 'disabled' : ''}>+5</button>
        <button type="button" data-use-supply="${supply.id}" ${locked || supply.count <= 0 ? 'disabled' : ''}>${supply.use}</button>
      </div>
    </div>`).join('');

  const stables = TRANSPORTS.map((transport) => {
    const owned = state.owned.includes(transport.id);
    const active = state.transport === transport.id;
    const tooHeavy = total > transport.capacity;
    let actionLabel = `Buy ${fmt(transport.price)}g`;
    let disabled = locked || state.gold < transport.price || tooHeavy;
    if (owned) {
      actionLabel = active ? 'In use' : 'Equip';
      disabled = active || locked || tooHeavy;
    }
    return `
      <div class="stable ${active ? 'is-active' : ''} ${owned ? 'is-owned' : ''}">
        <div>
          <div class="stable__name">${escapeHtml(transport.name)}${owned ? '<span>owned</span>' : ''}</div>
          <div class="stable__stats" title="${escapeHtml(transport.blurb)}">
            spd <b>${transport.speed}</b> · cap <b>${transport.capacity}</b> · water <b>${transport.thirst}</b> · food <b>${transport.hunger}</b>
          </div>
        </div>
        <button type="button" class="stable__btn" data-buy-transport="${transport.id}" ${disabled ? 'disabled' : ''}>${actionLabel}</button>
      </div>`;
  }).join('');

  el.caravanScroll.innerHTML = `
    <section class="caravan-section">
      <div class="section-title"><span>Caravan · ${escapeHtml(t.name)}</span><span class="num">${total}/${t.capacity} loaded</span></div>
      <div class="capacity-track"><div class="capacity-fill" style="width:${clamp((total / t.capacity) * 100, 0, 100)}%"></div></div>
      <div class="inv-list">${inventory}</div>
      <div class="section-title" style="margin-top:10px"><span>Cargo value</span><span class="num">${fmt(cargoValue)} gold</span></div>
    </section>

    <section class="caravan-section">
      <div class="section-title"><span>Provisions</span><span class="num">water 1g · rations 2g</span></div>
      <div class="supply-grid">${supplyCards}</div>
    </section>

    <section class="caravan-section">
      <div class="section-title"><span>The Stable</span><span class="num">${state.owned.length} owned</span></div>
      <div class="stable-list">${stables}</div>
    </section>

    <section class="caravan-section">
      <div class="section-title"><span>Merchant's record</span><span class="num">${fmt(netWorth(state))} net worth</span></div>
      <div class="stat-grid">
        <div><span>Cities visited</span><b>${state.visited.length}/20</b></div>
        <div><span>Miles travelled</span><b>${fmt(state.stats.miles)}</b></div>
        <div><span>Trades made</span><b>${fmt(state.stats.trades)}</b></div>
        <div><span>Best single sale</span><b>${fmt(state.stats.bestSale)}g</b></div>
        <div><span>Gold earned</span><b>${fmt(state.stats.earned)}g</b></div>
        <div><span>Days on the road</span><b>${state.day}</b></div>
      </div>
    </section>
  `;
}

function syncMarketTab() {
  const isMarket = ui.marketTab === 'market';
  el.marketView.hidden = !isMarket;
  el.caravanView.hidden = isMarket;
  $$('.mini-tab').forEach((tab) => {
    const active = tab.dataset.marketTab === ui.marketTab;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

// ------------------------------------------------------------------ actions

function afterAction() {
  if (!state) return;
  checkStatus(state);
  saveGame();
  render();
  if (state.status !== 'playing' && ui.overlayStatus !== state.status) {
    showEnding(state.status);
  }
}

const services = {
  inn: restAtInn,
  meal: tavernMeal,
  well: wellWater,
  healer,
  camp,
};

function selectCity(cityId) {
  if (!state || !CITY_BY_ID[cityId]) return;
  ui.selectedCity = cityId;
  renderMap();
  renderDestination();
}

// ------------------------------------------------------------------ overlays

const SEAL_SVG = `
  <svg viewBox="0 0 48 48" role="img" aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1"/>
    <circle cx="24" cy="24" r="17.5" fill="none" stroke="currentColor" stroke-width=".6" stroke-dasharray="1 3"/>
    <path d="M24 36V14M24 19c-5 0-8-3-8-7 5 0 8 3 8 7zm0 0c5 0 8-3 8-7-5 0-8 3-8 7zm0 9c-5 0-8-3-8-7 5 0 8 3 8 7zm0 0c5 0 8-3 8-7-5 0-8 3-8 7z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

function openOverlay(kind, html) {
  ui.overlayKind = kind;
  el.overlayRoot.innerHTML = html;
  el.overlayRoot.hidden = false;
  const focusTarget = el.overlayRoot.querySelector('[data-autofocus]') || el.overlayRoot.querySelector('button, input');
  if (focusTarget) focusTarget.focus({ preventScroll: true });
}

function closeOverlay() {
  ui.overlayKind = null;
  el.overlayRoot.hidden = true;
  el.overlayRoot.innerHTML = '';
}

function showSplash() {
  const hasSave = Boolean(savedGame);
  const saveSummary = hasSave
    ? `${escapeHtml(savedGame.name)} · Day ${savedGame.day} · ${fmt(savedGame.gold)} gold · ${savedGame.visited.length}/20 cities`
    : 'No ledger has been started in this browser yet.';

  openOverlay('splash', `
    <div class="overlay-card splash-card" role="dialog" aria-modal="true" aria-labelledby="splashTitle">
      <div class="splash-seal">${SEAL_SVG}</div>
      <p class="splash-kicker">A text trading game</p>
      <h1 id="splashTitle">Grain <span>&amp;</span> Gold</h1>
      <p class="splash-sub">Twenty cities. Six ways to travel. One long road to a fortune made one sack at a time.</p>
      <ul class="splash-points">
        <li><b>Buy where it grows, sell where it is scarce.</b> Prices drift daily and every city has its own appetites.</li>
        <li><b>Choose your transport.</b> Boots carry little; a wagon carries a fortune and drinks like a fish.</li>
        <li><b>Keep body and beast alive.</b> Watch life, energy, thirst and hunger. Reach <b>10,000</b> gold net worth.</li>
      </ul>
      <label class="name-field">
        <span>Merchant's name</span>
        <input id="merchantName" maxlength="24" autocomplete="off" spellcheck="false" placeholder="Merchant" value="${hasSave ? escapeHtml(savedGame.name) : ''}" />
      </label>
      <div class="splash-actions">
        <button type="button" class="btn btn--primary" data-overlay-action="start" data-autofocus>Begin a new ledger</button>
        ${hasSave ? '<button type="button" class="btn btn--ghost" data-overlay-action="continue">Continue saved journey</button>' : ''}
      </div>
      <p class="splash-foot">${saveSummary}<br />Progress saves automatically in this browser.</p>
    </div>
  `);
}

function showHelp() {
  const rows = TRANSPORTS.map((t) => `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td class="num">${t.price ? `${fmt(t.price)}g` : 'free'}</td>
      <td class="num">${t.speed}</td>
      <td class="num">${t.capacity}</td>
      <td class="num">${t.thirst}/${t.hunger}</td>
    </tr>`).join('');

  openOverlay('help', `
    <div class="overlay-card" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
      <button type="button" class="overlay-close" data-overlay-action="close" aria-label="Close">×</button>
      <div class="doc-head">
        <span class="splash-kicker">The merchant's almanac</span>
        <h2 id="helpTitle">How to make a fortune</h2>
        <p>No quests. No monsters worth mentioning. Just twenty markets, a long road, and the price of grain.</p>
      </div>
      <div class="rule-grid">
        <div class="rule">
          <h3><span>I</span> Reading the market</h3>
          <p>A city <b>grows</b> two goods and is <b>short</b> of two others. Green prices are grown here — buy them. Rust prices are scarce — sell there. The market pays a tenth below its asking price, and prices drift as days pass. A rest at the inn advances the day.</p>
          <div class="legend-list">
            <span><i class="swatch swatch--good"></i> Grown here — cheap to buy</span>
            <span><i class="swatch swatch--bad"></i> Scarce here — dear to buy</span>
            <span><i class="swatch"></i> Rumoured demand — a traveller's tip</span>
          </div>
        </div>
        <div class="rule">
          <h3><span>II</span> The road</h3>
          <p>Pick a pin on the map. The route card shows <b>distance, days, energy and provisions</b>. Longer roads are riskier: bandits, storms, cracked axles and strange shrines wait in the journal. Your caravan drinks and eats automatically from its supplies, so fill your waterskins before a long crossing.</p>
          <p style="margin-top:6px">If <b>thirst or hunger</b> reach zero, life drains each day. At zero energy, the same. Life at zero ends the ledger.</p>
        </div>
        <div class="rule">
          <h3><span>III</span> The caravan</h3>
          <p>Every transport has a <b>speed, capacity and daily appetite</b>. Boots are free; a donkey is the first honest upgrade; a wagon is a rolling warehouse. You may own several and switch at any stable, but a load too heavy for the new transport must be sold down first.</p>
          <p style="margin-top:6px">Cargo, water and rations fill the Caravan tab. Drink and eat by hand in town, or let the road do it for you.</p>
        </div>
        <div class="rule">
          <h3><span>IV</span> Fortune</h3>
          <p>Your goal is <b>10,000 gold net worth</b>: purse, cargo at base value, supplies and half the value of your transports. Tips from the road point to short-term demand. Twenty cities, one ledger — the rest is arithmetic and nerve.</p>
        </div>
      </div>
      <table class="transport-doc">
        <thead><tr><th>Transport</th><th class="num">Price</th><th class="num">Speed</th><th class="num">Capacity</th><th class="num">Water/Food</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="doc-foot">
        <p class="tiny">Every action is saved automatically. Use the <b>New journey</b> link beneath the journal to start over.</p>
        <button type="button" class="btn btn--ghost" data-overlay-action="close">Back to the ledger</button>
      </div>
    </div>
  `);
}

function showNewGameConfirm() {
  openOverlay('confirm', `
    <div class="overlay-card" role="dialog" aria-modal="true" aria-labelledby="confirmTitle" style="max-width:520px">
      <div class="doc-head">
        <span class="splash-kicker">A clean page</span>
        <h2 id="confirmTitle">Abandon this ledger?</h2>
        <p>Your current journey will be lost. The road is long; a new merchant can always begin again.</p>
      </div>
      <div class="end-actions">
        <button type="button" class="btn btn--primary" data-overlay-action="confirm-new">Start a new journey</button>
        <button type="button" class="btn btn--ghost" data-overlay-action="close" data-autofocus>Keep trading</button>
      </div>
    </div>
  `);
}

function showEnding(status) {
  ui.overlayStatus = status;
  const stats = `
    <div class="end-stats">
      <div class="end-stat"><span class="eyebrow">Net worth</span><strong>${fmt(netWorth(state))}</strong><span>gold</span></div>
      <div class="end-stat"><span class="eyebrow">Days</span><strong>${state.day}</strong><span>on the road</span></div>
      <div class="end-stat"><span class="eyebrow">Cities</span><strong>${state.visited.length}</strong><span>of twenty</span></div>
      <div class="end-stat"><span class="eyebrow">Miles</span><strong>${fmt(state.stats.miles)}</strong><span>travelled</span></div>
    </div>`;

  if (status === 'won') {
    openOverlay('end', `
      <div class="overlay-card" role="dialog" aria-modal="true" aria-labelledby="endTitle" style="max-width:640px;text-align:center">
        <div class="splash-seal" style="margin-bottom:10px">${SEAL_SVG}</div>
        <span class="splash-kicker">The ledger is complete</span>
        <h2 id="endTitle" style="font-size:clamp(34px,6vw,48px)">Merchant Prince</h2>
        <p class="splash-sub" style="margin-bottom:0">${escapeHtml(state.name)}, your name is spoken in every market square from the Riverlands to the Emberwaste. Ten thousand gold, and not a sack of wheat you did not earn.</p>
        ${stats}
        <div class="end-actions" style="justify-content:center">
          <button type="button" class="btn btn--primary" data-overlay-action="keep-trading" data-autofocus>Keep trading</button>
          <button type="button" class="btn btn--ghost" data-overlay-action="new-after-end">New journey</button>
        </div>
      </div>
    `);
    return;
  }

  openOverlay('end', `
    <div class="overlay-card" role="dialog" aria-modal="true" aria-labelledby="endTitle" style="max-width:640px;text-align:center">
      <span class="splash-kicker">The ledger closes</span>
      <h2 id="endTitle" style="font-size:clamp(32px,6vw,46px)">The Road Wins</h2>
      <p class="splash-sub" style="margin-bottom:0">${escapeHtml(state.name)} was found at the edge of the road, purse and cargo accounted for. The market moves on without them.</p>
      <p class="epitaph">“${escapeHtml(epitaph())}”</p>
      ${stats}
      <div class="end-actions" style="justify-content:center">
        <button type="button" class="btn btn--primary" data-overlay-action="new-after-end" data-autofocus>Begin again</button>
      </div>
    </div>
  `);
}

function epitaph() {
  const lines = [
    'They died as they lived: a little short of the next market.',
    'The grain was sound. The merchant was not.',
    'One more mile, they said. One more mile.',
    'A good trader, but a poor judge of waterskins.',
    'The scales were honest. The road was not.',
  ];
  return lines[(state.stats.trades + state.day) % lines.length];
}

function startNewJourney(name) {
  state = createGame(name || 'Merchant', Date.now());
  ui.selectedCity = suggestDestination();
  ui.qty = 1;
  ui.marketTab = 'market';
  ui.overlayStatus = null;
  closeOverlay();
  saveGame();
  render();
  setMobileTab('road');
}

function continueSavedJourney() {
  if (!savedGame) return;
  state = savedGame;
  ui.selectedCity = suggestDestination();
  ui.qty = 1;
  ui.marketTab = 'market';
  ui.overlayStatus = null;
  closeOverlay();
  checkStatus(state);
  render();
  setMobileTab('road');
  if (state.status !== 'playing') showEnding(state.status);
}

// ------------------------------------------------------------------ mobile tabs

function setMobileTab(tab) {
  ui.mobileTab = tab;
  document.body.dataset.mobileTab = tab;
  $$('.mobile-tab').forEach((button) => {
    const active = button.dataset.mobileTab === tab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (tab === 'journal') {
    requestAnimationFrame(() => { el.journal.scrollTop = el.journal.scrollHeight; });
  }
}

// ------------------------------------------------------------------ events

el.helpBtn.addEventListener('click', showHelp);
el.newGameBtn.addEventListener('click', showNewGameConfirm);

el.qtyPicker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-qty]');
  if (!button) return;
  ui.qty = button.dataset.qty === 'max' ? 'max' : Number(button.dataset.qty);
  $$('.qty__btn', el.qtyPicker).forEach((b) => b.classList.toggle('is-active', b === button));
});

$$('.mini-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    ui.marketTab = tab.dataset.marketTab;
    syncMarketTab();
  });
});

$$('.mobile-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    setMobileTab(tab.dataset.mobileTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

function handleServiceClick(event) {
  const button = event.target.closest('[data-service]');
  if (!button) return;
  const handler = services[button.dataset.service];
  if (!handler) return;
  handler(state);
  afterAction();
}

el.services.addEventListener('click', handleServiceClick);
el.quickServices.addEventListener('click', handleServiceClick);

el.destination.addEventListener('click', (event) => {
  const button = event.target.closest('[data-travel]');
  if (!button) return;
  const dest = button.dataset.travel;
  if (!startTravel(state, dest)) return;
  ui.selectedCity = state.event ? dest : suggestDestination();
  afterAction();
});

el.map.addEventListener('click', (event) => {
  const city = event.target.closest('[data-city]');
  if (!city) return;
  selectCity(city.dataset.city);
});

el.map.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const city = event.target.closest('[data-city]');
  if (!city) return;
  event.preventDefault();
  selectCity(city.dataset.city);
});

el.marketTable.addEventListener('click', (event) => {
  const buy = event.target.closest('[data-buy]');
  const sell = event.target.closest('[data-sell]');
  if (buy) {
    const goodId = buy.dataset.buy;
    const amount = ui.qty === 'max' ? maxAffordable(state, goodId) : ui.qty;
    buyGoods(state, goodId, amount);
    afterAction();
  } else if (sell) {
    const goodId = sell.dataset.sell;
    const amount = ui.qty === 'max' ? (state.goods[goodId] || 0) : ui.qty;
    sellGoods(state, goodId, amount);
    afterAction();
  }
});

el.caravanScroll.addEventListener('click', (event) => {
  const supplyBuy = event.target.closest('[data-buy-supply]');
  const supplyUse = event.target.closest('[data-use-supply]');
  const transport = event.target.closest('[data-buy-transport]');
  if (supplyBuy) {
    buySupplies(state, supplyBuy.dataset.buySupply, Number(supplyBuy.dataset.amount) || 1);
    afterAction();
  } else if (supplyUse) {
    if (supplyUse.dataset.useSupply === 'water') drink(state);
    else eat(state);
    afterAction();
  } else if (transport) {
    const id = transport.dataset.buyTransport;
    if (state.owned.includes(id)) equipTransport(state, id);
    else buyTransport(state, id);
    afterAction();
  }
});

el.journal.addEventListener('click', (event) => {
  const choice = event.target.closest('[data-choice]');
  if (!choice || !state.event) return;
  const dest = state.travel?.destId;
  resolveEvent(state, Number(choice.dataset.choice));
  if (dest && !state.travel && state.cityId === dest) ui.selectedCity = suggestDestination();
  afterAction();
});

el.overlayRoot.addEventListener('click', (event) => {
  const action = event.target.closest('[data-overlay-action]')?.dataset.overlayAction;
  if (!action) return;
  if (action === 'close') {
    closeOverlay();
    if (ui.overlayStatus) ui.overlayStatus = null;
    return;
  }
  if (action === 'start') {
    startNewJourney($('#merchantName')?.value || 'Merchant');
    return;
  }
  if (action === 'continue') {
    continueSavedJourney();
    return;
  }
  if (action === 'confirm-new') {
    clearSave();
    savedGame = null;
    state = null;
    showSplash();
    return;
  }
  if (action === 'keep-trading') {
    continueTrading(state);
    ui.overlayStatus = null;
    closeOverlay();
    saveGame();
    render();
    return;
  }
  if (action === 'new-after-end') {
    clearSave();
    savedGame = null;
    state = null;
    showSplash();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (ui.overlayKind === 'help' || ui.overlayKind === 'confirm') closeOverlay();
    if (ui.overlayStatus === 'won' && ui.overlayKind === 'end') {
      continueTrading(state);
      ui.overlayStatus = null;
      closeOverlay();
      saveGame();
      render();
    }
  }
  if (!state || ui.overlayKind) return;
  const active = document.activeElement;
  if (active && ['INPUT', 'TEXTAREA'].includes(active.tagName)) return;
  if (event.key === 'j') setMobileTab('journal');
  if (event.key === 'm') setMobileTab('market');
  if (event.key === 'r') setMobileTab('road');
  if (event.key === '?') showHelp();
});

// ------------------------------------------------------------------ boot

savedGame = readSave();
ui.selectedCity = savedGame ? suggestDestinationFor(savedGame) : null;
setMobileTab('road');
showSplash();

function suggestDestinationFor(game) {
  const origin = CITY_BY_ID[game.cityId];
  const candidates = CITIES.filter((city) => city.id !== game.cityId)
    .map((city) => ({
      city,
      score: Math.hypot(city.x - origin.x, city.y - origin.y) + (game.visited.includes(city.id) ? 600 : 0),
    }))
    .sort((a, b) => a.score - b.score);
  return candidates.length ? candidates[0].city.id : null;
}
