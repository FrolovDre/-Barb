/**
 * @typedef {Object} GameState
 * @property {number} version
 * @property {number} glow
 * @property {number} spentGlow
 * @property {number} totalGlowEarned
 * @property {number} perClickBase
 * @property {number} perClickBonus
 * @property {number} perClickMult
 * @property {number} perSecondBase
 * @property {number} perSecondBonus
 * @property {number} perSecondMult
 * @property {number} eventChanceBonus
 * @property {number} boostDurationMult
 * @property {number} shopDiscountExtra
 * @property {{progress:number,speedBase:number,speedBonus:number,speedMult:number,startedAt:number,lastFinishDuringEvent:string|null}} trip
 * @property {{key:string,name:any,timeLeft:number,effects:any}[]} activeEvents
 * @property {Record<string, number>} cooldowns
 * @property {Record<string, number>} inventory
 * @property {{eventsActivated:number,tripsCompleted:number}} stats
 * @property {Record<string,{unlockedAt:number}>} achievements
 * @property {{sound:boolean,animations:boolean,highContrast:boolean,locale:'ru'|'en'}} settings
 * @property {{lastTick:number, saveTimer:number}} run
 * @property {number} boostsUsed
 */
