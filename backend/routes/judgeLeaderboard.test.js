const {test} = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Database = require('better-sqlite3');
const {ensureAssignmentSchema} = require('../lib/judgeLeaderboard');
test('GET judge leaderboard responds with local cache and rejects malformed period', async () => {
  const createRouter = require('./judgeLeaderboard');
  const db = new Database(':memory:'); ensureAssignmentSchema(db);
  const app = express(); app.use('/api/dashboard', createRouter(db));
  const server = await new Promise(resolve => {const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  try {
    const base=`http://127.0.0.1:${server.address().port}/api/dashboard/judges`;
    const response = await fetch(base+'?period=yearly&year=2026');
    assert.equal(response.status,200);
    const data=await response.json();
    assert.deepEqual(data.data,[]); assert.equal(data.coverage.synced_at,null);
    assert.equal((await fetch(base+'?month=13')).status,400);
  } finally {await new Promise(resolve=>server.close(resolve)); db.close();}
});
