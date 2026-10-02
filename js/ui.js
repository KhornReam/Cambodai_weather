function renderProvinceRainList(summary, groupName) {
  const dialog = document.getElementById('province-rain-dialog');
  const title = document.getElementById('province-rain-dialog-title');
  const dateLabel = document.getElementById('province-rain-dialog-date');
  const summaryText = document.getElementById('province-rain-dialog-summary');
  const list = document.getElementById('province-rain-list');
  if (!dialog || !title || !dateLabel || !summaryText || !list) return;

  const rainingNow = groupName === 'rainingNow';
  const provinces = [...(rainingNow ? summary.rainingNow : summary.notRainingNow)]
    .sort((first, second) => first.location.name.localeCompare(second.location.name));
  const observedAt = summary.time ? new Date(summary.time) : null;
  const observationTime = observedAt && !Number.isNaN(observedAt.getTime())
    ? `${new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'Asia/Phnom_Penh'
      }).format(observedAt)} ICT`
    : 'Latest observation';

  title.textContent = rainingNow ? `Raining now · ${provinces.length}` : `Not raining now · ${provinces.length}`;
  dateLabel.textContent = observationTime;
  summaryText.textContent = rainingNow
    ? 'These provinces currently report rain or thunderstorms.'
    : 'These provinces do not currently report rain.';
  list.replaceChildren();

  if (!provinces.length) {
    const empty = document.createElement('p');
    empty.className = 'province-rain-empty';
    empty.textContent = summary.available === 0
      ? 'Current weather conditions are unavailable for all provinces.'
      : rainingNow
        ? 'No provinces are currently reporting rain.'
        : 'Every available province is currently reporting rain.';
    list.append(empty);
  }

  provinces.forEach((forecast) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'province-rain-row';
    const name = document.createElement('span');
    name.className = 'province-rain-name';
    name.textContent = forecast.location.name;
    const detail = document.createElement('span');
    detail.className = 'province-rain-detail';
    const amount = forecast.precipitation != null && Number.isFinite(Number(forecast.precipitation))
      ? `${Number(forecast.precipitation).toFixed(1)} mm rain`
      : 'rain amount unavailable';
    detail.textContent = `${forecast.condition || 'Current conditions unavailable'} · ${amount}`;
    const arrow = document.createElement('i');
    arrow.className = 'fa-solid fa-arrow-right';
    arrow.setAttribute('aria-hidden', 'true');
    row.append(name, detail, arrow);
    row.addEventListener('click', () => {
      dialog.close();
      window.dispatchEvent(new CustomEvent('location:selected', {
        detail: { locationName: forecast.location.name }
      }));
    });
    list.append(row);
  });

  if (summary.unavailable?.length) {
    const unavailable = document.createElement('p');
    unavailable.className = 'province-rain-unavailable';
    unavailable.textContent = `Current conditions unavailable for ${summary.unavailable.length} province${summary.unavailable.length === 1 ? '' : 's'}.`;
    list.append(unavailable);
  }

  if (!dialog.open) dialog.showModal();
}

export function initializeUI(appState) {
  const locationSelect = document.getElementById('location-select');
  const themeToggle = document.getElementById('theme-toggle');
  const searchInput = document.getElementById('location-search');
  const refreshButton = document.getElementById('refresh-weather');
  const searchLabel = searchInput?.closest('label');

  let searchResults = searchLabel?.querySelector('#location-search-results');
  if (searchLabel && !searchResults) {
    searchResults = document.createElement('div');
    searchResults.id = 'location-search-results';
    searchResults.className = 'absolute left-0 right-0 top-full z-50 mt-2 hidden max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-900';
    searchLabel.append(searchResults);
  }

  if (!locationSelect || !themeToggle || !searchInput || !refreshButton) {
    return;
  }

  let provinceRainSummary = null;
  window.addEventListener('weather:province-rain-updating', () => {
    const coverage = document.getElementById('rain-outlook-coverage');
    if (coverage) coverage.textContent = 'Updating live province conditions...';
    document.querySelectorAll('[data-rain-group]').forEach((button) => {
      button.disabled = true;
    });
  });

  window.addEventListener('weather:province-rain-summary', (event) => {
    provinceRainSummary = event.detail;
    if (!provinceRainSummary) return;

    const rainCount = document.getElementById('rain-now-count');
    const dryCount = document.getElementById('not-raining-now-count');
    const coverage = document.getElementById('rain-outlook-coverage');
    const rainButton = document.getElementById('rain-now-card');
    const dryButton = document.getElementById('not-raining-now-card');

    if (rainCount) rainCount.textContent = provinceRainSummary.rainingNow.length;
    if (dryCount) dryCount.textContent = provinceRainSummary.notRainingNow.length;
    if (coverage) {
      const unavailableCount = provinceRainSummary.unavailable?.length || 0;
      const observedAt = provinceRainSummary.time ? new Date(provinceRainSummary.time) : null;
      const updatedTime = observedAt && !Number.isNaN(observedAt.getTime())
        ? new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: 'Asia/Phnom_Penh'
          }).format(observedAt)
        : null;
      const coverageText = `${provinceRainSummary.available} of ${provinceRainSummary.total} current observations`;
      const updatedText = updatedTime ? ` · Updated ${updatedTime} ICT` : '';
      coverage.textContent = unavailableCount
        ? `${coverageText} · ${unavailableCount} unavailable${updatedText}`
        : `${coverageText}${updatedText}`;
    }
    if (rainButton) rainButton.disabled = false;
    if (dryButton) dryButton.disabled = false;
  });

  document.querySelectorAll('[data-rain-group]').forEach((button) => {
    button.addEventListener('click', () => {
      if (provinceRainSummary) renderProvinceRainList(provinceRainSummary, button.dataset.rainGroup);
    });
  });

  const provinceRainDialog = document.getElementById('province-rain-dialog');
  document.getElementById('close-province-rain-dialog')?.addEventListener('click', () => provinceRainDialog?.close());
  provinceRainDialog?.addEventListener('click', (event) => {
    if (event.target === provinceRainDialog) provinceRainDialog.close();
  });

  const savedTheme = localStorage.getItem('cambodia-weather-theme');
  if (savedTheme === 'dark') {
    appState.darkMode = true;
  }

  applyTheme(appState.darkMode);
  setThemeToggleIcon(appState.darkMode);

  themeToggle.addEventListener('click', () => {
    appState.darkMode = !appState.darkMode;
    localStorage.setItem('cambodia-weather-theme', appState.darkMode ? 'dark' : 'light');
    applyTheme(appState.darkMode);
    setThemeToggleIcon(appState.darkMode);
  });

  refreshButton.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('weather:refresh'));
  });

  searchInput.addEventListener('input', (event) => {
    const term = event.target.value.trim().toLowerCase();
    const options = Array.from(locationSelect.options);

    options.forEach((option) => {
      if (option.value === '') {
        option.hidden = false;
        return;
      }

      const matches = option.text.toLowerCase().includes(term);
      option.hidden = !!term && !matches;
    });

    const allLocations = Array.from(locationSelect.options)
      .filter((option) => option.value)
      .map((option) => option.value);

    const match = allLocations.find((locationName) => locationName.toLowerCase().includes(term));
    if (term && match) {
      locationSelect.value = match;
    }

    window.dispatchEvent(
      new CustomEvent('location:search', {
        detail: { query: term }
      })
    );

    searchResults?.classList.add('hidden');
  });

  window.addEventListener('location:place-results', (event) => {
    if (!searchResults) return;
    searchResults.replaceChildren();

    const results = event.detail?.results || [];
    if (!results.length) {
      const message = document.createElement('p');
      message.className = 'px-3 py-2 text-sm text-slate-500 dark:text-slate-400';
      message.textContent = event.detail?.message || 'No Cambodian places found.';
      searchResults.append(message);
      searchResults.classList.remove('hidden');
      return;
    }

    results.forEach((location) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800';
      const name = document.createElement('span');
      name.className = 'block text-sm font-semibold text-slate-800 dark:text-slate-100';
      name.textContent = location.name;
      const context = document.createElement('span');
      context.className = 'block text-xs text-slate-500 dark:text-slate-400';
      context.textContent = [location.admin2, location.admin1, 'Cambodia'].filter(Boolean).join(', ');
      button.append(name, context);
      button.addEventListener('click', () => {
        searchInput.value = location.name;
        searchResults.classList.add('hidden');
        window.dispatchEvent(new CustomEvent('location:selected', { detail: { location } }));
      });
      searchResults.append(button);
    });

    searchResults.classList.remove('hidden');
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;

    const term = event.target.value.trim().toLowerCase();
    if (!term) return;

    const options = Array.from(locationSelect.options)
      .filter((option) => option.value && !option.hidden)
      .map((option) => option.value);

    const exactMatch = options.find((name) => name.toLowerCase() === term);
    const firstMatch = options.find((name) => name.toLowerCase().includes(term));

    const chosen = exactMatch || (firstMatch && firstMatch.toLowerCase().startsWith(term) ? firstMatch : null);
    if (chosen) {
      searchResults?.classList.add('hidden');
      locationSelect.value = chosen;
      window.dispatchEvent(
        new CustomEvent('location:selected', {
          detail: { locationName: chosen }
        })
      );
    } else {
      window.dispatchEvent(new CustomEvent('location:place-search', { detail: { query: event.target.value.trim() } }));
    }
  });

  locationSelect.addEventListener('change', (event) => {
    const selectedName = event.target.value;
    if (!selectedName) return;

    window.dispatchEvent(
      new CustomEvent('location:selected', {
        detail: { locationName: selectedName }
      })
    );
  });
}

export function applyTheme(isDarkMode) {
  document.documentElement.classList.toggle('dark', isDarkMode);
}

export function setThemeToggleIcon(isDarkMode) {
  const button = document.getElementById('theme-toggle');
  if (!button) return;

  button.innerHTML = isDarkMode
    ? '<i class="fa-solid fa-sun"></i>'
    : '<i class="fa-solid fa-moon"></i>';
}

export function populateLocationSelect(locations) {
  const select = document.getElementById('location-select');
  if (!select) return;

  select.innerHTML = '<option value="">Select a province</option>';

  locations.forEach((location) => {
    const option = document.createElement('option');
    option.value = location.name;
    option.textContent = location.name;
    select.appendChild(option);
  });
}

export function renderLocationOverview(locations, selectedName, query = '') {
  const container = document.getElementById('location-overview');
  if (!container) return;

  const filteredLocations = locations.filter((location) => {
    if (!query) return true;
    return location.name.toLowerCase().includes(query.toLowerCase());
  });

  if (!filteredLocations.length) {
    container.innerHTML = `
      <p class="text-sm text-slate-500 dark:text-slate-400">No province matched your search.</p>
    `;
    return;
  }

  container.innerHTML = filteredLocations
    .map((location) => {
      const isSelected = location.name === selectedName;
      return `
        <button
          type="button"
          data-location="${location.name}"
          class="flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
            isSelected ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300' : 'border-slate-200 bg-white/60 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200'
          }"
        >
          <span class="font-medium">${location.name}</span>
          <span class="text-xs text-slate-500 dark:text-slate-400">--°C</span>
        </button>
      `;
    })
    .join('');

  container.querySelectorAll('[data-location]').forEach((button) => {
    button.addEventListener('click', () => {
      const chosen = button.getAttribute('data-location');
      if (!chosen) return;
      window.dispatchEvent(
        new CustomEvent('location:selected', {
          detail: { locationName: chosen }
        })
      );
    });
  });
}

export function startCambodiaClock() {
  const dateElement = document.getElementById('current-date-time');
  const clockElement = document.getElementById('live-clock');
  const timeZone = 'Asia/Phnom_Penh';
  const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone
  });
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone
  });

  const tick = () => {
    const now = new Date();
    const time = timeFormatter.format(now);

    if (dateElement) {
      dateElement.textContent = `${dateFormatter.format(now)} · ${time} ICT`;
    }

    if (clockElement) {
      const digits = clockElement.querySelector('.clock-digits');
      const zone = clockElement.querySelector('.clock-zone');
      if (digits && zone) {
        digits.textContent = time;
        zone.textContent = 'ICT';
      } else {
        clockElement.textContent = `${time} ICT`;
      }
      clockElement.dateTime = now.toISOString();
    }
  };

  tick();
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
  window.setInterval(tick, 1000);
}

export function updateLastUpdated(date) {
  const element = document.getElementById('last-updated');
  if (!element) return;

  const formatted = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Phnom_Penh'
  }).format(new Date(date));

  element.textContent = `${formatted} ICT`;
  element.dateTime = new Date(date).toISOString();
}

export function setLoadingState(isLoading) {
  const button = document.getElementById('refresh-weather');
  if (!button) return;

  button.classList.toggle('loading', isLoading);
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<i class="fa-solid fa-spinner fa-spin mr-2"></i>Updating'
    : '<i class="fa-solid fa-arrows-rotate mr-2"></i>Refresh';
}

export function renderErrorState(message) {
  const summary = document.getElementById('weather-description');
  const temp = document.getElementById('current-temperature');
  const feelsLike = document.getElementById('feels-like');
  const detail = document.getElementById('rain-forecast');

  if (summary) summary.textContent = 'Weather unavailable';
  if (temp) temp.textContent = '--°C';
  if (feelsLike) feelsLike.textContent = '--°C';
  if (detail) {
    const errorMessage = document.createElement('p');
    errorMessage.className = 'text-amber-600 dark:text-amber-300';
    errorMessage.textContent = message;
    detail.replaceChildren(errorMessage);
  }
}
