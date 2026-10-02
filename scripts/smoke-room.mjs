// End-to-end smoke test for the multiplayer room API.
// Run against a live dev server: node scripts/smoke-room.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';

const log = (...a) => console.log(...a);
const assert = (cond, msg) => {
  if (!cond) {
    console.error('❌ FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('✓', msg);
  }
};

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function openSSE(code, playerId, token) {
  const url = `${BASE}/api/room/${code}/events?playerId=${encodeURIComponent(
    playerId
  )}&token=${encodeURIComponent(token)}`;
  const controller = new AbortController();
  const events = [];
  const done = fetch(url, { signal: controller.signal }).then(async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const evLine = chunk.split('\n').find((l) => l.startsWith('event: '));
        const dataLine = chunk.split('\n').find((l) => l.startsWith('data: '));
        if (evLine && dataLine) {
          events.push({ type: evLine.slice(7), data: JSON.parse(dataLine.slice(6)) });
        }
      }
    }
  }).catch(() => {});
  return { events, close: () => controller.abort(), done };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Poll until an event of the given type appears, or time out. */
async function waitFor(sse, type, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sse.events.some((e) => e.type === type)) return true;
    await wait(50);
  }
  return false;
}

async function main() {
  log('Room API smoke test @', BASE);

  // 1. Create
  const created = await post('/api/room/create', {
    name: 'Host',
    config: { mode: 'classic', difficulty: 'easy' },
  });
  assert(created.status === 200, 'create returns 200');
  const { code, playerId: hostId, token: hostToken } = created.data;
  assert(/^[A-Z0-9]{5}$/.test(code), `room code format (${code})`);

  // 2. Host SSE
  const host = openSSE(code, hostId, hostToken);
  assert(await waitFor(host, 'room'), 'host receives initial room snapshot');

  // 3. Join
  const joined = await post(`/api/room/${code}/action`, { action: 'join', name: 'Guest' });
  assert(joined.status === 200 && joined.data.playerId, 'guest joins');
  const guestId = joined.data.playerId;
  const guestToken = joined.data.token;

  const guest = openSSE(code, guestId, guestToken);
  assert(await waitFor(host, 'playerJoined'), 'host is notified of the join');

  // 4. Start rejected before ready
  const earlyStart = await post(`/api/room/${code}/action`, {
    action: 'start',
    playerId: hostId,
    token: hostToken,
  });
  assert(earlyStart.status === 400, 'start rejected when players not ready');

  // 5. Non-host cannot start
  const guestStart = await post(`/api/room/${code}/action`, {
    action: 'start',
    playerId: guestId,
    token: guestToken,
  });
  assert(guestStart.status === 400, 'non-host cannot start');

  // 6. Ready both, then start
  await post(`/api/room/${code}/action`, { action: 'ready', ready: true, playerId: hostId, token: hostToken });
  await post(`/api/room/${code}/action`, { action: 'ready', ready: true, playerId: guestId, token: guestToken });
  const start = await post(`/api/room/${code}/action`, {
    action: 'start',
    playerId: hostId,
    token: hostToken,
  });
  assert(start.status === 200, 'host starts once all ready');

  assert(await waitFor(host, 'countdown'), 'countdown broadcast');
  assert(await waitFor(host, 'go', 5000), 'go broadcast after countdown');

  // 7. Progress + finish
  await post(`/api/room/${code}/action`, {
    action: 'progress',
    playerId: hostId,
    token: hostToken,
    snapshot: { lineIndex: 2, totalLines: 10, score: 300, accuracy: 0.95 },
  });
  assert(await waitFor(host, 'standings'), 'standings broadcast on progress');

  await post(`/api/room/${code}/action`, {
    action: 'finish',
    playerId: hostId,
    token: hostToken,
    finishTimeMs: 42000,
    score: 2100,
    accuracy: 0.96,
  });
  assert(await waitFor(host, 'playerFinished'), 'playerFinished broadcast');

  // 8. Bad credentials rejected
  const bad = await post(`/api/room/${code}/action`, {
    action: 'progress',
    playerId: hostId,
    token: 'wrong-token',
  });
  assert(bad.status === 403, 'bad token rejected (403)');

  // 9. Leave triggers host migration
  await post(`/api/room/${code}/action`, {
    action: 'leave',
    playerId: hostId,
    token: hostToken,
  });
  assert(
    await waitFor(guest, 'playerLeft'),
    'guest notified when host leaves'
  );

  host.close();
  guest.close();
  await wait(200);
  log('Smoke test complete.');
}

main().catch((e) => {
  console.error('Test crashed:', e);
  process.exitCode = 1;
});
