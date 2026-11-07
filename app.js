// Données temps réel sans clé : API publique Transitous (MOTIS), qui agrège le GTFS + GTFS-RT d'IDFM.
const API = 'https://api.transitous.org/api/';
const IDFM = 'fr-reseau-urbain-et-interurbain-dile-de-france-mobilites_';
const REFRESH_MS = 30000; // ponytail: service communautaire, ne pas descendre sous 30 s
const POPULAR = [
  ['IDFM:474151', 'Châtelet - Les Halles'], ['IDFM:73626', 'Gare de Lyon'], ['IDFM:71410', 'Gare du Nord'],
  ['IDFM:71517', 'La Défense'], ['IDFM:71139', 'Montparnasse'], ['IDFM:71311', 'République'],
];
// Pièces du porte-clés : [nom, détail, prix €, lien]
const BOM = [
  ['Seeed XIAO ESP32-C3', 'Microcontrôleur Wi-Fi, charge la batterie en USB-C', 5.5, 'https://thepihut.com/products/seeed-xiao-esp32c3'],
  ['Écran IPS 1,14" ST7789', '135×240 px, SPI', 5, 'https://www.amazon.fr/s?k=ecran+ips+1.14+st7789+135x240'],
  ['Batterie LiPo 3,7 V ~400 mAh', 'Format 502035, connecteur JST', 5, 'https://www.berrybase.de/en/lp-552035-lithium-polymer-lipo-battery-3.7v-350mah-with-2-pin-jst-connector'],
  ['3 boutons poussoirs 6×6 mm', 'Ligne suivante / filtre / veille', 1, 'https://www.amazon.fr/s?k=bouton+poussoir+6x6mm'],
  ['Mini interrupteur à glissière', 'Marche / arrêt', 0.5, 'https://www.amazon.fr/s?k=mini+interrupteur+glissiere+SS12D00'],
  ['Anneau + chaînette', 'Anneau brisé 25 mm', 1, 'https://www.amazon.fr/s?k=anneau+porte+cles+chainette'],
  ['Boîtier imprimé en 3D', 'PLA turquoise, ~15 g de filament', 0.5, 'https://www.amazon.fr/s?k=filament+pla+turquoise'],
  ['Fils silicone 30 AWG + gaine', 'Câblage écran et boutons', 1.5, 'https://www.amazon.fr/s?k=fil+silicone+30+awg'],
];
const MODE_LABEL = {SUBWAY: 'Métro', REGIONAL_RAIL: 'Train', RAIL: 'Train', SUBURBAN: 'Train', TRAM: 'Tram', BUS: 'Bus', COACH: 'Bus', FUNICULAR: 'Funiculaire', AERIAL_LIFT: 'Câble'};
const ICONS = {
  metro: '<circle cx="12" cy="12" r="9"/><path d="M8 16V8l4 5 4-5v8"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 11h14M9 21l-2-4M15 21l2-4"/>',
  tram: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2h6M12 2v4M6 13h12M9 21l-1.5-3M15 21l1.5-3"/>',
  bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7 21v-3M17 21v-3"/>',
  night: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  other: '<path d="M4 18 20 6M7 16v4M17 9v4"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  recent: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
};
const ico = (k, n = 18) => `<svg class="ico" width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;
const MODE_ICON = {Métro: 'metro', RER: 'train', Train: 'train', Tram: 'tram', Bus: 'bus', Noctilien: 'night', Tout: 'all'};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} },
};
let current = null, timer = null, lastUpdate = 0;

async function api(path, params) {
  const r = await fetch(API + path + '?' + new URLSearchParams(params));
  if (!r.ok) throw new Error('Transitous ' + r.status);
  return r.json();
}

// ---- chrome: horloge, barre collante
const hhmm = t => new Date(t).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'});
const agoText = () => { const s = Math.round((Date.now() - lastUpdate) / 1000); return s < 5 ? "à l'instant" : s < 60 ? `il y a ${s} s` : `il y a ${Math.floor(s / 60)} min`; };
setInterval(() => {
  $('#clock').textContent = hhmm(Date.now());
  if (lastUpdate && $('#ago')) $('#ago').textContent = agoText();
}, 1000);
const syncTop = () => document.documentElement.style.setProperty('--top-h', $('#top').offsetHeight + 'px');
addEventListener('resize', syncTop);
addEventListener('scroll', () => $('#top').classList.toggle('scrolled', scrollY > 4), {passive: true});

// ---- recherche
let searchSeq = 0, debounce, sel = -1;
const resultBtns = () => [...$('#results').querySelectorAll('[data-id]')];
const closeResults = () => { $('#results').classList.remove('open'); sel = -1; };
const modeChip = m => { const l = MODE_LABEL[m] ?? m; return `<span class="mode">${ico(MODE_ICON[l] ?? 'other', 12)}${l}</span>`; };
$('#q').addEventListener('input', e => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  if (q.length < 2) return closeResults();
  debounce = setTimeout(async () => {
    const seq = ++searchSeq;
    const hits = await api('v1/geocode', {text: q, type: 'STOP', place: '48.8566,2.3522'}).catch(() => []);
    if (seq !== searchSeq) return;
    const list = hits.filter(h => h.id.startsWith(IDFM)).slice(0, 7);
    $('#results').innerHTML = list.length ? list.map(h => `
      <button class="res" data-id="${esc(h.id.slice(IDFM.length))}" role="option">
        <span><b>${esc(h.name)}</b><small>${esc(h.areas?.find(a => a.default)?.name ?? '')}</small></span>
        <span class="modes">${[...new Set(h.modes ?? [])].map(modeChip).join('')}</span>
      </button>`).join('') : '<div class="res"><small>Aucun arrêt trouvé en Île-de-France</small></div>';
    sel = list.length ? 0 : -1;
    resultBtns()[0]?.classList.add('sel');
    $('#results').classList.add('open');
  }, 200);
});
$('#q').addEventListener('keydown', e => {
  const btns = resultBtns();
  if (!btns.length || !$('#results').classList.contains('open')) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    btns[sel]?.classList.remove('sel');
    sel = (sel + (e.key === 'ArrowDown' ? 1 : btns.length - 1)) % btns.length;
    btns[sel].classList.add('sel');
  } else if (e.key === 'Enter' && sel >= 0) btns[sel].click();
  else if (e.key === 'Escape') closeResults();
});
$('#results').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  closeResults(); $('#q').value = ''; $('#q').blur();
  location.hash = b.dataset.id;
});
document.addEventListener('click', e => { if (!e.target.closest('.search')) closeResults(); });

// ---- favoris (arrêts + lignes), récents, accueil
const favs = () => store.get('favs2', []);
const favLines = () => store.get('favLines', []);
function toggleFav() {
  const f = favs();
  store.set('favs2', f.some(x => x.id === current.id) ? f.filter(x => x.id !== current.id) : [...f, {id: current.id, name: current.name}]);
  render();
}
function toggleLine(id) {
  const f = favLines();
  store.set('favLines', f.includes(id) ? f.filter(x => x !== id) : [...f, id]);
  render();
}
function pushRecent(id, name) {
  store.set('recent', [{id, name}, ...store.get('recent', []).filter(r => r.id !== id)].slice(0, 6));
}
function renderFavbar() {
  $('#favbar').innerHTML = favs().map(f => `<a href="#${esc(f.id)}" class="${f.id === current?.id ? 'on' : ''}">${ico('star', 13)}${esc(f.name)}</a>`).join('');
  syncTop();
}
const chip = (id, name, icon, cls = '') => `<a class="chip ${cls}" href="#${esc(id)}" style="text-decoration:none;color:inherit">${ico(icon, 16)}${esc(name)}</a>`;
function renderHome() {
  document.title = 'Prochains passages';
  const f = favs(), recent = store.get('recent', []).filter(r => !f.some(x => x.id === r.id));
  $('#view').innerHTML = `
    <div class="hero">
      <h1>Votre prochain départ,<br><span>en temps réel.</span></h1>
      <p>Métro, RER, Transilien, tram et bus dans toute l'Île-de-France.</p>
    </div>
    ${f.length ? `<div class="label">Favoris</div><div class="chips">${f.map(x => chip(x.id, x.name, 'star', 'fav')).join('')}</div>` : ''}
    ${recent.length ? `<div class="label">Récents</div><div class="chips">${recent.map(x => chip(x.id, x.name, 'recent')).join('')}</div>` : ''}
    <div class="label">Gares populaires</div>
    <div class="chips">${POPULAR.map(([id, n]) => chip(id, n, 'pin')).join('')}</div>`;
}

// ---- départs
async function load(id) {
  clearTimeout(timer);
  if (current?.id !== id) kcIdx = 0, current = {id, name: favs().find(f => f.id === id)?.name ?? POPULAR.find(p => p[0] === id)?.[1] ?? '', lines: null, error: null, filter: 'Tout', fresh: true};
  render();
  try {
    // radius couvre tous les quais d'un pôle (ex. Châtelet - Les Halles : métro + RER + bus)
    const d = await api('v5/stoptimes', {stopId: IDFM + id, n: 80, radius: 250});
    if (current?.id !== id) return;
    current.name = d.place?.name ?? current.name;
    pushRecent(id, current.name);
    const now = Date.now(), lines = new Map(), seen = new Set();
    for (const s of d.stopTimes) {
      const p = s.place, t = Date.parse(p.departure || p.arrival);
      if (!t || t < now - 30000 || p.pickupType === 'NOT_ALLOWED') continue; // terminus : pas de montée
      if (seen.has(s.tripId)) continue; // même train vu sur deux quais du pôle
      seen.add(s.tripId);
      const l = lines.get(s.routeId) ?? lines.set(s.routeId, {s, mode: modeOf(s), dirs: new Map()}).get(s.routeId);
      const dir = l.dirs.get(s.headsign) ?? l.dirs.set(s.headsign, []).get(s.headsign);
      dir.push({t, rt: s.realTime, cancelled: s.cancelled || s.tripCancelled || p.cancelled, track: p.track || p.scheduledTrack});
    }
    lines.forEach(l => l.dirs.forEach(deps => deps.sort((a, b) => a.t - b.t)));
    current.lines = [...lines.values()].sort((a, b) => a.mode.order - b.mode.order ||
      (a.s.routeShortName ?? '').localeCompare(b.s.routeShortName ?? '', 'fr', {numeric: true}));
    current.error = null;
    lastUpdate = Date.now();
  } catch (e) {
    current.error = e.message;
  }
  render();
  current.fresh = false;
  timer = setTimeout(() => load(id), REFRESH_MS);
}

function modeOf(s) {
  const name = s.routeShortName ?? '';
  if (s.mode === 'SUBWAY') return {key: 'metro', label: 'Métro', order: 0};
  if (/RAIL|SUBURBAN/.test(s.mode)) return /^[A-E]$/.test(name) ? {key: 'rer', label: 'RER', order: 1} : {key: 'train', label: 'Train', order: 2};
  if (s.mode === 'TRAM') return {key: 'tram', label: 'Tram', order: 3};
  if (/^N\d/.test(name)) return {key: 'bus', label: 'Noctilien', order: 6};
  if (/BUS|COACH/.test(s.mode)) return {key: 'bus', label: 'Bus', order: 5};
  return {key: 'rer', label: MODE_LABEL[s.mode] ?? 'Autres', order: 4};
}

function fmtTime(d, i) {
  const min = Math.round((d.t - Date.now()) / 60000);
  const cls = ['t', i ? 'later' : 'next', d.rt ? '' : 'sched', d.cancelled ? 'cancel' : '', !i && min <= 1 && !d.cancelled ? 'now' : ''].join(' ');
  const rt = !i && d.rt && !d.cancelled ? '<i class="rt" title="Temps réel"></i>' : '';
  const label = min <= 0 ? (i ? '0<small>min</small>' : 'Proche') : min >= 60 ? hhmm(d.t) : `${min}<small>min</small>`;
  return `<span class="${cls}">${label}${rt}</span>`;
}

function card({s, mode, dirs}, i) {
  const pinned = favLines().includes(s.routeId);
  const rows = [...dirs].sort((a, b) => a[1][0].t - b[1][0].t).map(([dest, deps]) => {
    const d0 = deps[0];
    const sub = d0.cancelled ? '<small class="bad">Supprimé</small>' : d0.track ? `<small>Voie ${esc(d0.track)}</small>` : '';
    return `<div class="dir"><span class="dest"><b>${esc(dest)}</b>${sub}</span><span class="times">${deps.slice(0, 3).map(fmtTime).join('')}</span></div>`;
  }).join('');
  return `<article class="card ${pinned ? 'pinned' : ''}" style="${current.fresh ? `animation-delay:${Math.min(i, 10) * 25}ms` : 'animation:none'}">
    <div class="card-head">
      <span class="badge ${mode.key}" style="background:#${esc(s.routeColor || '888888')};color:#${esc(s.routeTextColor || 'ffffff')}">${esc(s.routeShortName || '?')}</span>
      <span class="mode-lbl">${ico(MODE_ICON[mode.label] ?? 'other', 14)}${mode.label}</span>
      <button class="lstar ${pinned ? 'on' : ''}" data-line="${esc(s.routeId)}" aria-pressed="${pinned}" title="${pinned ? 'Retirer de mes lignes' : 'Épingler cette ligne en haut'}">${ico('star', 17)}</button>
    </div>${rows}</article>`;
}

function renderStation() {
  const c = current;
  document.title = (c.name || 'Arrêt') + ' · Prochains passages';
  const fav = favs().some(f => f.id === c.id);
  let body;
  if (c.error && !c.lines) body = `<div class="msg">Service temps réel injoignable (${esc(c.error)}).<br>Nouvel essai dans 30 s…</div>`;
  else if (!c.lines) body = '<div class="skel"></div>'.repeat(4);
  else if (!c.lines.length) body = '<div class="msg">Aucun passage prévu pour le moment.</div>';
  else {
    const counts = new Map(), pins = favLines();
    c.lines.forEach(l => counts.set(l.mode.label, (counts.get(l.mode.label) ?? 0) + 1));
    if (!counts.has(c.filter)) c.filter = 'Tout';
    const shown = c.lines.filter(l => c.filter === 'Tout' || l.mode.label === c.filter)
      .sort((a, b) => pins.includes(b.s.routeId) - pins.includes(a.s.routeId)); // lignes épinglées d'abord (tri stable)
    body = (counts.size > 1 ? `<nav class="tabs">${[['Tout', c.lines.length], ...counts].map(([m, n]) =>
      `<button class="tab ${m === c.filter ? 'on' : ''}" data-filter="${m}">${ico(MODE_ICON[m] ?? 'other', 15)}${m}<span>${n}</span></button>`).join('')}</nav>` : '')
      + `<div class="cards">${shown.map(card).join('')}</div>`;
  }
  $('#view').innerHTML = `
    <div class="st">
      <div>
        <h2>${esc(c.name || '…')}</h2>
        <div class="st-meta">${lastUpdate && c.lines ? `<span class="live"><span class="dot"></span>Mis à jour <span id="ago">${agoText()}</span></span>` : 'Chargement…'}</div>
      </div>
      <button class="star ${fav ? 'on' : ''}" id="star" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${fav}">${ico('star', 20)}</button>
    </div>${body}`;
  $('#star').onclick = toggleFav;
}

// ---- porte-clés : prochain départ de l'arrêt (clic = départ suivant, autre ligne)
let kcIdx = 0;
function renderKeychain() {
  const next = (current?.lines ?? [])
    .filter(l => current.filter === 'Tout' || l.mode.label === current.filter)
    .flatMap(l => [...l.dirs].map(([dest, deps]) => ({l, dest, d: deps.find(x => !x.cancelled && x.t > Date.now() - 30000)})))
    .filter(x => x.d).sort((a, b) => a.d.t - b.d.t);
  const x = next[kcIdx % next.length];
  const set = (id, v) => { $(id).textContent = v; };
  if (!x) {
    set('#kcLine', '--'); set('#kcPos', ''); set('#kcDest', current ? 'Aucun passage' : 'Choisis un arrêt');
    $('#kcLine').style.cssText = '';
    $('#kcMin').className = 'kc-big'; $('#kcMin').textContent = '--';
    return;
  }
  const min = Math.round((x.d.t - Date.now()) / 60000);
  set('#kcLine', x.l.s.routeShortName || '?');
  $('#kcLine').style.cssText = `background:#${x.l.s.routeColor || '888888'};color:#${x.l.s.routeTextColor || 'ffffff'}`;
  set('#kcPos', `${kcIdx % next.length + 1}/${next.length}`);
  set('#kcDest', x.dest);
  $('#kcMin').className = 'kc-big' + (min <= 0 ? ' word' : '');
  $('#kcMin').innerHTML = min <= 0 ? 'Proche' : min >= 60 ? hhmm(x.d.t) : `${min}<small>min</small>`;
}
$('#kc').onclick = () => { kcIdx++; renderKeychain(); };

// ---- liste de pièces du porte-clés
const euro = n => n.toLocaleString('fr-FR', {style: 'currency', currency: 'EUR'});
const total = BOM.reduce((s, b) => s + b[2], 0);
$('#bomTotal').textContent = '≈ ' + euro(total);
$('#bomSum').textContent = $('#bomSum2').textContent = '≈ ' + euro(total);
$('#bomList').innerHTML = $('#bomSide').innerHTML = BOM.map(([n, d, p, url], i) => `<li>
  <span class="n">${i + 1}</span>
  <span><b>${esc(n)}</b><small>${esc(d)}</small></span>
  <span class="pr">${euro(p)}<a href="${esc(url)}" target="_blank" rel="noopener">Acheter ↗</a></span></li>`).join('');
document.addEventListener('click', e => { if (e.target.closest('[data-bom]')) $('#bomDlg').showModal(); });
$('#bomDlg').addEventListener('click', e => { if (e.target === $('#bomDlg')) $('#bomDlg').close(); }); // clic hors de la fenêtre

const render = () => { current ? renderStation() : renderHome(); renderFavbar(); renderKeychain(); };
$('#view').addEventListener('click', e => {
  const f = e.target.closest('[data-filter]');
  if (f) { current.filter = f.dataset.filter; render(); }
  const l = e.target.closest('[data-line]');
  if (l) toggleLine(l.dataset.line);
});

// re-rendu toutes les 15 s pour que les minutes défilent entre deux requêtes
setInterval(() => current?.lines && render(), 15000);
// pause en arrière-plan pour ménager le service
document.addEventListener('visibilitychange', () => {
  if (document.hidden) clearTimeout(timer); else if (current) load(current.id);
});
const route = () => {
  clearTimeout(timer);
  const id = decodeURIComponent(location.hash.slice(1));
  scrollTo(0, 0);
  if (id) { lastUpdate = 0; load(id); } else { current = null; render(); }
};
addEventListener('hashchange', route);
route();
