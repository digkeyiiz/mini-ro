# วิเคราะห์ idle RO v7.4 → สู่ Co-op PvE Boss + PvP

> ผลวิเคราะห์จากโค้ดจริง (ไฟล์เดียว ~522 KB) ใช้เป็นฐานให้ทีม agent ทุกตัวอ่านก่อนเริ่มงาน

## 1. สภาพปัจจุบัน (ที่มีแล้ว — ของดี)

- 3D มือถือ (Three.js r128) + GSAP, ฟอนต์ Kanit/Cinzel, UI ภาษาไทย
- 7 อาชีพ × 6 สกิล × เลเวล 1–5, cooldown ลดตามเลเวล (0.2%/lv, cap 50%)
- ระบบ refine +1..+10, rarity/lore, ร้านค้า/ขาย
- 12 แมพ + decor procedural (seeded), collision, hazard (lava/swamp/heal)
- มอนสเตอร์หลาย archetype + animation
- FX engine ครบ: `fxPart fxBurst fxCircle fxShock fxPillar fxSlash fxLightning fxFall fxProj`
- `SKILL_FX` choreography รายสกิล, hit-stop, camera shake, combo counter, skill wheel, target frame
- มี WebSocket พื้นฐาน: ช่อง `/chN`, `/status`, ข้อความ join/move/welcome/players/leave/chat(รับอย่างเดียว)

## 2. ช่องว่างสำคัญ (เรียงตามความเสี่ยง)

| # | ปัญหา | หลักฐานในโค้ด | ผลต่อ co-op/PvP |
|---|-------|----------------|------------------|
| 1 | การต่อสู้ทั้งหมดอยู่ฝั่ง client | `dealDmg`, `execSkill`, `updMons` คำนวณใน browser | โกงได้ทุกอย่าง, เห็นบอสไม่ตรงกัน |
| 2 | ทุกคนเป็น admin | `isAdmin = true` ×3 | ใครก็แก้ของ/เงินได้ |
| 3 | บัญชีแอดมินฮาร์ดโค้ด | `simpleHash('1234')` | รหัสผ่านรั่วในซอร์ส |
| 4 | เซฟอยู่ localStorage | `thro_save_<user>` | แก้ค่าเองได้, ไม่มีเซิร์ฟเวอร์ยืนยัน |
| 5 | ซิงก์มีแค่ตำแหน่ง | WS ส่ง move เท่านั้น, chat ส่งไม่ได้ | ยังไม่ใช่ "เล่นด้วยกัน" |
| 6 | บอสเดียว AI ง่าย | spawn (0,-18), respawn 50s, chase+melee | ไม่มี mechanic ให้ร่วมมือ |
| 7 | มอนสเตอร์ passive จนกว่าโดนตี | `m.aggro` ตั้งใน `dealDmg` | ไม่มี threat/aggro table |
| 8 | สกิลเลือกเป้าใกล้สุด | `execSkill` | ไม่มี ground-target/AoE dodge |
| 9 | บัฟบางตัวอาจไม่มีผล | `getDS` เช็คแค่ bless/protect/focus/counter/agi/dodge (ตรวจเพิ่มก่อนสรุป) | UI โกหกผู้เล่น |
| 10 | Performance | `getAll()` สร้าง array ทุกครั้ง, `updClickIndicators` สร้าง RingGeometry ทุกเฟรม, `svGame()` ทุก 90 เฟรมตอนเดิน | กระตุกบนมือถือเมื่อมีหลายคน |
| 11 | server ไม่อยู่ในไฟล์ | `ThaiRO_server.js` มีแค่ UI hint | ต้องออกแบบ/เขียนใหม่ (pure JS) |

## 3. ทิศทางสถาปัตยกรรม

### 3.1 Server-authoritative (หัวใจ)
- เซิร์ฟเวอร์ถือ: HP/สถานะบอส, HP ผู้เล่น, cooldown, ความเสียหาย, loot, ตำแหน่งที่ตรวจแล้ว
- client ส่งแค่ **intent** (`move`, `cast {skillId, aimX, aimZ}`, `use {itemId}`) → server ตรวจ → broadcast ผล
- tick 10–20 Hz, snapshot + delta, client ทำ interpolation (~100 ms buffer) และ prediction เฉพาะการเดินของตัวเอง
- เซิร์ฟเวอร์: Node + `ws` (pure JS, ห้าม native module) บน Plesk/Passenger — **ต้องทดสอบว่า WebSocket upgrade ผ่าน Passenger จริง** ก่อนออกแบบต่อ; มี fallback เป็น HTTP long-poll/SSE ถ้าไม่ผ่าน
- บัญชี/เซฟ: ย้ายเป็น server (ไฟล์ JSON หรือ SQLite แบบ pure-JS) + token session; ลบ admin ฮาร์ดโค้ด

### 3.2 PvE Co-op Boss (ปาร์ตี้ 2–6 คน)
- **Threat table** + taunt: Swordsman แท็งก์, Mage/Archer DPS, Acolyte ฮีล, Merchant/Thief utility
- บอสมี **เฟส** ตาม HP% (100/70/40/15) แต่ละเฟสเพิ่ม mechanic
- **Telegraph** ทุกท่าใหญ่: วงแดงบนพื้น 0.8–1.5 วินาที → หลบได้ด้วยฝีมือ ไม่ใช่แค่ตัวเลข
- ตัวอย่าง mechanic ร่วมมือ: ลิงก์โซ่ 2 คนต้องยืนห่างกัน, ปลายเฟสต้องทำลายคริสตัล 3 จุดพร้อมกัน, ผู้เล่นโดนมาร์คต้องวิ่งออกจากกลุ่ม, enrage timer
- Revive (ฮีลเลอร์/ไอเทม), wipe → reset บอส
- Loot: ทุกคนที่มีส่วนร่วมได้ของ (ไม่แย่งกัน) + ไอเทมเฉพาะบอส + ระบบสะสมเศษ (pity)
- Raid lobby: สร้างห้อง/โค้ดเชิญเพื่อน, ready check, ความยาก Normal/Hard

### 3.3 PvP
- เริ่มจากโหมดเล็ก: **Arena 1v1 / 2v2 / 3v3** + Duel กับเพื่อน (ไม่ทำ open-world PvP ในรอบแรก)
- ปรับสมดุลแยก: ใช้ "PvP modifier" (ลดดาเมจสกิล, ลด CC duration, DR ต่อ CC) ไม่แตะค่าฝั่ง PvE
- แมตช์เมกกิ้งแบบง่าย: ห้องตามโค้ด/คิว + rating (Elo) ฝั่งเซิร์ฟเวอร์
- Spectator แบบเบา, ผลแมตช์/ลีดเดอร์บอร์ด

### 3.4 ความสวยและความสนุก (Juice)
- Telegraph สวย อ่านง่าย (สีตามความอันตราย), ฟีดแบคการโดนตี (flash, damage number แยกสี, hit-stop เฉพาะผู้ตี)
- Boss intro cinematic สั้น (2–3 วิ), เฟสเปลี่ยนมี camera + FX เด่น
- Audio ด้วย WebAudio สังเคราะห์สด (ไม่ต้องแนบไฟล์เสียง — คงความเป็นไฟล์เดียว)
- UI party frame, boss HP bar หลายเฟส, buff/debuff icon, ping marker, quick chat/emote ภาษาไทย

## 4. Roadmap (ลำดับแนะนำ)

| เฟส | เป้าหมาย | ผลที่ตรวจได้ |
|-----|----------|---------------|
| 0 | ปิดช่องโหว่: ลบ admin ฮาร์ดโค้ด/universal admin, แก้บัฟที่ไม่มีผล, แก้ perf 3 จุด | grep ไม่เจอ `isAdmin = true` ทั้งหมด |
| 1 | Netcode foundation: server ใหม่ (pure JS), tick loop, intent→result, chat ส่งได้ | 2 เบราว์เซอร์เห็นกันและกันตรงกัน |
| 2 | Co-op Boss #1: threat, 3 เฟส, telegraph, ปาร์ตี้/ห้อง, loot | ปาร์ตี้ 3 คนจบบอสได้ ~5–8 นาที |
| 3 | Polish: boss intro, audio, party UI, emote, mobile perf budget | 30+ FPS บนมือถือกลาง |
| 4 | PvP Arena 1v1/2v2 + rating | แมตช์จบได้, ไม่มี desync |
| 5 | Content: บอสเพิ่ม, daily/weekly, cosmetics | — |

## 5. กฎเหล็กของโปรเจกต์
1. client เป็นไฟล์ HTML เดียว (ฝัง CSS/JS ในไฟล์) — ห้ามแยกไฟล์ asset
2. JS สไตล์ ES5 (`var`, function expression) ให้เข้ากับโค้ดเดิม
3. เซิร์ฟเวอร์ pure JS เท่านั้น (ห้าม native module) เพราะ deploy บน Plesk + Passenger
4. มือถือมาก่อน, UI ภาษาไทย, ฟอนต์ Kanit
5. ห้ามเชื่อ client — ทุกค่าที่กระทบความยุติธรรมต้องผ่านเซิร์ฟเวอร์
6. ทุกงานต้องมีสโคปไฟล์/ฟังก์ชันชัดเจน และ checklist ตรวจ (ผู้ใช้ตรวจจำนวนไฟล์ใน diff)
