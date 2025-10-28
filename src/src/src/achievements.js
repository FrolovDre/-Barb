/**
 * @module achievements
 * Трекинг и выдача достижений.
 */

/**
 * Проверяет и открывает достижения.
 * @param {import('./types').GameState} state 
 * @param {{achievements:any[]}} data 
 * @param {(a:any)=>void} onUnlock 
 */
export function checkAchievements(state, data, onUnlock){
  for (const a of data.achievements) {
    if (state.achievements[a.key]) continue; // уже открыто
    if (meets(state, a.condition)) {
      state.achievements[a.key] = { unlockedAt: Date.now() };
      applyReward(state, a.reward || {});
      onUnlock && onUnlock(a);
    }
  }
}

/** Условия. */
function meets(state, cond){
  if (!cond) return false;
  switch(cond.type){
    case 'buyDistinct': {
      const ownedKeys = Object.keys(state.inventory).filter(k => state.inventory[k] > 0);
      const cats = new Set(ownedKeys.map(k => k.split('_')[0])); // простая эвристика category из key
      return cats.size >= (cond.count||1);
    }
    case 'totalGlow':
      return state.totalGlowEarned >= (cond.value||0);
    case 'tripsCompleted':
      return state.stats.tripsCompleted >= (cond.count||1);
    case 'tripTimeLess':
      if (!state._lastTripTime) return false;
      return state._lastTripTime <= (cond.seconds||999999);
    case 'uniqueItems': {
      const c = Object.keys(state.inventory).filter(k => (state.inventory[k]||0) > 0).length;
      return c >= (cond.count||1);
    }
    case 'eventsActivated':
      return state.stats && state.stats.eventsActivated >= (cond.count||1);
    case 'spentGlow':
      return state.spentGlow >= (cond.value||0);
    case 'boostsUsed':
      return (state.boostsUsed||0) >= (cond.count||1);
    case 'tripDuringEvent': {
      const last = state.trip.lastFinishDuringEvent;
      return last === cond.eventKey;
    }
    default: return false;
  }
}

/** Награды достижения. */
function applyReward(state, reward){
  if (reward.perClickAdd) state.perClickBase += reward.perClickAdd;
  if (reward.perClickMult) state.perClickMult += reward.perClickMult;
  if (reward.perSecondAdd) state.perSecondBase += reward.perSecondAdd;
  if (reward.perSecondMult) state.perSecondMult += reward.perSecondMult;
  if (reward.tripSpeedMult) state.trip.speedMult += reward.tripSpeedMult;
  if (reward.eventChance) state.eventChanceBonus += reward.eventChance;
  if (reward.boostDurationMult) state.boostDurationMult += reward.boostDurationMult;
  if (reward.shopDiscount) state.shopDiscountExtra += reward.shopDiscount;
}
