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
  openMenu: null, // null | 'file' | 'telemetry' | 'view' | 'start'
  showMonitorWin: true,
  showTerminalWin: true,
};

// ปิดเมนู Dropdown เมื่อคลิกพื้นที่ว่างข้างนอก
document.addEventListener('click', (e) => {
  if (
    state.openMenu &&
    !e.target.closest('.menu-wrapper') &&
    !e.target.closest('.start-wrapper')
  ) {
    state.openMenu = null;
    render();
  }
});

// ระบบสังเคราะห์เสียง 8-Bit
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

// ดาวน์โหลดประวัติอุณหภูมิเป็นไฟล์ CSV
function exportLogsCSV() {
  if (!state.logs || state.logs.length === 0) {
    playBeep('error');
    state.activeTab = 'history';
    state.openMenu = null;
    render();
    return;
  }
  const headers = ['Created', 'Country', 'Drone ID', 'Drone Name', 'Celsius'];
  const rows = state.logs.map((r) => [
    `"${r.created}"`,
    `"${r.country}"`,
    r.drone_id,
    `"${r.drone_name}"`,
    r.celsius,
  ]);
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `drone_${DRONE_ID}_logs_page${state.page}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  playBeep('success');
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
      speech: `สวัสดี! ผมชื่อ ${name} เช็กสเปกด้านขวา แล้วกด 🌡️ Log Temp ป้อนอุณหภูมิให้ผมได้เลย!`,
    };
  }

  if (t >= 35) {
    return {
      moodClass: 'mood-hot',
      avatar: '🛸🥵',
      speech: `ร้อนจี๋เลย (${t}°C)! กด 🌡️ Log Temp ป้อนอากาศเย็นๆ ให้ผมหน่อยครับ!`,
    };
  }

  if (t < 20) {
    return {
      moodClass: 'mood-cool',
      avatar: '🛸🥶',
      speech: `บรื๋ออ~ อากาศเย็นจัง (${t}°C) กด 🌡️ Log Temp ป้อนอุณหภูมิอุ่นๆ หน่อยครับ!`,
    };
  }

  return {
    moodClass: '',
    avatar: '🛸✨',
    speech: `สวัสดี! ผมชื่อ ${name} (${t}°C) เช็กสเปกด้านขวา แล้วกด 🌡️ Log Temp ป้อนอุณหภูมิให้ผมได้เลย!`,
  };
}

// วาดกราฟเส้น SVG Sparkline
function renderSparkline(logs) {
  if (!logs || logs.length < 2) return '';

  const ordered = [...logs].reverse();
  const temps = ordered.map((item) => Number(item.celsius));
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const range = max - min || 1;

  const width = 560;
  const height = 64;
  const padX = 12;
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
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="64" preserveAspectRatio="none">
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

function getCurrentTimeStr() {
  return new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

setInterval(() => {
  const clockEl = document.getElementById('osClock');
  if (clockEl) clockEl.textContent = getCurrentTimeStr();
}, 1000);

// ดึงข้อมูล Log ตามหน้า
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

// โหลดข้อมูลเริ่มต้น
async function initApp() {
  state.isLoading = true;
  render();

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

// ส่งข้อมูลบันทึกอุณหภูมิ
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
      text: `บันทึกอุณหภูมิ ${celsius}°C สำเร็จเรียบร้อย! กด 📜 View Logs ดูประวัติได้เลย`,
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

function renderActivePanel() {
  if (state.activeTab === 'config') {
    const c = state.config || {};
    return `
      <div class="panel-title">
        <span>🖥️ ข้อมูลจำเพาะโดรน (Drone Configuration)</span>
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
          <div class="config-label">Light Status</div>
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
        <span>🌡️ บันทึกอุณหภูมิโดรน (Feed Temperature °C)</span>
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

  return `
    <div class="panel-title">
      <span>📜 ประวัติอุณหภูมิ (Temperature Logs)</span>
      <span style="font-size:0.85rem; opacity:0.75;">หน้า ${state.page}</span>
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
              ? `<tr><td colspan="5" style="text-align:center; padding:18px;">ยังไม่มีประวัติข้อมูลในหน้านี้</td></tr>`
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

// Render หน้าจอ Desktop OS ทั้งหมด
function render() {
  const app = document.getElementById('app');
  const pet = getPetMood();
  const lightStatus = (state.config?.light || 'off').toUpperCase();
  const conditionStatus = state.status?.condition || 'checking...';
  const tempDisplay =
    state.latestTemp !== null ? `${state.latestTemp} °C` : '-- °C';

  const visibleCount =
    (state.showMonitorWin ? 1 : 0) + (state.showTerminalWin ? 1 : 0);

  app.innerHTML = `
    <div class="os-desktop ${state.isRadar ? 'radar-mode' : ''}">
      <!-- แถบเมนูบาร์ด้านบน (กดเปิดเมนูได้จริงทุกปุ่ม) -->
      <header class="os-menubar">
        <div class="menubar-left">
          <span class="os-logo">🛸 DRONE PET OS v3.0</span>

          <!-- เมนู File -->
          <div class="menu-wrapper">
            <button class="menu-trigger ${state.openMenu === 'file' ? 'active' : ''}" data-menu="file">
              File
            </button>
            ${
              state.openMenu === 'file'
                ? `
              <div class="dropdown-panel">
                <button class="dropdown-item" data-action="refresh">🔄 รีเฟรชข้อมูล API</button>
                <button class="dropdown-item" data-action="exportCsv">📥 ดาวน์โหลด Logs (.CSV)</button>
              </div>
            `
                : ''
            }
          </div>

          <!-- เมนู Telemetry -->
          <div class="menu-wrapper">
            <button class="menu-trigger ${state.openMenu === 'telemetry' ? 'active' : ''}" data-menu="telemetry">
              Telemetry
            </button>
            ${
              state.openMenu === 'telemetry'
                ? `
              <div class="dropdown-panel">
                <button class="dropdown-item" data-action="tab-config">🖥️ View Config</button>
                <button class="dropdown-item" data-action="tab-log">🌡️ Log Temp</button>
                <button class="dropdown-item" data-action="tab-history">📜 View Logs</button>
              </div>
            `
                : ''
            }
          </div>

          <!-- เมนู View -->
          <div class="menu-wrapper">
            <button class="menu-trigger ${state.openMenu === 'view' ? 'active' : ''}" data-menu="view">
              View
            </button>
            ${
              state.openMenu === 'view'
                ? `
              <div class="dropdown-panel">
                <button class="dropdown-item" data-action="toggleRadar">
                  <span>📡 Radar Mode</span>
                  <span>${state.isRadar ? 'ON' : 'OFF'}</span>
                </button>
                <button class="dropdown-item" data-action="toggleSound">
                  <span>🔊 8-Bit SFX</span>
                  <span>${state.isMuted ? 'OFF' : 'ON'}</span>
                </button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" data-action="restoreAll">🪟 เปิดหน้าต่างทั้งหมด</button>
              </div>
            `
                : ''
            }
          </div>
        </div>

        <div class="menubar-right">
          <button id="toggleSoundBtn" class="hw-btn" title="เปิด/ปิดเสียง 8-Bit">
            ${state.isMuted ? '🔇 Muted' : '🔊 SFX'}
          </button>
          <button id="toggleRadarBtn" class="hw-btn" title="สลับโหมดเรดาร์กลางคืน">
            ${state.isRadar ? '☀️ Day Mode' : '📡 Radar Mode'}
          </button>
          <span id="osClock" class="os-clock">${getCurrentTimeStr()}</span>
        </div>
      </header>

      <!-- พื้นที่ทำงานตรงกลาง -->
      <main class="desktop-workspace ${visibleCount === 1 ? 'single-win' : ''}">
        ${
          visibleCount === 0
            ? `<div class="empty-desktop-msg">หน้าต่างโปรแกรมถูกย่อไว้ทั้งหมด — กดที่ชื่อโปรแกรมบนแถบ Taskbar ด้านล่างเพื่อเปิดกลับมาครับ</div>`
            : ''
        }

        <!-- หน้าต่างซ้าย: SPANNER_MONITOR.EXE -->
        ${
          state.showMonitorWin
            ? `
          <section class="pc-window">
            <div class="window-titlebar">
              <span>SPANNER_MONITOR.EXE</span>
              <div class="window-controls">
                <span class="win-dot min" data-win="monitor" title="ย่อหน้าต่าง"></span>
                <span class="win-dot max" data-action="restoreAll" title="แสดงคู่"></span>
                <span class="win-dot cls" data-win="monitor" title="ซ่อนหน้าต่าง"></span>
              </div>
            </div>
            <div class="window-body">
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

              <div class="monitor-meta">
                <span>UNIT: ${(state.config?.drone_name || 'SPANNER').toUpperCase()}</span>
                <span>LOC: ${(state.config?.country || 'THAILAND').toUpperCase()}</span>
              </div>
            </div>
          </section>
        `
            : ''
        }

        <!-- หน้าต่างขวา: CONTROL_TERMINAL.APP -->
        ${
          state.showTerminalWin
            ? `
          <section class="pc-window">
            <div class="window-titlebar alt">
              <span>CONTROL_TERMINAL.APP — [${state.activeTab.toUpperCase()}]</span>
              <div class="window-controls">
                <span class="win-dot min" data-win="terminal" title="ย่อหน้าต่าง"></span>
                <span class="win-dot max" data-action="restoreAll" title="แสดงคู่"></span>
                <span class="win-dot cls" data-win="terminal" title="ซ่อนหน้าต่าง"></span>
              </div>
            </div>
            <div class="window-body">
              <nav class="nav-tabs">
                <button class="tab-btn ${state.activeTab === 'config' ? 'active' : ''}" data-tab="config">
                  🖥️ View Config
                </button>
                <button class="tab-btn ${state.activeTab === 'log' ? 'active' : ''}" data-tab="log">
                  🌡️ Log Temp
                </button>
                <button class="tab-btn ${state.activeTab === 'history' ? 'active' : ''}" data-tab="history">
                  📜 View Logs
                </button>
              </nav>

              <div class="panel-card">
                ${renderActivePanel()}
              </div>
            </div>
          </section>
        `
            : ''
        }
      </main>

      <!-- แถบ Taskbar ด้านล่าง (กดเปิด Start และย่อ/ขยายหน้าต่างได้จริง) -->
      <footer class="os-taskbar">
        <div class="taskbar-apps">
          <div class="start-wrapper" style="position: relative;">
            <button id="startBtn" class="start-btn ${state.openMenu === 'start' ? 'active' : ''}">
              ⊞ Start
            </button>
            ${
              state.openMenu === 'start'
                ? `
              <div class="start-menu-panel">
                <div class="start-header">🛸 SPANNER OS — ID #${DRONE_ID}</div>
                <button class="dropdown-item" data-action="tab-config">🖥️ View Config</button>
                <button class="dropdown-item" data-action="tab-log">🌡️ Log Temperature</button>
                <button class="dropdown-item" data-action="tab-history">📜 View Logs</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item" data-action="refresh">🔄 Sync API Data</button>
                <button class="dropdown-item" data-action="restoreAll">🪟 Show All Windows</button>
              </div>
            `
                : ''
            }
          </div>

          <button id="taskMonitorBtn" class="task-btn ${state.showMonitorWin ? '' : 'minimized'}">
            ${state.showMonitorWin ? '🟢' : '⚪'} SPANNER_MONITOR.EXE
          </button>

          <button id="taskTerminalBtn" class="task-btn ${state.showTerminalWin ? '' : 'minimized'}">
            ${state.showTerminalWin ? '🟢' : '⚪'} CONTROL_TERMINAL.APP
          </button>
        </div>
        <div>
          API LINK: <span class="status-online">● CONNECTED</span>
        </div>
      </footer>
    </div>
  `;

  // เปิด/ปิดเมนู Dropdown ด้านบน
  document.querySelectorAll('.menu-trigger').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      playBeep('click');
      const target = btn.dataset.menu;
      state.openMenu = state.openMenu === target ? null : target;
      render();
    });
  });

  // เปิด/ปิดเมนู Start ด้านล่าง
  document.getElementById('startBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    playBeep('click');
    state.openMenu = state.openMenu === 'start' ? null : 'start';
    render();
  });

  // จัดการคำสั่งจากเมนู Dropdown และ Start Menu
  document.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const act = btn.dataset.action;
      state.openMenu = null;
      playBeep('click');

      if (act === 'refresh') {
        await initApp();
        return;
      }
      if (act === 'exportCsv') {
        exportLogsCSV();
        render();
        return;
      }
      if (act === 'tab-config') {
        state.showTerminalWin = true;
        state.activeTab = 'config';
      } else if (act === 'tab-log') {
        state.showTerminalWin = true;
        state.activeTab = 'log';
      } else if (act === 'tab-history') {
        state.showTerminalWin = true;
        state.activeTab = 'history';
        await fetchLogs(state.page);
      } else if (act === 'toggleRadar') {
        state.isRadar = !state.isRadar;
      } else if (act === 'toggleSound') {
        state.isMuted = !state.isMuted;
      } else if (act === 'restoreAll') {
        state.showMonitorWin = true;
        state.showTerminalWin = true;
      }
      render();
    });
  });

  // ย่อ/ขยายหน้าต่างจากปุ่มบน Taskbar
  document.getElementById('taskMonitorBtn')?.addEventListener('click', () => {
    playBeep('click');
    state.showMonitorWin = !state.showMonitorWin;
    render();
  });

  document.getElementById('taskTerminalBtn')?.addEventListener('click', () => {
    playBeep('click');
    state.showTerminalWin = !state.showTerminalWin;
    render();
  });

  // ย่อ/ปิดหน้าต่างจากจุดสีบนหัวหน้าต่าง
  document.querySelectorAll('[data-win]').forEach((dot) => {
    dot.addEventListener('click', () => {
      playBeep('click');
      if (dot.dataset.win === 'monitor') state.showMonitorWin = false;
      if (dot.dataset.win === 'terminal') state.showTerminalWin = false;
      render();
    });
  });

  // ปุ่มเสียงและเรดาร์มุมขวาบน
  document.getElementById('toggleSoundBtn')?.addEventListener('click', () => {
    state.isMuted = !state.isMuted;
    if (!state.isMuted) playBeep('click');
    render();
  });

  document.getElementById('toggleRadarBtn')?.addEventListener('click', () => {
    state.isRadar = !state.isRadar;
    playBeep('click');
    render();
  });

  // แท็บทั้ง 3 ในหน้าต่างขวา
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

  // ฟอร์มบันทึกอุณหภูมิและปุ่มลัด
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

  // ปุ่มเปลี่ยนหน้า Pagination
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