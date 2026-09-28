/* Compteur terrain : aucune réservation, aucun paiement et aucune prolongation automatique. */
(function () {
  'use strict';
  function stampMs(stamp) {
    const m = String(stamp || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return null;
    const value = new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]).getTime();
    return Number.isFinite(value) ? value : null;
  }
  function capMinutes(cap) {
    const perPassage = String(cap || '').replace(/^\s*\d+\s*[x×]\s*/i, '').trim();
    const h = perPassage.match(/^(\d+)\s*h(?:\s*(\d+))?$/i);
    if (h) return +h[1] * 60 + +(h[2] || 0);
    const m = perPassage.match(/^(\d+)\s*min(?:utes)?$/i);
    return m ? +m[1] : null;
  }
  function clockState(state, now) {
    if (!state.arrivalAt || state.departureAt || state.stage === 'ARCHIVE') return null;
    const start = Number.isFinite(state.arrivalEpochMs) ? state.arrivalEpochMs : stampMs(state.arrivalAt);
    if (start === null) return { invalid: true };
    const elapsed = Math.max(0, now - start);
    const base = capMinutes(state.result?.cap);
    const ov = state.overrun;
    const extension = ov?.accepted && Number.isInteger(ov.tranches) && ov.tranches > 0 &&
      (!ov.passage || ov.passage === state.passage) ? ov.tranches * 30 : 0;
    const limit = base === null ? null : start + (base + extension) * 60000;
    const remaining = limit === null ? null : limit - now;
    return { start, elapsed, base, extension, limit, remaining,
      level: remaining === null ? 'none' : remaining <= 0 ? 'over' : remaining <= 600000 ? 'soon' : 'normal' };
  }
  function duration(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
      .map(n => String(n).padStart(2, '0')).join(':');
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { stampMs, capMinutes, clockState, duration };
    return;
  }
  const host = document.createElement('section');
  host.id = 'terrainClock';
  host.className = 'notice hidden';
  host.setAttribute('aria-label', 'Compteur de mission');
  host.style.cssText = 'position:sticky;top:0;z-index:12;box-shadow:0 3px 12px #0002;font-variant-numeric:tabular-nums';
  host.innerHTML = '<b>COMPTEUR TERRAIN</b><div id="clockNumbers"></div><div id="clockLimit" class="muted"></div><div id="clockWarning" role="alert" aria-live="assertive" aria-atomic="true"></div><button type="button" id="clockSound" class="btn ghost" style="min-height:40px;margin-top:6px;font-size:14px">ACTIVER LE SON</button><div class="muted" style="font-size:12px">Alertes dans la PWA ouverte. Écran verrouillé : aucune alerte garantie.</div>';
  document.getElementById('app').before(host);
  const numbers = host.querySelector('#clockNumbers');
  const limitText = host.querySelector('#clockLimit');
  const warning = host.querySelector('#clockWarning');
  const soundButton = host.querySelector('#clockSound');
  let audio = null, soundEnabled = false;
  const sounded = new Set();
  function setText(el, value) { if (el.textContent !== value) el.textContent = value; }
  function beep() {
    if (!soundEnabled || !audio || audio.state !== 'running') return;
    try {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.connect(gain); gain.connect(audio.destination);
      osc.frequency.value = 880; gain.gain.setValueAtTime(0.12, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.65);
      osc.start(); osc.stop(audio.currentTime + 0.7);
    } catch (_) { /* Le repère visuel reste disponible. */ }
  }
  soundButton.addEventListener('click', async () => {
    if (soundEnabled && audio?.state === 'running') { soundEnabled = false; setText(soundButton, 'ACTIVER LE SON'); return; }
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('unavailable');
      if (!audio) audio = new Audio();
      await audio.resume();
      soundEnabled = audio.state === 'running';
      setText(soundButton, soundEnabled ? 'SON ACTIVÉ — COUPER' : 'RÉACTIVER LE SON');
      beep();
    } catch (_) { setText(soundButton, 'SON INDISPONIBLE — ALERTE VISUELLE ACTIVE'); }
  });
  function tick() {
    const clock = clockState(S, Date.now());
    host.classList.toggle('hidden', !clock);
    if (!clock) return;
    if (clock.invalid) {
      host.className = 'warn';
      setText(numbers, 'Heure de départ du compteur illisible.');
      setText(limitText, 'Contrôlez l’heure d’arrivée enregistrée.');
      setText(warning, 'Le compteur ne peut pas déterminer le temps restant.');
      return;
    }
    host.className = clock.level === 'over' ? 'stop' : clock.level === 'soon' ? 'warn' : 'notice';
    const tail = clock.remaining === null ? '' : clock.remaining > 0
      ? ' · Restant : ' + duration(clock.remaining)
      : ' · Dépassement : +' + duration(-clock.remaining);
    setText(numbers, 'Écoulé : ' + duration(clock.elapsed) + tail);
    setText(limitText, clock.limit === null ? 'Mission sans plafond horaire : respecter le cadre convenu.'
      : 'Limite : ' + new Date(clock.limit).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) +
        ' · ' + clock.base + ' min prévues' + (clock.extension ? ' + ' + clock.extension + ' min autorisées' : ''));
    const message = clock.level === 'over'
      ? 'LIMITE ATTEINTE — arrêtez ou obtenez un nouvel accord dans la limite de la mission. Aucune prolongation automatique.'
      : clock.level === 'soon' ? '10 MINUTES OU MOINS — préparez la fin de mission ou demandez l’accord de prolongation.' : '';
    setText(warning, message);
    if (soundEnabled && audio?.state !== 'running') setText(soundButton, 'RÉACTIVER LE SON');
    if (message && !document.hidden && soundEnabled && audio?.state === 'running') {
      const key = [S.missionId, S.passage, clock.start, clock.limit, clock.level].join('|');
      if (!sounded.has(key)) { beep(); sounded.add(key); }
    }
  }
  new MutationObserver(tick).observe(document.getElementById('app'), { childList: true });
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('pageshow', tick);
  setInterval(tick, 1000);
  tick();
}());
