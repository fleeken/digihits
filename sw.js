self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || "Digihits", { body: data.body || "Det är din tur.", icon: "icon-ios-261.png", badge: "icon-ios-261.png", tag: "digihits-turn", renotify: true, data: { url: data.url || "./?matches=1#home" } }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL(event.notification.data?.url || "./?matches=1#home", self.location).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => window.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(destination)) : clients.openWindow(destination);
  }));
});
