const assert = require('node:assert/strict');
const { test } = require('node:test');
const Database = require('better-sqlite3');
const { ensureAssignmentSchema, replaceAssignments, getJudgeLeaderboard } = require('./judgeLeaderboard');

test('assignment replacement rejects conflicting duplicate source IDs without silently discarding data', () => {
  const db = new Database(':memory:');
  try {
    ensureAssignmentSchema(db);
    const row = {id:1,perkara_id:1};
    assert.throws(() => db.transaction(() => replaceAssignments(db,[row,{...row,id:'1',perkara_id:2}]))(), /duplikat/);
  } finally {db.close();}
});

test('leaderboard uses appointment dates, distinct cases, all stages and inactive history; excludes unknown roles visibly', () => {
  const db = new Database(':memory:');
  try {
    ensureAssignmentSchema(db);
    const base = { perkara_id: 10, tahapan_id: 10, tanggal_penetapan: '2026-02-01', urutan: 1, jabatan_hakim_id: 1, jabatan_hakim_nama: 'Hakim Ketua', hakim_id: 8, hakim_nama: 'Hakim A', aktif: 'T' };
    replaceAssignments(db, [base, {...base,id:1}, {...base,id:2,tahapan_id:17}, {...base,id:3,jabatan_hakim_id:3,jabatan_hakim_nama:'Hakim Tunggal'}, {...base,id:4,perkara_id:11,jabatan_hakim_id:2,jabatan_hakim_nama:'Hakim Anggota',urutan:2}, {...base,id:5,perkara_id:12,jabatan_hakim_id:2,jabatan_hakim_nama:'Hakim Anggota',urutan:3}, {...base,id:6,perkara_id:13,jabatan_hakim_id:2,jabatan_hakim_nama:'Hakim Anggota',urutan:9}, {...base,id:7,tanggal_penetapan:'2026-01-01'}, {...base,id:8,jabatan_hakim_id:99,jabatan_hakim_nama:'Hakim Ketua'}].filter(r=>r.id));
    const result = getJudgeLeaderboard(db, {period:'monthly',year:'2026',month:'2'});
    assert.deepEqual(result.data[0], { hakim_id:8,hakim_nama:'Hakim A',ketua:1,tunggal:1,anggota1:1,anggota2:1,total:3 });
    assert.equal(result.coverage.period_rows,7);
    assert.equal(result.coverage.counted_rows,5);
    assert.equal(result.coverage.unknown_roles.reduce((n,r)=>n+r.rows,0),2);
    assert.equal(result.date_basis,'tanggal_penetapan');
    assert.equal(getJudgeLeaderboard(db,{period:'yearly',year:'2026'}).coverage.period_rows,8);
    assert.deepEqual(getJudgeLeaderboard(db,{},new Date(2026,1,15)).period,{period:'monthly',year:2026,month:2,start:'2026-02-01',end:'2026-03-01'});
    for (const q of [{year:'2026junk'},{month:'13'},{period:'weekly'},{year:'0'}]) assert.throws(()=>getJudgeLeaderboard(db,q),/invalid/i);
  } finally { db.close(); }
});
