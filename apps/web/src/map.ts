// Public hazard map (Q8, R2.4): Google Map + an accessible list of confirmed community hazards for the current view.
// Works on any desktop or phone browser, no login. Shows only what GET /api/hazards serves (confirmed, no walk data).
// If Maps can't load (no key, blocked, offline), the list still works for the default or URL position.
import type { PublicHazard } from '@footprint/shared';
import { boxParam, hazardLabel, hazardSentence, initialView, queryBox, sortByDistance, TYPE_COLOR, type Box } from './mapView';

/** Default view: Singapore Chinatown (the finale city). Override with ?lat=&lng=&z=. */
const DEFAULT_VIEW = { lat: 1.2834, lng: 103.8443, zoom: 16 };

const statusEl = document.querySelector<HTMLParagraphElement>('#map-status')!;
const listEl = document.querySelector<HTMLOListElement>('#hazard-list')!;
const countEl = document.querySelector<HTMLSpanElement>('#hazard-count')!;
const mapEl = document.querySelector<HTMLDivElement>('#map')!;
const locateBtn = document.querySelector<HTMLButtonElement>('#locate')!;

interface MapsApi {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  marker: { AdvancedMarkerElement: new (opts: Record<string, unknown>) => { map: GMap | null }; PinElement: new (opts: Record<string, unknown>) => { element: HTMLElement } };
}
interface GMap {
  getBounds(): { getSouthWest(): LatLngFn; getNorthEast(): LatLngFn } | undefined;
  getCenter(): LatLngFn | undefined;
  setCenter(c: { lat: number; lng: number }): void;
  setZoom(z: number): void;
  addListener(ev: string, fn: () => void): void;
}
interface LatLngFn {
  lat(): number;
  lng(): number;
}

let view = initialView(location.search, DEFAULT_VIEW);
let map: GMap | null = null;
let api: MapsApi | null = null;
let markers: { map: GMap | null }[] = [];
let lastQuery = '';

function setStatus(text: string): void {
  statusEl.textContent = text;
}

async function loadHazards(viewBox: Box, centre: { lat: number; lng: number }): Promise<void> {
  const { box, clipped } = queryBox(viewBox);
  const param = boxParam(box);
  if (param === lastQuery) return;
  lastQuery = param;
  setStatus('Loading reported hazards…');
  try {
    const res = await fetch(`/api/hazards?bbox=${param}`);
    if (!res.ok) throw new Error(String(res.status));
    const { hazards = [] } = (await res.json()) as { hazards?: PublicHazard[] };
    render(sortByDistance(hazards, centre), centre);
    const n = hazards.length;
    setStatus(
      (n === 0 ? 'No confirmed hazards reported in this area yet.' : `${n} confirmed hazard${n === 1 ? '' : 's'} in this area.`) +
        (clipped ? ' Showing the area around the centre only — zoom in to see the whole view.' : ''),
    );
  } catch {
    lastQuery = '';
    setStatus('Could not load reported hazards. Check your connection and try again.');
  }
}

function render(hazards: PublicHazard[], centre: { lat: number; lng: number }): void {
  const now = Date.now();
  countEl.textContent = String(hazards.length);
  listEl.replaceChildren(
    ...hazards.map((h) => {
      const li = document.createElement('li');
      const text = document.createElement('span');
      text.textContent = `${hazardSentence(h, now, centre)}. `;
      const link = document.createElement('a');
      link.href = `https://www.google.com/maps/search/?api=1&query=${h.lat},${h.lng}`;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Open in Google Maps';
      li.append(text, link);
      return li;
    }),
  );
  for (const m of markers) m.map = null;
  markers = [];
  if (!map || !api) return;
  for (const h of hazards) {
    const pin = new api.marker.PinElement({ background: TYPE_COLOR[h.type], borderColor: '#ffffff', glyphColor: '#ffffff' });
    markers.push(
      new api.marker.AdvancedMarkerElement({ map, position: { lat: h.lat, lng: h.lng }, title: `${hazardLabel(h.type)} — ${h.reports} walkers`, content: pin.element }),
    );
  }
}

function boxAround(c: { lat: number; lng: number }, half = 0.004): Box {
  return { minLat: c.lat - half, minLng: c.lng - half, maxLat: c.lat + half, maxLng: c.lng + half };
}

function onIdle(): void {
  const b = map?.getBounds();
  const c = map?.getCenter();
  if (!b || !c) return;
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  view = { ...view, lat: c.lat(), lng: c.lng() };
  void loadHazards({ minLat: sw.lat(), minLng: sw.lng(), maxLat: ne.lat(), maxLng: ne.lng() }, { lat: c.lat(), lng: c.lng() });
}

/** Load Maps JS with the referrer-locked browser key from /api/map-config. */
async function loadMaps(): Promise<MapsApi | null> {
  try {
    const res = await fetch('/api/map-config');
    const { mapsKey } = (await res.json()) as { mapsKey: string | null };
    if (!mapsKey) return null;
    await new Promise<void>((resolve, reject) => {
      (window as unknown as Record<string, unknown>).__footprintMapsReady = () => resolve();
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&v=weekly&loading=async&libraries=marker&callback=__footprintMapsReady`;
      s.async = true;
      s.onerror = () => reject(new Error('maps script'));
      document.head.append(s);
      setTimeout(() => reject(new Error('maps timeout')), 15_000);
    });
    return (window as unknown as { google: { maps: MapsApi } }).google.maps;
  } catch {
    return null;
  }
}

locateBtn.addEventListener('click', () => {
  if (!navigator.geolocation) return setStatus('This browser cannot share its location.');
  setStatus('Finding your area…');
  navigator.geolocation.getCurrentPosition(
    (p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude };
      if (map) {
        map.setCenter(c);
        map.setZoom(17);
      } else {
        void loadHazards(boxAround(c), c);
      }
    },
    () => setStatus('Location was not shared. Move the map or add ?lat=…&lng=… to the address.'),
    { enableHighAccuracy: false, timeout: 10_000 },
  );
});

void (async () => {
  api = await loadMaps();
  if (!api) {
    mapEl.textContent = 'The map could not be loaded. The list below still shows reported hazards for this area.';
    mapEl.classList.add('map-unavailable');
    void loadHazards(boxAround(view), view);
    return;
  }
  map = new api.Map(mapEl, {
    center: { lat: view.lat, lng: view.lng },
    zoom: view.zoom,
    mapId: 'DEMO_MAP_ID',
    clickableIcons: false,
    streetViewControl: false,
    mapTypeControl: false,
  });
  map.addListener('idle', onIdle);
})();
