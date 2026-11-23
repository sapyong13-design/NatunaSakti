import {test} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {parse, compileScript} from '@vue/compiler-sfc'
import * as api from './api.js'

test('leaderboard API sends independent appointment period selectors', async () => {
  const old = globalThis.fetch
  let url
  globalThis.fetch = async value => {url=value; return {ok:true,status:200,json:async()=>({data:[]})}}
  try {
    assert.equal(typeof api.getJudgeLeaderboard,'function')
    assert.deepEqual(await api.getJudgeLeaderboard({period:'yearly',year:2026}),{data:[]})
    assert.match(url,/\/dashboard\/judges\?period=yearly&year=2026/)
  } finally {globalThis.fetch=old}
})

test('dashboard judge card compiles and exposes appointment controls, role columns, coverage and honest empty/error states', () => {
  const filename = new URL('../components/dashboard/JudgeLeaderboard.vue',import.meta.url)
  assert.equal(fs.existsSync(filename),true,'judge card exists')
  const source=fs.readFileSync(filename,'utf8')
  const {descriptor,errors}=parse(source)
  assert.deepEqual(errors,[])
  assert.ok(compileScript(descriptor,{id:'judge-card',inlineTemplate:true}).content)
  for (const label of ['Tanggal penetapan','Bulanan','Tahunan','Ketua','Tunggal','Anggota 1','Anggota 2','Total unik','Belum ada','Gagal','unknown_roles','includes_inactive']) assert.ok(source.includes(label),label)
  assert.match(fs.readFileSync(new URL('../views/DataView.vue',import.meta.url),'utf8'),/<JudgeLeaderboard/)
})
