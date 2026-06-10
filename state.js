export const state = {
  // Coordinates relative to the window
  catX: 16,
  catY: 80,

  // Screen space window coordinates
  currentWinX: 0,
  currentWinY: 0,

  // Target positions for Zoomies
  targetWinX: 0,
  targetWinY: 0,
  isZooming: false,
  zoomTimer: null,

  // Global cursor coordinates
  mx: 0,
  my: 0,
  lastGlobalMx: 0,
  lastGlobalMy: 0,

  isDragging: false,
  startScreenX: 0,
  startScreenY: 0,
  isDrawerOpen: false,

  // Pomodoro State
  pomoTimerId: null,
  pomoSecondsLeft: 25 * 60,
  pomoIsRunning: false,
  pomoActive: false,
  pomoMode: 'focus',

  // Stretch State
  stretchTimerId: null,
  isStretching: false,

  // Custom notes persistence
  pinnedMessage: "",

  // Idle state (sleeping)
  lastActivityTime: Date.now(),
  isSleeping: false
};
