const socket = io();

const map = L.map("map").setView([28.9845, 77.7064], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

let markers = {};
let myMarker = null;
let myLocation = null;
let roomId = null;
let routingControl = null;
let isUserInteracting = false;

// 🖐️ Detect user dragging map
map.on("mousedown", () => isUserInteracting = true);
map.on("mouseup", () => isUserInteracting = false);
map.on("touchstart", () => isUserInteracting = true);
map.on("touchend", () => isUserInteracting = false);

// JOIN ROOM
function joinRoom() {
  const input = document.getElementById("roomInput");
  roomId = input.value;

  if (!roomId) {
    alert("Enter room code");
    return;
  }

  socket.emit("join-room", roomId);
  alert("Joined room: " + roomId);
}

// RECEIVE LOCATION
socket.on("receive-location", (data) => {
  const { lat, lng, id } = data;

  // ❗ ignore own duplicate
  if (id === socket.id) return;

  // ❗ stop updates while dragging
  if (isUserInteracting) return;

  if (markers[id]) {
    markers[id].setLatLng([lat, lng]);
  } else {
    markers[id] = L.marker([lat, lng]).addTo(map)
      .bindPopup("Friend");
  }

  // route
  if (myLocation) {
    if (routingControl) {
      map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(myLocation.lat, myLocation.lng),
        L.latLng(lat, lng)
      ],
      routeWhileDragging: false
    }).addTo(map);
  }
});

// REMOVE USER MARKER WHEN TAB CLOSED
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }

  if (routingControl) {
    map.removeControl(routingControl);
  }
});

// SEND OWN LOCATION
if (navigator.geolocation) {
  navigator.geolocation.watchPosition((position) => {
    const { latitude, longitude } = position.coords;

    myLocation = { lat: latitude, lng: longitude };

    // show own marker always
    if (myMarker) {
      myMarker.setLatLng([latitude, longitude]);
    } else {
      myMarker = L.marker([latitude, longitude]).addTo(map)
        .bindPopup("You are here")
        .openPopup();
    }

    if (!isUserInteracting) {
      map.setView([latitude, longitude], 15);
    }

    // send only if in room
    if (roomId) {
      socket.emit("send-location", {
        lat: latitude,
        lng: longitude
      });
    }
  },
  (err) => console.log(err),
  {
    enableHighAccuracy: true
  });
}