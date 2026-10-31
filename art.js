import { CITIES, CITY_BY_ID, ROADS } from './data.js'

const SCENES = {
  river: {
    sky: ['#c7d6c4', '#f0e0bb'],
    sun: '#e6ba64',
    far: '#91a087',
    mid: '#6f866c',
    near: '#415c48',
    ground: '#304b3a',
    field: '#a4a06e',
    city: '#405441',
    roof: '#2d4234',
    ink: '#243c2d',
    water: '#739a99',
    road: '#c6ae7d',
    window: '#edc36d',
  },
  plains: {
    sky: ['#d2d6b5', '#f3e4bf'],
    sun: '#e9bd62',
    far: '#a9a979',
    mid: '#818e5f',
    near: '#5b6e47',
    ground: '#425737',
    field: '#b9a55e',
    city: '#5a5940',
    roof: '#3e4530',
    ink: '#33412d',
    water: '#8daaaa',
    road: '#ccb17b',
    window: '#eec26b',
  },
  forest: {
    sky: ['#b9c8b1', '#e7d7b3'],
    sun: '#d9aa57',
    far: '#78856b',
    mid: '#596b53',
    near: '#3a4f3d',
    ground: '#2b4133',
    field: '#82905f',
    city: '#3a4a3a',
    roof: '#26382c',
    ink: '#1e3528',
    water: '#6f9290',
    road: '#b09b71',
    window: '#e5b85f',
  },
  coast: {
    sky: ['#bcd4cf', '#f1e2c2'],
    sun: '#e7bb68',
    far: '#8fa698',
    mid: '#6e8c7c',
    near: '#466a5e',
    ground: '#36574d',
    field: '#a4a06d',
    city: '#3e5d58',
    roof: '#2a4642',
    ink: '#24413b',
    water: '#638f95',
    road: '#c8ae7a',
    window: '#edc474',
  },
  desert: {
    sky: ['#e6c89f', '#f7e7c6'],
    sun: '#e6ac52',
    far: '#cd9462',
    mid: '#b97b4f',
    near: '#9f6240',
    ground: '#8d5438',
    field: '#d4a266',
    city: '#7c513d',
    roof: '#57392c',
    ink: '#4c3428',
    water: '#649092',
    road: '#d6b37b',
    window: '#f0c36c',
  },
  highland: {
    sky: ['#b7c4c6', '#eddfc3'],
    sun: '#e4b763',
    far: '#8c9997',
    mid: '#6f7e7b',
    near: '#4c5f5b',
    ground: '#394f48',
    field: '#99966d',
    city: '#4d5b55',
    roof: '#343f3e',
    ink: '#283a36',
    water: '#75949a',
    road: '#c7ae7b',
    window: '#ecc16f',
  },
}

function hashString(value) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function mulberry32(seed) {
  let value = seed
  return () => {
    value += 0x6d2b79f5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296
  }
}

function ridge(y, amplitude, rng, segments = 7, endY = 302) {
  let path = `M0 ${Math.round(y)}`
  for (let index = 1; index <= segments; index += 1) {
    const x = Math.round((900 / segments) * index)
    const nextY = Math.round(y + (rng() - 0.5) * amplitude * 2)
    path += ` L${x} ${nextY}`
  }
  return `${path} L900 ${endY} L0 ${endY} Z`
}

function cloud(x, y, scale, opacity = 0.19) {
  return `<path d="M${x} ${y}q${10 * scale} -${12 * scale} ${25 * scale} -${5 * scale}q${9 * scale} -${12 * scale} ${27 * scale} -${2 * scale}q${16 * scale} ${1 * scale} ${15 * scale} ${10 * scale}h-${67 * scale}z" fill="#fffaf0" opacity="${opacity}"/>`
}

function citySilhouette(city, palette) {
  const domed = city.biome === 'desert'
  const steep = city.biome === 'highland'
  const roof = palette.roof
  const cityFill = palette.city
  const windows = Array.from({ length: 8 }, (_, index) => {
    const x = 22 + (index % 4) * 37 + (index > 3 ? 18 : 0)
    const y = 177 + Math.floor(index / 4) * 20
    return `<rect x="${x}" y="${y}" width="4" height="5" rx="1" fill="${palette.window}" opacity=".86"/>`
  }).join('')

  const towers = domed
    ? `
      <rect x="20" y="162" width="28" height="58" fill="${cityFill}"/>
      <path d="M18 163q16-25 32 0z" fill="${roof}"/>
      <rect x="162" y="154" width="31" height="66" fill="${cityFill}"/>
      <path d="M160 155q16-27 34 0z" fill="${roof}"/>
      <path d="M82 154q22-33 45 0z" fill="${roof}"/>
    `
    : `
      <rect x="20" y="162" width="28" height="58" fill="${cityFill}"/>
      <path d="M17 163 34 ${steep ? 128 : 139} 52 163Z" fill="${roof}"/>
      <rect x="162" y="154" width="31" height="66" fill="${cityFill}"/>
      <path d="M159 155 177 ${steep ? 117 : 130} 196 155Z" fill="${roof}"/>
      <path d="M77 158 103 ${steep ? 111 : 126} 129 158Z" fill="${roof}"/>
    `

  return `
    <g transform="translate(564 0)">
      <path d="M0 221V190h11v-10h10v10h22v-18h17v18h35v-24h20v24h28v-14h15v14h28v-12h10v12h22v29Z" fill="${cityFill}"/>
      ${towers}
      <rect x="74" y="159" width="58" height="62" fill="${cityFill}"/>
      <rect x="92" y="123" width="18" height="42" fill="${cityFill}"/>
      <path d="M88 124 101 101 114 124Z" fill="${roof}"/>
      <path d="M99 101v-13l18 4-18 5" fill="${roof}"/>
      <path d="M101 196v25h18v-25q-9-9-18 0" fill="${palette.ink}" opacity=".82"/>
      <path d="M99 196v25h18v-25q-9-9-18 0" fill="none" stroke="#f1ca78" stroke-width=".8" opacity=".35"/>
      ${windows}
      <rect x="138" y="137" width="2" height="23" fill="${roof}"/>
      <path d="M140 137l14 4-14 5z" fill="#a94f36"/>
      <path d="M33 133c-7-7-5-14 1-18 6 5 7 12 1 18Z" fill="${palette.ink}" opacity=".22"/>
      <path d="M30 215c11-5 20-5 30 0" fill="none" stroke="${palette.ink}" stroke-width="2" opacity=".45"/>
    </g>`
}

function foreground(city, palette, rng) {
  const group = city.biome

  if (group === 'river') {
    return `
      <path d="M0 245c105-13 182 13 278 5 109-9 189-24 306-8 104 14 196 3 316-9v67H0Z" fill="${palette.water}" opacity=".74"/>
      <path d="M0 255c142-8 217 16 332 7 154-13 235-22 370-4 78 11 132 8 198 1" fill="none" stroke="#edf0df" stroke-width="1.4" opacity=".3"/>
      <path d="M0 278c135-9 268 12 382 4 174-12 311-15 518-5" fill="none" stroke="#dbe7de" stroke-width=".9" opacity=".22"/>
      <path d="M430 253c20-7 38-7 60 0l8-8h44l8 8c17-5 31-5 48 2l10 34H423Z" fill="${palette.ink}" opacity=".88"/>
      <path d="M492 246v31M536 246v31" stroke="${palette.road}" stroke-width="2" opacity=".36"/>
      <path d="M304 275c6-8 14-11 24-9M323 277c4-6 10-8 17-6" fill="none" stroke="${palette.ink}" stroke-width="1.4" opacity=".55"/>`
  }

  if (group === 'coast') {
    return `
      <path d="M0 228c152-7 276 13 404 6 168-9 315-14 496-1v70H0Z" fill="${palette.water}" opacity=".78"/>
      <path d="M0 244c116-8 207 5 316 1 186-7 371-14 584-3" fill="none" stroke="#f4efd9" stroke-width="1.2" opacity=".27"/>
      <path d="M0 261c158-6 291 11 447 4 135-6 277-6 453 2" fill="none" stroke="#e4ecdf" stroke-width=".8" opacity=".2"/>
      <path d="M778 195h9v48h-9zM775 191h15l-2-12h-11zM780 179v-7" fill="${palette.ink}" opacity=".8"/>
      <path d="M763 230c13-7 29-7 43 0l6 17h-55Z" fill="${palette.ink}" opacity=".35"/>
      <path d="M724 236c5 0 5 3 10 3s5-3 10-3" fill="none" stroke="#f5efda" stroke-width="1.1" opacity=".5"/>`
  }

  if (group === 'desert') {
    return `
      <path d="M0 252c79-20 149-20 228 0 93 24 171 24 264-1 91-25 173-26 267-3 57 14 100 16 141 10v42H0Z" fill="${palette.field}" opacity=".8"/>
      <path d="M0 274c120-19 211-4 326 7 131 13 241-13 354-13 84 0 154 3 220 2" fill="none" stroke="#e7c38b" stroke-width="1.3" opacity=".35"/>
      <g fill="${palette.ink}" opacity=".74">
        <path d="M794 236c-4-18-2-28 3-42 2 14 4 27 2 42ZM805 234c-1-14 1-24 6-34 1 12 1 23-1 34ZM786 236c-6-12-9-20-9-30 5 8 9 17 12 28Z"/>
        <path d="M798 236h18l-4 4h-10Z"/>
      </g>
      <path d="M0 244c75-31 151-32 225-7 104 35 199 34 302 0 94-31 189-28 283 5 32 11 61 15 90 14" fill="none" stroke="#ebc98e" stroke-width="1.4" opacity=".3"/>`
  }

  if (group === 'forest') {
    return `
      <path d="M0 246c153-7 270 12 391 4 129-8 251-10 354-2 67 5 113 5 155 1v51H0Z" fill="${palette.ground}" opacity=".86"/>
      <g fill="${palette.ink}" opacity=".8">
        <path d="m54 242-31 2 14-58 6 15 7-22 18 35 10-15 14 41Z"/>
        <path d="m130 242-24 1 10-39 4 8 5-17 13 27 7-10 10 30Z"/>
        <path d="m760 243-30 1 12-57 5 12 6-19 16 35 8-12 14 40Z"/>
      </g>
      <g stroke="${palette.road}" stroke-width="1" opacity=".22">
        <path d="M0 265h900M0 280h900"/>
      </g>
      <path d="M617 252c12-5 22-5 35 0M668 256c8-3 16-3 23 0" fill="none" stroke="${palette.ink}" stroke-width="1.3"/>`
  }

  if (group === 'highland') {
    return `
      <path d="M0 239 96 195l66 29 87-53 78 50 77-42 93 58 96-50 80 37 109-49 141 66v60H0Z" fill="${palette.mid}" opacity=".65"/>
      <path d="M0 259 107 219l84 32 94-47 80 49 94-37 82 48 95-41 92 34 115-42 91 45v40H0Z" fill="${palette.near}" opacity=".88"/>
      <path d="m98 196 22-33 22 35-15-5-8 10-8-9Z" fill="#e9e3cf" opacity=".35"/>
      <path d="m553 221 23-35 22 37-14-5-9 10-8-9Z" fill="#e9e3cf" opacity=".3"/>
      <path d="M0 274c131-11 234 5 359-7 137-13 260-3 378 2 73 3 123 2 163-3" fill="none" stroke="${palette.road}" stroke-width="1.3" opacity=".22"/>`
  }

  const fieldRows = Array.from({ length: 5 }, (_, index) => {
    const y = 245 + index * 11
    const offset = Math.round(rng() * 40)
    return `<path d="M${-20 + offset} ${y}c160-9 278 8 416-1 142-9 287-8 484 1" fill="none" stroke="${palette.field}" stroke-width="1" opacity="${0.31 - index * 0.035}"/>`
  }).join('')

  return `
    ${fieldRows}
    <g transform="translate(735 208)" fill="${palette.ink}" opacity=".7">
      <path d="M0 39h8V12h5v27h6V4l16 8-16 8v19Z"/>
      <path d="M9 12 37 0l9 6-23 12-5 4Z" opacity=".8"/>
      <path d="M38 4v18" stroke="${palette.ink}" stroke-width="1.5"/>
    </g>
    <g stroke="${palette.ink}" stroke-width="1.1" opacity=".28">
      <path d="M95 246v25M140 244v27M190 247v25M248 244v27M654 246v25M702 244v27M816 245v26"/>
    </g>`
}

function caravan(city, palette, rng) {
  const flip = rng() > 0.5 ? 1 : -1
  return `
    <g transform="translate(${608 + Math.round(rng() * 22)} 273) scale(${flip} 1)" fill="${palette.ink}" opacity=".9">
      <path d="M0 9h26l5-9h17l5 9h8v8H0Z"/>
      <circle cx="9" cy="19" r="4.7" fill="none" stroke="${palette.ink}" stroke-width="2"/>
      <circle cx="48" cy="19" r="4.7" fill="none" stroke="${palette.ink}" stroke-width="2"/>
      <path d="M9 9v10M48 9v10" stroke="${palette.ink}" stroke-width="1"/>
      <path d="M68 13c4-1 8 0 10 2l6-7 5 1-3 7 5 5-2 5h-6l-2-4-8 1-1 6h-5Z"/>
      <path d="M88 9 94 1M82 7l-1-7" stroke="${palette.ink}" stroke-width="1.4"/>
      <circle cx="-5" cy="9" r="2.8"/>
      <path d="M-5 12v8M-8 20l3-3 3 3M-9 15l-5 5M-1 15l5 4" stroke="${palette.ink}" stroke-width="1.3"/>
    </g>`
}

export function cityScene(city) {
  const palette = SCENES[city.biome] || SCENES.plains
  const rng = mulberry32(hashString(city.id))
  const skyId = `sky-${city.id}`
  const glowId = `glow-${city.id}`
  const sunX = 690 + Math.round((rng() - 0.5) * 40)
  const sunY = 68 + Math.round(rng() * 15)
  const clouds = [
    cloud(270 + Math.round(rng() * 70), 44 + Math.round(rng() * 25), 0.75),
    cloud(455 + Math.round(rng() * 45), 84 + Math.round(rng() * 14), 0.5, 0.13),
    cloud(750 + Math.round(rng() * 55), 116 + Math.round(rng() * 18), 0.44, 0.1),
  ].join('')

  return `
    <svg viewBox="0 0 900 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustration of ${city.name}">
      <defs>
        <linearGradient id="${skyId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${palette.sky[0]}"/>
          <stop offset="1" stop-color="${palette.sky[1]}"/>
        </linearGradient>
        <radialGradient id="${glowId}">
          <stop offset="0" stop-color="${palette.sun}" stop-opacity=".5"/>
          <stop offset="1" stop-color="${palette.sun}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="900" height="300" fill="url(#${skyId})"/>
      <circle cx="${sunX}" cy="${sunY}" r="88" fill="url(#${glowId})"/>
      <circle cx="${sunX}" cy="${sunY}" r="34" fill="${palette.sun}" opacity=".88"/>
      <circle cx="${sunX}" cy="${sunY}" r="43" fill="none" stroke="${palette.sun}" stroke-width=".7" opacity=".36"/>
      ${clouds}
      <path d="M214 67c5-4 10-4 15 0M244 58c4-3 8-3 12 0" fill="none" stroke="${palette.ink}" stroke-width="1.1" opacity=".36"/>
      <path d="${ridge(150, 25, rng, 7)}" fill="${palette.far}" opacity=".8"/>
      <path d="${ridge(194, 22, rng, 6)}" fill="${palette.mid}" opacity=".92"/>
      <path d="${ridge(224, 12, rng, 8)}" fill="${palette.near}"/>
      <path d="M0 221c181-7 349 9 522 3 131-5 245-7 378-1v77H0Z" fill="${palette.ground}"/>
      ${citySilhouette(city, palette)}
      ${foreground(city, palette, rng)}
      <path d="M0 292c122-24 220-19 329 0 119 21 216 17 326-4 87-17 162-16 245 1" fill="none" stroke="${palette.road}" stroke-width="9" opacity=".17"/>
      ${caravan(city, palette, rng)}
      <rect width="900" height="300" fill="none"/>
    </svg>`
}

function roadPath(road) {
  const from = CITY_BY_ID[road.a]
  const to = CITY_BY_ID[road.b]
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const offset = road.curve * Math.min(16, length * 0.11)
  const controlX = (from.x + to.x) / 2 - (dy / length) * offset
  const controlY = (from.y + to.y) / 2 + (dx / length) * offset
  return `M${from.x} ${from.y} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${to.x} ${to.y}`
}

function mapDecoration() {
  return `
    <g fill="none" stroke="#838a71" stroke-width=".7" opacity=".25">
      <path d="M0 34c58 6 82 28 62 55s9 42 43 56M26 0c21 27 12 46-10 64M0 388c51-4 77-22 100-39M610 0c-7 19 7 34 30 41M900 370c-48-3-65-24-77-53M716 486c38-13 58-3 79 24"/>
      <path d="M52 104c31 10 40 35 21 56-17 19-4 33 17 38M496 360c32-15 49-4 58 18s30 26 49 18M228 444c26-16 39-10 48 10"/>
      <path d="M788 130c23 8 30 28 15 45M89 273c18 2 29 14 27 31"/>
    </g>
    <g fill="none" stroke="#7d866d" stroke-width="1" opacity=".42">
      <path d="M408 56l11-14 11 14M424 55l8-10 8 10M446 72l12-16 12 16M468 50l8-9 8 9"/>
      <path d="M498 405c18-14 40-13 54-1s33 13 48-2M518 428c21-12 43-11 56 1s29 12 42 0"/>
      <path d="M74 154l8-14 7 9 6-11 13 15M101 184l6-10 5 7 4-8 9 11"/>
      <path d="M272 244c20-4 33 2 43 11s25 12 42 8M278 259c19-3 31 2 39 9s21 10 34 7"/>
    </g>
    <g fill="#8a8f73" opacity=".28">
      <path d="M415 87h2.2v2.2H415zM478 70h2v2h-2zM354 260h2v2h-2zM317 204h2v2h-2zM525 339h2v2h-2zM139 331h2v2h-2zM238 117h2v2h-2zM573 366h2v2h-2z"/>
      <path d="M344 300h1.6v1.6h-1.6zM203 232h1.6v1.6h-1.6zM453 337h1.6v1.6h-1.6zM88 247h1.6v1.6h-1.6z"/>
    </g>`
}

export function worldMap({ currentId, selectedId = null, large = false }) {
  const suffix = large ? 'atlas' : 'rail'
  const current = CITY_BY_ID[currentId]
  const nearIds = new Set(
    ROADS.filter((road) => road.a === currentId || road.b === currentId).map((road) =>
      road.a === currentId ? road.b : road.a,
    ),
  )

  const roads = ROADS.map((road) => {
    const touchesCurrent = road.a === currentId || road.b === currentId
    const isSelected = selectedId && (road.a === selectedId || road.b === selectedId) && touchesCurrent
    const klass = isSelected ? 'map-road active' : touchesCurrent ? 'map-road known' : 'map-road'
    return `<path class="${klass}" d="${roadPath(road)}"/>`
  }).join('')

  const cities = CITIES.map((city) => {
    const isCurrent = city.id === currentId
    const isNear = nearIds.has(city.id)
    const classes = ['map-city']
    if (isCurrent) classes.push('current')
    if (isNear) classes.push('near')
    if (city.id === selectedId) classes.push('selected')
    let anchor = 'middle'
    let labelX = 0
    let labelY = 15
    if (city.x < 82) {
      anchor = 'start'
      labelX = 10
      labelY = 12
    } else if (city.x > 518) {
      anchor = 'end'
      labelX = -10
      labelY = 12
    }
    return `
      <g class="${classes.join(' ')}" data-action="${large ? 'atlas-city' : 'map-city'}" data-city="${city.id}" tabindex="0" role="button" aria-label="${city.name}">
        <title>${city.name} — ${city.region}</title>
        <circle class="city-hit" r="14" fill="transparent"/>
        <circle class="city-halo" cx="0" cy="0" r="9"/>
        <circle class="city-dot" cx="0" cy="0" r="${isCurrent ? 5 : isNear ? 4.2 : 3.2}"/>
        <text x="${labelX}" y="${labelY}" text-anchor="${anchor}">${city.name}</text>
      </g>`.replace('<g class=', `<g transform="translate(${city.x} ${city.y})" class=`)
  }).join('')

  return `
    <svg class="world-map" viewBox="0 0 600 520" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Map of the Amber Reach, showing twenty cities and the roads between them">
      <defs>
        <linearGradient id="map-bg-${suffix}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f1e7d0"/>
          <stop offset=".55" stop-color="#eadfc5"/>
          <stop offset="1" stop-color="#e1d2b2"/>
        </linearGradient>
        <pattern id="map-dots-${suffix}" width="17" height="17" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r=".75" fill="#7f866f" opacity=".22"/>
        </pattern>
        <pattern id="map-hatch-${suffix}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(28)">
          <path d="M0 0v7" stroke="#8b9076" stroke-width=".55" opacity=".13"/>
        </pattern>
        <clipPath id="map-clip-${suffix}">
          <rect width="600" height="520" rx="9"/>
        </clipPath>
      </defs>
      <g clip-path="url(#map-clip-${suffix})">
        <rect width="600" height="520" fill="url(#map-bg-${suffix})"/>
        <rect width="600" height="520" fill="url(#map-dots-${suffix})"/>
        <path d="M0 0h600v520H0z" fill="url(#map-hatch-${suffix})" opacity=".5"/>
        <path d="M126 0c34 70 4 116 45 168 43 54 40 103-3 145-38 36-33 105 8 207" fill="none" stroke="#88a9a2" stroke-width="9" opacity=".38"/>
        <path d="M131 0c31 69 2 112 42 163 42 53 38 100-4 142-37 35-31 102 8 202" fill="none" stroke="#f0e7d2" stroke-width="2.5" opacity=".65"/>
        <path d="M304 520c9-54 32-79 76-94 46-16 68-44 69-91" fill="none" stroke="#88a9a2" stroke-width="4" opacity=".2"/>
        ${mapDecoration()}
        <g>
          ${roads}
        </g>
        <g>
          ${cities}
        </g>
        <g transform="translate(42 472)" fill="none" stroke="#777f67" opacity=".66">
          <circle r="17" stroke-width=".8"/>
          <circle r="12" stroke-width=".55" opacity=".7"/>
          <path d="M0-22V22M-22 0H22" stroke-width=".65"/>
          <path d="M0-15 4.5 0 0 15-4.5 0Z" fill="#a05b3d" stroke="none" opacity=".7"/>
          <text x="0" y="-27" text-anchor="middle" fill="#777f67" stroke="none" font-family="monospace" font-size="7" letter-spacing="1">N</text>
        </g>
        <g transform="translate(508 500)" fill="none" stroke="#7d846b" opacity=".55">
          <path d="M0 0h52M0-3v6M52-3v6" stroke-width=".7"/>
          <text x="0" y="-7" fill="#7d846b" stroke="none" font-family="monospace" font-size="5.5" letter-spacing=".5">20 LEAGUES</text>
        </g>
      </g>
      <rect x=".5" y=".5" width="599" height="519" rx="9" fill="none" stroke="#b3a888" stroke-width="1" opacity=".6"/>
    </svg>`
}
