(() => {
  const map = document.querySelector('.visitor-map');
  const endpoint = map.dataset.visitorEndpoint;
  if (!endpoint) return;
  const pins = map.querySelector('[data-visitor-pins]');
  const status = map.querySelector('[role="status"]');
  const svg = 'http://www.w3.org/2000/svg';
  const canRecord = navigator.globalPrivacyControl !== true && navigator.doNotTrack !== '1';

  async function load() {
    if (canRecord) {
      try { await fetch(endpoint, {method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer'}); }
      catch { /* The public map can still load if recording fails. */ }
    }
    const response = await fetch(endpoint, {credentials: 'omit', referrerPolicy: 'no-referrer'});
    if (!response.ok) throw new Error('Visitor data unavailable');
    const visits = await response.json();
    const fragment = document.createDocumentFragment();
    for (const {lat, lon} of visits) {
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      const pin = document.createElementNS(svg, 'circle');
      pin.setAttribute('cx', (lon+180)*2);
      pin.setAttribute('cy', (90-lat)*2);
      pin.setAttribute('r', '3.3');
      fragment.append(pin);
    }
    pins.replaceChildren(fragment);
    status.textContent = pins.childElementCount
      ? 'Approximate locations of recent homepage visits. Dots from the same area may overlap.'
      : 'No visitor locations recorded yet.';
  }
  load().catch(() => { status.textContent = 'Visitor locations are temporarily unavailable.'; });
})();
