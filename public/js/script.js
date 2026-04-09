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
let username = "";

// 🖐️ Detect user dragging map
map.on("movestart", () => isUserInteracting = true);
map.on("moveend", () => isUserInteracting = false);

// ✅ JOIN ROOM
function joinRoom() {
  const roomInput = document.getElementById("roomInput").value;
  const nameInput = document.getElementById("nameInput").value;

  if (!roomInput || !nameInput) {
    alert("Enter room code and name");
    return;
  }

  roomId = roomInput;
  username = nameInput;

  socket.emit("join-room", {
    roomId: roomId,
    username: username
  });

  alert("Joined room: " + roomId);
}

// ✅ RECEIVE LOCATION
socket.on("receive-location", (data) => {
  const { lat, lng, id, username: user } = data;

  if (id === socket.id) return;
  if (isUserInteracting) return;

  if (markers[id]) {
    markers[id].setLatLng([lat, lng]);
  } else {
    markers[id] = L.marker([lat, lng])
      .addTo(map)
      .bindPopup(user); // 🔥 SHOW NAME
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

// ✅ REMOVE USER
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }

  if (routingControl) {
    map.removeControl(routingControl);
  }
});

// ✅ SEND OWN LOCATION
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude } = position.coords;

      myLocation = { lat: latitude, lng: longitude };

      if (myMarker) {
        myMarker.setLatLng([latitude, longitude]);
      } else {
        myMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindPopup("You (" + username + ")"); // 🔥 YOUR NAME
      }

      if (!isUserInteracting && !roomId) {
        map.setView([latitude, longitude], 15);
      }

      if (roomId) {
        socket.emit("send-location", {
          lat: latitude,
          lng: longitude
        });
      }
    },
    (err) => console.log(err),
    {
      enableHighAccuracy: true,
      timeout:10000,
      maximumAge:0
    }
  );
}