'use strict';

// Keep the fullscreen request in the button's user-activation event.
function createRadioFullscreen(doc, win, notify) {
  const active = () => !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  const standalone = () => !!(win.navigator.standalone || win.matchMedia?.('(display-mode: standalone)').matches);
  function sync() {
    const button = doc.getElementById('full');
    if (!button) return;
    const label = active() ? 'Lämna helskärm' : standalone() ? 'Helskärm är redan aktiv' : 'Öppna helskärm';
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(active() || standalone()));
    button.textContent = active() ? '⤢' : '⛶';
  }
  async function exit() {
    if (!active()) return;
    const leave = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (leave) await leave.call(doc);
    sync();
  }
  async function enter(interactive = false) {
    if (active()) return;
    if (standalone()) {
      if (interactive) notify('Spelet är redan öppet i helskärmsläge.');
      sync();
      return;
    }
    const root = doc.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!request) {
      if (interactive) notify('Den här webbläsaren stöder inte helskärm för spelet. På iPhone: öppna i Safari, välj Dela → Lägg till på hemskärmen och starta spelet från ikonen.');
      return;
    }
    try {
      await request.call(root);
    } catch (e) {
      if (interactive) notify('Webbläsaren kunde inte öppna helskärm. Öppna spelet direkt i webbläsaren och försök igen.');
      sync();
      return;
    }
    sync();
    // Orientation lock is optional; its failure must not mask successful fullscreen.
    try { await win.screen?.orientation?.lock?.('landscape'); } catch (_) {}
  }
  async function toggle() {
    try {
      if (active()) await exit();
      else await enter(true);
    } catch (_) {
      notify('Webbläsaren kunde inte lämna helskärm. Försök med Esc eller webbläsarens tillbaka-knapp.');
    }
  }
  doc.addEventListener('fullscreenchange', sync);
  doc.addEventListener('webkitfullscreenchange', sync);
  return { enter, exit, toggle, sync };
}

if (typeof module !== 'undefined') module.exports = createRadioFullscreen;
