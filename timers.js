import { state } from './state.js';
import { setCatState, showSpeech, hideSpeech, triggerJumpReaction } from './renderer.js';
import { updateCatElementPos } from './physics.js';

const pomoWidget = document.getElementById('pomo-widget');
const pomoTime = document.getElementById('pomo-time');
const pomoToggleBtn = document.getElementById('pomo-toggle-btn');
const pomoResetBtn = document.getElementById('pomo-reset-btn');
const stretchIntervalSelect = document.getElementById('stretch-interval-select');

export function initTimers() {
  // Load saved stretch intervals
  const savedStretch = localStorage.getItem('bekkku-stretch') || '60';
  stretchIntervalSelect.value = savedStretch;
  setupStretchBreak(savedStretch);

  // Setup click handlers for Pomodoro
  pomoToggleBtn.addEventListener('click', () => {
    if (state.pomoIsRunning) {
      pausePomo();
    } else {
      startPomo();
    }
  });

  pomoResetBtn.addEventListener('click', () => {
    resetPomo();
  });

  // Stretch Reminder select change
  stretchIntervalSelect.addEventListener('change', (e) => {
    setupStretchBreak(e.target.value);
  });

  updatePomoDisplay();
}

export function updatePomoDisplay() {
  const mins = Math.floor(state.pomoSecondsLeft / 60);
  const secs = state.pomoSecondsLeft % 60;
  pomoTime.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function startPomo() {
  state.pomoIsRunning = true;
  state.pomoActive = true;
  pomoToggleBtn.innerText = 'PAUSE';
  pomoToggleBtn.classList.remove('btn-green');
  pomoToggleBtn.classList.add('btn-pixel');
  pomoWidget.classList.remove('hidden');

  if (window.electronAPI && !state.isDrawerOpen) {
    const newWinX = state.currentWinX - 80;
    window.electronAPI.moveWindow(newWinX, state.currentWinY);
    window.electronAPI.resizeWindow(240, 220);
    state.currentWinX = newWinX;
    state.catX = 96;
    updateCatElementPos();
  }

  showSpeech(state.pomoMode === 'focus' ? "Time to focus! 🍅" : "Take a break! ☕", 3000);

  if (state.pomoTimerId) clearInterval(state.pomoTimerId);
  state.pomoTimerId = setInterval(() => {
    if (state.pomoSecondsLeft > 0) {
      state.pomoSecondsLeft--;
      updatePomoDisplay();
    } else {
      clearInterval(state.pomoTimerId);
      if (state.pomoMode === 'focus') {
        state.pomoMode = 'break';
        state.pomoSecondsLeft = 5 * 60;
        triggerJumpReaction();
        showSpeech("Break time! Take 5 mins 🍅", 5000);
      } else {
        state.pomoMode = 'focus';
        state.pomoSecondsLeft = 25 * 60;
        triggerJumpReaction();
        showSpeech("Break over! Let's focus! 🍅", 5000);
      }
      startPomo();
    }
  }, 1000);
}

export function pausePomo() {
  state.pomoIsRunning = false;
  pomoToggleBtn.innerText = 'START';
  pomoToggleBtn.classList.remove('btn-pixel');
  pomoToggleBtn.classList.add('btn-green');
  if (state.pomoTimerId) {
    clearInterval(state.pomoTimerId);
    state.pomoTimerId = null;
  }
}

export function resetPomo() {
  pausePomo();
  state.pomoActive = false;
  state.pomoMode = 'focus';
  state.pomoSecondsLeft = 25 * 60;
  updatePomoDisplay();
  pomoWidget.classList.add('hidden');
  hideSpeech();

  if (window.electronAPI && !state.isDrawerOpen) {
    const newWinX = state.currentWinX + 80;
    window.electronAPI.resizeWindow(160, 220);
    window.electronAPI.moveWindow(newWinX, state.currentWinY);
    state.currentWinX = newWinX;
    state.catX = 16;
    updateCatElementPos();
  }
}

export function setupStretchBreak(intervalMins) {
  if (state.stretchTimerId) clearInterval(state.stretchTimerId);
  localStorage.setItem('bekkku-stretch', intervalMins);

  if (intervalMins === 'off') return;

  const intervalMs = parseInt(intervalMins) * 60 * 1000;
  state.stretchTimerId = setInterval(() => {
    triggerStretchBreak();
  }, intervalMs);
}

export function triggerStretchBreak() {
  if (state.isStretching) return;
  state.isStretching = true;

  const catContainer = document.getElementById('cat-container');
  catContainer.style.transform = 'scale(2.5)';
  showSpeech("Time to stretch! Stand up! 🧘", 15000);

  setTimeout(() => {
    catContainer.style.transform = 'scale(1)';
    state.isStretching = false;
    hideSpeech();
  }, 15000);
}
