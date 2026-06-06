const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage } = require('electron');
const path = require('path');

let mainWindow = null;
let tray = null;
let mousePollInterval = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Start small (160x220) just for the cat and speech bubble
  const winWidth = 160;
  const winHeight = 220;
  
  // Position window at bottom right of the screen
  const x = screenWidth - winWidth - 50;
  const y = screenHeight - winHeight - 50;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');

  // Let the window ignore mouse events by default
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Handle click-through updates from renderer
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Handle window dragging
  ipcMain.on('drag-window', (event, dx, dy) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      const [wx, wy] = win.getPosition();
      win.setPosition(wx + dx, wy + dy);
    }
  });

  // Handle resizing window dynamically (e.g. when drawer is opened)
  ipcMain.on('resize-window', (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setSize(width, height);
    }
  });

  // Handle window positioning dynamically
  ipcMain.on('move-window', (event, newX, newY) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(newX), Math.round(newY));
    }
  });

  // Handle repositioning or resetting to default position
  ipcMain.on('reset-position', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const display = screen.getPrimaryDisplay();
      const { width: sw, height: sh } = display.workAreaSize;
      const [ww, wh] = mainWindow.getSize();
      mainWindow.setPosition(sw - ww - 50, sh - wh - 50);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (mousePollInterval) clearInterval(mousePollInterval);
  });

  // Start polling mouse globally
  startMousePolling();
}

function startMousePolling() {
  if (mousePollInterval) clearInterval(mousePollInterval);
  
  mousePollInterval = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const cursorPoint = screen.getCursorScreenPoint();
      const [winX, winY] = mainWindow.getPosition();
      const [winWidth, winHeight] = mainWindow.getSize();
      
      mainWindow.webContents.send('global-mouse', {
        mx: cursorPoint.x,
        my: cursorPoint.y,
        winX: winX,
        winY: winY,
        winWidth: winWidth,
        winHeight: winHeight
      });
    }
  }, 50); // 20 times per second for smooth chasing
}

function createTray() {
  const iconBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMElEQVQ4T2NkoBAwUqifAWowGBjGgGECGBmIQVNhGBgZQMpoaPBIxoBhAhgZiEFTYQA72QAD+Z10MQAAAABJRU5ErkJggg==',
    'base64'
  );
  
  const trayIcon = nativeImage.createFromBuffer(iconBuffer);
  tray = new Tray(trayIcon);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Bekkku Companion',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Toggle Control Drawer',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('toggle-settings');
        }
      }
    },
    {
      label: 'Reset Position',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          const display = screen.getPrimaryDisplay();
          const { width: sw, height: sh } = display.workAreaSize;
          const [ww, wh] = mainWindow.getSize();
          mainWindow.setPosition(sw - ww - 50, sh - wh - 50);
        }
      }
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (item) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(item.checked);
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Bekkku Desktop Companion');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('toggle-settings');
    }
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      mainWindow.webContents.send('toggle-settings');
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
