export const SIDEBAR_ITEMS = [
    {
        type: 'item',
        id: 'akurasi',
        label: 'Akurasi Kepaniteraan',
        icon: 'chartBar',
        to: '/data'
    },
    {
        type: 'group',
        id: 'bulanan',
        label: 'Bulanan',
        icon: 'calendar',
        children: [
            { id: 'bulanan-pidana',    label: 'Pidana',    icon: 'gavel', to: '/bulanan/pidana' },
            { id: 'bulanan-perdata',   label: 'Perdata',   icon: 'scale', to: '/bulanan/perdata' },
            { id: 'bulanan-perikanan', label: 'Perikanan', icon: 'fish',  to: '/bulanan/perikanan' }
        ]
    },
    {
        type: 'item',
        id: 'mingguan',
        label: 'Mingguan',
        icon: 'clock',
        to: '/mingguan'
    }
]
