import { state } from './state.js';
import { zoomSpeed, sleepTimeout } from './config.js';
import { setCatState, hideSpeech, goToSleep, showSpeech } from './renderer.js';

export function initPhysics() {
  const catContainer = document.getElementById('cat-container');

  catContainer.addEventListener('pointerdown', (e) => {
    if (e.button === 0) { // Left click
      state.isDragging = true;
      state.startScreenX = e.screenX;
      state.startScreenY = e.screenY;

      // Set pointer capture to guarantee tracking mouse events even outside window
      try {
        catContainer.setPointerCapture(e.pointerId);
      } catch (err) {
        console.error('Failed to set pointer capture:', err);
      }

      // Set stretch / drag visual representation
      catContainer.classList.add('cat-drag');
      if (window.electronAPI) {
        window.electronAPI.setIgnoreMouseEvents(false);
      }
    }
  });

  catContainer.addEventListener('pointermove', (e) => {
    if (state.isDragging) {
      // Safety net: check if left mouse button is still pressed
      if ((e.buttons & 1) === 0) {
        endDrag(e);
        return;
      }

      const dx = Math.round(e.screenX - state.startScreenX);
      const dy = Math.round(e.screenY - state.startScreenY);

      if (dx !== 0 || dy !== 0) {
        state.startScreenX += dx;
        state.startScreenY += dy;

        // Update local variables in state
        state.currentWinX += dx;
        state.currentWinY += dy;

        // Request window move from Electron
        if (window.electronAPI) {
          window.electronAPI.dragWindow(dx, dy);
        }
      }
    }
  });

  catContainer.addEventListener('pointerup', (e) => {
    if (state.isDragging) {
      endDrag(e);
    }
  });

  catContainer.addEventListener('pointercancel', (e) => {
    if (state.isDragging) {
      endDrag(e);
    }
  });

  window.addEventListener('blur', () => {
    if (state.isDragging) {
      state.isDragging = false;
      catContainer.classList.remove('cat-drag');
      setCatState('breathe');
    }
  });

  function endDrag(e) {
    state.isDragging = false;
    catContainer.classList.remove('cat-drag');
    setCatState('breathe');
    try {
      catContainer.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if capture was already released
    }
  }
}

export function updateCatElementPos() {
  const catContainer = document.getElementById('cat-container');
  const speechBubble = document.getElementById('speech-bubble');
  const pomoWidget = document.getElementById('pomo-widget');

  catContainer.style.left = `${state.catX}px`;
  catContainer.style.top = `${state.catY}px`;

  // Center speech bubble above the cat
  if (!speechBubble.classList.contains('hidden')) {
    const bubbleWidth = speechBubble.offsetWidth || 100;
    const offsetTop = state.isStretching ? -120 : -50;
    speechBubble.style.left = `${state.catX + 64 - bubbleWidth / 2}px`;
    speechBubble.style.top = `${state.catY + offsetTop}px`;
  }

  // Position Pomodoro widget to the left of the cat
  if (!pomoWidget.classList.contains('hidden')) {
    pomoWidget.style.left = `${state.catX - 85}px`;
    pomoWidget.style.top = `${state.catY + 50}px`;
  }
}

export function updateEyeFollow(mx, my) {
  if (state.isSleeping) return;

  const activeStyle = localStorage.getItem('bekkku-style') || 'outlined';
  const activeSvgId = activeStyle === 'original' ? 'cat-svg-original' : 'cat-svg-outlined';
  const activeSvg = document.getElementById(activeSvgId);
  if (!activeSvg) return;

  const leftPupil = activeSvg.querySelector('.cat-eye-left .pupil');
  const rightPupil = activeSvg.querySelector('.cat-eye-right .pupil');
  if (!leftPupil || !rightPupil) return;

  // Center of cat face in screen space depending on chosen style
  const centerX = activeStyle === 'original' ? 11 : 15.5;
  const centerY = activeStyle === 'original' ? 13 : 14;

  const faceX = state.currentWinX + state.catX + (128 * centerX / 32);
  const faceY = state.currentWinY + state.catY + (128 * centerY / 32);

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
  const head = activeSvg.querySelector('.cat-head');
  if (head && dist > 15) {
    const angle = Math.max(-8, Math.min(8, (dx / dist) * 8));
    head.style.transform = `rotate(${angle}deg)`;
  }
}

export function physicsLoop() {
  updateCatElementPos();

  if (state.isDragging) {
    requestAnimationFrame(physicsLoop);
    return;
  }

  // Handle Zoomies movement
  if (state.isZooming) {
    const wdx = state.targetWinX - state.currentWinX;
    const wdy = state.targetWinY - state.currentWinY;
    const dist = Math.hypot(wdx, wdy);

    if (dist > 15) {
      state.currentWinX += wdx * zoomSpeed;
      state.currentWinY += wdy * zoomSpeed;

      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const currentWinWidth = state.pomoActive ? 240 : 160;

      state.currentWinX = Math.max(0, Math.min(screenWidth - currentWinWidth, state.currentWinX));
      state.currentWinY = Math.max(0, Math.min(screenHeight - 220, state.currentWinY));

      if (window.electronAPI) {
        window.electronAPI.moveWindow(state.currentWinX, state.currentWinY);
      }

      // Flip Sprite depending on direction of travel
      const catContainer = document.getElementById('cat-container');
      if (wdx < -2) {
        catContainer.style.transform = 'scaleX(-1)';
      } else if (wdx > 2) {
        catContainer.style.transform = 'scaleX(1)';
      }

      setCatState('walk');
    } else {
      state.isZooming = false;
      setCatState('breathe');
      hideSpeech();
    }
  }

  // System Idle Check
  if (Date.now() - state.lastActivityTime > sleepTimeout) {
    goToSleep();
  }

  requestAnimationFrame(physicsLoop);
}

export function triggerZoomies() {
  if (state.isZooming || state.isDragging || state.isStretching || state.isSleeping || state.isDrawerOpen) return;
  state.isZooming = true;

  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  // Choose random coordinates on screen
  state.targetWinX = Math.max(50, Math.floor(Math.random() * (screenWidth - 250)));
  state.targetWinY = Math.max(50, Math.floor(Math.random() * (screenHeight - 250)));

  showSpeech("ZOOMIES! ⚡", 2500);

  if (state.zoomTimer) clearTimeout(state.zoomTimer);
  state.zoomTimer = setTimeout(() => {
    state.isZooming = false;
    setCatState('breathe');
    hideSpeech();
  }, 3500);
}
