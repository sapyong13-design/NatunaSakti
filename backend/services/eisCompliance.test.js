const assert = require('node:assert/strict');
const { test } = require('node:test');
const { assessCompliance } = require('./eisCompliance');

const statusAt = (event_at, comparison_at) => assessCompliance('date24', { event_at, comparison_at })[0];

test('24-hour rule separates proven delays from uncertainty due to missing hours', () => {
    assert.equal(statusAt('2026-11-01', '2026-11-01T23:59:00'), 'matched');
    assert.equal(statusAt('2026-11-01', '2026-11-02T07:00:00'), 'unknown');
    assert.equal(statusAt('2026-11-01', '2026-11-03T00:00:00'), 'review');
    assert.equal(statusAt('2026-11-01T13:00:00', '2026-11-02T13:00:00'), 'matched');
    assert.equal(statusAt('2026-11-01T13:00:00', '2026-11-02T13:01:00'), 'review');
    assert.equal(statusAt('2026-11-01T13:00:00', '2026-11-01T12:59:00'), 'unknown');
    assert.equal(statusAt('2026-11-31', '2026-12-03T00:00:00'), 'unknown');
});

test('missing deadline or timestamp is not recorded as a violation', () => {
    const dated = { event_at: '2026-11-01', comparison_at: '2026-11-09' };
    assert.equal(assessCompliance('days', { ...dated, limit_days: 7 })[0], 'review');
    assert.equal(assessCompliance('days', { ...dated, limit_days: 14 })[0], 'matched');
    assert.equal(assessCompliance('days', { ...dated, limit_days: null })[0], 'unknown');
    assert.equal(assessCompliance('date24', { ...dated, comparison_at: null })[0], 'unknown');
    assert.equal(assessCompliance('evidence', { ...dated, present: 1 })[0], 'unknown');
});
