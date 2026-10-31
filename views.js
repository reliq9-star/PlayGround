import { CITY_BY_ID, GOOD_BY_ID, TRANSPORT_BY_ID, otherEnd, roadsFrom } from './data.js'
import {
  cargoCount,
  cargoItems,
  cargoValue,
  cargoWeight,
  currentCity,
  currentTransport,
  currentWeather,
  esc,
  fmt,
  initials,
  netWorth,
  rankFor,
  routeDays,
  routeRisk,
} from './engine.js'
import { cityScene, worldMap } from './art.js'
import { icon } from './icons.js'

export function renderTopbar(state) {
  const city = currentCity(state)
  const weather = currentWeather(state)
  return {
    sub: `${city.name} · ${city.region}`,
    day: `
      <span class="readout-part">Day <strong>${String(state.day).padStart(2, '0')}</strong></span>
      <span class="readout-part">${icon(weather.icon)} ${weather.label}</span>`,
    purse: `
      <span class="coin-glyph">${icon('coin')}</span>
      <strong>${fmt(state.cash)}</strong>
      <span>crowns</span>`,
    sound: state.sound ? icon('sound') : icon('mute'),
  }
}

export function renderMerchant(state) {
  const city = currentCity(state)
  const worth = netWorth(state)
  const goalPercent = Math.min(100, (worth / state.goal) * 100)
  const latest = state.journal[0]
  const rank = rankFor(worth)
  const canRetire = worth >= state.goal

  const vital = (key, label, value) => {
    const low = value < 25 ? ' low' : ''
    return `
      <div class="vital" data-vital="${key}">
        <span class="vital-icon">${icon(key === 'energy' ? 'bolt' : key === 'hunger' ? 'bowl' : key === 'thirst' ? 'drop' : 'heart')}</span>
        <span class="vital-label">${label}</span>
        <span class="vital-track"><i class="${low.trim()}" style="width:${Math.max(0, Math.min(100, value))}%"></i></span>
        <span class="vital-value">${Math.round(value)}</span>
      </div>`
  }

  return `
    <div class="merchant-top">
      <div class="merchant-avatar">${esc(initials(state.name))}</div>
      <div class="merchant-name-wrap">
        <p class="panel-kicker">The merchant</p>
        <h2 class="merchant-name" title="${esc(state.name)}">${esc(state.name)}</h2>
        <span class="merchant-rank">${rank} <em>·</em> ${state.reputation} honour</span>
      </div>
    </div>
    <div class="goal-block">
      <div class="goal-label">
        <span>Ambition</span>
        <strong>${fmt(worth)} <small>/ ${fmt(state.goal)}</small></strong>
      </div>
      <div class="goal-track"><i style="width:${goalPercent}%"></i></div>
      ${canRetire ? '<button class="retire-link" type="button" data-action="retire">Hang up your boots →</button>' : ''}
    </div>
    <div class="vitals">
      ${vital('health', 'Life', state.health)}
      ${vital('energy', 'Energy', state.energy)}
      ${vital('hunger', 'Hunger', state.hunger)}
      ${vital('thirst', 'Thirst', state.thirst)}
    </div>
    <p class="merchant-note">${latest ? `Day ${latest.day} · ${esc(latest.text)}` : `The road is open from ${city.name}.`}</p>`
}

export function renderRig(state) {
  const transport = currentTransport(state)
  return `
    <div class="rig-head">
      <div>
        <p class="panel-kicker">Your rig</p>
        <h3>${transport.name}</h3>
      </div>
      <span class="rig-badge">${transport.id === 'foot' ? 'No stable bill' : 'Stabled'}</span>
    </div>
    <div class="rig-body">
      <span class="rig-illustration">${icon(transport.icon)}</span>
      <div class="rig-stats">
        <span class="rig-stat"><span>Pace</span><strong>${transport.speed} <small>lg / day</small></strong></span>
        <span class="rig-stat"><span>Capacity</span><strong>${transport.capacity} <small>kg</small></strong></span>
      </div>
    </div>
    <div class="rig-footer">
      <span class="rig-feed">Feeds on ${transport.water} water · ${transport.food} food / day</span>
      <button class="panel-link" type="button" data-tab="caravan">Yard →</button>
    </div>`
}

export function renderCargo(state) {
  const items = cargoItems(state)
  const weight = cargoWeight(state)
  const transport = currentTransport(state)
  const percentage = Math.min(100, (weight / transport.capacity) * 100)
  const totalItems = cargoCount(state)
  const value = cargoValue(state)
  const shown = items.slice(0, 4)
  const extra = items.length - shown.length

  return `
    <div class="cargo-head">
      <div>
        <p class="panel-kicker">Cargo hold</p>
        <h3>Manifest</h3>
      </div>
      <span class="cargo-count">${weight} / ${transport.capacity} kg</span>
    </div>
    <div class="cargo-track"><i style="width:${percentage}%"></i></div>
    ${
      items.length
        ? `<ul class="cargo-list">
            ${shown
              .map(
                (item) => `
                <li class="cargo-line">
                  <span class="good-dot" style="color:${item.good.tone}">${icon(item.good.icon)}</span>
                  <span class="cargo-line-name">${item.good.name}${extra && item === shown[shown.length - 1] ? ` <span class="muted">+${extra}</span>` : ''}</span>
                  <span class="cargo-line-qty">${item.qty}</span>
                </li>`,
              )
              .join('')}
          </ul>`
        : '<p class="cargo-empty">The hold is empty. Every fortune begins with a first sack.</p>'
    }
    <div class="cargo-footer">
      <div>
        <span class="panel-kicker">${totalItems} ${totalItems === 1 ? 'unit' : 'units'} aboard</span>
        <strong class="cargo-value">${fmt(value)} crowns</strong>
      </div>
      <button class="panel-link" type="button" data-tab="caravan">Manifest →</button>
    </div>`
}

export function renderHero(state) {
  const city = currentCity(state)
  const weather = currentWeather(state)
  const exports = city.exports.map((id) => GOOD_BY_ID[id].name)
  const imports = city.imports.map((id) => GOOD_BY_ID[id].name)
  const tags = []
  if (exports.length) tags.push(`<span class="hero-tag"><b>Sells</b> ${exports.join(' · ')}</span>`)
  if (imports.length) tags.push(`<span class="hero-tag"><b>Wants</b> ${imports.join(' · ')}</span>`)
  tags.push(`<span class="hero-tag">${weather.label} · ${weather.water > 1 ? 'dry roads' : 'fair roads'}</span>`)
  if (state.transport === 'foot') tags.push('<span class="hero-tag">On foot</span>')

  const latitude = (37.4 - city.y * 0.012).toFixed(1)
  const longitude = (city.x * 0.043 + 7.2).toFixed(1)

  return `
    <div class="hero-scene">${cityScene(city)}</div>
    <div class="hero-content">
      <div class="hero-topline">
        <p class="hero-eyebrow">${esc(city.region)} · ${esc(city.epithet)}</p>
        <span class="hero-market-state"><i></i> Market open · Day ${state.day}</span>
      </div>
      <div class="hero-main">
        <h1>${esc(city.name)}</h1>
        <div class="hero-meta">
          <span>${icon('pin')}${esc(city.region)}</span>
          <span>${icon(weather.icon)}${weather.label}</span>
          <span>${icon('route')}${roadsFrom(city.id).length} roads out</span>
        </div>
        <div class="hero-bottom">
          <div class="hero-tags">${tags.join('')}</div>
          <span class="hero-coordinates">${latitude}° N<br />${longitude}° E</span>
        </div>
      </div>
    </div>`
}

export function tabContext(state, ui) {
  const city = currentCity(state)
  if (ui.tab === 'roads') return `${roadsFrom(city.id).length} roads from ${city.name}`
  if (ui.tab === 'caravan') return `${cargoWeight(state)} kg aboard · ${currentTransport(state).name}`
  if (ui.tab === 'atlas') return 'Twenty cities of the Amber Reach'
  return `${city.name} market · day ${state.day}`
}

export function renderMapCard(state, ui) {
  const city = currentCity(state)
  return `
    <div class="map-card-head">
      <div>
        <p class="panel-kicker">The merchant’s atlas</p>
        <h3>The Amber Reach</h3>
      </div>
      <div class="map-count">20 cities<br />${roadsFrom(city.id).length} roads here</div>
    </div>
    ${worldMap({ currentId: state.cityId, selectedId: ui.selectedRoute, large: false })}
    <div class="map-legend">
      <span><i></i> You are here</span>
      <span><i class="gold"></i> One road away</span>
      <span><i class="ink"></i> Unvisited</span>
    </div>`
}

export function renderRouteCard(state, ui) {
  const city = currentCity(state)
  const routes = roadsFrom(city.id)
    .map((road) => {
      const destination = CITY_BY_ID[otherEnd(road, city.id)]
      return { road, destination, days: routeDays(state, road), risk: routeRisk(road) }
    })
    .sort((a, b) => a.road.distance - b.road.distance)

  return `
    <div class="panel-heading">
      <div>
        <p class="panel-kicker">Outbound roads</p>
        <h3>From ${esc(city.name)}</h3>
      </div>
      <button class="panel-link" type="button" data-tab="roads">All roads →</button>
    </div>
    <div class="route-shortlist">
      ${routes
        .map(
          ({ road, destination, days, risk }) => `
          <button class="route-shortcut ${ui.selectedRoute === destination.id ? 'selected' : ''}" type="button" data-action="travel" data-dest="${destination.id}" title="Travel to ${destination.name}">
            <span class="route-shortcut-name">
              <strong>${esc(destination.name)}</strong>
              <span>${road.label} · ${risk.label.toLowerCase()}</span>
            </span>
            <span class="route-shortcut-metric"><b>${days}d</b>${road.distance} lg</span>
            <span class="route-shortcut-arrow">›</span>
          </button>`,
        )
        .join('')}
    </div>
    <div class="route-card-foot">
      <span>Roads shift with the weather.</span>
      <button class="panel-link" type="button" data-tab="atlas">Open atlas →</button>
    </div>`
}

export function renderTransportBadge(id) {
  const transport = TRANSPORT_BY_ID[id]
  return `<span class="transport-badge">${icon(transport.icon)} ${transport.short}</span>`
}
