import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, priceAt, marketRows, buyGoods, sellGoods, capacityOf, totalGoods,
  buySupplies, drink, eat, routeQuote, startTravel, resolveEvent, activeEvent,
  buyTransport, equipTransport, netWorth, restAtInn, saveText, loadGame,
  checkStatus, continueTrading, activeTips,
} from '../src/engine.js';
import { GOODS, CITIES, CITY_BY_ID, TRANSPORT_BY_ID, TARGET_WEALTH } from '../src/data.js';

function fresh(seed = 42) {
  return createGame('Tester', seed);
}

test('new game starts with sensible kit', () => {
  const s = fresh();
  assert.equal(s.cityId, 'aldermere');
  assert.equal(s.gold, 500);
  assert.equal(s.transport, 'foot');
  assert.equal(s.goods.wheat, 20);
  assert.equal(s.life, 100);
  assert.equal(s.energy, 100);
  assert.equal(s.status, 'playing');
  assert.ok(s.log.length >= 2);
});

test('export goods are cheaper than imported goods', () => {
  const s = fresh();
  const wheat = priceAt(s, 'aldermere', 'wheat');
  const rice = priceAt(s, 'aldermere', 'rice');
  assert.ok(wheat.buy < rice.buy, 'wheat export should be cheaper than imported rice');
  assert.equal(wheat.cityMod, 0.58);
  assert.equal(rice.cityMod, 1.45);
});

test('prices are deterministic for a given day but drift over time', () => {
  const s = fresh();
  const a = priceAt(s, 'saltmere', 'barley', 5);
  const b = priceAt(s, 'saltmere', 'barley', 5);
  assert.deepEqual(a, b);
  const prices = new Set();
  for (let day = 1; day <= 12; day += 1) prices.add(priceAt(s, 'saltmere', 'barley', day).buy);
  assert.ok(prices.size > 1, 'prices should move across days');
});

test('buying respects gold, capacity and stock', () => {
  const s = fresh();
  const before = s.gold;
  const res = buyGoods(s, 'wheat', 5);
  assert.equal(res.ok, true);
  assert.equal(s.goods.wheat, 25);
  assert.ok(s.gold < before);
  const tooMany = buyGoods(s, 'wheat', 100000);
  assert.equal(tooMany.ok, true);
  assert.equal(totalGoods(s), capacityOf(s));
  assert.ok(s.gold >= 0);
  assert.equal(buyGoods(s, 'wheat', 1).ok, false);
});

test('selling moves goods back to gold at market price', () => {
  const s = fresh();
  const { sell } = priceAt(s, 'aldermere', 'flour');
  s.goods.flour = 10;
  const before = s.gold;
  const res = sellGoods(s, 'flour', 4);
  assert.equal(res.ok, true);
  assert.equal(s.goods.flour, 6);
  assert.equal(s.gold, before + sell * 4);
});

test('cannot trade above carrying capacity', () => {
  const s = fresh();
  s.gold = 99999;
  buyGoods(s, 'straw', 10000);
  assert.equal(totalGoods(s), capacityOf(s));
});

test('supplies, drinking and eating restore bars', () => {
  const s = fresh();
  s.thirst = 20;
  s.hunger = 10;
  const water = s.water;
  assert.equal(drink(s).ok, true);
  assert.equal(s.water, water - 1);
  assert.equal(s.thirst, 60);
  const rations = s.rations;
  assert.equal(eat(s).ok, true);
  assert.equal(s.rations, rations - 1);
  assert.equal(s.hunger, 52);
  buySupplies(s, 'water', 3);
  assert.equal(s.water, water - 1 + 3);
});

test('route quote scales distance with transport speed', () => {
  const s = fresh();
  const quoteFoot = routeQuote(s, 'saltmere');
  s.transport = 'horse';
  const quoteHorse = routeQuote(s, 'saltmere');
  assert.equal(quoteFoot.distance, quoteHorse.distance);
  assert.ok(quoteHorse.days <= quoteFoot.days);
  assert.ok(quoteFoot.days >= 1);
  assert.ok(quoteFoot.risk > 0 && quoteFoot.risk < 1);
});

test('travel advances days, spends energy and arrives', () => {
  const s = fresh();
  s.water = 30;
  s.rations = 30;
  const quote = routeQuote(s, 'brindleford');
  const energy = s.energy;
  const ok = startTravel(s, 'brindleford');
  assert.equal(ok, true);
  // Either we arrived, or an event is waiting on the road.
  assert.ok(s.cityId === 'brindleford' || s.event, 'should arrive or meet an event');
  assert.ok(s.energy < energy);
  if (!s.event) {
    assert.ok(s.day >= 1 + quote.days - 1);
    assert.equal(s.cityId, 'brindleford');
    assert.equal(s.travel, null);
    assert.ok(s.visited.includes('brindleford'));
  }
});

test('resolving a road event and pressing on reaches the destination', () => {
  for (let seed = 1; seed < 400; seed += 1) {
    const s = createGame('Tester', seed);
    s.water = 40;
    s.rations = 40;
    startTravel(s, 'saltmere');
    if (s.event) {
      const ev = activeEvent(s);
      assert.ok(ev.choices.length >= 2);
      resolveEvent(s, 0);
      if (s.status === 'playing') {
        assert.ok(s.cityId === 'saltmere' || s.event || s.travel, 'should continue the journey');
      }
      return;
    }
  }
  assert.fail('no seed produced a road event');
});

test('transports must be owned before equipping and capacity is enforced', () => {
  const s = fresh();
  assert.equal(equipTransport(s, 'wagon').ok, false);
  s.gold = 5000;
  assert.equal(buyTransport(s, 'wagon').ok, true);
  assert.equal(s.transport, 'wagon');
  assert.equal(capacityOf(s), TRANSPORT_BY_ID.wagon.capacity);
  s.goods.straw = 400;
  assert.equal(equipTransport(s, 'foot').ok, false, 'foot cannot carry 400 units');
});

test('inn rest advances the day and restores energy', () => {
  const s = fresh();
  s.energy = 20;
  const day = s.day;
  assert.equal(restAtInn(s).ok, true);
  assert.equal(s.day, day + 1);
  assert.ok(s.energy > 20);
});

test('net worth counts goods, transport and supplies', () => {
  const s = fresh();
  s.gold = 100;
  s.goods.wheat = 10;
  s.transport = 'donkey';
  s.owned = ['foot', 'donkey'];
  s.water = 2;
  s.rations = 1;
  const expected = 100 + 10 * 6 + Math.round(240 * 0.55) + 2 + 2;
  assert.equal(netWorth(s), expected);
});

test('reaching the wealth target wins and can be resumed', () => {
  const s = fresh();
  s.gold = TARGET_WEALTH;
  assert.equal(checkStatus(s), 'won');
  assert.equal(continueTrading(s), 'playing');
});

test('save text round-trips through loadGame', () => {
  const s = fresh();
  s.gold = 777;
  s.goods.barley = 9;
  s.day = 8;
  const loaded = loadGame(saveText(s));
  assert.ok(loaded);
  assert.equal(loaded.gold, 777);
  assert.equal(loaded.goods.barley, 9);
  assert.equal(loaded.day, 8);
  assert.equal(loaded.status, s.status);
  assert.equal(loadGame('not json'), null);
});

test('all cities have valid export and import goods', () => {
  const ids = new Set(GOODS.map((g) => g.id));
  for (const city of CITIES) {
    assert.equal(city.exports.length, 2, city.name);
    assert.equal(city.imports.length, 2, city.name);
    for (const id of [...city.exports, ...city.imports]) assert.ok(ids.has(id), `${city.name}: ${id}`);
    assert.ok(CITY_BY_ID[city.id]);
    assert.ok(city.x > 0 && city.x < 700 && city.y > 0 && city.y < 440);
  }
  assert.equal(CITIES.length, 20);
});

test('every market row has a price, trend and ownership', () => {
  const s = fresh();
  const rows = marketRows(s);
  assert.equal(rows.length, GOODS.length);
  for (const row of rows) {
    assert.ok(row.price >= 1);
    assert.ok(row.sell >= 1);
    assert.ok(['up', 'down', 'flat'].includes(row.trend));
    assert.equal(typeof row.owned, 'number');
  }
});

test('tips expire and surface as rumours', () => {
  const s = fresh();
  s.tips.push({ cityId: 'saltmere', goodId: 'wheat', expires: s.day + 3 });
  assert.equal(activeTips(s).length, 1);
  s.day += 10;
  assert.equal(activeTips(s).length, 0);
});
