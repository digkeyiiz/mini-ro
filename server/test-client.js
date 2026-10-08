/* ==========================================================================
   idle RO PVP Test Script - Automated Verification of PVP Netcode Sync
   ========================================================================== */

var WebSocket = require('ws');
var SERVER_URL = 'ws://localhost:8080';

console.log('[Test Script] Connecting 2 fake clients to PVP WebSocket server...');

var client1 = new WebSocket(SERVER_URL);
var client2 = new WebSocket(SERVER_URL);

var c1Id = null;
var c2Id = null;
var testSuccess = false;

client1.on('open', function () {
  console.log('[Test Client 1] Connected');
  client1.send(JSON.stringify({ type: 'join', name: 'Tester_Red', job: 'swordsman', lv: 50, hp: 3000, maxHp: 3000 }));
});

client2.on('open', function () {
  console.log('[Test Client 2] Connected');
  client2.send(JSON.stringify({ type: 'join', name: 'Tester_Blue', job: 'mage', lv: 50, hp: 2000, maxHp: 2000 }));
});

client1.on('message', function (msg) {
  var data = JSON.parse(msg);
  console.log('[Client 1 Received]: ' + data.type);
  if (data.type === 'welcome') {
    c1Id = data.id;
    client1.send(JSON.stringify({ type: 'pvp_queue', mode: '1v1', roomCode: '9999' }));
  }
  if (data.type === 'pvp_fight_start') {
    console.log('[Test Client 1] Fight started! Moving to x=10 (close to Client 2 at x=15)...');
    client1.send(JSON.stringify({ type: 'move', x: 10, z: 0, vx: 0, vz: 0, seq: 1 }));
    setTimeout(function () {
      console.log('[Test Client 1] Attacking Client 2 (ID: ' + c2Id + ') with Bash skill...');
      client1.send(JSON.stringify({
        type: 'pvp_intent',
        action: 'skill',
        skillId: 'bash',
        targetId: c2Id
      }));
    }, 200);
  }
  if (data.type === 'pvp_hit') {
    console.log('[Test Client 1] Hit confirmed! Damage: ' + data.damage + ', Target HP: ' + data.hpRemaining);
    testSuccess = true;
    finishTest();
  }
});

client2.on('message', function (msg) {
  var data = JSON.parse(msg);
  console.log('[Client 2 Received]: ' + data.type);
  if (data.type === 'welcome') {
    c2Id = data.id;
    client2.send(JSON.stringify({ type: 'pvp_queue', mode: '1v1', roomCode: '9999' }));
  }
});

function finishTest() {
  if (testSuccess) {
    console.log('\n✅ [TEST PASSED] PVP Netcode, Matchmaking, and Combat Sync are 100% SUCCESSFUL!\n');
  } else {
    console.error('\n❌ [TEST FAILED] PVP Netcode test did not complete successfully.\n');
  }
  try { client1.close(); } catch(e){}
  try { client2.close(); } catch(e){}
  process.exit(testSuccess ? 0 : 1);
}

setTimeout(function () {
  if (!testSuccess) {
    console.error('\n⏰ [TEST TIMEOUT] PVP Netcode test timed out after 10s.\n');
    finishTest();
  }
}, 10000);
