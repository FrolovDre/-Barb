/**
 * @module ui
 * Рендер и события интерфейса.
 */

import { currentPerClick, currentPerSecond } from './economy.js';

/** Простая i18n */
export const I18N = {
  dicts: { ru: null, en: null },
  locale: 'ru',
  t(path){
    const dict = this.dicts[this.locale] || {};
    return path.split('.').reduce((o,k)=> (o&&o[k]!=null)?o[k]:null, dict) ?? path;
  },
  setLocale(loc){ this.locale = loc; }
};

/** ARIA live region for SR notifications */
const srLive = (() => {
  const el = document.createElement('div');
  el.id = 'sr-live';
  el.setAttribute('role','status');
  el.setAttribute('aria-live','polite');
  document.body.appendChild(el);
  return el;
})();

const notifBox = (() => {
  const el = document.createElement('div');
  el.id = 'notif';
  document.body.appendChild(el);
  return el;
})();

/**
 * Неблокирующее уведомление.
 * @param {string} msg 
 */
export function notify(msg){
  notifBox.textContent = msg;
  notifBox.classList.add('show');
  srLive.textContent = msg;
  setTimeout(()=>notifBox.classList.remove('show'), 2200);
}

/**
 * Форматирует число красиво.
 */
export function fmt(n){
  if (n >= 1e9) return (n/1e9).toFixed(2)+'B';
  if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
  if (n >= 1e4) return Math.floor(n).toLocaleString();
  if (n >= 1000) return (n/1000).toFixed(2)+'K';
  return Math.floor(n).toString();
}

/**
 * Обновляет верхние счётчики.
 */
export function renderTop(state){
  document.getElementById('glowCount').textContent = fmt(state.glow);
  document.getElementById('perClick').textContent = fmt(currentPerClick(state));
  document.getElementById('perSecond').textContent = fmt(currentPerSecond(state));
}

/**
 * Обновляет прогресс поездки.
 */
export function renderTrip(state){
  const p = Math.max(0, Math.min(1, state.trip.progress));
  const pct = Math.round(p*100);
  const fill = document.getElementById('progressFill');
  const txt = document.getElementById('tripPercent');
  fill.style.width = pct + '%';
  fill.parentElement.setAttribute('aria-valuenow', String(pct));
  txt.textContent = pct + '%';
}

/**
 * Активные бусты/ивенты.
 */
export function renderActiveEffects(state, i18n){
  const wrap = document.getElementById('activeBoosts');
  wrap.innerHTML = '';
  for (const e of state.activeEvents) {
    const div = document.createElement('div');
    div.className = 'boost ' + (e.effects.perClickMultiplier || e.effects.perSecondMultiplier || e.effects.shopDiscount ? 'positive':'negative');
    const n = (e.name?.[i18n.locale]) || e.key;
    div.textContent = `${n} · ${Math.ceil(e.timeLeft)}s`;
    wrap.appendChild(div);
  }
}

/**
 * Рендер магазина.
 */
export function renderShop(state, data, i18n, currentCat, onBuy, onActivateBoost){
  const catsEl = document.getElementById('shopCategories');
  const listEl = document.getElementById('shopList');
  catsEl.innerHTML = '';
  listEl.innerHTML = '';
  const catsOrder = ['clothes','accessories','transport','cosmetics'];
  const cats = new Set(data.items.map(i=>i.category));
  for (const c of catsOrder) if (cats.has(c)) {
    const btn = document.createElement('button');
    btn.className = 'shop-cat' + (c===currentCat?' active':'');
    btn.textContent = i18n.t('shop.category.'+c) || c;
    btn.addEventListener('click', () => onBuy('__switch__', c));
    catsEl.appendChild(btn);
  }
  for (const item of data.items.filter(i => i.category === currentCat)) {
    const level = state.inventory[item.key] || 0;
    const max = item.maxLevel || 1;
    const basePrice = window.__economy_priceFor(item.basePrice, level);
    const discount = Math.min(0.9, state.shopDiscountExtra || 0);
    const price = Math.max(1, Math.ceil(basePrice * (1 - discount)));
    const card = document.createElement('div');
    card.className = 'card';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = (item.name?.[i18n.locale]) || item.key;
    const desc = document.createElement('div');
    desc.className = 'desc';
    desc.textContent = (item.desc?.[i18n.locale]) || '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = (i18n.t('shop.owned')||'Ур.') + ' ' + level + '/' + max;
    const priceEl = document.createElement('span');
    priceEl.className = 'price';
    priceEl.textContent = (i18n.t('shop.price')||'Цена') + ': ' + fmt(price);
    meta.appendChild(badge); meta.appendChild(priceEl);
    const actions = document.createElement('div'); actions.className='actions';

    if (item.effects?.activeBoost) {
      const btnBoost = document.createElement('button');
      btnBoost.className = 'secondary';
      btnBoost.textContent = i18n.t('shop.activeBoost') || 'Активировать буст';
      btnBoost.disabled = level <= 0;
      btnBoost.addEventListener('click', () => onActivateBoost(item));
      actions.appendChild(btnBoost);
    }

    const btn = document.createElement('button');
    btn.className = 'buy';
    btn.textContent = (i18n.t('shop.buy')||'Купить');
    btn.disabled = level >= max;
    btn.addEventListener('click', () => onBuy(item.key, currentCat));
    actions.appendChild(btn);

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(meta);
    card.appendChild(actions);
    listEl.appendChild(card);
  }
}

/**
 * Рендер достижений.
 */
export function renderAchievements(state, data, i18n){
  const wrap = document.getElementById('achievementsList');
  wrap.innerHTML = '';
  for (const a of data.achievements) {
    const unlocked = !!state.achievements[a.key];
    const card = document.createElement('div');
    card.className = 'ach' + (unlocked?'':' locked');
    const title = document.createElement('div');
    title.className='title';
    title.textContent = (a.name?.[i18n.locale]) || a.key;
    const desc = document.createElement('div');
    desc.className='desc';
    desc.textContent = (a.desc?.[i18n.locale]) || '';
    const reward = document.createElement('div');
    reward.className='reward';
    reward.textContent = (i18n.t('ach.reward')||'Награда') + ': ' + rewardToText(a.reward);
    card.appendChild(title); card.appendChild(desc); card.appendChild(reward);
    wrap.appendChild(card);
  }
}
function rewardToText(r){
  const out = [];
  if (r.perClickAdd) out.push(`+${r.perClickAdd} к/клик`);
  if (r.perClickMult) out.push(`×${(1+r.perClickMult).toFixed(2)} клик`);
  if (r.perSecondAdd) out.push(`+${r.perSecondAdd}/сек`);
  if (r.perSecondMult) out.push(`×${(1+r.perSecondMult).toFixed(2)} сек`);
  if (r.tripSpeedMult) out.push(`+${Math.round(r.tripSpeedMult*100)}% скорость`);
  if (r.eventChance) out.push(`+ивенты`);
  if (r.boostDurationMult) out.push(`+длительность бустов`);
  if (r.shopDiscount) out.push(`скидка`);
  return out.join(', ');
}

/**
 * Tab switching & settings bindings.
 */
export function initTabs(){
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.panel-body');
  tabs.forEach(t => t.addEventListener('click', () => {
    tabs.forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const id = t.getAttribute('data-tab');
    panels.forEach(p => p.classList.toggle('active', p.getAttribute('data-panel') === id));
  }));
}

/**
 * Применить переключатели настроек к DOM.
 */
export function applySettingsToDOM(state){
  document.getElementById('toggleSound').checked = !!state.settings.sound;
  document.getElementById('toggleAnim').checked = !!state.settings.animations;
  document.getElementById('toggleHC').checked = !!state.settings.highContrast;
  document.getElementById('langSelect').value = state.settings.locale || 'ru';
  document.body.classList.toggle('no-anim', !state.settings.animations);
  document.body.classList.toggle('high-contrast', !!state.settings.highContrast);
}

/** Применить локализацию к статическим текстам. */
export function localizeStatic(i18n){
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = i18n.t(key);
    if (val) el.textContent = val;
  });
}

/** Простые звуки (WebAudio beeps) */
let audioCtx = null;
export function sfxInit(){
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
}
export function sfx(state, type){
  if (!state.settings.sound || !audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (type === 'click'){ o.frequency.setValueAtTime(660, now); }
  else if (type === 'buy'){ o.frequency.setValueAtTime(440, now); }
  else if (type === 'event'){ o.frequency.setValueAtTime(820, now); }
  else { o.frequency.setValueAtTime(520, now); }
  g.gain.setValueAtTime(0.1, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now+0.12);
  o.start(now); o.stop(now+0.12);
}
