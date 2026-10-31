import { GOOD_BY_ID } from './data.js'
import {
  currentCity,
  currentTransport,
  esc,
  fmt,
  netWorth,
  rankFor,
  routeRisk,
  travelPreview,
} from './engine.js'
import { icon } from './icons.js'

export function travelConfirmModal(state, route, destination) {
  const preview = travelPreview(state, route)
  const risk = routeRisk(route)
  const transport = currentTransport(state)
  const current = currentCity(state)
  const dry = preview.thirstAfter < 20
  const hungry = preview.hungerAfter < 20
  const warning =
    preview.thirstAfter <= 0
      ? 'You will run dry before the city gates. Fill your waterskins first if you can.'
      : preview.hungerAfter <= 0
        ? 'Your stomach will be empty by the last mile. A meal would not go amiss.'
        : dry || hungry
          ? 'Supplies will be thin on arrival. Consider a waterskin or a hot meal before leaving.'
          : ''

  return `
    <div class="modal-body">
      <p class="modal-kicker">Outbound road · ${esc(route.label)}</p>
      <h2 class="modal-title">The road to ${esc(destination.name)}</h2>
      <p class="modal-subtitle">${esc(destination.epithet)} · ${esc(destination.region)}</p>

      <div class="modal-route-visual">
        <div class="modal-place"><span>From</span><strong>${esc(current.name)}</strong></div>
        <span class="route-dots" aria-hidden="true"><i></i><b></b></span>
        ${icon('route')}
        <div class="modal-place" style="text-align:right"><span>To</span><strong>${esc(destination.name)}</strong></div>
      </div>

      <div class="travel-stat-grid">
        <div class="travel-stat"><span>Distance</span><strong>${route.distance}</strong><small>leagues</small></div>
        <div class="travel-stat"><span>On the road</span><strong>${preview.days}</strong><small>${preview.days === 1 ? 'day' : 'days'}</small></div>
        <div class="travel-stat"><span>Water</span><strong>−${preview.water}</strong><small>points</small></div>
        <div class="travel-stat"><span>Food</span><strong>−${preview.food}</strong><small>points</small></div>
      </div>

      <div class="supply-preview">
        <span class="${preview.thirstAfter < 20 ? 'warn' : ''}">${icon('drop')} Thirst ${Math.round(state.thirst)} → ${Math.round(preview.thirstAfter)}</span>
        <span class="${preview.hungerAfter < 20 ? 'warn' : ''}">${icon('bowl')} Hunger ${Math.round(state.hunger)} → ${Math.round(preview.hungerAfter)}</span>
        <span>${icon('bolt')} Energy −${preview.energy}</span>
        <span class="${risk.className}">${icon('warn')} ${risk.label}</span>
        <span>${icon(transport.icon)} ${transport.short}</span>
      </div>

      ${warning ? `<div class="travel-warning">${icon('warn')} ${warning}</div>` : ''}

      <p class="modal-copy">
        ${destination.name} ${destination.imports.length ? `is buying ${destination.imports.map((id) => GOOD_BY_ID[id].name.toLowerCase()).join(' and ')}` : 'keeps a quiet market'}.
        ${destination.exports.length ? `${destination.exports.map((id) => GOOD_BY_ID[id].name).join(' and ')} ${destination.exports.length === 1 ? 'is' : 'are'} cheap there.` : 'The capital pays well for luxuries.'}
      </p>

      <div class="modal-actions">
        <button class="ghost-button cream" type="button" data-action="close-modal">Not yet</button>
        <button class="primary-button" type="button" data-action="travel-start" data-dest="${destination.id}">
          <span>Set out · ${preview.days} ${preview.days === 1 ? 'day' : 'days'}</span>
          <span class="button-arrow">→</span>
        </button>
      </div>
      <p class="modal-footnote">Road events are settled as they happen. Your progress saves before you leave.</p>
    </div>`
}

export function travelResultModal(result) {
  const { destination, route, days, log, water, food, energy, rescue, event } = result
  const eventBlock = event
    ? `<div class="encounter">
        <span class="encounter-kicker">Road encounter</span>
        <h4>${esc(event.title)}</h4>
        <p>${esc(event.text)}</p>
        <div class="encounter-choices">
          ${event.choices
            .map(
              (choice, index) => `
              <button class="choice-button" type="button" data-action="event-choice" data-index="${index}">
                <span>${esc(choice.label)}</span>
                <small>${esc(choice.detail)}</small>
              </button>`,
            )
            .join('')}
        </div>
      </div>`
    : ''

  return `
    <div class="modal-body">
      <p class="modal-kicker">Road’s end · day ${result.arrivalDay}</p>
      <h2 class="modal-title">${esc(destination.name)} at last</h2>
      <p class="modal-subtitle">${esc(destination.epithet)} · ${esc(route.label)}</p>

      <div class="travel-timeline">
        ${log
          .map(
            (entry) => `
            <div class="travel-day">
              <span class="travel-day-label">Day ${entry.day}</span>
              <span class="travel-day-icon">${icon(entry.weather.icon)}</span>
              <span class="travel-day-copy">${esc(entry.text)}</span>
            </div>`,
          )
          .join('')}
      </div>

      <ul class="outcome-list">
        <li>${days} ${days === 1 ? 'day' : 'days'} on the road · ${route.distance} leagues covered.</li>
        <li>Spent ${water} water, ${food} food, ${energy} energy.</li>
        ${rescue ? `<li class="negative">${esc(rescue)}</li>` : ''}
      </ul>

      ${eventBlock}

      ${
        event
          ? '<p class="modal-footnote">Choose quickly. The road has a way of choosing for those who hesitate.</p>'
          : `<div class="modal-actions">
              <button class="primary-button" type="button" data-action="close-modal">
                <span>Enter the market</span><span class="button-arrow">→</span>
              </button>
            </div>
            <p class="modal-footnote">The market notices a new face. Prices have shifted while you travelled.</p>`
      }
    </div>`
}

export function eventOutcomeModal(outcome) {
  return `
    <div class="modal-body">
      <p class="modal-kicker">Road encounter · resolved</p>
      <h2 class="modal-title">${esc(outcome.title)}</h2>
      <p class="modal-copy">${esc(outcome.text)}</p>
      ${
        outcome.changes?.length
          ? `<ul class="outcome-list">${outcome.changes.map((change) => `<li>${esc(change)}</li>`).join('')}</ul>`
          : ''
      }
      <div class="modal-actions">
        <button class="primary-button" type="button" data-action="close-modal">
          <span>Back to the road</span>
          <span class="button-arrow">→</span>
        </button>
      </div>
      <p class="modal-footnote">A merchant’s ledger remembers both fortunes and follies.</p>
    </div>`
}

export function helpModal() {
  const items = [
    {
      icon: 'market',
      title: 'Buy where it is common. Sell where it is wanted.',
      text: 'Green “local” goods are produced in this city and cheap. Red “wanted” goods are scarce and sell high. Watch the fair-price mark.',
    },
    {
      icon: 'route',
      title: 'Every road costs time and strength.',
      text: 'Travel drains water, food, and energy each day. When a bar runs dry, your life suffers. Fill your skins and eat before long roads.',
    },
    {
      icon: 'cart',
      title: 'A larger rig carries a larger fortune.',
      text: 'On foot you can carry 35 kg. Donkeys, horses, camels, oxen, and wagons each trade pace, capacity, and daily upkeep differently.',
    },
    {
      icon: 'sparkle',
      title: 'Reach 3,000 crowns to retire.',
      text: 'Your ambition is measured by cash plus the local value of your cargo. You may hang up your boots as soon as you can afford it.',
    },
  ]

  return `
    <div class="modal-body">
      <p class="modal-kicker">A short merchant’s primer</p>
      <h2 class="modal-title">How to make a fortune</h2>
      <p class="modal-subtitle">Twenty cities, ten goods, and one road at a time.</p>
      <div class="help-grid">
        ${items
          .map(
            (item) => `
            <div class="help-item">
              <span class="help-icon">${icon(item.icon)}</span>
              <div><h4>${item.title}</h4><p>${item.text}</p></div>
            </div>`,
          )
          .join('')}
      </div>
      <p class="modal-footnote">Goods weigh different amounts. Use the 1 / 5 / 10 / MAX trade size for a full cart. Your game saves after every trade and journey.</p>
      <div class="modal-actions">
        <button class="primary-button" type="button" data-action="close-modal">
          <span>Take to the road</span><span class="button-arrow">→</span>
        </button>
      </div>
    </div>`
}

export function newGameModal() {
  return `
    <div class="modal-body">
      <p class="modal-kicker">The ledger</p>
      <h2 class="modal-title">Burn this ledger?</h2>
      <p class="modal-copy">Your current journey will be lost, including your cargo, your crowns, and every mile behind you. The road will still be there.</p>
      <div class="modal-actions">
        <button class="ghost-button cream" type="button" data-action="close-modal">Keep riding</button>
        <button class="primary-button" type="button" data-action="new-game-confirm">
          <span>Begin again</span><span class="button-arrow">→</span>
        </button>
      </div>
    </div>`
}

export function retireModal(state) {
  const worth = netWorth(state)
  return `
    <div class="modal-body">
      <div class="retire-seal">${icon('sparkle')}</div>
      <p class="modal-kicker">The merchant’s wager · won</p>
      <h2 class="modal-title">A fortune worth keeping</h2>
      <p class="modal-subtitle">${esc(state.name)}, ${rankFor(worth)} of the Amber Reach.</p>
      <p class="modal-copy">
        You began with 320 crowns and a pair of boots. Your ledger now stands at
        <strong>${fmt(worth)} crowns</strong> on day ${state.day}. The road has been good to you — or you have been good to the road.
      </p>
      <div class="stat-lines">
        <div class="stat-line"><span>Final worth</span><strong>${fmt(worth)}c</strong></div>
        <div class="stat-line"><span>Days on the road</span><strong>${state.day}</strong></div>
        <div class="stat-line"><span>Leagues travelled</span><strong>${fmt(state.distance)}</strong></div>
        <div class="stat-line"><span>Trades struck</span><strong>${fmt(state.trades)}</strong></div>
      </div>
      <div class="modal-actions">
        <button class="ghost-button cream" type="button" data-action="close-modal">Not yet</button>
        <button class="primary-button" type="button" data-action="retire-confirm">
          <span>Hang up your boots</span><span class="button-arrow">→</span>
        </button>
      </div>
      <p class="modal-footnote">Retiring ends this journey. You can begin another from the final ledger.</p>
    </div>`
}

export function retireResultModal(state, best) {
  return `
    <div class="modal-body">
      <div class="retire-seal">${icon('sparkle')}</div>
      <p class="modal-kicker">The ledger closes</p>
      <h2 class="modal-title">You hang up your boots.</h2>
      <p class="modal-subtitle">${esc(state.name)} · ${rankFor(netWorth(state))} · ${esc(currentCity(state).name)}</p>
      <p class="modal-copy">
        There is a house with a green door, a fire that does not need tending, and a shelf for the old ledger.
        On quiet evenings you tell the story of the winter you turned a purse of silver into a name.
      </p>
      <div class="stat-lines">
        <div class="stat-line"><span>Final worth</span><strong>${fmt(netWorth(state))}c</strong></div>
        <div class="stat-line"><span>Best fortune</span><strong>${fmt(Math.max(best, netWorth(state)))}c</strong></div>
        <div class="stat-line"><span>Days on the road</span><strong>${state.day}</strong></div>
        <div class="stat-line"><span>Leagues travelled</span><strong>${fmt(state.distance)}</strong></div>
        <div class="stat-line"><span>Trades struck</span><strong>${fmt(state.trades)}</strong></div>
        <div class="stat-line"><span>Honour</span><strong>${state.reputation}</strong></div>
      </div>
      <div class="modal-actions">
        <button class="primary-button" type="button" data-action="new-game-confirm">
          <span>Begin a new journey</span><span class="button-arrow">→</span>
        </button>
      </div>
      <p class="modal-footnote">Your best fortune is kept on this device.</p>
    </div>`
}
