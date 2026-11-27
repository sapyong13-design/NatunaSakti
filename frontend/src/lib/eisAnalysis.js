const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

export function opportunityKey(tabId, label) {
    return `${tabId}|${label}`;
}

export function extractSippVersionAlert(snapshot, computedScore) {
    const kinerjaRows = snapshot?.tabs?.find((tab) => tab.id === 'kinerja')?.rows ?? [];
    const row = kinerjaRows.find((item) => /rilis versi sipp/i.test(item.label || ''));
    if (!row) return null;

    const comp = computedScore?.components?.find((item) => item.id === 'kinerja');
    const element = comp?.elements?.find((item) => /rilis versi sipp/i.test(item.label || ''));
    const points = element ? element.points : Number(String(row.points || '').replace(',', '.')) || 0;
    const denominator = element?.denominator ?? 20;
    const lostPoints = Math.max(0, round2(denominator - points));
    if (lostPoints <= 0) return null;

    const values = row.details?.[0]?.values ?? [];
    const latest = String(values[0] || '').trim() || '—';
    const installed = String(values[1] || '').trim() || '—';
    const activeComponents = (computedScore?.components ?? []).filter((c) => c.konversi !== null).length || 4;
    const totalImpactPp = comp?.maks > 0
        ? round2((100 * lostPoints / comp.maks) / activeComponents)
        : null;

    return {
        active: true,
        label: row.label,
        latest,
        installed,
        lostPoints,
        totalImpactPp
    };
}

export function buildLostOpportunities(computedScore) {
    if (!Array.isArray(computedScore?.components)) return [];
    const activeComponents = computedScore.components.filter((c) => c.konversi !== null && c.maks > 0);
    const componentCount = activeComponents.length || 1;
    const items = [];

    for (const comp of activeComponents) {
        const aspectBefore = comp.konversi;
        for (const el of comp.elements || []) {
            if (!el.denominator || el.denominator <= el.points) continue;
            const lostPoints = round2(el.denominator - el.points);
            if (lostPoints <= 0) continue;
            const newPeroleh = Math.min(comp.maks, round2(comp.peroleh + lostPoints));
            const aspectAfter = round2(100 * newPeroleh / comp.maks);
            const totalImpactPp = round2((aspectAfter - aspectBefore) / componentCount);
            items.push({
                key: opportunityKey(comp.id, el.label),
                tabId: comp.id,
                label: el.label,
                points: el.points,
                denominator: el.denominator,
                lostPoints,
                aspectBefore,
                aspectAfter,
                totalImpactPp
            });
        }
    }

    return items.sort((a, b) => b.totalImpactPp - a.totalImpactPp || b.lostPoints - a.lostPoints);
}

export function simulateEisScore(computedScore, selectedKeys = []) {
    if (!Array.isArray(computedScore?.components)) return null;
    const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys);
    const baseTotal = computedScore.total ?? computedScore.officialTotal ?? null;

    const byComponent = {};
    const konversiList = [];

    for (const comp of computedScore.components) {
        if (!comp.maks || comp.konversi === null) continue;
        let bonus = 0;
        for (const el of comp.elements || []) {
            if (selected.has(opportunityKey(comp.id, el.label)) && el.denominator > el.points) {
                bonus += el.denominator - el.points;
            }
        }
        const newPeroleh = Math.min(comp.maks, round2(comp.peroleh + bonus));
        const newKonversi = round2(100 * newPeroleh / comp.maks);
        byComponent[comp.id] = {
            before: comp.konversi,
            after: newKonversi,
            deltaPp: round2(newKonversi - comp.konversi)
        };
        konversiList.push(newKonversi);
    }

    const simulatedTotal = konversiList.length
        ? round2(konversiList.reduce((sum, val) => sum + val, 0) / konversiList.length)
        : null;
    const deltaPp = baseTotal !== null && simulatedTotal !== null
        ? round2(simulatedTotal - baseTotal)
        : 0;

    return {
        baseTotal,
        simulatedTotal,
        deltaPp,
        byComponent
    };
}
