import { loadState, saveState, exportState, importState, resetState } from './gameState.js';
import { priceFor, recalcDerived, currentPerClick, currentPerSecond, currentTripSpeed } from './economy.js';
import { tickEvents } from './events.js';
import { checkAchievements } from './achievements.js';
import { buyItem, getCategories } from './store.js';
import { I18N, notify, fmt, renderTop, renderTrip, renderActiveEffects, renderShop, renderAchievements, initTabs, applySettingsToDOM, localizeStatic, sfxInit, sfx } from './ui.js';

// expose priceFor for UI module (no circular import)
window.__economy_priceFor = priceFor;

/** ------------ Data loading with local file fallback ------------ */
async function loadJSON(path, inlineId){
  // Try fetch first (works when run via http server). If fails, parse inline <script>.
  try {
    const r = await fetch(path);
    if (!r.ok) throw 0;
    return await r.json();
  } catch {
    const el = document.getElementById(inlineId);
    return el ? JSON.parse(el.textContent) : {};
  }
}

let DATA = { items:[], events:[], achievements:[] };

async function loadAllData(){
  const [items, events, ach, ru, en] = await Promise.all([
    loadJSON('assets/data/items.json','items-data'),
    loadJSON('assets/data/events.json','events-data'),
    loadJSON('assets/data/achievements.json','achievements-data'),
    loadJSON('i18n/ru.json','i18n-ru'),
    loadJSON('i18n/en.json','i18n-en'),
  ]);
  DATA.items = items.items || [];
  DATA.events = events.events || [];
  DATA.achievements = ach.achievements || [];
  I18N.dicts.ru = ru;
  I18N.dicts.en = en;
}

/** ------------ App ------------- */
const state = loadState();
let currentCategory = 'clothes';
let secAccumulator = 0;
let lastClickAt = 0;

(async function init(){
  await loadAllData();
  I18N.setLocale(state.settings.locale || 'ru');
  document.title = I18N.locale === 'ru' ? 'Glow Trip — Эда едет к Серкану' : 'Glow Trip — Eda rides to Serkan';
  localizeStatic(I18N);
  initTabs();
  bindUI();
  sfxInit();

  // initial calc
  recalcDerived(state, DATA);
  applySettingsToDOM(state);
  renderAll();

  // Game loop
  requestAnimationFrame(loop);

  // Autosave & before unload
  window.addEventListener('beforeunload', () => {
    saveState(state);
  });
})();

function renderAll(){
  renderTop(state);
  renderTrip(state);
  renderActiveEffects(state, I18N);
  renderShop(state, DATA, I18N, currentCategory, handleBuy, handleBoostActivate);
  renderAchievements(state, DATA, I18N);
}

function bindUI(){
  const clickBtn = document.getElementById('clickBtn');
  const hero = document.getElementById('hero');
  const onClick = () => {
    const now = performance.now();
    if (now - lastClickAt < 60) return; // анти-дребезг ~ 60мс
    lastClickAt = now;
    const gain = currentPerClick(state);
    state.glow += gain;
    state.totalGlowEarned += gain;
    sfx(state, 'click');
    renderTop(state);
  };
  clickBtn.addEventListener('click', onClick);
  hero.addEventListener('click', (e)=> {
    if (e.target !== clickBtn) onClick();
  });
  hero.addEventListener('keydown', (e)=>{
    if (e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); onClick(); }
  });

  // Tabs are initialized in ui.initTabs()

  // Settings
  document.getElementById('toggleSound').addEventListener('change', (e)=>{
    state.settings.sound = e.target.checked; saveState(state);
  });
  document.getElementById('toggleAnim').addEventListener('change', (e)=>{
    state.settings.animations = e.target.checked;
    document.body.classList.toggle('no-anim', !state.settings.animations);
    saveState(state);
  });
  document.getElementById('toggleHC').addEventListener('change', (e)=>{
    state.settings.highContrast = e.target.checked;
    document.body.classList.toggle('high-contrast', !!state.settings.highContrast);
    saveState(state);
  });
  document.getElementById('langSelect').addEventListener('change', (e)=>{
    state.settings.locale = e.target.value;
    I18N.setLocale(state.settings.locale);
    localizeStatic(I18N);
    renderAll();
    saveState(state);
  });

  document.getElementById('btnSave').addEventListener('click', ()=>{
    saveState(state);
    notify(I18N.t('settings.save') + ' ✔');
  });

  document.getElementById('btnExport').addEventListener('click', ()=>{
    const blob = new Blob([exportState(state)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `glowtrip_save_${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('fileImport').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const s = importState(text);
    Object.assign(state, s);
    recalcDerived(state, DATA);
    applySettingsToDOM(state);
    I18N.setLocale(state.settings.locale||'ru');
    localizeStatic(I18N);
    renderAll();
    saveState(state);
    notify('Импорт завершён');
  });

  document.getElementById('btnReset').addEventListener('click', ()=>{
    if (!confirm('Сбросить прогресс? Это действие необратимо.')) return;
    const fresh = resetState();
    Object.assign(state, fresh);
    recalcDerived(state, DATA);
    applySettingsToDOM(state);
    I18N.setLocale(state.settings.locale||'ru');
    localizeStatic(I18N);
    renderAll();
    saveState(state);
  });
}

/** Handle buy from shop */
function handleBuy(keyOrSwitch, catIfSwitch){
  if (keyOrSwitch === '__switch__'){
    currentCategory = catIfSwitch;
    renderShop(state, DATA, I18N, currentCategory, handleBuy, handleBoostActivate);
    return;
  }
  const res = buyItem(state, DATA, keyOrSwitch);
  if (!res.ok){
    if (res.reason === 'no_money'){
      notify('Недостаточно Сияния: ' + fmt(res.price||0));
    } else if (res.reason === 'max_level'){
      notify('Максимальный уровень');
    }
    return;
  }
  sfx(state, 'buy');
  recalcDerived(state, DATA);
  renderTop(state);
  renderShop(state, DATA, I18N, currentCategory, handleBuy, handleBoostActivate);
  checkAchievements(state, {achievements: DATA.achievements}, (a)=>{
    notify((a.name?.[I18N.locale]) || 'Achievement!');
  });
  saveState(state);
}

/** Активировать временный буст (из косметики). */
function handleBoostActivate(item){
  const level = state.inventory[item.key] || 0;
  if (level <= 0 || !item.effects?.activeBoost) return;
  const b = item.effects.activeBoost;
  const dur = b.duration || 30;
  let effects = {};
  if (b.type === 'multIncome'){
    effects = { perClickMultiplier: b.mult || 2, perSecondMultiplier: b.mult || 2 };
  }
  state.activeEvents.push({
    key: 'boost_'+item.key,
    name: {ru:'Буст', en:'Boost'},
    timeLeft: dur * (1 + (state.boostDurationMult||0)),
    effects
  });
  state.boostsUsed = (state.boostsUsed||0) + 1;
  sfx(state, 'event');
  saveState(state);
}

/** ------------ Main game loop with delta-time ------------ */
function loop(now){
  const dtMs = now - state.run.lastTick;
  state.run.lastTick = now;
  const dt = Math.min(0.25, dtMs/1000); // cap delta at 250ms
  secAccumulator += dt;

  // Passive income
  const perSec = currentPerSecond(state);
  state.glow += perSec * dt;
  state.totalGlowEarned += perSec * dt;

  // Trip progress
  const spd = currentTripSpeed(state);
  state.trip.progress += spd * dt;
  if (state.trip.progress >= 1){
    state.trip.progress = 0;
    const finishNow = Date.now();
    const tripTime = (finishNow - state.trip.startedAt)/1000;
    state._lastTripTime = tripTime;
    state.trip.startedAt = finishNow;
    // бонус за встречу: 5 * (perSecond * 20 + perClick * 5) как пример
    const bonus = Math.max(5, Math.floor(5*(currentPerSecond(state)*20 + currentPerClick(state)*5)));
    state.glow += bonus;
    state.totalGlowEarned += bonus;
    // если завершили под дождём — отметим
    const rainActive = state.activeEvents.some(e => e.key==='rain');
    state.trip.lastFinishDuringEvent = rainActive ? 'rain' : null;
    state.stats.tripsCompleted += 1;
    notify((I18N.t('trip.complete')||'Бонус: +{bonus}').replace('{bonus}', fmt(bonus)));
    checkAchievements(state, {achievements: DATA.achievements}, (a)=>{
      notify((a.name?.[I18N.locale]) || 'Achievement!');
    });
  }

  // Events tick (once per frame with dt)
  tickEvents(state, {events: DATA.events}, dt, (ev)=>{
    sfx(state,'event');
    notify((ev.name?.[I18N.locale]) || ev.key);
  });

  // recalc derived occasionally (cheap enough per frame given scale)
  recalcDerived(state, DATA);

  // Autosave every ~10s
  state.run.saveTimer += dt;
  if (state.run.saveTimer >= 10){
    state.run.saveTimer = 0;
    saveState(state);
  }

  // Render minimal diffs
  renderTop(state);
  renderTrip(state);
  renderActiveEffects(state, I18N);

  requestAnimationFrame(loop);
}

/** Keyboard global: Space/Enter click support on body */
window.addEventListener('keydown', (e)=>{
  if (['Space','Enter'].includes(e.code) && !/input|textarea|select/i.test(e.target.tagName)) {
    e.preventDefault();
    const now = performance.now();
    if (now - lastClickAt < 60) return;
    lastClickAt = now;
    const gain = currentPerClick(state);
    state.glow += gain; state.totalGlowEarned += gain;
    sfx(state,'click');
  }
});

/** Shop initial category: ensure exists */
(function ensureCat(){
  const cats = getCategories(DATA, I18N.locale);
  if (!cats.includes(currentCategory) && cats.length) currentCategory = cats[0];
})();

/** Expose for debugging in console */
window._state = state;
window._data = DATA;
