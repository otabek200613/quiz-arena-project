
const QUESTIONS = JSON.parse(document.getElementById("QUESTIONS_DATA").textContent);
const TIMER_SECONDS = 15;
const NEXT_DELAY_CORRECT = 1200;
const NEXT_DELAY_WRONG = 2000;
const STORAGE_KEY = 'quizArenaState';

let state = {
  participantId: null,
  name: '',
  emoji: '🦊',
  currentQ: 0,
  totalQ: QUESTIONS.length,     // <-- DB dan kelgan savollar soni
  score: 0,
  startTime: null,
  timerInterval: null,
  timeLeft: TIMER_SECONDS,
  answered: false,
  questionStartTime: null,      // <-- timer resume uchun
  currentStep: 'step-register',
  finalTimeTaken: 0,

  // refreshdan keyin ham javob holatini tiklash uchun
  lastSelectedIndex: null,
  lastCorrectIndex: null,
  lastWasCorrect: null,
};

/* ======= LOCALSTORAGE ======= */
function saveState() {
  const toSave = {
    participantId: state.participantId,
    name: state.name,
    emoji: state.emoji,
    currentQ: state.currentQ,
    totalQ: state.totalQ,
    score: state.score,
    startTime: state.startTime,
    currentStep: state.currentStep,
    finalTimeTaken: state.finalTimeTaken,

    timeLeft: state.timeLeft,
    answered: state.answered,
    questionStartTime: state.questionStartTime,

    lastSelectedIndex: state.lastSelectedIndex,
    lastCorrectIndex: state.lastCorrectIndex,
    lastWasCorrect: state.lastWasCorrect,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    const parsed = JSON.parse(saved);

    // 2 soatdan eski bo'lsa o'chiramiz
    if (parsed.startTime && Date.now() - parsed.startTime > 2 * 60 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    Object.assign(state, parsed);

    // agar DB'dagi savollar soni o'zgargan bo'lsa, moslab qo'yamiz
    state.totalQ = QUESTIONS.length;

    // currentQ chegaradan chiqib qolmasin
    if (state.currentQ < 0) state.currentQ = 0;
    if (state.currentQ >= state.totalQ) state.currentQ = Math.max(0, state.totalQ - 1);

    return true;
  } catch (e) {
    return false;
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ======= INIT ======= */
document.addEventListener('DOMContentLoaded', () => {
  createParticles();
  setupEmojiGrid();

  document.getElementById('nameInput').addEventListener('input', e => {
    const val = e.target.value.trim();
    document.getElementById('previewName').textContent = val || 'Ismingiz';
  });

  const hasSaved = loadSavedState();

  // har ehtimolga total_questions ko'rsatkichlari mos bo'lsin
  // (server ham ko'rsatadi, bu faqat state uchun)
  state.totalQ = QUESTIONS.length;

  if (hasSaved && state.participantId) {
    if (state.currentStep === 'step-finish') {
      restoreFinishPage();
      return;
    }

    if (state.currentStep === 'step-question') {
      document.getElementById('playerEmoji').textContent = state.emoji;
      document.getElementById('playerName').textContent = state.name;
      showStep('step-question');

      // refresh bo'lsa, o'sha savoldan davom ettiramiz
      loadQuestion(state.currentQ, { restore: true });
      return;
    }
  }
});

function restoreFinishPage() {
  const pct = Math.round((state.score / state.totalQ) * 100);
  document.getElementById('finishEmoji').textContent = state.emoji;
  document.getElementById('finishScore').textContent = state.score;
  document.getElementById('finishScoreLabel').textContent = '/ ' + state.totalQ + ' ball';
  document.getElementById('finishPercent').textContent = pct + '%';
  document.getElementById('finishTime').textContent = formatTime(state.finalTimeTaken);
  document.getElementById('finishAccuracy').textContent = pct + '%';

  let stars = '⭐';
  if (pct >= 90) stars = '⭐⭐⭐';
  else if (pct >= 60) stars = '⭐⭐';
  document.getElementById('finishStars').textContent = stars;

  let title = "Yaxshi harakat! 💪";
  if (pct === 100) title = "Mukammal! 🏆";
  else if (pct >= 80) title = "Zo'r natija! 🎉";
  else if (pct >= 60) title = "Yaxshi! 😊";
  else if (pct < 40) title = "Keyingisi yaxshiroq bo'ladi! 💡";
  document.getElementById('finishTitle').textContent = state.emoji + ' ' + title;

  showStep('step-finish');
}

function createParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (4 + Math.random() * 8) + 's';
    p.style.animationDelay = (Math.random() * 8) + 's';
    p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
    const colors = ['#00ff88','#4facfe','#ff006e','#ffd60a'];
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    container.appendChild(p);
  }
}

function setupEmojiGrid() {
  document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.emoji = btn.dataset.emoji;
      document.getElementById('previewAvatar').textContent = state.emoji;
    });
  });
}

/* ======= START ======= */
async function startQuiz() {
  const name = document.getElementById('nameInput').value.trim();
  if (!name) {
    document.getElementById('nameInput').style.borderColor = '#ff006e';
    document.getElementById('nameInput').focus();
    setTimeout(() => document.getElementById('nameInput').style.borderColor = '', 1000);
    return;
  }

  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Yuklanmoqda...';

  try {
    const res = await fetch('/api/start/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ name, emoji: state.emoji })
    });
    const data = await res.json();

    state.participantId = data.participant_id;
    state.totalQ = QUESTIONS.length; // <-- frontda DB savollar soni
    state.name = name;
    state.score = 0;
    state.currentQ = 0;
    state.startTime = Date.now();

    state.answered = false;
    state.timeLeft = TIMER_SECONDS;
    state.questionStartTime = null;
    state.lastSelectedIndex = null;
    state.lastCorrectIndex = null;
    state.lastWasCorrect = null;

    state.currentStep = 'step-countdown';
    saveState();

    showStep('step-countdown');
    startCountdown();
  } catch (err) {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Testni Boshlash';
    alert("Xato yuz berdi. Qayta urinib ko'ring.");
  }
}

function startCountdown() {
  let count = 3;
  const numEl = document.getElementById('countdownNum');
  const subEl = document.getElementById('countdownSub');
  numEl.textContent = count;

  const interval = setInterval(() => {
    count--;
    numEl.style.animation = 'none';
    void numEl.offsetWidth;
    numEl.style.animation = 'countdown-pop .6s ease';

    if (count === 0) {
      clearInterval(interval);
      numEl.textContent = '🚀';
      subEl.textContent = 'Test boshlanmoqda!';
      setTimeout(() => {
        state.currentStep = 'step-question';
        saveState();
        showStep('step-question');
        loadQuestion(0, { restore: false });
      }, 600);
    } else {
      numEl.textContent = count;
    }
  }, 900);
}

/* ======= QUESTION ======= */
function loadQuestion(index, { restore = false } = {}) {
  state.currentQ = index;

  // progress / player info
  document.getElementById('playerEmoji').textContent = state.emoji;
  document.getElementById('playerName').textContent = state.name;
  document.getElementById('currentScore').textContent = state.score;

  const pct = (index / state.totalQ) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressText').textContent = (index + 1) + ' / ' + state.totalQ;

  const fb = document.getElementById('feedbackBar');
  fb.className = 'feedback-bar';

  const qData = QUESTIONS[index];
  if (!qData) {
    console.error("Savol topilmadi (QUESTIONS_DATA):", index);
    return;
  }

  // anim
  const card = document.getElementById('questionCard');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'slide-in .4s ease';

  document.getElementById('qNumber').textContent = 'Savol ' + (index + 1);
  document.getElementById('qText').textContent = qData.q;

  // options
  const letters = ['A', 'B', 'C', 'D'];
  const grid = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  if (document.activeElement && typeof document.activeElement.blur === "function") {
  document.activeElement.blur();
}

  qData.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = '<span class="opt-letter">' + letters[i] + '</span><span>' + opt + '</span>';
    btn.addEventListener('click', (e) => {
  // ✅ iOS Safari fokusni ushlab qolmasin
  e.currentTarget.blur();
  selectAnswer(i);
});
    grid.appendChild(btn);
  });

  // timer / state
  if (!restore) {
    state.answered = false;
    state.timeLeft = TIMER_SECONDS;
    state.questionStartTime = Date.now();

    state.lastSelectedIndex = null;
    state.lastCorrectIndex = null;
    state.lastWasCorrect = null;

    saveState();
    startTimer();
    return;
  }

  // RESTORE MODE (refreshdan keyin)
  // agar avval questionStartTime bo'lsa, elapsed bo'yicha timeLeftni tiklaymiz
  if (!state.answered) {
    if (state.questionStartTime) {
      const elapsed = Math.floor((Date.now() - state.questionStartTime) / 1000);
      const left = TIMER_SECONDS - elapsed;
      state.timeLeft = Math.max(0, left);
    } else {
      // agar eski state'da yo'q bo'lsa, yangi boshlaymiz
      state.timeLeft = TIMER_SECONDS;
      state.questionStartTime = Date.now();
    }

    saveState();

    if (state.timeLeft <= 0) {
      timeOut();
    } else {
      startTimer();
    }
    return;
  }

  // Agar javob berilgan bo'lsa — holatini qayta chizamiz va keyingisiga o'tamiz
  applyAnsweredUI();
  saveState();

  const delay = state.lastWasCorrect ? NEXT_DELAY_CORRECT : NEXT_DELAY_WRONG;
  setTimeout(() => nextQuestion(), Math.min(900, delay)); // refreshdan keyin uzoq kutmasin
}

function startTimer() {
  clearInterval(state.timerInterval);
  const timerEl = document.getElementById('timerVal');
  const timerBox = document.getElementById('timerBox');

  timerEl.textContent = state.timeLeft;
  timerBox.classList.remove('urgent');

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    timerEl.textContent = state.timeLeft;

    // timeLeft ham saqlanib tursin (refresh resume uchun)
    saveState();

    if (state.timeLeft <= 10) timerBox.classList.add('urgent');
    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      if (!state.answered) timeOut();
    }
  }, 1000);
}

function timeOut() {
  state.answered = true;
  state.lastSelectedIndex = null;
  state.lastCorrectIndex = QUESTIONS[state.currentQ]?.answer ?? null;
  state.lastWasCorrect = false;

  saveState();

  disableOptions();
  showFeedback(false, '⏰ Vaqt tugadi!');
  setTimeout(() => nextQuestion(), NEXT_DELAY_WRONG);
}

/* ======= ANSWER ======= */
async function selectAnswer(selectedIndex) {
  if (state.answered) return;

  state.answered = true;
  clearInterval(state.timerInterval);

  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(b => b.disabled = true);

  try {
    // backend hali score hisoblash uchun qoladi
    const res = await fetch('/api/answer/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        participant_id: state.participantId,
        question_index: state.currentQ,
        selected: selectedIndex
      })
    });
    const data = await res.json();

    state.score = data.score;
    state.lastSelectedIndex = selectedIndex;
    state.lastCorrectIndex = data.correct_index;
    state.lastWasCorrect = data.correct;

    saveState();
    document.getElementById('currentScore').textContent = state.score;

    // UI highlight
    if (typeof data.correct_index === "number" && buttons[data.correct_index]) {
      buttons[data.correct_index].classList.add('correct');
    }
    if (!data.correct) {
      if (buttons[selectedIndex]) buttons[selectedIndex].classList.add('wrong');
      showFeedback(false, "❌ Noto'g'ri! To'g'ri javob belgilandi.");
    } else {
      showFeedback(true, "✅ To'g'ri! Ajoyib!");
    }

    const delay = data.correct ? NEXT_DELAY_CORRECT : NEXT_DELAY_WRONG;
    setTimeout(() => nextQuestion(), delay);
  } catch (err) {
    console.error('Javob yuborilmadi:', err);

    // backend xato bersa ham refreshda qolib ketmasin deb, lokal tekshiruv
    const correctIdx = QUESTIONS[state.currentQ]?.answer ?? null;
    state.lastSelectedIndex = selectedIndex;
    state.lastCorrectIndex = correctIdx;
    state.lastWasCorrect = (correctIdx === selectedIndex);
    saveState();

    // lokal highlight
    const buttons2 = document.querySelectorAll('.option-btn');
    if (typeof correctIdx === "number" && buttons2[correctIdx]) buttons2[correctIdx].classList.add('correct');
    if (correctIdx !== selectedIndex && buttons2[selectedIndex]) buttons2[selectedIndex].classList.add('wrong');
    showFeedback(state.lastWasCorrect, state.lastWasCorrect ? "✅ To'g'ri! Ajoyib!" : "❌ Noto'g'ri!");

    setTimeout(() => nextQuestion(), state.lastWasCorrect ? NEXT_DELAY_CORRECT : NEXT_DELAY_WRONG);
  }
}

function applyAnsweredUI() {
  const buttons = document.querySelectorAll('.option-btn');
  buttons.forEach(b => b.disabled = true);

  if (typeof state.lastCorrectIndex === "number" && buttons[state.lastCorrectIndex]) {
    buttons[state.lastCorrectIndex].classList.add('correct');
  }
  if (typeof state.lastSelectedIndex === "number" && state.lastSelectedIndex !== state.lastCorrectIndex) {
    if (buttons[state.lastSelectedIndex]) buttons[state.lastSelectedIndex].classList.add('wrong');
  }

  if (state.lastWasCorrect) {
    showFeedback(true, "✅ To'g'ri! Ajoyib!");
  } else {
    showFeedback(false, state.lastSelectedIndex === null ? "⏰ Vaqt tugadi!" : "❌ Noto'g'ri! To'g'ri javob belgilandi.");
  }
}

function disableOptions() {
  document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
}

function showFeedback(correct, message) {
  const fb = document.getElementById('feedbackBar');
  fb.className = 'feedback-bar show ' + (correct ? 'correct-fb' : 'wrong-fb');
  document.getElementById('feedbackText').textContent = message;
}

function nextQuestion() {
  const next = state.currentQ + 1;
  if (next >= state.totalQ) {
    finishQuiz();
  } else {
    // yangi savolga o'tishda "answered" reset bo'ladi
    loadQuestion(next, { restore: false });
  }
}

/* ======= FINISH ======= */
async function finishQuiz() {
  clearInterval(state.timerInterval);
  const timeTaken = Math.round((Date.now() - state.startTime) / 1000);

  state.finalTimeTaken = timeTaken;
  state.currentStep = 'step-finish';
  saveState();

  try {
    await fetch('/api/finish/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ participant_id: state.participantId, time_taken: timeTaken })
    });
  } catch (e) {
    // ignore
  }

  const pct = Math.round((state.score / state.totalQ) * 100);
  document.getElementById('finishEmoji').textContent = state.emoji;
  document.getElementById('finishScore').textContent = state.score;
  document.getElementById('finishScoreLabel').textContent = '/ ' + state.totalQ + ' ball';
  document.getElementById('finishPercent').textContent = pct + '%';
  document.getElementById('finishTime').textContent = formatTime(timeTaken);
  document.getElementById('finishAccuracy').textContent = pct + '%';

  let stars = '⭐';
  if (pct >= 90) stars = '⭐⭐⭐';
  else if (pct >= 60) stars = '⭐⭐';
  document.getElementById('finishStars').textContent = stars;

  let title = "Yaxshi harakat! 💪";
  if (pct === 100) title = "Mukammal! 🏆";
  else if (pct >= 80) title = "Zo'r natija! 🎉";
  else if (pct >= 60) title = "Yaxshi! 😊";
  else if (pct < 40) title = "Keyingisi yaxshiroq bo'ladi! 💡";
  document.getElementById('finishTitle').textContent = state.emoji + ' ' + title;

  showStep('step-finish');
}

function formatTime(seconds) {
  if (seconds < 60) return seconds + " soniya";
  return Math.floor(seconds / 60) + " daq " + (seconds % 60) + " son";
}

function restartQuiz() {
  clearInterval(state.timerInterval);
  clearState();

  state = {
    participantId: null,
    name: '',
    emoji: '🦊',
    currentQ: 0,
    totalQ: QUESTIONS.length,
    score: 0,
    startTime: null,
    timerInterval: null,
    timeLeft: TIMER_SECONDS,
    answered: false,
    questionStartTime: null,
    currentStep: 'step-register',
    finalTimeTaken: 0,
    lastSelectedIndex: null,
    lastCorrectIndex: null,
    lastWasCorrect: null,
  };

  document.getElementById('nameInput').value = '';
  document.getElementById('previewName').textContent = 'Ismingiz';
  document.getElementById('previewAvatar').textContent = '🦊';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  document.querySelector('.emoji-btn[data-emoji="🦊"]').classList.add('selected');

  showStep('step-register');
}

/* ======= UTILS ======= */
function showStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');
}