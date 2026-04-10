const socket = io();

/* =====================
   🌗 THEME + MAP SETUP
===================== */

let isDarkMode = localStorage.getItem("theme") === "dark";

const map = L.map("map", {
  zoomControl: false,
  touchZoom: true,
  dragging: true,
  doubleClickZoom: true,
  scrollWheelZoom: true
}).setView([28.9845, 77.7064], 13);

L.control.zoom({ position: "bottomright" }).addTo(map);

/* =====================
   🌍 TILE LAYER
===================== */

let tileLayer;

function updateMapTheme(isDark) {
  if (tileLayer) map.removeLayer(tileLayer);

  tileLayer = L.tileLayer(
    isDark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    { attribution: "© OpenStreetMap" }
  ).addTo(map);
}

updateMapTheme(isDarkMode);

/* =====================
   🧠 VARIABLES
===================== */

let markers = {};
let lastPositions = {};
let myMarker = null;
let myLocation = null;
let roomId = null;
let username = "";
let followUserId = null;
let autoFollow = true;

/* =====================
   🟢 PANEL TOGGLE
===================== */

function togglePanel() {
  document.getElementById("sidePanel").classList.toggle("open");
}

/* =====================
   🌗 THEME TOGGLE UI
===================== */

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

/* =====================
   🚀 JOIN ROOM
===================== */

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

/* =====================
   🎯 FOLLOW USERS
===================== */

function enableFollow() {
  followUserId = null;
  autoFollow = true;
}

function followUser(id) {
  followUserId = id;
  autoFollow = true;
}

/* =====================
   🎞️ ANIMATION
===================== */

function animateMarker(marker, from, to) {
  if (!from) {
    marker.setLatLng([to.lat, to.lng]);
    return;
  }

  const frames = 12;
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

/* =====================
   🧭 STOP AUTO FOLLOW ON MOVE
===================== */

map.on("movestart", () => {
  autoFollow = false;
});

/* =====================
   📡 RECEIVE LOCATION
===================== */

socket.on("receive-location", ({ lat, lng, id, username: user }) => {
  if (!lat || !lng) return;

  const newPos = { lat, lng };

  if (markers[id]) {
    animateMarker(markers[id], lastPositions[id], newPos);
  } else {
    markers[id] = L.marker([lat, lng])
      .addTo(map)
      .bindTooltip(user || "User", {
        permanent: true,
        direction: "top"
      });

    const dropdown = document.getElementById("userList");
    if (dropdown) {
      const option = document.createElement("option");
      option.value = id;
      option.text = user || "User";
      dropdown.appendChild(option);
    }
  }

  lastPositions[id] = newPos;

  if (autoFollow && followUserId === id) {
    map.panTo([lat, lng]);
  }
});

/* =====================
   ❌ USER DISCONNECT
===================== */

socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }
});

/* =====================
   📍 MY LOCATION
===================== */

if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;

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