# ทีม AI Agents สร้างเกม — idle RO → Co-op Boss + PvP

ชุดนี้คือ **Claude Code subagents** 10 ตัว (โฟลเดอร์ `.claude/agents/`) ใช้ได้ทันทีโดยคัดลอกโฟลเดอร์ `.claude/` ไปไว้ในรากโปรเจกต์ของเกม

## วิธีติดตั้ง
1. วางไฟล์เกม (เช่น `index.html`) และ `server/` ไว้ในโปรเจกต์
2. คัดลอก `.claude/agents/` และ `docs/` จากแพ็กนี้ไปไว้ในโปรเจกต์
3. เปิด Claude Code แล้วพิมพ์: `ใช้ director วางแผนเฟส 0 จาก docs/ANALYSIS.md`

## รายชื่อทีม

| Agent | หน้าที่ | เขียนโค้ด? |
|-------|---------|-----------|
| `director` | หัวหน้าทีม แตกงาน มอบหมาย รวมผล คุมสโคป | ไม่ (สั่งงาน) |
| `game-designer` | แกนเกม, loop, progression, social/co-op | ไม่ (เขียนสเปก) |
| `combat-boss-designer` | บอส เฟส telegraph threat PvP rules | ไม่ (เขียนสเปก) |
| `netcode-architect` | โปรโตคอล, server authoritative, sync | เขียน `server/` + สเปก |
| `client-engineer` | แก้ HTML เกม (UI, logic, Three.js) | เขียน |
| `art-vfx-director` | ภาพ/FX/แสง/โมเดล/ความสวย | เขียน (เฉพาะ FX/visual) |
| `ui-ux-designer` | UI มือถือ ภาษาไทย HUD party frame | เขียน (เฉพาะ UI) |
| `audio-designer` | เสียง WebAudio สังเคราะห์ | เขียน (เฉพาะ audio) |
| `balance-analyst` | ตัวเลขดาเมจ/HP/ดรอป/เศรษฐกิจ | ไม่ (ตารางและสคริปต์จำลอง) |
| `qa-security-auditor` | หาบั๊ก/โกง/ช่องโหว่/ประสิทธิภาพ | ไม่ (รายงาน) |

## ลำดับการทำงาน (Workflow & Zero-Defect Loop)

```
ผู้ใช้ (คุณ Digg) → director (วางแผนและคุมสโคป)
   ├─ 1. สเปก: game-designer + combat-boss-designer → docs/specs/*.md
   ├─ 2. โค้ด: netcode-architect / client-engineer / ui-ux / art-vfx / audio
   │     │
   │     └── 🔄 [Self-Verification & Auto-Fix Loop]
   │          - ตรวจ syntax / runtime / console error ด้วยตัวเองทันที
   │          - พบ bug/error → แก้ไขทันทีและตรวจซ้ำจน Clean 100%
   │
   ├─ 3. บาลานซ์: balance-analyst (คำนวณและจำลองผล)
   │
   ├─ 4. 🛡️ ตรวจสอบเด็ดขาด: qa-security-auditor
   │     - ตรวจสอบความปลอดภัย, desync, console errors, perf budget
   │     - พบข้อผิดพลาดแม้แต่จุดเดียว ❌ ตีกลับให้ agent เดิมแก้ทันที (ห้ามส่งผู้ใช้)
   │     - ผ่าน 100% ปราศจากบั๊กและ error ✔️ ส่งให้ director
   │
   └─ 5. director ตรวจความสมบูรณ์ครั้งสุดท้าย → ส่งมอบงานที่ 100% พร้อมหลักฐานให้คุณ Digg ดู
```

## พิธีส่งมอบงาน (Handoff)
ทุก agent จบงานด้วยบล็อกนี้ (ภาษาไทย):

```
## ส่งมอบ
- ทำอะไร: …
- ไฟล์/ฟังก์ชันที่แตะ: …   (ต้องตรงกับสโคปที่ได้รับ)
- ผลการตรวจและแก้ไขตัวเอง (Self-Verification):
  [x] Syntax check ผ่าน 100% (คำสั่งที่รัน / ผลลัพธ์)
  [x] Runtime / Console Error: 0 errors, 0 warnings
  [x] บั๊กที่พบระหว่างทำและแก้ไขแล้ว: …
- ความสมบูรณ์: ผ่าน 100% ปราศจากบั๊กและ Error
- ส่งต่อให้: <agent> (หรือ director หากผ่านการรับรองจาก qa แล้ว)
```

## กฎเหล็ก (ทุก agent ต้องทำตามอย่างเคร่งครัด)
1. client = HTML ไฟล์เดียว, ES5 style (`var`), ห้ามเพิ่มไฟล์ asset
2. เซิร์ฟเวอร์ = pure JS (`ws` ได้, native module ห้าม), ต้องรันบน Plesk/Passenger
3. ห้ามเชื่อข้อมูลจาก client สำหรับดาเมจ/HP/loot/cooldown
4. แตะเฉพาะไฟล์/ฟังก์ชันที่ได้รับมอบ — เกินสโคปให้หยุดและรายงาน
5. มือถือมาก่อน: งบ 30+ FPS, ไม่สร้าง geometry/array ใหม่ทุกเฟรม
6. UI ภาษาไทย, ตัวเลข/ข้อความสั้นอ่านง่าย
7. ห้ามลบหรือรื้อระบบเดิมที่ทำงานอยู่ (อาชีพ สกิล refine แมพ) นอกจากสั่งชัดเจน
8. **ความสมบูรณ์ 100% ปราศจากบั๊ก (Zero-Bug & Self-Fix Guarantee)**:
   - ก่อนส่งมอบงานหรือรายงานผลลัพธ์ให้คุณ Digg ตัว agent ต้องรันตรวจสอบจริง (node --check, syntax check, browser console simulation, headless/test script, server run)
   - **หากพบ error, warning หรือ bug แม้แต่จุดเดียว ต้องลงมือแก้ไขและรันตรวจซ้ำทันทีจนกว่าจะผ่าน 100%**
   - ห้ามส่งงานที่ยังมีบั๊ก หรือส่งงานแบบ "น่าจะใช้ได้" ให้คุณ Digg ไปลองแก้หรือเจอ error เองเด็ดขาด!
9. ห้ามแต่งตัวเลข/ผลทดสอบ — ต้องมีหลักฐานการรันจริง (คำสั่งและผลลัพธ์ที่จับได้จริง)

## ตัวอย่างคำสั่งแบบ Megaplan
```
ใช้ director: เฟส 1 Netcode foundation
สโคป: server/server.js (ใหม่), index.html เฉพาะฟังก์ชัน connectWS/handleWS/sendIntent
ห้าม: แตะระบบสกิล/refine/แมพ, เพิ่ม dependency นอกจาก ws
ตรวจ: 2 เบราว์เซอร์เห็นกัน, chat ส่งได้, ฆ่าเซิร์ฟเวอร์แล้ว client reconnect
ส่งผล: diff ไม่เกิน 2 ไฟล์
```

อ่านบริบทละเอียดที่ `docs/ANALYSIS.md`
