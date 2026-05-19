<script setup>
defineProps({
    name: { type: String, required: true },
    size: { type: Number, default: 16 }
})

const ICONS = {
    search:       { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>' },
    refresh:      { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/>' },
    sync:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>' },
    trash:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>' },
    chevronDown:  { vb: '0 0 24 24', sw: 1.8, body: '<path d="m6 9 6 6 6-6"/>' },
    chevronRight: { vb: '0 0 24 24', sw: 1.8, body: '<path d="m9 6 6 6-6 6"/>' },
    close:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>' },
    bell:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>' },
    folder:       { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>' },
    filePlus:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15h6"/>' },
    fileCheck:    { vb: '0 0 24 24', sw: 1.8, body: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m9 15 2 2 4-4"/>' },
    calendar:     { vb: '0 0 24 24', sw: 1.8, body: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>' },
    clock:        { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' },
    wallet:       { vb: '0 0 24 24', sw: 1.8, body: '<path d="M19 7H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 14h.01"/><path d="M3 9V6a2 2 0 0 1 2-2h11"/>' },
    scale:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>' },
    gavel:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="m14.5 12.5-8 8a2.12 2.12 0 0 1-3-3l8-8"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>' },
    fish:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="m16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98"/>' },
    chartBar:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 3v18h18"/><path d="M7 16V11"/><path d="M12 16V8"/><path d="M17 16v-3"/>' },
    settings:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>' },
    menu:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>' },
    table:        { vb: '0 0 24 24', sw: 1.8, body: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M9 10v10"/><path d="M15 10v10"/>' },
    layoutGrid:   { vb: '0 0 24 24', sw: 1.8, body: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>' },
    sun:          { vb: '0 0 24 24', sw: 1.8, body: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.93 19.07 1.41-1.41"/><path d="m17.66 6.34 1.41-1.41"/>' },
    moon:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>' },
    trendUp:      { vb: '0 0 24 24', sw: 2,   body: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>' },
    trendDown:    { vb: '0 0 24 24', sw: 2,   body: '<path d="M22 17 13.5 8.5 8.5 13.5 2 7"/><path d="M16 17h6v-6"/>' },
    check:        { vb: '0 0 24 24', sw: 2.5, body: '<path d="M20 6 9 17l-5-5"/>' },
    user:         { vb: '0 0 24 24', sw: 1.8, body: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
    dot:          { vb: '0 0 8 8',   sw: 0,   body: '<circle cx="4" cy="4" r="3" fill="currentColor"/>' },
    arrowRight:   { vb: '0 0 24 24', sw: 2,   body: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>' },
    activity:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>' },
    crown:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/><path d="M6 12v4"/><path d="M10 12v4"/><path d="M14 12v4"/><path d="M18 12v4"/>' },
    moreHorizontal:{ vb: '0 0 24 24', sw: 2,   body: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>' },
    filter:       { vb: '0 0 24 24', sw: 1.8, body: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>' },
    download:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>' },
    location:     { vb: '0 0 24 24', sw: 1.8, body: '<path d="M20 10c0 5.52-4.48 10-10 10S0 15.52 0 10 4.48 0 10 0s10 4.48 10 10z"/><circle cx="10" cy="10" r="3"/>' },
    alert:        { vb: '0 0 24 24', sw: 1.8, body: '<path d="M12 2v4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m8 8 2 2 4-4"/>' }
}
</script>

<template>
    <svg
        v-if="ICONS[name]"
        :width="size"
        :height="size"
        :viewBox="ICONS[name].vb"
        fill="none"
        stroke="currentColor"
        :stroke-width="ICONS[name].sw"
        stroke-linecap="round"
        stroke-linejoin="round"
        v-html="ICONS[name].body"
    />
</template>
