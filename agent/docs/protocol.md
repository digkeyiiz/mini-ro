# ข้อกำหนดโปรโตคอลการสื่อสาร (Network Protocol Specification)

> ออกแบบโดย `netcode-architect` สำหรับระบบ Pure JS WebSocket Server (Plesk / Passenger Compatible)

## 1. ภาพรวมโปรโตคอล
- **รูปแบบข้อมูล:** JSON Strings ผ่าน WebSocket (`ws://` หรือ `wss://`)
- **Server Tick:** 20 Ticks/วินาที (ทุกๆ 50ms)
- **การรักษาความถูกต้อง:** Server-authoritative สำหรับตำแหน่ง ดาเมจ HP คูลดาวน์ และสถานะผู้เล่น

## 2. ข้อความจาก Client -> Server

### 2.1 เข้าสู่เกม (Join Game)
```json
{
  "type": "join",
  "name": "PronteraHero",
  "job": "swordsman",
  "lv": 50,
  "hp": 2500,
  "maxHp": 2500,
  "sp": 300,
  "maxSp": 300
}
```

### 2.2 การเคลื่อนที่ (Move Intent with Prediction)
```json
{
  "type": "move",
  "x": 12.5,
  "z": -4.2,
  "vx": 1.2,
  "vz": 0.0,
  "seq": 1042
}
```

### 2.3 เข้าคิว/สร้างห้อง PVP (PVP Queue / Matchmaking)
```json
{
  "type": "pvp_queue",
  "mode": "1v1",
  "roomCode": "8888"
}
```

### 2.4 การโจมตี/ใช้สกิลใส่ผู้เล่น (PVP Attack & Skill Intent)
```json
{
  "type": "pvp_intent",
  "action": "skill",
  "targetId": "p_9921",
  "skillId": "bash",
  "aimX": 5.0,
  "aimZ": 2.0,
  "seq": 1043
}
```

---

## 3. ข้อความจาก Server -> Broadcast Clients

### 3.1 ต้อนรับและยืนยันการเชื่อมต่อ (Welcome)
```json
{
  "type": "welcome",
  "id": "p_1002",
  "serverTime": 1728364800000
}
```

### 3.2 เริ่มการประลอง PVP (PVP Match Start)
```json
{
  "type": "pvp_start",
  "roomId": "room_8888",
  "redTeam": [{"id": "p_1002", "name": "Digg", "x": -15, "z": 0}],
  "blueTeam": [{"id": "p_9921", "name": "Rival", "x": 15, "z": 0}],
  "countdown": 3
}
```

### 3.3 Snapshot สถานะห้อง PVP (Snapshot Broadcast 20Hz)
```json
{
  "type": "pvp_snapshot",
  "tick": 4520,
  "players": [
    {"id": "p_1002", "x": -12.4, "z": 0.1, "hp": 2400, "maxHp": 2500, "sp": 280, "state": "idle"},
    {"id": "p_9921", "x": 10.2, "z": -0.5, "hp": 1800, "maxHp": 2200, "sp": 150, "state": "moving"}
  ]
}
```

### 3.4 ผลการโจมตีโดน (PVP Hit Event)
```json
{
  "type": "pvp_hit",
  "attackerId": "p_1002",
  "targetId": "p_9921",
  "damage": 340,
  "isCrit": true,
  "skillId": "bash",
  "hpRemaining": 1460,
  "ccEffect": "stun",
  "ccDuration": 1.0
}
```

### 3.5 จบการประลอง (PVP End Match)
```json
{
  "type": "pvp_end",
  "winnerTeam": "red",
  "mvpId": "p_1002"
}
```
