/**
 * @module events
 * Случайные ивенты, таймеры и кулдауны.
 */

/**
 * Пытается активировать новое событие раз в секунду.
 * @param {import('./types').GameState} state 
 * @param {{events:any[]}} data 
 * @param {number} dtSec 
 * @param {(e:{key:string,name:any,duration:number,effects:any})=>void} onActivate 
 */
export function tickEvents(state, data, dtSec, onActivate){
  // уменьшение кулдаунов
  for (const k of Object.keys(state.cooldowns)) {
    state.cooldowns[k] = Math.max(0, state.cooldowns[k] - dtSec);
    if (state.cooldowns[k] === 0) delete state.cooldowns[k];
  }
  // уменьшение таймеров активных
  for (let i = state.activeEvents.length - 1; i >= 0; i--) {
    const e = state.activeEvents[i];
    e.timeLeft -= dtSec;
    if (e.timeLeft <= 0) {
      state.activeEvents.splice(i,1);
    }
  }

  // Пассивный шанс (суммируется из предметов и др.)
  const basePerSec = 0.005; // 0.5%/сек базовый
  const totalChance = basePerSec + (state.eventChanceBonus || 0);
  // Пробуем ровно 1 раз в секунду — используем dtSec аккумуляцию снаружи
  // Здесь просто бросок: чем больше dtSec, тем выше шанс
  const rollProb = 1 - Math.pow(1 - totalChance, dtSec); // корректно с дельтой времени
  if (Math.random() < rollProb) {
    // Выберем событие по их шансам, исключая кулдауны и уже активные того же типа
    const pool = data.events.filter(ev => !state.cooldowns[ev.key] && !state.activeEvents.some(a => a.key === ev.key));
    if (pool.length === 0) return;
    const totalW = pool.reduce((s,e)=>s+(e.chance||0.01),0);
    let r = Math.random()*totalW;
    let chosen = pool[0];
    for (const ev of pool) {
      r -= (ev.chance||0.01);
      if (r<=0){ chosen = ev; break; }
    }
    // Активируем
    const duration = applyBoostDuration(state, chosen.duration || 30);
    const effects = Object.assign({}, chosen.effects||{});
    state.activeEvents.push({ key: chosen.key, name: chosen.name, timeLeft: duration, effects });
    state.cooldowns[chosen.key] = (chosen.cooldown || (duration*2));
    state.stats.eventsActivated += 1;
    onActivate && onActivate({key:chosen.key,name:chosen.name,duration,effects});
  }
}

/** Применяет глобальный множитель длительности бустов. */
function applyBoostDuration(state, dur){
  const mult = 1 + (state.boostDurationMult || 0);
  return dur * mult;
}
