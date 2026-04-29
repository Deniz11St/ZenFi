// import './style.css'
// import Chart from 'chart.js/auto'

// --- STATE MANAGEMENT ---
const APP_VERSION = '1.0.6';
const state = {
  currentPage: 'home',
  calendarDate: new Date().toISOString(),
  runs: JSON.parse(localStorage.getItem('zenfit_runs')) || [],
  profile: JSON.parse(localStorage.getItem('zenfit_profile')) || {
    weight: 80,
    height: 180,
    weightHistory: [{ date: new Date().toISOString(), weight: 80 }],
    startDate: new Date().toISOString()
  },
  plan: JSON.parse(localStorage.getItem('zenfit_plan')) || {
    runDays: 1,
    restDays: 3
  },
  timer: {
    isRunning: false,
    seconds: 0,
    interval: null
  },
  chat: [
    { role: 'sensei', text: 'Merhaba yolcu. Bugün bedenine ve ruhuna nasıl baktın?' }
  ]
};

window.changeMonth = (delta) => {
  const d = state.calendarDate ? new Date(state.calendarDate) : new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  state.calendarDate = d.toISOString();
  render();
};

window.updateDayData = (dateStr, field, value) => {
  const parts = dateStr.split('-');
  const localDate = new Date(parts[0], parts[1]-1, parts[2], 12);
  const isoDate = localDate.toISOString();
  
  if (field === 'weight') {
    let w = state.profile.weightHistory.find(w => {
      const wd = new Date(w.date);
      return wd.getFullYear() == parts[0] && wd.getMonth() == parts[1]-1 && wd.getDate() == parts[2];
    });
    
    if (w) w.weight = value;
    else if (value) state.profile.weightHistory.push({date: isoDate, weight: value});
    
    if (!value && w) {
      state.profile.weightHistory = state.profile.weightHistory.filter(item => item !== w);
    }
    
    state.profile.weightHistory.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (state.profile.weightHistory.length > 0) {
      state.profile.weight = state.profile.weightHistory[state.profile.weightHistory.length-1].weight;
    }
  } else {
    let r = state.runs.find(r => {
      const rd = new Date(r.date);
      return rd.getFullYear() == parts[0] && rd.getMonth() == parts[1]-1 && rd.getDate() == parts[2];
    });
    
    if (!r && value) {
      r = { date: isoDate, distance: '', duration: '', speed: '' };
      state.runs.push(r);
    }
    if (r) {
      r[field] = value;
      if (!r.distance && !r.duration && !r.speed) {
        state.runs = state.runs.filter(run => run !== r);
      }
    }
    state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
  }
  saveState();
};

const saveState = () => {
  localStorage.setItem('zenfit_runs', JSON.stringify(state.runs));
  localStorage.setItem('zenfit_profile', JSON.stringify(state.profile));
  localStorage.setItem('zenfit_plan', JSON.stringify(state.plan));
};

// --- UTILS ---
const formatTime = (s) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const calculateNextRun = () => {
  if (state.runs.length === 0) return new Date();
  const lastRun = new Date(state.runs[state.runs.length - 1].date);
  const nextRun = new Date(lastRun);
  const cycleLength = parseInt(state.plan.runDays) + parseInt(state.plan.restDays);
  nextRun.setDate(lastRun.getDate() + cycleLength);
  return nextRun;
};

// --- PAGES ---
const pages = {
  home: () => `
    <div class="dashboard-grid">
      <div class="glass-panel timer-card" style="grid-column: span 2;">
        <h3 class="dimmed">SİMDİ VE BURADA (KOŞU SAYACI)</h3>
        <div class="timer-display" id="timer-val">${formatTime(state.timer.seconds)}</div>
        <div style="display: flex; gap: 1rem; justify-content: center;">
          <button class="zen-btn" id="start-stop-btn">${state.timer.isRunning ? 'DURDUR' : 'BAŞLAT'}</button>
          <button class="zen-btn warrior" id="reset-btn">SIFIRLA</button>
        </div>
      </div>

      <div class="glass-panel" style="padding: 2rem;">
        <h3>MANUEL GİRİŞ</h3>
        <p class="dimmed" style="margin-bottom: 1.5rem;">Takvime veri işle.</p>
        <form id="run-form">
          <div class="input-group">
            <label>Mesafe (km)</label>
            <input type="number" step="0.1" id="run-dist" placeholder="0.0" required>
          </div>
          <div class="input-group">
            <label>Süre (dk)</label>
            <input type="number" id="run-time" placeholder="0" required>
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">KAYDET</button>
        </form>
      </div>
      
      <div class="glass-panel" style="padding: 2rem;">
        <h3>DURUM</h3>
        <div style="margin-top: 1rem;">
          <p class="dimmed">Son Koşu: <span style="color: var(--text-silk);">${state.runs.length > 0 ? new Date(state.runs[state.runs.length - 1].date).toLocaleDateString('tr-TR') : 'Henüz yok'}</span></p>
          <p class="dimmed">Gelecek Koşu: <span style="color: var(--primary-sage); font-weight: 600;">${calculateNextRun().toLocaleDateString('tr-TR')}</span></p>
          <div style="margin-top: 1.5rem; padding: 1rem; border-left: 2px solid var(--accent-gold); background: rgba(212, 175, 55, 0.05);">
            <small style="color: var(--accent-gold);">SENSEI DİYOR Kİ:</small>
            <p style="font-style: italic; font-size: 0.9rem;">"Bin millik bir yolculuk tek bir adımla başlar."</p>
          </div>
        </div>
      </div>
    </div>
  `,
  calendar: () => {
    const today = state.calendarDate ? new Date(state.calendarDate) : new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let daysHtml = '';
    for(let i = 1; i <= daysInMonth; i++) {
       const currentDay = new Date(year, month, i);
       const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
       
       const run = state.runs.find(r => {
         const runDate = new Date(r.date);
         return runDate.getFullYear() === year && runDate.getMonth() === month && runDate.getDate() === i;
       }) || { distance: '', duration: '', speed: '' };
       
       const weightObj = state.profile.weightHistory.find(w => {
         const wDate = new Date(w.date);
         return wDate.getFullYear() === year && wDate.getMonth() === month && wDate.getDate() === i;
       });
       const weight = weightObj ? weightObj.weight : '';
       
       const dayOfWeek = currentDay.toLocaleDateString('tr-TR', {weekday: 'short'});
       
       daysHtml += `
         <div class="calendar-day-row">
           <div class="day-label">
             <div style="font-size: 1.5rem; font-weight: 600;">${i}</div>
             <div style="font-size: 0.8rem; text-transform: uppercase;">${dayOfWeek}</div>
           </div>
           <div class="day-inputs">
             <div class="input-col"><small class="dimmed">Mesafe (km)</small><input type="number" step="0.1" placeholder="0" value="${run.distance || ''}" onchange="updateDayData('${dateStr}', 'distance', this.value)"></div>
             <div class="input-col"><small class="dimmed">Süre (dk)</small><input type="number" placeholder="0" value="${run.duration || ''}" onchange="updateDayData('${dateStr}', 'duration', this.value)"></div>
             <div class="input-col"><small class="dimmed">Hız (km/s)</small><input type="number" step="0.1" placeholder="0" value="${run.speed || ''}" onchange="updateDayData('${dateStr}', 'speed', this.value)"></div>
             <div class="input-col"><small class="dimmed">Kilo (kg)</small><input type="number" step="0.1" placeholder="0" value="${weight || ''}" onchange="updateDayData('${dateStr}', 'weight', this.value)"></div>
           </div>
         </div>
       `;
    }
    
    return `
      <div class="glass-panel" style="padding: 1rem 2rem 2rem 2rem; overflow: hidden; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding: 1.5rem 0; border-bottom: 1px solid var(--glass-border); position: sticky; top: 0; background: var(--bg-card); backdrop-filter: blur(20px); z-index: 10; margin-left: -2rem; margin-right: -2rem; padding-left: 2rem; padding-right: 2rem;">
          <button class="zen-btn" onclick="changeMonth(-1)">&larr; ÖNCEKİ</button>
          <h3 style="margin: 0; color: var(--primary-sage);">${today.toLocaleDateString('tr-TR', {month: 'long', year: 'numeric'}).toUpperCase()}</h3>
          <button class="zen-btn" onclick="changeMonth(1)">SONRAKİ &rarr;</button>
        </div>
        <div class="calendar-vertical">
          ${daysHtml}
        </div>
      </div>
    `;
  },
  coach: () => `
    <div class="glass-panel" style="padding: 2rem; min-height: 500px; display: flex; flex-direction: column; align-items: center;">
      <img src="./sensei.png" class="sensei-avatar" alt="Sensei">
      <h3 style="margin-bottom: 0.5rem;">SENSEI</h3>
      <p class="dimmed" style="margin-bottom: 2rem;">Dinginlikte güç, harekette huzur bul.</p>
      
      <div id="chat-box" style="flex: 1; width: 100%; overflow-y: auto; padding: 1.5rem; background: rgba(0,0,0,0.2); border-radius: 12px; display: flex; flex-direction: column; gap: 1rem;">
        ${state.chat.map(m => `
          <div class="message ${m.role}">${m.text}</div>
        `).join('')}
      </div>
      
      <div style="display: flex; gap: 1rem; width: 100%; margin-top: 1.5rem;">
        <input type="text" id="coach-input" placeholder="Bilgelik ara..." style="flex: 1;">
        <button class="zen-btn warrior" id="send-coach">SOR</button>
      </div>
    </div>
  `,
  wiki: () => `
    <div class="glass-panel" style="padding: 2rem;">
      <h3>SAĞLIKLI YAŞAM ANSİKLOPEDİSİ</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 2rem;">
        <div class="glass-panel" style="padding: 1.5rem; border-color: var(--primary-sage);">
          <h4 style="color: var(--primary-sage);">Temel Koşu</h4>
          <p class="dimmed" style="font-size: 0.9rem; margin-top: 0.5rem;">Koşu bandında %1 eğim kullanmak, dışarıdaki hava direncini simüle eder ve dizlere binen yükü dengeler.</p>
        </div>
        <div class="glass-panel" style="padding: 1.5rem;">
          <h4>Toparlanma (Rest)</h4>
          <p class="dimmed" style="font-size: 0.9rem; margin-top: 0.5rem;">Kaslar antrenman sırasında değil, dinlenme sırasında gelişir. 3 günlük boşluklar bu yüzden kritiktir.</p>
        </div>
        <div class="glass-panel" style="padding: 1.5rem;">
          <h4>Hidrasyon</h4>
          <p class="dimmed" style="font-size: 0.9rem; margin-top: 0.5rem;">Her 1 saatlik egzersiz için ekstra 500-700ml su tüketmeyi hedefleyin.</p>
        </div>
      </div>
    </div>
  `,
  settings: () => `
    <div class="dashboard-grid">
      <div class="glass-panel" style="padding: 2rem;">
        <h3>PROFİL AYARLARI</h3>
        <form id="settings-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>Güncel Kilo (kg)</label>
            <input type="number" id="set-weight" value="${state.profile.weight}">
          </div>
          <div class="input-group">
            <label>Boy (cm)</label>
            <input type="number" id="set-height" value="${state.profile.height}">
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">GÜNCELLE</button>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem;">
        <h3>AKIŞ PLANI (DÖNGÜ)</h3>
        <form id="plan-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>Koşu (Disiplin) Günü</label>
            <input type="number" id="set-run-days" value="${state.plan.runDays}" min="1">
          </div>
          <div class="input-group">
            <label>Dinlenme Günü</label>
            <input type="number" id="set-rest-days" value="${state.plan.restDays}" min="0">
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">PLANI GÜNCELLE</button>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem; grid-column: span 2;">
        <h3>KİLO DEĞİŞİMİ</h3>
        <canvas id="weightChart" style="width: 100%; height: 200px;"></canvas>
      </div>
    </div>
    
    <div class="glass-panel" style="padding: 2rem; margin-top: 2rem; text-align: center;">
      <h3>SİSTEM</h3>
      <p class="dimmed" style="margin-bottom: 0.5rem;">Mevcut Versiyon: v${APP_VERSION}</p>
      <button id="check-update-btn" class="zen-btn warrior" style="width: 100%; max-width: 300px; margin-top: 1rem;">GÜNCELLEMEYİ DENETLE</button>
    </div>
  `
};

// --- CORE LOGIC ---
const render = () => {
  const content = document.getElementById('main-content');
  content.innerHTML = pages[state.currentPage]();
  attachEvents();
  updateNav();
  if (state.currentPage === 'settings') initChart();
};

const updateNav = () => {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === state.currentPage);
  });
};

const initChart = () => {
  const ctx = document.getElementById('weightChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: state.profile.weightHistory.map(h => new Date(h.date).toLocaleDateString('tr-TR')),
      datasets: [{
        label: 'Kilo (kg)',
        data: state.profile.weightHistory.map(h => h.weight),
        borderColor: '#8BA888',
        backgroundColor: 'rgba(139, 168, 136, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#909090' } },
        x: { grid: { display: false }, ticks: { color: '#909090' } }
      }
    }
  });
};

const attachEvents = () => {
  // Nav
  document.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      state.currentPage = link.dataset.page;
      render();
    };
  });

  // Horizontal Scroll with Mouse Wheel
  document.querySelectorAll('.day-inputs').forEach(el => {
    el.addEventListener('wheel', (e) => {
      if (el.scrollWidth > el.clientWidth) {
        if ((e.deltaY > 0 && el.scrollLeft < el.scrollWidth - el.clientWidth) ||
            (e.deltaY < 0 && el.scrollLeft > 0)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY;
        }
      }
    });
  });

  // Timer
  const timerBtn = document.getElementById('start-stop-btn');
  if (timerBtn) {
    timerBtn.onclick = toggleTimer;
    document.getElementById('reset-btn').onclick = resetTimer;
  }

  // Run Form
  const runForm = document.getElementById('run-form');
  if (runForm) {
    runForm.onsubmit = (e) => {
      e.preventDefault();
      const run = {
        date: new Date().toISOString(),
        distance: document.getElementById('run-dist').value,
        duration: document.getElementById('run-time').value
      };
      state.runs.push(run);
      saveState();
      render();
    };
  }

  // Settings
  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.onsubmit = (e) => {
      e.preventDefault();
      const newWeight = document.getElementById('set-weight').value;
      state.profile.weight = newWeight;
      state.profile.height = document.getElementById('set-height').value;
      state.profile.weightHistory.push({ date: new Date().toISOString(), weight: newWeight });
      saveState();
      render();
    };
  }

  // Plan Settings
  const planForm = document.getElementById('plan-form');
  if (planForm) {
    planForm.onsubmit = (e) => {
      e.preventDefault();
      state.plan.runDays = document.getElementById('set-run-days').value;
      state.plan.restDays = document.getElementById('set-rest-days').value;
      saveState();
      render();
    };
  }

  // Update App
  const checkUpdateBtn = document.getElementById('check-update-btn');
  if (checkUpdateBtn) {
    checkUpdateBtn.onclick = async () => {
      checkUpdateBtn.innerText = 'DENETLENİYOR...';
      try {
        const response = await fetch('./package.json?t=' + new Date().getTime());
        if (response.ok) {
          const data = await response.json();
          if (data.version && data.version !== APP_VERSION) {
            const wantUpdate = confirm('Yeni bir versiyon bulundu (v' + data.version + ')! Uygulamayı şimdi güncellemek istiyor musunuz?');
            if (wantUpdate) {
              checkUpdateBtn.innerText = 'GÜNCELLENİYOR...';
              if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
              }
              if ('caches' in window) {
                const keys = await caches.keys();
                for (let key of keys) await caches.delete(key);
              }
              window.location.reload(true);
            } else {
              checkUpdateBtn.innerText = 'GÜNCELLEMEYİ DENETLE';
            }
          } else {
            alert('Uygulamanız zaten güncel (v' + APP_VERSION + ')');
            checkUpdateBtn.innerText = 'GÜNCELLEMEYİ DENETLE';
          }
        } else {
          throw new Error('Fetch failed');
        }
      } catch (err) {
        console.error('Güncelleme hatası:', err);
        alert('Güncelleme denetlenirken bir hata oluştu. Bağlantınızı kontrol edin.');
        checkUpdateBtn.innerText = 'GÜNCELLEMEYİ DENETLE';
      }
    };
  }

  // Coach
  const coachInput = document.getElementById('coach-input');
  const sendBtn = document.getElementById('send-coach');
  if (sendBtn) {
    sendBtn.onclick = async () => {
      const text = coachInput.value;
      if (!text) return;
      
      state.chat.push({ role: 'user', text });
      coachInput.value = '';
      render();

      // Simulate AI thinking
      setTimeout(() => {
        const responses = [
          "Disiplin, zihnin en büyük zaferidir. Bugün harika bir adım attın.",
          "Vücudun senin tapınağın. Onu hem eğit hem de dinlendir.",
          "Sabır, başarının gizli baharatıdır. 3 günlük dinlenmelerini ihmal etme.",
          "Mesafe sadece bir rakamdır, önemli olan senin o yolda oluşun."
        ];
        const randomResp = responses[Math.floor(Math.random() * responses.length)];
        state.chat.push({ role: 'sensei', text: randomResp });
        render();
      }, 1000);
    };
  }
};

const toggleTimer = () => {
  if (state.timer.isRunning) {
    clearInterval(state.timer.interval);
    state.timer.isRunning = false;
  } else {
    state.timer.isRunning = true;
    state.timer.interval = setInterval(() => {
      state.timer.seconds++;
      const val = document.getElementById('timer-val');
      if (val) val.innerText = formatTime(state.timer.seconds);
    }, 1000);
  }
  render();
};

const resetTimer = () => {
  clearInterval(state.timer.interval);
  state.timer.isRunning = false;
  state.timer.seconds = 0;
  render();
};

// Initialize
render();
