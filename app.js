import { CITY_BY_ID, TRANSPORT_BY_ID } from './data.js'
import {
  advanceDay,
  bestFortune,
  buyGood,
  cargoWeight,
  clamp,
  createInitialState,
  currentCity,
  currentTransport,
  esc,
  fmt,
  loadState,
  netWorth,
  recordBestFortune,
  routeBetween,
  saveState,
  sellGood,
  sizedQty,
} from './engine.js'
import { icon } from './icons.js'
import {
  renderCargo,
  renderHero,
  renderMapCard,
  renderMerchant,
  renderRig,
  renderRouteCard,
  renderTopbar,
  tabContext,
} from './views.js'
import { renderAtlas, renderCaravan, renderMarket, renderRoads } from './panels.js'
import {
  eventOutcomeModal,
  helpModal,
  newGameModal,
  retireModal,
  retireResultModal,
  travelConfirmModal,
  travelResultModal,
} from './modals.js'
import { applyRoadChoice, resolveTravel } from './journey.js'

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)]

const ui = {
  tab: 'market',
  tradeSize: 1,
  selectedRoute: null,
  atlasCity: null,
  pendingEvent: null,
  travelResult: null,
  modalClosable: true,
  audioContext: null,
}

let state = null

const startScreen = $('#start-screen')
const gameShell = $('#game-shell')
const mainPanel = $('#main-panel')
const modalRoot = $('#modal-root')
const toastRoot = $('#toast-root')
const startForm = $('#start-form')
const startName = $('#merchant-name')
const continueButton = $('#continue-game')

/* ── Rendering ──────────────────────────────────────────────── */

function captureScroll() {
  return {
    market: $('.market-scroll')?.scrollTop || 0,
    roads: $('.roads-content')?.scrollTop || 0,
    caravan: $('.caravan-content')?.scrollTop || 0,
    atlas: $('.atlas-aside')?.scrollTop || 0,
  }
}

function restoreScroll(scroll) {
  const targets = [
    ['.market-scroll', scroll.market],
    ['.roads-content', scroll.roads],
    ['.caravan-content', scroll.caravan],
    ['.atlas-aside', scroll.atlas],
  ]
  for (const [selector, top] of targets) {
    const element = $(selector)
    if (element && top) element.scrollTop = top
  }
}

export function renderAll({ preserveScroll = true } = {}) {
  if (!state) return
  const scroll = preserveScroll ? captureScroll() : null
  const city = currentCity(state)
  const topbar = renderTopbar(state)

  $('#topbar-sub').textContent = topbar.sub
  $('#day-readout').innerHTML = topbar.day
  $('#purse-readout').innerHTML = topbar.purse
  $('#sound-toggle').innerHTML = topbar.sound
  $('#sound-toggle').setAttribute(
    'aria-label',
    state.sound ? 'Mute sound' : 'Unmute sound',
  )
  $('#sound-toggle').setAttribute('title', state.sound ? 'Mute sound' : 'Unmute sound')

  $('#merchant-card').innerHTML = renderMerchant(state)
  $('#rig-card').innerHTML = renderRig(state)
  $('#cargo-card').innerHTML = renderCargo(state)
  $('#city-hero').innerHTML = renderHero(state)

  $$('.tab-button, .mobile-tab').forEach((button) => {
    const active = button.dataset.tab === ui.tab
    button.classList.toggle('active', active)
    if (active) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  $('#tab-context').textContent = tabContext(state, ui)

  if (ui.tab === 'roads') mainPanel.innerHTML = renderRoads(state)
  else if (ui.tab === 'caravan') mainPanel.innerHTML = renderCaravan(state)
  else if (ui.tab === 'atlas') {
    if (!ui.atlasCity) ui.atlasCity = state.cityId
    mainPanel.innerHTML = renderAtlas(state, ui)
  } else mainPanel.innerHTML = renderMarket(state, ui)

  $('#map-card').innerHTML = renderMapCard(state, ui)
  $('#route-card').innerHTML = renderRouteCard(state, ui)

  if (scroll) restoreScroll(scroll)
  document.title = `${city.name} · The Salt Road`
}

function setTab(tab) {
  if (!['market', 'roads', 'caravan', 'atlas'].includes(tab)) return
  ui.tab = tab
  if (tab === 'atlas' && !ui.atlasCity) ui.atlasCity = state.cityId
  renderAll({ preserveScroll: false })
  if (window.matchMedia('(max-width: 760px)').matches) {
    const panel = $('#main-panel')
    const top = panel.getBoundingClientRect().top + window.scrollY - 70
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  }
  playSound('click')
}

/* ── Start and save ─────────────────────────────────────────── */

function refreshStart() {
  const saved = loadState()
  continueButton.hidden = !saved
  if (saved) startName.placeholder = saved.name
}

function showGame() {
  startScreen.hidden = true
  gameShell.hidden = false
  document.body.classList.add('in-game')
  closeModal(true)
  renderAll({ preserveScroll: false })
  window.scrollTo({ top: 0, behavior: 'instant' })
}

function beginNewGame(name) {
  state = createInitialState(name)
  ui.tab = 'market'
  ui.tradeSize = 1
  ui.selectedRoute = null
  ui.atlasCity = state.cityId
  ui.pendingEvent = null
  ui.travelResult = null
  saveState(state)
  showGame()
  showToast(`The market at ${currentCity(state).name} is open. You have ${fmt(state.cash)} crowns.`, 'success')
  playSound('start')
}

function continueGame() {
  const saved = loadState()
  if (!saved) {
    showToast('No ledger was found on this device.', 'warning')
    return
  }
  state = saved
  state.sound = state.sound !== false
  state.cargo ||= {}
  state.journal ||= []
  state.visited ||= [state.cityId]
  state.reputation ??= 5
  state.trades ??= 0
  state.profit ??= 0
  state.distance ??= 0
  state.events ??= 0
  state.goal ??= 3000
  ui.tab = 'market'
  ui.tradeSize = 1
  ui.selectedRoute = null
  ui.atlasCity = state.cityId
  ui.pendingEvent = null
  ui.travelResult = null
  showGame()
  showToast(`Welcome back to ${currentCity(state).name}, ${state.name}.`, 'success')
  playSound('start')
}

/* ── Toasts, sound, modal ───────────────────────────────────── */

function showToast(message, kind = 'info') {
  const toast = document.createElement('div')
  toast.className = `toast ${kind}`
  const glyph = kind === 'warning' ? 'warn' : kind === 'success' ? 'sparkle' : 'info'
  toast.innerHTML = `${icon(glyph)}<span>${esc(message)}</span>`
  toastRoot.append(toast)
  while (toastRoot.children.length > 3) toastRoot.firstElementChild.remove()
  window.setTimeout(() => {
    toast.classList.add('out')
    window.setTimeout(() => toast.remove(), 260)
  }, 3200)
}

function audioContext() {
  if (ui.audioContext) return ui.audioContext
  const AudioCtor = window.AudioContext || window.webkitAudioContext
  if (!AudioCtor) return null
  ui.audioContext = new AudioCtor()
  return ui.audioContext
}

function tone(context, frequency, duration, offset, type = 'sine', volume = 0.022) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const start = context.currentTime + offset
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
}

function playSound(kind) {
  if (!state?.sound) return
  const context = audioContext()
  if (!context) return
  if (context.state === 'suspended') context.resume()
  if (kind === 'buy') {
    tone(context, 430, 0.1, 0)
    tone(context, 620, 0.12, 0.08)
  } else if (kind === 'sell') {
    tone(context, 660, 0.1, 0)
    tone(context, 500, 0.13, 0.08)
  } else if (kind === 'travel') {
    tone(context, 260, 0.18, 0, 'triangle', 0.018)
    tone(context, 390, 0.22, 0.13, 'triangle', 0.018)
  } else if (kind === 'warning') {
    tone(context, 180, 0.16, 0, 'sawtooth', 0.015)
  } else if (kind === 'event') {
    tone(context, 320, 0.14, 0, 'triangle', 0.018)
    tone(context, 245, 0.2, 0.12, 'triangle', 0.018)
  } else if (kind === 'start') {
    tone(context, 330, 0.16, 0, 'sine', 0.02)
    tone(context, 440, 0.18, 0.12, 'sine', 0.02)
    tone(context, 660, 0.25, 0.25, 'sine', 0.02)
  } else {
    tone(context, 380, 0.055, 0, 'sine', 0.012)
  }
}

function openModal(html, { closable = true } = {}) {
  ui.modalClosable = closable
  modalRoot.hidden = false
  modalRoot.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      ${closable ? `<button class="modal-close" type="button" data-action="close-modal" aria-label="Close">${icon('close')}</button>` : ''}
      ${html}
    </div>`
  document.body.classList.add('modal-open')
  window.setTimeout(() => {
    const focusable = modalRoot.querySelector('.modal-close, .modal-actions .primary-button, .choice-button, .ghost-button')
    focusable?.focus({ preventScroll: true })
  }, 30)
}

function closeModal(force = false) {
  if (modalRoot.hidden) return
  if (!ui.modalClosable && !force) return
  modalRoot.hidden = true
  modalRoot.innerHTML = ''
  document.body.classList.remove('modal-open')
  ui.pendingEvent = null
  ui.travelResult = null
  ui.modalClosable = true
}

/* ── Basic actions ──────────────────────────────────────────── */

function pluralUnit(unit, qty) {
  if (qty === 1) return unit
  if (unit.endsWith('x')) return `${unit}es`
  return `${unit}s`
}

function handleTrade(side, goodId) {
  const qty = sizedQty(state, goodId, ui.tradeSize, side)
  if (!qty) {
    const reason =
      side === 'buy'
        ? 'Not enough crowns, cargo space, or stock for that trade.'
        : 'There is none of that good in your cargo.'
    showToast(reason, 'warning')
    playSound('warning')
    return
  }

  if (side === 'buy') {
    const result = buyGood(state, goodId, qty)
    if (!result) {
      showToast('The trade could not be made.', 'warning')
      playSound('warning')
      return
    }
    showToast(
      `Bought ${result.qty} ${pluralUnit(result.good.unit, result.qty)} of ${result.good.name.toLowerCase()} for ${fmt(result.total)} crowns.`,
      'success',
    )
    playSound('buy')
  } else {
    const result = sellGood(state, goodId, qty)
    if (!result) {
      showToast('The trade could not be made.', 'warning')
      playSound('warning')
      return
    }
    const change = result.profit >= 0 ? ` Profit ${fmt(result.profit)}c.` : ` Loss ${fmt(Math.abs(result.profit))}c.`
    showToast(
      `Sold ${result.qty} ${pluralUnit(result.good.unit, result.qty)} of ${result.good.name.toLowerCase()} for ${fmt(result.total)} crowns.${change}`,
      result.profit >= 0 ? 'success' : 'warning',
    )
    playSound(result.profit >= 0 ? 'sell' : 'warning')
  }

  saveState(state)
  renderAll()
}

function handleService(service) {
  const city = currentCity(state)
  if (service === 'water') {
    if (state.cash < 5 || state.thirst >= 100) return
    state.cash -= 5
    state.thirst = clamp(state.thirst + 55, 0, 100)
    showToast('You fill every waterskin from the public well.', 'success')
    playSound('click')
  } else if (service === 'meal') {
    if (state.cash < 9 || (state.hunger >= 100 && state.health >= 100)) return
    state.cash -= 9
    state.hunger = clamp(state.hunger + 55, 0, 100)
    state.health = clamp(state.health + 6, 0, 100)
    showToast('A hot bowl of barley and mutton. The road feels less bitter.', 'success')
    playSound('click')
  } else if (service === 'rest') {
    if (state.cash < 15 || (state.energy >= 100 && state.health >= 100)) return
    state.cash -= 15
    state.energy = clamp(state.energy + 70, 0, 100)
    state.health = clamp(state.health + 20, 0, 100)
    state.hunger = clamp(state.hunger + 12, 0, 100)
    state.thirst = clamp(state.thirst + 12, 0, 100)
    advanceDay(state)
    state.journal.unshift({
      day: state.day,
      text: `Took a bed at an inn in ${city.name}. The road can wait until morning.`,
    })
    state.journal = state.journal.slice(0, 32)
    showToast(`You sleep until the bells. Day ${state.day} begins in ${city.name}.`, 'success')
    playSound('click')
  } else {
    return
  }
  saveState(state)
  renderAll()
}

function handleRigPurchase(rigId) {
  const next = TRANSPORT_BY_ID[rigId]
  const current = currentTransport(state)
  if (!next || next.id === current.id) return
  const tradeIn = current.id === 'foot' ? 0 : Math.round(current.cost * 0.5)
  const net = next.cost - tradeIn
  if (net > state.cash) {
    showToast(`You need ${fmt(net - state.cash)} more crowns for that rig.`, 'warning')
    playSound('warning')
    return
  }
  if (cargoWeight(state) > next.capacity) {
    showToast(`Your cargo weighs more than the ${next.name.toLowerCase()} can carry.`, 'warning')
    playSound('warning')
    return
  }
  state.cash -= net
  state.transport = next.id
  const rigNote =
    current.id === 'foot'
      ? `Bought a ${next.name.toLowerCase()} at the caravan yard and left your boots by the door.`
      : next.id === 'foot'
        ? `Sold the ${current.name.toLowerCase()} at the caravan yard and took to the road on foot.`
        : `Traded the ${current.name.toLowerCase()} for a ${next.name.toLowerCase()} at the caravan yard.`
  state.journal.unshift({
    day: state.day,
    text: rigNote,
  })
  state.journal = state.journal.slice(0, 32)
  const change = net > 0 ? `${fmt(net)} crowns lighter` : net < 0 ? `${fmt(Math.abs(net))} crowns richer` : 'an even trade'
  showToast(`Now travelling by ${next.name.toLowerCase()} — ${change}.`, 'success')
  playSound('buy')
  saveState(state)
  renderAll()
}

/* ── Travel, encounters, retirement ─────────────────────────── */

function openTravelFor(destId) {
  if (!state) return
  if (destId === state.cityId) {
    showToast(`You are already in ${currentCity(state).name}.`, 'info')
    return
  }
  const route = routeBetween(state.cityId, destId)
  if (!route) {
    showToast('There is no direct road. The atlas can show you the way.', 'warning')
    return
  }
  ui.selectedRoute = destId
  renderAll()
  openModal(travelConfirmModal(state, route, CITY_BY_ID[destId]))
  playSound('click')
}

function startTravel(destId) {
  const route = routeBetween(state.cityId, destId)
  if (!route) return
  const result = resolveTravel(state, route, destId)
  if (state.health <= 0) {
    state.health = 16
  }
  ui.selectedRoute = null
  ui.tab = 'market'
  ui.pendingEvent = result.event
  ui.travelResult = result
  saveState(state)
  renderAll({ preserveScroll: false })
  openModal(travelResultModal(result), { closable: !result.event })
  playSound('travel')
}

function handleEventChoice(index) {
  const event = ui.pendingEvent
  if (!event) return
  const outcome = applyRoadChoice(state, event, index)
  if (!outcome) return
  ui.pendingEvent = null
  ui.travelResult = null
  saveState(state)
  renderAll({ preserveScroll: false })
  openModal(eventOutcomeModal(outcome), { closable: true })
  playSound('event')
}

function handleRetireConfirm() {
  const worth = netWorth(state)
  if (worth < state.goal) {
    showToast('You have not yet made the fortune you set out for.', 'warning')
    return
  }
  state.retired = true
  recordBestFortune(worth)
  saveState(state)
  closeModal(true)
  renderAll()
  openModal(retireResultModal(state, bestFortune()), { closable: true })
  playSound('start')
}

function handleNewGameConfirm() {
  const name = state?.name || startName.value.trim() || 'Ilyan Voss'
  state = createInitialState(name)
  ui.tab = 'market'
  ui.tradeSize = 1
  ui.selectedRoute = null
  ui.atlasCity = state.cityId
  ui.pendingEvent = null
  ui.travelResult = null
  saveState(state)
  closeModal(true)
  gameShell.hidden = false
  startScreen.hidden = true
  renderAll({ preserveScroll: false })
  window.scrollTo({ top: 0, behavior: 'instant' })
  showToast(`A new ledger opens in Rivermeet. ${fmt(state.cash)} crowns to your name.`, 'success')
  playSound('start')
}

function handleMapCity(destId) {
  if (!destId) return
  if (destId === state.cityId) {
    showToast(`You are standing in ${currentCity(state).name}.`, 'info')
    return
  }
  if (routeBetween(state.cityId, destId)) {
    openTravelFor(destId)
    return
  }
  ui.atlasCity = destId
  setTab('atlas')
  showToast('No direct road. Here is the city on the atlas.', 'info')
}

/* ── Event wiring ───────────────────────────────────────────── */

function wireStartScreen() {
  startForm.addEventListener('submit', (event) => {
    event.preventDefault()
    const name = startName.value.trim() || 'Ilyan Voss'
    beginNewGame(name)
  })
  continueButton.addEventListener('click', continueGame)
  $('#start-help').addEventListener('click', () => {
    openModal(helpModal(), { closable: true })
  })
}

function wireGame() {
  $('#help-button').addEventListener('click', () => {
    openModal(helpModal(), { closable: true })
  })
  $('#sound-toggle').addEventListener('click', () => {
    if (!state) return
    state.sound = !state.sound
    saveState(state)
    $('#sound-toggle').innerHTML = state.sound ? icon('sound') : icon('mute')
    $('#sound-toggle').setAttribute('aria-label', state.sound ? 'Mute sound' : 'Unmute sound')
    if (state.sound) playSound('click')
    showToast(state.sound ? 'Sound on.' : 'Sound off.', 'info')
  })
  $('#new-game-button').addEventListener('click', () => {
    openModal(newGameModal(), { closable: true })
  })
}

function wireGlobalEvents() {
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]')
    if (tab) {
      setTab(tab.dataset.tab)
      return
    }

    const target = event.target.closest('[data-action]')
    if (!target) return
    const action = target.dataset.action

    if (action === 'close-modal') closeModal()
    else if (action === 'trade-size') {
      ui.tradeSize = target.dataset.size === 'max' ? 'max' : Number(target.dataset.size)
      renderAll()
      playSound('click')
    } else if (action === 'trade') {
      handleTrade(target.dataset.side, target.dataset.good)
    } else if (action === 'service') {
      handleService(target.dataset.service)
    } else if (action === 'rig-buy') {
      handleRigPurchase(target.dataset.rig)
    } else if (action === 'travel') {
      openTravelFor(target.dataset.dest)
    } else if (action === 'travel-start') {
      startTravel(target.dataset.dest)
    } else if (action === 'event-choice') {
      handleEventChoice(Number(target.dataset.index))
    } else if (action === 'map-city') {
      handleMapCity(target.dataset.city)
    } else if (action === 'atlas-city') {
      ui.atlasCity = target.dataset.city
      renderAll()
    } else if (action === 'retire') {
      if (netWorth(state) >= state.goal) openModal(retireModal(state), { closable: true })
    } else if (action === 'retire-confirm') {
      handleRetireConfirm()
    } else if (action === 'new-game-confirm') {
      handleNewGameConfirm()
    }
  })

  modalRoot.addEventListener('click', (event) => {
    if (event.target === modalRoot) closeModal()
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modalRoot.hidden) {
      closeModal()
      return
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-action="map-city"], [data-action="atlas-city"]')) {
      event.preventDefault()
      event.target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
  })

  window.addEventListener('beforeunload', () => {
    if (state) saveState(state)
  })
}

function init() {
  refreshStart()
  wireStartScreen()
  wireGame()
  wireGlobalEvents()
}

init()

// Exported for lightweight smoke checks from the browser console.
export { state, ui }
