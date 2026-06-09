# 🐾 Bekkku: Desktop Pixel Cat Companion

**Bekkku** is an ultra-lightweight, retro-pixel cat companion that lives directly on your computer screen. Built using Electron and vanilla web technologies (HTML/CSS/JS), Bekkku floats always-on-top, reacts to your mouse cursor globally, kneads its paws as you type, and helps you work productively with stretch reminders and Pomodoro timers.

---

## ✨ Features

- **🖱️ Screen-Space Mouse Chasing**: Bekkku tracks your cursor globally. If the mouse is far away, the cat walks across your actual desktop screen to catch it!
- **👀 Eye-Tracking**: The cat's eyes follow your mouse movement in real time.
- **🛋️ Mochi Drag & Drop**: Left-click and hold to drag Bekkku anywhere on your screen. Watch the body stretch vertically like mochi when pulled!
- **⌨️ Keyboard Kneading Gym (Monkeytype Style)**: A fully functional mini typing test built right into the console.
  - **Config Toggles**: Practice in **Time** modes (15s, 30s, 60s) or **Words** modes (10, 25, 50 words).
  - **Visual Feedback**: Muted gray untyped letters, white for correct inputs, and red highlighting for mistakes.
  - **Smooth Caret**: An amber/green cursor caret that glides between letters with smooth layout transitions.
  - **Overheat Mode**: Kneading speed adjusts to your real-time WPM. Knead above 60 WPM to trigger Bekkku's glowing red aura, fast-paws animation, and steam puffs!
  - **Detailed Stats Summary**: View final WPM, accuracy %, and elapsed time on a retro summary card.
- **🍅 Floating Pomodoro Timer**: A pixelated digital timer floats next to Bekkku to count down focus and break cycles. Bekkku does a happy hop when you complete tasks!
- **🧘 Stretch Reminders**: Set interval reminders and watch Bekkku scale **2.5x larger** to prompt you to take a stretch break.
- **🎨 Dynamic Fur Customizer**: Swap patterns instantly inside the drawer console (Orange Tabby, Tuxedo, Calico, Siamese, Midnight Black, and Ghost White).
- **⚙️ Retro Slid-out Console**: Double-click or right-click the cat to open the settings console next to it (resizing the window dynamically to prevent screen occlusion).
- **💾 Local Persistence**: Your custom pinned messages, fur colors, and interval settings are automatically saved in `localStorage` between launches.

---

## 🚀 Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Installation
1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/bekkku.git
   cd bekkku
   ```
2. Install the dev dependencies:
   ```bash
   npm install
   ```
3. Run the desktop companion:
   ```bash
   npm start
   ```
   *(Note: Prepend `ELECTRON_DISABLE_SANDBOX=1` if your terminal shell runs inside a sandboxed environment.)*

---

## 🎮 How to Interact with Bekkku

- **Drag**: Left-click and hold the cat, then pull it to place it anywhere on your desktop screen.
- **Configure**: Double-click or Right-click the cat to slide open/close the Settings Console drawer.
- **Sleep**: If you leave your computer inactive for 40 seconds, Bekkku will curl up and go to sleep. It wakes up automatically when you move your mouse.
- **Typing Gym**: Click inside the keyboard gym panel in the console drawer to focus. Press **Tab** or **Escape** at any time to instantly restart a typing run. Correct letters with Backspace (including backspacing into the previous word) or clear the current word using **Ctrl + Backspace** / **Cmd + Backspace**.
- **Reset**: If you ever lose the cat, select **Reset Position** from the system tray menu (located in your top menu bar) or the settings console to snap it back to the bottom-right corner.

---

## 🎨 Technology Stack
- **Core Framework**: Electron (transparent, frameless window)
- **UI & Layout**: HTML5 & CSS3 Grid
- **Cat Engine**: Scalable vector graphics (SVG) with `shape-rendering="crispEdges"` for razor-sharp pixel rendering.
- **Animations**: CSS Keyframe animations (highly optimized, 0% idle CPU footprint).
- **Logic**: Vanilla ES6 JavaScript (mouse calculations, physics, timer countdowns, and IPC bridges).
