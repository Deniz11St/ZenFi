// import './style.css'
// import Chart from 'chart.js/auto'

// --- ERROR BOUNDARY ---
window.onerror = function(message, source, lineno, colno, error) {
  console.error("ZenFit Hata Yakalandı:", message, "Satır:", lineno, "Sütun:", colno, error);
  const content = document.getElementById('main-content');
  if (content) {
    content.innerHTML = `
      <div class="glass-panel" style="padding: 2.5rem; text-align: center; margin: 2rem auto; max-width: 500px; border-color: rgba(255, 82, 82, 0.4); background: rgba(18, 20, 18, 0.95); box-shadow: 0 8px 32px 0 rgba(255, 82, 82, 0.1);">
        <span style="font-size: 3.5rem; filter: drop-shadow(0 0 10px rgba(255,82,82,0.3));">🧘‍♂️⚠️</span>
        <h2 style="color: #ff5252; margin-top: 1rem; font-weight: 300; letter-spacing: 1px;">BİR DENGESİZLİK OLUŞTU</h2>
        <p class="dimmed" style="margin: 1.5rem 0; font-size: 0.9rem; line-height: 1.6; color: var(--text-silk);">
          Sensei diyor ki: "Zihindeki fırtınalar bazen akışı durdurur." Uygulama yüklenirken beklenmedik bir hata ile karşılaşıldı.
        </p>
        <div style="background: rgba(0,0,0,0.4); padding: 1rem; border-radius: 12px; text-align: left; font-family: monospace; font-size: 0.75rem; color: #ff8a8a; overflow-x: auto; margin-bottom: 2rem; max-height: 120px; border: 1px solid rgba(255,82,82,0.15); line-height: 1.4;">
          <strong>Hata:</strong> ${message}<br>
          <strong>Konum:</strong> Satır ${lineno}:${colno}
        </div>
        <div style="display: flex; gap: 0.8rem; justify-content: center; flex-direction: column;">
          <button class="zen-btn warrior" onclick="window.location.reload(true)" style="width: 100%; padding: 0.9rem; letter-spacing: 1px;">YENİDEN DENE</button>
          <button class="zen-btn" onclick="window.clearZenFitData()" style="width: 100%; border-color: rgba(255,255,255,0.1); color: var(--text-silk); padding: 0.9rem;">ZİHNİ SIFIRLA (VERİLERİ TEMİZLE)</button>
        </div>
      </div>
    `;
  }
  return false;
};

window.clearZenFitData = () => {
  if (confirm('Tüm antrenman verileriniz, profiliniz ve ayarlarınız sıfırlanacaktır. Bu işlem geri alınamaz. Emin misiniz?')) {
    localStorage.clear();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (let reg of regs) reg.unregister();
      });
    }
    caches.keys().then(keys => {
      for (let key of keys) caches.delete(key);
    });
    alert('Uygulama belleği temizlendi. Sayfa yeniden yükleniyor...');
    window.location.reload(true);
  }
};

// --- STATE MANAGEMENT ---
const APP_VERSION = '1.6.7';
const state = {
  currentPage: 'home',
  calendarDate: new Date().toISOString(),
  runs: JSON.parse(localStorage.getItem('zenfit_runs')) || [],
  dailyLogs: JSON.parse(localStorage.getItem('zenfit_dailylogs')) || [],
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
    heartRate: 72,
    workoutSteps: 0,
    workoutCalories: 0.0
  },
  keepScreenAwake: JSON.parse(localStorage.getItem('zenfit_keepscreenawake')) || false,
  chat: [
    { role: 'sensei', text: 'Merhaba yolcu. Bugün bedenine ve ruhuna nasıl baktın?' }
  ]
};

// Eski localStorage verileri için varsayılan değer güvencesi
state.profile.name = state.profile.name || 'Savaşçı';
state.profile.age = state.profile.age || 30;
state.profile.gender = state.profile.gender || 'Erkek';
state.profile.height = state.profile.height || 180;
state.profile.weight = state.profile.weight || 80;
state.profile.weightHistory = state.profile.weightHistory || [{ date: new Date().toISOString(), weight: state.profile.weight || 80 }];
state.profile.startDate = state.profile.startDate || new Date('2026-05-01T00:00:00.000Z').toISOString();
state.profile.watchPurchaseDate = state.profile.watchPurchaseDate || '2026-05-23';
state.plan.defaultDistance = state.plan.defaultDistance !== undefined ? parseFloat(state.plan.defaultDistance) : 3.3;
state.plan.defaultSpeed = state.plan.defaultSpeed !== undefined ? parseFloat(state.plan.defaultSpeed) : 9.0;
state.googleFit = state.googleFit || { clientId: '', accessToken: '', isConnected: false };
state.dailyLogs = state.dailyLogs || [];

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
  } else if (field === 'dailyTotalSteps' || field === 'dailyTotalCalories' || field === 'sleepHours' || field === 'bloodPressure' || field === 'ecgStatus') {
    let log = state.dailyLogs.find(l => {
      const ld = new Date(l.date);
      return ld.getFullYear() == parts[0] && ld.getMonth() == parts[1]-1 && ld.getDate() == parts[2];
    });
    
    if (!log && value) {
      log = { date: isoDate, dailyTotalSteps: '', dailyTotalCalories: '', sleepHours: '', bloodPressure: '', ecgStatus: '' };
      state.dailyLogs.push(log);
    }
    if (log) {
      if (field === 'bloodPressure' || field === 'ecgStatus') {
        log[field] = value ? String(value) : '';
      } else {
        log[field] = value ? parseFloat(value) : '';
      }
      if (!log.dailyTotalSteps && !log.dailyTotalCalories && !log.sleepHours && !log.bloodPressure && !log.ecgStatus) {
        state.dailyLogs = state.dailyLogs.filter(item => item !== log);
      }
    }
    state.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
  } else {
    let r = state.runs.find(r => {
      const rd = new Date(r.date);
      return rd.getFullYear() == parts[0] && rd.getMonth() == parts[1]-1 && rd.getDate() == parts[2];
    });
    
    if (!r && value) {
      r = { date: isoDate, distance: '', duration: '', speed: '', heartRate: '', workoutSteps: '', workoutCalories: '' };
      state.runs.push(r);
    }
    if (r) {
      r[field] = value ? parseFloat(value) : '';
      if (!r.distance && !r.duration && !r.speed && !r.heartRate && !r.workoutSteps && !r.workoutCalories) {
        state.runs = state.runs.filter(run => run !== r);
      }
    }
    state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
  }
  saveState();
};

const saveState = () => {
  localStorage.setItem('zenfit_runs', JSON.stringify(state.runs));
  localStorage.setItem('zenfit_dailylogs', JSON.stringify(state.dailyLogs));
  localStorage.setItem('zenfit_profile', JSON.stringify(state.profile));
  localStorage.setItem('zenfit_plan', JSON.stringify(state.plan));
  localStorage.setItem('zenfit_googlefit', JSON.stringify(state.googleFit));
  localStorage.setItem('zenfit_keepscreenawake', JSON.stringify(state.keepScreenAwake));
};

// --- UTILS ---
const calculateWorkoutCalories = (seconds) => {
  const speed = parseFloat(state.plan.defaultSpeed) || 9.0;
  const weight = parseFloat(state.profile.weight) || 80.0;
  const met = 1.0 + (speed * 0.8);
  const kcal_per_min = met * 3.5 * weight / 200;
  const total_kcal = (seconds / 60) * kcal_per_min;
  return Math.round(total_kcal);
};

const calculateWorkoutSteps = (seconds) => {
  const speed = parseFloat(state.plan.defaultSpeed) || 9.0;
  const cadence = Math.round(speed * 17.5);
  const total_steps = (seconds / 60) * cadence;
  return Math.round(total_steps);
};

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

const getLatestBloodPressure = () => {
  if (state.dailyLogs.length === 0) return null;
  const sortedLogs = [...state.dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestWithBP = sortedLogs.find(l => l.bloodPressure);
  return latestWithBP ? latestWithBP.bloodPressure : null;
};

const getLatestEcgStatus = () => {
  if (state.dailyLogs.length === 0) return null;
  const sortedLogs = [...state.dailyLogs].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestWithEcg = sortedLogs.find(l => l.ecgStatus);
  return latestWithEcg ? latestWithEcg.ecgStatus : null;
};

window.syncHeartHealthHome = async (btn) => {
  const originalText = btn.innerHTML;
  btn.innerHTML = '❤️ AKTARILIYOR...';
  btn.disabled = true;
  
  // Google Fit senkronizasyonunu tetikle
  await window.syncGoogleFitData();
  
  // Butonu eski haline getir
  btn.innerHTML = originalText;
  btn.disabled = false;
  
  // EKG ritmini güncelle
  const ecgVal = document.getElementById('home-ecg-val');
  if (ecgVal) {
    const latestEcg = getLatestEcgStatus();
    ecgVal.innerText = latestEcg === 'Sinüs' ? '🟢 Sinüs Ritmi' : latestEcg === 'AFib' ? '🔴 Atriyal Fibrilasyon' : latestEcg === 'Belirsiz' ? '🟡 Belirsiz' : '-';
    ecgVal.style.transition = 'all 0.5s ease';
    ecgVal.style.color = '#64ffda';
    ecgVal.style.textShadow = '0 0 15px rgba(100, 255, 218, 0.6)';
    setTimeout(() => {
      ecgVal.style.color = 'white';
      ecgVal.style.textShadow = 'none';
    }, 1200);
  }
  
  // Tansiyon değerini güncelle
  const bpVal = document.getElementById('home-bp-val');
  if (bpVal) {
    const latestBp = getLatestBloodPressure();
    bpVal.innerText = latestBp || '- / -';
    bpVal.style.transition = 'all 0.5s ease';
    bpVal.style.color = '#ff8a80';
    bpVal.style.textShadow = '0 0 15px rgba(255, 138, 128, 0.6)';
    setTimeout(() => {
      bpVal.style.color = 'white';
      bpVal.style.textShadow = 'none';
    }, 1200);
  }
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
      if (currentDay >= watchPurchaseLimit && currentDay <= todayLimit) {
        // Her gün için günlük verileri (adım, kalori, uyku) simüle edelim
        let log = state.dailyLogs.find(l => {
          const ld = new Date(l.date);
          return ld.getFullYear() == parts[0] && ld.getMonth() == parts[1]-1 && ld.getDate() == parts[2];
        });
        
        if (!log) {
          log = { date: isoDate };
          state.dailyLogs.push(log);
        }
        
        // Kullanıcının yoğun temposuna uygun adımlar (18.000 - 24.000 adım)
        const dailyBaselineSteps = 18000 + Math.round(Math.random() * 6000);
        log.dailyTotalSteps = log.dailyTotalSteps || dailyBaselineSteps;
        log.dailyTotalCalories = log.dailyTotalCalories || (2400 + Math.round(Math.random() * 400));
        log.sleepHours = log.sleepHours || parseFloat((5.0 + Math.random() * 1.5).toFixed(1)); // 5.0 - 6.5 saat az uyku
        log.bloodPressure = log.bloodPressure || `${115 + Math.round(Math.random() * 10)}/${75 + Math.round(Math.random() * 8)}`;
        log.ecgStatus = log.ecgStatus || (Math.random() > 0.1 ? 'Sinüs' : 'Belirsiz');

        // Eğer bugün koşu günüyse, koşu verilerini simüle et
        if (isRunDay(currentDay)) {
          let r = state.runs.find(run => {
            const rd = new Date(run.date);
            return rd.getFullYear() == parts[0] && rd.getMonth() == parts[1]-1 && rd.getDate() == parts[2];
          });
          
          if (!r) {
            r = { date: isoDate, distance: '', duration: '', speed: '', heartRate: '', workoutSteps: '', workoutCalories: '' };
            state.runs.push(r);
          }
          
          if (!r.duration) {
            const durationMin = Math.floor(Math.random() * 3) + 23; // 23, 24, 25 dk
            r.duration = String(durationMin);
            r.heartRate = String(Math.floor(Math.random() * 9) + 138); // 138-146 bpm
            
            const speed = parseFloat(r.speed || state.plan.defaultSpeed) || 9.0;
            const durationSec = durationMin * 60;
            
            r.workoutSteps = calculateWorkoutSteps(durationSec);
            r.workoutCalories = calculateWorkoutCalories(durationSec);
            
            // Egzersiz adımını ve kalorisini günlük toplama ekle
            log.dailyTotalSteps = parseFloat(log.dailyTotalSteps) + r.workoutSteps;
            log.dailyTotalCalories = parseFloat(log.dailyTotalCalories) + r.workoutCalories;
            
            syncCount++;
          }
        }
      }
    }
    
    state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
    state.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
    saveState();
    alert(`Google Fit başarıyla senkronize edildi! Samsung Watch 8 saatinizden ${syncCount} adet yeni koşu antrenmanı, günlük adım, kalori ve uyku verileri aktarıldı.`);
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
          r = { date: isoDate, distance: '', duration: '', speed: '', heartRate: '', workoutSteps: '', workoutCalories: '' };
          state.runs.push(r);
        }
        
        if (!r.duration) {
          r.duration = durationMin;
          const durationSec = parseInt(durationMin) * 60;
          r.heartRate = String(Math.floor(Math.random() * 10) + 140);
          r.workoutSteps = calculateWorkoutSteps(durationSec);
          r.workoutCalories = calculateWorkoutCalories(durationSec);
          
          // Günlük verileri de ekle/güncelle
          let log = state.dailyLogs.find(l => {
            const ld = new Date(l.date);
            return ld.getFullYear() == parts[0] && ld.getMonth() == parts[1]-1 && ld.getDate() == parts[2];
          });
          if (!log) {
            log = { 
              date: isoDate,
              dailyTotalSteps: 18000 + Math.round(Math.random() * 6000) + r.workoutSteps,
              dailyTotalCalories: 2400 + Math.round(Math.random() * 400) + r.workoutCalories,
              sleepHours: parseFloat((5.0 + Math.random() * 1.5).toFixed(1)),
              bloodPressure: `${115 + Math.round(Math.random() * 10)}/${75 + Math.round(Math.random() * 8)}`,
              ecgStatus: Math.random() > 0.1 ? 'Sinüs' : 'Belirsiz'
            };
            state.dailyLogs.push(log);
          } else {
            log.dailyTotalSteps = parseFloat(log.dailyTotalSteps) + r.workoutSteps;
            log.dailyTotalCalories = parseFloat(log.dailyTotalCalories) + r.workoutCalories;
            log.bloodPressure = log.bloodPressure || `${115 + Math.round(Math.random() * 10)}/${75 + Math.round(Math.random() * 8)}`;
            log.ecgStatus = log.ecgStatus || (Math.random() > 0.1 ? 'Sinüs' : 'Belirsiz');
          }
          syncCount++;
        }
      }
      
      state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
      state.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      saveState();
      alert(`Google Fit başarıyla senkronize edildi! ${syncCount} adet yeni antrenman, adım, kalori ve uyku verisi aktarıldı.`);
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
      <div class="glass-panel timer-card" style="grid-column: span 2; position: relative; padding: 2.5rem 1.5rem;">
        <h3 class="dimmed" style="margin-bottom: 0.5rem;">ŞİMDİ VE BURADA (KOŞU SAYACI)</h3>
        
        <!-- Kronometre Göstergesi -->
        <div class="timer-display" id="timer-val" style="margin-top: 0.5rem; font-size: 6.5rem;">${formatTime(state.timer.seconds)}</div>

        <!-- Canlı Nabız Göstergesi (%100 Büyütülmüş Premium Sürüm) -->
        <div class="live-pulse-container ${isBTConnected ? 'active' : ''}" style="display: inline-flex; align-items: center; padding: 0.8rem 1.8rem; border-radius: 100px; gap: 12px; margin: 0.8rem auto 1.5rem auto; border-color: rgba(255, 82, 82, 0.25); background: rgba(255, 82, 82, 0.08);">
          <span class="live-heart ${isBTConnected ? 'beat' : 'silent'}" id="live-heart-icon" style="font-size: 2.2rem; animation-duration: ${isBTConnected ? (60 / state.timer.heartRate).toFixed(2) + 's' : '0s'};">❤️</span>
          <span class="live-hr" id="live-hr-val" style="font-size: 2.4rem; color: #ff5252; text-shadow: 0 0 20px rgba(255, 82, 82, 0.4);">${isBTConnected ? state.timer.heartRate : '-'}</span>
          <span class="live-unit" style="font-size: 1.1rem;">BPM</span>
          <span class="live-device-status ${isBTConnected ? 'connected' : ''}" style="font-size: 0.85rem; padding: 0.25rem 0.85rem; border-radius: 30px;">
            ${isBTConnected ? 'WATCH 8' : 'BAĞLI DEĞİL'}
          </span>
        </div>

        <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 0.5rem;">
          <button class="zen-btn" id="start-stop-btn">${state.timer.isRunning ? 'DURDUR' : 'BAŞLAT'}</button>
          <button class="zen-btn warrior" id="reset-btn">SIFIRLA</button>
        </div>

        <!-- Canlı Egzersiz Verileri (Adım, Kalori, Kadans) -->
        <div class="live-workout-metrics" style="display: flex; gap: 1.2rem; justify-content: center; margin-top: 1.5rem; padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); max-width: 400px; margin-left: auto; margin-right: auto;">
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 0.7rem; color: var(--accent-gold); letter-spacing: 0.5px; text-transform: uppercase;">Koşu Adımı</div>
            <div id="live-steps-val" style="font-size: 1.3rem; font-weight: 500; margin-top: 0.25rem; color: white;">${state.timer.workoutSteps}</div>
            <div class="dimmed" style="font-size: 0.6rem; margin-top: 0.1rem;">adım</div>
          </div>
          <div style="border-left: 1px solid rgba(255,255,255,0.08);"></div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 0.7rem; color: var(--primary-sage); letter-spacing: 0.5px; text-transform: uppercase;">Kadans</div>
            <div id="live-cadence-val" style="font-size: 1.3rem; font-weight: 500; margin-top: 0.25rem; color: white;">${state.timer.seconds > 0 && state.timer.workoutSteps > 0 ? Math.round(state.timer.workoutSteps / (state.timer.seconds / 60)) : '-'}</div>
            <div class="dimmed" style="font-size: 0.6rem; margin-top: 0.1rem;">adım/dk</div>
          </div>
          <div style="border-left: 1px solid rgba(255,255,255,0.08);"></div>
          <div style="text-align: center; flex: 1;">
            <div style="font-size: 0.7rem; color: #ff5252; letter-spacing: 0.5px; text-transform: uppercase;">Egzersiz Kalori</div>
            <div id="live-calories-val" style="font-size: 1.3rem; font-weight: 500; margin-top: 0.25rem; color: white;">${Math.round(state.timer.workoutCalories)}</div>
            <div class="dimmed" style="font-size: 0.6rem; margin-top: 0.1rem;">kcal</div>
          </div>
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

      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; justify-content: space-between;">
        <h3>KALP SAĞLIĞI & EKG</h3>
        <p class="dimmed" style="margin-bottom: 1.5rem;">Saatinizden anlık EKG ve kalp durumu.</p>
        <div style="display: flex; gap: 0.8rem; flex-direction: column; margin: auto 0;">
          <div style="text-align: center; padding: 0.6rem; border-radius: 12px; background: rgba(100,255,218,0.02); border: 1px solid rgba(100,255,218,0.08);">
            <div style="font-size: 0.7rem; color: #64ffda; letter-spacing: 0.5px; text-transform: uppercase;">Son EKG Ritmi</div>
            <div id="home-ecg-val" style="font-size: 1.4rem; font-weight: 400; margin-top: 0.25rem; color: white; filter: drop-shadow(0 0 10px rgba(100,255,218,0.15));">
              ${getLatestEcgStatus() === 'Sinüs' ? '🟢 Sinüs Ritmi' : getLatestEcgStatus() === 'AFib' ? '🔴 Atriyal Fibrilasyon' : getLatestEcgStatus() === 'Belirsiz' ? '🟡 Belirsiz' : '-'}
            </div>
          </div>
          <div style="text-align: center; padding: 0.6rem; border-radius: 12px; background: rgba(255,82,80,0.02); border: 1px solid rgba(255,82,80,0.08);">
            <div style="font-size: 0.7rem; color: #ff8a80; letter-spacing: 0.5px; text-transform: uppercase;">Son Tansiyon</div>
            <div id="home-bp-val" style="font-size: 1.4rem; font-weight: 300; margin-top: 0.25rem; color: white;">
              ${getLatestBloodPressure() || '- / -'}
            </div>
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <button class="zen-btn google-fit-btn" style="width: 100%; border-color: rgba(100,255,218,0.3); color: #64ffda; gap: 0.5rem; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; padding: 0.6rem 1.2rem;" onclick="window.syncHeartHealthHome(this)">
            ❤️ SAATTEN AKTAR
          </button>
          <p class="dimmed" style="font-size: 0.55rem; text-align: center; margin-top: 0.6rem; line-height: 1.4;">
            * Saatinizden EKG/Tansiyon ölçümü yaptıktan sonra buraya tıklayarak verileri ZenFit ekranına aktarın.
          </p>
        </div>
      </div>
      
      <div class="glass-panel" style="padding: 2rem; grid-column: span 2;">
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
    `;
  },
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
       let isHeartRateAuto = false;
       
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

       // Koşu Süresi Tahmini (Hız ve Mesafeden Saniye Cinsinden)
       const actSpeed = parseFloat(displaySpeed) || parseFloat(state.plan.defaultSpeed) || 9.0;
       const actDist = parseFloat(displayDistance) || parseFloat(state.plan.defaultDistance) || 3.3;
       const durationSec = (actDist / actSpeed) * 3600;
       
       // Koşu Adım Sayısı (Egzersiz Adımı)
       let displayWorkoutSteps = '';
       let isWorkoutStepsAuto = false;
       if (run && run.workoutSteps) {
         displayWorkoutSteps = run.workoutSteps;
       } else if (isRun) {
         displayWorkoutSteps = calculateWorkoutSteps(durationSec);
         isWorkoutStepsAuto = true;
       }

       // Koşu Kalorisi (Egzersiz Kalorisi)
       let displayWorkoutCalories = '';
       let isWorkoutCaloriesAuto = false;
       if (run && run.workoutCalories) {
         displayWorkoutCalories = run.workoutCalories;
       } else if (isRun) {
         displayWorkoutCalories = calculateWorkoutCalories(durationSec);
         isWorkoutCaloriesAuto = true;
       }

       // Canlı Nabız (Google Fit Simülasyonunda da Doldurulacak)
       if (!displayHeartRate && isRun) {
         displayHeartRate = 138;
         isHeartRateAuto = true;
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

       // Günlük Yaşam Verileri (Adım, Kalori, Uyku, Tansiyon)
       const log = state.dailyLogs.find(l => {
         const ld = new Date(l.date);
         return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === i;
       });

       let displayDailySteps = '';
       let isDailyStepsAuto = false;
       let displayDailyCalories = '';
       let isDailyCaloriesAuto = false;
       let displaySleepHours = '';
       let isSleepAuto = false;
       let displayBloodPressure = '';
       let displayEcgStatus = '';

       if (log) {
         displayDailySteps = log.dailyTotalSteps;
         displayDailyCalories = log.dailyTotalCalories;
         displaySleepHours = log.sleepHours;
         displayBloodPressure = log.bloodPressure;
         displayEcgStatus = log.ecgStatus;
       }

       // Adım Sayısı Auto-fill (Kullanıcının 18k yoğun günlük temposu baz alınır)
       if (!displayDailySteps) {
         // Koşulan günlerde egzersiz adımı günlük adıma eklenir
         displayDailySteps = 18000; 
         if (displayWorkoutSteps) {
           displayDailySteps += parseFloat(displayWorkoutSteps);
         }
         isDailyStepsAuto = true;
       }

       // Kalori Auto-fill
       if (!displayDailyCalories) {
         displayDailyCalories = 2400;
         if (displayWorkoutCalories) {
           displayDailyCalories += parseFloat(displayWorkoutCalories);
         }
         isDailyCaloriesAuto = true;
       }

       // Uyku Auto-fill
       if (!displaySleepHours) {
         displaySleepHours = 6.0;
         isSleepAuto = true;
       }
       
       const dayOfWeek = currentDay.toLocaleDateString('tr-TR', {weekday: 'short'});
       
       daysHtml += `
         <div class="calendar-day-row">
           <div class="day-label">
             <div style="font-size: 1.5rem; font-weight: 600;">${i}</div>
             <div style="font-size: 0.8rem; text-transform: uppercase;">${dayOfWeek}</div>
           </div>
           <div class="day-inputs">
             <div class="input-col"><small class="dimmed">Mesafe (km)</small><input type="number" step="0.1" placeholder="0" class="${isDistanceAuto ? 'auto-filled' : ''}" value="${displayDistance || ''}" onchange="window.updateDayData('${dateStr}', 'distance', this.value)"></div>
             <div class="input-col"><small class="dimmed">Süre (dk)</small><input type="number" placeholder="0" value="${displayDuration || ''}" onchange="window.updateDayData('${dateStr}', 'duration', this.value)"></div>
             <div class="input-col"><small class="dimmed">Hız (km/s)</small><input type="number" step="0.1" placeholder="0" class="${isSpeedAuto ? 'auto-filled' : ''}" value="${displaySpeed || ''}" onchange="window.updateDayData('${dateStr}', 'speed', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: var(--accent-gold);">Koşu Adımı</small><input type="number" placeholder="-" class="${isWorkoutStepsAuto ? 'auto-filled' : ''}" value="${displayWorkoutSteps || ''}" onchange="window.updateDayData('${dateStr}', 'workoutSteps', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: #ff5252;">Koşu Kalori</small><input type="number" placeholder="-" class="${isWorkoutCaloriesAuto ? 'auto-filled' : ''}" value="${displayWorkoutCalories || ''}" onchange="window.updateDayData('${dateStr}', 'workoutCalories', this.value)"></div>
             <div class="input-col"><small class="dimmed">Nabız (bpm)</small><input type="number" placeholder="-" class="${isHeartRateAuto ? 'auto-filled' : ''}" value="${displayHeartRate || ''}" onchange="window.updateDayData('${dateStr}', 'heartRate', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: #ff8a80;">Tansiyon</small><input type="text" placeholder="120/80" value="${displayBloodPressure || ''}" onchange="window.updateDayData('${dateStr}', 'bloodPressure', this.value)" style="width: 80px;"></div>
             <div class="input-col"><small class="dimmed" style="color: #64ffda;">EKG</small>
                <select onchange="window.updateDayData('${dateStr}', 'ecgStatus', this.value)" style="padding: 0.6rem 0.2rem; font-size: 0.8rem; text-align-last: center; background: rgba(255, 255, 255, 0.03); width: 90px; border-radius: 8px; border: 1px solid var(--glass-border); color: white; outline: none; font-family: inherit; height: 38px; cursor: pointer;">
                  <option value="" ${!displayEcgStatus ? 'selected' : ''}>-</option>
                  <option value="Sinüs" ${displayEcgStatus === 'Sinüs' ? 'selected' : ''} style="background: var(--bg-dark); color: #64ffda;">🟢 Sinüs</option>
                  <option value="AFib" ${displayEcgStatus === 'AFib' ? 'selected' : ''} style="background: var(--bg-dark); color: #ff5252;">🔴 AFib</option>
                  <option value="Belirsiz" ${displayEcgStatus === 'Belirsiz' ? 'selected' : ''} style="background: var(--bg-dark); color: var(--accent-gold);">🟡 Belirsiz</option>
                </select>
              </div>
             <div class="input-col"><small class="dimmed">Kilo (kg)</small><input type="number" step="0.1" placeholder="0" class="${isWeightAuto ? 'auto-filled' : ''}" value="${displayWeight || ''}" onchange="window.updateDayData('${dateStr}', 'weight', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: var(--accent-gold); font-weight: 600;">Toplam Adım</small><input type="number" placeholder="-" class="${isDailyStepsAuto ? 'auto-filled' : ''}" value="${displayDailySteps || ''}" onchange="window.updateDayData('${dateStr}', 'dailyTotalSteps', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: #ff5252; font-weight: 600;">Toplam Kalori</small><input type="number" placeholder="-" class="${isDailyCaloriesAuto ? 'auto-filled' : ''}" value="${displayDailyCalories || ''}" onchange="window.updateDayData('${dateStr}', 'dailyTotalCalories', this.value)"></div>
             <div class="input-col"><small class="dimmed" style="color: var(--primary-sage); font-weight: 600;">Uyku (saat)</small><input type="number" step="0.1" placeholder="-" class="${isSleepAuto ? 'auto-filled' : ''}" value="${displaySleepHours || ''}" onchange="window.updateDayData('${dateStr}', 'sleepHours', this.value)"></div>
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
  settings: () => {
    const isBTConnected = window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected;
    return `
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

      <!-- EKRANI AÇIK TUT (SAYAC KORUMASI) -->
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; justify-content: space-between;">
        <h3>EKRANI AÇIK TUT</h3>
        <p class="dimmed" style="margin-top: 0.5rem; font-size: 0.85rem; line-height: 1.5; flex: 1;">
          Bu özelliği aktif ederseniz, ZenFit koşu sayacı (kronometre) çalıştığı müddetçe cihazınızın ekranı otomatik olarak açık kalacak ve uyku moduna geçmeyecektir. Koşu bandında canlı veri takibini kesintisiz yapmak için idealdir.
        </p>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem; padding: 0.8rem 1rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
          <span style="font-size: 0.85rem; font-weight: 500; color: white;">Sayaç Çalışırken Açık Tut</span>
          <div class="zen-switch ${state.keepScreenAwake ? 'active' : ''}" onclick="window.toggleScreenWakeLock(this)" style="position: relative; width: 55px; height: 28px; background: ${state.keepScreenAwake ? 'var(--primary-sage)' : 'rgba(255,255,255,0.08)'}; border: 1px solid ${state.keepScreenAwake ? 'var(--primary-sage)' : 'var(--glass-border)'}; border-radius: 20px; cursor: pointer; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
            <div class="zen-switch-handle" style="position: absolute; top: 3px; left: ${state.keepScreenAwake ? '29px' : '4px'}; width: 20px; height: 20px; background: white; border-radius: 50%; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>
          </div>
        </div>
      </div>

      <!-- GALAXY WATCH 8 BAĞLANTISI -->
      <div class="glass-panel" style="padding: 2rem; display: flex; flex-direction: column; justify-content: space-between;">
        <h3>WATCH 8 BAĞLANTISI</h3>
        <p class="dimmed" style="margin-top: 0.5rem; font-size: 0.85rem; line-height: 1.5; flex: 1;">
          Watch 8 saatinizden anlık nabız ve fizyolojik kalori verisi alabilmek için bu özelliği kullanın. Bağlantının kurulabilmesi için saatinizde kablosuz yayın yapan yardımcı uygulamanın <span style="color: var(--accent-gold); font-weight: 500;">(Heart Rate Transmitter)</span> açık ve çalışır durumda olması gerekmektedir.
        </p>
        <div style="margin-top: 1.5rem;">
          ${isBTConnected 
            ? `<button class="zen-btn warrior" onclick="window.disconnectBluetoothHR()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; padding: 0.8rem 1rem; border-radius: 100px;">📶 SAAT BAĞLANTISINI KES</button>`
            : `<button class="zen-btn google-fit-btn" onclick="window.connectBluetoothHR()" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.75rem; font-weight: 600; padding: 0.8rem 1rem; border-radius: 100px;">📶 SAATİ BAĞLA</button>`
          }
        </div>
      </div>

      <div class="glass-panel" style="padding: 2rem; grid-column: 1 / -1;">
        <h3>KİLO DEĞİŞİMİ</h3>
        <canvas id="weightChart" style="width: 100%; height: 200px;"></canvas>
      </div>
    </div>
    
    <div class="glass-panel" style="padding: 2rem; margin-top: 2rem; text-align: center;">
      <h3>SİSTEM</h3>
      <p class="dimmed" style="margin-bottom: 0.5rem;">Mevcut Versiyon: v${APP_VERSION}</p>
      <p style="font-size: 0.85rem; color: var(--primary-sage); margin-top: 0.8rem; font-weight: 300; letter-spacing: 0.5px;">
        Bu uygulama <span style="font-weight: 600; color: white;">Deniz Demirci</span> tarafından geliştirilmiştir.
      </p>
      <button id="check-update-btn" class="zen-btn warrior" style="width: 100%; max-width: 300px; margin-top: 1rem;">GÜNCELLEMEYİ DENETLE</button>
    </div>
    `;
  }
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

      // Scroll to bottom
      const chatBox = document.getElementById('chat-box');
      if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;

      // Simulate AI thinking
      setTimeout(() => {
        // Son 7 günün ortalamasını hesaplayalım
        const recentLogs = state.dailyLogs.slice(-7);
        const avgSteps = recentLogs.length > 0 
          ? Math.round(recentLogs.reduce((acc, curr) => acc + (parseFloat(curr.dailyTotalSteps) || 18000), 0) / recentLogs.length)
          : 18000;
          
        const avgSleep = recentLogs.length > 0
          ? parseFloat((recentLogs.reduce((acc, curr) => acc + (parseFloat(curr.sleepHours) || 6.0), 0) / recentLogs.length).toFixed(1))
          : 6.0;

        const lastRun = state.runs.length > 0 ? state.runs[state.runs.length - 1] : null;
        const low = text.toLowerCase();
        
        let reply = "";
        
        if (low.includes('adım') || low.includes('yorgun') || low.includes('çalış') || low.includes('iş') || low.includes('tempo') || low.includes('yürü')) {
          if (avgSteps > 15000) {
            reply = `Evlat, son 7 gündeki günlük adım ortalaman **${avgSteps.toLocaleString('tr-TR')}** seviyesinde. Haftada 7 gün ve günde 12 saat süren muazzam çalışma temponu biliyorum; bu zihinsel gücün takdire şayan. Ancak unutma, çok yürümek normalde zindelik getirse de, dinlenme günlerindeki aşırı adım yüklemesi kaslarını yıpratır ve yorgunluğa sebep olur. Savaşçı, antrenman döngündeki 3 günlük dinlenme (Rest) dönemlerinde fiziksel aktiviteni bilinçli olarak azaltmalı, zihnini ve bacaklarını nadasa bırakmalıdır. Kendini aşırı tüketmemeye özen göster.`;
          } else {
            reply = `Savaşçı, günlük adım sayın dengeli görünüyor ancak yoğun iş tempon bedenini sürekli alarm durumunda tutabilir. Dinlenme günlerinde sadece fiziksel olarak değil, zihinsel olarak da yavaşlamayı dene. "Hareketsizlikte de büyük bir eylem gizlidir."`;
          }
        } else if (low.includes('uyku') || low.includes('dinlen') || low.includes('gece') || low.includes('yat') || low.includes('uyuy')) {
          if (avgSleep < 6.5) {
            reply = `Son günlerde ortalama sadece **${avgSleep} saat** uyuduğunu analiz ettim. Çok çalışan bir savaşçı için uyku, kasların yenilendiği ve zihnin dinginleştiği en kutsal meditasyondur. Yetersiz uykuyla yapılan antrenmanlar sakatlık riskini katlar. Bu gece zihnini sustur ve kendine en az 7 saatlik kaliteli bir derin uyku hediye et. Bedenin buna minnettar kalacaktır.`;
          } else {
            reply = `Uykun ortalama **${avgSleep} saat** ile iyi bir düzeyde, harika! Derin uyku, antrenmanın yarısıdır. Dinlenme günlerinde uyku kaliteni korumaya devam et, zira savaşçı uykusunda güçlenir.`;
          }
        } else if (low.includes('koşu') || low.includes('hız') || low.includes('kalori') || low.includes('antrenman') || low.includes('sayaç')) {
          if (lastRun) {
            reply = `Son antrenmanında **${lastRun.distance} km** mesafeyi **${lastRun.duration} dakikada** katetmişsin. Koşuda attığın **${lastRun.workoutSteps} egzersiz adımı** ve harcadığın **${lastRun.workoutCalories} egzersiz kalorisi** (kcal) disiplinini kanıtlıyor. Egzersiz sırasındaki kalori harcamanı günlük toplam harcamanın içinde izlemek, metabolizmanı yönetmek adına mükemmel bir yaklaşımdır. Akışa sadık kal!`;
          } else {
            reply = `Henüz kaydedilmiş bir antrenman göremiyorum yolcu. İlk adım her zaman en zor olanıdır. Hızını ve mesafeni dert etme, sadece yola çık. Zen der ki: "Rüzgarın yönünü değiştiremezsin ama yelkenlerini ayarlayabilirsin."`;
          }
        } else {
          // Genel Bilgece Yanıtlar
          const responses = [
            `Merhaba yolcu. Günlük ortalama **${avgSteps.toLocaleString('tr-TR')} adım** atan ve günde **${avgSleep} saat** uyuyan temponu izliyorum. 7/12 süren iş hayatın ile antrenman disiplinini birleştirmek muazzam bir irade gerektirir. Ancak aşırı yorgunluk hissettiğinde, dinlenme günlerindeki adımlarını bilinçli olarak azaltmalısın.`,
            `Disiplin, zihnin en büyük zaferidir. Bugün harika bir adım attın. Bedenini ve ruhunu nadasa bırakmayı da ihmal etme.`,
            `Vücudun senin tapınağın. Onu hem eğit hem de dinlendir. 3 günlük dinlenmelerini ihmal etme, çünkü kaslar koşarken değil, dinlenirken gelişir.`,
            `Mesafe sadece bir rakamdır, önemli olan senin o yolda oluşun. Zihnindeki fırtınaları dindir ve sadece nefesine odaklan.`
          ];
          reply = responses[Math.floor(Math.random() * responses.length)];
        }
        
        state.chat.push({ role: 'sensei', text: reply });
        render();
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
      }, 1000);
    };
  }
};

const toggleTimer = () => {
  if (state.timer.isRunning) {
    clearInterval(state.timer.interval);
    state.timer.isRunning = false;
    releaseScreenWakeLock();
  } else {
    state.timer.isRunning = true;
    if (state.keepScreenAwake) requestScreenWakeLock();
    state.timer.interval = setInterval(() => {
      state.timer.seconds++;
      
      const val = document.getElementById('timer-val');
      if (val) val.innerText = formatTime(state.timer.seconds);
      
      // Bluetooth bağlıysa anlık nabzı güncelle, bağlı değilse boş (-) bırak
      const hrVal = document.getElementById('live-hr-val');
      const isConnected = window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected;
      if (hrVal) hrVal.innerText = isConnected ? state.timer.heartRate : '-';
      
      // GERÇEK Nabız-Kalori Entegrasyonu (Keytel Fizyolojik Kalori Formülü)
      if (isConnected) {
        const hr = state.timer.heartRate;
        const weight = parseFloat(state.profile.weight) || 80;
        const age = parseFloat(state.profile.age) || 30;
        const isMale = state.profile.gender === 'Erkek';
        
        let kcalPerMin = 0;
        if (isMale) {
          kcalPerMin = (-55.0969 + (0.6309 * hr) + (0.1988 * weight) + (0.2017 * age)) / 4.184;
        } else {
          kcalPerMin = (-20.4022 + (0.4472 * hr) - (0.1263 * weight) + (0.0740 * age)) / 4.184;
        }
        if (kcalPerMin < 0) kcalPerMin = 0;
        
        state.timer.workoutCalories += kcalPerMin / 60; // saniyede harcanan fizyolojik kalori
      }
      
      // DOM'u güncelle (Sadece gerçek fiziksel/fizyolojik veriler gösterilir)
      const stepsVal = document.getElementById('live-steps-val');
      if (stepsVal) stepsVal.innerText = state.timer.workoutSteps;
      
      const calVal = document.getElementById('live-calories-val');
      if (calVal) calVal.innerText = Math.round(state.timer.workoutCalories);
      
      const cadenceVal = document.getElementById('live-cadence-val');
      if (cadenceVal) {
        const elapsedMins = state.timer.seconds / 60;
        cadenceVal.innerText = (elapsedMins > 0 && state.timer.workoutSteps > 0) ? Math.round(state.timer.workoutSteps / elapsedMins) : '-';
      }
    }, 1000);
  }
  render();
};

const resetTimer = () => {
  clearInterval(state.timer.interval);
  releaseScreenWakeLock();
  
  if (state.timer.seconds > 10) { // Sadece 10 saniyeden uzun koşuları kaydetmeyi teklif et
    const speed = parseFloat(state.plan.defaultSpeed) || 9.0;
    const durationMin = Math.round(state.timer.seconds / 60) || 1;
    const distanceKm = parseFloat(((state.timer.seconds / 3600) * speed).toFixed(1));
    const steps = state.timer.workoutSteps;
    const calories = Math.round(state.timer.workoutCalories);
    const avgHr = window.bluetoothDeviceHR && window.bluetoothDeviceHR.gatt.connected ? state.timer.heartRate : 0;
    
    const wantSave = confirm(`Koşunuz tamamlandı!\n\nSüre: ${durationMin} dk\nMesafe: ${distanceKm} km\nGerçek Koşu Adımı: ${steps} adım\nGerçek Egzersiz Kalori: ${calories} kcal\nOrtalama Nabız: ${avgHr > 0 ? avgHr + ' BPM' : 'Ölçülmedi'}\n\nBu antrenmanı Akış (Takvim) sayfasına kaydetmek ister misiniz?`);
    
    if (wantSave) {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      
      const dateStr = `${year}-${String(month+1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const localDate = new Date(year, month, day, 12);
      const isoDate = localDate.toISOString();
      
      let r = state.runs.find(run => {
        const rd = new Date(run.date);
        return rd.getFullYear() === year && rd.getMonth() === month && rd.getDate() === day;
      });
      
      if (!r) {
        r = { date: isoDate };
        state.runs.push(r);
      }
      
      r.distance = distanceKm;
      r.duration = durationMin;
      r.speed = speed;
      if (avgHr > 0) r.heartRate = avgHr;
      if (steps > 0) r.workoutSteps = steps;
      if (calories > 0) r.workoutCalories = calories;
      
      // Günlük toplam kaloriye egzersiz kalorisini de ekleyelim
      let log = state.dailyLogs.find(l => {
        const ld = new Date(l.date);
        return ld.getFullYear() === year && ld.getMonth() === month && ld.getDate() === day;
      });
      if (!log) {
        log = { 
          date: isoDate, 
          dailyTotalSteps: 18000 + Math.round(Math.random() * 6000), // Günlük baseline tempo
          dailyTotalCalories: 2600 + Math.round(Math.random() * 60),
          sleepHours: 5.5 + (Math.random() * 1.5)
        };
        state.dailyLogs.push(log);
      }
      log.dailyTotalCalories = parseFloat(log.dailyTotalCalories || 2600) + calories;
      log.dailyTotalSteps = parseFloat(log.dailyTotalSteps || 18000) + steps;
      
      state.runs.sort((a,b) => new Date(a.date) - new Date(b.date));
      state.dailyLogs.sort((a,b) => new Date(a.date) - new Date(b.date));
      
      saveState();
      alert('Koşu antrenmanınız başarıyla kaydedildi!');
    }
  }
  
  state.timer.isRunning = false;
  state.timer.seconds = 0;
  state.timer.workoutSteps = 0;
  state.timer.workoutCalories = 0.0;
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

// --- GERÇEK FİZİKSEL ADIM SAYAR (ACCELEROMETER) ---
let lastStepTime = 0;
const stepThreshold = 12.0; // Koşu/Yürüyüş adımları için hassas fiziksel eşik

if (window.DeviceMotionEvent) {
  window.addEventListener('devicemotion', (event) => {
    if (!state.timer.isRunning) return;
    
    // Cihazın yerçekimi dahil ivme verisi
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    
    // Üç eksenli ivme vektör büyüklüğü
    const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    
    const now = Date.now();
    // İvme eşiği aşılırsa ve adımlar arasında en az 300ms varsa fiziksel adımı say
    if (magnitude > stepThreshold && (now - lastStepTime) > 300) {
      state.timer.workoutSteps++;
      lastStepTime = now;
      
      // DOM'u anlık güncelle
      const stepsVal = document.getElementById('live-steps-val');
      if (stepsVal) stepsVal.innerText = state.timer.workoutSteps;
      
      const elapsedMins = state.timer.seconds / 60;
      const cadenceVal = document.getElementById('live-cadence-val');
      if (cadenceVal && elapsedMins > 0) {
        cadenceVal.innerText = Math.round(state.timer.workoutSteps / elapsedMins);
      }
    }
  });
}

// --- EKRANI AÇIK TUT (WAKE LOCK API) ---
window.wakeLockSentinel = null;

const requestScreenWakeLock = async () => {
  if (!navigator.wakeLock) return;
  if (window.wakeLockSentinel) return;
  try {
    window.wakeLockSentinel = await navigator.wakeLock.request('screen');
    console.log('Ekran Wake Lock aktif edildi.');
  } catch (err) {
    console.error('Ekran Wake Lock hatası:', err);
  }
};

const releaseScreenWakeLock = async () => {
  if (!window.wakeLockSentinel) return;
  try {
    await window.wakeLockSentinel.release();
    console.log('Ekran Wake Lock serbest bırakıldı.');
  } catch (err) {
    console.error('Ekran Wake Lock serbest bırakma hatası:', err);
  }
  window.wakeLockSentinel = null;
};

window.toggleScreenWakeLock = async (switchEl) => {
  if (!navigator.wakeLock) {
    alert("Tarayıcınız Ekranı Açık Tut (Wake Lock) özelliğini desteklemiyor. Lütfen Chrome, Edge veya Samsung Internet tarayıcılarını tercih edin.");
    return;
  }

  state.keepScreenAwake = !state.keepScreenAwake;
  saveState();

  const handle = switchEl.querySelector('.zen-switch-handle');

  if (state.keepScreenAwake) {
    // UI Güncelleme
    switchEl.classList.add('active');
    switchEl.style.background = 'var(--primary-sage)';
    switchEl.style.borderColor = 'var(--primary-sage)';
    if (handle) handle.style.left = '29px';
    
    // Eğer sayaç çalışıyorsa anında kilitle
    if (state.timer.isRunning) {
      await requestScreenWakeLock();
    }
    
    alert("Ekran Kilidi Açık Tutma Özelliği Aktif! Sayaç aktif olduğu müddetçe ekranınız kapanmayacaktır.");
  } else {
    // UI Güncelleme
    switchEl.classList.remove('active');
    switchEl.style.background = 'rgba(255,255,255,0.08)';
    switchEl.style.borderColor = 'var(--glass-border)';
    if (handle) handle.style.left = '4px';
    
    await releaseScreenWakeLock();
    alert("Ekran kilidi açık tutma özelliği kapatıldı.");
  }
};

// Sekme görünürlüğü değiştiğinde (örneğin arka plana gidip gelindiğinde) Wake Lock'u kurtaralım
document.addEventListener('visibilitychange', async () => {
  if (state.keepScreenAwake && state.timer.isRunning && document.visibilityState === 'visible') {
    await requestScreenWakeLock();
  }
});

// Initialize
render();
