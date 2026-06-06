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
const typingGymInput = document.getElementById('typing-gym-input');
const typingWpm = document.getElementById('typing-wpm');
const kneadStatus = document.getElementById('knead-status');
const resetPositionBtn = document.getElementById('reset-position-btn');

// --- APP STATE ---
// Coordinates relative to the window
let catX = 16; 
let catY = 80;

// Screen space window coordinates
let currentWinX = 0;
let currentWinY = 0;
let targetWinX = 0;
let targetWinY = 0;

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
const speedFactor = 0.07; // Smooth chasing easing

// Typing stats
let keyTimes = [];
let typingTimeout = null;

// Pomodoro State
let pomoTimerId = null;
let pomoSecondsLeft = 25 * 60;
let pomoIsRunning = false;
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
    showSpeech(savedNote, 0); // Pin indefinitely
  }

  // Load stretch intervals
  const savedStretch = localStorage.getItem('bekkku-stretch') || '60';
  stretchIntervalSelect.value = savedStretch;
  setupStretchBreak(savedStretch);

  // Render initial positions
  updateCatElementPos();
  setCatState('breathe');

  // Start smooth physics loop
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
      targetWinX = data.winX;
      targetWinY = data.winY;
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
      // If configurations are open, keep window completely interactive
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

// --- SMOOTH 60HZ PHYSICS LOOP ---
function physicsLoop() {
  if (isDragging) {
    targetWinX = currentWinX;
    targetWinY = currentWinY;
    requestAnimationFrame(physicsLoop);
    return;
  }

  if (isStretching || isSleeping || isDrawerOpen) {
    // Do not chase cursor when settings drawer is open, stretching, or sleeping
    updateCatElementPos();
    requestAnimationFrame(physicsLoop);
    return;
  }

  // System Idle Check
  if (Date.now() - lastActivityTime > sleepTimeout) {
    goToSleep();
  }

  // Screen space distance from cat center to cursor
  const cx = currentWinX + catX + 64;
  const cy = currentWinY + catY + 64;

  const dx = mx - cx;
  const dy = my - cy;
  const dist = Math.hypot(dx, dy);

  if (dist > 85) {
    // Calculate new target window coordinates so cat center tracks the mouse
    targetWinX = mx - catX - 64;
    targetWinY = my - catY - 100;

    // Linearly interpolate window positions for 60Hz movement
    const wdx = targetWinX - currentWinX;
    const wdy = targetWinY - currentWinY;

    currentWinX += wdx * speedFactor;
    currentWinY += wdy * speedFactor;

    // Clamp window to desktop borders
    const screenWidth = window.screen.width;
    const screenHeight = window.screen.height;
    currentWinX = Math.max(0, Math.min(screenWidth - 160, currentWinX));
    currentWinY = Math.max(0, Math.min(screenHeight - 220, currentWinY));

    if (window.electronAPI) {
      window.electronAPI.moveWindow(currentWinX, currentWinY);
    }

    // Flip Sprite depending on direction
    if (dx < -2) {
      catContainer.style.transform = 'scaleX(-1)';
    } else if (dx > 2) {
      catContainer.style.transform = 'scaleX(1)';
    }

    setCatState('walk');
  } else {
    // Close enough -> Idle breathe
    setCatState('breathe');
  }

  updateCatElementPos();
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
    // Map pupil translations within a tiny grid (-0.7px to 0.7px)
    tx = (dx / dist) * 0.7;
    ty = (dy / dist) * 0.7;
  }

  leftPupil.style.transform = `translate(${tx}px, ${ty}px)`;
  rightPupil.style.transform = `translate(${tx}px, ${ty}px)`;
}

// --- MOCHI WINDOW DRAGGING & INTERACTIONS ---
// Double-click cat to toggle console drawer
catContainer.addEventListener('dblclick', (e) => {
  toggleDrawer();
});

// Right-click cat to toggle console drawer
catContainer.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  toggleDrawer();
});

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
    
    // Return to breathing
    setCatState('breathe');
  }
});

// --- CAT ANIMATION STATES MANAGER ---
function setCatState(state) {
  // Clear other visual classes
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
  
  if (pinnedMessage) {
    showSpeech(pinnedMessage, 0);
  } else {
    hideSpeech();
  }
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

function hideSpeech() {
  // If we have a pinned custom note, restore it instead of hiding
  if (pinnedMessage && !isSleeping && !isStretching) {
    bubbleText.innerText = pinnedMessage;
    speechBubble.classList.remove('hidden');
  } else {
    speechBubble.classList.add('hidden');
  }
}

// --- CONSOLE/SETTINGS DRAWER CONTROL ---
function toggleDrawer() {
  isDrawerOpen = !isDrawerOpen;
  
  if (window.electronAPI) {
    if (isDrawerOpen) {
      // Resize to open dashboard
      // Horizontal shift: newX = currentWinX - 219 (anchors cat X position)
      // Vertical shift: newY = currentWinY - 130 (anchors cat Y position)
      const newWinX = currentWinX - 219;
      const newWinY = currentWinY - 130;
      
      window.electronAPI.moveWindow(newWinX, newWinY);
      window.electronAPI.resizeWindow(380, 360);
      
      currentWinX = newWinX;
      currentWinY = newWinY;
      catX = 235;
      catY = 210;

      settingsDrawer.classList.remove('drawer-closed');
      settingsDrawer.classList.add('drawer-open');
      
      // Let console drawer receive clicks naturally
      window.electronAPI.setIgnoreMouseEvents(false);
    } else {
      // Resize to compact viewport (only the cat)
      // Horizontal shift: newX = currentWinX + 219
      // Vertical shift: newY = currentWinY + 130
      const newWinX = currentWinX + 219;
      const newWinY = currentWinY + 130;
      
      window.electronAPI.resizeWindow(160, 220);
      window.electronAPI.moveWindow(newWinX, newWinY);
      
      currentWinX = newWinX;
      currentWinY = newWinY;
      catX = 16;
      catY = 80;

      settingsDrawer.classList.remove('drawer-open');
      settingsDrawer.classList.add('drawer-closed');
    }
    
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
    showSpeech(note, 0); 
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
  pomoToggleBtn.innerText = 'PAUSE';
  pomoToggleBtn.classList.remove('btn-green');
  pomoToggleBtn.classList.add('btn-pixel'); 
  pomoWidget.classList.remove('hidden');

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
  pomoMode = 'focus';
  pomoSecondsLeft = 25 * 60;
  updatePomoDisplay();
  pomoWidget.classList.add('hidden');
  hideSpeech();
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
  showSpeech("Task Done! 🎉", 3000);
  
  setTimeout(() => {
    catContainer.classList.remove('cat-jump');
    hideSpeech();
  }, 800);
}

aiDoneBtn.addEventListener('click', triggerJumpReaction);

// --- KEYBOARD KNEADING GYM ---
typingGymInput.addEventListener('input', (e) => {
  lastActivityTime = Date.now();
  if (isSleeping) wakeUp();

  const now = Date.now();
  keyTimes.push(now);

  keyTimes = keyTimes.filter(t => now - t < 5000);

  const keysPerSec = keyTimes.length / 5;
  const wpm = Math.round((keysPerSec * 60) / 5);
  typingWpm.innerText = wpm.toString();

  if (wpm > 0) {
    if (wpm > 60) {
      setCatState('overheat');
      kneadStatus.innerText = 'OVERHEAT 🔥';
      showSpeech("Too fast! 🔥", 2000);
    } else {
      setCatState('knead');
      kneadStatus.innerText = 'KNEADING 🐾';
    }
  }

  if (typingTimeout) clearTimeout(typingTimeout);
  
  typingTimeout = setTimeout(() => {
    setCatState('breathe');
    kneadStatus.innerText = 'IDLE';
    typingWpm.innerText = '0';
    keyTimes = [];
    hideSpeech();
  }, 1500); // Reverts back to normal after 1.5 seconds of no typing
});
