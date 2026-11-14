"use strict";

const map = L.map("earthquake-map", { keyboard: true }).setView([20, 0], 2);
addBasemapControl(map);

let dailyChart;
const numberFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

function createDailyChart(features) {
  const counts = new Map();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    counts.set(day.toLocaleDateString("de-DE"), 0);
  }

  for (const feature of features) {
    const day = new Date(feature.properties.time).toLocaleDateString("de-DE");
    if (counts.has(day)) {
      counts.set(day, counts.get(day) + 1);
    }
  }

  const labels = Array.from(counts.keys());
  dailyChart = new Chart(document.getElementById("daily-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Erdbeben",
        data: Array.from(counts.values()),
        backgroundColor: "#1769aa",
        borderColor: "#104b7a",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Datum (lokale Zeit)" } },
        y: { beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: "Anzahl" } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.parsed.y} Erdbeben` } }
      }
    }
  });
}

const earthquakes = createEarthquakeLayer({
  statusElement: document.getElementById("feed-status"),
  filterElement: document.getElementById("magnitude-filter"),
  magnitudeValue: document.getElementById("magnitude-value"),
  updatedAt: document.getElementById("updated-at"),
  minimumMagnitude: 2.5,
  onDataLoaded: createDailyChart
});
earthquakes.layer.addTo(map);
