# ข้อกำหนดระบบ PVP Arena (PVP Specification)

> ออกแบบโดย `game-designer` & `combat-boss-designer` สำหรับเกม idle RO

## 1. แมพ PVP เฉพาะ (Izlu Arena)
- **ID:** `arena`
- **ชื่อ:** `⚔️ Izlu Arena`
- **สภาพแวดล้อม:** สนามประลองรูปแปดเหลี่ยม พื้นหินอ่อน ตกแต่งด้วยคบเพลิงและเสาหิน 4 ต้น (ใช้บังสายตา/สกิล Line of Sight)
- **จุดเกิด:**
  - Red Spawn Point: `(-15, 0, 0)`
  - Blue Spawn Point: `(15, 0, 0)`
- **บาเรียเตรียมพร้อม (Countdown 3s):** บาเรียครอบจุดเกิด ห้ามเดินออกจากจุดเกิดจนกว่านับถอยหลังจะหมด
- **Central Buff Zone:** ตำแหน่ง `(0, 0, 0)` สุ่มเกิดบัฟวงกลมสีทองทุกๆ 30 วินาที (+20% Move Speed, +15% ATK เป็นเวลา 10 วิ)

## 2. ระบบการต่อสู้เสมือนตีมอนสเตอร์ (PVP Combat System)
- **Target Lock System:**
  - แตะตัวละครผู้เล่นศัตรู หรือกดปุ่ม **Target Switch** เพื่อเปลี่ยนเป้าหมายผู้เล่นใกล้ที่สุด
  - มีกรอบเป้าหมาย (Target Frame) ด้านบนแสดง HP/SP/ชื่ออาชีพ/ระดับความเสียหาย
- **PVP Modifiers & Damage Scaling:**
  - **PVP Damage Multiplier:** ดาเมจกายภาพและเวทมนตร์ลดเหลือ `40%` ของ PvE เพื่อป้องกัน 1-Shot Kill
  - **CC Diminishing Returns (DR):** ระยะเวลาโดน Stun / Freeze / Slow ลดลงเหลือ `50%` ใน PVP และหากโดนซ้ำภายใน 15 วิ ระยะเวลาจะลดลงเหลือ 50% -> 25% -> 0% (Immune)
- **Hit Feedback:**
  - ตัวเลขดาเมจแยกสี (แดง=กายภาพ, ฟ้า=เวทมนตร์, ส้ม=คริติคอล, เขียว=ฮีล)
  - มี Hit-stop (0.05 วิ) และ Camera Shake เบาๆ เมื่อตีโดน

## 3. สถาปัตยกรรมไร้ดีเลย์ (Zero-Lag Netcode Protocol)
- **Client-Side Prediction (CSP):** เมื่อผู้เล่นกดเคลื่อนที่หรือใช้สกิล ฝั่ง Client จะเล่นอนิเมชันและขยับตัวละครทันที (0ms delay)
- **Server Tick Rate:** 20Hz (คำนวณตำแหน่ง, คูลดาวน์, ดาเมจ, ตรวจสอบระยะยิงบนเซิร์ฟเวอร์)
- **Entity Interpolation:** ฝั่ง Client เก็บ Snapshot Buffer 100ms เพื่อ rendering การเคลื่อนที่ของคู่ต่อสู้อย่างนุ่มนวล 60+ FPS
- **Lag Compensation:** คำนวณ Hit Registration ย้อนหลังตาม Latency เพื่อให้การยิง/ใช้สกิลแม่นยำ

## 4. โหมดการเล่น (PVP Modes)
- **1v1 Duel:** ท้าประลองกับเพื่อน หรือสร้างห้องด้วยรหัส 4 หลัก
- **Team Arena (2v2 / 3v3):** แบ่งทีม Red vs Blue ฝั่งที่กำจัดคู่ต่อสู้ครบก่อนเป็นฝ่ายชนะ
