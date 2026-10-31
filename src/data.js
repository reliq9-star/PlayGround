// The Salt Road — static world data.
// Prices are in silver; distances are in leagues; weights are in load units.

export const GOODS = {
  wheat:  { name: 'Wheat',  base: 8,  weight: 1,    kind: 'grain' },
  corn:   { name: 'Corn',   base: 7,  weight: 1,    kind: 'grain' },
  barley: { name: 'Barley', base: 6,  weight: 1,    kind: 'grain' },
  oats:   { name: 'Oats',   base: 5,  weight: 1,    kind: 'grain' },
  hay:    { name: 'Hay',    base: 3,  weight: 0.5,  kind: 'fodder' },
  flour:  { name: 'Flour',  base: 15, weight: 1,    kind: 'grain' },
  honey:  { name: 'Honey',  base: 24, weight: 0.5,  kind: 'luxury' },
  salt:   { name: 'Salt',   base: 18, weight: 0.75, kind: 'salt' },
  wool:   { name: 'Wool',   base: 22, weight: 0.6,  kind: 'textile' },
  cloth:  { name: 'Cloth',  base: 55, weight: 0.5,  kind: 'textile' },
  dates:  { name: 'Dates',  base: 12, weight: 0.4,  kind: 'food' },
  spices: { name: 'Spices', base: 78, weight: 0.2,  kind: 'spice' },
  copper: { name: 'Copper', base: 36, weight: 2,    kind: 'metal' },
  iron:   { name: 'Iron',   base: 52, weight: 2.4,  kind: 'metal' },
  wine:   { name: 'Wine',   base: 34, weight: 1,    kind: 'luxury' },
  furs:   { name: 'Furs',   base: 66, weight: 0.9,  kind: 'luxury' },
}

export const GOOD_ORDER = [
  'wheat', 'corn', 'barley', 'oats', 'hay', 'flour', 'honey', 'salt',
  'wool', 'cloth', 'dates', 'spices', 'copper', 'iron', 'wine', 'furs',
]

export const LUXURY_GOODS = ['honey', 'spices', 'wine', 'furs', 'cloth']

export const TRANSPORTS = {
  foot: {
    name: 'On foot', short: 'Foot', price: 0, capacity: 40, speed: 12,
    water: 9, food: 8, energy: 11, fodder: 0, blocked: [],
    blurb: 'A strong back and a patient stride. Slow, but the road is never closed to you.',
  },
  donkey: {
    name: 'Donkey', short: 'Donkey', price: 280, capacity: 110, speed: 18,
    water: 10, food: 9, energy: 9, fodder: 2, blocked: [],
    blurb: 'Sure-footed and stubborn in equal measure. A sensible first purchase.',
  },
  camel: {
    name: 'Camel', short: 'Camel', price: 560, capacity: 180, speed: 22,
    water: 6, food: 8, energy: 8, fodder: 2, blocked: [],
    blurb: 'A ship of the sand. Drinks little, crosses dunes with ease, and complains loudly.',
  },
  horse: {
    name: 'Horse', short: 'Horse', price: 480, capacity: 90, speed: 31,
    water: 12, food: 10, energy: 9, fodder: 3, blocked: [],
    blurb: 'Fast on open ground and costly to keep. Thin margins demand quick feet.',
  },
  ox: {
    name: 'Ox', short: 'Ox', price: 420, capacity: 320, speed: 11,
    water: 13, food: 11, energy: 8, fodder: 3, blocked: ['marsh'],
    blurb: 'Slow as an argument, strong as a millstone. Hauls a fortune, if you can feed it.',
  },
  wagon: {
    name: 'Wagon & horse', short: 'Wagon', price: 980, capacity: 720, speed: 23,
    water: 15, food: 12, energy: 10, fodder: 4, blocked: ['forest', 'marsh', 'desert'],
    blurb: 'A shop on wheels. The greatest hauler on the road, but forests, bogs and dunes stop it dead.',
  },
}

export const TRANSPORT_ORDER = ['foot', 'donkey', 'camel', 'horse', 'ox', 'wagon']

export const TERRAIN = {
  plains:  { name: 'open road',    speed: 1.0,  water: 1.0,  food: 1.0,  energy: 1.0 },
  hills:   { name: 'hills',        speed: 0.82, water: 1.0,  food: 1.0,  energy: 1.15 },
  forest:  { name: 'forest track', speed: 0.72, water: 1.05, food: 1.0,  energy: 1.1 },
  coast:   { name: 'coastal road', speed: 0.9,  water: 1.0,  food: 1.05, energy: 1.0 },
  marsh:   { name: 'marsh',        speed: 0.58, water: 1.2,  food: 1.05, energy: 1.2 },
  desert:  { name: 'desert',       speed: 0.68, water: 1.5,  food: 1.1,  energy: 1.15 },
}

export const CITIES = {
  aldermoor: {
    name: 'Aldermoor', region: 'The Heartland', short: 'Aldermoor', x: 34, y: 20,
    blurb: 'Wheat stubble and whitewashed mills. The whole town smells of bread.',
    produce: ['wheat', 'barley'], demand: ['iron', 'cloth'],
  },
  brindleford: {
    name: 'Brindleford', region: 'The Heartland', short: 'Brindle', x: 24, y: 29,
    blurb: 'Sheep outnumber people. Cloth dries on lines across every lane.',
    produce: ['wool', 'cloth'], demand: ['copper', 'wine'],
  },
  cinderhollow: {
    name: 'Cinderhollow', region: 'The South', short: 'Cinder', x: 46, y: 45,
    blurb: 'Smoke and slag. Furnaces glow through the night and the ale is always warm.',
    produce: ['copper', 'iron'], demand: ['wheat', 'hay'],
  },
  dunescar: {
    name: 'Dunescar', region: 'The Desert', short: 'Dunescar', x: 34, y: 56,
    blurb: 'Mud-brick walls, date palms, and a well that has never run dry.',
    produce: ['dates', 'salt'], demand: ['wheat', 'cloth'],
  },
  eastwatch: {
    name: 'Eastwatch', region: 'The North', short: 'Eastwatch', x: 72, y: 11,
    blurb: 'A cold stone town above the pines, built to watch the eastern road.',
    produce: ['furs', 'iron'], demand: ['wine', 'flour'],
  },
  fairhaven: {
    name: 'Fairhaven', region: 'The Coast', short: 'Fairhaven', x: 82, y: 35,
    blurb: 'White houses above a blue bay; the vineyards run down to the water.',
    produce: ['wine', 'honey'], demand: ['iron', 'salt'],
  },
  goldrun: {
    name: 'Goldrun', region: 'The Heartland', short: 'Goldrun', x: 59, y: 33,
    blurb: 'Tents, spice chests, and a hundred languages. Everything has a price and a story.',
    produce: ['spices', 'salt'], demand: ['wool', 'barley'],
  },
  highmere: {
    name: 'Highmere', region: 'The North', short: 'Highmere', x: 20, y: 12,
    blurb: 'Mist, heather, and shaggy cattle. The furriers work through the short days.',
    produce: ['furs', 'wool'], demand: ['wheat', 'salt'],
  },
  ironvale: {
    name: 'Ironvale', region: 'The North', short: 'Ironvale', x: 68, y: 26,
    blurb: 'Hammerfalls by day, forge-glow by night. The hills ring with metal.',
    produce: ['iron', 'copper'], demand: ['oats', 'hay'],
  },
  kestrel: {
    name: 'Kestrel Point', region: 'The North Coast', short: 'Kestrel', x: 90, y: 18,
    blurb: 'Gulls, salt wind, and drying racks. A hard place that pays well for grain.',
    produce: ['salt', 'furs'], demand: ['wheat', 'honey'],
  },
  larkspur: {
    name: 'Larkspur', region: 'The Heartland', short: 'Larkspur', x: 54, y: 19,
    blurb: 'Orchards and beehives. The honey here is pale as morning.',
    produce: ['honey', 'wine'], demand: ['iron', 'salt'],
  },
  millbrook: {
    name: 'Millbrook', region: 'The Heartland', short: 'Millbrook', x: 44, y: 31,
    blurb: 'Three mills, one bridge, and flour dust in every doorway.',
    produce: ['flour', 'oats'], demand: ['wool', 'copper'],
  },
  northgate: {
    name: 'Northgate', region: 'The North', short: 'N. Gate', x: 46, y: 6,
    blurb: 'The last walled town before the wilds. Fur traders crowd the gate.',
    produce: ['furs', 'barley'], demand: ['wine', 'cloth'],
  },
  oasis: {
    name: 'Oasis Verin', region: 'The Desert', short: 'Oasis', x: 54, y: 58,
    blurb: 'A green jewel in the white waste. Water is cheap; iron is worth its weight in silver.',
    produce: ['dates', 'spices'], demand: ['iron', 'cloth'],
  },
  pebbleton: {
    name: 'Pebbleton', region: 'The West', short: 'Pebbleton', x: 10, y: 49,
    blurb: 'A shingle beach and salt pans. The wind never stops.',
    produce: ['salt', 'hay'], demand: ['cloth', 'wine'],
  },
  quarrys: {
    name: "Quarry's End", region: 'The South', short: 'Quarry', x: 66, y: 47,
    blurb: 'A town built into a copper seam; the tavern floor is always gritty.',
    produce: ['copper', 'iron'], demand: ['wheat', 'honey'],
  },
  redcliff: {
    name: 'Redcliff', region: 'The South Coast', short: 'Redcliff', x: 70, y: 57,
    blurb: 'Red stone over a grey sea. Salt carts creak down to the harbor.',
    produce: ['salt', 'copper'], demand: ['barley', 'cloth'],
  },
  saltmarsh: {
    name: 'Saltmarsh', region: 'The East Coast', short: 'Saltmarsh', x: 86, y: 49,
    blurb: 'Reed beds, salt stacks, and herons. The road floats on wooden planks.',
    produce: ['salt', 'furs'], demand: ['flour', 'wine'],
  },
  thornfield: {
    name: 'Thornfield', region: 'The West', short: 'Thornfield', x: 8, y: 36,
    blurb: 'Gorse, sheep, and a rough market square. Honey is the only thing sweet here.',
    produce: ['wool', 'honey'], demand: ['copper', 'salt'],
  },
  willowmere: {
    name: 'Willowmere', region: 'The West', short: 'Willow', x: 27, y: 42,
    blurb: 'Willows, barley fields, and a green lake. A quiet place to fill a cart.',
    produce: ['barley', 'flour'], demand: ['iron', 'furs'],
  },
}

export const CITY_ORDER = [
  'aldermoor', 'brindleford', 'cinderhollow', 'dunescar', 'eastwatch',
  'fairhaven', 'goldrun', 'highmere', 'ironvale', 'kestrel', 'larkspur',
  'millbrook', 'northgate', 'oasis', 'pebbleton', 'quarrys', 'redcliff',
  'saltmarsh', 'thornfield', 'willowmere',
]

export const ROUTES = [
  ['northgate', 'highmere', 18, 'hills'],
  ['northgate', 'eastwatch', 24, 'plains'],
  ['northgate', 'larkspur', 16, 'plains'],
  ['highmere', 'aldermoor', 20, 'hills'],
  ['highmere', 'brindleford', 22, 'forest'],
  ['eastwatch', 'kestrel', 20, 'forest'],
  ['eastwatch', 'ironvale', 20, 'hills'],
  ['kestrel', 'fairhaven', 18, 'coast'],
  ['kestrel', 'saltmarsh', 24, 'coast'],
  ['aldermoor', 'brindleford', 14, 'plains'],
  ['aldermoor', 'larkspur', 12, 'plains'],
  ['aldermoor', 'millbrook', 15, 'plains'],
  ['larkspur', 'millbrook', 10, 'plains'],
  ['larkspur', 'goldrun', 16, 'plains'],
  ['ironvale', 'goldrun', 14, 'hills'],
  ['ironvale', 'fairhaven', 18, 'forest'],
  ['fairhaven', 'saltmarsh', 14, 'coast'],
  ['fairhaven', 'quarrys', 22, 'hills'],
  ['fairhaven', 'redcliff', 26, 'coast'],
  ['brindleford', 'thornfield', 16, 'plains'],
  ['brindleford', 'willowmere', 12, 'plains'],
  ['millbrook', 'willowmere', 12, 'plains'],
  ['millbrook', 'goldrun', 14, 'plains'],
  ['goldrun', 'cinderhollow', 18, 'hills'],
  ['goldrun', 'quarrys', 16, 'hills'],
  ['willowmere', 'cinderhollow', 18, 'forest'],
  ['willowmere', 'pebbleton', 20, 'marsh'],
  ['thornfield', 'pebbleton', 14, 'marsh'],
  ['cinderhollow', 'dunescar', 22, 'desert'],
  ['cinderhollow', 'quarrys', 16, 'hills'],
  ['quarrys', 'redcliff', 18, 'hills'],
  ['quarrys', 'oasis', 24, 'desert'],
  ['redcliff', 'saltmarsh', 18, 'marsh'],
  ['redcliff', 'oasis', 22, 'desert'],
  ['saltmarsh', 'oasis', 28, 'desert'],
  ['pebbleton', 'dunescar', 24, 'desert'],
  ['dunescar', 'oasis', 16, 'desert'],
]

export const RANKS = [
  { name: 'Peddler', min: 0 },
  { name: 'Hawker', min: 800 },
  { name: 'Trader', min: 2200 },
  { name: 'Merchant', min: 4500 },
  { name: 'Magnate', min: 7000 },
  { name: 'Guildmaster', min: 10000 },
]

export const GOAL = 10000

export const START_COINS = 320
export const START_CITY = 'aldermoor'
