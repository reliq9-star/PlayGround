import { CITY_BY_ID, GOODS } from './data.js'
import {
  addJournal,
  cargoItems,
  cargoWeight,
  chance,
  clamp,
  currentCity,
  currentTransport,
  pick,
  randInt,
  refreshMarkets,
  rollWeather,
  round,
  routeDays,
} from './engine.js'

const TERRAIN_FLAVOUR = {
  plains: ['The fields pass in long golden stripes.', 'Carts nod past on the wide road.', 'Larks rise from the stubble.'],
  river: ['The river keeps you company, brown and quick.', 'Willows drag their fingers in the water.', 'A barge poles past, heavy with sacks.'],
  forest: ['Pines close over the road and hush the wind.', 'Charcoal smoke hangs between the trees.', 'Something moves in the undergrowth, and is gone.'],
  coast: ['Gulls wheel over the salt flats.', 'The sea flashes between the dunes.', 'Rope and tar smell drifts from a fishing camp.'],
  desert: ['The road shines like a hot coin.', 'A dry wind erases your tracks behind you.', 'The horizon trembles and gives nothing away.'],
  hills: ['The road climbs and falls like a rope.', 'Stone walls stitch the hillsides together.', 'A shepherd counts sheep beneath a thorn tree.'],
  mountain: ['The pass is cold even at noon.', 'Cloud shadows crawl over the scree.', 'An eagle turns a slow circle overhead.'],
}

function travelLine(route, fromName, toName, dayIndex, days, weather) {
  if (days === 1) {
    return `You leave ${fromName} and reach ${toName} by dusk. ${weather.line}`
  }
  if (dayIndex === 1) {
    return `You leave ${fromName} on the ${route.label.toLowerCase()}. ${weather.line}`
  }
  if (dayIndex === days) {
    return `The walls of ${toName} rise at sunset. ${weather.line}`
  }
  return `${pick(TERRAIN_FLAVOUR[route.terrain] || TERRAIN_FLAVOUR.plains)} ${weather.line}`
}

export function rescueMerchant(state) {
  state.health = 16
  const lostCash = Math.min(state.cash, Math.max(4, round(state.cash * 0.3)))
  state.cash -= lostCash
  let lostUnits = 0
  const lostNames = []
  for (const [id, entry] of Object.entries(state.cargo)) {
    const before = entry.qty
    entry.qty = Math.floor(entry.qty / 2)
    lostUnits += before - entry.qty
    if (entry.qty <= 0) delete state.cargo[id]
    if (before - entry.qty > 0) lostNames.push(id)
  }
  const cargoText = lostUnits
    ? ` Half your cargo (${lostUnits} ${lostUnits === 1 ? 'unit' : 'units'}) is gone.`
    : ''
  addJournal(
    state,
    `You collapsed on the road. A passing caravan saved you, but took ${lostCash} crowns as thanks.${cargoText}`,
  )
  return `A passing caravan finds you at the edge of the road. You wake with 16 life, ${lostCash} crowns lighter.${cargoText}`
}

function loseCargoUnits(state, maxUnits = 2) {
  const lost = []
  let remaining = maxUnits
  while (remaining > 0) {
    const items = cargoItems(state)
    if (!items.length) break
    const item = pick(items)
    const entry = state.cargo[item.good.id]
    if (!entry) break
    entry.qty -= 1
    lost.push(item.good)
    if (entry.qty <= 0) delete state.cargo[item.good.id]
    remaining -= 1
  }
  if (!lost.length) return null
  const names = lost.map((good) => good.name.toLowerCase())
  return `${lost.length} ${lost.length === 1 ? 'unit' : 'units'} of ${names.join(', ')}`
}

function addLoot(state) {
  const found = []
  const attempts = randInt(2, 3)
  for (let index = 0; index < attempts; index += 1) {
    const good = pick(GOODS)
    if (cargoWeight(state) + good.weight > currentTransport(state).capacity) continue
    const entry = state.cargo[good.id] || { qty: 0, avgCost: 0 }
    entry.qty += 1
    state.cargo[good.id] = entry
    found.push(good)
  }
  if (!found.length) return null
  return found.map((good) => `${good.name} ×1`).join(', ')
}

export function resolveTravel(state, route, destinationId) {
  const destination = CITY_BY_ID[destinationId]
  const from = currentCity(state)
  const transport = currentTransport(state)
  const days = routeDays(state, route)
  const log = []
  let water = 0
  let food = 0
  let energy = 0
  let rescue = null

  for (let dayIndex = 1; dayIndex <= days; dayIndex += 1) {
    const weather = rollWeather(route.terrain)
    state.day += 1
    state.weather = weather.id
    const dayWater = Math.max(1, round(transport.water * weather.water))
    const dayFood = Math.max(1, round(transport.food * weather.food))
    const dayEnergy = Math.max(1, round(transport.energy * weather.energy))
    water += dayWater
    food += dayFood
    energy += dayEnergy

    state.thirst = clamp(state.thirst - dayWater, 0, 100)
    state.hunger = clamp(state.hunger - dayFood, 0, 100)
    state.energy = clamp(state.energy - dayEnergy, 0, 100)
    if (state.thirst <= 0) state.health -= 8
    if (state.hunger <= 0) state.health -= 5
    if (state.energy <= 0) state.health -= 4
    state.health = Math.max(0, state.health)

    refreshMarkets(state, 1)

    let line = travelLine(route, from.name, destination.name, dayIndex, days, weather)
    if (state.thirst <= 0) line += ' Your throat is dust; the waterskins are empty.'
    if (state.health <= 0 && !rescue) {
      rescue = rescueMerchant(state)
      line += ' The road goes dark at the edges.'
    }
    log.push({ day: state.day, weather, text: line })
  }

  if (state.health <= 0 && !rescue) {
    rescue = rescueMerchant(state)
  }

  state.cityId = destinationId
  state.distance += route.distance
  if (!state.visited.includes(destinationId)) state.visited.push(destinationId)
  addJournal(state, `Arrived in ${destination.name} after ${days} ${days === 1 ? 'day' : 'days'} on the ${route.label.toLowerCase()}.`)

  let event = null
  if (!rescue && chance(route.risk * 0.82 + 0.035)) {
    event = createRoadEvent(state, route, days)
    state.events += 1
  }

  return {
    destination,
    route,
    days,
    log,
    water,
    food,
    energy,
    rescue,
    event,
    arrivalDay: state.day,
  }
}

export function createRoadEvent(state, route, days) {
  const pool = ['toll', 'highwaymen', 'shrine', 'traveler', 'cart', 'strap', 'spring']
  if (route.terrain === 'desert') pool.push('dust', 'dust')
  if (route.terrain === 'forest') pool.push('cart')
  if (route.terrain === 'mountain' || route.terrain === 'hills') pool.push('strap')
  const type = pick(pool)

  if (type === 'toll') {
    const fare = Math.min(state.cash, Math.max(1, 7 + days * 2))
    const ford = 12 + days * 2
    return {
      id: 'toll',
      title: 'The chain across the road',
      text: 'A toll keeper in a patched coat has stretched a chain between two stones. “The bridge is private,” he says, though there is no bridge in sight.',
      choices: [
        {
          label: 'Pay the toll',
          detail: `−${fare} crowns`,
          apply: () => {
            state.cash -= fare
            addJournal(state, `Paid ${fare} crowns to a roadside toll keeper.`)
            return {
              title: 'The chain comes down',
              text: 'The keeper pockets the silver, lifts the chain, and wishes you a dry road with the enthusiasm of a man who has said it ten thousand times.',
              changes: [`−${fare} crowns`],
            }
          },
        },
        {
          label: 'Take the old ford',
          detail: `−${ford} energy · −6 thirst`,
          apply: () => {
            state.energy = clamp(state.energy - ford, 0, 100)
            state.thirst = clamp(state.thirst - 6, 0, 100)
            addJournal(state, 'Took the old ford to avoid a roadside toll.')
            return {
              title: 'Wet boots, lighter purse',
              text: 'You leave the chain behind and splash through the old ford. The water is colder than it looks, but your crowns stay where they belong.',
              changes: [`−${ford} energy`, '−6 thirst'],
            }
          },
        },
      ],
    }
  }

  if (type === 'highwaymen') {
    const demand = Math.min(state.cash, Math.max(6, round(state.cash * 0.12)))
    return {
      id: 'highwaymen',
      title: 'Riders on the ridge',
      text: 'Two riders come down from the ridge at an unhurried trot. One holds out a gloved hand. “A small toll for safe passage,” he says. The other does not smile.',
      choices: [
        {
          label: 'Pay them off',
          detail: `−${demand} crowns`,
          apply: () => {
            state.cash -= demand
            addJournal(state, `Paid ${demand} crowns to riders on the road.`)
            return {
              title: 'A costly courtesy',
              text: 'The silver changes hands. They bow with exaggerated grace and ride away. You count your cargo twice before moving on.',
              changes: [`−${demand} crowns`],
            }
          },
        },
        {
          label: 'Make a break for it',
          detail: 'A gamble',
          apply: () => {
            state.energy = clamp(state.energy - 10, 0, 100)
            if (chance(0.53)) {
              state.reputation += 2
              addJournal(state, 'Outran highwaymen on the open road.')
              return {
                title: 'The whip and the wind',
                text: 'You put your head down and drive hard. The riders give chase for half a mile, then pull up, laughing or cursing. You do not look back to decide which.',
                changes: ['−10 energy', '+2 honour'],
              }
            }
            state.health = Math.max(0, state.health - 17)
            const lost = loseCargoUnits(state, 2)
            addJournal(state, 'Highwaymen caught the caravan and took a heavy price.')
            return {
              title: 'Caught on the road',
              text: 'A stone turns underfoot and the riders close the gap. There is a scuffle, a hard blow, and then they are gone with whatever they could snatch.',
              changes: ['−17 life', ...(lost ? [`Lost ${lost}`] : [])],
            }
          },
        },
      ],
    }
  }

  if (type === 'dust') {
    return {
      id: 'dust',
      title: 'The dust storm',
      text: 'A brown wall rises from the horizon and crosses the road faster than a galloping horse. The camels complain; the sky disappears.',
      choices: [
        {
          label: 'Shelter and wait',
          detail: 'Lose a day · −6 hunger',
          apply: () => {
            state.day += 1
            state.hunger = clamp(state.hunger - 6, 0, 100)
            state.weather = rollWeather(route.terrain).id
            refreshMarkets(state, 1)
            addJournal(state, 'Waited out a dust storm behind a windbreak of saddles.')
            return {
              title: 'A day beneath the felt',
              text: 'You wrap your face, hobble the beasts, and wait. By evening the storm has moved on, leaving grit in every fold of cloth and a day missing from the ledger.',
              changes: ['A day passes', '−6 hunger'],
            }
          },
        },
        {
          label: 'Push through',
          detail: '−18 thirst · −12 energy · −8 life',
          apply: () => {
            state.thirst = clamp(state.thirst - 18, 0, 100)
            state.energy = clamp(state.energy - 12, 0, 100)
            state.health = Math.max(0, state.health - 8)
            addJournal(state, 'Pushed through a dust storm rather than lose a day.')
            return {
              title: 'Grit in every seam',
              text: 'You lean into the wind and keep the beasts moving by voice and rope. The storm scours your skin raw, but the road is still beneath your feet.',
              changes: ['−18 thirst', '−12 energy', '−8 life'],
            }
          },
        },
      ],
    }
  }

  if (type === 'shrine') {
    const offering = Math.min(state.cash, Math.max(1, 8))
    return {
      id: 'shrine',
      title: 'A wayside shrine',
      text: 'A small stone shrine stands where two roads once met. Its bowl holds a few copper coins and a wilted marigold. The saint’s face has worn away to a smooth, patient blank.',
      choices: [
        {
          label: 'Leave an offering',
          detail: `−${offering} crowns · +4 honour`,
          apply: () => {
            state.cash -= offering
            state.reputation += 4
            state.health = clamp(state.health + 4, 0, 100)
            addJournal(state, 'Left an offering at a forgotten roadside shrine.')
            return {
              title: 'A small kindness',
              text: 'You place the coins in the bowl and bow your head for a moment. Whatever listens to such places, the road feels a little less lonely afterwards.',
              changes: [`−${offering} crowns`, '+4 honour', '+4 life'],
            }
          },
        },
        {
          label: 'Take the shrine coins',
          detail: '+18 crowns · −3 honour',
          apply: () => {
            state.cash += 18
            state.reputation -= 3
            addJournal(state, 'Took coins from a roadside shrine.')
            return {
              title: 'A pocket of copper',
              text: 'The coins are old and soft-edged. You tell yourself the saint has no use for them. The silence that follows is not quite an answer.',
              changes: ['+18 crowns', '−3 honour'],
            }
          },
        },
      ],
    }
  }

  if (type === 'traveler') {
    return {
      id: 'traveler',
      title: 'The thirsty traveller',
      text: 'A woman sits beneath a dead tree with an empty clay cup. She has walked from a village you have never heard of, and her lips are cracked with thirst.',
      choices: [
        {
          label: 'Share your water',
          detail: '−12 thirst · +4 honour',
          apply: () => {
            state.thirst = clamp(state.thirst - 12, 0, 100)
            state.reputation += 4
            addJournal(state, 'Shared water with a traveller on the road.')
            return {
              title: 'Water freely given',
              text: 'She drinks slowly, then presses a small carved bead into your palm. “For the next honest road,” she says. You never learn her name.',
              changes: ['−12 thirst', '+4 honour'],
            }
          },
        },
        {
          label: 'Keep moving',
          detail: 'No cost · no kindness',
          apply: () => {
            addJournal(state, 'Passed a thirsty traveller without stopping.')
            return {
              title: 'The road is long',
              text: 'You tell yourself there will be time to help at the next well. Her eyes follow you until the road bends, and then she is behind you.',
              changes: [],
            }
          },
        },
      ],
    }
  }

  if (type === 'cart') {
    return {
      id: 'cart',
      title: 'The abandoned cart',
      text: 'A cart lies on its side in the ditch, one wheel still turning slowly in the wind. There is no horse, no driver, and no sign of a struggle. The cargo is still tied down.',
      choices: [
        {
          label: 'Search the wreck',
          detail: 'Take what will fit',
          apply: () => {
            const found = addLoot(state)
            if (found) addJournal(state, `Salvaged ${found} from an abandoned cart.`)
            return {
              title: found ? 'A fortuitous wreck' : 'Nothing worth the weight',
              text: found
                ? 'You cut the ropes and sort through the load. Most of it is spoiled, but a little is sound. You take only what the caravan can carry.'
                : 'You cut the ropes and find only spoiled goods and broken pottery. The wheel turns slowly, as if waiting for an answer it will not get.',
              changes: found ? [`Gained ${found}`] : [],
            }
          },
        },
        {
          label: 'Leave it for the crows',
          detail: 'No risk · no reward',
          apply: () => {
            addJournal(state, 'Left an abandoned cart untouched.')
            return {
              title: 'Not your cart',
              text: 'There is no telling whose load it was, or who might come looking for it. You give the wreck a wide berth and keep your own wheels on the road.',
              changes: [],
            }
          },
        },
      ],
    }
  }

  if (type === 'strap') {
    const repair = Math.min(state.cash, Math.max(1, 16))
    return {
      id: 'strap',
      title: 'A strap gives way',
      text: 'A loud crack, a lurch, and the caravan comes to a halt. A harness strap has split clean through. The next village is hours away and the light is going.',
      choices: [
        {
          label: 'Pay a passing wheelwright',
          detail: `−${repair} crowns`,
          apply: () => {
            state.cash -= repair
            addJournal(state, 'Paid a wheelwright to mend a broken harness strap.')
            return {
              title: 'Mended with a price',
              text: 'A wheelwright with a cart full of leather scraps stops long enough to stitch and rivet the strap. It is ugly work, but it will hold.',
              changes: [`−${repair} crowns`],
            }
          },
        },
        {
          label: 'Patch it by hand',
          detail: '−10 energy · risk one unit',
          apply: () => {
            state.energy = clamp(state.energy - 10, 0, 100)
            if (chance(0.4)) {
              const lost = loseCargoUnits(state, 1)
              addJournal(state, 'A hand-patched harness broke and cost a unit of cargo.')
              return {
                title: 'The patch holds — mostly',
                text: 'You knot the strap with wet leather and start again. An hour later it snaps, and a bundle tumbles into the ditch before you can stop.',
                changes: ['−10 energy', ...(lost ? [`Lost ${lost}`] : [])],
              }
            }
            addJournal(state, 'Patched a broken harness strap by hand.')
            return {
              title: 'The patch holds',
              text: 'You work the leather until your fingers ache, then test the knot with your full weight. It creaks, but it holds. You roll on into the dusk.',
              changes: ['−10 energy'],
            }
          },
        },
      ],
    }
  }

  return {
    id: 'spring',
    title: 'A spring in the shade',
    text: 'A spring bubbles out from beneath a shelf of grey rock. The water is cold enough to hurt your teeth, and the grass around it is impossibly green.',
    choices: [
      {
        label: 'Drink and press on',
        detail: '+38 thirst · +8 energy',
        apply: () => {
          state.thirst = clamp(state.thirst + 38, 0, 100)
          state.energy = clamp(state.energy + 8, 0, 100)
          addJournal(state, 'Drank from a clear spring on the road.')
          return {
            title: 'Cold and sweet',
            text: 'You drink until your headache lifts, fill the skins, and let the beasts drink their fill. The road feels shorter afterwards.',
            changes: ['+38 thirst', '+8 energy'],
          }
        },
      },
      {
        label: 'Make camp for a day',
        detail: 'Lose a day · recover',
        apply: () => {
          state.day += 1
          state.thirst = clamp(state.thirst + 50, 0, 100)
          state.energy = clamp(state.energy + 22, 0, 100)
          state.health = clamp(state.health + 6, 0, 100)
          state.hunger = clamp(state.hunger - 4, 0, 100)
          state.weather = rollWeather(route.terrain).id
          refreshMarkets(state, 1)
          addJournal(state, 'Made camp beside a clear spring for a day.')
          return {
            title: 'One good day',
            text: 'You unsaddle, build a small fire, and sleep with the sound of water nearby. In the morning the beasts are calmer and the road is still there, patient as ever.',
            changes: ['A day passes', '+50 thirst', '+22 energy', '+6 life'],
          }
        },
      },
    ],
  }
}

export function applyRoadChoice(state, event, index) {
  const choice = event.choices[index]
  if (!choice) return null
  const outcome = choice.apply()
  let collapse = null
  if (state.health <= 0) {
    collapse = rescueMerchant(state)
    outcome.changes = [...(outcome.changes || []), collapse]
  }
  addJournal(state, `${event.title}: ${outcome.text}`)
  return outcome
}
