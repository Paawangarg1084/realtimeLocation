const socket = io();

const map = L.map("map").setView([28.9845, 77.7064], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

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

// 🟢 Smooth animation
function animateMarker(marker, from, to) {
  const frames = 20;
  let i = 0;

  const deltaLat = (to.lat - from.lat) / frames;
  const deltaLng = (to.lng - from.lng) / frames;

  function move() {
    if (i < frames) {
      const lat = from.lat + deltaLat * i;
      const lng = from.lng + deltaLng * i;
      marker.setLatLng([lat, lng]);
      i++;
      requestAnimationFrame(move);
    }
  }

  move();
}

// 🖐️ stop auto follow when user moves map
map.on("movestart", () => {
  autoFollow = false;
});

// JOIN ROOM
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
    roomId,
    username
  });

  alert("Joined room: " + roomId);
}

// FOLLOW BUTTON
function enableFollow() {
  autoFollow = true;
}

// FOLLOW SPECIFIC USER
function followUser(id) {
  followUserId = id;
}

// RECEIVE LOCATION
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

    // 🔥 Add to dropdown
    const dropdown = document.getElementById("userList");
    if (dropdown) {
      const option = document.createElement("option");
      option.value = id;
      option.text = user;
      dropdown.appendChild(option);
    }
  }

  lastPositions[id] = newPos;

  // FOLLOW SPECIFIC USER
  if (followUserId === id && autoFollow) {
    map.panTo([lat, lng]);
  }

  // ROUTE
  if (myLocation) {
    if (routingControl) {
      map.removeControl(routingControl);
    }

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(myLocation.lat, myLocation.lng),
        L.latLng(lat, lng)
      ],
      routeWhileDragging: false,
      addWaypoints: false,
      draggableWaypoints: false
    }).addTo(map);
  }
});

// REMOVE USER
socket.on("user-disconnected", (id) => {
  if (markers[id]) {
    map.removeLayer(markers[id]);
    delete markers[id];
  }

  delete lastPositions[id];
});

// SEND OWN LOCATION
if (navigator.geolocation) {
  navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, accuracy } = position.coords;

      myLocation = { lat: latitude, lng: longitude };

      // 🟢 Smooth self marker
      if (myMarker) {
        animateMarker(myMarker, myLocation, { lat: latitude, lng: longitude });
      } else {
        myMarker = L.marker([latitude, longitude])
          .addTo(map)
          .bindTooltip("You (" + username + ")", {
            permanent: true,
            direction: "top"
          });
      }

      // 🔵 Accuracy circle
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

      // AUTO FOLLOW
      if (autoFollow && !followUserId) {
        map.panTo([latitude, longitude]);
      }

      // SEND LOCATION
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
      timeout: 10000,
      maximumAge: 0
    }
  );
}