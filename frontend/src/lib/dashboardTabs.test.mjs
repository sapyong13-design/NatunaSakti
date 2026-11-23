import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parse, compileScript } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, toRaw } from 'vue'

async function mountTabs() {
  const filename = new URL('../components/dashboard/DashboardTabs.vue', import.meta.url)
  assert.ok(fs.existsSync(filename), 'dashboard tabs component exists')
  const { descriptor } = parse(fs.readFileSync(filename, 'utf8'))
  const script = compileScript(descriptor, { id: 'dashboard-tabs-test', inlineTemplate: true }).content
    .replaceAll('from "vue"', `from ${JSON.stringify(import.meta.resolve('vue'))}`)
    .replaceAll("from 'vue'", `from ${JSON.stringify(import.meta.resolve('vue'))}`)
  const { default: component } = await import(`data:text/javascript;base64,${Buffer.from(script).toString('base64')}`)
  let focused
  const node = (type, text = '') => ({ type, text, props: {}, children: [], focus() { focused = this } })
  const renderer = createRenderer({
    createElement: node, createText: text => node('text', text), createComment: text => node('comment', text),
    insert(child, parent, anchor) { const i = parent.children.indexOf(anchor); parent.children.splice(i < 0 ? parent.children.length : i, 0, child); child.parent = parent },
    remove(child) { child.parent.children.splice(child.parent.children.indexOf(child), 1) },
    setText(el, text) { el.text = text }, setElementText(el, text) { el.text = text },
    parentNode: el => el.parent, nextSibling: () => null,
    patchProp(el, key, old, value) { el.props[key] = value },
  })
  const root = node('root')
  renderer.createApp({ render: () => h(component, null, { data: () => h('p', 'Case data'), leaderboard: () => h('p', 'Judge data') }) }).mount(root)
  const all = () => { const result = []; const walk = el => { result.push(el); el.children.forEach(walk) }; walk(root); return result }
  return { all, focused: () => focused }
}

test('dashboard puts case content in first tab and leaderboard only in second tab', () => {
  const source = fs.readFileSync(new URL('../views/DataView.vue', import.meta.url), 'utf8')
  assert.match(source, /<DashboardTabs>[\s\S]*?<template #data>[\s\S]*?<TrendCard[\s\S]*?<\/template>\s*<template #leaderboard>\s*<JudgeLeaderboard[^>]*\/>\s*<\/template>\s*<\/DashboardTabs>/)
  assert.equal((source.match(/<JudgeLeaderboard/g) || []).length, 1)
})

test('tab keyboard navigation wraps with arrows and supports Home and End, moving focus', async () => {
  const { all, focused } = await mountTabs()
  const tabs = all().filter(el => el.props.role === 'tab')
  for (const [index, key, expected] of [[0, 'ArrowLeft', 1], [1, 'ArrowRight', 0], [0, 'End', 1], [1, 'Home', 0]]) {
    let prevented = false
    tabs[index].props.onKeydown({ key, preventDefault() { prevented = true } })
    await nextTick()
    assert.equal(prevented, true)
    assert.equal(tabs[expected].props['aria-selected'], true)
    assert.equal(toRaw(focused()), tabs[expected])
  }
})

test('dashboard defaults to Data Perkara and switches accessible panels without destroying their contents', async () => {
  const { all } = await mountTabs()
  const tabs = all().filter(el => el.props.role === 'tab')
  const panels = all().filter(el => el.props.role === 'tabpanel')
  assert.equal(tabs.length, 2)
  assert.deepEqual(tabs.map(el => el.text), ['Data Perkara', 'Leaderboard Hakim'])
  assert.equal(tabs[0].props['aria-selected'], true)
  assert.equal(tabs[0].props.tabindex, 0)
  assert.equal(tabs[1].props.tabindex, -1)
  assert.equal(panels[0].props.hidden, false)
  assert.equal(panels[1].props.hidden, true)
  tabs.forEach((tab, i) => {
    assert.equal(tab.props['aria-controls'], panels[i].props.id)
    assert.equal(panels[i].props['aria-labelledby'], tab.props.id)
  })
  const originalContents = panels.map(panel => panel.children[0])
  tabs[1].props.onClick()
  await nextTick()
  assert.equal(tabs[1].props['aria-selected'], true)
  assert.equal(panels[0].props.hidden, true)
  assert.equal(panels[1].props.hidden, false)
  assert.deepEqual(panels.map(panel => panel.children[0]), originalContents)
})
