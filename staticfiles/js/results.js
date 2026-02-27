/* =============================================
   RESULTS.JS — Live natijalar dashboard (FIXED)
   ============================================= */

const REFRESH_INTERVAL = 1000; // 3 soniyada bir yangilanadi

let barChart = null;
let pieChart = null;
let isFirstLoad = true;

/* ======= INIT ======= */
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  fetchResults();
  setInterval(fetchResults, REFRESH_INTERVAL);
});

/* ======= CHARTS INIT ======= */
function initCharts() {
  const barCtx = document.getElementById('barChart').getContext('2d');
  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [{
        label: 'Ball',
        data: [],
        backgroundColor: [],
        borderColor: [],
        borderWidth: 2,
        borderRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f0f2a',
          borderColor: '#1e1e4a',
          borderWidth: 1,
          titleColor: '#00ff88',
          bodyColor: '#e0e0ff',
          padding: 12,
          callbacks: {
            label: ctx => ` ${ctx.raw} ball`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,.04)' },
          ticks: { color: '#6060a0', font: { family: 'Space Mono', size: 11 }, maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,.06)' },
          ticks: { color: '#6060a0', font: { family: 'Space Mono', size: 11 }, stepSize: 1 },
          beginAtZero: true,
          min: 0,
        }
      }
    }
  });

  const pieCtx = document.getElementById('pieChart').getContext('2d');
  pieChart = new Chart(pieCtx, {
    type: 'doughnut',
    data: {
      labels: ['A\'lo (90-100%)', 'Yaxshi (60-89%)', "O'rtacha (40-59%)", "Kam (0-39%)"],
      datasets: [{
        data: [0, 0, 0, 0],
        backgroundColor: ['#00ff88','#4facfe','#ffd60a','#ff006e'],
        borderColor: '#070714',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: '#6060a0',
            font: { family: 'Space Mono', size: 11 },
            padding: 12,
            boxWidth: 12,
          }
        },
        tooltip: {
          backgroundColor: '#0f0f2a',
          borderColor: '#1e1e4a',
          borderWidth: 1,
          titleColor: '#00ff88',
          bodyColor: '#e0e0ff',
          padding: 12,
        }
      }
    }
  });
}

/* ======= FETCH ======= */
async function fetchResults() {
  try {
    const res = await fetch('/api/results/');
    const data = await res.json();
    updateDashboard(data);
    isFirstLoad = false;
  } catch (err) {
    console.error('Natijalar yuklanmadi:', err);
  }
}

/* ======= UPDATE ======= */
function updateDashboard(data) {
  const participants = Array.isArray(data.participants) ? data.participants : [];

  // Stats
  document.getElementById('statTotal').textContent = data.total_participants ?? participants.length ?? 0;

  // ✅ Tugatdi soni endi backend’dan: completed_count
  // Agar backend hali bermasa, fallback qilib completed=true ni sanaymiz
  const doneCount = (typeof data.completed_count === 'number')
    ? data.completed_count
    : participants.filter(p => p.completed).length;

  document.getElementById('statDone').textContent = doneCount;
  document.getElementById('statActive').textContent = data.active_count ?? participants.filter(p => !p.completed).length;

  // ✅ Savollar soni (diagramma max shu bo‘ladi)
  const questionCount = Number(data.question_count ?? 0);
  document.getElementById('statQuestions').textContent = questionCount;

  updateLeaderboard(participants);
  updateBarChart(participants, questionCount);
  updatePieChart(participants);
  updatePodium(participants);
  updateTicker(participants);
}

/* ======= LEADERBOARD ======= */
function updateLeaderboard(participants) {
  const list = document.getElementById('leaderboardList');
  const empty = document.getElementById('emptyState');

  if (participants.length === 0) {
    list.innerHTML = '';
    list.appendChild(empty);
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';

  participants.forEach((p, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    const rankSymbol = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);

    const pct = Number(p.percentage ?? 0);
    const barW = Math.max(4, pct);

    let existing = list.querySelector(`[data-id="${p.id}"]`);

    if (!existing) {
      existing = document.createElement('div');
      existing.className = `lb-item ${rankClass}`;
      existing.dataset.id = p.id;
      list.appendChild(existing);
    } else {
      existing.className = `lb-item ${rankClass}`;
    }

    const timeText = p.completed ? `⏱ ${formatTime(p.time_taken)}` : `⚡ ishlayapti...`;

    existing.innerHTML = `
      <div class="lb-rank">${rankSymbol}</div>
      <div class="lb-emoji">${p.emoji}</div>
      <div class="lb-info">
        <div class="lb-name">${escapeHtml(p.name)}</div>
        <div class="lb-time">${timeText}</div>
        <div class="lb-bar-wrap">
          <div class="lb-bar" style="width: ${barW}%"></div>
        </div>
      </div>
      <div class="lb-score-wrap">
        <div class="lb-score">${p.score}/${p.total}</div>
        <div class="lb-percent">${pct}%</div>
      </div>
    `;

    // Move to correct position
    const currentItems = list.querySelectorAll('.lb-item');
    if (currentItems[i] !== existing) {
      list.insertBefore(existing, currentItems[i] || null);
    }
  });

  // Remove old items
  list.querySelectorAll('.lb-item').forEach(el => {
    if (!participants.find(p => String(p.id) === String(el.dataset.id))) {
      el.remove();
    }
  });
}

/* ======= BAR CHART ======= */
function updateBarChart(participants, totalQ) {
  if (!barChart) return;

  if (participants.length === 0) {
    barChart.data.labels = [];
    barChart.data.datasets[0].data = [];
    barChart.update();
    return;
  }

  const colors = [
    '#ffd60a','#c0c0c0','#cd7f32',
    '#00ff88','#4facfe','#b347ff','#ff6b35','#ff006e','#00d4ff','#a8ff3e'
  ];

  barChart.data.labels = participants.map(p => `${p.emoji} ${String(p.name || '').slice(0, 8)}`);
  barChart.data.datasets[0].data = participants.map(p => Number(p.score ?? 0));
  barChart.data.datasets[0].backgroundColor = participants.map((_, i) => colors[i % colors.length] + '33');
  barChart.data.datasets[0].borderColor = participants.map((_, i) => colors[i % colors.length]);

  // ✅ y o‘qi max: savollar soni bo‘lishi shart (0 bo‘lib qolsa chart buzilmasin)
  const maxY = Math.max(1, Number(totalQ || 0));
  barChart.options.scales.y.max = maxY;

  barChart.update('active');
}

/* ======= PIE CHART ======= */
function updatePieChart(participants) {
  if (!pieChart) return;

  let excellent = 0, good = 0, average = 0, poor = 0;

  participants.forEach(p => {
    const pct = Number(p.percentage ?? 0);
    if (pct >= 90) excellent++;
    else if (pct >= 60) good++;
    else if (pct >= 40) average++;
    else poor++;
  });

  pieChart.data.datasets[0].data = [excellent, good, average, poor];
  pieChart.update('active');
}

/* ======= PODIUM ======= */
function updatePodium(participants) {
  const wrap = document.getElementById('podiumWrap');

  if (participants.length === 0) {
    wrap.innerHTML = '<div class="podium-empty">Hali natijalar yo\'q</div>';
    return;
  }

  const top3 = participants.slice(0, 3);

  // Order: 2nd, 1st, 3rd
  const order = [1, 0, 2].map(i => top3[i]).filter(Boolean);

  wrap.innerHTML = '';
  order.forEach((p, i) => {
    const cls = i === 0 && top3.length > 1 ? 'podium-2nd'
      : (i === 1 || top3.length === 1) ? 'podium-1st'
      : 'podium-3rd';

    const medal = cls === 'podium-1st' ? '🥇' : cls === 'podium-2nd' ? '🥈' : '🥉';
    const ht = cls === 'podium-1st' ? '80px' : cls === 'podium-2nd' ? '60px' : '44px';

    const status = p.completed ? '' : ' <span style="opacity:.7;font-size:.85em">⚡</span>';

    const block = document.createElement('div');
    block.className = `podium-block ${cls}`;
    block.innerHTML = `
      <div class="podium-avatar">${p.emoji}</div>
      <div class="podium-name">${escapeHtml(p.name)}${status}</div>
      <div class="podium-score">${p.score}/${p.total}</div>
      <div class="podium-platform" style="height:${ht}">${medal}</div>
    `;
    wrap.appendChild(block);
  });
}

/* ======= TICKER ======= */
function updateTicker(participants) {
  const tickerWrap = document.getElementById('tickerWrap');
  const tickerContent = document.getElementById('tickerContent');

  if (participants.length === 0) {
    tickerWrap.style.display = 'none';
    return;
  }

  tickerWrap.style.display = 'flex';

  tickerContent.innerHTML = [...participants, ...participants].map(p =>
    `<span class="ticker-item">
      <span class="t-emoji">${p.emoji}</span>
      <span>${escapeHtml(p.name)}</span>
      <span class="t-score">${p.score}/${p.total} (${p.percentage}%)</span>
    </span>`
  ).join('<span class="ticker-item" style="opacity:.3">•</span>');
}

/* ======= RESET ======= */
async function resetAll() {
  if (!confirm('Barcha natijalarni o\'chirishni xohlaysizmi?')) return;
  await fetch('/api/reset/', { method: 'POST' });
  fetchResults();
}

/* ======= UTILS ======= */
function formatTime(seconds) {
  // seconds null bo‘lsa — tugatmagan
  if (seconds === null || seconds === undefined) return '—';
  const s = Number(seconds);
  if (Number.isNaN(s)) return '—';
  if (s < 60) return s + 's';
  return Math.floor(s / 60) + 'm ' + (s % 60) + 's';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}