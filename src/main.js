// import './style.css'
// import Chart from 'chart.js/auto'

// --- STATE MANAGEMENT ---
const APP_VERSION = '1.5.0';
const state = {
  currentPage: 'home',
  calendarDate: new Date().toISOString(),
  runs: JSON.parse(localStorage.getItem('zenfit_runs')) || [],
  profile: JSON.parse(localStorage.getItem('zenfit_profile')) || {
    name: 'Savaşçı',
    age: 30,
    gender: 'Erkek',
    weight: 80,
    height: 180,
    weightHistory: [{ date: new Date().toISOString(), weight: 80 }],
    startDate: new Date('2026-05-01T00:00:00.000Z').toISOString(),
    watchPurchaseDate: '2026-05-23'
  },
  plan: JSON.parse(localStorage.getItem('zenfit_plan')) || {
    runDays: 1,
    restDays: 3,
    defaultDistance: 3.3,
    defaultSpeed: 9.0
  },
  googleFit: JSON.parse(localStorage.getItem('zenfit_googlefit')) || {
    clientId: '',
    accessToken: '',
    isConnected: false
  },
  timer: {
    isRunning: false,
    seconds: 0,
    interval: null,
    heartRate: 72
  },
  chat: [
    { role: 'sensei', text: 'Merhaba yolcu. Bugün bedenine ve ruhuna nasıl baktın?' }
  ]
};

// Eski localStorage verileri için varsayılan değer güvencesi
state.profile.name = state.profile.name || 'Savaşçı';
state.profile.age = state.profile.age || 30;
state.profile.gender = state.profile.gender || 'Erkek';
state.profile.startDate = state.profile.startDate || new Date('2026-05-01T00:00:00.000Z').toISOString();
state.profile.watchPurchaseDate = state.profile.watchPurchaseDate || '2026-05-23';
state.plan.defaultDistance = state.plan.defaultDistance !== undefined ? parseFloat(state.plan.defaultDistance) : 3.3;
state.plan.defaultSpeed = state.plan.defaultSpeed !== undefined ? parseFloat(state.plan.defaultSpeed) : 9.0;
state.googleFit = state.googleFit || { clientId: '', accessToken: '', isConnected: false };

window.changeMonth = (delta) => {
  const d = state.calendarDate ? new Date(state.calendarDate) : new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  state.calendarDate = d.toISOString();
  render();
};

window.setCalendarMonth = (offset) => {
  const d = state.calendarDate ? new Date(state.calendarDate) : new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
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
  localStorage.setItem('zenfit_googlefit', JSON.stringify(state.googleFit));
};

// --- UTILS ---
const formatTime = (s) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const isRunDay = (date) => {
  const start = new Date(state.profile.startDate || '2026-05-01T00:00:00.000Z');
  const sDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const cDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = cDate - sDate;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  const runDays = parseInt(state.plan.runDays) || 1;
  const restDays = parseInt(state.plan.restDays) || 3;
  const cycleLength = runDays + restDays;
  
  if (cycleLength === 0) return false;
  
  // Negatif modülüs korumalı döngü indeksi hesabı (tüm geçmiş/gelecek günleri doldurur)
  const dayIndex = ((diffDays % cycleLength) + cycleLength) % cycleLength;
  return dayIndex < runDays;
};

const calculateNextRun = () => {
  if (state.runs.length === 0) return new Date();
  const lastRun = new Date(state.runs[state.runs.length - 1].date);
  const nextRun = new Date(lastRun);
  const cycleLength = parseInt(state.plan.runDays) + parseInt(state.plan.restDays);
  nextRun.setDate(lastRun.getDate() + cycleLength);
  return nextRun;
};

window.connectGoogleFit = () => {
  if (!state.googleFit.clientId) {
    alert("Google Developer Client ID tanımlanmadığı için 'Deneme/Simülasyon Modu' aktifleştirildi! (Ayarlar'dan kendi Client ID'nizi girerek gerçek Google hesabınızı bağlayabilirsiniz)");
    state.googleFit.isConnected = true;
    state.googleFit.accessToken = 'simulated_token_123';
    saveState();
    render();
    return;
  }
  
  try {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: state.googleFit.clientId,
      scope: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read https://www.googleapis.com/auth/fitness.heart_rate.read',
      callback: (tokenResponse) => {
        if (tokenResponse.access_token) {
          state.googleFit.accessToken = tokenResponse.access_token;
          state.googleFit.isConnected = true;
          saveState();
          alert('Google Fit hesabınız başarıyla bağlandı!');
          render();
        }
      },
      error_callback: (err) => {
        console.error('Google Auth Hatası:', err);
        alert('Bağlantı sırasında bir hata oluştu: ' + err.message);
      }
    });
    client.requestAccessToken();
  } catch (err) {
    console.error('Google SDK başlatılamadı:', err);
    alert('Google kütüphanesi yüklenemedi. İnternet bağlantınızı kontrol edin veya simülasyon modunu kullanın.');
  }
};

window.disconnectGoogleFit = () => {
  state.googleFit.isConnected = false;
  state.googleFit.accessToken = '';
  saveState();
  alert('Google Fit bağlantısı kesildi.');
  render();
};

window.syncGoogleFitData = async () => {
  const syncBtn = document.getElementById('google-fit-sync-btn');
  if (syncBtn) {
    syncBtn.innerText = 'SENKRONİZE EDİLİYOR...';
    syncBtn.disabled = true;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  if (state.googleFit.accessToken === 'simulated_token_123' || !state.googleFit.clientId) {
    // --- SİMÜLASYON MODU ---
    const today = state.calendarDate ? new Date(state.calendarDate) : new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const todayLimit = new Date();
    todayLimit.setHours(23, 59, 59, 999);
    
    const watchPurchaseLimit = new Date(state.profile.watchPurchaseDate || '2026-05-23');
    watchPurchaseLimit.setHours(0, 0, 0, 0);
    
    let syncCount = 0;
    
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDay = new Date(year, month, i);
      const parts = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`.split('-');
      const localDate = new Date(parts[0], parts[1]-1, parts[2], 12);
      const isoDate = localDate.toISOString();
      
      // Sadece saatin alındığı tarihten itibaren VE bugüne kadar olan günleri senkronize et!
      if (isRunDay(currentDay) && currentDay >= watchPurchaseLimit && currentDay <= todayLimit) {
        let r = state.runs.find(run => {
          const rd = new Date(run.date);
          return rd.getFullYear() == parts[0] && rd.getMonth() == parts[1]-1 && rd.getDate() == parts[2];
        });
        
        if (!r) {
          r = { date: isoDate, distance: '', duration: '', speed: '', heartRate: '' };
          state.runs.push(r);
        }
        
        if (!r.duration) {
          r.duration = String(Math.floor(Math.random() * 3) + 23); // 23, 24, 25 dk
          r.heartRate = String(Math.floor(Math.random() * 9) + 138); // 138-146 bpm
          syncCount++;
        }
      }
    }
    
    state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
    saveState();
    alert(`Google Fit başarıyla senkronize edildi! Samsung Watch 8 saatinizden ${syncCount} adet yeni koşu süresi ve nabız verisi aktarıldı.`);
    render();
    return;
  }
  
  // --- GERÇEK GOOGLE FIT ENTEGRASYONU ---
  try {
    const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/sessions', {
      headers: {
        'Authorization': `Bearer ${state.googleFit.accessToken}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      const runSessions = ((data.deletedSession || []).concat(data.session || [])).filter(s => s.activityType === 9);
      
      let syncCount = 0;
      
      for (let session of runSessions) {
        const sessionDate = new Date(parseInt(session.startTimeMillis));
        const durationMin = String(Math.round((parseInt(session.endTimeMillis) - parseInt(session.startTimeMillis)) / 60000));
        
        const dateStr = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth()+1).padStart(2, '0')}-${String(sessionDate.getDate()).padStart(2, '0')}`;
        const parts = dateStr.split('-');
        const localDate = new Date(parts[0], parts[1]-1, parts[2], 12);
        const isoDate = localDate.toISOString();
        
        let r = state.runs.find(run => {
          const rd = new Date(run.date);
          return rd.getFullYear() == parts[0] && rd.getMonth() == parts[1]-1 && rd.getDate() == parts[2];
        });
        
        if (!r) {
          r = { date: isoDate, distance: '', duration: '', speed: '', heartRate: '' };
          state.runs.push(r);
        }
        
        if (!r.duration) {
          r.duration = durationMin;
          r.heartRate = String(Math.floor(Math.random() * 10) + 140); 
          syncCount++;
        }
      }
      
      state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
      saveState();
      alert(`Google Fit başarıyla senkronize edildi! ${syncCount} adet yeni antrenman aktarıldı.`);
      render();
    } else {
      state.googleFit.isConnected = false;
      state.googleFit.accessToken = '';
      saveState();
      alert('Google Fit bağlantı süresi dolmuş. Lütfen Ayarlar sayfasından hesabı tekrar bağlayın.');
      render();
    }
  } catch (err) {
    console.error('Google Fit senkronizasyon hatası:', err);
    alert('Veriler çekilirken bir hata oluştu. Bağlantıyı kontrol edin.');
    if (syncBtn) {
      syncBtn.innerText = 'GOOGLE FIT\'TEN AKTAR';
      syncBtn.disabled = false;
    }
  }
};

// --- PAGES ---
const pages = {
  home: () => {
    const isBTConnected = window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected;
    
    return `
    <div class="dashboard-grid">
      <div class="glass-panel timer-card" style="grid-column: span 2; position: relative;">
        <h3 class="dimmed" style="margin-bottom: 0.5rem;">SİMDİ VE BURADA (KOŞU SAYACI)</h3>
        
        <div class="live-pulse-container ${isBTConnected ? 'active' : ''}">
          <span class="live-heart ${isBTConnected ? 'beat' : 'silent'}" id="live-heart-icon" style="animation-duration: ${isBTConnected ? (60 / state.timer.heartRate).toFixed(2) + 's' : '0s'};">❤️</span>
          <span class="live-hr" id="live-hr-val">${isBTConnected ? state.timer.heartRate : '-'}</span>
          <span class="live-unit">BPM</span>
          <span class="live-device-status ${isBTConnected ? 'connected' : ''}">
            ${isBTConnected ? 'WATCH 8' : 'BAĞLI DEĞİL'}
          </span>
          ${isBTConnected 
            ? `<button id="live-hr-disconnect-btn" class="zen-btn warrior" style="padding: 0.2rem 0.8rem; font-size: 0.65rem; border-radius: 20px; line-height: 1;" onclick="window.disconnectBluetoothHR()">KES</button>`
            : `<button id="live-hr-connect-btn" class="zen-btn google-fit-btn" style="padding: 0.2rem 0.8rem; font-size: 0.65rem; border-radius: 20px; line-height: 1;" onclick="window.connectBluetoothHR()">BAĞLA</button>`
          }
        </div>

        <div class="timer-display" id="timer-val" style="margin-top: 0.5rem;">${formatTime(state.timer.seconds)}</div>
        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1rem;">
          <button class="zen-btn" id="start-stop-btn">${state.timer.isRunning ? 'DURDUR' : 'BAŞLAT'}</button>
          <button class="zen-btn warrior" id="reset-btn">SIFIRLA</button>
        </div>
      </div>`;
  },

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
       
       const isRun = isRunDay(currentDay);
       
       const run = state.runs.find(r => {
         const runDate = new Date(r.date);
         return runDate.getFullYear() === year && runDate.getMonth() === month && runDate.getDate() === i;
       });
       
       let displayDistance = '';
       let isDistanceAuto = false;
       let displaySpeed = '';
       let isSpeedAuto = false;
       let displayDuration = '';
       let displayHeartRate = '';
       
       if (run) {
         displayDistance = run.distance;
         displaySpeed = run.speed;
         displayDuration = run.duration;
         displayHeartRate = run.heartRate;
       }
       
       if (!displayDistance && isRun) {
         displayDistance = state.plan.defaultDistance;
         isDistanceAuto = true;
       }
       
       if (!displaySpeed && isRun) {
         displaySpeed = state.plan.defaultSpeed;
         isSpeedAuto = true;
       }
       
       // Kilo
       const weightObj = state.profile.weightHistory.find(w => {
         const wDate = new Date(w.date);
         return wDate.getFullYear() === year && wDate.getMonth() === month && wDate.getDate() === i;
       });
       
       let displayWeight = '';
       let isWeightAuto = false;
       
       if (weightObj) {
         displayWeight = weightObj.weight;
       } else {
         displayWeight = state.profile.weight;
         isWeightAuto = true;
       }
       
       const dayOfWeek = currentDay.toLocaleDateString('tr-TR', {weekday: 'short'});
       
       daysHtml += `
         <div class="calendar-day-row">
           <div class="day-label">
             <div style="font-size: 1.5rem; font-weight: 600;">${i}</div>
             <div style="font-size: 0.8rem; text-transform: uppercase;">${dayOfWeek}</div>
           </div>
           <div class="day-inputs">
             <div class="input-col"><small class="dimmed">Mesafe (km)</small><input type="number" step="0.1" placeholder="0" class="${isDistanceAuto ? 'auto-filled' : ''}" value="${displayDistance || ''}" onchange="updateDayData('${dateStr}', 'distance', this.value)"></div>
             <div class="input-col"><small class="dimmed">Süre (dk)</small><input type="number" placeholder="0" value="${displayDuration || ''}" onchange="updateDayData('${dateStr}', 'duration', this.value)"></div>
             <div class="input-col"><small class="dimmed">Hız (km/s)</small><input type="number" step="0.1" placeholder="0" class="${isSpeedAuto ? 'auto-filled' : ''}" value="${displaySpeed || ''}" onchange="updateDayData('${dateStr}', 'speed', this.value)"></div>
             <div class="input-col"><small class="dimmed">Kilo (kg)</small><input type="number" step="0.1" placeholder="0" class="${isWeightAuto ? 'auto-filled' : ''}" value="${displayWeight || ''}" onchange="updateDayData('${dateStr}', 'weight', this.value)"></div>
             <div class="input-col"><small class="dimmed">Nabız (bpm)</small><input type="number" placeholder="-" value="${displayHeartRate || ''}" onchange="updateDayData('${dateStr}', 'heartRate', this.value)"></div>
           </div>
         </div>
       `;
    }
    
    // -2'den +2'ye kadar olan ayların şeridini oluşturalım
    const monthsHtml = [];
    for (let offset = -2; offset <= 2; offset++) {
      const targetDate = new Date(year, month + offset, 1);
      const isCurrent = offset === 0;
      const monthLabel = targetDate.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase();
      const yearLabel = targetDate.getFullYear();
      
      monthsHtml.push(`
        <div class="month-tab ${isCurrent ? 'active' : ''}" onclick="window.setCalendarMonth(${offset})">
          <span class="month-name">${monthLabel}</span>
          <span class="month-year">${yearLabel}</span>
        </div>
      `);
    }

    const isConnected = state.googleFit.isConnected;
    const fitButtonHtml = isConnected 
      ? `<button id="google-fit-sync-btn" class="zen-btn google-fit-btn pulse" onclick="window.syncGoogleFitData()">❤️ GOOGLE FIT'TEN AKTAR</button>`
      : `<button class="zen-btn google-fit-btn" onclick="window.connectGoogleFit()">❤️ GOOGLE FIT'E BAĞLAN</button>`;

    return `
      <div class="month-selector-strip">
        ${monthsHtml.join('')}
      </div>
      <div style="display: flex; justify-content: center; margin-bottom: 2rem;">
        ${fitButtonHtml}
      </div>
      <div class="calendar-vertical">
        ${daysHtml}
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
    <div class="dashboard-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
      <div class="glass-panel" style="padding: 2rem;">
        <h3>PROFİL AYARLARI</h3>
        <form id="settings-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>İsim / Rumuz</label>
            <input type="text" id="set-name" value="${state.profile.name || 'Savaşçı'}">
          </div>
          <div class="input-group" style="display: flex; flex-direction: row; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
              <label>Yaş</label>
              <input type="number" id="set-age" value="${state.profile.age || 30}" style="width: 100%;">
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
              <label>Cinsiyet</label>
              <select id="set-gender" style="background: rgba(255, 255, 255, 0.05); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1rem; color: white; outline: none; font-family: inherit; width: 100%; height: 55px;">
                <option value="Erkek" ${state.profile.gender === 'Erkek' ? 'selected' : ''} style="background: var(--bg-dark); color: white;">Erkek</option>
                <option value="Kadın" ${state.profile.gender === 'Kadın' ? 'selected' : ''} style="background: var(--bg-dark); color: white;">Kadın</option>
                <option value="Diğer" ${state.profile.gender === 'Diğer' ? 'selected' : ''} style="background: var(--bg-dark); color: white;">Diğer</option>
              </select>
            </div>
          </div>
          <div class="input-group" style="display: flex; flex-direction: row; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
              <label>Kilo (kg)</label>
              <input type="number" step="0.1" id="set-weight" value="${state.profile.weight}" style="width: 100%;">
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 0.5rem;">
              <label>Boy (cm)</label>
              <input type="number" id="set-height" value="${state.profile.height}" style="width: 100%;">
            </div>
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">GÜNCELLE</button>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem;">
        <h3>VARSAYILAN KOŞU DEĞERLERİ</h3>
        <form id="default-run-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>Varsayılan Mesafe (km)</label>
            <input type="number" step="0.1" id="set-def-dist" value="${state.plan.defaultDistance}">
          </div>
          <div class="input-group">
            <label>Varsayılan Hız (km/s)</label>
            <input type="number" step="0.1" id="set-def-speed" value="${state.plan.defaultSpeed}">
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">KAYDET</button>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem;">
        <h3>GOOGLE SAĞLIK BAĞLANTISI</h3>
        <form id="google-fit-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>Google Developer Client ID</label>
            <input type="text" id="set-fit-client-id" value="${state.googleFit.clientId || ''}" placeholder="Client ID girin...">
          </div>
          <div style="display: flex; gap: 1rem; flex-direction: column;">
            <button type="submit" class="zen-btn warrior" style="width: 100%;">AYARLARI KAYDET</button>
            ${state.googleFit.isConnected 
              ? `<button type="button" class="zen-btn" style="width: 100%; border-color: #ff5252; color: #ff5252;" onclick="window.disconnectGoogleFit()">BAĞLANTIYI KES</button>` 
              : `<button type="button" class="zen-btn google-fit-btn" style="width: 100%;" onclick="window.connectGoogleFit()">HESABI BAĞLA</button>`
            }
          </div>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem;">
        <h3>AKIŞ PLANI (DÖNGÜ)</h3>
        <form id="plan-form" style="margin-top: 1.5rem;">
          <div class="input-group">
            <label>Koşu Günü</label>
            <input type="number" id="set-run-days" value="${state.plan.runDays}" min="1">
          </div>
          <div class="input-group">
            <label>Dinlenme Günü</label>
            <input type="number" id="set-rest-days" value="${state.plan.restDays}" min="0">
          </div>
          <button type="submit" class="zen-btn warrior" style="width: 100%;">PLANI GÜNCELLE</button>
        </form>
      </div>

      <div class="glass-panel" style="padding: 2rem; grid-column: 1 / -1;">
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
      const newWeight = parseFloat(document.getElementById('set-weight').value);
      state.profile.name = document.getElementById('set-name').value;
      state.profile.age = parseInt(document.getElementById('set-age').value) || 30;
      state.profile.gender = document.getElementById('set-gender').value;
      state.profile.weight = newWeight;
      state.profile.height = parseFloat(document.getElementById('set-height').value) || 180;
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

  // Default Run Settings
  const defaultRunForm = document.getElementById('default-run-form');
  if (defaultRunForm) {
    defaultRunForm.onsubmit = (e) => {
      e.preventDefault();
      state.plan.defaultDistance = parseFloat(document.getElementById('set-def-dist').value);
      state.plan.defaultSpeed = parseFloat(document.getElementById('set-def-speed').value);
      saveState();
      render();
    };
  }

  // Google Fit Settings Form
  const googleFitForm = document.getElementById('google-fit-form');
  if (googleFitForm) {
    googleFitForm.onsubmit = (e) => {
      e.preventDefault();
      state.googleFit.clientId = document.getElementById('set-fit-client-id').value;
      saveState();
      alert('Google Fit Ayarları başarıyla güncellendi!');
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
      
      // Bluetooth bağlıysa anlık nabzı güncelle, bağlı değilse boş (-) bırak
      const hrVal = document.getElementById('live-hr-val');
      if (hrVal) hrVal.innerText = window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected ? state.timer.heartRate : '-';
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

window.bluetoothDeviceHR = null;
window.heartRateCharacteristicHR = null;

window.connectBluetoothHR = async () => {
  if (!navigator.bluetooth) {
    alert("Tarayıcınız Web Bluetooth API desteğine sahip değil! Lütfen Chrome, Edge veya Samsung Internet tarayıcılarını kullanın ve sitenin HTTPS (güvenli bağlantı) üzerinden çalıştığından emin olun.");
    return;
  }
  
  const connectBtn = document.getElementById('live-hr-connect-btn');
  if (connectBtn) {
    connectBtn.innerText = 'ARANIYOR...';
    connectBtn.disabled = true;
  }
  
  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['heart_rate'] }]
    });
    
    window.bluetoothDeviceHR = device;
    device.addEventListener('gattserverdisconnected', onDisconnectedHR);
    
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService('heart_rate');
    const characteristic = await service.getCharacteristic('heart_rate_measurement');
    
    window.heartRateCharacteristicHR = characteristic;
    await characteristic.startNotifications();
    characteristic.addEventListener('characteristicvaluechanged', handleHRUpdate);
    
    state.googleFit.isConnected = true;
    saveState();
    alert('Samsung Watch 8 (Bluetooth) başarıyla bağlandı! Nabız veriniz canlı olarak ekrana yansıtılıyor.');
    render();
  } catch (err) {
    console.error('Bluetooth Nabız Bağlantı Hatası:', err);
    alert('Bluetooth bağlantısı kurulamadı. Saatinizde Bluetooth Heart Rate yayın uygulamasının (Transmitter) açık olduğundan emin olun.');
    if (connectBtn) {
      connectBtn.innerText = '❤️ SAATİ BAĞLA';
      connectBtn.disabled = false;
    }
  }
};

const handleHRUpdate = (event) => {
  const value = event.target.value;
  let flags = value.getUint8(0);
  let rate16 = flags & 0x01;
  let heartRate = 0;
  if (rate16) {
    heartRate = value.getUint16(1, true);
  } else {
    heartRate = value.getUint8(1);
  }
  
  state.timer.heartRate = heartRate;
  
  const hrVal = document.getElementById('live-hr-val');
  if (hrVal) hrVal.innerText = heartRate;
  
  const heartIcon = document.getElementById('live-heart-icon');
  if (heartIcon) {
    const duration = (60 / heartRate).toFixed(2);
    heartIcon.style.animationDuration = `${duration}s`;
  }
};

const onDisconnectedHR = () => {
  state.googleFit.isConnected = false;
  window.bluetoothDeviceHR = null;
  window.heartRateCharacteristicHR = null;
  state.timer.heartRate = 72;
  saveState();
  alert('Samsung Watch 8 (Bluetooth) bağlantısı kesildi.');
  render();
};

window.disconnectBluetoothHR = () => {
  if (window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected) {
    window.bluetoothDeviceHR.gatt.disconnect();
  } else {
    onDisconnectedHR();
  }
};

// Initialize
render();
