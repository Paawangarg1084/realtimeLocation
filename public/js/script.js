const socket = io();

// 🌗 THEME STATE
let isDarkMode = localStorage.getItem("theme") === "dark";

// ✅ MOBILE SAFE MAP
const map = L.map("map", {
  zoomControl: false,
  touchZoom: true,
  dragging: true,
  doubleClickZoom: true,
  scrollWheelZoom: true,
  tap: true
}).setView([28.9845, 77.7064], 13);

// ✅ Zoom bottom-right
L.control.zoom({ position: "bottomright" }).addTo(map);

// 🌗 TILE LAYER VARIABLE
let tileLayer;

// 🌗 FUNCTION TO UPDATE MAP THEME
function updateMapTheme(isDark) {
  if (tileLayer) {
    map.removeLayer(tileLayer);
  }

  const url = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  tileLayer = L.tileLayer(url, {
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

// 🌗 INITIAL LOAD
updateMapTheme(isDarkMode);

let markers = {};
let lastPositions = {};
let myMarker = null;
let accuracyCircle = null;
let myLocation = null;
let roomId = null;
let routingControl = null;
let username = "";
let autoFollow = true;
let followUserId = null;

// 🟢 PANEL TOGGLE
function togglePanel() {
  document.getElementById("sidePanel").classList.toggle("open");
}

// 🌗 TOGGLE EVENT LISTENER
const toggle = document.getElementById("themeToggle");

if (toggle) {
  toggle.checked = isDarkMode;

  toggle.addEventListener("change", () => {
    isDarkMode = toggle.checked;

    document.body.classList.toggle("dark", isDarkMode);
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");

    updateMapTheme(isDarkMode);
  });
}

// 🟢 Smooth animation
function animateMarker(marker, from, to) {
  if (!from) {
    marker.setLatLng([to.lat, to.lng]);
    return;
  }

  const frames = 15;
  let i = 0;

  const dLat = (to.lat - from.lat) / frames;
  const dLng = (to.lng - from.lng) / frames;

  function move() {
    if (i < frames) {
      marker.setLatLng([
        from.lat + dLat * i,
        from.lng + dLng * i
      ]);
      i++;
      requestAnimationFrame(move);
    }
  }

  move();
}

// 🟢 Stop auto-follow on manual move
map.on("movestart", () => {
  autoFollow = false;
});

// 🚀 JOIN ROOM
function joinRoom() {
  const roomInput = document.getElementById("roomInput").value;
  const nameInput = document.getElementById("nameInput").value;

  if (!roomInput || !nameInput) {
    alert("Enter room code and name");
    return;
  }

  roomId = roomInput;
  username = nameInput;

  socket.emit("join-room", { roomId, username });

  alert("Joined room: " + roomId);
}

// 🎯 FOLLOW SELF
function enableFollow() {
  followUserId = null;
  autoFollow = true;
}

// 🎯 FOLLOW USER
function followUser(id) {
  followUserId = id;
  autoFollow = true;
}

// 📡 RECEIVE LOCATION
socket.on("receive-location", ({ lat, lng, id, username: user }) => {

  if (id === socket.id) return;

  const newPos = { lat, lng };

  if (markers[id]) {
    animateMarker(markers[id], lastPositions[id], newPos);
  } else {
    markers[id] = L.marker([lat, lng])
      .addTo(map)
      .bindTooltip(user, {
        permanent: true,
        direction: "top"
      });

    const dropdown = document.getElementById("userList");
    const option = document.createElement("option");
    option.value = id;
    option.text = user;
    dropdown.appendChild(option);
  }

  lastPositions[id] = newPos;

  // FOLLOW USER
  if (autoFollow && followUserId === id) {
    map.panTo([lat, lng]);
  }

  // ROUTE
  if (myLocation && followUserId === id) {
    if (routingControl) {
      map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(myLocation.lat, myLocation.lng),
        L.latLng(lat, lng)
      ],
      addWaypoints: false,
      draggableWaypoints: false
    }).addTo(map);
  }
});

// ❌ REMOVE USER
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});

// 📍 OWN LOCATION
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;

      const newPos = { lat: latitude, lng: longitude };

      if (myMarker) {
        animateMarker(myMarker, myLocation, newPos);
      } else {
        myMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindTooltip("You (" + username + ")", {
            permanent: true
          });
      }

      myLocation = newPos;

      if (accuracyCircle) {
        accuracyCircle.setLatLng([latitude, longitude]);
        accuracyCircle.setRadius(accuracy);
      } else {
        accuracyCircle = L.circle([latitude, longitude], {
          radius: accuracy,
          color: "blue",
          fillOpacity: 0.1
        }).addTo(map);
      }

      // FOLLOW SELF
      if (autoFollow && !followUserId) {
        map.panTo([latitude, longitude]);
      }

      if (roomId) {
        socket.emit("send-location", newPos);
      }
    },
    (err) => console.log(err),
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}