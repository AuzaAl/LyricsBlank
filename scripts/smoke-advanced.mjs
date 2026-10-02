// Extended smoke tests: disconnect/DNF grace + sprint timer.
// Run against a live dev server: node scripts/smoke-advanced.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';

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
  fetch(url, { signal: controller.signal })
    .then(async (res) => {
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
    })
    .catch(() => {});
  return { events, close: () => controller.abort() };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(sse, type, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (sse.events.some((e) => e.type === type)) return true;
    await wait(50);
  }
  return false;
}

async function setupRoom(mode, sprintSeconds) {
  const created = await post('/api/room/create', {
    name: 'Host',
    config: { mode, difficulty: 'easy', sprintSeconds },
  });
  const { code, playerId: hostId, token: hostToken } = created.data;
  const joined = await post(`/api/room/${code}/action`, { action: 'join', name: 'Guest' });
  const guestId = joined.data.playerId;
  const guestToken = joined.data.token;
  return { code, hostId, hostToken, guestId, guestToken };
}

async function main() {
  console.log('Advanced smoke tests @', BASE);

  // ---- Sprint timer → timeUp → results ----
  {
    const r = await setupRoom('sprint', 3);
    const host = openSSE(r.code, r.hostId, r.hostToken);
    const guest = openSSE(r.code, r.guestId, r.guestToken);
    await waitFor(host, 'room');

    await post(`/api/room/${r.code}/action`, { action: 'ready', ready: true, playerId: r.hostId, token: r.hostToken });
    await post(`/api/room/${r.code}/action`, { action: 'ready', ready: true, playerId: r.guestId, token: r.guestToken });
    await post(`/api/room/${r.code}/action`, { action: 'start', playerId: r.hostId, token: r.hostToken });

    assert(await waitFor(host, 'go', 5000), 'sprint: go broadcast');
    assert(await waitFor(guest, 'timeUp', 6000), 'sprint: timeUp after duration');
    assert(await waitFor(guest, 'results', 3000), 'sprint: results after timeUp');

    host.close();
    guest.close();
    await wait(200);
  }

  // ---- Disconnect → grace → DNF ----
  {
    const r = await setupRoom('classic');
    const host = openSSE(r.code, r.hostId, r.hostToken);
    const guest = openSSE(r.code, r.guestId, r.guestToken);
    await waitFor(host, 'room');

    await post(`/api/room/${r.code}/action`, { action: 'ready', ready: true, playerId: r.hostId, token: r.hostToken });
    await post(`/api/room/${r.code}/action`, { action: 'ready', ready: true, playerId: r.guestId, token: r.guestToken });
    await post(`/api/room/${r.code}/action`, { action: 'start', playerId: r.hostId, token: r.hostToken });
    assert(await waitFor(host, 'go', 5000), 'dnf: race started');

    // Guest drops mid-race.
    guest.close();
    assert(await waitFor(host, 'playerDnf', 13000), 'dnf: guest marked DNF after grace');

    host.close();
    await wait(200);
  }

  // ---- Reconnect within grace keeps the player ----
  {
    const r = await setupRoom('classic');
    const host = openSSE(r.code, r.hostId, r.hostToken);
    await waitFor(host, 'room');

    const guest1 = openSSE(r.code, r.guestId, r.guestToken);
    await waitFor(guest1, 'room');
    guest1.close();
    await wait(500);

    // Reconnect quickly (well inside the 10s grace).
    const guest2 = openSSE(r.code, r.guestId, r.guestToken);
    assert(await waitFor(guest2, 'room', 3000), 'reconnect: restored within grace');
    await wait(3000);
    assert(
      !host.events.some((e) => e.type === 'playerDnf'),
      'reconnect: no DNF while reconnected'
    );

    host.close();
    guest2.close();
    await wait(200);
  }

  console.log('Advanced smoke tests complete.');
}

main().catch((e) => {
  console.error('Test crashed:', e);
  process.exitCode = 1;
});
