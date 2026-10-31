// The Salt Road — interface, rendering and interaction.
import {
  GOODS, GOOD_ORDER, TRANSPORTS, TRANSPORT_ORDER, CITIES, CITY_ORDER, ROUTES, TERRAIN, GOAL,
} from './data.js'
import * as G from './game.js'

const SAVE_KEY = 'salt-road-save-v1'

const $ = (selector) => document.querySelector(selector)
const fmt = (n) => Math.round(n).toLocaleString('en-US')
const esc = (text) => String(text)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;')

function weightLabel(n) {
  const rounded = Math.round(n * 100) / 100
  return Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function goodsList(ids) {
  return ids.map((id) => GOODS[id].name.toLowerCase()).join(', ')
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return G.ensureState(JSON.parse(raw))
  } catch {
    return null
  }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    /* private browsing, quota, etc. */
  }
}

let saved = loadGame()
let state = saved || G.createState()
if (!saved) save()

const ui = { lot: 1, filter: 'all', selected: null, tab: 'market' }

let toastTimer = null
let modalActions = []
let modalBlocking = false
let lastFocused = null

const statusPanel = $('#statusPanel')
const marketPanel = $('#marketPanel')
const travelPanel = $('#travelPanel')
const journalPanel = $('#journalPanel')
const modalRoot = $('#modalRoot')

// ─────────────────────────────────────────────────────────────────────────────
// Header and shared pieces

function renderHud() {
  const rank = G.rankInfo(G.netWorth(state)).current
  $('#hudDay').textContent = state.day
  $('#hudCoins').textContent = fmt(state.coins)
  $('#hudCoins').parentElement.title = `Net worth ${fmt(G.netWorth(state))} silver`
  $('#hudRank').textContent = rank.name
  $('#hudCity').textContent = CITIES[state.city].name
}

function renderAll() {
  renderHud()
  renderStatus()
  renderMarket()
  renderTravel()
  renderJournal()
}

function rerender({ keepScroll = false } = {}) {
  const scroller = $('.market-scroll')
  const scrollTop = scroller ? scroller.scrollTop : 0
  const focused = document.activeElement
  const focusKey = focused && focused.dataset ? focused.dataset.focusKey : null
  renderAll()
  if (keepScroll && $('.market-scroll')) $('.market-scroll').scrollTop = scrollTop
  if (focusKey) {
    const target = document.querySelector(`[data-focus-key="${focusKey}"]`)
    if (target) target.focus({ preventScroll: true })
  }
}

function toast(message, tone = '') {
  const el = $('#toast')
  el.textContent = message
  el.className = `toast is-visible${tone ? ` toast--${tone}` : ''}`
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3000)
}

// ─────────────────────────────────────────────────────────────────────────────
// Caravan panel

function barRow(key, label) {
  const value = Math.round(state.bars[key])
  const low = value < 25
  return `
    <div class="stat${low ? ' is-low' : ''}">
      <span class="stat-label">${label}</span>
      <div class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${value}">
        <i class="bar-fill bar-fill--${key}" style="width:${value}%"></i>
      </div>
      <span class="stat-value">${value}${low ? '<sup title="Low">!</sup>' : ''}</span>
    </div>`
}

function serviceRow(id) {
  const info = G.serviceInfo(state, id)
  if (!info) return ''
  return `
    <button class="service" data-action="service" data-service="${id}" data-focus-key="svc-${id}"
      ${info.disabled ? 'disabled' : ''} title="${esc(info.disabled ? info.reason : info.meta)}">
      <span class="service-label">${info.label}<small>${info.meta}</small></span>
      <span class="service-cost">${info.costLabel}</span>
    </button>`
}

function renderStatus() {
  const city = CITIES[state.city]
  const transport = TRANSPORTS[state.transport]
  const load = G.getLoad(state)
  const capacity = G.getCapacity(state)
  const loadPct = Math.min(100, (load / capacity) * 100)
  const worth = G.netWorth(state)
  const { current, next } = G.rankInfo(worth)
  const span = next ? next.min - current.min : 1
  const rankPct = next ? Math.min(100, Math.max(0, ((worth - current.min) / span) * 100)) : 100

  const packed = GOOD_ORDER.filter((good) => state.inventory[good] > 0)
  const packValue = packed.reduce((sum, good) => sum + state.inventory[good] * GOODS[good].base, 0)

  const packRows = packed.length
    ? packed.map((good) => `
        <li>
          <span class="pack-name"><b>${state.inventory[good]}</b> × ${GOODS[good].name}</span>
          <span class="pack-load">${weightLabel(state.inventory[good] * GOODS[good].weight)}</span>
        </li>`).join('')
    : '<li class="pack-empty">Your pack is empty. Buy goods at the market.</li>'

  const feedNote = transport.fodder
    ? `<p class="feed-note">Feed ${transport.fodder} hay/day · ${state.inventory.hay} hay in pack <span>(6c per missing unit)</span></p>`
    : ''

  statusPanel.innerHTML = `
    <div class="panel-head">
      <h2>Caravan</h2>
      <span class="panel-aside">${esc(city.region)}</span>
    </div>

    <div class="status-block status-loc">
      <div class="loc-line">
        <h3>${esc(city.name)}</h3>
        <span class="loc-day">Day ${state.day}</span>
      </div>
      <p class="loc-desc">${esc(city.blurb)}</p>
    </div>

    <div class="status-block">
      <div class="transport-card">
        <div>
          <span class="mini-label">Conveyance</span>
          <strong>${esc(transport.name)}</strong>
          <span class="transport-spec">${transport.speed} leagues/day · ${transport.capacity} load</span>
        </div>
        <button class="link-btn" data-action="open-transport" data-focus-key="change-transport">Change</button>
      </div>
      <div class="meter-row">
        <span>Load</span>
        <div class="meter"><i style="width:${loadPct}%"></i></div>
        <span>${weightLabel(load)}/${capacity}</span>
      </div>
      ${feedNote}
    </div>

    <div class="status-block">
      <div class="stat-grid">
        ${barRow('life', 'Life')}
        ${barRow('energy', 'Energy')}
        ${barRow('thirst', 'Thirst')}
        ${barRow('hunger', 'Hunger')}
      </div>
      <p class="body-note">Empty bars drain life on the road.</p>
    </div>

    <div class="status-block">
      <div class="block-head">
        <span>In town</span>
        <span class="mini-label">${fmt(state.coins)} silver</span>
      </div>
      <div class="services">
        ${['drink', 'meal', 'rest', 'heal', 'work'].map(serviceRow).join('')}
      </div>
    </div>

    <div class="status-block">
      <div class="block-head">
        <span>The pack</span>
        <span class="mini-label">${fmt(packValue)}c at base</span>
      </div>
      <ul class="pack">${packRows}</ul>
    </div>

    <div class="status-block status-rank">
      <div class="block-head">
        <span>Standing</span>
        <span class="rank-name">${current.name}</span>
      </div>
      <div class="meter meter--rank"><i style="width:${rankPct}%"></i></div>
      <p class="rank-note">${next
        ? `${fmt(Math.max(0, next.min - worth))} silver to ${next.name} · net worth ${fmt(worth)}`
        : `Charter fulfilled · net worth ${fmt(worth)}`}</p>
    </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Market panel

function renderMarket() {
  const city = CITIES[state.city]
  const event = G.cityEvent(state, state.city)
  const worth = G.netWorth(state)

  const shown = GOOD_ORDER.filter((good) => {
    if (ui.filter === 'surplus') return city.produce.includes(good)
    if (ui.filter === 'wanted') return city.demand.includes(good)
    if (ui.filter === 'packed') return state.inventory[good] > 0
    return true
  })

  const rows = shown.map((goodId) => {
    const good = GOODS[goodId]
    const market = state.markets[state.city][goodId]
    const held = state.inventory[goodId]
    const max = G.maxBuy(state, goodId)
    const buyQty = ui.lot === 'max' ? max : Math.min(ui.lot, max)
    const sellQty = ui.lot === 'max' ? held : Math.min(ui.lot, held)
    const buyPrice = G.quote(state, state.city, goodId, Math.max(1, buyQty), 'buy')
    const sellPrice = G.quote(state, state.city, goodId, Math.max(1, sellQty), 'sell')
    const delta = Math.round((buyPrice / good.base - 1) * 100)
    const deltaClass = delta <= -8 ? 'is-cheap' : delta >= 8 ? 'is-dear' : 'is-even'
    const deltaText = delta === 0 ? '±0%' : `${delta < 0 ? '−' : '+'}${Math.abs(delta)}%`
    const tag = city.produce.includes(goodId)
      ? '<span class="tag tag--surplus">surplus</span>'
      : city.demand.includes(goodId)
        ? '<span class="tag tag--wanted">wanted</span>'
        : ''
    const stockLow = market.stock < 15

    return `
      <tr>
        <td class="good-cell">
          <span class="good-name">${good.name} ${tag}</span>
          <span class="good-sub">${weightLabel(good.weight)} load · held ${held}${goodId === 'hay' ? ' · fodder' : ''}</span>
        </td>
        <td class="num">
          <span class="price">${buyPrice}</span>
          <span class="delta ${deltaClass}" title="Price against base value">${deltaText}</span>
        </td>
        <td class="num"><span class="price price--sell">${sellPrice}</span></td>
        <td class="num stock-col"><span class="${stockLow ? 'stock-low' : ''}">${market.stock}</span></td>
        <td class="actions-cell">
          <button class="trade-btn trade-btn--buy" data-action="buy" data-good="${goodId}"
            data-focus-key="buy-${goodId}" ${buyQty ? '' : 'disabled'}
            aria-label="Buy ${buyQty} ${good.name}">Buy${buyQty ? ` ${buyQty}` : ''}</button>
          <button class="trade-btn trade-btn--sell" data-action="sell" data-good="${goodId}"
            data-focus-key="sell-${goodId}" ${sellQty ? '' : 'disabled'}
            aria-label="Sell ${sellQty} ${good.name}">Sell${sellQty ? ` ${sellQty}` : ''}</button>
        </td>
      </tr>`
  }).join('')

  const lotButton = (value, label) => `
    <button class="chip-btn${ui.lot === value ? ' is-active' : ''}" data-action="set-lot"
      data-lot="${value}" data-focus-key="lot-${value}">${label}</button>`
  const filterButton = (value, label) => `
    <button class="chip-btn${ui.filter === value ? ' is-active' : ''}" data-action="set-filter"
      data-filter="${value}" data-focus-key="filter-${value}">${label}</button>`

  marketPanel.innerHTML = `
    <div class="market-top">
      <div class="market-title">
        <span class="kicker">Market · Day ${state.day} · ${esc(city.region)}</span>
        <h2>${esc(city.name)}</h2>
        <p class="city-blurb">${esc(city.blurb)}</p>
      </div>
      <div class="market-balance">
        <span class="mini-label">Purse</span>
        <strong>${fmt(state.coins)}</strong>
        <span class="mini-label">silver</span>
        <span class="worth-line">worth ${fmt(worth)}</span>
      </div>
    </div>

    ${event ? `<div class="market-event"><span class="event-mark" aria-hidden="true">✦</span><p>${esc(G.eventSentence(event))}</p></div>` : ''}

    <div class="market-tools">
      <div class="tool-group">
        <span class="tool-label">Lot</span>
        ${lotButton(1, '1')}${lotButton(5, '5')}${lotButton(10, '10')}${lotButton('max', 'Max')}
      </div>
      <div class="tool-group">
        <span class="tool-label">Show</span>
        ${filterButton('all', 'All')}${filterButton('surplus', 'Surplus')}${filterButton('wanted', 'Wanted')}${filterButton('packed', 'Packed')}
      </div>
    </div>

    <div class="market-scroll">
      <table class="market-table">
        <thead>
          <tr>
            <th scope="col">Good</th>
            <th scope="col" class="num">Buy</th>
            <th scope="col" class="num">Sell</th>
            <th scope="col" class="num stock-col">Stock</th>
            <th scope="col" class="num actions-cell">Trade</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="5" class="empty-row">Nothing here matches that filter.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="market-foot">
      <span>Surplus is cheap. Wanted is dear.</span>
      <span>Prices account for lot size · 8% sell spread, 1c min</span>
    </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Travel panel and chart

function mapChart() {
  const current = state.city
  const near = new Set(G.ADJACENCY[current].map((route) => route.city))

  const lines = ROUTES.map(([a, b]) => {
    const cityA = CITIES[a]
    const cityB = CITIES[b]
    const open = a === current || b === current
    return `<line class="${open ? 'chart-line is-open' : 'chart-line'}"
      x1="${cityA.x}" y1="${cityA.y}" x2="${cityB.x}" y2="${cityB.y}" />`
  }).join('')

  const nodes = CITY_ORDER.map((id) => {
    const city = CITIES[id]
    const isCurrent = id === current
    const isNear = near.has(id)
    const showLabel = isCurrent || isNear
    let anchor = 'middle'
    let lx = city.x
    let ly = city.y + 4.9
    if (city.x > 82) { anchor = 'end'; lx = city.x - 2.2 }
    else if (city.x < 14) { anchor = 'start'; lx = city.x + 2.2 }
    if (city.y > 51) ly = city.y - 3.6
    const label = showLabel
      ? `<text class="chart-label${isCurrent ? ' is-current' : ''}" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(city.short)}</text>`
      : ''
    return `<g class="chart-node${isCurrent ? ' is-current' : ''}${isNear ? ' is-near' : ''}">
      <circle class="chart-hit" cx="${city.x}" cy="${city.y}" r="4.4" data-action="map-city" data-city="${id}" />
      <circle class="chart-dot" cx="${city.x}" cy="${city.y}" r="${isCurrent ? 2.4 : isNear ? 1.9 : 1.4}" />
      ${isCurrent ? `<circle class="chart-ring" cx="${city.x}" cy="${city.y}" r="4" />` : ''}
      ${label}
      <title>${esc(city.name)}</title>
    </g>`
  }).join('')

  return `
    <div class="chart-wrap">
      <svg class="chart" viewBox="0 0 100 64" role="img" aria-label="Route chart of the twenty market towns">
        <text class="chart-title" x="2" y="4.5">CARAVAN CHART</text>
        <text class="chart-compass" x="98" y="4.5" text-anchor="end">N ↑</text>
        ${lines}
        ${nodes}
      </svg>
      <div class="chart-legend">
        <span><i class="legend-dot legend-dot--you"></i>You</span>
        <span><i class="legend-dot"></i>Market town</span>
        <span>Tap a nearby town</span>
      </div>
    </div>`
}

function routeRow(entry) {
  const dest = CITIES[entry.city]
  const plan = G.planTravel(state, entry.city)
  const event = G.cityEvent(state, entry.city)
  const selected = ui.selected === entry.city

  const eventBadge = event
    ? `<span class="event-badge" title="${esc(G.eventShort(event))}">✦</span>`
    : ''

  if (plan.blocked) {
    return `
      <div class="route is-blocked" title="${esc(plan.blocked)}">
        <span class="route-main">
          <span class="route-name">${esc(dest.name)} ${eventBadge}</span>
          <span class="route-meta">${entry.leagues} leagues · ${esc(TERRAIN[entry.terrain].name)}</span>
          <span class="route-goods">Surplus ${goodsList(dest.produce)} · Wants ${goodsList(dest.demand)}</span>
          <span class="route-warn">${esc(plan.blocked)}</span>
        </span>
        <span class="route-side"><span class="route-region">${esc(dest.region)}</span><span class="route-lock">✕</span></span>
      </div>`
  }

  const short = []
  if (plan.total.water > state.bars.thirst) short.push('water')
  if (plan.total.food > state.bars.hunger) short.push('food')
  const shortLine = short.length
    ? `<span class="route-warn">Provisions short: ${short.join(' and ')}</span>`
    : ''

  return `
    <button class="route${selected ? ' is-selected' : ''}" data-action="select-dest" data-city="${entry.city}"
      data-focus-key="route-${entry.city}" aria-pressed="${selected}">
      <span class="route-main">
        <span class="route-name">${esc(dest.name)} ${eventBadge}</span>
        <span class="route-meta">${entry.leagues} leagues · ${plan.days} ${plan.days === 1 ? 'day' : 'days'} · ${esc(plan.terrainName)}</span>
        <span class="route-goods">Surplus ${goodsList(dest.produce)} · Wants ${goodsList(dest.demand)}</span>
        ${shortLine}
      </span>
      <span class="route-side">
        <span class="route-region">${esc(dest.region)}</span>
        <span class="route-arrow" aria-hidden="true">→</span>
      </span>
    </button>`
}

function departureBlock() {
  if (!ui.selected || ui.selected === state.city) {
    return `
      <div class="departure is-empty">
        <span class="mini-label">Next journey</span>
        <p>Choose a road to see what it will cost in days, water, food, and feed.</p>
      </div>`
  }
  const plan = G.planTravel(state, ui.selected)
  if (!plan || plan.blocked) {
    ui.selected = null
    return departureBlock()
  }
  const dest = CITIES[ui.selected]
  const warnings = []
  if (plan.total.water > state.bars.thirst) warnings.push('You will run out of water.')
  if (plan.total.food > state.bars.hunger) warnings.push('Your food will not last the journey.')
  if (plan.total.energy > state.bars.energy) warnings.push('You will arrive exhausted.')
  if (plan.feedCost > 0) warnings.push(`Fodder shortfall: ${plan.feedCost} silver for feed.`)

  return `
    <div class="departure">
      <div class="depart-head">
        <div>
          <span class="mini-label">Next journey</span>
          <h3>${esc(dest.name)}</h3>
        </div>
        <span class="depart-days">${plan.days} ${plan.days === 1 ? 'day' : 'days'}<small>arrive day ${state.day + plan.days}</small></span>
      </div>
      <p class="depart-meta">${plan.leagues} leagues · ${esc(plan.terrainName)} · ${esc(TRANSPORTS[state.transport].name)}</p>
      <dl class="provision-list">
        <div><dt>Water</dt><dd class="${plan.total.water > state.bars.thirst ? 'is-warn' : ''}">−${plan.total.water}</dd></div>
        <div><dt>Food</dt><dd class="${plan.total.food > state.bars.hunger ? 'is-warn' : ''}">−${plan.total.food}</dd></div>
        <div><dt>Energy</dt><dd>−${plan.total.energy}</dd></div>
        <div><dt>Feed</dt><dd>${plan.total.fodder ? `${plan.hayAvailable} hay${plan.feedCost ? ` + ${plan.feedCost}c` : ''}` : '—'}</dd></div>
      </dl>
      ${warnings.length ? `<p class="depart-warn">${warnings.join(' ')}</p>` : ''}
      <button class="btn btn-primary depart-btn" data-action="depart" data-focus-key="depart">
        Depart at dawn <span aria-hidden="true">→</span>
      </button>
    </div>`
}

function renderTravel() {
  const transport = TRANSPORTS[state.transport]
  const routes = G.ADJACENCY[state.city].map(routeRow).join('')
  travelPanel.innerHTML = `
    <div class="panel-head">
      <h2>The road</h2>
      <span class="panel-aside">from ${esc(CITIES[state.city].name)}</span>
    </div>
    ${mapChart()}
    <div class="routes">${routes}</div>
    ${departureBlock()}
    <div class="travel-foot">Travelling by ${esc(transport.name)} · ${transport.speed} leagues/day</div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Journal

function renderJournal() {
  const entries = state.log.slice(0, 30).map((entry) => `
    <article class="entry entry--${entry.tone}">
      <span class="entry-meta"><b>D${entry.day}</b><span>${esc(entry.where)}</span></span>
      <p>${esc(entry.text)}</p>
    </article>`).join('')

  journalPanel.innerHTML = `
    <div class="panel-head">
      <h2>Field journal</h2>
      <span class="panel-aside">${state.log.length} entries · day ${state.day}</span>
    </div>
    <div class="journal">${entries || '<p class="empty-row">Nothing written yet.</p>'}</div>
    <div class="journal-actions">
      <button class="text-btn" data-action="how-to">How to play</button>
      <button class="text-btn" data-action="new-game">New ledger</button>
    </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Modals

function openModal({ kicker = '', title, body = '', actions = [], blocking = false, wide = false }) {
  lastFocused = document.activeElement
  modalActions = actions.length ? actions : [{ label: 'Close' }]
  modalBlocking = blocking

  const buttons = modalActions.map((action, index) => `
    <button class="btn ${action.style || ''}" data-modal-action="${index}">${esc(action.label)}</button>`).join('')

  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop></div>
    <div class="modal${wide ? ' modal--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
      ${blocking ? '' : '<button class="modal-x" data-modal-close aria-label="Close">×</button>'}
      <div class="modal-head">
        ${kicker ? `<p class="modal-kicker">${esc(kicker)}</p>` : ''}
        <h2 id="modalTitle">${esc(title)}</h2>
      </div>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">${buttons}</div>
    </div>`
  modalRoot.hidden = false
  document.body.classList.add('modal-open')
  const first = modalRoot.querySelector('[data-modal-action]')
  if (first) first.focus({ preventScroll: true })
}

function closeModal() {
  if (modalRoot.hidden) return
  modalRoot.hidden = true
  modalRoot.innerHTML = ''
  document.body.classList.remove('modal-open')
  if (lastFocused && document.contains(lastFocused)) lastFocused.focus({ preventScroll: true })
}

function showWelcome() {
  openModal({
    kicker: 'A merchant’s ledger',
    title: 'The Salt Road',
    body: `
      <p class="lede">Twenty market towns. One strong back, a little silver, and a road that runs both ways. Buy where the harvest is heavy. Sell where the granaries are empty. Keep the animals fed.</p>
      <ul class="rules-brief">
        <li><b>Trade the gap.</b> Goods marked <em>surplus</em> are cheap here; goods marked <em>wanted</em> are dear. Your lot size moves the price.</li>
        <li><b>Mind the body.</b> Water, food, sleep, and feed all cost something. Empty bars eat your life.</li>
        <li><b>Reach 10,000 silver</b> in net worth and the guild will name you Guildmaster.</li>
      </ul>
      <p class="fine">The ledger saves after every action. There are no second chances on the road.</p>`,
    actions: [
      { label: 'Begin trading', style: 'btn-primary' },
      { label: 'Read the rules', onClick: showHowTo },
    ],
  })
}

function showHowTo() {
  openModal({
    kicker: 'Rules of the road',
    title: 'How to keep a ledger',
    wide: true,
    body: `
      <div class="rules">
        <section>
          <h3>The market</h3>
          <p>Every town produces two goods cheaply and wants two others badly. <b>Surplus</b> goods are sold below their base value; <b>wanted</b> goods above it. The percentage under each buy price is the gap against base value. That gap, minus the 8% sell spread (never less than one silver), is your margin.</p>
          <p>Big lots move the price. Buying a hundred sacks makes the next sack dearer; dumping a hundred sacks floods the market. Choose a lot of 1, 5, 10, or Max, and watch the price change.</p>
        </section>
        <section>
          <h3>The road</h3>
          <p>Each road takes one to three days. Every day consumes water, food, and energy; animals also eat hay. If you do not carry hay, your drover buys feed at 6 silver a unit. The departure card shows the full cost before you go.</p>
          <p>Wagons cannot cross forest, marsh, or desert. Oxen bog down in marsh. Camels cross desert quickly and drink less; horses are fast everywhere except dunes. The chart labels towns one road away from you.</p>
        </section>
        <section>
          <h3>The body</h3>
          <p><b>Life</b> falls when you are hurt, starved, parched, or exhausted. <b>Thirst</b> and <b>hunger</b> fall with every day of travel; when either hits zero, you lose life each day. <b>Energy</b> is spent walking and working, and restored by a bed at the inn.</p>
          <p>Water, meals, beds, and surgeons are sold in every town. If you are broke, a day’s labour pays 22–34 silver.</p>
        </section>
        <section>
          <h3>The goal</h3>
          <p>Net worth is silver on hand, goods valued at base price, and 70% of your conveyance. Reach <b>${fmt(GOAL)} silver</b> and the guild opens its doors. Die on the road and the ledger closes where it lies.</p>
        </section>
        <section>
          <h3>Small mercies</h3>
          <p>Rumours in the journal mark gluts, shortages, and festivals. A glut is a buying opportunity; a shortage is a selling opportunity. Their prices last several days.</p>
          <p>The game saves automatically. “New ledger” starts over and erases the old run.</p>
        </section>
      </div>`,
    actions: [{ label: 'Back to the ledger', style: 'btn-primary' }],
  })
}

function showTransportModal() {
  const current = TRANSPORTS[state.transport]
  const load = G.getLoad(state)
  const tradeIn = Math.round(current.price * 0.55)

  const options = TRANSPORT_ORDER.map((id) => {
    const option = TRANSPORTS[id]
    const isCurrent = id === state.transport
    const net = option.price - tradeIn
    const tooHeavy = load > option.capacity
    const afford = net <= state.coins
    const disabled = isCurrent || tooHeavy || !afford
    let label = 'Choose'
    if (isCurrent) label = 'In use'
    else if (tooHeavy) label = 'Too much cargo'
    else if (!afford) label = `Need ${fmt(net - state.coins)} more`
    else if (net > 0) label = `Pay ${fmt(net)}`
    else if (net < 0) label = `Receive ${fmt(-net)}`
    else label = 'Take it'

    const blocked = option.blocked.length
      ? `Cannot cross: ${option.blocked.map((terrain) => TERRAIN[terrain].name).join(', ')}`
      : 'All roads open'

    return `
      <div class="transport-option${isCurrent ? ' is-current' : ''}">
        <div class="transport-option-main">
          <span class="transport-name">${esc(option.name)} ${isCurrent ? '<span class="tag tag--current">in use</span>' : ''}</span>
          <p class="transport-blurb">${esc(option.blurb)}</p>
          <div class="transport-chips">
            <span>${option.capacity} load</span>
            <span>${option.speed} leagues/day</span>
            <span>${option.fodder ? `${option.fodder} hay/day` : 'no feed'}</span>
            <span>${option.price ? `${fmt(option.price)}c` : 'free'}</span>
          </div>
          <p class="transport-road">${esc(blocked)}</p>
        </div>
        <button class="btn btn-small" data-modal-buy="${id}" ${disabled ? 'disabled' : ''}
          title="${esc(isCurrent ? 'Already yours' : tooHeavy ? 'Sell some cargo first' : !afford ? 'Not enough silver' : 'Trade in your current conveyance')}">${label}</button>
      </div>`
  }).join('')

  openModal({
    kicker: 'The stable yard',
    title: 'Choose a conveyance',
    wide: true,
    body: `
      <p class="modal-lede">Your conveyance sets your cargo capacity, speed, and daily feed. Your current mount trades in for 55% of its price.</p>
      <div class="transport-list">${options}</div>
      <p class="fine">Selling down is allowed. If the new conveyance is cheaper, the difference comes back to you.</p>`,
    actions: [{ label: 'Close' }],
  })
}

function showNewGameConfirm() {
  openModal({
    kicker: 'A clean page',
    title: 'Begin a new ledger?',
    body: `
      <p>This erases the current run: <b>${fmt(state.coins)} silver</b>, day ${state.day}, ${G.rankInfo(G.netWorth(state)).current.name}, ${state.stats.trips} journeys.</p>
      <p class="fine">There is no way back. The old ledger will not be saved.</p>`,
    actions: [
      { label: 'Keep this ledger' },
      { label: 'Start over', style: 'btn-danger', onClick: restartGame },
    ],
  })
}

function travelReportBody(report) {
  const used = []
  if (report.used.water) used.push(`<div><dt>Water</dt><dd>−${report.used.water}</dd></div>`)
  if (report.used.food) used.push(`<div><dt>Food</dt><dd>−${report.used.food}</dd></div>`)
  if (report.used.energy) used.push(`<div><dt>Energy</dt><dd>−${report.used.energy}</dd></div>`)
  if (report.used.hay) used.push(`<div><dt>Hay</dt><dd>−${report.used.hay}</dd></div>`)
  if (report.used.coins) used.push(`<div><dt>Fodder</dt><dd>−${report.used.coins}c</dd></div>`)

  const timeline = report.events.length
    ? report.events.map((event) => `
        <div class="report-event report-event--${event.tone}">
          <span class="report-day">D${event.day}</span>
          <p>${esc(event.text)}</p>
        </div>`).join('')
    : report.died
      ? '<p class="muted report-quiet">The road runs on. Your ledger does not.</p>'
      : '<p class="muted report-quiet">An uneventful road. The ruts are deep and the sky is wide.</p>'

  const arrival = report.died ? `
      <div class="report-warning">
        <p><b>You did not reach ${esc(CITIES[report.to].name)}.</b> The ledger ends on the road, ${report.days} ${report.days === 1 ? 'day' : 'days'} out.</p>
      </div>` : `
      <div class="arrival">
        <span class="kicker">${esc(CITIES[report.to].region)}</span>
        <p class="arrival-text">${esc(CITIES[report.to].blurb)}</p>
        ${report.marketEvent ? `<p class="arrival-rumor"><span aria-hidden="true">✦</span> ${esc(report.marketEvent)}</p>` : ''}
      </div>`

  return `
    <div class="report-legs">
      <span class="kicker">${esc(CITIES[report.from].name)} → ${esc(CITIES[report.to].name)}</span>
      <p>${report.leagues} leagues · ${report.days} ${report.days === 1 ? 'day' : 'days'} · ${esc(report.terrain)}</p>
    </div>
    <dl class="report-used">${used.join('')}</dl>
    ${report.warnings.length ? `<div class="report-warnings">${report.warnings.map((warning) => `<p>${esc(warning)}</p>`).join('')}</div>` : ''}
    <div class="report-timeline">${timeline}</div>
    ${arrival}`
}

function showTravelReport(report) {
  openModal({
    kicker: `Journey report · day ${state.day}`,
    title: report.died ? `The road to ${CITIES[report.to].name}` : `Arrived: ${CITIES[report.to].name}`,
    body: travelReportBody(report),
    actions: report.died
      ? [{ label: 'Read the final page', style: 'btn-primary', onClick: showGameOver }]
      : [{ label: 'Enter the market', style: 'btn-primary', onClick: () => setTab('market') }],
  })
}

function showVictory() {
  state.victoryShown = true
  save()
  const worth = G.netWorth(state)
  openModal({
    kicker: 'The charter is fulfilled',
    title: 'Guildmaster of the Salt Road',
    body: `
      <p class="lede">The guild counts your fortune twice, then opens its heavy doors. Twenty towns know your name. Some of them even pronounce it correctly.</p>
      <div class="tally">
        <div><span>Final worth</span><strong>${fmt(worth)} silver</strong></div>
        <div><span>Days on the road</span><strong>${state.stats.daysOnRoad}</strong></div>
        <div><span>Journeys</span><strong>${state.stats.trips}</strong></div>
        <div><span>Trading profit</span><strong>${fmt(state.stats.profit)} silver</strong></div>
      </div>
      <p class="fine">You may keep trading. The road does not end just because the charter does.</p>`,
    actions: [
      { label: 'Keep trading', style: 'btn-primary' },
      { label: 'New ledger', onClick: showNewGameConfirm },
    ],
  })
}

function showGameOver() {
  const epitaph = {
    thirst: 'They found the waterskin empty and the road still running on ahead.',
    hunger: 'The last of the bread went two days before the last of the walking.',
    road: 'The road keeps what it takes, and asks for no receipt.',
  }[state.deathCause] || 'The road was longer than your strength.'

  openModal({
    kicker: 'The ledger closes',
    title: 'Lost on the road',
    blocking: true,
    body: `
      <p class="lede">${esc(epitaph)}</p>
      <div class="tally">
        <div><span>Days survived</span><strong>${state.day}</strong></div>
        <div><span>Journeys</span><strong>${state.stats.trips}</strong></div>
        <div><span>Trades</span><strong>${state.stats.trades}</strong></div>
        <div><span>Trading profit</span><strong>${fmt(state.stats.profit)} silver</strong></div>
        <div><span>Final worth</span><strong>${fmt(G.netWorth(state))} silver</strong></div>
        <div><span>Standing</span><strong>${G.rankInfo(G.netWorth(state)).current.name}</strong></div>
      </div>
      <p class="fine">Every merchant’s ledger ends somewhere. This one ended ${state.day === 1 ? 'on the first day' : `on day ${state.day}`}.</p>`,
    actions: [{ label: 'Begin a new ledger', style: 'btn-primary', onClick: restartGame }],
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions

function maybeAfterMutation({ keepScroll = false } = {}) {
  if (G.checkVictory(state)) {
    save()
    renderAll()
    showVictory()
    return
  }
  save()
  rerender({ keepScroll })
}

function restartGame() {
  state = G.createState()
  ui.lot = 1
  ui.filter = 'all'
  ui.selected = null
  ui.tab = 'market'
  save()
  renderAll()
  setTab('market')
  toast('A new ledger opens in Aldermoor.', 'good')
}

function depart() {
  if (!ui.selected) return
  const destination = ui.selected
  const result = G.travel(state, destination)
  if (!result.ok) {
    toast(result.msg, 'bad')
    return
  }
  ui.selected = null
  save()
  renderAll()
  showTravelReport(result.report)
}

function setTab(tab) {
  ui.tab = tab
  document.querySelectorAll('.panel[data-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.panel === tab)
  })
  document.querySelectorAll('.tabbar [data-tab]').forEach((button) => {
    const active = button.dataset.tab === tab
    button.classList.toggle('is-active', active)
    button.setAttribute('aria-selected', String(active))
  })
  if (window.scrollY > 120) window.scrollTo(0, 0)
}

function revealDeparture() {
  if (window.innerWidth > 900) return
  const card = document.querySelector('.departure')
  if (!card) return
  const bar = 66
  const rect = card.getBoundingClientRect()
  const hidden = rect.bottom - (window.innerHeight - bar)
  if (hidden > 0) {
    window.scrollTo({ top: window.scrollY + hidden + 12, behavior: 'smooth' })
  }
}

// Main click delegation
document.addEventListener('click', (event) => {
  const el = event.target.closest('[data-action]')
  if (!el || el.disabled) return
  const action = el.dataset.action

  if (action === 'tab') {
    setTab(el.dataset.tab)
    return
  }
  if (action === 'set-lot') {
    ui.lot = el.dataset.lot === 'max' ? 'max' : Number(el.dataset.lot)
    rerender({ keepScroll: true })
    return
  }
  if (action === 'set-filter') {
    ui.filter = el.dataset.filter
    rerender()
    return
  }
  if (action === 'select-dest') {
    ui.selected = el.dataset.city
    renderTravel()
    revealDeparture()
    return
  }
  if (action === 'map-city') {
    const dest = el.dataset.city
    if (dest === state.city) return
    if (!G.ADJACENCY[state.city].some((route) => route.city === dest)) {
      toast(`No direct road from ${CITIES[state.city].name} to ${CITIES[dest].name}.`, 'bad')
      return
    }
    ui.selected = dest
    renderTravel()
    revealDeparture()
    return
  }
  if (action === 'depart') {
    depart()
    return
  }
  if (action === 'buy' || action === 'sell') {
    const good = el.dataset.good
    const requested = ui.lot === 'max' ? Number.MAX_SAFE_INTEGER : ui.lot
    const result = action === 'buy' ? G.tradeBuy(state, good, requested) : G.tradeSell(state, good, requested)
    if (!result.ok) {
      toast(result.msg, 'bad')
      return
    }
    toast(result.msg, result.tone === 'bad' ? 'bad' : 'good')
    maybeAfterMutation({ keepScroll: true })
    return
  }
  if (action === 'service') {
    const result = G.useService(state, el.dataset.service)
    if (!result.ok) {
      toast(result.msg, 'bad')
      return
    }
    toast(result.msg, result.tone === 'bad' ? 'bad' : 'good')
    maybeAfterMutation()
    return
  }
  if (action === 'open-transport') {
    showTransportModal()
    return
  }
  if (action === 'how-to') {
    showHowTo()
    return
  }
  if (action === 'new-game') {
    showNewGameConfirm()
  }
})

// Modal interactions
modalRoot.addEventListener('click', (event) => {
  if (event.target.closest('[data-modal-close]') || event.target.closest('[data-modal-backdrop]')) {
    if (!modalBlocking) closeModal()
    return
  }

  const buyButton = event.target.closest('[data-modal-buy]')
  if (buyButton && !buyButton.disabled) {
    const result = G.buyTransport(state, buyButton.dataset.modalBuy)
    if (!result.ok) {
      toast(result.msg, 'bad')
      return
    }
    toast(result.msg, 'good')
    save()
    renderAll()
    showTransportModal()
    return
  }

  const actionButton = event.target.closest('[data-modal-action]')
  if (!actionButton) return
  const action = modalActions[Number(actionButton.dataset.modalAction)]
  if (!action) return
  closeModal()
  if (action.onClick) action.onClick()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modalRoot.hidden && !modalBlocking) closeModal()
})

// ─────────────────────────────────────────────────────────────────────────────
// Boot

setTab('market')
renderAll()
if (!saved) showWelcome()
else if (state.over) showGameOver()
