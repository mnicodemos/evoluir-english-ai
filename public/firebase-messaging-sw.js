importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

// Tapping a notification opens the page it points to (data.path).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const path = (data.FCM_MSG && data.FCM_MSG.data && data.FCM_MSG.data.path) || data.path || "/dashboard";
  const url = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("navigate" in client) return client.navigate(url).then((c) => c && c.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
