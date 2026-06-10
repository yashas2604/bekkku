import { state } from './state.js';
import { randomPhrases, sleepTimeout } from './config.js';
import { initPhysics, updateEyeFollow, physicsLoop, triggerZoomies, updateCatElementPos } from './physics.js';
import { initTimers } from './timers.js';
import { initGym } from './gym.js';

// --- DOM ELEMENTS ---
const catContainer = document.getElementById('cat-container');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const pomoWidget = document.getElementById('pomo-widget');
const settingsDrawer = document.getElementById('settings-drawer');
const closeDrawerBtn = document.getElementById('close-drawer');
const minimizeDrawerBtn = document.getElementById('minimize-drawer-btn');

// Controls & Inputs
const furBtns = document.querySelectorAll('.fur-btn');
const usernameInput = document.getElementById('username-input');
const saveUsernameBtn = document.getElementById('save-username-btn');
const styleSelect = document.getElementById('style-select');
const pinnedNoteInput = document.getElementById('pinned-note-input');
const pinNoteBtn = document.getElementById('pin-note-btn');
const aiThinkBtn = document.getElementById('ai-think-btn');
const aiDoneBtn = document.getElementById('ai-done-btn');
const resetPositionBtn = document.getElementById('reset-position-btn');

async function loadSVGs() {
  const container = document.getElementById('cat-container');
  const [originalText, outlinedText] = await Promise.all([
    fetch('svg/original-cat.svg').then(res => res.text()),
    fetch('svg/outlined-cat.svg').then(res => res.text())
  ]);
  container.innerHTML = originalText + outlinedText;
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
  // Load SVGs dynamically
  await loadSVGs();

  // Load saved fur pattern
  const savedFur = localStorage.getItem('bekkku-fur') || 'orange';
  setFurPattern(savedFur);

  // Load saved note
  const savedNote = localStorage.getItem('bekkku-note') || '';
  if (savedNote) {
    pinnedNoteInput.value = savedNote;
    state.pinnedMessage = savedNote;
  }

  // Render initial positions
  updateCatElementPos();
  setCatState('breathe');

  // Initialize keyboard kneading gym
  initGym();

  // Initialize timers
  initTimers();

  // Initialize physics (dragging)
  initPhysics();

  // Load saved username
  const savedUsername = localStorage.getItem('bekkku-username') || '';
  if (savedUsername) {
    usernameInput.value = savedUsername;
  }

  // Load saved style
  const savedStyle = localStorage.getItem('bekkku-style') || 'outlined';
  styleSelect.value = savedStyle;
  setCatStyle(savedStyle);

  styleSelect.addEventListener('change', (e) => {
    setCatStyle(e.target.value);
  });

  // Start smooth physics update loop
  requestAnimationFrame(physicsLoop);

  // Show startup greeting
  showStartupGreeting();
});

// --- ELECTRON IPC TRAY INTEGRATION ---
if (window.electronAPI) {
  window.electronAPI.onToggleSettings(() => {
    toggleDrawer();
  });

  // Listen to global mouse events from the main process
  window.electronAPI.onGlobalMouse((data) => {
    // Keep window coordinates in sync with ground truth from main process when not dragging or zooming!
    if (!state.isDragging && !state.isZooming) {
      state.currentWinX = data.winX;
      state.currentWinY = data.winY;
    }

    const newMx = data.mx;
    const newMy = data.my;

    // Track mouse activity globally
    if (newMx !== state.lastGlobalMx || newMy !== state.lastGlobalMy) {
      state.lastActivityTime = Date.now();
      state.mx = newMx;
      state.my = newMy;
      state.lastGlobalMx = newMx;
      state.lastGlobalMy = newMy;
      if (state.isSleeping) wakeUp();
    }

    // Mathematical Click-Through Evaluation
    let isOverInteractive = false;
    if (state.isDrawerOpen) {
      isOverInteractive = true;
    } else {
      const localX = state.mx - state.currentWinX;
      const localY = state.my - state.currentWinY;

      // Check if cursor is over the cat box (128x128)
      if (localX >= state.catX && localX <= state.catX + 128 && localY >= state.catY && localY <= state.catY + 128) {
        isOverInteractive = true;
      }

      // Check if cursor is over speech bubble (if visible)
      if (!isOverInteractive && !speechBubble.classList.contains('hidden')) {
        const bubbleRect = speechBubble.getBoundingClientRect();
        if (localX >= bubbleRect.left && localX <= bubbleRect.right && localY >= bubbleRect.top && localY <= bubbleRect.bottom) {
          isOverInteractive = true;
        }
      }

      // Check if cursor is over Pomodoro widget (if visible)
      if (!isOverInteractive && !pomoWidget.classList.contains('hidden')) {
        const pomoRect = pomoWidget.getBoundingClientRect();
        if (localX >= pomoRect.left && localX <= pomoRect.right && localY >= pomoRect.top && localY <= pomoRect.bottom) {
          isOverInteractive = true;
        }
      }
    }

    // Set Electron click-through state
    if (isOverInteractive) {
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      if (!state.isDragging) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }

    // Smoothly calculate pupil offsets
    updateEyeFollow(state.mx, state.my);
  });
}

// --- MOCHI DRAGGING & CLICK INTERACTIONS ---
let clickTimeout = null;

// Double-click cat to toggle console drawer
catContainer.addEventListener('dblclick', (e) => {
  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }
  toggleDrawer();
});

// Right-click cat to toggle console drawer
catContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  toggleDrawer();
});

// Single-click cat to show pinned note / reminders
catContainer.addEventListener('click', (e) => {
  if (state.isDragging || e.button !== 0) return;

  if (clickTimeout) {
    clearTimeout(clickTimeout);
    clickTimeout = null;
  }

  clickTimeout = setTimeout(() => {
    handleCatSingleClick();
    clickTimeout = null;
  }, 220); // 220ms window to distinguish single vs double click
});

function handleCatSingleClick() {
  if (state.pinnedMessage) {
    showSpeech(`Reminder: ${state.pinnedMessage}`, 6000); // Show pinned note for 6 seconds
  } else {
    const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    showSpeech(phrase, 4000);
  }
}

// Roll for random behavior every 15 seconds to make it more active!
setInterval(() => {
  if (state.isDragging || state.isStretching || state.isSleeping || state.isDrawerOpen || state.pomoIsRunning || state.isZooming) return;

  const roll = Math.random();
  if (roll < 0.25) {
    // 25% chance: Zoomies!
    triggerZoomies();
  } else if (roll < 0.50) {
    // 25% chance: Bounces / Hop!
    triggerJumpReaction();
  } else if (roll < 0.80) {
    // 30% chance: Speak a random meow or reminder!
    const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    showSpeech(phrase, 4000);
  }
  // 20% chance: Stay breathing (do nothing)
}, 15000);

// --- CAT ANIMATION STATES MANAGER ---
export function setCatState(catState) {
  catContainer.classList.remove('cat-breathe', 'cat-walk', 'cat-knead', 'cat-sleep', 'cat-overheat', 'cat-thinking');

  if (catState === 'breathe') {
    catContainer.classList.add('cat-breathe');
  } else if (catState === 'walk') {
    catContainer.classList.add('cat-walk');
  } else if (catState === 'knead') {
    catContainer.classList.add('cat-knead');
  } else if (catState === 'sleep') {
    catContainer.classList.add('cat-sleep');
  } else if (catState === 'overheat') {
    catContainer.classList.add('cat-knead', 'cat-overheat');
  } else if (catState === 'thinking') {
    catContainer.classList.add('cat-thinking');
  }
}

// --- SLEEP SEQUENCES ---
export function goToSleep() {
  if (state.isSleeping) return;
  state.isSleeping = true;
  setCatState('sleep');
  showSpeech('Zzz... 💤', 0);
}

export function wakeUp() {
  if (!state.isSleeping) return;
  state.isSleeping = false;
  setCatState('breathe');
  hideSpeech();
}

// --- SPEECH BUBBLE CONTROL ---
let speechTimer = null;
export function showSpeech(text, durationMs = 3000) {
  if (speechTimer) clearTimeout(speechTimer);

  bubbleText.innerText = text;
  speechBubble.classList.remove('hidden');

  if (durationMs > 0) {
    speechTimer = setTimeout(() => {
      hideSpeech();
    }, durationMs);
  }
}

export function resetHeadTilt() {
  const head = document.querySelector('.cat-head');
  if (head) head.style.transform = 'rotate(0deg)';
}

export function hideSpeech() {
  speechBubble.classList.add('hidden');
}

// --- CONSOLE/SETTINGS DRAWER CONTROL ---
export function toggleDrawer() {
  state.isDrawerOpen = !state.isDrawerOpen;

  if (window.electronAPI) {
    if (state.isDrawerOpen) {
      const currentCatX = state.pomoActive ? 96 : 16;
      const newWinX = state.currentWinX - (320 - currentCatX);
      const newWinY = state.currentWinY - 240;

      window.electronAPI.moveWindow(newWinX, newWinY);
      window.electronAPI.resizeWindow(460, 480);

      state.currentWinX = newWinX;
      state.currentWinY = newWinY;
      state.catX = 320;
      state.catY = 320;

      settingsDrawer.classList.remove('drawer-closed');
      settingsDrawer.classList.add('drawer-open');
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      const targetWinWidth = state.pomoActive ? 240 : 160;
      const targetCatX = state.pomoActive ? 96 : 16;

      const newWinX = state.currentWinX + (320 - targetCatX);
      const newWinY = state.currentWinY + 240;

      window.electronAPI.resizeWindow(targetWinWidth, 220);
      window.electronAPI.moveWindow(newWinX, newWinY);

      state.currentWinX = newWinX;
      state.currentWinY = newWinY;
      state.catX = targetCatX;
      state.catY = 80;

      settingsDrawer.classList.remove('drawer-open');
      settingsDrawer.classList.add('drawer-closed');
    }

    resetHeadTilt();
    updateCatElementPos();
  }
}

closeDrawerBtn.addEventListener('click', toggleDrawer);
minimizeDrawerBtn.addEventListener('click', toggleDrawer);

// Reset Position button
resetPositionBtn.addEventListener('click', () => {
  if (window.electronAPI) {
    window.electronAPI.resetPosition();
  }
});

// --- SELECTING FUR PATTERNS ---
export function setFurPattern(furType) {
  catContainer.classList.remove('tuxedo-cat', 'calico-cat', 'siamese-cat', 'midnight-cat', 'ghost-cat');

  if (furType !== 'orange') {
    catContainer.classList.add(`${furType}-cat`);
  }

  furBtns.forEach(btn => {
    if (btn.dataset.fur === furType) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  localStorage.setItem('bekkku-fur', furType);
  showSpeech("Meow! ✨", 2000);
}

furBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setFurPattern(btn.dataset.fur);
  });
});

// --- USERNAME CUSTOMIZER ---
saveUsernameBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  localStorage.setItem('bekkku-username', name);
  if (name) {
    showSpeech(`Saved: ${name}! 🐾`, 3000);
  } else {
    showSpeech("Name cleared! 🐾", 3000);
  }
});

// --- PINNING NOTES ---
pinNoteBtn.addEventListener('click', () => {
  const note = pinnedNoteInput.value.trim();
  state.pinnedMessage = note;
  localStorage.setItem('bekkku-note', note);

  if (note) {
    showSpeech(`Pinned: ${note}`, 3000);
  } else {
    hideSpeech();
  }
});

// --- AI REACTION CONTROLS ---
aiThinkBtn.addEventListener('click', () => {
  setCatState('thinking');
  showSpeech("Thinking...", 4000);

  setTimeout(() => {
    if (catContainer.classList.contains('cat-thinking')) {
      setCatState('breathe');
      hideSpeech();
    }
  }, 4000);
});

export function triggerJumpReaction(customText, durationMs = 3000) {
  catContainer.classList.add('cat-jump');
  const textToShow = customText !== undefined ? customText : "YEAH ! 🎉";
  if (textToShow) {
    showSpeech(textToShow, durationMs);
  }

  setTimeout(() => {
    catContainer.classList.remove('cat-jump');
    if (textToShow && durationMs <= 800) {
      hideSpeech();
    }
  }, 800);
}

export async function showStartupGreeting() {
  let name = localStorage.getItem('bekkku-username') || '';
  if (!name && window.electronAPI) {
    name = await window.electronAPI.getOSUsername();
  }

  let welcomeText = "Hi";
  if (name) {
    welcomeText += ` ${name}`;
  } else {
    welcomeText += " there";
  }
  welcomeText += "! 🐾";

  const hour = new Date().getHours();
  let timeGreeting = "";
  if (hour >= 5 && hour < 12) {
    timeGreeting = "Good morning! ☀️";
  } else if (hour >= 12 && hour < 18) {
    timeGreeting = "Good afternoon! 🌤️";
  } else if (hour >= 18 && hour < 22) {
    timeGreeting = "Good evening! 🌙";
  } else {
    timeGreeting = "Working late? 💻";
  }

  // 1. First message: "Hi [Name]! 🐾" with a welcome jump
  triggerJumpReaction(welcomeText, 2500);

  // 2. Second message: "Good morning/afternoon/evening!" shown after a short pause
  setTimeout(() => {
    showSpeech(timeGreeting, 3500);
  }, 2850);
}

aiDoneBtn.addEventListener('click', () => triggerJumpReaction());

export function setCatStyle(style) {
  const originalSvg = document.getElementById('cat-svg-original');
  const outlinedSvg = document.getElementById('cat-svg-outlined');
  
  if (originalSvg && outlinedSvg) {
    if (style === 'original') {
      originalSvg.classList.remove('hidden');
      outlinedSvg.classList.add('hidden');
    } else {
      originalSvg.classList.add('hidden');
      outlinedSvg.classList.remove('hidden');
    }
  }
  
  localStorage.setItem('bekkku-style', style);
}
