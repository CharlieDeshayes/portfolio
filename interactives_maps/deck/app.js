const {
    MapboxOverlay,
    TripsLayer
} = deck;


// --------------------------------------------------
// VARIABLES
// --------------------------------------------------

let trips = [];
let currentTime = 18900; // = 5H15
let animationId = null;
let playing = false;

const LOOP_START = 18840;
const LOOP_END = 86400;

const SPEED = 60;


// --------------------------------------------------
// CARTE
// --------------------------------------------------

const map = new maplibregl.Map({
    container: "map",

    style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",

    center: [1.444, 43.604],
    zoom: 11
});


// --------------------------------------------------
// OVERLAY DECK.GL
// --------------------------------------------------

const deckOverlay = new deck.MapboxOverlay({
    interleaved: false,
    layers: []
});

map.addControl(deckOverlay);


// --------------------------------------------------
// CHARGEMENT DES DONNÉES
// --------------------------------------------------

async function loadTrips() {

    console.log("Chargement des données Tisséo...");

    const response = await fetch(
        "../../data/gtfs/tisseo_trips.json"
    );

    if (!response.ok) {
        throw new Error(
            `Erreur HTTP ${response.status}`
        );
    }

    trips = await response.json();

    console.log(
        `${trips.length.toLocaleString()} trajets chargés`
    );

    document.getElementById("info").textContent =
        `${trips.length.toLocaleString()} trajets chargés`;

    populateLineSelector();

    createTripsLayer();
}


// --------------------------------------------------
// COULEUR
// --------------------------------------------------

function hexToRgb(hex) {

    if (!hex) {
        return [90, 177, 227];
    }

    hex = hex.replace("#", "");
    
    if (hex.length !== 6) {
        return [90, 177, 227];
    }

    return [
        parseInt(hex.substring(0, 2), 16),
        parseInt(hex.substring(2, 4), 16),
        parseInt(hex.substring(4, 6), 16)
    ];
}


// --------------------------------------------------
// TRIPS LAYER
// --------------------------------------------------

function createTripsLayer() {

    const layer = new TripsLayer({

        id: "tisseo-trips",
        data: trips,
        getPath: d => d.path,
        getTimestamps: d => d.timestamps,
        getColor: d => hexToRgb(
            d.route_color
        ),
        widthMinPixels: 2,
        opacity: 0.8,
        jointRounded: true,
        trailLength: 150,
        currentTime: currentTime,
        fadeTrail: true
    });


    deckOverlay.setProps({
        layers: [layer]
    });
}



// --------------------------------------------------
// BUILDING LAYER
// --------------------------------------------------


// --------------------------------------------------
// ANIMATION
// --------------------------------------------------

let previousTimestamp = null;


function animate(timestamp) {

    if (!playing) {
        previousTimestamp = null;
        return;
    }


    if (previousTimestamp === null) {
        previousTimestamp = timestamp;
    }

    const delta =
        timestamp - previousTimestamp;

    previousTimestamp = timestamp;


    currentTime +=
        delta / 1000 * SPEED;

    if (currentTime > LOOP_END) {

        currentTime = LOOP_START;
    }


    updateTime();


    animationId =
        requestAnimationFrame(animate);
}


// --------------------------------------------------
// MISE À JOUR DE LA COUCHE
// --------------------------------------------------

function updateLayer(updateInfo = true) {

    const selectedLine =
        document.getElementById("line-select").value;

    const filteredTrips = getFilteredTrips();
    // console.log(filteredTrips)
    deckOverlay.setProps({

        layers: [
            new TripsLayer({
                id: "tisseo-trips",
                data: filteredTrips,
                getPath: d => d.path,
                getTimestamps: d => d.timestamps,
                getColor: d =>
                    hexToRgb(d.route_color),
                widthMinPixels: 2,
                opacity: 0.8,
                jointRounded: true,
                trailLength: 150,
                currentTime: currentTime,
                fadeTrail: true
            })
        ]
    });

    // Mise à jour des informations
    if (updateInfo) {
        updateLineInfo(selectedLine, filteredTrips);
    }
}


// --------------------------------------------------
// FORMAT HEURE
// --------------------------------------------------
let departuresChart = null;
function updateLineInfo(line, filteredTrips) {

    const infoPanel = document.getElementById("kpi");

    // "Toutes les lignes"
    if (line === "all") {
        infoPanel.style.display = "none";
        return;
    }

    // Afficher la fenêtre
    infoPanel.style.display = "block";

    // Nom de la ligne
    document.getElementById("info-line").textContent =
        `Ligne ${line}`;

    // Nom de trajets
    document.getElementById("info-name").textContent =
        filteredTrips[0].route_long_name;

    // Nombre de bus par direction
    const destinations = {};

    // Nombre de départ par heure
    const departuresByHour = {};

    for (let h = 5; h < 24; h++) {
        departuresByHour[h] = 0;
    }

    filteredTrips.forEach(trip => {
        const direction = trip.direction_id;

        if (!destinations[direction]) {
            destinations[direction] = trip.trip_headsign;
        }

        const seconds = Number(trip.start_time);
        if (!Number.isFinite(seconds)) return;
        const hour = Math.floor(seconds / 3600);
        // Gestion éventuelle des horaires > 24h
        if (hour >= 0 && hour < 24) {
            departuresByHour[hour]++;
        }

    });

    // Nombre de trajets par direction
    const countDir0 = filteredTrips.filter(
        trip => trip.direction_id === "0").length;

    const countDir1 = filteredTrips.filter(
        trip => trip.direction_id === "1").length;

    document.getElementById("info-dir0").innerHTML = `
        <span class="direction-name">Direction ${destinations["0"]}</span>
        <span class="direction-count"> : ${countDir0} trajets</span>
    `;

    document.getElementById("info-dir1").innerHTML = `
        <span class="direction-name">Direction ${destinations["1"]}</span>
        <span class="direction-count"> : ${countDir1} trajets</span>
    `;

    // Dataviz nombre de départ par heure
    const labels = Object.keys(departuresByHour).map(
        hour => `${String(hour).padStart(2, "0")}h`
    );

    const values = Object.values(departuresByHour);
    // Détruire le graphique précédent
    if (departuresChart) {
        departuresChart.destroy();
    }

    const ctx = document.getElementById("departures-chart");
    departuresChart  = new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: "Nombre de départs",
                data: values
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Heure"
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Nombre de départs"
                    }
                }
            }
        }
    });

}


// --------------------------------------------------
// FORMAT HEURE
// --------------------------------------------------

function formatTime(seconds) {

    seconds = Math.floor(seconds);

    const hours =
        Math.floor(seconds / 3600);

    const minutes =
        Math.floor(
            (seconds % 3600) / 60
        );

    const secs =
        seconds % 60;


    return [
        hours,
        minutes,
        secs
    ]
        .map(
            value =>
                String(value).padStart(2, "0")
        )
        .join(":");
}


// --------------------------------------------------
// UI SELECTEUR LIGNES
// --------------------------------------------------

function populateLineSelector() {

    const select = document.getElementById("line-select");

    const lines = [...new Set(
        trips
            .map(d => d.route_short_name)
            .filter(Boolean)
    )].sort((a, b) => {
        return a.localeCompare(b, undefined, {
            numeric: true
        });
    });

    lines.forEach(line => {

        const option = document.createElement("option");

        option.value = line;
        option.textContent = line;

        select.appendChild(option);
    });

    select.addEventListener("change", updateLayer);
}


function getFilteredTrips() {

    const selectedLine =
        document.getElementById("line-select").value;

    if (selectedLine === "all") {
        return trips;
    }

    return trips.filter(
        d => d.route_short_name === selectedLine
    );
}


// --------------------------------------------------
// UI TEMPS
// --------------------------------------------------

function updateTime() {

    const slider =
        document.getElementById("time");

    const label =
        document.getElementById("timeLabel");


    slider.value =
        currentTime;


    label.textContent =
        formatTime(currentTime);

    // Mise à jour de la carte uniquement
    updateLayer(false);

}


// --------------------------------------------------
// SLIDER
// --------------------------------------------------

document
    .getElementById("time")
    .addEventListener(
        "input",
        event => {

            currentTime =
                Number(event.target.value);

            updateTime();
        }
    );


// --------------------------------------------------
// PLAY / PAUSE
// --------------------------------------------------

document
    .getElementById("play")
    .addEventListener(
        "click",
        () => {

            playing = !playing;


            const button =
                document.getElementById("play");


            if (playing) {

                button.textContent =
                    "⏸ Pause";

                previousTimestamp = null;

                animationId =
                    requestAnimationFrame(
                        animate
                    );

            } else {

                button.textContent =
                    "▶ Lecture";

                cancelAnimationFrame(
                    animationId
                );
            }
        }
    );


// --------------------------------------------------
// RESET
// --------------------------------------------------

document
    .getElementById("reset")
    .addEventListener(
        "click",
        () => {

            currentTime =
                LOOP_START;

            updateTime();
        }
    );


// --------------------------------------------------
// DÉMARRAGE
// --------------------------------------------------

loadTrips()
    .catch(error => {

        console.error(error);

        document.getElementById("info")
            .textContent =
            "Erreur lors du chargement des données.";
    });