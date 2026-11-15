# 🛸 SPANNER-GOTCHI | Drone Pet OS v3.1

เว็บแอปพลิเคชันสำหรับติดตามสถานะและบันทึกข้อมูลอุณหภูมิของโดรน (Drone ID: `67010177`) ในรูปแบบจำลองหน้าจอคอมพิวเตอร์ **Desktop OS Dual-Window** เชื่อมต่อข้อมูลผ่าน RESTful API Server

- **Live Web App (Render):** `https://drone-tamagotchi-web.onrender.com`
- **Backend API Server:** `https://drone-api-spanner.onrender.com`

---

## ✨ ฟีเจอร์หลักตามโจทย์ (Core Features)
1. **View Config:** แสดงข้อมูลจำเพาะของโดรน (`drone_id`, `drone_name`, `light`, `country`) จาก `GET /configs/:droneId`
2. **Log Temp:** ฟอร์มบันทึกค่าอุณหภูมิ (`celsius`) ส่งไปยัง `POST /logs` โดยดึงข้อมูลชื่อโดรนและประเทศมาประกอบอัตโนมัติ
3. **View Logs:** ตารางแสดงประวัติการบันทึกอุณหภูมิเรียงจากล่าสุด พร้อมระบบแบ่งหน้า (Pagination) หน้าละ 12 รายการ จาก `GET /logs/:droneId?page=`

## 🚀 ลูกเล่นเพิ่มเติม (Interactive OS Features)
- **Desktop OS Dual-Window UI:** แบ่งหน้าจอการทำงานเป็น 2 หน้าต่างคู่กัน (`SPANNER_MONITOR.EXE` และ `CONTROL_TERMINAL.APP`) พร้อมแถบ Menubar ด้านบน, เมนู `Start` และ Taskbar สำหรับย่อ/ขยายหน้าต่างได้จริง
- **Dynamic Mood & Shutdown/Revival System:** เปลี่ยนสีหน้าจอและอารมณ์ของ Spanner ตามอุณหภูมิล่าสุด (`<= 10°C` เครื่องแข็งตัวดับ, `11–19°C` หนาว, `20–34°C` ปกติ, `35–39°C` ร้อน, `>= 40°C` เครื่องฮีตดับ) พร้อมระบบกู้ชีพด้วยการป้อนอุณหภูมิปกติหรือกดปุ่ม `Reboot`
- **Temperature Sparkline Chart:** กราฟเส้น SVG แสดงแนวโน้มอุณหภูมิสูงสุด-ต่ำสุดในหน้าประวัติ
- **Quick Preset Buttons:** ปุ่มลัดเลือกอุณหภูมิสำหรับทดสอบ (`8°C`, `25°C`, `37°C`, `42°C`)
- **8-Bit Web Audio SFX & Night Radar Mode:** ระบบเสียงเอฟเฟกต์สไตล์เครื่องเกมย้อนยุค (เปิด/ปิดได้) และโหมดเรดาร์กลางคืน
- **CSV Export:** ดาวน์โหลดประวัติอุณหภูมิในหน้าปัจจุบันออกมาเป็นไฟล์ `.csv` ผ่านเมนู `File`

---

## 🛠️ การติดตั้งและรันในเครื่อง (Local Setup)

1. ติดตั้ง Dependencies:
   ```bash
   npm install
   ```
2. สร้างไฟล์ `.env` ที่โฟลเดอร์หลักของโปรเจกต์ และระบุค่า Environment Variables:
   ```env
   VITE_API_URL=[https://drone-api-spanner.onrender.com](https://drone-api-spanner.onrender.com)
   VITE_DRONE_ID=67010177
   ```
3. รันเซิร์ฟเวอร์พัฒนา:
   ```bash
   npm run dev
   ```