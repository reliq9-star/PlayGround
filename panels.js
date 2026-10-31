import {
  CITY_BY_ID,
  GOODS,
  GOOD_BY_ID,
  TERRAIN_ICONS,
  TRANSPORTS,
  otherEnd,
  roadsFrom,
} from './data.js'
import {
  bestMarketTip,
  capacityLeft,
  cargoItems,
  cargoWeight,
  currentCity,
  currentMarket,
  currentTransport,
  currentWeather,
  esc,
  fmt,
  quoteTrade,
  routeDays,
  routeRisk,
  shortestPath,
  sizedQty,
  travelPreview,
} from './engine.js'
import { worldMap } from './art.js'
import { icon } from './icons.js'

function serviceButton({ service, iconName, title, effect, price, disabled, reason }) {
  return `
    <button class="service-button" type="button" data-action="service" data-service="${service}" ${disabled ? 'disabled' : ''} title="${esc(reason || title)}">
      <span class="service-icon">${icon(iconName)}</span>
      <span class="service-text"><strong>${title}</strong><span>${effect}</span></span>
      <span class="service-price">${price}c</span>
    </button>`
}

function tradeButton(state, good, side, size) {
  const market = currentMarket(state, good.id)
  const qty = sizedQty(state, good.id, size, side)
  const quote = qty > 0 ? quoteTrade(state, good.id, qty, side) : null
  const requested = size === 'max' ? '—' : size
  let chip = `${side === 'buy' ? 'Buy' : 'Sell'} ${qty || requested}`
  let small = quote ? `${fmt(quote.total)} c` : side === 'buy' ? 'unavailable' : 'none'
  let reason = ''

  if (qty <= 0) {
    if (side === 'buy') {
      if (!market || market.stock <= 0) reason = 'Sold out until the next market morning'
      else if (capacityLeft(state) < good.weight) reason = 'No room left in the caravan'
      else reason = 'Not enough crowns for a single unit'
    } else {
      reason = `No ${good.name.toLowerCase()} in your cargo`
    }
  }

  return `
    <button class="trade-button ${side}" type="button" data-action="trade" data-side="${side}" data-good="${good.id}" ${qty <= 0 ? 'disabled' : ''} title="${esc(reason || `1 unit weighs ${good.weight} kg · fair value ${good.base}c`)}" aria-label="${side} ${qty || 0} ${good.name} for ${quote ? quote.total : 0} crowns">
      ${chip}
      <small>${small}</small>
    </button>`
}

export function renderMarket(state, ui) {
  const city = currentCity(state)
  const weather = currentWeather(state)
  const weight = cargoWeight(state)
  const transport = currentTransport(state)
  const tip = bestMarketTip(state)
  const waterDisabled = state.cash < 5 || state.thirst >= 99
  const foodDisabled = state.cash < 9 || (state.hunger >= 99 && state.health >= 99)
  const restDisabled = state.cash < 15 || (state.energy >= 99 && state.health >= 99)

  return `
    <div class="tab-content">
      <div class="panel-toolbar">
        <div class="panel-heading">
          <div>
            <p class="panel-kicker">${esc(city.name)} · market day ${state.day}</p>
            <h3>Market stalls</h3>
          </div>
        </div>
        <div class="trade-controls">
          <span>Trade size</span>
          <div class="size-switch" role="group" aria-label="Trade quantity">
            ${[1, 5, 10]
              .map(
                (size) =>
                  `<button type="button" data-action="trade-size" data-size="${size}" class="${ui.tradeSize === size ? 'active' : ''}" aria-pressed="${ui.tradeSize === size}">${size}</button>`,
              )
              .join('')}
            <button type="button" data-action="trade-size" data-size="max" class="${ui.tradeSize === 'max' ? 'active' : ''}" aria-pressed="${ui.tradeSize === 'max'}">MAX</button>
          </div>
          <span class="market-open"><i></i> Open</span>
        </div>
      </div>

      <div class="market-scroll">
        <div class="market-table-head" aria-hidden="true">
          <span>Good</span><span>Price</span><span>Stock</span><span>Owned</span><span>Trade</span>
        </div>
        ${GOODS.map((good) => {
          const market = currentMarket(state, good.id)
          const entry = state.cargo[good.id]
          const isLocal = city.exports.includes(good.id)
          const isWanted = city.imports.includes(good.id)
          const delta = Math.round(((market.price - good.base) / good.base) * 100)
          const fairClass = delta < -7 ? 'cheap' : delta > 7 ? 'dear' : 'fair'
          const fairLabel =
            delta < -7
              ? `▼ ${Math.abs(delta)}% under fair`
              : delta > 7
                ? `▲ ${delta}% over fair`
                : '≈ fair price'
          const tags = [
            isLocal ? '<span class="good-badge local">local</span>' : '',
            isWanted ? '<span class="good-badge wanted">wanted</span>' : '',
          ].join('')
          return `
            <div class="market-row ${isLocal ? 'is-local' : ''} ${isWanted ? 'is-wanted' : ''}" title="${esc(good.blurb)}">
              <div class="good-cell">
                <span class="good-icon" style="--good-tone:${good.tone};color:${good.tone}">${icon(good.icon)}</span>
                <span class="good-text">
                  <span class="good-name-line"><span class="good-name">${good.name}</span>${tags}</span>
                  <span class="good-sub">${good.unit} · ${good.weight} kg · fair ${good.base}c</span>
                </span>
              </div>
              <div class="price-cell">
                <span class="price-main">${market.price}<small>c</small></span>
                <span class="price-fair ${fairClass}">${fairLabel}</span>
              </div>
              <div class="stock-cell">${market.stock}</div>
              <div class="own-cell ${entry ? '' : 'empty'}">
                ${entry ? entry.qty : '—'}
                <small>${entry ? `${Math.round(entry.avgCost)}c avg` : 'none'}</small>
              </div>
              <div class="trade-actions">
                ${tradeButton(state, good, 'buy', ui.tradeSize)}
                ${tradeButton(state, good, 'sell', ui.tradeSize)}
              </div>
            </div>`
        }).join('')}
      </div>

      <div class="services">
        ${serviceButton({
          service: 'water',
          iconName: 'drop',
          title: 'Fill skins',
          effect: '+55 thirst',
          price: 5,
          disabled: waterDisabled,
          reason: state.cash < 5 ? 'You cannot afford fresh water' : 'Your waterskin is already full',
        })}
        ${serviceButton({
          service: 'meal',
          iconName: 'meal',
          title: 'Hot meal',
          effect: '+55 hunger · +6 life',
          price: 9,
          disabled: foodDisabled,
          reason: state.cash < 9 ? 'You cannot afford a meal' : 'You are full and hale',
        })}
        ${serviceButton({
          service: 'rest',
          iconName: 'bed',
          title: 'Bed down',
          effect: '+70 energy · next day',
          price: 15,
          disabled: restDisabled,
          reason: state.cash < 15 ? 'You cannot afford a bed' : 'You are rested enough',
        })}
      </div>

      <div class="market-foot">
        <span class="market-tip">${icon('sparkle')}${esc(tip)}</span>
        <span class="capacity-note"><b>${weight}</b> / ${transport.capacity} kg · ${weather.label.toLowerCase()}</span>
      </div>
    </div>`
}

function routeTile(state, route, destination) {
  const days = routeDays(state, route)
  const risk = routeRisk(route)
  const preview = travelPreview(state, route)
  const transport = currentTransport(state)
  const wants = destination.imports.map((id) => GOOD_BY_ID[id].name).join(' · ')
  const sells = destination.exports.map((id) => GOOD_BY_ID[id].name).join(' · ')
  const waterRisk = preview.thirstAfter < 20
  const foodRisk = preview.hungerAfter < 20
  const supplyClass = waterRisk || foodRisk ? 'warn' : ''

  return `
    <article class="route-tile">
      <div class="route-tile-top">
        <div class="route-destination">
          <p class="panel-kicker">${esc(destination.region)}</p>
          <h4>${esc(destination.name)}</h4>
          <p>${esc(destination.epithet)}</p>
        </div>
        <span class="route-terrain-icon" title="${route.label}">${icon(TERRAIN_ICONS[route.terrain] || 'route')}</span>
      </div>
      <div class="route-metrics">
        <span class="metric-chip">${icon('route')}${route.distance} leagues</span>
        <span class="metric-chip">${icon('footsteps')}${days} ${days === 1 ? 'day' : 'days'}</span>
        <span class="metric-chip ${risk.className}">${icon('warn')}${risk.label}</span>
        <span class="metric-chip">${icon('drop')}${preview.water}</span>
      </div>
      <div class="route-wants">
        ${wants ? `<b>Wants</b> ${wants}` : ''}${sells ? ` <span class="muted">·</span> <b class="positive">Sells</b> ${sells}` : ''}
      </div>
      <div class="route-tile-foot">
        <span class="route-supply">
          ${transport.short} · <b>${preview.food} food</b> · <b>${preview.energy} energy</b>${supplyClass ? ' · <span class="negative">thin supplies</span>' : ''}
        </span>
        <button class="travel-button" type="button" data-action="travel" data-dest="${destination.id}">
          Travel ${icon('route')}
        </button>
      </div>
    </article>`
}

export function renderRoads(state) {
  const city = currentCity(state)
  const weather = currentWeather(state)
  const routes = roadsFrom(city.id)
    .map((road) => ({ road, destination: CITY_BY_ID[otherEnd(road, city.id)] }))
    .sort((a, b) => a.road.distance - b.road.distance)
  const anyDanger = routes.some(({ road }) => {
    const preview = travelPreview(state, road)
    return preview.thirstAfter < 5 || preview.hungerAfter < 5
  })

  return `
    <div class="tab-content">
      <div class="roads-content">
        <div class="road-intro">
          <div>
            <p class="panel-kicker">Choose a road</p>
            <h3>${routes.length} ways out of ${esc(city.name)}</h3>
          </div>
          <div class="road-weather">${icon(weather.icon)}<span>${weather.label} · markets drift as you walk</span></div>
        </div>
        <div class="route-grid">
          ${routes.map(({ road, destination }) => routeTile(state, road, destination)).join('')}
        </div>
        ${
          anyDanger
            ? `<div class="travel-warning">${icon('warn')} One of these roads will leave you dangerously short of water or food. Provision before you leave.</div>`
            : `<div class="travel-warning" style="color:var(--muted);border-color:rgba(52,61,44,.12);background:rgba(52,61,44,.035)">${icon('info')} Prices in every city move on while you travel. A full waterskin is cheaper than a roadside rescue.</div>`
        }
      </div>
    </div>`
}

function stableCard(state, transport) {
  const current = currentTransport(state)
  const isCurrent = current.id === transport.id
  const tradeIn = current.id === 'foot' ? 0 : Math.round(current.cost * 0.5)
  const net = transport.cost - tradeIn
  const tooHeavy = cargoWeight(state) > transport.capacity
  const cannotAfford = net > state.cash
  const disabled = isCurrent || tooHeavy || cannotAfford
  let reason = ''
  if (isCurrent) reason = 'This is your current rig'
  else if (tooHeavy) reason = 'Your cargo is heavier than this rig can carry'
  else if (cannotAfford) reason = `You need ${net - state.cash} more crowns`
  const priceLabel = isCurrent
    ? 'Current rig'
    : net > 0
      ? `${fmt(net)}c to pay`
      : net < 0
        ? `${fmt(Math.abs(net))}c returned`
        : 'No charge'
  const actionLabel = isCurrent ? 'In use' : net < 0 ? 'Trade in' : 'Buy rig'

  return `
    <article class="stable-card ${isCurrent ? 'current' : ''}">
      <span class="stable-icon">${icon(transport.icon)}</span>
      <div>
        <div class="stable-title-line">
          <span class="stable-title">${transport.name}</span>
          ${isCurrent ? '<span class="stable-now">yours</span>' : ''}
        </div>
        <p class="stable-desc">${transport.desc}</p>
      </div>
      <div>
        <div class="stable-stats">
          <span>${transport.capacity} kg</span>
          <span>${transport.speed} lg/day</span>
          <span>${transport.water} water</span>
          <span>${transport.food} food</span>
        </div>
        <div class="stable-action">
          <span class="stable-price">${priceLabel}<b>${transport.cost === 0 ? 'On foot' : `${fmt(transport.cost)}c`}</b></span>
          <button class="small-button" type="button" data-action="rig-buy" data-rig="${transport.id}" ${disabled ? 'disabled' : ''} title="${esc(reason)}">${actionLabel}</button>
        </div>
      </div>
    </article>`
}

export function renderCaravan(state) {
  const items = cargoItems(state)
  const weight = cargoWeight(state)
  const transport = currentTransport(state)
  const totalValue = items.reduce((total, item) => {
    const market = currentMarket(state, item.good.id)
    return total + (market?.price || item.good.base) * item.qty
  }, 0)

  return `
    <div class="tab-content">
      <div class="caravan-content">
        <section class="inventory-section">
          <div class="inventory-head">
            <h3>What you carry</h3>
            <span class="mono muted" style="font-size:7px;letter-spacing:.06em">${weight} / ${transport.capacity} kg · ${fmt(totalValue)}c at local prices</span>
          </div>
          <div class="inventory-table">
            <div class="inventory-headrow" aria-hidden="true">
              <span>Goods</span><span>Qty</span><span>Weight</span><span>Avg paid</span><span>Market</span><span>P / L</span>
            </div>
            ${
              items.length
                ? items
                    .map((item) => {
                      const market = currentMarket(state, item.good.id)
                      const difference = (market.price - item.avgCost) * item.qty
                      return `
                        <div class="inventory-row">
                          <div class="inventory-good">
                            <span class="good-icon" style="color:${item.good.tone}">${icon(item.good.icon)}</span>
                            <span>${item.good.name}</span>
                          </div>
                          <span>${item.qty}</span>
                          <span>${item.weight} kg</span>
                          <span>${Math.round(item.avgCost)}c</span>
                          <span>${market.price}c</span>
                          <span class="${difference >= 0 ? 'positive' : 'negative'}" style="font-weight:700">${difference >= 0 ? '+' : '−'}${fmt(Math.abs(difference))}c</span>
                        </div>`
                    })
                    .join('')
                : '<div class="inventory-empty">Nothing but dust and a little loose straw. The market is where fortunes begin.</div>'
            }
          </div>
        </section>

        <section>
          <div class="stable-head">
            <h3>The caravan yard</h3>
            <p>Every city keeps a yard. Trade in your current rig at half its price.</p>
          </div>
          <div class="stable-grid">
            ${TRANSPORTS.map((transportOption) => stableCard(state, transportOption)).join('')}
          </div>
        </section>
      </div>
    </div>`
}

export function renderAtlas(state, ui) {
  const city = CITY_BY_ID[ui.atlasCity] || currentCity(state)
  const current = currentCity(state)
  const direct = city.id === current.id ? null : roadsFrom(current.id).map((road) => otherEnd(road, current.id)).includes(city.id)
  const path = direct ? [current.id, city.id] : shortestPath(current.id, city.id)
  const isCurrent = city.id === current.id
  const visited = state.visited.includes(city.id)
  const importNames = city.imports.map((id) => GOOD_BY_ID[id].name).join(', ')
  const exportNames = city.exports.map((id) => GOOD_BY_ID[id].name).join(', ')

  return `
    <div class="atlas-content">
      <div class="atlas-map-wrap">
        ${worldMap({ currentId: current.id, selectedId: city.id, large: true })}
      </div>
      <aside class="atlas-aside">
        <p class="panel-kicker">${isCurrent ? 'You are here' : direct ? 'One road away' : 'City dossier'}</p>
        <h3>${esc(city.name)}</h3>
        <span class="atlas-region">${esc(city.region)}</span>
        <p class="atlas-blurb">${esc(city.blurb)}</p>
        <div class="atlas-facts">
          <div class="atlas-fact"><span>Status</span><strong>${isCurrent ? 'Your caravan' : visited ? 'Visited' : 'Not yet visited'}</strong></div>
          <div class="atlas-fact"><span>Local goods</span><strong>${exportNames || 'No famous export'}</strong></div>
          <div class="atlas-fact"><span>In demand</span><strong>${importNames || 'Nothing in particular'}</strong></div>
          <div class="atlas-fact"><span>Roads</span><strong>${roadsFrom(city.id).length} roads</strong></div>
        </div>
        <div class="atlas-route-note">
          ${
            isCurrent
              ? 'The market is just beyond the square. Choose a road when you are ready to move.'
              : direct
                ? `The ${roadsFrom(current.id).find((road) => otherEnd(road, current.id) === city.id).label.toLowerCase()} runs directly from ${current.name}.`
                : path && path.length > 2
                  ? `No direct road. The first step is ${CITY_BY_ID[path[1]].name}, then ${path.length - 2} more ${path.length - 2 === 1 ? 'road' : 'roads'} to ${city.name}.`
                  : 'No road connects this city to your caravan.'
          }
        </div>
        ${
          direct
            ? `<button class="travel-button atlas-travel" type="button" data-action="travel" data-dest="${city.id}">Plan the journey ${icon('route')}</button>`
            : ''
        }
      </aside>
    </div>`
}
