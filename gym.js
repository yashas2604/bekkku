import { state } from './state.js';
import { typingWordsList } from './config.js';
import { setCatState, showSpeech, triggerJumpReaction, wakeUp } from './renderer.js';

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

export let gymState = {
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

export function initGym() {
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

export function restartGym() {
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

  state.lastActivityTime = Date.now();
  if (state.isSleeping) wakeUp();

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
