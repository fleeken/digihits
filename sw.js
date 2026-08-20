self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = new URL("./#home", self.location).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => window.url.startsWith(self.location.origin));
    return existing ? existing.focus().then(() => existing.navigate(destination)) : clients.openWindow(destination);
  }));
});
