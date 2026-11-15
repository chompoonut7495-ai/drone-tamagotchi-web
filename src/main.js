import './style.css';

const API_URL = import.meta.env.VITE_API_URL;
const DRONE_ID = import.meta.env.VITE_DRONE_ID || '67010177';

let droneConfig = null;
let currentPage = 1;

// สลับหน้า Tab ทั้ง 3 หน้า
document.querySelectorAll('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// อัปเดตท่าทางของน้อง Tamagotchi
function updateTamagotchiMood(condition, latestTemp = null) {
  const avatar = document.getElementById('pet-avatar');
  const speech = document.getElementById('pet-speech');

  if (latestTemp !== null) {
    document.getElementById('pet-temp').textContent = `${latestTemp} °C`;
    if (latestTemp > 35) {
      avatar.textContent = '🥵🛸';
      speech.textContent = `ร้อนจัง! (${latestTemp}°C) ขอพักระบายความร้อนหน่อย`;
      return;
    }
    if (latestTemp < 20) {
      avatar.textContent = '🥶🛸';
      speech.textContent = `หนาวบรื๋อ! (${latestTemp}°C) เปิดฮีตเตอร์ด่วน`;
      return;
    }
  }

  if (String(condition).toLowerCase() === 'good') {
    avatar.textContent = '🛸✨';
    speech.textContent = `สวัสดี! ผมชื่อ ${droneConfig?.drone_name || 'Spanner'} พร้อมบินครับ!`;
  } else {
    avatar.textContent = '🔧🛸';
    speech.textContent = `สถานะตอนนี้: ${condition}`;
  }
}

// 1. โหลดข้อมูล Config และ Status ของโดรน
async function loadDroneProfile() {
  try {
    document.getElementById('pet-speech').textContent =
      'กำลังปลุกเซิร์ฟเวอร์ (ครั้งแรกอาจรอ ~20 วิ)...';

    const [cfgRes, statusRes] = await Promise.all([
      fetch(`${API_URL}/configs/${DRONE_ID}`),
      fetch(`${API_URL}/status/${DRONE_ID}`),
    ]);

    if (!cfgRes.ok || !statusRes.ok) throw new Error('API Error');

    droneConfig = await cfgRes.json();
    const statusData = await statusRes.json();

    document.getElementById('drone-id-badge').textContent = `ID: #${droneConfig.drone_id}`;
    document.getElementById('light-badge').textContent = `LIGHT: ${String(droneConfig.light).toUpperCase()}`;
    document.getElementById('pet-condition').textContent = statusData.condition;

    document.getElementById('cfg-id').textContent = droneConfig.drone_id;
    document.getElementById('cfg-name').textContent = droneConfig.drone_name;
    document.getElementById('cfg-light').textContent = droneConfig.light;
    document.getElementById('cfg-country').textContent = droneConfig.country;
    document.getElementById('cfg-weight').textContent = `${droneConfig.weight} kg`;

    updateTamagotchiMood(statusData.condition);
  } catch (err) {
    document.getElementById('pet-avatar').textContent = '😵';
    document.getElementById('pet-speech').textContent = 'ติดต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชใหม่นะ';
  }
}

// 2. โหลดรายการ Logs พร้อม Pagination
async function loadLogs(page = 1) {
  const tbody = document.getElementById('logs-tbody');
  tbody.innerHTML = '<tr><td colspan="5" class="center">กำลังโหลดข้อมูล...</td></tr>';

  try {
    const res = await fetch(`${API_URL}/logs/${DRONE_ID}?page=${page}`);
    if (!res.ok) throw new Error('Failed to load logs');

    const logs = await res.json();
    currentPage = page;
    document.getElementById('page-indicator').textContent = `Page ${currentPage}`;
    document.getElementById('prev-page-btn').disabled = currentPage <= 1;
    document.getElementById('next-page-btn').disabled = logs.length < 12;

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="center">ยังไม่มีข้อมูล Log</td></tr>';
      return;
    }

    // อัปเดตอุณหภูมิล่าสุดบนหน้าจอ Tamagotchi
    if (page === 1 && logs[0]) {
      const cond = document.getElementById('pet-condition').textContent;
      updateTamagotchiMood(cond, logs[0].celsius);
    }

    tbody.innerHTML = logs
      .map(
        (item) => `
        <tr>
          <td>${new Date(item.created).toLocaleString('th-TH')}</td>
          <td>${item.country}</td>
          <td>${item.drone_id}</td>
          <td>${item.drone_name}</td>
          <td><strong>${item.celsius} °C</strong></td>
        </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" class="center">โหลดข้อมูลไม่สำเร็จ</td></tr>';
  }
}

// 3. ส่งข้อมูลบันทึกอุณหภูมิใหม่ (POST /logs)
document.getElementById('temp-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!droneConfig) return;

  const input = document.getElementById('celsius-input');
  const submitBtn = document.getElementById('submit-btn');
  const feedback = document.getElementById('form-feedback');
  const celsiusVal = Number(input.value);

  submitBtn.disabled = true;
  feedback.style.color = '#333';
  feedback.textContent = 'กำลังส่งข้อมูลให้น้อง Spanner...';

  try {
    const res = await fetch(`${API_URL}/logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drone_id: droneConfig.drone_id,
        drone_name: droneConfig.drone_name,
        country: droneConfig.country,
        celsius: celsiusVal,
      }),
    });

    if (!res.ok) throw new Error('POST failed');

    input.value = '';
    feedback.style.color = '#2a9d8f';
    feedback.textContent = `บันทึกอุณหภูมิ ${celsiusVal} °C เรียบร้อยแล้ว!`;

    await loadLogs(1);
  } catch (err) {
    feedback.style.color = '#e63946';
    feedback.textContent = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
  } finally {
    submitBtn.disabled = false;
  }
});

// ปุ่มเปลี่ยนหน้า Pagination
document.getElementById('prev-page-btn').addEventListener('click', () => {
  if (currentPage > 1) loadLogs(currentPage - 1);
});

document.getElementById('next-page-btn').addEventListener('click', () => {
  loadLogs(currentPage + 1);
});

// เริ่มทำงานเมื่อเปิดหน้าเว็บ
loadDroneProfile().then(() => loadLogs(1));