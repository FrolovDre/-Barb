/**
 * @module gameState
 * Централизованное состояние и сохранение.
 */

export const SAVE_KEY = "glowtrip_save_v1";

/**
 * Создаёт новое состояние по умолчанию.
 * @returns {import('./types').GameState}
 */
export function defaultState() {
  const now = Date.now();
  return {
    version: 1,
    glow: 0,
    spentGlow: 0,
    totalGlowEarned: 0,
    perClickBase: 1,
    perClickBonus: 0,
    perClickMult: 1,
    perSecondBase: 0,
    perSecondBonus: 0,
    perSecondMult: 1,
    eventChanceBonus: 0,
    boostDurationMult: 0,
    shopDiscountExtra: 0,
    trip: {
      progress: 0,           // 0..1
      speedBase: 0.12,       // fraction per second
      speedBonus: 0,
      speedMult: 1,
      startedAt: now,
      lastFinishDuringEvent: null
    },
    activeEvents: [],         // [{key, timeLeft, effects}]
    cooldowns: {},            // {eventKey: secondsLeft}
    inventory: {},            // {itemKey: level}
    boostsUsed: 0,
    stats: {
      eventsActivated: 0,
      tripsCompleted: 0
    },
    achievements: {},         // {key: {unlockedAt:number}}
    settings: {
      sound: true,
      animations: true,
      highContrast: false,
      locale: 'ru'
    },
    run: {
      lastTick: performance.now(),
      saveTimer: 0
    }
  };
}

/**
 * Глубокая копия простых объектов.
 */
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

/**
 * Загружает сохранение из localStorage.
 * @returns {import('./types').GameState}
 */
export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // миграции версий можно добавить тут
    return Object.assign(defaultState(), parsed);
  } catch {
    return defaultState();
  }
}

/**
 * Сохраняет состояние в localStorage.
 * @param {import('./types').GameState} state 
 */
export function saveState(state) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Экспорт в JSON-строку.
 * @param {import('./types').GameState} state 
 * @returns {string}
 */
export function exportState(state){
  const snapshot = deepClone(state);
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Импорт из JSON-строки.
 * @param {string} json 
 * @returns {import('./types').GameState}
 */
export function importState(json){
  const parsed = JSON.parse(json);
  const base = defaultState();
  return Object.assign(base, parsed);
}

/**
 * Полный сброс.
 * @returns {import('./types').GameState}
 */
export function resetState(){
  return defaultState();
}
