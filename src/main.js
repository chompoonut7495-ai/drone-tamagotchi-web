import './style.css';

const API_URL = (
  import.meta.env.VITE_API_URL || 'https://drone-api-spanner.onrender.com'
).replace(/\/$/, '');
const DRONE_ID = import.meta.env.VITE_DRONE_ID || '67010177';

// สถานะหลักของแอปพลิเคชัน
const state = {
  activeTab: 'config', // 'config' | 'log' | 'history'
  config: null,
  status: null,
  logs: [],
  latestTemp: null,
  page: 1,
  isLoading: true,
  isWakingUp: false,
  isSubmitting: false,
  feedback: null, // { type: 'success' | 'error', text: string }
  isRadar: false,
  isMuted: false,
};

// ระบบสังเคราะห์เสียง 8-Bit (ไม่ต้องใช้ไฟล์ MP3 ภายนอก)
let audioCtx = null;
function playBeep(type = 'click') {
  if (state.isMuted) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'click') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'preset') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.04);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'success') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.5, now + 0.24);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'error') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.setValueAtTime(165, now + 0.12);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  } catch {
    // ข้ามหากเบราว์เซอร์บล็อกเสียงอัตโนมัติ
  }
}

// คำนวณอารมณ์และคำพูดของ Spanner ตามอุณหภูมิล่าสุด
function getPetMood() {
  const name = state.config?.drone_name || 'Spanner';
  if (state.isLoading) {
    return {
      moodClass: '',
      avatar: '🛸💤',
      speech: state.isWakingUp
        ? 'กำลังปลุกเซิร์ฟเวอร์และอุ่นเครื่องยนต์ รอสักครู่นะครับ...'
        : 'กำลังเชื่อมต่อสัญญาณดาวเทียม...',
    };
  }

  const t = state.latestTemp;
  if (t === null || Number.isNaN(Number(t))) {
    return {
      moodClass: '',
      avatar: '🛸✨',
      speech: `สวัสดี! ผมชื่อ ${name} พร้อมบินครับ!`,
    };
  }

  if (t >= 35) {
    return {
      moodClass: 'mood-hot',
      avatar: '🛸🥵',
      speech: `ร้อนจี๋เลย (${t}°C)! เครื่องยนต์เริ่มร้อนแล้วครับ!`,
    };
  }

  if (t < 20) {
    return {
      moodClass: 'mood-cool',
      avatar: '🛸🥶',
      speech: `บรื๋ออ~ อากาศเย็นจัง (${t}°C) เปิดฮีตเตอร์หน่อยครับ!`,
    };
  }

  return {
    moodClass: '',
    avatar: '🛸✨',
    speech: `สวัสดี! ผมชื่อ ${name} อากาศกำลังดี (${t}°C) พร้อมบินครับ!`,
  };
}

// วาดกราฟเส้น SVG Sparkline จากข้อมูล 12 รายการล่าสุด
function renderSparkline(logs) {
  if (!logs || logs.length < 2) return '';

  // เรียงจากเก่า -> ใหม่ (ซ้ายไปขวา) เพื่อให้กราฟอ่านตามลำดับเวลา
  const ordered = [...logs].reverse();
  const temps = ordered.map((item) => Number(item.celsius));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  const width = 440;
  const height = 58;
  const padX = 10;
  const padY = 10;

  const points = temps.map((val, idx) => {
    const x = padX + (idx / (temps.length - 1)) * (width - padX * 2);
    const y = height - padY - ((val - min) / range) * (height - padY * 2);
    return { x: x.toFixed(1), y: y.toFixed(1), val };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
  const strokeColor = state.isRadar ? '#39ff14' : '#e76f51';

  return `
    <div class="sparkline-box">
      <div class="sparkline-header">
        <span>📈 แนวโน้มอุณหภูมิ (${temps.length} รายการในหน้านี้)</span>
        <span>Min: ${min}°C | Max: ${max}°C</span>
      </div>
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="58" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="${strokeColor}"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          points="${polyline}"
        />
        ${points
          .map(
            (p) =>
              `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="${strokeColor}" />`
          )
          .join('')}
      </svg>
    </div>
  `;
}

function formatDateTime(isoStr) {
  if (!isoStr) return '-';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('th-TH', {
    year: '2-digit',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ดึงข้อมูล Log ตามหน้า (Pagination)
async function fetchLogs(page = 1) {
  try {
    const res = await fetch(`${API_URL}/logs/${DRONE_ID}?page=${page}`);
    if (!res.ok) throw new Error('Failed to load logs');
    const data = await res.json();
    state.logs = Array.isArray(data) ? data : [];
    state.page = page;
    if (page === 1 && state.logs.length > 0) {
      state.latestTemp = Number(state.logs[0].celsius);
    }
  } catch (err) {
    console.error(err);
  }
}

// โหลดข้อมูลเริ่มต้นทั้งหมดเมื่อเปิดเว็บ
async function initApp() {
  const wakeTimer = setTimeout(() => {
    if (state.isLoading) {
      state.isWakingUp = true;
      render();
    }
  }, 2000);

  try {
    const [cfgRes, statusRes] = await Promise.all([
      fetch(`${API_URL}/configs/${DRONE_ID}`),
      fetch(`${API_URL}/status/${DRONE_ID}`),
    ]);

    if (cfgRes.ok) state.config = await cfgRes.json();
    if (statusRes.ok) state.status = await statusRes.json();
    await fetchLogs(1);
  } catch (err) {
    console.error('Init error:', err);
  } finally {
    clearTimeout(wakeTimer);
    state.isLoading = false;
    state.isWakingUp = false;
    render();
  }
}

// ส่งข้อมูลบันทึกอุณหภูมิ (POST /logs)
async function submitTemperature(celsiusValue) {
  const celsius = Number(celsiusValue);
  if (celsiusValue === '' || Number.isNaN(celsius)) {
    playBeep('error');
    state.feedback = { type: 'error', text: 'กรุณากรอกตัวเลขอุณหภูมิให้ถูกต้อง' };
    render();
    return;
  }

  state.isSubmitting = true;
  state.feedback = null;
  render();

  try {
    const payload = {
      drone_id: Number(state.config?.drone_id || DRONE_ID),
      drone_name: state.config?.drone_name || 'Spanner',
      country: state.config?.country || 'Thailand',
      celsius: celsius,
    };

    const res = await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error('Failed to create log');

    playBeep('success');
    state.latestTemp = celsius;
    state.feedback = {
      type: 'success',
      text: `บันทึกอุณหภูมิ ${celsius}°C สำเร็จเรียบร้อย!`,
    };
    await fetchLogs(1);
  } catch (err) {
    playBeep('error');
    state.feedback = {
      type: 'error',
      text: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง',
    };
  } finally {
    state.isSubmitting = false;
    render();
  }
}

// วาดส่วนเนื้อหาตามแท็บที่เลือก
function renderActivePanel() {
  if (state.activeTab === 'config') {
    const c = state.config || {};
    return `
      <div class="panel-title">
        <span>🖥️ ข้อมูลจำเพาะโดรน (Config)</span>
      </div>
      <div class="config-grid">
        <div class="config-item">
          <div class="config-label">Drone ID</div>
          <div class="config-value">#${c.drone_id || DRONE_ID}</div>
        </div>
        <div class="config-item">
          <div class="config-label">Drone Name</div>
          <div class="config-value">${c.drone_name || '-'}</div>
        </div>
        <div class="config-item">
          <div class="config-label">Light</div>
          <div class="config-value">${(c.light || '-').toUpperCase()}</div>
        </div>
        <div class="config-item">
          <div class="config-label">Country</div>
          <div class="config-value">${c.country || '-'}</div>
        </div>
      </div>
    `;
  }

  if (state.activeTab === 'log') {
    return `
      <div class="panel-title">
        <span>🌡️ Feed Temperature (°C)</span>
      </div>
      <form id="tempForm">
        <div class="form-group">
          <label class="form-label" for="celsiusInput">กรอกอุณหภูมิปัจจุบัน (Celsius)</label>
          <input
            id="celsiusInput"
            class="temp-input"
            type="number"
            step="0.1"
            placeholder="เช่น 25"
            required
          />
        </div>
        <div class="preset-row">
          <button type="button" class="preset-btn" data-temp="18">❄️ 18°C (เย็น)</button>
          <button type="button" class="preset-btn" data-temp="25">🌤️ 25°C (ปกติ)</button>
          <button type="button" class="preset-btn" data-temp="38">🔥 38°C (ร้อนจัด)</button>
        </div>
        <button type="submit" class="submit-btn" ${state.isSubmitting ? 'disabled' : ''}>
          ${state.isSubmitting ? 'กำลังส่งข้อมูล...' : 'บันทึกอุณหภูมิ (Submit Data)'}
        </button>
        ${
          state.feedback
            ? `<div class="feedback-msg ${state.feedback.type}">${state.feedback.text}</div>`
            : ''
        }
      </form>
    `;
  }

  // แท็บ View Logs
  return `
    <div class="panel-title">
      <span>📜 ประวัติอุณหภูมิ (View Logs)</span>
      <span style="font-size:0.8rem; opacity:0.75;">หน้า ${state.page}</span>
    </div>
    ${renderSparkline(state.logs)}
    <div class="table-wrap">
      <table class="logs-table">
        <thead>
          <tr>
            <th>Created</th>
            <th>Country</th>
            <th>Drone ID</th>
            <th>Drone Name</th>
            <th>Celsius</th>
          </tr>
        </thead>
        <tbody>
          ${
            state.logs.length === 0
              ? `<tr><td colspan="5" style="text-align:center; padding:16px;">ยังไม่มีประวัติข้อมูลในหน้านี้</td></tr>`
              : state.logs
                  .map(
                    (row) => `
                  <tr>
                    <td>${formatDateTime(row.created)}</td>
                    <td>${row.country}</td>
                    <td>${row.drone_id}</td>
                    <td>${row.drone_name}</td>
                    <td><strong>${row.celsius}°C</strong></td>
                  </tr>
                `
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>
    <div class="pagination-bar">
      <button id="prevPageBtn" class="page-btn" ${state.page <= 1 ? 'disabled' : ''}>
        ◀ ก่อนหน้า
      </button>
      <span>แสดงสูงสุด 12 รายการ/หน้า</span>
      <button id="nextPageBtn" class="page-btn" ${state.logs.length < 12 ? 'disabled' : ''}>
        ถัดไป ▶
      </button>
    </div>
  `;
}

// Render หน้าจอทั้งหมดและผูก Event Listeners
function render() {
  const app = document.getElementById('app');
  const pet = getPetMood();
  const lightStatus = (state.config?.light || 'off').toUpperCase();
  const conditionStatus = state.status?.condition || 'checking...';
  const tempDisplay =
    state.latestTemp !== null ? `${state.latestTemp} °C` : '-- °C';

  app.innerHTML = `
    <div class="device-shell ${state.isRadar ? 'radar-mode' : ''}">
      <div class="shell-top">
        <span class="os-badge">DRONE PET OS v2.5</span>
        <div class="hardware-toggles">
          <button id="toggleSoundBtn" class="hw-btn" title="เปิด/ปิดเสียง 8-Bit">
            ${state.isMuted ? '🔇 Muted' : '🔊 SFX'}
          </button>
          <button id="toggleRadarBtn" class="hw-btn" title="สลับโหมดเรดาร์กลางคืน">
            ${state.isRadar ? '☀️ Day' : '📡 Radar'}
          </button>
        </div>
      </div>

      <h1 class="device-title">SPANNER-GOTCHI</h1>

      <div class="lcd-screen ${pet.moodClass}">
        <div class="lcd-header">
          <span>ID: #${state.config?.drone_id || DRONE_ID}</span>
          <span class="pill-tag">LIGHT: ${lightStatus}</span>
        </div>

        <div class="lcd-stage">
          <div class="pet-avatar">${pet.avatar}</div>
          <div class="speech-bubble">${pet.speech}</div>
        </div>

        <div class="lcd-footer">
          <span>Condition: <strong>${conditionStatus}</strong></span>
          <span>Temp: <strong>${tempDisplay}</strong></span>
        </div>
      </div>

      <div class="nav-tabs">
        <button class="tab-btn ${state.activeTab === 'config' ? 'active' : ''}" data-tab="config">
          🖥️ View Config
        </button>
        <button class="tab-btn ${state.activeTab === 'log' ? 'active' : ''}" data-tab="log">
          🌡️ Log Temp
        </button>
        <button class="tab-btn ${state.activeTab === 'history' ? 'active' : ''}" data-tab="history">
          📜 View Logs
        </button>
      </div>

      <div class="panel-card">
        ${renderActivePanel()}
      </div>
    </div>
  `;

  // ผูก Event ปุ่มเปิด/ปิดเสียง
  document.getElementById('toggleSoundBtn')?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    if (!state.isMuted) playBeep('click');
    render();
  });

  // ผูก Event ปุ่มสลับโหมดเรดาร์กลางคืน
  document.getElementById('toggleRadarBtn')?.addEventListener('click', () => {
    state.isRadar = !state.isRadar;
    playBeep('click');
    render();
  });

  // ผูก Event ปุ่มแท็บทั้ง 3
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      playBeep('click');
      state.activeTab = btn.dataset.tab;
      state.feedback = null;
      render();
      if (state.activeTab === 'history') {
        await fetchLogs(state.page);
        render();
      }
    });
  });

  // ผูก Event ฟอร์มบันทึกอุณหภูมิและปุ่มลัด
  const form = document.getElementById('tempForm');
  if (form) {
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        playBeep('preset');
        const input = document.getElementById('celsiusInput');
        if (input) input.value = btn.dataset.temp;
      });
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('celsiusInput')?.value;
      submitTemperature(val);
    });
  }

  // ผูก Event ปุ่มเปลี่ยนหน้า Pagination
  document.getElementById('prevPageBtn')?.addEventListener('click', async () => {
    if (state.page > 1) {
      playBeep('click');
      await fetchLogs(state.page - 1);
      render();
    }
  });

  document.getElementById('nextPageBtn')?.addEventListener('click', async () => {
    if (state.logs.length >= 12) {
      playBeep('click');
      await fetchLogs(state.page + 1);
      render();
    }
  });
}

// เริ่มทำงาน
render();
initApp();