import {
  CITIES,
  CITY_BY_ID,
  GOODS,
  GOOD_BY_ID,
  GOAL,
  ROADS,
  STARTING_CASH,
  TRANSPORT_BY_ID,
  WEATHER_BY_ID,
  WEATHERS,
  otherEnd,
  roadsFrom,
} from './data.js'

export const SAVE_KEY = 'saltroad.save.v1'
export const BEST_KEY = 'saltroad.best.v1'
export const SAVE_VERSION = 1

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const round = (value) => Math.round(value)
export const pick = (array) => array[Math.floor(Math.random() * array.length)]
export const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
export const chance = (probability) => Math.random() < probability
export const fmt = (value) => Math.round(value).toLocaleString('en-GB')

export function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function initials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'IV'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function currentCity(state) {
  return CITY_BY_ID[state.cityId]
}

export function currentTransport(state) {
  return TRANSPORT_BY_ID[state.transport]
}

export function currentWeather(state) {
  return WEATHER_BY_ID[state.weather] || WEATHERS[0]
}

export function rankFor(value) {
  if (value >= 5200) return 'Salt baron'
  if (value >= GOAL) return 'Golden trader'
  if (value >= 1600) return 'Caravan master'
  if (value >= 850) return 'Merchant'
  if (value >= 420) return 'Chapman'
  return 'Peddler'
}

function createMarket(city) {
  const market = {}
  for (const good of GOODS) {
    let factor
    if (city.exports.includes(good.id)) factor = 0.56 + Math.random() * 0.1
    else if (city.imports.includes(good.id)) factor = 1.33 + Math.random() * 0.15
    else factor = 0.94 + Math.random() * 0.12

    if (city.id === 'aurenne' && city.imports.includes(good.id)) factor += 0.035

    const stockBase = city.exports.includes(good.id)
      ? randInt(52, 92)
      : city.imports.includes(good.id)
        ? randInt(15, 36)
        : randInt(28, 64)

    market[good.id] = {
      price: Math.max(1, round(good.base * factor)),
      stock: stockBase,
      baseFactor: factor,
    }
  }
  return market
}

export function createInitialState(name = 'Ilyan Voss') {
  const markets = {}
  for (const city of CITIES) markets[city.id] = createMarket(city)
  const weather = pick(WEATHERS)

  return {
    version: SAVE_VERSION,
    name: String(name || 'Ilyan Voss').trim() || 'Ilyan Voss',
    day: 1,
    cityId: 'rivermeet',
    cash: STARTING_CASH,
    health: 100,
    energy: 100,
    hunger: 100,
    thirst: 100,
    transport: 'foot',
    cargo: {},
    markets,
    visited: ['rivermeet'],
    reputation: 5,
    trades: 0,
    profit: 0,
    distance: 0,
    events: 0,
    weather: weather.id,
    goal: GOAL,
    retired: false,
    sound: true,
    journal: [
      {
        day: 1,
        text: `You arrive in Rivermeet with ${STARTING_CASH} crowns and a fair pair of boots. The market bells are ringing.`,
      },
    ],
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed?.version !== SAVE_VERSION ||
      !parsed.cityId ||
      !parsed.markets ||
      CITY_BY_ID[parsed.cityId] === undefined
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state))
  } catch {
    /* Storage can be unavailable in private contexts. The game still plays. */
  }
}

export function bestFortune() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0
  } catch {
    return 0
  }
}

export function recordBestFortune(value) {
  try {
    if (value > bestFortune()) localStorage.setItem(BEST_KEY, String(round(value)))
  } catch {
    /* no-op */
  }
}

export function addJournal(state, text) {
  state.journal.unshift({ day: state.day, text })
  state.journal = state.journal.slice(0, 32)
}

export function cargoItems(state) {
  return Object.entries(state.cargo)
    .filter(([, entry]) => entry && entry.qty > 0)
    .map(([id, entry]) => {
      const good = GOOD_BY_ID[id]
      return {
        good,
        qty: entry.qty,
        avgCost: entry.avgCost || 0,
        weight: entry.qty * good.weight,
      }
    })
    .sort((a, b) => b.weight - a.weight)
}

export function cargoWeight(state) {
  return cargoItems(state).reduce((total, item) => total + item.weight, 0)
}

export function cargoCount(state) {
  return cargoItems(state).reduce((total, item) => total + item.qty, 0)
}

export function currentMarket(state, goodId) {
  return state.markets[state.cityId]?.[goodId]
}

export function cargoValue(state) {
  return cargoItems(state).reduce((total, item) => {
    const market = currentMarket(state, item.good.id)
    return total + (market?.price || item.good.base) * item.qty
  }, 0)
}

export function netWorth(state) {
  return Math.round(state.cash + cargoValue(state))
}

export function capacityLeft(state) {
  return Math.max(0, currentTransport(state).capacity - cargoWeight(state))
}

export function quoteTrade(state, goodId, qty, side) {
  const market = currentMarket(state, goodId)
  if (!market || qty <= 0) return { total: 0, average: 0, endPrice: market?.price || 0 }
  let price = market.price
  let total = 0
  for (let index = 0; index < qty; index += 1) {
    total += price
    price *= side === 'buy' ? 1.0065 : 0.9935
    price = Math.max(1, price)
  }
  return {
    total: Math.max(1, round(total)),
    average: total / qty,
    endPrice: Math.max(1, round(price)),
  }
}

export function maxBuyQty(state, goodId) {
  const market = currentMarket(state, goodId)
  if (!market || market.stock <= 0) return 0
  const good = GOOD_BY_ID[goodId]
  const space = capacityLeft(state)
  let qty = 0
  let cash = state.cash
  let price = market.price
  while (qty < market.stock && (qty + 1) * good.weight <= space && cash >= price) {
    cash -= price
    qty += 1
    price *= 1.0065
  }
  return qty
}

export function maxSellQty(state, goodId) {
  return state.cargo[goodId]?.qty || 0
}

export function sizedQty(state, goodId, size, side) {
  const max = side === 'buy' ? maxBuyQty(state, goodId) : maxSellQty(state, goodId)
  if (size === 'max') return max
  return Math.min(Number(size) || 1, max)
}

export function buyGood(state, goodId, qty) {
  const available = maxBuyQty(state, goodId)
  const amount = Math.min(qty, available)
  if (amount <= 0) return null
  const good = GOOD_BY_ID[goodId]
  const market = currentMarket(state, goodId)
  const quote = quoteTrade(state, goodId, amount, 'buy')
  if (quote.total > state.cash) return null

  const previous = state.cargo[goodId]
  const previousQty = previous?.qty || 0
  const previousCost = (previous?.avgCost || 0) * previousQty
  state.cash -= quote.total
  state.cargo[goodId] = {
    qty: previousQty + amount,
    avgCost: (previousCost + quote.total) / (previousQty + amount),
  }
  market.stock = Math.max(0, market.stock - amount)
  market.price = quote.endPrice
  state.trades += 1
  return { good, qty: amount, total: quote.total }
}

export function sellGood(state, goodId, qty) {
  const available = maxSellQty(state, goodId)
  const amount = Math.min(qty, available)
  if (amount <= 0) return null
  const good = GOOD_BY_ID[goodId]
  const market = currentMarket(state, goodId)
  const entry = state.cargo[goodId]
  const quote = quoteTrade(state, goodId, amount, 'sell')
  const costBasis = entry.avgCost * amount
  state.cash += quote.total
  state.profit += quote.total - costBasis
  market.stock += amount
  market.price = quote.endPrice
  entry.qty -= amount
  if (entry.qty <= 0) delete state.cargo[goodId]
  state.trades += 1
  return { good, qty: amount, total: quote.total, profit: quote.total - costBasis }
}

export function routeBetween(fromId, toId) {
  return ROADS.find(
    (road) =>
      (road.a === fromId && road.b === toId) || (road.a === toId && road.b === fromId),
  ) || null
}

export function routeDays(state, route) {
  const transport = currentTransport(state)
  const pace = transport.speed * (state.energy < 25 ? 0.8 : state.energy < 50 ? 0.92 : 1)
  return Math.max(1, Math.ceil((route.distance / pace) * route.pace))
}

export function routeRisk(route) {
  if (route.risk < 0.21) return { label: 'Calm', className: 'risk-low' }
  if (route.risk < 0.29) return { label: 'Watchful', className: 'risk-mid' }
  return { label: 'Risky', className: 'risk-high' }
}

export function travelPreview(state, route) {
  const transport = currentTransport(state)
  const days = routeDays(state, route)
  return {
    days,
    distance: route.distance,
    water: Math.round(transport.water * days),
    food: Math.round(transport.food * days),
    energy: Math.round(transport.energy * days),
    thirstAfter: clamp(state.thirst - transport.water * days, 0, 100),
    hungerAfter: clamp(state.hunger - transport.food * days, 0, 100),
    energyAfter: clamp(state.energy - transport.energy * days, 0, 100),
  }
}

export function rollWeather(terrain = 'plains') {
  const bag = ['clear', 'clear', 'overcast', 'overcast', 'wind']
  if (terrain === 'desert') bag.push('heat', 'heat', 'heat', 'clear', 'wind')
  else if (terrain === 'forest' || terrain === 'river') bag.push('rain', 'rain', 'fog', 'overcast')
  else if (terrain === 'coast') bag.push('rain', 'fog', 'wind')
  else if (terrain === 'mountain' || terrain === 'hills') bag.push('wind', 'wind', 'fog', 'rain')
  else bag.push('rain', 'heat')
  return WEATHER_BY_ID[pick(bag)]
}

export function refreshMarkets(state, days = 1) {
  for (let day = 0; day < days; day += 1) {
    for (const city of CITIES) {
      const market = state.markets[city.id]
      if (!market) continue
      for (const good of GOODS) {
        const entry = market[good.id]
        if (!entry) continue
        const base = good.base * entry.baseFactor
        let next = entry.price * 0.94 + base * 0.06
        next *= 1 + (Math.random() * 0.07 - 0.035)
        entry.price = clamp(
          Math.max(1, Math.round(next)),
          Math.max(1, Math.round(base * 0.42)),
          Math.round(base * 2.2),
        )
        const restock = city.exports.includes(good.id) ? randInt(4, 9) : randInt(2, 7)
        entry.stock = clamp(entry.stock + restock, 0, city.exports.includes(good.id) ? 125 : 95)
      }
    }
  }
}

export function advanceDay(state) {
  state.day += 1
  state.weather = rollWeather(currentCity(state).biome).id
  refreshMarkets(state, 1)
}

export function shortestPath(fromId, toId) {
  if (fromId === toId) return [fromId]
  const queue = [[fromId]]
  const seen = new Set([fromId])
  while (queue.length) {
    const path = queue.shift()
    const last = path[path.length - 1]
    for (const road of roadsFrom(last)) {
      const next = otherEnd(road, last)
      if (seen.has(next)) continue
      const nextPath = [...path, next]
      if (next === toId) return nextPath
      seen.add(next)
      queue.push(nextPath)
    }
  }
  return null
}

export function bestMarketTip(state) {
  const city = currentCity(state)
  const neighbours = roadsFrom(city.id).map((road) => CITY_BY_ID[otherEnd(road, city.id)])
  for (const goodId of city.exports) {
    const buyer = neighbours.find((neighbour) => neighbour.imports.includes(goodId))
    if (buyer) {
      return `${buyer.name} is buying ${GOOD_BY_ID[goodId].name.toLowerCase()} at a premium. A short road, a fair margin.`
    }
  }
  for (const goodId of city.imports) {
    const seller = neighbours.find((neighbour) => neighbour.exports.includes(goodId))
    if (seller) {
      return `${seller.name} produces ${GOOD_BY_ID[goodId].name.toLowerCase()} nearby. Buy there, sell here, and watch the scales.`
    }
  }
  if (city.imports.length) {
    return `${city.name} pays well for ${city.imports.map((id) => GOOD_BY_ID[id].name.toLowerCase()).join(' and ')}. Local scarcity is a merchant's friend.`
  }
  return 'Prices drift with every caravan. Buy where the harvest is heavy; sell where the cupboards are bare.'
}

export function allGoodsIds() {
  return GOODS.map((good) => good.id)
}
