import { tr } from './locale';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const showUpdate = (registration: ServiceWorkerRegistration) => {
    if (document.getElementById('pwa-update')) return;
    const notice = document.createElement('aside');
    notice.id = 'pwa-update';
    notice.setAttribute('role', 'status');
    const message = document.createElement('span');
    message.textContent = tr('Update available');
    const reload = document.createElement('button');
    reload.type = 'button';
    reload.textContent = tr('Reload');
    reload.addEventListener('click', () => {
      if (!registration.waiting) return location.reload();
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      registration.waiting.postMessage('skip-waiting');
    });
    const help = document.createElement('small');
    help.textContent = tr('If the update is still waiting, close all nouploads tabs and reopen. Your current tools remain available offline.');
    notice.append(message, reload, help);
    document.body.append(notice);
  };
  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(registration => {
    if (registration.waiting) showUpdate(registration);
    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) showUpdate(registration);
      });
    });
  }).catch(() => {
    document.querySelectorAll('[data-offline-status]').forEach(element => {
      element.textContent = tr('Offline setup unavailable. Reconnect and reload to try again.');
    });
  });
}
