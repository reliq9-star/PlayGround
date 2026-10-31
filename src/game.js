// The Salt Road — game rules, economy, travel and survival.
import {
  GOODS, GOOD_ORDER, LUXURY_GOODS, TRANSPORTS, TERRAIN, CITIES, CITY_ORDER,
  ROUTES, RANKS, GOAL, START_COINS, START_CITY,
} from './data.js'

export const SAVE_VERSION = 1

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const rand = (lo, hi) => lo + Math.random() * (hi - lo)
const ri = (lo, hi) => Math.floor(rand(lo, hi + 1))
const pick = (list) => list[Math.floor(Math.random() * list.length)]

function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

// A small, stable per-city personality for otherwise neutral goods.
function cityBias(cityId, goodId) {
  return 0.95 + hash(cityId + ':' + goodId) * 0.1
}

export const ADJACENCY = {}
export const ROUTE_MAP = {}

for (const city of CITY_ORDER) ADJACENCY[city] = []

for (const [a, b, leagues, terrain] of ROUTES) {
  ADJACENCY[a].push({ city: b, leagues, terrain })
  ADJACENCY[b].push({ city: a, leagues, terrain })
  ROUTE_MAP[a + '|' + b] = { leagues, terrain }
  ROUTE_MAP[b + '|' + a] = { leagues, terrain }
}

for (const city of CITY_ORDER) {
  ADJACENCY[city].sort((a, b) => a.leagues - b.leagues)
}

export function baseStock(cityId, goodId) {
  const city = CITIES[cityId]
  if (city.produce.includes(goodId)) return 140
  if (city.demand.includes(goodId)) return 80
  return 80
}

export function restockRate(cityId, goodId) {
  const city = CITIES[cityId]
  if (city.produce.includes(goodId)) return 10
  if (city.demand.includes(goodId)) return 4
  return 5
}

export function cityEvent(state, cityId) {
  return state.events.find((event) => event.city === cityId) || null
}

export function eventSentence(event) {
  if (!event) return ''
  const city = CITIES[event.city].name
  const good = GOODS[event.good].name.toLowerCase()
  if (event.kind === 'glut') return `A bumper ${good} harvest has flooded ${city}. Prices are low.`
  if (event.kind === 'shortage') return `${good[0].toUpperCase() + good.slice(1)} is scarce in ${city} after a lost caravan. Prices are high.`
  return `A festival in ${city} has festival-goers paying over the odds for ${good}.`
}

export function eventShort(event) {
  if (!event) return ''
  const label = event.kind === 'glut' ? 'Glut' : event.kind === 'shortage' ? 'Shortage' : 'Festival'
  return `${label}: ${GOODS[event.good].name.toLowerCase()}`
}

function eventMultiplier(state, cityId, goodId) {
  let mult = 1
  for (const event of state.events) {
    if (event.city !== cityId || event.good !== goodId) continue
    if (event.kind === 'glut') mult *= 0.68
    else if (event.kind === 'shortage') mult *= 1.42
    else if (event.kind === 'festival') mult *= 1.24
  }
  return mult
}

// The raw, per-unit value of a good in a city at a given stock level.
function rawPrice(state, cityId, goodId, stock) {
  const city = CITIES[cityId]
  let mult = 1
  if (city.produce.includes(goodId)) mult = 0.72
  else if (city.demand.includes(goodId)) mult = 1.24
  mult *= cityBias(cityId, goodId)

  const base = baseStock(cityId, goodId)
  mult *= clamp(1 + (base - stock) / (base * 4.2), 0.86, 1.22)
  mult *= state.drift[goodId]
  mult *= eventMultiplier(state, cityId, goodId)
  return Math.max(0.6, GOODS[goodId].base * mult)
}

// Effective unit price for a trade of `qty`. Large lots move the market.
export function quote(state, cityId, goodId, qty = 1, side = 'buy') {
  const stock = state.markets[cityId][goodId].stock
  const spot = rawPrice(state, cityId, goodId, stock)
  const n = Math.max(0, Math.floor(qty || 0))
  const buySpot = Math.max(1, Math.round(spot))
  if (n === 0) {
    if (side === 'sell') return Math.max(1, Math.min(Math.round(spot * 0.92), buySpot - 1))
    return buySpot
  }
  const after = side === 'buy' ? Math.max(0, stock - n) : stock + n
  let avg = (spot + rawPrice(state, cityId, goodId, after)) / 2
  if (side === 'sell') avg *= 0.92
  const price = Math.max(1, Math.round(avg))
  // Integer prices can swallow the sell spread on cheap goods. Keep at least
  // one silver between the two sides so no market is a free round trip.
  if (side === 'sell') return Math.min(price, Math.max(1, buySpot - 1))
  return price
}

export function getCapacity(state) {
  return TRANSPORTS[state.transport].capacity
}

export function getLoad(state) {
  let load = 0
  for (const good of GOOD_ORDER) load += (state.inventory[good] || 0) * GOODS[good].weight
  return Math.round(load * 100) / 100
}

export function maxBuy(state, goodId) {
  const good = GOODS[goodId]
  const market = state.markets[state.city][goodId]
  const space = Math.floor((getCapacity(state) - getLoad(state)) / good.weight + 1e-9)
  const spot = quote(state, state.city, goodId, 1, 'buy')
  let n = Math.min(market.stock, Math.max(0, space), Math.floor(state.coins / spot))
  while (n > 0 && quote(state, state.city, goodId, n, 'buy') * n > state.coins) n -= 1
  return Math.max(0, n)
}

export function maxSell(state, goodId) {
  return state.inventory[goodId] || 0
}

export function netWorth(state) {
  let goods = 0
  for (const good of GOOD_ORDER) goods += (state.inventory[good] || 0) * GOODS[good].base
  const mount = TRANSPORTS[state.transport].price * 0.7
  return Math.round(state.coins + goods + mount)
}

export function rankInfo(worth) {
  let current = RANKS[0]
  let next = null
  for (const rank of RANKS) {
    if (worth >= rank.min) current = rank
    else { next = rank; break }
  }
  return { current, next }
}

export function addLog(state, text, tone = 'system', where) {
  state.log.unshift({
    day: state.day,
    text,
    tone,
    where: where || CITIES[state.city]?.name || '',
  })
  if (state.log.length > 90) state.log.length = 90
}

export function createState() {
  const markets = {}
  for (const cityId of CITY_ORDER) {
    markets[cityId] = {}
    for (const goodId of GOOD_ORDER) {
      markets[cityId][goodId] = { stock: baseStock(cityId, goodId) }
    }
  }

  const drift = {}
  for (const goodId of GOOD_ORDER) drift[goodId] = 1

  const inventory = {}
  const basis = {}
  for (const goodId of GOOD_ORDER) {
    inventory[goodId] = 0
    basis[goodId] = { qty: 0, cost: 0 }
  }

  const state = {
    version: SAVE_VERSION,
    day: 1,
    coins: START_COINS,
    city: START_CITY,
    transport: 'foot',
    bars: { life: 100, energy: 100, thirst: 100, hunger: 100 },
    inventory,
    basis,
    markets,
    drift,
    events: [],
    log: [],
    stats: { trips: 0, trades: 0, profit: 0, distance: 0, daysOnRoad: 0, bestWorth: START_COINS },
    visited: { [START_CITY]: true },
    won: false,
    victoryShown: false,
    over: false,
    deathCause: '',
  }

  addLog(state, `The guild charter sets one goal: a net worth of ${GOAL.toLocaleString('en-US')} silver. Then they will call you Guildmaster.`, 'tip')
  addLog(state, 'Aldermoor’s granaries are full. Wheat and barley are cheap here; iron and cloth are dear.', 'tip')
  addLog(state, 'You arrive in Aldermoor with 320 silver, a strong back, and a licence to trade.', 'system', 'Aldermoor')

  state.stats.bestWorth = netWorth(state)
  return state
}

export function ensureState(state) {
  if (!state || state.version !== SAVE_VERSION) return null
  if (!state.bars || !state.markets || !state.inventory || !Array.isArray(state.log)) return null
  state.events ||= []
  state.visited ||= { [state.city]: true }
  state.basis ||= {}
  state.markets[state.city] ||= {}
  for (const goodId of GOOD_ORDER) {
    state.inventory[goodId] ??= 0
    state.basis[goodId] ||= { qty: 0, cost: 0 }
    state.markets[state.city][goodId] ||= { stock: baseStock(state.city, goodId) }
  }
  state.stats ||= { trips: 0, trades: 0, profit: 0, distance: 0, daysOnRoad: 0, bestWorth: 0 }
  state.stats.bestWorth ||= netWorth(state)
  return state
}

export function tradeBuy(state, goodId, requested) {
  const good = GOODS[goodId]
  const market = state.markets[state.city][goodId]
  const available = maxBuy(state, goodId)
  const qty = Math.min(Math.max(0, Math.floor(requested)), available)
  if (qty <= 0) {
    if (market.stock <= 0) return { ok: false, msg: `There is no ${good.name.toLowerCase()} left in the market.` }
    if (getCapacity(state) - getLoad(state) < good.weight) return { ok: false, msg: 'Your pack is full. Sell something first.' }
    return { ok: false, msg: `You cannot afford another ${good.name.toLowerCase()}.` }
  }
  const unit = quote(state, state.city, goodId, qty, 'buy')
  const cost = unit * qty
  if (cost > state.coins) return { ok: false, msg: 'Not enough silver for that lot.' }

  state.coins -= cost
  state.inventory[goodId] += qty
  market.stock = Math.max(0, market.stock - qty)
  state.basis[goodId].qty += qty
  state.basis[goodId].cost += cost
  state.stats.trades += 1
  state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
  return {
    ok: true,
    qty,
    unit,
    msg: `Bought ${qty} ${good.name.toLowerCase()} for ${cost} silver.`,
    tone: 'good',
  }
}

export function tradeSell(state, goodId, requested) {
  const good = GOODS[goodId]
  const market = state.markets[state.city][goodId]
  const qty = Math.min(Math.max(0, Math.floor(requested)), state.inventory[goodId] || 0)
  if (qty <= 0) return { ok: false, msg: `You have no ${good.name.toLowerCase()} to sell.` }

  const unit = quote(state, state.city, goodId, qty, 'sell')
  const proceeds = unit * qty
  const basis = state.basis[goodId] || { qty: 0, cost: 0 }
  const avgCost = basis.qty > 0 ? basis.cost / basis.qty : good.base
  const profit = Math.round(proceeds - avgCost * qty)

  state.coins += proceeds
  state.inventory[goodId] -= qty
  market.stock += qty
  state.stats.trades += 1
  state.stats.profit += profit
  basis.qty = Math.max(0, basis.qty - qty)
  basis.cost = Math.max(0, basis.cost - avgCost * qty)
  state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))

  const profitBit = profit === 0 ? '' : profit > 0 ? ` (+${profit})` : ` (−${Math.abs(profit)})`
  return {
    ok: true,
    qty,
    unit,
    profit,
    msg: `Sold ${qty} ${good.name.toLowerCase()} for ${proceeds} silver${profitBit}.`,
    tone: profit >= 0 ? 'good' : 'bad',
  }
}

export function serviceInfo(state, id) {
  const coins = state.coins
  const bars = state.bars
  const workPay = '22–34'
  switch (id) {
    case 'drink':
      return {
        label: 'Draw fresh water', meta: '+30 thirst', cost: 2, costLabel: '2c',
        disabled: bars.thirst >= 100 || coins < 2,
        reason: bars.thirst >= 100 ? 'You are not thirsty.' : 'You cannot afford it.',
      }
    case 'meal':
      return {
        label: 'Hot meal', meta: '+28 hunger, +4 energy', cost: 6, costLabel: '6c',
        disabled: bars.hunger >= 100 || coins < 6,
        reason: bars.hunger >= 100 ? 'You are not hungry.' : 'You cannot afford it.',
      }
    case 'rest':
      return {
        label: 'Bed at the inn', meta: '+55 energy, +12 life · 1 day', cost: 14, costLabel: '14c',
        disabled: coins < 14 || (bars.energy >= 98 && bars.life >= 98 && bars.thirst >= 90 && bars.hunger >= 90),
        reason: coins < 14 ? 'You cannot afford the room.' : 'You are rested and whole.',
      }
    case 'heal':
      return {
        label: 'Visit the surgeon', meta: '+45 life', cost: 45, costLabel: '45c',
        disabled: bars.life >= 96 || coins < 45,
        reason: bars.life >= 96 ? 'You have no wounds worth opening.' : 'You cannot afford the surgeon.',
      }
    case 'work':
      return {
        label: 'A day’s labour', meta: `+${workPay} silver, −20 energy · 1 day`, cost: 0, costLabel: `+${workPay}c`,
        disabled: bars.energy < 22 || bars.life < 20,
        reason: bars.life < 20 ? 'You are too weak for hard work.' : 'You are too tired to work.',
      }
    default:
      return null
  }
}

const WORK_LINES = [
  'You spend the day hauling crates at the wharf.',
  'You mend fences for a farmer and his suspicious goat.',
  'You help unload a caravan and earn a few coins for your trouble.',
  'You sweep a tavern, stack barrels, and listen to the gossip.',
  'You carry water to the market stalls until your shoulders ache.',
]

export function useService(state, id) {
  const info = serviceInfo(state, id)
  if (!info) return { ok: false, msg: 'No such service.' }
  if (info.disabled) return { ok: false, msg: info.reason }

  if (id === 'drink') {
    state.coins -= 2
    state.bars.thirst = clamp(state.bars.thirst + 30, 0, 100)
    return { ok: true, msg: 'You drink your fill at the well. (+30 thirst)' }
  }

  if (id === 'meal') {
    state.coins -= 6
    state.bars.hunger = clamp(state.bars.hunger + 28, 0, 100)
    state.bars.energy = clamp(state.bars.energy + 4, 0, 100)
    return { ok: true, msg: 'A hot bowl of stew and fresh bread. (+28 hunger)' }
  }

  if (id === 'rest') {
    state.coins -= 14
    advanceDay(state)
    state.bars.energy = clamp(state.bars.energy + 55, 0, 100)
    state.bars.life = clamp(state.bars.life + 12, 0, 100)
    state.bars.thirst = clamp(state.bars.thirst + 10, 0, 100)
    state.bars.hunger = clamp(state.bars.hunger + 10, 0, 100)
    addLog(state, 'You take a room at the inn and sleep until the bells ring.', 'system')
    state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
    return { ok: true, msg: 'You wake rested. (+55 energy, +12 life)' }
  }

  if (id === 'heal') {
    state.coins -= 45
    state.bars.life = clamp(state.bars.life + 45, 0, 100)
    addLog(state, 'The surgeon cleans your wounds, charges dearly, and sends you on your way.', 'system')
    return { ok: true, msg: 'Stitched, salved, and poorer. (+45 life)' }
  }

  if (id === 'work') {
    const pay = ri(22, 34)
    state.coins += pay
    advanceDay(state)
    state.bars.energy = clamp(state.bars.energy - 20, 0, 100)
    state.bars.thirst = clamp(state.bars.thirst - 4, 0, 100)
    state.bars.hunger = clamp(state.bars.hunger - 4, 0, 100)
    const line = pick(WORK_LINES)
    addLog(state, `${line} (+${pay} silver)`, 'good')
    state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
    return { ok: true, msg: `${line} (+${pay} silver)`, tone: 'good' }
  }

  return { ok: false, msg: 'No such service.' }
}

export function buyTransport(state, id) {
  const next = TRANSPORTS[id]
  const current = TRANSPORTS[state.transport]
  if (!next) return { ok: false, msg: 'No such conveyance.' }
  if (id === state.transport) return { ok: false, msg: 'That is already your conveyance.' }
  if (getLoad(state) > next.capacity + 1e-9) {
    const excess = (getLoad(state) - next.capacity).toFixed(1)
    return { ok: false, msg: `Too much cargo for a ${next.name.toLowerCase()}. Sell ${excess} load first.` }
  }
  const tradeIn = Math.round(current.price * 0.55)
  const net = next.price - tradeIn
  if (net > state.coins) {
    return { ok: false, msg: `You need ${net - state.coins} more silver after trade-in.` }
  }
  state.coins -= net
  state.transport = id
  if (id === 'foot') {
    addLog(state, `You sell the ${current.name.toLowerCase()} and take to the road on foot, ${tradeIn} silver heavier.`, 'system')
  } else {
    addLog(state, `You trade in the ${current.name.toLowerCase()} for a ${next.name.toLowerCase()}. ${net >= 0 ? `${net} silver changes hands.` : `${-net} silver comes back to you.`}`, 'good')
  }
  state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
  return {
    ok: true,
    msg: id === 'foot' ? `You are back on foot. (+${tradeIn} silver)` : `${next.name} acquired.`,
    tone: 'good',
  }
}

export function planTravel(state, destId) {
  if (destId === state.city) return null
  const entry = ADJACENCY[state.city].find((route) => route.city === destId)
  if (!entry) return null
  const transport = TRANSPORTS[state.transport]
  const terrain = TERRAIN[entry.terrain]
  if (transport.blocked.includes(entry.terrain)) {
    return {
      to: destId,
      leagues: entry.leagues,
      terrain: entry.terrain,
      blocked: `${transport.name} cannot cross ${terrain.name}.`,
    }
  }

  let speedFactor = terrain.speed
  let waterFactor = terrain.water
  if (state.transport === 'camel' && entry.terrain === 'desert') {
    speedFactor = 1.18
    waterFactor = 0.75
  }
  if (state.transport === 'horse' && entry.terrain === 'desert') {
    speedFactor = 0.62
    waterFactor = 1.6
  }

  const days = Math.max(1, Math.ceil(entry.leagues / (transport.speed * speedFactor)))
  const perDay = {
    water: Math.max(1, Math.round(transport.water * waterFactor)),
    food: Math.max(1, Math.round(transport.food * terrain.food)),
    energy: Math.max(1, Math.round(transport.energy * terrain.energy)),
    fodder: transport.fodder,
  }
  return {
    to: destId,
    from: state.city,
    leagues: entry.leagues,
    terrain: entry.terrain,
    terrainName: terrain.name,
    days,
    perDay,
    total: {
      water: perDay.water * days,
      food: perDay.food * days,
      energy: perDay.energy * days,
      fodder: perDay.fodder * days,
    },
    hayAvailable: Math.min(state.inventory.hay, perDay.fodder * days),
    feedCost: Math.max(0, perDay.fodder * days - state.inventory.hay) * 6,
    blocked: null,
  }
}

const ROAD_EVENTS = [
  {
    weight: 2,
    when: (plan) => plan.terrain !== 'desert',
    run(state) {
      state.bars.thirst = clamp(state.bars.thirst + 22, 0, 100)
      return { text: 'A clear spring bubbles beside the road. You drink deeply. (+22 thirst)', tone: 'good' }
    },
  },
  {
    weight: 1,
    when: (plan) => plan.terrain !== 'desert',
    run(state) {
      state.bars.thirst = clamp(state.bars.thirst + 12, 0, 100)
      return { text: 'A brief rain sweeps the road. You catch what you can. (+12 thirst)', tone: 'road' }
    },
  },
  {
    weight: 1,
    when: () => true,
    run(state) {
      const found = ri(7, 19)
      state.coins += found
      return { text: `A leather purse lies in the ditch, forgotten or dropped. (+${found} silver)`, tone: 'good' }
    },
  },
  {
    weight: 2,
    when: () => true,
    run(state) {
      state.bars.hunger = clamp(state.bars.hunger + 15, 0, 100)
      state.bars.energy = clamp(state.bars.energy + 5, 0, 100)
      return { text: 'A carter shares bread, cheese, and a little of his wine. (+15 hunger)', tone: 'good' }
    },
  },
  {
    weight: 2,
    when: () => true,
    run(state) {
      const toll = Math.min(state.coins, ri(8, 26))
      state.coins -= toll
      return { text: toll > 0 ? `Riders block the road and demand a toll. (−${toll} silver)` : 'Riders block the road, find your purse empty, and ride off in disgust.', tone: 'bad' }
    },
  },
  {
    weight: 2,
    when: () => true,
    run(state) {
      state.bars.energy = clamp(state.bars.energy + 10, 0, 100)
      return { text: 'The road drops into a long green valley. The walking is easy. (+10 energy)', tone: 'road' }
    },
  },
  {
    weight: 2,
    when: (plan) => plan.transport === 'wagon',
    run(state) {
      const cost = Math.min(state.coins, ri(12, 26))
      state.coins -= cost
      state.bars.energy = clamp(state.bars.energy - 6, 0, 100)
      return { text: `An axle splinters on a stone. Repairs cost ${cost} silver and half a day.`, tone: 'bad' }
    },
  },
  {
    weight: 3,
    when: (plan) => plan.terrain === 'desert',
    run(state) {
      state.bars.thirst = clamp(state.bars.thirst - 14, 0, 100)
      state.bars.life = clamp(state.bars.life - 5, 0, 100)
      return { text: 'A dry wind erases the road for an hour. You emerge cracked and blinded. (−14 thirst, −5 life)', tone: 'bad' }
    },
  },
  {
    weight: 2,
    when: (plan) => plan.terrain === 'marsh',
    run(state) {
      state.bars.energy = clamp(state.bars.energy - 8, 0, 100)
      state.bars.life = clamp(state.bars.life - 3, 0, 100)
      return { text: 'You sink to the knee in black mud and spend an hour hauling free. (−8 energy, −3 life)', tone: 'bad' }
    },
  },
  {
    weight: 2,
    when: (plan) => plan.terrain === 'forest',
    run(state) {
      state.bars.energy = clamp(state.bars.energy - 9, 0, 100)
      state.bars.life = clamp(state.bars.life - 4, 0, 100)
      return { text: 'Eyes follow you through the treeline. You walk hard until dusk. (−9 energy, −4 life)', tone: 'bad' }
    },
  },
  {
    weight: 1,
    when: () => true,
    run(state) {
      state.bars.energy = clamp(state.bars.energy + 8, 0, 100)
      state.bars.life = clamp(state.bars.life + 3, 0, 100)
      return { text: 'A clear night under the stars. You sleep well and wake before the sun. (+8 energy)', tone: 'good' }
    },
  },
  {
    weight: 2,
    when: () => true,
    run(state) {
      state.bars.thirst = clamp(state.bars.thirst + 6, 0, 100)
      state.bars.hunger = clamp(state.bars.hunger + 8, 0, 100)
      return { text: 'A fellow trader shares a flask and news of the road. (+6 thirst, +8 hunger)', tone: 'road' }
    },
  },
]

function roadEvent(state, plan) {
  const candidates = ROAD_EVENTS.filter((event) => !event.when || event.when(plan))
  const total = candidates.reduce((sum, event) => sum + event.weight, 0)
  let roll = Math.random() * total
  let chosen = candidates[0]
  for (const event of candidates) {
    roll -= event.weight
    if (roll <= 0) { chosen = event; break }
  }
  return chosen.run(state)
}

function reduceBasis(state, goodId, qty) {
  const basis = state.basis[goodId]
  if (!basis || qty <= 0) return
  const avg = basis.qty > 0 ? basis.cost / basis.qty : GOODS[goodId].base
  basis.qty = Math.max(0, basis.qty - qty)
  basis.cost = Math.max(0, basis.cost - avg * qty)
}

export function advanceDay(state) {
  state.day += 1

  for (const goodId of GOOD_ORDER) {
    let drift = 1 + (state.drift[goodId] - 1) * 0.965
    drift *= rand(0.985, 1.015)
    state.drift[goodId] = clamp(drift, 0.84, 1.18)
  }

  for (const cityId of CITY_ORDER) {
    for (const goodId of GOOD_ORDER) {
      const market = state.markets[cityId][goodId]
      const cap = baseStock(cityId, goodId) * 1.7
      market.stock = Math.min(cap, market.stock + restockRate(cityId, goodId))
    }
  }

  state.events = state.events.filter((event) => event.ends > state.day)
  if (Math.random() < 0.32) spawnEvent(state)
}

function spawnEvent(state) {
  if (state.events.length >= 4) return
  const busy = new Set(state.events.map((event) => event.city))
  const cities = CITY_ORDER.filter((cityId) => !busy.has(cityId))
  if (!cities.length) return
  const city = pick(cities)
  const roll = Math.random()
  const kind = roll < 0.42 ? 'glut' : roll < 0.8 ? 'shortage' : 'festival'
  const good = kind === 'festival' ? pick(LUXURY_GOODS) : pick(GOOD_ORDER)
  const base = baseStock(city, good)
  const market = state.markets[city][good]

  if (kind === 'glut') market.stock = Math.min(base * 1.7, market.stock + base * 0.7)
  if (kind === 'shortage') market.stock = Math.max(0, Math.round(market.stock * 0.35))

  const event = { city, good, kind, ends: state.day + ri(4, 8) }
  state.events.push(event)
  addLog(state, eventSentence(event), 'market', CITIES[city].name)
}

export function travel(state, destId) {
  const plan = planTravel(state, destId)
  if (!plan) return { ok: false, msg: 'There is no road that way.' }
  if (plan.blocked) return { ok: false, msg: plan.blocked }

  const fromId = state.city
  const report = {
    from: fromId,
    to: destId,
    days: plan.days,
    leagues: plan.leagues,
    terrain: plan.terrainName,
    events: [],
    warnings: [],
    used: { water: 0, food: 0, energy: 0, hay: 0, coins: 0 },
    died: false,
  }

  let waterShort = false
  let foodShort = false
  let energyShort = false
  let beastsHungry = false
  let fodderBought = 0

  for (let d = 1; d <= plan.days; d += 1) {
    advanceDay(state)

    const beforeThirst = state.bars.thirst
    const beforeHunger = state.bars.hunger
    const beforeEnergy = state.bars.energy

    state.bars.thirst = clamp(state.bars.thirst - plan.perDay.water, 0, 100)
    state.bars.hunger = clamp(state.bars.hunger - plan.perDay.food, 0, 100)
    state.bars.energy = clamp(state.bars.energy - plan.perDay.energy, 0, 100)
    report.used.water += beforeThirst - state.bars.thirst
    report.used.food += beforeHunger - state.bars.hunger
    report.used.energy += beforeEnergy - state.bars.energy

    if (plan.perDay.fodder > 0) {
      const need = plan.perDay.fodder
      const useHay = Math.min(need, state.inventory.hay)
      if (useHay > 0) {
        state.inventory.hay -= useHay
        reduceBasis(state, 'hay', useHay)
        report.used.hay += useHay
      }
      const missing = need - useHay
      if (missing > 0) {
        const cost = missing * 6
        const paid = Math.min(cost, state.coins)
        state.coins -= paid
        report.used.coins += paid
        fodderBought += paid
        if (paid < cost) {
          state.bars.life = clamp(state.bars.life - 3, 0, 100)
          if (!beastsHungry) {
            beastsHungry = true
            report.warnings.push('Your beasts went hungry on the road.')
          }
        }
      }
    }

    if (state.bars.thirst <= 0) {
      state.bars.life = clamp(state.bars.life - 14, 0, 100)
      if (!waterShort) {
        waterShort = true
        report.warnings.push('Your water ran out. The thirst bites like a dog.')
      }
    }
    if (state.bars.hunger <= 0) {
      state.bars.life = clamp(state.bars.life - 10, 0, 100)
      if (!foodShort) {
        foodShort = true
        report.warnings.push('Your belly is empty. Hunger gnaws at your strength.')
      }
    }
    if (state.bars.energy <= 0) {
      state.bars.life = clamp(state.bars.life - 8, 0, 100)
      if (!energyShort) {
        energyShort = true
        report.warnings.push('You are running on nothing but stubbornness.')
      }
    }

    if (Math.random() < 0.24) {
      const event = roadEvent(state, { ...plan, transport: state.transport })
      state.bars.life = clamp(state.bars.life, 0, 100)
      state.bars.energy = clamp(state.bars.energy, 0, 100)
      state.bars.thirst = clamp(state.bars.thirst, 0, 100)
      state.bars.hunger = clamp(state.bars.hunger, 0, 100)
      report.events.push({ day: state.day, text: event.text, tone: event.tone })
      addLog(state, event.text, event.tone === 'bad' ? 'bad' : 'road', 'On the road')
    }

    if (state.bars.life <= 0) break
  }

  if (fodderBought > 0) {
    report.warnings.push(`Fodder bought along the road cost ${fodderBought} silver.`)
  }

  state.stats.distance += plan.leagues

  if (state.bars.life <= 0) {
    state.bars.life = 0
    state.over = true
    state.deathCause = waterShort ? 'thirst' : foodShort ? 'hunger' : 'the road'
    report.died = true
    addLog(state, `Your journey ends on the road to ${CITIES[destId].name}. The ledger closes on day ${state.day}.`, 'bad', 'On the road')
    return { ok: true, report }
  }

  state.city = destId
  state.visited[destId] = true
  state.stats.trips += 1
  state.stats.daysOnRoad += plan.days
  state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
  addLog(state, `You reach ${CITIES[destId].name} after ${plan.days} ${plan.days === 1 ? 'day' : 'days'} on the ${plan.terrainName}.`, 'road', CITIES[destId].name)
  report.marketEvent = cityEvent(state, destId) ? eventSentence(cityEvent(state, destId)) : ''
  return { ok: true, report }
}

export function checkVictory(state) {
  if (state.won || state.over) return false
  if (netWorth(state) >= GOAL) {
    state.won = true
    addLog(state, 'The guild counts your fortune twice, then opens its doors. You are Guildmaster of the Salt Road.', 'good')
    state.stats.bestWorth = Math.max(state.stats.bestWorth, netWorth(state))
    return true
  }
  return false
}

export function routeKey(a, b) {
  return a + '|' + b
}
