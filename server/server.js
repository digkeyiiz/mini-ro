/* ==========================================================================
   idle RO - Online Co-op & PVP Pure JS WebSocket Server
   Compatible with Plesk / Phusion Passenger / Node.js
   No native C++ modules required (Pure JS only)
   ========================================================================== */

var http = require('http');
var WebSocket = require('ws');

var PORT = process.env.PORT || 8080;
var TICK_RATE = 20; // 20 Ticks per second (50ms interval)
var TICK_INTERVAL = 1000 / TICK_RATE;

// Server state
var clients = {}; // clientId -> socket & player state
var rooms = {};   // roomId -> room state

// Helper ID generator
function genId(prefix) {
  return (prefix || 'id') + '_' + Math.random().toString(36).substr(2, 7);
}

// Create HTTP server (Passenger compatible)
var server = http.createServer(function (req, res) {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', activeClients: Object.keys(clients).length, activeRooms: Object.keys(rooms).length }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// Create WebSocket server attached to HTTP server
var wss = new WebSocket.Server({ server: server });

console.log('[PVP Server] Starting idle RO PVP WebSocket Server on port ' + PORT);

wss.on('connection', function (ws) {
  var id = genId('p');
  var playerState = {
    id: id,
    ws: ws,
    name: 'Player_' + id.substr(2, 4),
    job: 'swordsman',
    lv: 1,
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    hp: 1000,
    maxHp: 1000,
    sp: 200,
    maxSp: 200,
    roomId: null,
    team: null,
    isReady: false,
    lastIntentSeq: 0,
    lastCastTime: 0
  };

  clients[id] = playerState;
  console.log('[Connect] Player joined: ' + id);

  // Send welcome packet
  sendTo(ws, {
    type: 'welcome',
    id: id,
    serverTime: Date.now()
  });

  // Handle incoming messages
  ws.on('message', function (message) {
    try {
      var data = JSON.parse(message);
      handleMessage(playerState, data);
    } catch (e) {
      console.error('[Error] Invalid JSON payload from ' + id, e);
    }
  });

  // Handle disconnect
  ws.on('close', function () {
    console.log('[Disconnect] Player left: ' + id);
    if (playerState.roomId && rooms[playerState.roomId]) {
      leaveRoom(playerState);
    }
    delete clients[id];
  });

  ws.on('error', function (err) {
    console.error('[Socket Error] ' + id + ':', err.message);
  });
});

// Direct messaging helper
function sendTo(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// Broadcast to room
function broadcastToRoom(roomId, data, excludeId) {
  var room = rooms[roomId];
  if (!room) return;
  var json = JSON.stringify(data);
  for (var i = 0; i < room.players.length; i++) {
    var pId = room.players[i];
    if (pId !== excludeId && clients[pId] && clients[pId].ws.readyState === WebSocket.OPEN) {
      clients[pId].ws.send(json);
    }
  }
}

// Handle client messages
function handleMessage(player, data) {
  switch (data.type) {
    case 'join':
      if (data.name) player.name = String(data.name).substr(0, 16);
      if (data.job) player.job = String(data.job);
      if (data.lv) player.lv = Math.max(1, parseInt(data.lv) || 1);
      if (data.hp) player.hp = Math.max(10, parseInt(data.hp) || 1000);
      if (data.maxHp) player.maxHp = Math.max(10, parseInt(data.maxHp) || 1000);
      break;

    case 'move':
      if (typeof data.x === 'number') player.x = data.x;
      if (typeof data.z === 'number') player.z = data.z;
      if (typeof data.vx === 'number') player.vx = data.vx;
      if (typeof data.vz === 'number') player.vz = data.vz;
      if (data.seq) player.lastIntentSeq = data.seq;

      // Broadcast position if in room
      if (player.roomId) {
        broadcastToRoom(player.roomId, {
          type: 'player_move',
          id: player.id,
          x: player.x,
          z: player.z,
          vx: player.vx,
          vz: player.vz,
          seq: player.lastIntentSeq
        }, player.id);
      }
      break;

    case 'pvp_queue':
      handlePvpQueue(player, data.mode || '1v1', data.roomCode);
      break;

    case 'pvp_ready':
      if (player.roomId && rooms[player.roomId]) {
        player.isReady = true;
        checkRoomStart(rooms[player.roomId]);
      }
      break;

    case 'pvp_intent':
      handlePvpIntent(player, data);
      break;

    case 'chat':
      if (player.roomId) {
        broadcastToRoom(player.roomId, {
          type: 'chat',
          sender: player.name,
          text: String(data.text || '').substr(0, 100)
        });
      }
      break;
  }
}

// Handle PVP queue & custom room joining
function handlePvpQueue(player, mode, roomCode) {
  var targetRoomId = roomCode ? 'room_' + roomCode : 'room_match_' + mode;

  // Leave previous room if any
  if (player.roomId) {
    leaveRoom(player);
  }

  var room = rooms[targetRoomId];
  if (!room) {
    room = {
      id: targetRoomId,
      code: roomCode || 'MATCH',
      mode: mode,
      state: 'lobby', // lobby, countdown, fighting, ended
      players: [],
      redTeam: [],
      blueTeam: [],
      countdownTimer: 0,
      tick: 0
    };
    rooms[targetRoomId] = room;
  }

  // Join room
  player.roomId = room.id;
  room.players.push(player.id);

  // Assign team (Red vs Blue)
  if (room.redTeam.length <= room.blueTeam.length) {
    player.team = 'red';
    player.x = -15;
    player.z = 0;
    room.redTeam.push(player.id);
  } else {
    player.team = 'blue';
    player.x = 15;
    player.z = 0;
    room.blueTeam.push(player.id);
  }

  console.log('[PVP Queue] Player ' + player.id + ' joined room ' + room.id + ' on team ' + player.team);

  // Send match join status
  broadcastToRoom(room.id, {
    type: 'pvp_room_update',
    roomId: room.id,
    players: room.players.map(function (pid) {
      var p = clients[pid];
      return p ? { id: p.id, name: p.name, job: p.job, team: p.team, ready: p.isReady } : null;
    }).filter(Boolean)
  });

  // Auto-start countdown if 2 or more players
  if (room.players.length >= 2 && room.state === 'lobby') {
    startCountdown(room);
  }
}

// Start match countdown
function startCountdown(room) {
  room.state = 'countdown';
  room.countdownTimer = 3;

  broadcastToRoom(room.id, {
    type: 'pvp_start',
    roomId: room.id,
    countdown: 3,
    redTeam: room.redTeam.map(function (pid) { return getPlayerSummary(clients[pid]); }),
    blueTeam: room.blueTeam.map(function (pid) { return getPlayerSummary(clients[pid]); })
  });

  var countInterval = setInterval(function () {
    room.countdownTimer--;
    if (room.countdownTimer > 0) {
      broadcastToRoom(room.id, {
        type: 'pvp_countdown',
        count: room.countdownTimer
      });
    } else {
      clearInterval(countInterval);
      room.state = 'fighting';
      broadcastToRoom(room.id, {
        type: 'pvp_fight_start'
      });
      console.log('[PVP Match] Fight started in room ' + room.id);
    }
  }, 1000);
}

// Get player summary object
function getPlayerSummary(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    job: p.job,
    lv: p.lv,
    team: p.team,
    x: p.x,
    z: p.z,
    hp: p.hp,
    maxHp: p.maxHp,
    sp: p.sp,
    maxSp: p.maxSp
  };
}

// Leave room
function leaveRoom(player) {
  var room = rooms[player.roomId];
  if (!room) return;

  var idx = room.players.indexOf(player.id);
  if (idx !== -1) room.players.splice(idx, 1);

  var rIdx = room.redTeam.indexOf(player.id);
  if (rIdx !== -1) room.redTeam.splice(rIdx, 1);

  var bIdx = room.blueTeam.indexOf(player.id);
  if (bIdx !== -1) room.blueTeam.splice(bIdx, 1);

  player.roomId = null;
  player.team = null;

  if (room.players.length === 0) {
    delete rooms[room.id];
    console.log('[PVP Room] Deleted empty room ' + room.id);
  } else {
    broadcastToRoom(room.id, {
      type: 'pvp_player_left',
      playerId: player.id
    });
  }
}

// Handle PVP combat intent (attack/skill)
function handlePvpIntent(attacker, data) {
  if (!attacker.roomId || !rooms[attacker.roomId]) return;
  var room = rooms[attacker.roomId];
  if (room.state !== 'fighting') return;

  var target = clients[data.targetId];
  if (!target || target.roomId !== attacker.roomId || target.team === attacker.team) return;
  if (target.hp <= 0) return;

  // Validate Cooldown (500ms global cooldown)
  var now = Date.now();
  if (now - attacker.lastCastTime < 300) return;
  attacker.lastCastTime = now;

  // Calculate Distance
  var dx = target.x - attacker.x;
  var dz = target.z - attacker.z;
  var dist = Math.sqrt(dx * dx + dz * dz);

  var maxRng = (data.action === 'skill' ? 12 : 3.5);
  if (dist > maxRng) {
    // Target out of range
    return;
  }

  // PVP Damage Scaling (40% PvE damage)
  var baseDmg = 120 + (attacker.lv * 8);
  if (data.skillId === 'bash') baseDmg *= 1.8;
  if (data.skillId === 'firebolt') baseDmg *= 2.2;
  if (data.skillId === 'double_strafe') baseDmg *= 1.6;

  var pvpDmg = Math.round(baseDmg * 0.4); // 40% PVP multiplier
  var isCrit = (Math.random() < 0.25);
  if (isCrit) pvpDmg = Math.round(pvpDmg * 1.5);

  // Apply Damage
  target.hp = Math.max(0, target.hp - pvpDmg);

  var ccEffect = null;
  var ccDuration = 0;
  if (data.skillId === 'bash' && Math.random() < 0.3) {
    ccEffect = 'stun';
    ccDuration = 1.0; // 1.0s stun in PVP
  }

  // Broadcast hit event
  broadcastToRoom(room.id, {
    type: 'pvp_hit',
    attackerId: attacker.id,
    targetId: target.id,
    damage: pvpDmg,
    isCrit: isCrit,
    skillId: data.skillId || 'attack',
    hpRemaining: target.hp,
    maxHp: target.maxHp,
    ccEffect: ccEffect,
    ccDuration: ccDuration
  });

  // Check victory condition
  if (target.hp <= 0) {
    checkVictory(room);
  }
}

// Check victory condition in room
function checkVictory(room) {
  var redAlive = room.redTeam.some(function (pid) { return clients[pid] && clients[pid].hp > 0; });
  var blueAlive = room.blueTeam.some(function (pid) { return clients[pid] && clients[pid].hp > 0; });

  if (!redAlive || !blueAlive) {
    room.state = 'ended';
    var winner = redAlive ? 'red' : (blueAlive ? 'blue' : 'draw');
    broadcastToRoom(room.id, {
      type: 'pvp_end',
      winnerTeam: winner
    });

    console.log('[PVP End] Match ended in room ' + room.id + '. Winner: ' + winner);

    // Reset room after 5 seconds
    setTimeout(function () {
      if (rooms[room.id]) {
        room.state = 'lobby';
        for (var i = 0; i < room.players.length; i++) {
          var p = clients[room.players[i]];
          if (p) {
            p.hp = p.maxHp;
            p.x = (p.team === 'red' ? -15 : 15);
            p.z = 0;
          }
        }
      }
    }, 5000);
  }
}

// Server Main Loop (20Hz Tick Broadcast)
setInterval(function () {
  for (var rId in rooms) {
    var room = rooms[rId];
    if (room.state === 'fighting') {
      room.tick++;
      var snapshot = {
        type: 'pvp_snapshot',
        tick: room.tick,
        players: room.players.map(function (pid) {
          var p = clients[pid];
          return p ? { id: p.id, x: p.x, z: p.z, vx: p.vx, vz: p.vz, hp: p.hp, maxHp: p.maxHp, sp: p.sp, maxSp: p.maxSp } : null;
        }).filter(Boolean)
      };
      broadcastToRoom(rId, snapshot);
    }
  }
}, TICK_INTERVAL);

// Start listening
server.listen(PORT, function () {
  console.log('[PVP Server] WebSocket Server listening on port ' + PORT);
});
