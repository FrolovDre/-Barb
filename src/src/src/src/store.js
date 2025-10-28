/**
 * @module store
 * Магазин и покупки.
 */
import { priceFor, recalcDerived } from './economy.js';

/**
 * Покупка предмета.
 * @param {import('./types').GameState} state 
 * @param {{items:any[]}} data 
 * @param {string} key 
 * @returns {{ok:boolean, reason?:string, newLevel?:number, price?:number}}
 */
export function buyItem(state, data, key){
  const item = data.items.find(it => it.key === key);
  if (!item) return {ok:false, reason:'no_item'};
  const level = state.inventory[key] || 0;
  const max = item.maxLevel || 1;
  if (level >= max) return {ok:false, reason:'max_level'};
  // скидки (суммарные)
  const basePrice = priceFor(item.basePrice, level);
  const discount = Math.min(0.9, (state.shopDiscountExtra||0)); // в state уже учтены ивенты/ачивки
  const price = Math.max(1, Math.ceil(basePrice * (1 - discount)));
  if (state.glow < price) return {ok:false, reason:'no_money', price};
  state.glow -= price;
  state.spentGlow += price;
  state.inventory[key] = level + 1;
  // пересчитать derived (перекладываем на экономику)
  recalcDerived(state, data);
  return {ok:true, newLevel: state.inventory[key], price};
}

/**
 * Возвращает категории с локализованными именами.
 * @param {{items:any[]}} data 
 * @param {('ru'|'en')} locale
 */
export function getCategories(data, locale){
  const order = ['clothes','accessories','transport','cosmetics'];
  const set = new Set(data.items.map(i => i.category));
  return order.filter(c => set.has(c));
}
