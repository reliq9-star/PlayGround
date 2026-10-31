// Grain & Gold — pure game engine. No DOM, no storage, no timers.
import {
  GOODS, GOOD_BY_ID, CITIES, CITY_BY_ID, TRANSPORTS, TRANSPORT_BY_ID,
  TARGET_WEALTH, START_GOLD, WATER_PRICE, RATION_PRICE, SEASONS, WEATHER,
} from './data.js';

export const INN_COST = 10;
export const MEAL_COST = 6;
export const WELL_COST = 2;
export const HEALER_COST = 30;
export const DISTANCE_SCALE = 0.8;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}

function randomInt(state, min, max) {
  return min + Math.floor(random(state) * (max - min + 1));
}

function pushLog(state, kind, text) {
  state.log.push({ day: state.day, kind, text });
  if (state.log.length > 90) state.log.splice(0, state.log.length - 90);
}

function note(state, kind, text) {
  pushLog(state, kind, text);
}

export function createGame(name = 'Merchant', seed = Date.now()) {
  const merchantName = String(name || 'Merchant').trim().slice(0, 24) || 'Merchant';
  const state = {
    version: 1,
    name: merchantName,
    rng: (seed >>> 0) || 1,
    day: 1,
    cityId: 'aldermere',
    gold: START_GOLD,
    transport: 'foot',
    owned: ['foot'],
    goods: Object.fromEntries(GOODS.map((g) => [g.id, 0])),
    water: 10,
    rations: 10,
    life: 100,
    energy: 100,
    thirst: 100,
    hunger: 100,
    visited: ['aldermere'],
    tips: [],
    travel: null,
    event: null,
    status: 'playing',
    celebrated: false,
    log: [],
    stats: { earned: 0, spent: 0, trades: 0, miles: 0, days: 1, bestSale: 0 },
    startedAt: Date.now(),
  };
  state.goods.wheat = 20;
  pushLog(state, 'system', `${merchantName}, you have ${START_GOLD} gold, a strong back, and a wagonless dream. The road to fortune begins in Aldermere.`);
  pushLog(state, 'system', 'Buy cheap where a crop is grown. Sell dear where it is scarce. Reach a net worth of 10,000 gold.');

  const origin = CITY_BY_ID[state.cityId];
  const nearby = CITIES
    .filter((city) => city.id !== origin.id)
    .map((city) => ({ city, distance: Math.hypot(city.x - origin.x, city.y - origin.y) }))
    .sort((a, b) => a.distance - b.distance);
  let tip = null;
  for (const { city, distance } of nearby) {
    for (const goodId of origin.exports) {
      if (!city.imports.includes(goodId)) continue;
      const buy = priceAt(state, origin.id, goodId).buy;
      const sell = priceAt(state, city.id, goodId).sell;
      const margin = sell - buy;
      if (margin > 0 && (!tip || margin > tip.margin)) {
        tip = { city, goodId, margin, buy, sell, distance };
      }
    }
    if (tip) break;
  }
  if (tip) {
    const days = Math.max(1, Math.ceil((tip.distance * DISTANCE_SCALE) / TRANSPORT_BY_ID.foot.speed));
    const good = GOOD_BY_ID[tip.goodId];
    pushLog(state, 'system', `A carter's advice: ${origin.name} sells ${good.name.toLowerCase()} for ${tip.buy} gold, and ${tip.city.name} pays ${tip.sell}. It is ${days} days down the road on foot. Buy low, sell high.`);
  }
  return state;
}

export function currentTransport(state) {
  return TRANSPORT_BY_ID[state.transport] || TRANSPORTS[0];
}

export function capacityOf(state) {
  return currentTransport(state).capacity;
}

export function totalGoods(state) {
  return GOODS.reduce((sum, g) => sum + (state.goods[g.id] || 0), 0);
}

export function netWorth(state) {
  const goodsValue = GOODS.reduce((sum, g) => sum + (state.goods[g.id] || 0) * g.base, 0);
  const transportValue = state.owned.reduce((sum, id) => {
    const t = TRANSPORT_BY_ID[id];
    return sum + (id === 'foot' || !t ? 0 : Math.round(t.price * 0.55));
  }, 0);
  return Math.round(state.gold + goodsValue + transportValue + state.water * WATER_PRICE + state.rations * RATION_PRICE);
}

export function seasonFor(state) {
  return SEASONS[Math.floor((state.day - 1) / 12) % SEASONS.length];
}

export function weatherFor(state) {
  return WEATHER[hashString(`weather:${state.day}:${state.cityId}`) % WEATHER.length];
}

export function terrainFor(cityId) {
  const city = CITY_BY_ID[cityId];
  if (!city) return 'the road';
  if (city.region === 'The Emberwaste') return 'the dunes';
  if (city.region === 'Northreach') return 'the high passes';
  if (city.region === 'The Riverlands') return 'the river road';
  if (city.region === 'The Seaboard') return 'the coast road';
  return 'the open road';
}

// ---------------------------------------------------------------- markets

export function priceAt(state, cityId, goodId, day = state.day) {
  const city = CITY_BY_ID[cityId];
  const good = GOOD_BY_ID[goodId];
  if (!city || !good) return { buy: 1, sell: 1, cityMod: 1 };
  let cityMod;
  if (city.exports.includes(goodId)) cityMod = 0.58;
  else if (city.imports.includes(goodId)) cityMod = 1.45;
  else cityMod = 0.89 + (hashString(`${cityId}:${goodId}:neutral`) % 18) / 100;

  const phase = (hashString(`${cityId}:${goodId}`) % 628) / 100;
  const swing = 1 + 0.13 * Math.sin(day * 0.52 + phase) + 0.045 * Math.sin(day * 1.31 + phase * 1.7);
  const raw = good.base * cityMod * swing;
  return {
    buy: Math.max(1, Math.round(raw)),
    sell: Math.max(1, Math.floor(raw * 0.9)),
    cityMod,
    swing,
  };
}

export function marketRows(state) {
  return GOODS.map((good) => {
    const now = priceAt(state, state.cityId, good.id);
    const yesterday = priceAt(state, state.cityId, good.id, state.day - 1);
    let trend = 'flat';
    if (now.buy > yesterday.buy) trend = 'up';
    else if (now.buy < yesterday.buy) trend = 'down';
    const city = CITY_BY_ID[state.cityId];
    return {
      ...good,
      price: now.buy,
      sell: now.sell,
      owned: state.goods[good.id] || 0,
      trend,
      exported: city.exports.includes(good.id),
      imported: city.imports.includes(good.id),
      rumored: state.tips.some((tip) => tip.cityId === state.cityId && tip.goodId === good.id && tip.expires >= state.day),
    };
  });
}

export function buyGoods(state, goodId, qty) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You cannot trade while on the road.' };
  const good = GOOD_BY_ID[goodId];
  if (!good) return { ok: false, msg: 'Unknown good.' };
  const { buy } = priceAt(state, state.cityId, goodId);
  const space = capacityOf(state) - totalGoods(state);
  const affordable = Math.floor(state.gold / buy);
  const amount = Math.max(0, Math.min(Math.floor(qty), space, affordable));
  if (amount <= 0) {
    const msg = space <= 0 ? 'Your caravan is full.' : 'Not enough gold.';
    note(state, 'bad', msg);
    return { ok: false, msg };
  }
  state.gold -= amount * buy;
  state.goods[goodId] = (state.goods[goodId] || 0) + amount;
  state.stats.trades += 1;
  state.stats.spent += amount * buy;
  note(state, 'market', `Bought ${amount} ${good.name.toLowerCase()} at ${buy} gold each — ${amount * buy} gold.`);
  return { ok: true, amount };
}

export function sellGoods(state, goodId, qty) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You cannot trade while on the road.' };
  const good = GOOD_BY_ID[goodId];
  if (!good) return { ok: false, msg: 'Unknown good.' };
  const owned = state.goods[goodId] || 0;
  const amount = Math.max(0, Math.min(Math.floor(qty), owned));
  if (amount <= 0) return { ok: false, msg: `You have no ${good.name.toLowerCase()} to sell.` };
  const { sell } = priceAt(state, state.cityId, goodId);
  const total = amount * sell;
  state.gold += total;
  state.goods[goodId] = owned - amount;
  state.stats.trades += 1;
  state.stats.earned += total;
  state.stats.bestSale = Math.max(state.stats.bestSale, total);
  note(state, 'market', `Sold ${amount} ${good.name.toLowerCase()} at ${sell} gold each — ${total} gold.`);
  return { ok: true, amount };
}

export function maxAffordable(state, goodId) {
  const { buy } = priceAt(state, state.cityId, goodId);
  return Math.max(0, Math.min(Math.floor(state.gold / buy), capacityOf(state) - totalGoods(state)));
}

export function buySupplies(state, kind, qty) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You cannot trade while on the road.' };
  const amount = Math.max(0, Math.floor(qty));
  const price = kind === 'water' ? WATER_PRICE : RATION_PRICE;
  const cost = amount * price;
  if (cost > state.gold) return { ok: false, msg: 'Not enough gold.' };
  if (amount <= 0) return { ok: false, msg: 'Nothing to buy.' };
  state.gold -= cost;
  if (kind === 'water') state.water += amount;
  else state.rations += amount;
  state.stats.spent += cost;
  note(state, 'market', `Bought ${amount} ${kind === 'water' ? 'waterskin' : 'ration sack'}${amount > 1 ? 's' : ''} for ${cost} gold.`);
  return { ok: true, amount };
}

export function drink(state) {
  if (state.water <= 0) return { ok: false, msg: 'Your waterskins are empty.' };
  if (state.thirst >= 100) return { ok: false, msg: 'You are not thirsty.' };
  state.water -= 1;
  state.thirst = Math.min(100, state.thirst + 40);
  note(state, 'good', 'You drink deep from a waterskin.');
  return { ok: true };
}

export function eat(state) {
  if (state.rations <= 0) return { ok: false, msg: 'Your ration sacks are empty.' };
  if (state.hunger >= 100) return { ok: false, msg: 'You are not hungry.' };
  state.rations -= 1;
  state.hunger = Math.min(100, state.hunger + 42);
  note(state, 'good', 'You eat a plain but welcome ration.');
  return { ok: true };
}

// ---------------------------------------------------------------- transport

export function buyTransport(state, transportId) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You cannot visit the stable while on the road.' };
  const t = TRANSPORT_BY_ID[transportId];
  if (!t) return { ok: false, msg: 'Unknown transport.' };
  if (state.owned.includes(transportId)) return equipTransport(state, transportId);
  if (state.gold < t.price) return { ok: false, msg: 'Not enough gold for that purchase.' };
  if (totalGoods(state) > t.capacity) {
    note(state, 'bad', `${t.name} cannot carry your current load. Sell some goods first.`);
    return { ok: false, msg: 'Your load is too heavy.' };
  }
  state.gold -= t.price;
  state.stats.spent += t.price;
  state.owned.push(transportId);
  state.transport = transportId;
  note(state, 'good', `You bought a ${t.name.toLowerCase()} for ${t.price} gold. Your carrying capacity is now ${t.capacity}.`);
  return { ok: true };
}

export function equipTransport(state, transportId) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You cannot change transport on the road.' };
  const t = TRANSPORT_BY_ID[transportId];
  if (!t || !state.owned.includes(transportId)) return { ok: false, msg: 'You do not own that.' };
  if (totalGoods(state) > t.capacity) {
    note(state, 'bad', `The ${t.name.toLowerCase()} cannot carry your load of ${totalGoods(state)}. Sell some goods first.`);
    return { ok: false, msg: 'Load too heavy.' };
  }
  state.transport = transportId;
  note(state, 'system', `You set out with the ${t.name.toLowerCase()} from now on.`);
  return { ok: true };
}

// ---------------------------------------------------------------- city services

function advanceDay(state) {
  state.day += 1;
  state.stats.days = state.day;
  state.tips = state.tips.filter((tip) => tip.expires >= state.day);
}

export function restAtInn(state) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'The inn is back in town.' };
  if (state.gold < INN_COST) return { ok: false, msg: 'The innkeeper wants ten gold.' };
  state.gold -= INN_COST;
  state.energy = Math.min(100, state.energy + 48);
  state.life = Math.min(100, state.life + 10);
  note(state, 'good', `A clean bed and a hot supper at the inn. Energy and spirits restored. (−${INN_COST} gold)`);
  advanceDay(state);
  return { ok: true };
}

export function camp(state) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'You can camp on the road.' };
  state.energy = Math.min(100, state.energy + 22);
  note(state, 'system', 'You sleep under the stars by the town wall. It is free, and it shows.');
  advanceDay(state);
  return { ok: true };
}

export function tavernMeal(state) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'The tavern is back in town.' };
  if (state.gold < MEAL_COST) return { ok: false, msg: 'Not enough gold for a meal.' };
  state.gold -= MEAL_COST;
  state.hunger = Math.min(100, state.hunger + 45);
  state.life = Math.min(100, state.life + 4);
  note(state, 'good', `A bowl of stew, black bread and a little ale. Hunger eased. (−${MEAL_COST} gold)`);
  return { ok: true };
}

export function wellWater(state) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'The well is back in town.' };
  if (state.gold < WELL_COST) return { ok: false, msg: 'The water-seller wants two gold.' };
  state.gold -= WELL_COST;
  state.thirst = Math.min(100, state.thirst + 45);
  note(state, 'good', `Cold well water, sold by the bucket. Thirst eased. (−${WELL_COST} gold)`);
  return { ok: true };
}

export function healer(state) {
  if (state.status !== 'playing' || state.travel || state.event) return { ok: false, msg: 'The healer is back in town.' };
  if (state.gold < HEALER_COST) return { ok: false, msg: 'The healer wants thirty gold.' };
  if (state.life >= 100) return { ok: false, msg: 'You have no wounds worth paying for.' };
  state.gold -= HEALER_COST;
  state.life = Math.min(100, state.life + 35);
  note(state, 'good', `Herbs, a poultice, and a stern lecture about resting. Life restored. (−${HEALER_COST} gold)`);
  return { ok: true };
}

// ---------------------------------------------------------------- travel

export function routeQuote(state, destId) {
  const origin = CITY_BY_ID[state.cityId];
  const dest = CITY_BY_ID[destId];
  if (!origin || !dest || destId === state.cityId) return null;
  const t = currentTransport(state);
  const distance = Math.max(12, Math.round(Math.hypot(origin.x - dest.x, origin.y - dest.y) * DISTANCE_SCALE));
  const days = Math.max(1, Math.ceil(distance / t.speed));
  const thirst = days * t.thirst;
  const hunger = days * t.hunger;
  return {
    distance,
    days,
    energy: days * t.energy,
    thirst,
    hunger,
    waterNeeded: Math.ceil(thirst / 40),
    foodNeeded: Math.ceil(hunger / 42),
    risk: clamp(0.12 + (origin.danger + dest.danger) / 2 + days * 0.004, 0, 0.85),
    transport: t,
    dest,
  };
}

export function startTravel(state, destId) {
  if (state.status !== 'playing' || state.travel || state.event) return false;
  if (!CITY_BY_ID[destId] || destId === state.cityId) return false;
  const quote = routeQuote(state, destId);
  if (!quote) return false;
  const t = currentTransport(state);
  state.travel = {
    destId,
    fromId: state.cityId,
    daysLeft: quote.days,
    totalDays: quote.days,
    distance: quote.distance,
    usedWater: 0,
    usedFood: 0,
    energyStart: state.energy,
    eventIds: [],
  };
  note(state, 'travel', `You set out from ${CITY_BY_ID[state.cityId].name} for ${quote.dest.name}: ${quote.distance} miles, about ${quote.days} day${quote.days > 1 ? 's' : ''} by ${t.name.toLowerCase()}.`);
  runTravel(state);
  return true;
}

function runTravel(state) {
  const t = currentTransport(state);
  while (state.travel && state.travel.daysLeft > 0 && !state.event && state.status === 'playing') {
    state.travel.daysLeft -= 1;
    state.day += 1;
    state.stats.days = state.day;

    state.energy = Math.max(0, state.energy - t.energy);

    if (state.thirst - t.thirst < 30 && state.water > 0) {
      state.water -= 1;
      state.travel.usedWater += 1;
      state.thirst = Math.min(100, state.thirst + 40);
    }
    state.thirst = Math.max(0, state.thirst - t.thirst);

    if (state.hunger - t.hunger < 28 && state.rations > 0) {
      state.rations -= 1;
      state.travel.usedFood += 1;
      state.hunger = Math.min(100, state.hunger + 42);
    }
    state.hunger = Math.max(0, state.hunger - t.hunger);

    let harm = 0;
    if (state.thirst <= 0) harm += 12;
    if (state.hunger <= 0) harm += 8;
    if (state.energy <= 0) harm += 4;
    if (harm > 0) {
      state.life = Math.max(0, state.life - harm);
      note(state, 'bad', `The road takes its toll. ${state.thirst <= 0 ? 'You are parched. ' : ''}${state.hunger <= 0 ? 'Your belly is empty. ' : ''}${state.energy <= 0 ? 'Your legs will barely carry you. ' : ''}Life −${harm}.`);
    }

    if (state.life <= 0) {
      endGame(state, 'dead');
      return;
    }

    const dest = CITY_BY_ID[state.travel.destId];
    if (state.travel.daysLeft > 0 && state.travel.eventIds.length < 2 && random(state) < 0.16 + dest.danger * 0.25) {
      const template = pickEvent(state);
      if (template) {
        state.travel.eventIds.push(template.id);
        state.event = { id: template.id, day: state.day };
        note(state, 'event', template.title);
        break;
      }
    }
  }

  if (state.status !== 'playing') return;
  if (state.travel && !state.event && state.travel.daysLeft <= 0) arrive(state);
}

function arrive(state) {
  const travel = state.travel;
  if (!travel) return;
  const origin = CITY_BY_ID[travel.fromId];
  const dest = CITY_BY_ID[travel.destId];
  state.travel = null;
  state.cityId = travel.destId;
  state.stats.miles += travel.distance;
  if (!state.visited.includes(travel.destId)) state.visited.push(travel.destId);
  const spent = travel.energyStart - state.energy;
  const supplies = [];
  if (travel.usedWater) supplies.push(`${travel.usedWater} waterskin${travel.usedWater > 1 ? 's' : ''}`);
  if (travel.usedFood) supplies.push(`${travel.usedFood} ration sack${travel.usedFood > 1 ? 's' : ''}`);
  note(state, 'travel', `You arrive in ${dest.name} from ${origin.name} after ${travel.totalDays} day${travel.totalDays > 1 ? 's' : ''}. ${supplies.length ? `Provisions used: ${supplies.join(' and ')}.` : ''} Energy −${Math.max(0, spent)}.`);
  note(state, 'system', dest.blurb);
  checkWin(state);
}

function endGame(state, status) {
  state.status = status;
  if (status === 'dead') note(state, 'bad', 'Your journey ends here. The ledger closes.');
}

export function continueTravel(state) {
  if (!state.travel || state.event) return false;
  runTravel(state);
  return true;
}

export function resolveEvent(state, choiceIndex) {
  if (!state.event) return false;
  const template = EVENT_BY_ID[state.event.id];
  if (!template) {
    state.event = null;
    return false;
  }
  const choice = template.choices[choiceIndex];
  if (!choice) return false;
  choice.apply(state);
  state.event = null;
  if (state.life <= 0) {
    endGame(state, 'dead');
    return true;
  }
  checkWin(state);
  if (state.status !== 'playing') return true;
  if (state.travel) runTravel(state);
  return true;
}

// ---------------------------------------------------------------- events

function grantGoods(state, qty) {
  const good = GOODS[randomInt(state, 0, GOODS.length - 1)];
  const space = capacityOf(state) - totalGoods(state);
  const amount = Math.max(0, Math.min(qty, space));
  if (amount > 0) {
    state.goods[good.id] = (state.goods[good.id] || 0) + amount;
    note(state, 'good', `You gain ${amount} ${good.name.toLowerCase()}.`);
  } else {
    note(state, 'bad', 'There is no room left in your caravan.');
  }
  return { good, amount };
}

function loseRandomGoods(state, fraction = 0.15) {
  const carried = GOODS.filter((g) => (state.goods[g.id] || 0) > 0);
  if (!carried.length) {
    note(state, 'bad', 'They find nothing worth taking.');
    return null;
  }
  const good = carried[randomInt(state, 0, carried.length - 1)];
  const amount = Math.max(1, Math.ceil((state.goods[good.id] || 0) * fraction));
  state.goods[good.id] = Math.max(0, (state.goods[good.id] || 0) - amount);
  note(state, 'bad', `You lose ${amount} ${good.name.toLowerCase()}.`);
  return good;
}

function addTip(state) {
  const others = CITIES.filter((c) => c.id !== state.cityId);
  const city = others[randomInt(state, 0, others.length - 1)];
  const good = GOODS[randomInt(state, 0, GOODS.length - 1)];
  if (!state.tips.some((t) => t.cityId === city.id && t.goodId === good.id)) {
    state.tips.push({ cityId: city.id, goodId: good.id, expires: state.day + 12 });
    if (state.tips.length > 6) state.tips.shift();
  }
  note(state, 'good', `Word on the road: ${city.name} is paying dear for ${good.name.toLowerCase()}.`);
}

const EVENT_TEMPLATES = [
  {
    id: 'toll-bridge', weight: 9, title: 'A Toll on the Old Bridge',
    text: 'A chain blocks the stone bridge and a toll-keeper taps a tin cup. "Twelve gold to cross dry-shod," he says. The river below runs fast and brown.',
    choices: [
      {
        label: 'Pay the toll (12 gold)',
        apply(state) {
          if (state.gold >= 12) {
            state.gold -= 12;
            note(state, 'system', 'You pay the toll and cross without wetting a boot.');
          } else {
            note(state, 'bad', 'Your purse is short. The keeper takes a sack of goods instead.');
            loseRandomGoods(state, 0.2);
          }
        },
      },
      {
        label: 'Ford the river upstream',
        apply(state) {
          state.energy = Math.max(0, state.energy - 10);
          if (random(state) < 0.35) {
            state.life = Math.max(0, state.life - 4);
            note(state, 'bad', 'The current knocks you off your feet. You save yourself, but lose a bundle downstream. Life −4.');
            loseRandomGoods(state, 0.12);
          } else {
            note(state, 'system', 'You find a shallow crossing and save your coin. Energy −10.');
          }
        },
      },
    ],
  },
  {
    id: 'bandits', weight: 12, title: 'Bandits on the Road',
    text: 'Three figures step out of the scrub with cudgels and cold smiles. "A small tax for travellers," says the tallest. Their eyes are on your load.',
    choices: [
      {
        label: 'Hand over a tenth of your purse',
        apply(state) {
          const toll = Math.max(3, Math.ceil(state.gold * 0.1));
          state.gold = Math.max(0, state.gold - toll);
          note(state, 'bad', `You pay ${toll} gold and keep your cargo — and your teeth.`);
        },
      },
      {
        label: 'Run for it',
        apply(state) {
          state.energy = Math.max(0, state.energy - 18);
          if (random(state) < 0.55) {
            note(state, 'good', 'You scatter into the brush and outrun them. Energy −18.');
          } else {
            state.life = Math.max(0, state.life - 10);
            note(state, 'bad', 'They catch you at the treeline. Life −10.');
            loseRandomGoods(state, 0.15);
          }
        },
      },
      {
        label: 'Stand your ground',
        apply(state) {
          state.life = Math.max(0, state.life - 12);
          if (random(state) < 0.5) {
            const coins = randomInt(state, 25, 55);
            state.gold += coins;
            note(state, 'good', `You drive them off and take ${coins} gold from their purses. Life −12.`);
          } else {
            note(state, 'bad', 'A cudgel finds your ribs. They take their pick of the load. Life −12.');
            loseRandomGoods(state, 0.12);
          }
        },
      },
    ],
  },
  {
    id: 'broken-axle', weight: 8, title: 'A Cracked Axle', applies: (state) => ['horse', 'wagon'].includes(state.transport),
    text: 'A sharp crack, a lurch, and the wheel sits crooked in the rut. The axle has split clean through. Repairs will cost coin and daylight.',
    choices: [
      {
        label: 'Repair it properly (8 gold, one day)',
        apply(state) {
          state.gold = Math.max(0, state.gold - 8);
          state.day += 1;
          state.energy = Math.max(0, state.energy - 6);
          note(state, 'system', 'You cut a new axle from a roadside ash and limp on. A day is lost.');
        },
      },
      {
        label: 'Lighten the load and press on',
        apply(state) {
          note(state, 'bad', 'You dump cargo to take the weight off the wheel.');
          loseRandomGoods(state, 0.15);
        },
      },
    ],
  },
  {
    id: 'dust-storm', weight: 10, title: 'The Dunes Begin to Sing', applies: (state) => CITY_BY_ID[state.travel?.destId]?.region === 'The Emberwaste',
    text: 'A brown wall of sand climbs out of the east. The wind has a dry, hissing voice. There is no inn here — only the open waste.',
    choices: [
      {
        label: 'Shelter behind the dunes',
        apply(state) {
          state.day += 1;
          state.thirst = Math.max(0, state.thirst - 10);
          if (state.water > 0) {
            state.water -= 1;
            state.travel.usedWater += 1;
          }
          note(state, 'system', 'You wrap your face and wait out the storm. A day and a waterskin are gone.');
        },
      },
      {
        label: 'Push through the storm',
        apply(state) {
          state.thirst = Math.max(0, state.thirst - 30);
          state.energy = Math.max(0, state.energy - 12);
          state.life = Math.max(0, state.life - 8);
          note(state, 'bad', 'Sand scours your skin and fills your mouth. Life −8, thirst −30.');
        },
      },
    ],
  },
  {
    id: 'peddler', weight: 9, title: 'A Peddler with a Covered Cart',
    text: 'A roadside peddler offers a crate with the canvas still tied. "Finest goods from the coast," he swears. "No refunds, no peeking."',
    choices: [
      {
        label: 'Buy the crate (25 gold)',
        apply(state) {
          if (state.gold < 25) {
            note(state, 'bad', 'You count your coins twice. You cannot afford the crate.');
            return;
          }
          state.gold -= 25;
          const { good, amount } = grantGoods(state, randomInt(state, 8, 15));
          if (amount > 0) note(state, 'good', `The crate holds ${amount} ${good.name.toLowerCase()}. Not a bad gamble.`);
        },
      },
      {
        label: 'Ask for news instead',
        apply(state) { addTip(state); },
      },
      {
        label: 'Walk on',
        apply(state) { note(state, 'system', 'You leave the peddler to his mysteries.'); },
      },
    ],
  },
  {
    id: 'spring', weight: 8, title: 'A Spring Under the Willows',
    text: 'Clear water bubbles out of the hillside, ringed by cress and flat stones. Your waterskins have been rattling empty for miles.',
    choices: [
      {
        label: 'Drink your fill',
        apply(state) { state.thirst = Math.min(100, state.thirst + 45); note(state, 'good', 'Cold, sweet water. Thirst eased.'); },
      },
      {
        label: 'Fill every waterskin (+4 water)',
        apply(state) { state.water += 4; note(state, 'good', 'You fill four waterskins at the spring.'); },
      },
      {
        label: 'Rest in the shade',
        apply(state) { state.energy = Math.min(100, state.energy + 22); state.thirst = Math.min(100, state.thirst + 15); note(state, 'good', 'A short rest under the willows. Energy +22.'); },
      },
    ],
  },
  {
    id: 'wolves', weight: 8, title: 'Wolves at Dusk', applies: (state) => CITY_BY_ID[state.travel?.destId]?.region !== 'The Emberwaste',
    text: 'Grey shapes slip between the trees, keeping pace. The leader is thin and bold, and your fire is not yet lit.',
    choices: [
      {
        label: 'Throw them rations (3 rations)',
        apply(state) {
          const given = Math.min(3, state.rations);
          state.rations -= given;
          if (given > 0) note(state, 'system', `You throw ${given} ration sack${given > 1 ? 's' : ''} into the dark. The wolves argue over it and let you pass.`);
          else note(state, 'bad', 'You have nothing to throw. They close in.');
          if (given === 0) { state.life = Math.max(0, state.life - 8); loseRandomGoods(state, 0.1); }
        },
      },
      {
        label: 'Fight them off',
        apply(state) {
          state.life = Math.max(0, state.life - 9);
          if (random(state) < 0.6) {
            const coins = randomInt(state, 8, 24);
            state.gold += coins;
            note(state, 'good', `You kill the leader and sell the pelt at the next village for ${coins} gold. Life −9.`);
          } else {
            note(state, 'bad', 'They harry you through the night and tear open a pack. Life −9.');
            loseRandomGoods(state, 0.1);
          }
        },
      },
    ],
  },
  {
    id: 'fallen-caravan', weight: 7, title: 'A Caravan That Did Not Arrive',
    text: 'A broken cart leans in the ditch. The horses are gone, the canvas is torn, and no one answers your call. A crow watches from the axle.',
    choices: [
      {
        label: 'Search the wreck',
        apply(state) {
          const { good, amount } = grantGoods(state, randomInt(state, 6, 13));
          if (amount > 0) note(state, 'good', `You salvage ${amount} ${good.name.toLowerCase()} from the wreck.`);
          if (random(state) < 0.25) {
            state.life = Math.max(0, state.life - 6);
            note(state, 'bad', 'A nest of rats in the canvas bites your hand. Life −6.');
          }
        },
      },
      {
        label: 'Bury the dead and move on',
        apply(state) {
          state.life = Math.min(100, state.life + 6);
          state.energy = Math.min(100, state.energy + 8);
          note(state, 'good', 'You say what words you can and mark the grave with stones. The road feels lighter. Life +6, energy +8.');
        },
      },
    ],
  },
  {
    id: 'shrine', weight: 6, title: 'A Shrine of the Road',
    text: 'A weathered stone figure stands where two tracks meet. Offerings of ribbon, copper and dried flowers lie at its feet.',
    choices: [
      {
        label: 'Leave an offering (15 gold)',
        apply(state) {
          if (state.gold < 15) {
            note(state, 'bad', 'You have no coin to spare. The shrine keeps its silence.');
            return;
          }
          state.gold -= 15;
          state.life = Math.min(100, state.life + 12);
          state.energy = Math.min(100, state.energy + 15);
          state.thirst = Math.min(100, state.thirst + 10);
          note(state, 'good', 'A warm stillness settles over you. Life +12, energy +15.');
        },
      },
      {
        label: 'Pass by',
        apply(state) { note(state, 'system', 'You touch your brow to the old stone and continue.'); },
      },
    ],
  },
  {
    id: 'caravan-friends', weight: 7, title: 'A Merchant Caravan',
    text: 'Six wagons and a string of mules roll north with bells on their harness. The master reins in beside you and offers the safety of numbers.',
    choices: [
      {
        label: 'Travel with them for a while',
        apply(state) {
          state.energy = Math.min(100, state.energy + 8);
          state.travel.eventIds.push('toll-bridge', 'bandits', 'wolves', 'broken-axle', 'dust-storm', 'flood');
          note(state, 'good', 'You share a fire, a meal and the road. The rest of the journey should be quieter. Energy +8.');
        },
      },
      {
        label: 'Trade news, then part ways',
        apply(state) { addTip(state); },
      },
    ],
  },
  {
    id: 'flood', weight: 8, title: 'The River Has Risen', applies: (state) => CITY_BY_ID[state.travel?.destId]?.region === 'The Riverlands',
    text: 'The ford is gone under brown water. A cart from the other side lies on its side, wheels turning slowly in the current.',
    choices: [
      {
        label: 'Wait for the water to fall',
        apply(state) {
          state.day += 1;
          const given = Math.min(2, state.rations);
          state.rations -= given;
          note(state, 'system', `You make camp and wait. A day passes${given ? '; two rations go with it' : ''}.`);
        },
      },
      {
        label: 'Cross anyway',
        apply(state) {
          if (random(state) < 0.55) {
            state.life = Math.max(0, state.life - 8);
            note(state, 'bad', 'The current takes your legs from under you. You crawl out downstream, bruised and missing cargo. Life −8.');
            loseRandomGoods(state, 0.12);
          } else {
            note(state, 'good', 'You read the current and cross safely, though your boots will never be the same.');
          }
        },
      },
    ],
  },
  {
    id: 'stranded', weight: 7, title: 'A Traveller in Trouble',
    text: 'A thin man sits beside the road with a bleeding ankle and an empty pack. He asks, with great dignity, for something to eat.',
    choices: [
      {
        label: 'Give him two rations',
        apply(state) {
          if (state.rations >= 2) {
            state.rations -= 2;
            state.life = Math.min(100, state.life + 4);
            if (random(state) < 0.7) {
              const coins = randomInt(state, 25, 45);
              state.gold += coins;
              note(state, 'good', `He turns out to be a factor for a coast merchant. He pays you ${coins} gold and remembers your name.`);
            } else {
              note(state, 'good', 'He blesses you and limps on. You feel lighter for it.');
            }
          } else {
            note(state, 'bad', 'You have too little to share. He nods and looks away.');
          }
        },
      },
      {
        label: 'Walk on',
        apply(state) { note(state, 'system', 'You leave him with a nod and a guilty conscience.'); },
      },
    ],
  },
  {
    id: 'milestone', weight: 5, title: 'An Old Milestone',
    text: 'A lichen-covered stone leans at the verge. Someone has scratched a name and a date into it, and beneath that, a line of doggerel.',
    choices: [
      {
        label: 'Read the inscription',
        apply(state) {
          state.energy = Math.min(100, state.energy + 6);
          note(state, 'system', '"The road is long, the purse is light, but the inn fires burn by night." You walk on with a little more spring. Energy +6.');
        },
      },
      {
        label: 'Move on',
        apply(state) { note(state, 'system', 'You leave the old stone to its silence.'); },
      },
    ],
  },
];

const EVENT_BY_ID = Object.fromEntries(EVENT_TEMPLATES.map((e) => [e.id, e]));

function pickEvent(state) {
  const eligible = EVENT_TEMPLATES.filter((e) => !e.applies || e.applies(state));
  const fresh = eligible.filter((e) => !state.travel.eventIds.includes(e.id));
  const pool = fresh.length ? fresh : eligible;
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = random(state) * total;
  for (const template of pool) {
    roll -= template.weight;
    if (roll <= 0) return template;
  }
  return pool[pool.length - 1];
}

export function activeEvent(state) {
  if (!state.event) return null;
  const template = EVENT_BY_ID[state.event.id];
  if (!template) return null;
  return {
    title: template.title,
    text: template.text,
    choices: template.choices.map((c) => ({ label: c.label })),
  };
}

// ---------------------------------------------------------------- win / save

function checkWin(state) {
  if (state.status === 'playing' && !state.celebrated && netWorth(state) >= TARGET_WEALTH) {
    state.status = 'won';
    state.celebrated = true;
    note(state, 'good', `Net worth ${netWorth(state)} gold. You have become a Merchant Prince.`);
  }
}

export function checkStatus(state) {
  if (state.status === 'playing') checkWin(state);
  return state.status;
}

export function continueTrading(state) {
  if (state.status === 'won') {
    state.status = 'playing';
    state.celebrated = true;
  }
  return state.status;
}

export function activeTips(state) {
  return state.tips.filter((tip) => tip.expires >= state.day).map((tip) => ({
    ...tip,
    city: CITY_BY_ID[tip.cityId],
    good: GOOD_BY_ID[tip.goodId],
  }));
}

export function saveText(state) {
  return JSON.stringify({ ...state, savedAt: Date.now() });
}

export function loadGame(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || parsed.version !== 1 || !CITY_BY_ID[parsed.cityId]) return null;
    const base = createGame(parsed.name, parsed.rng || 1);
    const merged = {
      ...base,
      ...parsed,
      goods: { ...base.goods, ...(parsed.goods || {}) },
      stats: { ...base.stats, ...(parsed.stats || {}) },
      tips: Array.isArray(parsed.tips) ? parsed.tips : [],
      log: Array.isArray(parsed.log) ? parsed.log.slice(-90) : base.log,
      owned: Array.isArray(parsed.owned) && parsed.owned.length ? parsed.owned : ['foot'],
    };
    if (!TRANSPORT_BY_ID[merged.transport]) merged.transport = merged.owned[0] || 'foot';
    if (!merged.owned.includes(merged.transport)) merged.owned.push(merged.transport);
    if (!Array.isArray(merged.visited)) merged.visited = [merged.cityId];
    merged.log = merged.log.filter((entry) => entry && typeof entry.text === 'string');
    return merged;
  } catch {
    return null;
  }
}
