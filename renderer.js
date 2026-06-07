// --- DOM ELEMENTS ---
const catContainer = document.getElementById('cat-container');
const catSvg = document.getElementById('cat-svg');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const pomoWidget = document.getElementById('pomo-widget');
const pomoTime = document.getElementById('pomo-time');
const settingsDrawer = document.getElementById('settings-drawer');
const closeDrawerBtn = document.getElementById('close-drawer');
const minimizeDrawerBtn = document.getElementById('minimize-drawer-btn');

// Controls & Inputs
const furBtns = document.querySelectorAll('.fur-btn');
const pinnedNoteInput = document.getElementById('pinned-note-input');
const pinNoteBtn = document.getElementById('pin-note-btn');
const pomoToggleBtn = document.getElementById('pomo-toggle-btn');
const pomoResetBtn = document.getElementById('pomo-reset-btn');
const stretchIntervalSelect = document.getElementById('stretch-interval-select');
const aiThinkBtn = document.getElementById('ai-think-btn');
const aiDoneBtn = document.getElementById('ai-done-btn');
const gymWrapper = document.getElementById('gym-wrapper');
const gymFocusOverlay = document.getElementById('gym-focus-overlay');
const gymHiddenInput = document.getElementById('gym-hidden-input');
const gymWordsContainer = document.getElementById('gym-words-container');
const gymWordsList = document.getElementById('gym-words-list');
const gymCaret = document.getElementById('gym-caret');
const gymResults = document.getElementById('gym-results');
const resultsWpm = document.getElementById('results-wpm');
const resultsAcc = document.getElementById('results-acc');
const resultsTime = document.getElementById('results-time');
const resultsRestartBtn = document.getElementById('results-restart-btn');
const gymWpmVal = document.getElementById('gym-wpm-val');
const gymAccVal = document.getElementById('gym-acc-val');
const gymTimerVal = document.getElementById('gym-timer-val');
const gymRestartBtn = document.getElementById('gym-restart-btn');
const kneadStatus = document.getElementById('knead-status');
const configModeTime = document.getElementById('config-mode-time');
const configModeWords = document.getElementById('config-mode-words');
const gymConfigOptions = document.getElementById('gym-config-options');
const resetPositionBtn = document.getElementById('reset-position-btn');

// --- APP STATE ---
// Coordinates relative to the window
let catX = 16;
let catY = 80;

// Screen space window coordinates
let currentWinX = 0;
let currentWinY = 0;

// Target positions for Zoomies
let targetWinX = 0;
let targetWinY = 0;
let isZooming = false;
let zoomTimer = null;
const zoomSpeed = 0.12;

// Global cursor coordinates
let mx = 0;
let my = 0;
let lastGlobalMx = 0;
let lastGlobalMy = 0;

let isDragging = false;
let startScreenX = 0;
let startScreenY = 0;
let isDrawerOpen = false;

// Physics settings
const speedFactor = 0.07; // Easing factor

// Typing stats
let keyTimes = [];
let typingTimeout = null;

// Pomodoro State
let pomoTimerId = null;
let pomoSecondsLeft = 25 * 60;
let pomoIsRunning = false;
let pomoActive = false; // Whether the widget is open
let pomoMode = 'focus'; // focus | break

// Stretch State
let stretchTimerId = null;
let isStretching = false;

// Custom notes persistence
let pinnedMessage = "";

// Idle state (sleeping)
let lastActivityTime = Date.now();
let isSleeping = false;
const sleepTimeout = 40000; // 40 seconds of mouse inactivity inside window makes the cat sleep

// --- RANDOM PHRASES ---
const randomPhrases = [
  "meow! 🐾",
  "purr... 😸",
  "go walk! 🚶",
  "stand up! 🧘",
  "take a break! ☕",
  "drink water! 💧",
  "feed me! 🐟",
  "pet me! 👋",
  "coding time! 💻",
  "focus! 🎯",
  "rawr! 🦁",
  "u got this! ✨",
  "relax your shoulders! 🧘",
  "blink your eyes! 👀",
  "stretching is good! 🤸"
];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  // Load saved fur pattern
  const savedFur = localStorage.getItem('bekkku-fur') || 'orange';
  setFurPattern(savedFur);

  // Load saved note
  const savedNote = localStorage.getItem('bekkku-note') || '';
  if (savedNote) {
    pinnedNoteInput.value = savedNote;
    pinnedMessage = savedNote;
  }

  // Load stretch intervals
  const savedStretch = localStorage.getItem('bekkku-stretch') || '60';
  stretchIntervalSelect.value = savedStretch;
  setupStretchBreak(savedStretch);

  // Render initial positions
  updateCatElementPos();
  setCatState('breathe');

  // Initialize keyboard kneading gym
  initGym();

  // Start smooth physics update loop
  requestAnimationFrame(physicsLoop);
});

// --- ELECTRON IPC TRAY INTEGRATION ---
if (window.electronAPI) {
  window.electronAPI.onToggleSettings(() => {
    toggleDrawer();
  });

  // Listen to global mouse events from the main process
  window.electronAPI.onGlobalMouse((data) => {
    // Initialize window coordinates on startup
    if (currentWinX === 0 && currentWinY === 0) {
      currentWinX = data.winX;
      currentWinY = data.winY;
    }

    const newMx = data.mx;
    const newMy = data.my;

    // Track mouse activity globally
    if (newMx !== lastGlobalMx || newMy !== lastGlobalMy) {
      lastActivityTime = Date.now();
      mx = newMx;
      my = newMy;
      lastGlobalMx = newMx;
      lastGlobalMy = newMy;
      if (isSleeping) wakeUp();
    }

    // Mathematical Click-Through Evaluation
    let isOverInteractive = false;
    if (isDrawerOpen) {
      isOverInteractive = true;
    } else {
      const localX = mx - currentWinX;
      const localY = my - currentWinY;

      // Check if cursor is over the cat box (128x128)
      if (localX >= catX && localX <= catX + 128 && localY >= catY && localY <= catY + 128) {
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
      if (!isDragging) {
        window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
      }
    }

    // Smoothly calculate pupil offsets
    updateEyeFollow(mx, my);
  });
}

// --- SMOOTH 60HZ UPDATE & PHYSICS LOOP ---
function physicsLoop() {
  updateCatElementPos();

  if (isDragging) {
    requestAnimationFrame(physicsLoop);
    return;
  }

  // Handle Zoomies movement
  if (isZooming) {
    const wdx = targetWinX - currentWinX;
    const wdy = targetWinY - currentWinY;
    const dist = Math.hypot(wdx, wdy);

    if (dist > 15) {
      currentWinX += wdx * zoomSpeed;
      currentWinY += wdy * zoomSpeed;

      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const currentWinWidth = pomoActive ? 240 : 160;

      currentWinX = Math.max(0, Math.min(screenWidth - currentWinWidth, currentWinX));
      currentWinY = Math.max(0, Math.min(screenHeight - 220, currentWinY));

      if (window.electronAPI) {
        window.electronAPI.moveWindow(currentWinX, currentWinY);
      }

      // Flip Sprite depending on direction of travel
      if (wdx < -2) {
        catContainer.style.transform = 'scaleX(-1)';
      } else if (wdx > 2) {
        catContainer.style.transform = 'scaleX(1)';
      }

      setCatState('walk');
    } else {
      isZooming = false;
      setCatState('breathe');
      hideSpeech();
    }
  }

  // System Idle Check
  if (Date.now() - lastActivityTime > sleepTimeout) {
    goToSleep();
  }

  requestAnimationFrame(physicsLoop);
}

function updateCatElementPos() {
  catContainer.style.left = `${catX}px`;
  catContainer.style.top = `${catY}px`;

  // Center speech bubble above the cat
  if (!speechBubble.classList.contains('hidden')) {
    const bubbleWidth = speechBubble.offsetWidth || 100;
    const offsetTop = isStretching ? -120 : -50;
    speechBubble.style.left = `${catX + 64 - bubbleWidth / 2}px`;
    speechBubble.style.top = `${catY + offsetTop}px`;
  }

  // Position Pomodoro widget to the left of the cat
  if (!pomoWidget.classList.contains('hidden')) {
    pomoWidget.style.left = `${catX - 85}px`;
    pomoWidget.style.top = `${catY + 50}px`;
  }
}

// --- DYNAMIC EYE-FOLLOWING ---
function updateEyeFollow(mx, my) {
  if (isSleeping) return;

  const leftPupil = document.querySelector('.cat-eye-left .pupil');
  const rightPupil = document.querySelector('.cat-eye-right .pupil');
  if (!leftPupil || !rightPupil) return;

  // Center of cat face in screen space
  const faceX = currentWinX + catX + (128 * 11 / 32);
  const faceY = currentWinY + catY + (128 * 13 / 32);

  const dx = mx - faceX;
  const dy = my - faceY;
  const dist = Math.hypot(dx, dy);

  let tx = 0;
  let ty = 0;

  if (dist > 5) {
    tx = (dx / dist) * 0.7;
    ty = (dy / dist) * 0.7;
  }

  leftPupil.style.transform = `translate(${tx}px, ${ty}px)`;
  rightPupil.style.transform = `translate(${tx}px, ${ty}px)`;

  // Rotate / tilt head slightly towards mouse
  const head = document.querySelector('.cat-head');
  if (head && dist > 15) {
    const angle = Math.max(-8, Math.min(8, (dx / dist) * 8));
    head.style.transform = `rotate(${angle}deg)`;
  }
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
  if (isDragging || e.button !== 0) return;

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
  if (pinnedMessage) {
    showSpeech(`Reminder: ${pinnedMessage}`, 6000); // Show pinned note for 6 seconds
  } else {
    const phrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    showSpeech(phrase, 4000);
  }
}

catContainer.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left click
    isDragging = true;
    startScreenX = e.screenX;
    startScreenY = e.screenY;

    // Set stretch / drag visual representation
    catContainer.classList.add('cat-drag');
    if (window.electronAPI) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  }
});

window.addEventListener('mousemove', (e) => {
  if (isDragging && window.electronAPI) {
    const dx = e.screenX - startScreenX;
    const dy = e.screenY - startScreenY;

    startScreenX = e.screenX;
    startScreenY = e.screenY;

    // Update local variables
    currentWinX += dx;
    currentWinY += dy;

    // Request window move from Electron
    window.electronAPI.dragWindow(dx, dy);
  }
});

window.addEventListener('mouseup', () => {
  if (isDragging) {
    isDragging = false;
    catContainer.classList.remove('cat-drag');
    setCatState('breathe');
  }
});

// --- RANDOM BEHAVIORS TIMERS ---
// Trigger zoomies (runs for a bit)
function triggerZoomies() {
  if (isZooming || isDragging || isStretching || isSleeping || isDrawerOpen) return;
  isZooming = true;

  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Choose random coordinates on screen
  targetWinX = Math.max(50, Math.floor(Math.random() * (screenWidth - 250)));
  targetWinY = Math.max(50, Math.floor(Math.random() * (screenHeight - 250)));

  showSpeech("ZOOMIES! ⚡", 2500);

  if (zoomTimer) clearTimeout(zoomTimer);
  zoomTimer = setTimeout(() => {
    isZooming = false;
    setCatState('breathe');
    hideSpeech();
  }, 3500);
}

// Roll for random behavior every 15 seconds to make it more active!
setInterval(() => {
  if (isDragging || isStretching || isSleeping || isDrawerOpen || pomoIsRunning || isZooming) return;

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
function setCatState(state) {
  catContainer.classList.remove('cat-breathe', 'cat-walk', 'cat-knead', 'cat-sleep', 'cat-overheat', 'cat-thinking');

  if (state === 'breathe') {
    catContainer.classList.add('cat-breathe');
  } else if (state === 'walk') {
    catContainer.classList.add('cat-walk');
  } else if (state === 'knead') {
    catContainer.classList.add('cat-knead');
  } else if (state === 'sleep') {
    catContainer.classList.add('cat-sleep');
  } else if (state === 'overheat') {
    catContainer.classList.add('cat-knead', 'cat-overheat');
  } else if (state === 'thinking') {
    catContainer.classList.add('cat-thinking');
  }
}

// --- SLEEP SEQUENCES ---
function goToSleep() {
  if (isSleeping) return;
  isSleeping = true;
  setCatState('sleep');
  showSpeech('Zzz... 💤', 0);
}

function wakeUp() {
  if (!isSleeping) return;
  isSleeping = false;
  setCatState('breathe');
  hideSpeech();
}

// --- SPEECH BUBBLE CONTROL ---
let speechTimer = null;
function showSpeech(text, durationMs = 3000) {
  if (speechTimer) clearTimeout(speechTimer);

  bubbleText.innerText = text;
  speechBubble.classList.remove('hidden');

  if (durationMs > 0) {
    speechTimer = setTimeout(() => {
      hideSpeech();
    }, durationMs);
  }
}

function resetHeadTilt() {
  const head = document.querySelector('.cat-head');
  if (head) head.style.transform = 'rotate(0deg)';
}

function hideSpeech() {
  speechBubble.classList.add('hidden');
}

// --- CONSOLE/SETTINGS DRAWER CONTROL ---
function toggleDrawer() {
  isDrawerOpen = !isDrawerOpen;

  if (window.electronAPI) {
    if (isDrawerOpen) {
      const currentCatX = pomoActive ? 96 : 16;
      const newWinX = currentWinX - (320 - currentCatX);
      const newWinY = currentWinY - 240;

      window.electronAPI.moveWindow(newWinX, newWinY);
      window.electronAPI.resizeWindow(460, 480);

      currentWinX = newWinX;
      currentWinY = newWinY;
      catX = 320;
      catY = 320;

      settingsDrawer.classList.remove('drawer-closed');
      settingsDrawer.classList.add('drawer-open');
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      const targetWinWidth = pomoActive ? 240 : 160;
      const targetCatX = pomoActive ? 96 : 16;

      const newWinX = currentWinX + (320 - targetCatX);
      const newWinY = currentWinY + 240;

      window.electronAPI.resizeWindow(targetWinWidth, 220);
      window.electronAPI.moveWindow(newWinX, newWinY);

      currentWinX = newWinX;
      currentWinY = newWinY;
      catX = targetCatX;
      catY = 80;

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
function setFurPattern(furType) {
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

// --- PINNING NOTES ---
pinNoteBtn.addEventListener('click', () => {
  const note = pinnedNoteInput.value.trim();
  pinnedMessage = note;
  localStorage.setItem('bekkku-note', note);

  if (note) {
    showSpeech(`Pinned: ${note}`, 3000);
  } else {
    hideSpeech();
  }
});

// --- POMODORO TIMER ---
function updatePomoDisplay() {
  const mins = Math.floor(pomoSecondsLeft / 60);
  const secs = pomoSecondsLeft % 60;
  pomoTime.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startPomo() {
  pomoIsRunning = true;
  pomoActive = true;
  pomoToggleBtn.innerText = 'PAUSE';
  pomoToggleBtn.classList.remove('btn-green');
  pomoToggleBtn.classList.add('btn-pixel');
  pomoWidget.classList.remove('hidden');

  if (window.electronAPI && !isDrawerOpen) {
    const newWinX = currentWinX - 80;
    window.electronAPI.moveWindow(newWinX, currentWinY);
    window.electronAPI.resizeWindow(240, 220);
    currentWinX = newWinX;
    catX = 96;
    updateCatElementPos();
  }

  showSpeech(pomoMode === 'focus' ? "Time to focus! 🍅" : "Take a break! ☕", 3000);

  pomoTimerId = setInterval(() => {
    if (pomoSecondsLeft > 0) {
      pomoSecondsLeft--;
      updatePomoDisplay();
    } else {
      clearInterval(pomoTimerId);
      if (pomoMode === 'focus') {
        pomoMode = 'break';
        pomoSecondsLeft = 5 * 60;
        triggerJumpReaction();
        showSpeech("Break time! Take 5 mins 🍅", 5000);
      } else {
        pomoMode = 'focus';
        pomoSecondsLeft = 25 * 60;
        triggerJumpReaction();
        showSpeech("Break over! Let's focus! 🍅", 5000);
      }
      startPomo();
    }
  }, 1000);
}

function pausePomo() {
  pomoIsRunning = false;
  pomoToggleBtn.innerText = 'START';
  pomoToggleBtn.classList.remove('btn-pixel');
  pomoToggleBtn.classList.add('btn-green');
  clearInterval(pomoTimerId);
}

pomoToggleBtn.addEventListener('click', () => {
  if (pomoIsRunning) {
    pausePomo();
  } else {
    startPomo();
  }
});

pomoResetBtn.addEventListener('click', () => {
  pausePomo();
  pomoActive = false;
  pomoMode = 'focus';
  pomoSecondsLeft = 25 * 60;
  updatePomoDisplay();
  pomoWidget.classList.add('hidden');
  hideSpeech();

  if (window.electronAPI && !isDrawerOpen) {
    const newWinX = currentWinX + 80;
    window.electronAPI.resizeWindow(160, 220);
    window.electronAPI.moveWindow(newWinX, currentWinY);
    currentWinX = newWinX;
    catX = 16;
    updateCatElementPos();
  }
});

// --- STRETCH REMINDERS ---
function setupStretchBreak(intervalMins) {
  if (stretchTimerId) clearInterval(stretchTimerId);
  localStorage.setItem('bekkku-stretch', intervalMins);

  if (intervalMins === 'off') return;

  const intervalMs = parseInt(intervalMins) * 60 * 1000;
  stretchTimerId = setInterval(() => {
    triggerStretchBreak();
  }, intervalMs);
}

stretchIntervalSelect.addEventListener('change', (e) => {
  setupStretchBreak(e.target.value);
});

function triggerStretchBreak() {
  if (isStretching) return;
  isStretching = true;

  catContainer.style.transform = 'scale(2.5)';
  showSpeech("Time to stretch! Stand up! 🧘", 15000);

  setTimeout(() => {
    catContainer.style.transform = 'scale(1)';
    isStretching = false;
    hideSpeech();
  }, 15000);
}

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

function triggerJumpReaction() {
  catContainer.classList.add('cat-jump');
  showSpeech("YEAH ! 🎉", 3000);

  setTimeout(() => {
    catContainer.classList.remove('cat-jump');
    hideSpeech();
  }, 800);
}

aiDoneBtn.addEventListener('click', triggerJumpReaction);

// --- KEYBOARD KNEADING GYM (MONKEYTYPE STYLE) ---
const typingWordsList = [
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you",
  "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one",
  "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year", "your",
  "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over",
  "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new",
  "want", "because", "any", "these", "give", "day", "most", "us", "is", "are", "was", "were", "been", "has", "had",
  "write", "go", "see", "make", "find", "keep", "take", "show", "build", "run", "clean", "speed", "test", "cat",
  "knead", "paw", "purr", "sleep", "warm", "feline", "meow", "yarn", "milk", "fish", "mouse", "climb", "jump",
  "scratch", "stretch", "orange", "calico", "tuxedo", "siamese", "midnight", "ghost", "code", "developer", "terminal",
  "console", "pixel", "retro", "focus", "pomo", "timer", "break", "work", "gym", "keyboard", "wpm", "accuracy",
  "complete", "result", "restart", "score", "active", "style"
];

let gymState = {
  mode: 'time', // 'time' | 'words'
  timeLimit: 30, // 15 | 30 | 60
  wordLimit: 25, // 10 | 25 | 50
  active: false,
  startTime: null,
  timerId: null,
  timeLeft: 30,
  words: [],
  activeWordIndex: 0,
  activeCharIndex: 0,
  correctChars: 0,
  typedChars: 0,
  errorCount: 0
};

function initGym() {
  // Config Mode Toggles
  configModeTime.addEventListener('click', () => {
    if (gymState.mode === 'time') return;
    gymState.mode = 'time';
    configModeTime.classList.add('active');
    configModeWords.classList.remove('active');
    renderConfigOptions();
    restartGym();
  });

  configModeWords.addEventListener('click', () => {
    if (gymState.mode === 'words') return;
    gymState.mode = 'words';
    configModeWords.classList.add('active');
    configModeTime.classList.remove('active');
    renderConfigOptions();
    restartGym();
  });

  // Focus overlay handling
  gymWrapper.addEventListener('click', () => {
    if (!gymResults.classList.contains('hidden')) return;
    gymHiddenInput.focus();
  });

  gymHiddenInput.addEventListener('focus', () => {
    gymFocusOverlay.classList.add('hidden');
    updateCaretPosition();
  });

  gymHiddenInput.addEventListener('blur', () => {
    if (!gymResults.classList.contains('hidden')) return;
    gymFocusOverlay.classList.remove('hidden');
  });

  gymHiddenInput.addEventListener('keydown', handleGymKeydown);

  // Restart buttons
  gymRestartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restartGym();
    gymHiddenInput.focus();
  });

  resultsRestartBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restartGym();
    gymHiddenInput.focus();
  });

  // Render sub-options
  renderConfigOptions();
  restartGym();
}

function renderConfigOptions() {
  gymConfigOptions.innerHTML = '';

  if (gymState.mode === 'time') {
    const times = [15, 30, 60];
    times.forEach(t => {
      const opt = document.createElement('span');
      opt.className = 'config-opt' + (gymState.timeLimit === t ? ' active' : '');
      opt.innerText = t + 's';
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        gymState.timeLimit = t;
        renderConfigOptions();
        restartGym();
        gymHiddenInput.focus();
      });
      gymConfigOptions.appendChild(opt);
    });
    document.getElementById('gym-timer-container').style.display = 'flex';
  } else {
    const counts = [10, 25, 50];
    counts.forEach(c => {
      const opt = document.createElement('span');
      opt.className = 'config-opt' + (gymState.wordLimit === c ? ' active' : '');
      opt.innerText = c;
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        gymState.wordLimit = c;
        renderConfigOptions();
        restartGym();
        gymHiddenInput.focus();
      });
      gymConfigOptions.appendChild(opt);
    });
  }
}

function generateWords() {
  const count = gymState.mode === 'words' ? gymState.wordLimit : 50;
  gymState.words = [];
  for (let i = 0; i < count; i++) {
    const randIdx = Math.floor(Math.random() * typingWordsList.length);
    gymState.words.push(typingWordsList[randIdx]);
  }
}

function appendMoreWords(count = 30) {
  const startIndex = gymState.words.length;
  const newWords = [];
  for (let i = 0; i < count; i++) {
    const randIdx = Math.floor(Math.random() * typingWordsList.length);
    newWords.push(typingWordsList[randIdx]);
  }
  gymState.words = gymState.words.concat(newWords);

  newWords.forEach((wordText, i) => {
    const wordIndex = startIndex + i;
    const wordEl = document.createElement('div');
    wordEl.className = 'word';
    wordEl.dataset.wordIndex = wordIndex;

    for (let j = 0; j < wordText.length; j++) {
      const letterEl = document.createElement('span');
      letterEl.className = 'letter';
      letterEl.dataset.charIndex = j;
      letterEl.innerText = wordText[j];
      wordEl.appendChild(letterEl);
    }
    gymWordsList.appendChild(wordEl);
  });
}

function renderWords() {
  // Remove existing words
  gymWordsList.querySelectorAll('.word').forEach(el => el.remove());

  gymState.words.forEach((wordText, i) => {
    const wordEl = document.createElement('div');
    wordEl.className = 'word' + (i === 0 ? ' active' : '');
    wordEl.dataset.wordIndex = i;

    for (let j = 0; j < wordText.length; j++) {
      const letterEl = document.createElement('span');
      letterEl.className = 'letter';
      letterEl.dataset.charIndex = j;
      letterEl.innerText = wordText[j];
      wordEl.appendChild(letterEl);
    }
    gymWordsList.appendChild(wordEl);
  });

  gymState.activeWordIndex = 0;
  gymState.activeCharIndex = 0;

  // Reset scroll
  gymWordsContainer.scrollTop = 0;

  // Update Caret
  setTimeout(updateCaretPosition, 10);
}

function updateCaretPosition() {
  const activeWordEl = gymWordsList.querySelector('.word.active');
  if (!activeWordEl) return;

  const letters = activeWordEl.querySelectorAll('.letter');

  gymCaret.classList.add('typing');
  if (window.caretBlinkTimeout) clearTimeout(window.caretBlinkTimeout);
  window.caretBlinkTimeout = setTimeout(() => {
    gymCaret.classList.remove('typing');
  }, 500);

  if (gymState.activeCharIndex < letters.length) {
    const activeLetter = letters[gymState.activeCharIndex];
    gymCaret.style.left = `${activeWordEl.offsetLeft + activeLetter.offsetLeft}px`;
    gymCaret.style.top = `${activeWordEl.offsetTop + activeLetter.offsetTop}px`;
    gymCaret.style.height = `${activeLetter.offsetHeight}px`;
  } else {
    const lastLetter = letters[letters.length - 1];
    if (lastLetter) {
      gymCaret.style.left = `${activeWordEl.offsetLeft + lastLetter.offsetLeft + lastLetter.offsetWidth}px`;
      gymCaret.style.top = `${activeWordEl.offsetTop + lastLetter.offsetTop}px`;
      gymCaret.style.height = `${lastLetter.offsetHeight}px`;
    }
  }
}

function scrollWordsContainer() {
  const activeWordEl = gymWordsList.querySelector('.word.active');
  if (!activeWordEl) return;

  const wordTop = activeWordEl.offsetTop;

  if (wordTop > 24) {
    gymWordsContainer.scrollTo({ top: wordTop - 4, behavior: 'smooth' });
  } else {
    gymWordsContainer.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function startGymTest() {
  if (gymState.active) return;
  gymState.active = true;
  gymState.startTime = Date.now();
  gymState.correctChars = 0;
  gymState.typedChars = 0;
  gymState.errorCount = 0;

  if (gymState.mode === 'time') {
    gymState.timeLeft = gymState.timeLimit;
    gymTimerVal.innerText = gymState.timeLeft + 's';

    gymState.timerId = setInterval(() => {
      gymState.timeLeft--;
      gymTimerVal.innerText = gymState.timeLeft + 's';

      updateLiveStats();

      if (gymState.timeLeft <= 0) {
        endGymTest();
      }
    }, 1000);
  } else {
    gymState.timeLeft = 0;
    gymTimerVal.innerText = '0s';

    gymState.timerId = setInterval(() => {
      gymState.timeLeft++;
      gymTimerVal.innerText = gymState.timeLeft + 's';

      updateLiveStats();
    }, 1000);
  }
}

function updateLiveStats() {
  if (!gymState.startTime) return;

  const elapsedSecs = (Date.now() - gymState.startTime) / 1000;
  const elapsedMins = elapsedSecs / 60;

  let wpm = 0;
  if (elapsedMins > 0) {
    wpm = Math.round((gymState.correctChars / 5) / elapsedMins);
  }

  let acc = 100;
  if (gymState.typedChars > 0) {
    acc = Math.round((gymState.correctChars / gymState.typedChars) * 100);
  }

  gymWpmVal.innerText = wpm.toString();
  gymAccVal.innerText = acc + '%';

  if (wpm > 0) {
    if (wpm > 60) {
      setCatState('overheat');
      kneadStatus.innerText = 'OVERHEAT 🔥';
      if (Math.random() < 0.15) showSpeech("Too fast! 🔥", 1500);
    } else {
      setCatState('knead');
      kneadStatus.innerText = 'KNEADING 🐾';
    }
  }

  if (window.gymTypingTimeout) clearTimeout(window.gymTypingTimeout);
  window.gymTypingTimeout = setTimeout(() => {
    if (gymState.active) {
      setCatState('knead');
      kneadStatus.innerText = 'WAITING 🐾';
    } else {
      setCatState('breathe');
      kneadStatus.innerText = 'IDLE';
    }
  }, 1500);
}

function endGymTest() {
  if (gymState.timerId) clearInterval(gymState.timerId);
  gymState.active = false;

  const elapsedSecs = gymState.mode === 'time' ? gymState.timeLimit : (Date.now() - gymState.startTime) / 1000;
  const elapsedMins = elapsedSecs / 60;

  let wpm = Math.round((gymState.correctChars / 5) / (elapsedMins || 0.01));
  let acc = gymState.typedChars > 0 ? Math.round((gymState.correctChars / gymState.typedChars) * 100) : 100;

  resultsWpm.innerText = wpm.toString();
  resultsAcc.innerText = acc + '%';
  resultsTime.innerText = Math.round(elapsedSecs) + 's';

  gymResults.classList.remove('hidden');

  setCatState('breathe');
  kneadStatus.innerText = 'IDLE';

  if (wpm > 75) {
    showSpeech(`WPM: ${wpm}! Godlike kneading! 🐾⚡`, 5000);
    triggerJumpReaction();
  } else if (wpm > 45) {
    showSpeech(`WPM: ${wpm}! Great kneading! 🐾`, 4000);
    triggerJumpReaction();
  } else {
    showSpeech(`WPM: ${wpm}! Nice practice! 🐾`, 4000);
  }
}

function restartGym() {
  if (gymState.timerId) clearInterval(gymState.timerId);

  gymState.active = false;
  gymState.startTime = null;
  gymState.timeLeft = gymState.mode === 'time' ? gymState.timeLimit : 0;
  gymState.correctChars = 0;
  gymState.typedChars = 0;
  gymState.errorCount = 0;

  gymWpmVal.innerText = '0';
  gymAccVal.innerText = '100%';
  gymTimerVal.innerText = gymState.mode === 'time' ? gymState.timeLimit + 's' : '0s';
  kneadStatus.innerText = 'IDLE';

  gymResults.classList.add('hidden');
  gymHiddenInput.value = '';

  generateWords();
  renderWords();

  if (document.activeElement === gymHiddenInput) {
    gymFocusOverlay.classList.add('hidden');
  } else {
    gymFocusOverlay.classList.remove('hidden');
  }
}

function handleGymKeydown(e) {
  if (e.key === ' ' || e.key === 'Tab' || e.key === 'Escape' || (e.key === 'Backspace' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
  }

  if (e.key === 'Tab' || e.key === 'Escape') {
    restartGym();
    gymHiddenInput.focus();
    return;
  }

  if (!gymResults.classList.contains('hidden')) return;

  lastActivityTime = Date.now();
  if (isSleeping) wakeUp();

  if (e.key === 'Backspace') {
    handleGymBackspace(e.ctrlKey || e.metaKey);
    return;
  }

  if (e.key === ' ') {
    handleGymSpace();
    return;
  }

  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    handleGymChar(e.key);
  }
}

function handleGymChar(char) {
  if (!gymState.active) {
    startGymTest();
  }

  const activeWordEl = gymWordsList.querySelector('.word.active');
  if (!activeWordEl) return;

  const wordText = gymState.words[gymState.activeWordIndex];
  const letters = activeWordEl.querySelectorAll('.letter');

  gymState.typedChars++;

  if (gymState.activeCharIndex < wordText.length) {
    const letterEl = letters[gymState.activeCharIndex];
    const expected = wordText[gymState.activeCharIndex];

    if (char === expected) {
      letterEl.classList.add('correct');
      gymState.correctChars++;
    } else {
      letterEl.classList.add('incorrect');
      gymState.errorCount++;
    }
    gymState.activeCharIndex++;
  } else {
    if (gymState.activeCharIndex - wordText.length < 8) {
      const extraLetter = document.createElement('span');
      extraLetter.className = 'letter extra incorrect';
      extraLetter.innerText = char;
      activeWordEl.appendChild(extraLetter);
      gymState.activeCharIndex++;
      gymState.errorCount++;
    }
  }

  updateCaretPosition();
  updateLiveStats();
}

function handleGymBackspace(ctrlPressed) {
  const activeWordEl = gymWordsList.querySelector('.word.active');
  if (!activeWordEl) return;

  const wordText = gymState.words[gymState.activeWordIndex];
  const letters = activeWordEl.querySelectorAll('.letter');

  if (ctrlPressed) {
    while (gymState.activeCharIndex > 0) {
      gymState.activeCharIndex--;
      const letterEl = letters[gymState.activeCharIndex];
      if (letterEl) {
        if (letterEl.classList.contains('extra')) {
          letterEl.remove();
        } else {
          if (letterEl.classList.contains('correct')) {
            gymState.correctChars = Math.max(0, gymState.correctChars - 1);
          }
          letterEl.classList.remove('correct', 'incorrect');
        }
      }
    }
    updateCaretPosition();
    updateLiveStats();
    return;
  }

  if (gymState.activeCharIndex > 0) {
    gymState.activeCharIndex--;
    const letterEl = letters[gymState.activeCharIndex];
    if (letterEl) {
      if (letterEl.classList.contains('extra')) {
        letterEl.remove();
      } else {
        if (letterEl.classList.contains('correct')) {
          gymState.correctChars = Math.max(0, gymState.correctChars - 1);
        }
        letterEl.classList.remove('correct', 'incorrect');
      }
    }
  } else {
    if (gymState.activeWordIndex > 0) {
      activeWordEl.classList.remove('active');
      gymState.activeWordIndex--;

      const prevWordEl = gymWordsList.querySelector(`.word[data-word-index="${gymState.activeWordIndex}"]`);
      prevWordEl.classList.add('active');

      const prevLetters = prevWordEl.querySelectorAll('.letter');
      gymState.activeCharIndex = prevLetters.length;

      gymState.activeCharIndex--;
      const letterEl = prevLetters[gymState.activeCharIndex];
      if (letterEl) {
        if (letterEl.classList.contains('extra')) {
          letterEl.remove();
        } else {
          if (letterEl.classList.contains('correct')) {
            gymState.correctChars = Math.max(0, gymState.correctChars - 1);
          }
          letterEl.classList.remove('correct', 'incorrect');
        }
      }

      scrollWordsContainer();
    }
  }

  updateCaretPosition();
  updateLiveStats();
}

function handleGymSpace() {
  const activeWordEl = gymWordsList.querySelector('.word.active');
  if (!activeWordEl) return;

  const wordText = gymState.words[gymState.activeWordIndex];

  if (gymState.activeCharIndex === 0) return;

  const letters = activeWordEl.querySelectorAll('.letter');
  let hasError = false;

  letters.forEach((letterEl) => {
    if (!letterEl.classList.contains('extra')) {
      if (!letterEl.classList.contains('correct') && !letterEl.classList.contains('incorrect')) {
        letterEl.classList.add('incorrect');
        gymState.errorCount++;
        hasError = true;
      } else if (letterEl.classList.contains('incorrect')) {
        hasError = true;
      }
    } else {
      hasError = true;
    }
  });

  if (!hasError) {
    gymState.correctChars++;
    gymState.typedChars++;
  } else {
    activeWordEl.classList.add('error');
    gymState.typedChars++;
  }

  activeWordEl.classList.remove('active');
  gymState.activeWordIndex++;
  gymState.activeCharIndex = 0;

  if (gymState.activeWordIndex >= gymState.words.length) {
    endGymTest();
    return;
  }

  const nextWordEl = gymWordsList.querySelector(`.word[data-word-index="${gymState.activeWordIndex}"]`);
  if (nextWordEl) {
    nextWordEl.classList.add('active');
  }

  if (gymState.mode === 'time' && gymState.activeWordIndex >= gymState.words.length - 5) {
    appendMoreWords(30);
  }

  scrollWordsContainer();
  updateCaretPosition();
  updateLiveStats();
}
