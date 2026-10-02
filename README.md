# Cambodia Weather Intelligence

A professional weather dashboard for Cambodia built with HTML, Tailwind CSS, and vanilla JavaScript.

## Project Architecture

This project follows a simple, maintainable frontend structure:

- `index.html` — page layout and dashboard sections
- `css/style.css` — custom design and base styling
- `js/app.js` — app bootstrap and event wiring
- `js/api.js` — MET Norway forecast API calls
- `js/locations.js` — Cambodia province and city coordinates
- `js/weather.js` — weather processing and forecast logic
- `js/ui.js` — dashboard rendering and interactions
- `js/map.js` and `js/mapWeather.js` — interactive province map and map weather panel
- `js/geojson.js` and `assets/` — boundary data and place photography

## Why this structure works

Each file has one job:

- `locations.js` stores location metadata.
- `api.js` handles network requests and API errors.
- `weather.js` transforms raw API data into useful values.
- `ui.js` renders the interface and keeps the dashboard interactive.
- `app.js` connects the modules together.

This keeps the project easier to understand as it grows.

## Geographic data

`assets/cambodia-provinces.geojson` contains Cambodia ADM1 province boundaries from [geoBoundaries](https://www.geoboundaries.org/), dataset KHM-ADM1-37992800. The dataset is sourced from OpenStreetMap and Wambacher and is distributed under the Open Data Commons Open Database License 1.0. OpenStreetMap map tiles are credited in the map controls.

Weather forecasts use the public MET Norway Locationforecast API, which requires no API key. The dashboard identifies the source and links its CC BY 4.0 license. Forecast requests are limited to four at a time and use the browser's HTTP cache. The provider does not supply apparent temperature, UV index, or precipitation probabilities in this response, so those values remain unavailable rather than being fabricated. Sunrise and sunset are calculated from the selected location's coordinates.

Place-name search uses Open-Meteo Geocoding API results limited to Cambodia. The selected-place panel searches Wikimedia Commons for matching photographs and displays the image source, author, and license. Successful matches are cached in browser storage. If Commons is unavailable or has no match, the panel displays the bundled Cambodia reference photo instead of staying blank, with a clear note that it is not specific to the selected place. The bundled photo is “Royal Palace, Phnom Penh Cambodia 1.jpg” by Hanay, licensed CC BY-SA 3.0; its source page is linked in the image caption.

## Phase 1: Project Setup

### 1. Project structure

Open the project folder and confirm the following structure:

```bash
cambodia-weather/
├── index.html
├── tailwind.config.js
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── api.js
│   ├── locations.js
│   ├── weather.js
│   └── ui.js
├── assets/
│   ├── images/
│   └── icons/
└── README.md
```

### 2. Install dependencies and run the project

First install the project dependencies:

```bash
cd "c:\Users\reamkhorn\OneDrive - theluminix com\Desktop\Cambodia Weather"
npm install
```

Then build the local Tailwind CSS file:

```bash
npm run build:css
```

Finally, start the dashboard locally:

```bash
npm start
```

Then open:

```text
http://localhost:8000
```

## Publish to the web

The site is static and is configured to deploy to GitHub Pages with `.github/workflows/pages.yml`. After pushing the project to a GitHub repository, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow builds the CSS and publishes the site whenever changes are pushed to `main`.

To connect this folder to a new GitHub repository, create an empty repository on GitHub, then run these commands from the project directory. Replace the remote URL with the one shown by GitHub:

```bash
git init
git add .
git commit -m "Prepare Cambodia Weather for deployment"
git branch -M main
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

Once the Pages workflow finishes, GitHub will show the public site URL in the repository's **Settings → Pages** page. Weather forecasts use MET Norway and need no API key; place-name search continues to use Open-Meteo Geocoding. MET Norway asks clients to respect response caching and request limits. A low-volume static site can use simple browser requests; a higher-traffic deployment should route requests through a caching proxy.

---

This project is meant to be professional and portfolio-ready, so we will keep the code clean, accurate, and maintainable.
