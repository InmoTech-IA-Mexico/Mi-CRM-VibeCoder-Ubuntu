/* Service Worker mínimo para Web Push (JUA-33).
   No hace caché/offline (la app ya tiene banner sin conexión): solo recibe el
   push y abre la ficha del cliente al tocar la notificación. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const titulo = data.titulo || "InmoTech IA México";
  const opciones = {
    body: data.cuerpo || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    // La URL de destino viaja en `data` para el notificationclick.
    data: { url: data.url || "/inicio" },
    // `tag` colapsa notificaciones repetidas del mismo cliente/tema.
    tag: data.tag,
    renotify: Boolean(data.tag),
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/inicio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientes) => {
      // Si ya hay una ventana de la app abierta, se enfoca y navega; si no, se abre.
      for (const cliente of clientes) {
        if ("focus" in cliente) {
          cliente.navigate(url);
          return cliente.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
