// Grain & Gold — world data.
// Everything here is static. Prices, weather and events are derived in engine.js.

export const TARGET_WEALTH = 10000;
export const START_GOLD = 500;

export const GOODS = [
  { id: 'wheat', name: 'Wheat', base: 6, note: 'The staff of life. Moves in every market.' },
  { id: 'corn', name: 'Corn', base: 5, note: 'Cheap feed and coarse meal.' },
  { id: 'barley', name: 'Barley', base: 4, note: 'Bread for the poor, malt for the brewer.' },
  { id: 'oats', name: 'Oats', base: 3, note: 'Horse fodder and winter porridge.' },
  { id: 'rye', name: 'Rye', base: 5, note: 'Hardy northern grain.' },
  { id: 'rice', name: 'Rice', base: 9, note: 'A luxury from the warm lowlands.' },
  { id: 'beans', name: 'Beans', base: 7, note: 'Keeps a caravan fed for weeks.' },
  { id: 'hay', name: 'Hay', base: 2, note: 'Bulky, cheap, always wanted by stables.' },
  { id: 'straw', name: 'Straw', base: 1, note: 'Packing, thatch and bedding.' },
  { id: 'flour', name: 'Flour', base: 11, note: 'Milled grain for the cities.' },
  { id: 'malt', name: 'Malt', base: 8, note: 'The brewer\'s gold.' },
  { id: 'hemp', name: 'Hemp', base: 14, note: 'Rope, sailcloth and medicine.' },
];

export const GOOD_BY_ID = Object.fromEntries(GOODS.map((g) => [g.id, g]));

export const TRANSPORTS = [
  {
    id: 'foot', name: 'On Foot', short: 'Foot', price: 0, speed: 22, capacity: 60,
    thirst: 15, hunger: 13, energy: 9,
    blurb: 'A strong pair of boots. Free, honest, and slow.',
  },
  {
    id: 'donkey', name: 'Donkey', short: 'Donkey', price: 240, speed: 30, capacity: 140,
    thirst: 16, hunger: 15, energy: 6,
    blurb: 'Stubborn, sure-footed, and worth every copper.',
  },
  {
    id: 'camel', name: 'Camel', short: 'Camel', price: 560, speed: 38, capacity: 170,
    thirst: 8, hunger: 14, energy: 5,
    blurb: 'Crosses the Emberwaste on a swallow of water.',
  },
  {
    id: 'horse', name: 'Horse', short: 'Horse', price: 900, speed: 46, capacity: 110,
    thirst: 20, hunger: 19, energy: 4,
    blurb: 'Fast on good roads. Thirsty, and proud of it.',
  },
  {
    id: 'ox', name: 'Ox', short: 'Ox', price: 650, speed: 24, capacity: 300,
    thirst: 19, hunger: 18, energy: 7,
    blurb: 'Slow as a sermon, strong as a barn door.',
  },
  {
    id: 'wagon', name: 'Wagon & Horse', short: 'Wagon', price: 1700, speed: 40, capacity: 480,
    thirst: 24, hunger: 22, energy: 3,
    blurb: 'A rolling warehouse. The dream of every trader.',
  },
];

export const TRANSPORT_BY_ID = Object.fromEntries(TRANSPORTS.map((t) => [t.id, t]));

export const WATER_PRICE = 1;
export const RATION_PRICE = 2;

export const CITIES = [
  {
    id: 'aldermere', name: 'Aldermere', region: 'The Riverlands', x: 120, y: 160, danger: 0.06,
    exports: ['wheat', 'flour'], imports: ['rice', 'hemp'],
    blurb: 'Willow-lined canals, floating mills, and the best bread in the west.',
  },
  {
    id: 'brindleford', name: 'Brindleford', region: 'The Riverlands', x: 205, y: 110, danger: 0.08,
    exports: ['wheat', 'barley'], imports: ['beans', 'rice'],
    blurb: 'A ford town of granaries, ferries, and loud bargaining.',
  },
  {
    id: 'cask-hollow', name: 'Cask Hollow', region: 'The Riverlands', x: 78, y: 225, danger: 0.1,
    exports: ['barley', 'malt'], imports: ['wheat', 'hemp'],
    blurb: 'Malt kilns smoke all night. The ale is a local religion.',
  },
  {
    id: 'thornbury', name: 'Thornbury', region: 'The Vales', x: 190, y: 205, danger: 0.12,
    exports: ['oats', 'hay'], imports: ['flour', 'malt'],
    blurb: 'Hedgerows, hayricks, and a market cross worn smooth by farmers.',
  },
  {
    id: 'millhaven', name: 'Millhaven', region: 'The Vales', x: 285, y: 160, danger: 0.1,
    exports: ['flour', 'rye'], imports: ['corn', 'hemp'],
    blurb: 'Waterwheels turn day and night; the air tastes of flour.',
  },
  {
    id: 'dunmoor', name: 'Dunmoor', region: 'The Vales', x: 150, y: 280, danger: 0.14,
    exports: ['beans', 'rye'], imports: ['wheat', 'rice'],
    blurb: 'Peat smoke, cold fens, and fields of sturdy beans.',
  },
  {
    id: 'greyfall', name: 'Greyfall', region: 'Northreach', x: 345, y: 105, danger: 0.16,
    exports: ['oats', 'rye'], imports: ['flour', 'rice'],
    blurb: 'A grey stone town beneath a grey stone sky.',
  },
  {
    id: 'ravensgate', name: 'Ravensgate', region: 'The Vales', x: 405, y: 160, danger: 0.12,
    exports: ['malt', 'hemp'], imports: ['wheat', 'beans'],
    blurb: 'Rope-makers, brewers, and ravens on every gatehouse.',
  },
  {
    id: 'saltmere', name: 'Saltmere', region: 'The Seaboard', x: 285, y: 260, danger: 0.11,
    exports: ['rice', 'beans'], imports: ['wheat', 'malt'],
    blurb: 'Salt pans glitter beyond the wharves. Gulls own the rooftops.',
  },
  {
    id: 'emberfield', name: 'Emberfield', region: 'The Seaboard', x: 465, y: 215, danger: 0.15,
    exports: ['corn', 'hay'], imports: ['rice', 'hemp'],
    blurb: 'Red soil, tall corn, and a horizon of dry grass.',
  },
  {
    id: 'highcairn', name: 'Highcairn', region: 'Northreach', x: 270, y: 55, danger: 0.22,
    exports: ['oats', 'rye'], imports: ['flour', 'corn'],
    blurb: 'A windswept cairn town where the road turns to sky.',
  },
  {
    id: 'fenwick', name: 'Fenwick', region: 'The Riverlands', x: 65, y: 315, danger: 0.13,
    exports: ['hay', 'straw'], imports: ['flour', 'malt'],
    blurb: 'Reed-cutters, thatchers, and a maze of black-water paths.',
  },
  {
    id: 'lowmarch', name: 'Lowmarch', region: 'Southmarch', x: 200, y: 345, danger: 0.12,
    exports: ['beans', 'corn'], imports: ['wheat', 'oats'],
    blurb: 'Flat, fertile, and famous for its enormous bean suppers.',
  },
  {
    id: 'baycross', name: 'Baycross', region: 'The Seaboard', x: 510, y: 125, danger: 0.14,
    exports: ['rice', 'hemp'], imports: ['corn', 'hay'],
    blurb: 'A deep-water port where rice comes in and rope goes out.',
  },
  {
    id: 'goldreach', name: 'Goldreach', region: 'The Seaboard', x: 545, y: 195, danger: 0.13,
    exports: ['malt', 'flour'], imports: ['barley', 'oats'],
    blurb: 'Merchant villas, tiled roofs, and the smell of roasting malt.',
  },
  {
    id: 'sandwatch', name: 'Sandwatch', region: 'The Emberwaste', x: 470, y: 300, danger: 0.27,
    exports: ['beans', 'straw'], imports: ['wheat', 'hay'],
    blurb: 'The last well before the deep dunes. Watch your waterskins.',
  },
  {
    id: 'palmara', name: 'Palmara Oasis', region: 'The Emberwaste', x: 585, y: 260, danger: 0.24,
    exports: ['rice', 'beans'], imports: ['flour', 'malt'],
    blurb: 'Palms, cold springs, and caravans from the far side of the sand.',
  },
  {
    id: 'sunspire', name: 'Sunspire', region: 'The Emberwaste', x: 560, y: 350, danger: 0.29,
    exports: ['hemp', 'malt'], imports: ['wheat', 'corn'],
    blurb: 'A sun-bleached tower and a market that starts before dawn.',
  },
  {
    id: 'redstone', name: 'Redstone', region: 'Southmarch', x: 410, y: 335, danger: 0.18,
    exports: ['corn', 'straw'], imports: ['flour', 'rye'],
    blurb: 'Quarries, cornfields, and a tavern with forty kinds of pie.',
  },
  {
    id: 'kestrels-rest', name: "Kestrel's Rest", region: 'The Vales', x: 345, y: 230, danger: 0.1,
    exports: ['rye', 'hemp'], imports: ['corn', 'barley'],
    blurb: 'A crossroads inn beneath a kestrel-haunted crag.',
  },
];

export const CITY_BY_ID = Object.fromEntries(CITIES.map((c) => [c.id, c]));

export const REGION_LABELS = [
  { name: 'NORTHREACH', x: 300, y: 92 },
  { name: 'THE RIVERLANDS', x: 122, y: 255 },
  { name: 'THE VALES', x: 300, y: 292 },
  { name: 'THE SEABOARD', x: 555, y: 148 },
  { name: 'THE EMBERWASTE', x: 512, y: 338 },
  { name: 'SOUTHMARCH', x: 255, y: 385 },
];

export const SEASONS = ['Early Spring', 'High Spring', 'Early Summer', 'High Summer', 'Early Autumn', 'Late Autumn', 'First Frost', 'Deep Winter'];

export const WEATHER = ['fair skies', 'a brisk wind', 'low cloud', 'thin drizzle', 'warm haze', 'a cold snap'];
