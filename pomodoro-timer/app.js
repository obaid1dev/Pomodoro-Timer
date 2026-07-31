/**
 * AuraFocus App Logic
 * Fully client-side Pomodoro app featuring a synthesized Audio Engine,
 * tasks dashboard, statistics tracker, and configurations saved to localStorage.
 */

// --- STATE MANAGEMENT ---
const AppState = {
  timer: {
    remainingSeconds: 1500, // 25 min default
    totalSeconds: 1500,
    isRunning: false,
    currentMode: 'pomodoro', // 'pomodoro', 'short', 'long'
    timerId: null,
    startTime: null,
  },
  settings: {
    pomodoro: 25,
    short: 5,
    long: 15,
    autoStartPomo: false,
    autoStartBreak: false,
    alarmSound: 'singing-bowl',
  },
  tasks: [], // Array of { id, title, completed, estPomo, actPomo }
  activeTaskId: null,
  stats: {
    totalFocusMinutes: 0,
    totalCompletedSessions: 0,
    completedTasksCount: 0,
    dailyHistory: {}, // { 'YYYY-MM-DD': minutes }
  }
};

// --- DEFAULT SETTINGS CONSTANTS ---
const DEFAULTS = {
  pomodoro: 25,
  short: 5,
  long: 15,
  autoStartPomo: false,
  autoStartBreak: false,
  alarmSound: 'singing-bowl',
};

// --- QUOTES FOR CALM MOMENTS ---
const CALM_QUOTES = [
  { text: "Within you there is a still, quiet space that is always at peace.", author: "Eckhart Tolle" },
  { text: "Focus is a muscle, and you are building it one breath at a time.", author: "Serene Mind" },
  { text: "Do not rush. Take this moment just to breathe, focus, and align.", author: "Zen proverb" },
  { text: "Your mind is for having ideas, not holding them.", author: "David Allen" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "One focus, one step, one breath. You are doing well.", author: "Aura Space" },
  { text: "Quiet minds receive the most guidance.", author: "Lao Tzu" }
];

// --- WEB AUDIO SYNTHESIZER ENGINE ---
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.noises = {
      white: { node: null, gain: null, buffer: null, isPlaying: false },
      pink: { node: null, gain: null, buffer: null, isPlaying: false },
      brown: { node: null, gain: null, buffer: null, isPlaying: false }
    };
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      
      // Create noise buffers
      this.noises.white.buffer = this._generateWhiteNoiseBuffer();
      this.noises.pink.buffer = this._generatePinkNoiseBuffer();
      this.noises.brown.buffer = this._generateBrownNoiseBuffer();

      // Create gain nodes for each noise
      Object.keys(this.noises).forEach(type => {
        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        gainNode.connect(this.ctx.destination);
        this.noises[type].gain = gainNode;
      });

      this.initialized = true;
    } catch (e) {
      console.error("Web Audio API not supported or blocked in this browser.", e);
    }
  }

  resumeContext() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ALARM SYNTHESIZERS
  playAlarm(soundType) {
    this.resumeContext();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    if (soundType === 'singing-bowl') {
      this._synthSingingBowl(now);
    } else if (soundType === 'warm-chime') {
      this._synthWarmChime(now);
    } else if (soundType === 'gentle-gong') {
      this._synthGentleGong(now);
    }
  }

  _synthSingingBowl(time) {
    const mainGain = this.ctx.createGain();
    mainGain.gain.setValueAtTime(0, time);
    mainGain.gain.linearRampToValueAtTime(0.6, time + 0.15);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, time + 5.0);
    mainGain.connect(this.ctx.destination);

    // Tibetan bowl harmonic spectrum (Frequencies in Hz)
    const partials = [
      { f: 180, a: 0.8 },
      { f: 360, a: 0.4 },
      { f: 543, a: 0.25 },
      { f: 724, a: 0.1 },
      { f: 906, a: 0.05 }
    ];

    // Wobble LFO
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(4.5, time); // 4.5 Hz pulse beating
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(0.12, time);
    lfo.connect(lfoGain);

    partials.forEach(partial => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(partial.f, time);
      
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(partial.a, time);
      
      lfoGain.connect(pGain.gain); // apply vibrato/beating
      
      osc.connect(pGain);
      pGain.connect(mainGain);
      
      osc.start(time);
      osc.stop(time + 5.5);
    });

    lfo.start(time);
    lfo.stop(time + 5.5);
  }

  _synthWarmChime(time) {
    const tones = [
      { note: 523.25, delay: 0.0 }, // C5
      { note: 659.25, delay: 0.15 }, // E5
      { note: 783.99, delay: 0.3 }, // G5
      { note: 1046.50, delay: 0.45 } // C6
    ];

    tones.forEach(t => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(t.note, time + t.delay);
      
      gain.gain.setValueAtTime(0, time + t.delay);
      gain.gain.linearRampToValueAtTime(0.3, time + t.delay + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + t.delay + 2.0);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(time + t.delay);
      osc.stop(time + t.delay + 2.1);
    });
  }

  _synthGentleGong(time) {
    const mainGain = this.ctx.createGain();
    mainGain.gain.setValueAtTime(0, time);
    mainGain.gain.linearRampToValueAtTime(0.7, time + 0.08);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, time + 6.0);
    mainGain.connect(this.ctx.destination);

    // Deep heavy tones + non-harmonic dense partials
    const frequencies = [110, 112.5, 172.3, 243.5, 312.9, 440];
    const amplitudes = [0.8, 0.6, 0.45, 0.3, 0.15, 0.05];

    frequencies.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      osc.type = (idx === 0) ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, time);
      
      const pGain = this.ctx.createGain();
      pGain.gain.setValueAtTime(amplitudes[idx], time);
      
      // subtle lowpass filter on high frequencies for brassy warmth
      if (idx > 1) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        osc.connect(filter);
        filter.connect(pGain);
      } else {
        osc.connect(pGain);
      }

      pGain.connect(mainGain);
      osc.start(time);
      osc.stop(time + 6.2);
    });
  }

  // AMBIENT NOISE PLAYERS
  toggleNoise(type, volumeValue) {
    this.resumeContext();
    if (!this.ctx) return;

    const noiseObj = this.noises[type];
    
    if (noiseObj.isPlaying) {
      // Fade out and stop
      const gainNode = noiseObj.gain;
      gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      
      setTimeout(() => {
        if (noiseObj.node) {
          try { noiseObj.node.stop(); } catch(e){}
          noiseObj.node.disconnect();
          noiseObj.node = null;
        }
        noiseObj.isPlaying = false;
      }, 550);
    } else {
      // Start and fade in
      const source = this.ctx.createBufferSource();
      source.buffer = noiseObj.buffer;
      source.loop = true;
      
      source.connect(noiseObj.gain);
      noiseObj.node = source;
      
      // set gain and fade in
      noiseObj.gain.gain.setValueAtTime(0, this.ctx.currentTime);
      source.start(0);
      
      noiseObj.gain.gain.linearRampToValueAtTime(volumeValue, this.ctx.currentTime + 1.0);
      noiseObj.isPlaying = true;
    }
  }

  setNoiseVolume(type, volumeValue) {
    if (!this.initialized || !this.noises[type].isPlaying) return;
    const gainNode = this.noises[type].gain;
    gainNode.gain.setValueAtTime(gainNode.gain.value, this.ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volumeValue, this.ctx.currentTime + 0.15);
  }

  // Noise Buffer Generators
  _generateWhiteNoiseBuffer() {
    const bufferSize = 4 * this.ctx.sampleRate; // 4 seconds loop
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  _generatePinkNoiseBuffer() {
    const bufferSize = 4 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      data[i] *= 0.11; // compensation gain
      b6 = white * 0.115926;
    }
    return buffer;
  }

  _generateBrownNoiseBuffer() {
    const bufferSize = 4 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // compensation gain
    }
    return buffer;
  }
}

const Audio = new AudioEngine();


// --- DOM SELECTORS ---
const DOM = {
  body: document.body,
  timerDisplay: document.getElementById('timer-display'),
  timerLabel: document.getElementById('timer-state-label'),
  timerProgressCircle: document.getElementById('timer-progress'),
  btnToggle: document.getElementById('btn-toggle'),
  btnReset: document.getElementById('btn-reset'),
  btnSkip: document.getElementById('btn-skip'),
  iconPlay: document.getElementById('icon-play'),
  iconPause: document.getElementById('icon-pause'),
  
  // Modes
  modePomo: document.getElementById('mode-pomodoro'),
  modeShort: document.getElementById('mode-short'),
  modeLong: document.getElementById('mode-long'),

  // Sidebar task active banner
  activeTaskBanner: document.getElementById('active-task-banner'),
  activeTaskTitle: document.getElementById('active-task-title'),

  // Tasks elements
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  estPomoInput: document.getElementById('est-pomodoro'),
  btnDecEst: document.getElementById('step-dec'),
  btnIncEst: document.getElementById('step-inc'),
  taskList: document.getElementById('task-list'),
  taskCounter: document.getElementById('task-counter'),

  // Ambience elements
  noiseToggles: document.querySelectorAll('.noise-toggle-btn'),
  noiseSliders: document.querySelectorAll('.noise-volume'),

  // Modals buttons
  btnStats: document.getElementById('btn-stats'),
  btnSettings: document.getElementById('btn-settings'),
  modalSettings: document.getElementById('modal-settings'),
  modalStats: document.getElementById('modal-stats'),
  closeModalBtns: document.querySelectorAll('.close-modal-btn'),

  // Settings inputs
  setPomo: document.getElementById('set-pomo'),
  setShort: document.getElementById('set-short'),
  setLong: document.getElementById('set-long'),
  setAutoPomo: document.getElementById('set-auto-pomo'),
  setAutoBreak: document.getElementById('set-auto-break'),
  setAlarmSound: document.getElementById('set-alarm-sound'),
  btnTestAlarm: document.getElementById('btn-test-alarm'),
  btnSaveSettings: document.getElementById('btn-save-settings'),
  btnResetDefaults: document.getElementById('btn-reset-defaults'),

  // Stats elements
  statsTime: document.getElementById('stats-total-time'),
  statsPomo: document.getElementById('stats-total-pomo'),
  statsTasks: document.getElementById('stats-completed-tasks'),
  statsChart: document.getElementById('chart-bars-container'),
  statsQuote: document.getElementById('stats-quote'),
  statsQuoteAuthor: document.getElementById('stats-quote-author'),
  btnClearStats: document.getElementById('btn-clear-stats'),
  btnCloseStats: document.getElementById('btn-close-stats'),
};


// --- INITIALIZATION ---
function initApp() {
  loadData();
  setupEventListeners();
  syncSettingsUI();
  updateTimerUI();
  renderTasks();
}


// --- LOCALSTORAGE PERSISTENCE ---
function loadData() {
  // Settings load
  const savedSettings = localStorage.getItem('aurafocus_settings');
  if (savedSettings) {
    AppState.settings = { ...DEFAULTS, ...JSON.parse(savedSettings) };
  } else {
    AppState.settings = { ...DEFAULTS };
  }
  
  // Tasks load
  const savedTasks = localStorage.getItem('aurafocus_tasks');
  if (savedTasks) {
    AppState.tasks = JSON.parse(savedTasks);
  }

  // Active Task load
  const savedActiveTaskId = localStorage.getItem('aurafocus_active_task_id');
  if (savedActiveTaskId) {
    AppState.activeTaskId = parseInt(savedActiveTaskId, 10);
  }

  // Stats load
  const savedStats = localStorage.getItem('aurafocus_stats');
  if (savedStats) {
    AppState.stats = JSON.parse(savedStats);
  }

  // Timer starting seconds based on loaded settings
  resetTimerState();
}

function saveData() {
  localStorage.setItem('aurafocus_settings', JSON.stringify(AppState.settings));
  localStorage.setItem('aurafocus_tasks', JSON.stringify(AppState.tasks));
  localStorage.setItem('aurafocus_stats', JSON.stringify(AppState.stats));
  if (AppState.activeTaskId) {
    localStorage.setItem('aurafocus_active_task_id', AppState.activeTaskId.toString());
  } else {
    localStorage.removeItem('aurafocus_active_task_id');
  }
}


// --- TIMER ENGINE ---
function resetTimerState() {
  const mode = AppState.timer.currentMode;
  let mins = AppState.settings[mode];
  
  AppState.timer.totalSeconds = mins * 60;
  AppState.timer.remainingSeconds = mins * 60;
  AppState.timer.isRunning = false;
  AppState.timer.startTime = null;
  
  if (AppState.timer.timerId) {
    clearInterval(AppState.timer.timerId);
    AppState.timer.timerId = null;
  }
}

function updateTimerUI() {
  const rem = AppState.timer.remainingSeconds;
  const tot = AppState.timer.totalSeconds;
  
  // Formatted Time MM:SS
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;
  const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  DOM.timerDisplay.textContent = timeStr;

  // Title page update
  const labelMap = {
    pomodoro: 'Focus',
    short: 'Short Break',
    long: 'Long Break'
  };
  document.title = `${timeStr} — ${labelMap[AppState.timer.currentMode]}`;

  // Circular SVG progress bar
  // Circumference = 2 * PI * r = 2 * PI * 100 = 628.3
  const circumference = 628;
  const progressRatio = rem / tot;
  const offset = circumference - (progressRatio * circumference);
  DOM.timerProgressCircle.style.strokeDashoffset = offset;

  // Mode UI highlight
  document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
  if (AppState.timer.currentMode === 'pomodoro') DOM.modePomo.classList.add('active');
  if (AppState.timer.currentMode === 'short') DOM.modeShort.classList.add('active');
  if (AppState.timer.currentMode === 'long') DOM.modeLong.classList.add('active');

  // Body theme shift
  DOM.body.className = `theme-${AppState.timer.currentMode}`;

  // Control icons
  if (AppState.timer.isRunning) {
    DOM.iconPlay.classList.add('hidden');
    DOM.iconPause.classList.remove('hidden');
  } else {
    DOM.iconPlay.classList.remove('hidden');
    DOM.iconPause.classList.add('hidden');
  }
}

function toggleTimer() {
  Audio.resumeContext();
  if (AppState.timer.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (AppState.timer.isRunning) return;

  AppState.timer.isRunning = true;
  
  // Precise countdown calculation comparing Date.now() to prevent background sleep drifting
  AppState.timer.startTime = Date.now() - (AppState.timer.totalSeconds - AppState.timer.remainingSeconds) * 1000;
  
  AppState.timer.timerId = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - AppState.timer.startTime) / 1000);
    AppState.timer.remainingSeconds = AppState.timer.totalSeconds - elapsedSeconds;

    if (AppState.timer.remainingSeconds <= 0) {
      AppState.timer.remainingSeconds = 0;
      updateTimerUI();
      handleSessionComplete();
    } else {
      updateTimerUI();
    }
  }, 200); // Poll fast for sub-second precision updates

  updateTimerUI();
}

function pauseTimer() {
  if (!AppState.timer.isRunning) return;
  AppState.timer.isRunning = false;
  clearInterval(AppState.timer.timerId);
  AppState.timer.timerId = null;
  updateTimerUI();
}

function resetTimer() {
  pauseTimer();
  resetTimerState();
  updateTimerUI();
}

function skipTimer() {
  pauseTimer();
  // Simply swap to the next expected state
  if (AppState.timer.currentMode === 'pomodoro') {
    // If completed focus, auto break path
    switchMode('short');
  } else {
    switchMode('pomodoro');
  }
}

function switchMode(newMode) {
  pauseTimer();
  AppState.timer.currentMode = newMode;
  
  const stateLabels = {
    pomodoro: 'Time to focus',
    short: 'Take a breath',
    long: 'Unwind completely'
  };
  DOM.timerLabel.textContent = stateLabels[newMode];
  
  resetTimerState();
  updateTimerUI();

  // If autostart setting dictates
  if (newMode === 'pomodoro' && AppState.settings.autoStartPomo) {
    startTimer();
  } else if (newMode !== 'pomodoro' && AppState.settings.autoStartBreak) {
    startTimer();
  }
}

function handleSessionComplete() {
  pauseTimer();

  // 1. Play synthesized bell/singing-bowl
  if (AppState.settings.alarmSound !== 'none') {
    Audio.playAlarm(AppState.settings.alarmSound);
  }

  // 2. Accumulate Statistics
  if (AppState.timer.currentMode === 'pomodoro') {
    const activeMinutes = AppState.settings.pomodoro;
    AppState.stats.totalFocusMinutes += activeMinutes;
    AppState.stats.totalCompletedSessions += 1;
    
    // Daily log
    const todayStr = getTodayDateString();
    AppState.stats.dailyHistory[todayStr] = (AppState.stats.dailyHistory[todayStr] || 0) + activeMinutes;

    // Increment active task pomodoro completed count
    if (AppState.activeTaskId) {
      const activeTask = AppState.tasks.find(t => t.id === AppState.activeTaskId);
      if (activeTask && !activeTask.completed) {
        activeTask.actPomo += 1;
      }
    }
  }

  saveData();
  renderTasks();

  // 3. Transition to next mode
  if (AppState.timer.currentMode === 'pomodoro') {
    // Determine whether to do a short break or long break (e.g. standard 4 focus sessions = long break)
    // For simplicity, every 4 focus sessions triggers long break, else short break.
    const focusCount = AppState.stats.totalCompletedSessions;
    if (focusCount > 0 && focusCount % 4 === 0) {
      switchMode('long');
    } else {
      switchMode('short');
    }
  } else {
    switchMode('pomodoro');
  }
}


// --- TASKS ENGINE ---
function renderTasks() {
  DOM.taskList.innerHTML = '';
  
  let completedCount = 0;
  
  AppState.tasks.forEach(task => {
    if (task.completed) completedCount++;

    const li = document.createElement('li');
    li.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === AppState.activeTaskId ? 'active' : ''}`;
    li.dataset.id = task.id;

    // Left container: checkbox + title
    const leftDiv = document.createElement('div');
    leftDiv.className = 'task-item-left';
    
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'custom-chk';
    checkBtn.setAttribute('aria-label', task.completed ? 'Mark incomplete' : 'Mark complete');
    checkBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>`;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'task-title';
    titleSpan.textContent = task.title;

    leftDiv.appendChild(checkBtn);
    leftDiv.appendChild(titleSpan);

    // Right container: pomo counts + action buttons
    const rightDiv = document.createElement('div');
    rightDiv.className = 'task-item-right';

    const pomoCount = document.createElement('span');
    pomoCount.className = 'task-pomo-count';
    pomoCount.textContent = `${task.actPomo}/${task.estPomo} pomos`;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'task-action-btn edit-btn';
    editBtn.setAttribute('aria-label', 'Rename Task');
    editBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>`;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'task-action-btn delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete Task');
    deleteBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>`;

    actionsDiv.appendChild(editBtn);
    actionsDiv.appendChild(deleteBtn);

    rightDiv.appendChild(pomoCount);
    rightDiv.appendChild(actionsDiv);

    li.appendChild(leftDiv);
    li.appendChild(rightDiv);

    // Event listener: clicking the item sets active task
    li.addEventListener('click', (e) => {
      // Ignore click if clicking button elements
      if (e.target.closest('.custom-chk') || e.target.closest('.task-action-btn')) {
        return;
      }
      selectActiveTask(task.id);
    });

    // Event listener: Checkbox toggle
    checkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompletion(task.id);
    });

    // Event listener: Edit task text
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      editTaskTitle(task.id);
    });

    // Event listener: Delete task
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    DOM.taskList.appendChild(li);
  });

  // Update counters
  DOM.taskCounter.textContent = `${completedCount} completed`;
  AppState.stats.completedTasksCount = completedCount;

  // Sync active task showcase banner
  updateActiveTaskBanner();
}

function selectActiveTask(id) {
  if (AppState.activeTaskId === id) {
    // Toggle off if clicking the already active one
    AppState.activeTaskId = null;
  } else {
    // Only allow selecting incomplete tasks
    const task = AppState.tasks.find(t => t.id === id);
    if (task && !task.completed) {
      AppState.activeTaskId = id;
    } else {
      AppState.activeTaskId = null;
    }
  }
  saveData();
  renderTasks();
}

function toggleTaskCompletion(id) {
  const task = AppState.tasks.find(t => t.id === id);
  if (task) {
    task.completed = !task.completed;
    
    // If completed, clear it from active selection
    if (task.completed && AppState.activeTaskId === id) {
      AppState.activeTaskId = null;
    }
  }
  saveData();
  renderTasks();
}

function editTaskTitle(id) {
  const task = AppState.tasks.find(t => t.id === id);
  if (task) {
    const newTitle = prompt("Edit task description:", task.title);
    if (newTitle !== null && newTitle.trim() !== "") {
      task.title = newTitle.trim();
      saveData();
      renderTasks();
    }
  }
}

function deleteTask(id) {
  AppState.tasks = AppState.tasks.filter(t => t.id !== id);
  if (AppState.activeTaskId === id) {
    AppState.activeTaskId = null;
  }
  saveData();
  renderTasks();
}

function updateActiveTaskBanner() {
  if (AppState.activeTaskId) {
    const activeTask = AppState.tasks.find(t => t.id === AppState.activeTaskId);
    if (activeTask && !activeTask.completed) {
      DOM.activeTaskTitle.textContent = activeTask.title;
      DOM.activeTaskBanner.classList.remove('hidden');
      return;
    }
  }
  
  DOM.activeTaskBanner.classList.add('hidden');
}

// Stepper helpers
function adjustStepper(amount) {
  let val = parseInt(DOM.estPomoInput.value, 10) || 1;
  val += amount;
  if (val < 1) val = 1;
  if (val > 10) val = 10;
  DOM.estPomoInput.value = val;
}


// --- SETTINGS CONTROLLER ---
function syncSettingsUI() {
  DOM.setPomo.value = AppState.settings.pomodoro;
  DOM.setShort.value = AppState.settings.short;
  DOM.setLong.value = AppState.settings.long;
  DOM.setAutoPomo.checked = AppState.settings.autoStartPomo;
  DOM.setAutoBreak.checked = AppState.settings.autoStartBreak;
  DOM.setAlarmSound.value = AppState.settings.alarmSound;
}

function saveSettingsFromUI() {
  AppState.settings.pomodoro = parseInt(DOM.setPomo.value, 10) || DEFAULTS.pomodoro;
  AppState.settings.short = parseInt(DOM.setShort.value, 10) || DEFAULTS.short;
  AppState.settings.long = parseInt(DOM.setLong.value, 10) || DEFAULTS.long;
  AppState.settings.autoStartPomo = DOM.setAutoPomo.checked;
  AppState.settings.autoStartBreak = DOM.setAutoBreak.checked;
  AppState.settings.alarmSound = DOM.setAlarmSound.value;

  saveData();
  resetTimerState();
  updateTimerUI();
  closeModal(DOM.modalSettings);
}

function resetSettingsToDefault() {
  if (confirm("Reset durations and preferences to default?")) {
    AppState.settings = { ...DEFAULTS };
    saveData();
    syncSettingsUI();
    resetTimerState();
    updateTimerUI();
  }
}


// --- STATISTICS & CHARTS ---
function renderStatsModal() {
  // Update texts
  DOM.statsTime.textContent = `${AppState.stats.totalFocusMinutes}m`;
  DOM.statsPomo.textContent = AppState.stats.totalCompletedSessions;
  DOM.statsTasks.textContent = AppState.stats.completedTasksCount;

  // Choose a calming quote randomly
  const idx = Math.floor(Math.random() * CALM_QUOTES.length);
  DOM.statsQuote.textContent = `"${CALM_QUOTES[idx].text}"`;
  DOM.statsQuoteAuthor.textContent = CALM_QUOTES[idx].author;

  // Render weekly chart bars
  DOM.statsChart.innerHTML = '';
  
  const last7Days = [];
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Calculate date objects for past 7 days (including today)
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d);
  }

  // Find max minutes in history to scale bars (min ceiling of 60 mins to prevent huge empty bars)
  let maxMinutes = 60;
  last7Days.forEach(date => {
    const dStr = getDateString(date);
    const mins = AppState.stats.dailyHistory[dStr] || 0;
    if (mins > maxMinutes) maxMinutes = mins;
  });

  // Render bars
  const todayStr = getTodayDateString();
  last7Days.forEach(date => {
    const dStr = getDateString(date);
    const mins = AppState.stats.dailyHistory[dStr] || 0;
    const heightPercent = Math.min(100, Math.max(8, (mins / maxMinutes) * 100)); // Minimum height of 8% for visibility
    const isToday = dStr === todayStr;

    const column = document.createElement('div');
    column.className = 'chart-bar-column';

    const barFill = document.createElement('div');
    barFill.className = `chart-bar-fill ${isToday ? 'active' : ''}`;
    barFill.style.height = `${heightPercent}%`;

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    tooltip.textContent = `${mins}m focused`;
    barFill.appendChild(tooltip);

    const label = document.createElement('div');
    label.className = 'chart-bar-label';
    label.textContent = daysOfWeek[date.getDay()];

    column.appendChild(barFill);
    column.appendChild(label);
    DOM.statsChart.appendChild(column);
  });
}

function clearStatsHistory() {
  if (confirm("Are you sure you want to clear your focus history? This action cannot be undone.")) {
    AppState.stats = {
      totalFocusMinutes: 0,
      totalCompletedSessions: 0,
      completedTasksCount: 0,
      dailyHistory: {}
    };
    saveData();
    renderTasks(); // Updates UI count tags
    renderStatsModal(); // Rerenders current active layout
  }
}


// --- EVENT LISTENERS ---
function setupEventListeners() {
  // Timer buttons
  DOM.btnToggle.addEventListener('click', toggleTimer);
  DOM.btnReset.addEventListener('click', resetTimer);
  DOM.btnSkip.addEventListener('click', skipTimer);

  // Modes selectors
  DOM.modePomo.addEventListener('click', () => switchMode('pomodoro'));
  DOM.modeShort.addEventListener('click', () => switchMode('short'));
  DOM.modeLong.addEventListener('click', () => switchMode('long'));

  // Task Form & Stepper
  DOM.btnDecEst.addEventListener('click', () => adjustStepper(-1));
  DOM.btnIncEst.addEventListener('click', () => adjustStepper(1));
  
  DOM.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const titleText = DOM.taskInput.value.trim();
    const estPomo = parseInt(DOM.estPomoInput.value, 10) || 1;
    
    if (titleText !== "") {
      const newTask = {
        id: Date.now(),
        title: titleText,
        completed: false,
        estPomo: estPomo,
        actPomo: 0
      };
      
      AppState.tasks.push(newTask);
      
      // Auto-select as active task if nothing is active
      if (!AppState.activeTaskId) {
        AppState.activeTaskId = newTask.id;
      }
      
      saveData();
      renderTasks();
      
      // Reset form
      DOM.taskInput.value = '';
      DOM.estPomoInput.value = '1';
    }
  });

  // Modal Open Triggers
  DOM.btnSettings.addEventListener('click', () => {
    syncSettingsUI();
    openModal(DOM.modalSettings);
  });

  DOM.btnStats.addEventListener('click', () => {
    renderStatsModal();
    openModal(DOM.modalStats);
  });

  // Close modals
  DOM.closeModalBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      closeModal(e.target.closest('.modal-overlay'));
    });
  });

  DOM.modalSettings.addEventListener('click', (e) => {
    if (e.target === DOM.modalSettings) closeModal(DOM.modalSettings);
  });

  DOM.modalStats.addEventListener('click', (e) => {
    if (e.target === DOM.modalStats) closeModal(DOM.modalStats);
  });

  // Settings Actions
  DOM.btnSaveSettings.addEventListener('click', saveSettingsFromUI);
  DOM.btnResetDefaults.addEventListener('click', resetSettingsToDefault);
  DOM.btnTestAlarm.addEventListener('click', () => {
    const tone = DOM.setAlarmSound.value;
    if (tone !== 'none') {
      Audio.playAlarm(tone);
    }
  });

  // Stats actions
  DOM.btnClearStats.addEventListener('click', clearStatsHistory);
  DOM.btnCloseStats.addEventListener('click', () => closeModal(DOM.modalStats));

  // Ambience Sliders & buttons
  DOM.noiseToggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = e.target.closest('.noise-control-row');
      const toggle = row.querySelector('.noise-toggle-btn');
      const slider = row.querySelector('.noise-volume');
      const noiseType = toggle.dataset.noise;

      // Initialize audio on click interaction (Chrome autoplay policy)
      Audio.resumeContext();

      Audio.toggleNoise(noiseType, parseFloat(slider.value));
      
      // Toggle play/pause SVGs and slider state
      toggle.classList.toggle('playing');
      const isPlaying = toggle.classList.contains('playing');
      slider.disabled = !isPlaying;

      const playSvg = toggle.querySelector('.play-svg');
      const pauseSvg = toggle.querySelector('.pause-svg');

      if (isPlaying) {
        playSvg.classList.add('hidden');
        pauseSvg.classList.remove('hidden');
      } else {
        playSvg.classList.remove('hidden');
        pauseSvg.classList.add('hidden');
      }
    });
  });

  DOM.noiseSliders.forEach(slider => {
    slider.addEventListener('input', (e) => {
      const noiseType = e.target.id.replace('volume-', '');
      Audio.setNoiseVolume(noiseType, parseFloat(e.target.value));
    });
  });
}


// --- MODAL UTILS ---
function openModal(modalEl) {
  modalEl.classList.remove('hidden');
  modalEl.style.opacity = 0;
  // trigger layout reflow before setting opacity to 1 for smooth fade transition
  modalEl.offsetHeight;
  modalEl.style.opacity = 1;
}

function closeModal(modalEl) {
  modalEl.style.opacity = 0;
  // Wait for transition duration before adding hidden class
  setTimeout(() => {
    modalEl.classList.add('hidden');
  }, 400);
}


// --- UTILITY DATE FORMATTING ---
function getTodayDateString() {
  return getDateString(new Date());
}

function getDateString(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}


// Start the application
window.addEventListener('DOMContentLoaded', initApp);
