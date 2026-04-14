const socket = io();

/* =====================
   🌍 MAP SETUP
===================== */

const map = L.map("map", {
  zoomControl: false
}).setView([28.9845, 77.7064], 13);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

/* =====================
   🧠 STATE
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
   🟢 PANEL
===================== */

function togglePanel() {
  document.getElementById("sidePanel").classList.toggle("open");
}

/* =====================
   🚀 JOIN ROOM
===================== */

function joinRoom() {
  const room = document.getElementById("roomInput").value;
  const name = document.getElementById("nameInput").value;

  if (!room || !name) {
    alert("Enter room code and name");
    return;
  }

  roomId = room;
  username = name;

  socket.emit("join-room", { roomId, username });

  if (myMarker) {
    myMarker.setTooltipContent("You (" + username + ")");
  }

  alert("Joined room: " + roomId);
}

/* =====================
   🎯 FOLLOW
===================== */

function followUser(id) {
  followUserId = id;
  autoFollow = true;
}

function enableFollow() {
  followUserId = null;
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

  const steps = 10;
  let i = 0;

  const dLat = (to.lat - from.lat) / steps;
  const dLng = (to.lng - from.lng) / steps;

  function move() {
    if (i <= steps) {
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
   🧭 STOP AUTO FOLLOW
===================== */

map.on("movestart", () => {
  autoFollow = false;
});

/* =====================
   📡 RECEIVE USERS
===================== */

socket.on("receive-location", ({ lat, lng, id, username: user }) => {
  if (!lat || !lng) return;

  const newPos = { lat, lng };

  if (!markers[id]) {
    markers[id] = L.marker([lat, lng])
      .addTo(map)
      .bindTooltip(user || "User", {
        permanent: true,
        direction: "top"
      });

    // dropdown update
    const userList = document.getElementById("userList");
    if (userList) {
      const option = document.createElement("option");
      option.value = id;
      option.text = user || "User";
      userList.appendChild(option);
    }
  } else {
    animateMarker(markers[id], lastPositions[id], newPos);
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
    delete lastPositions[id];
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

      if (!myMarker) {
        myMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindTooltip("You (" + (username || "...") + ")", {
            permanent: true,
            direction: "top"
          });
      } else {
        animateMarker(myMarker, myLocation, newPos);

        if (username) {
          myMarker.setTooltipContent("You (" + username + ")");
        }
      }

      myLocation = newPos;

      if (autoFollow && !followUserId) {
        map.panTo([latitude, longitude]);
      }

      if (roomId) {
        socket.emit("send-location", newPos);
      }
    },
    (err) => console.log("Geo error:", err),
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}