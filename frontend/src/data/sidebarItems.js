export const SIDEBAR_ITEMS = [
    {
        type: 'item',
        id: 'akurasi',
        label: 'Dashboard',
        icon: 'chartBar',
        to: '/data'
    },
    {
        type: 'group',
        id: 'bulanan',
        label: 'Bulanan',
        icon: 'calendar',
        children: [
            { id: 'bulanan-pidana',    label: 'Pidana',    icon: 'gavel',     to: '/bulanan/pidana' },
            { id: 'bulanan-perdata',   label: 'Perdata',   icon: 'scale',     to: '/bulanan/perdata' },
            { id: 'bulanan-perikanan', label: 'Perikanan', icon: 'fish',      to: '/bulanan/perikanan' },
            { id: 'bulanan-hukum',     label: 'Hukum',     icon: 'fileCheck', to: '/bulanan/hukum' }
        ]
    },
    {
        type: 'group',
        id: 'mingguan',
        label: 'Mingguan',
        icon: 'clock',
        children: [
            { id: 'mingguan-pidana',    label: 'Pidana',    icon: 'gavel',     to: '/mingguan/pidana' },
            { id: 'mingguan-perdata',   label: 'Perdata',   icon: 'scale',     to: '/mingguan/perdata' },
            { id: 'mingguan-perikanan', label: 'Perikanan', icon: 'fish',      to: '/mingguan/perikanan' },
            { id: 'mingguan-hukum',     label: 'Hukum',     icon: 'fileCheck', to: '/mingguan/hukum' }
        ]
    },
    {
        type: 'group',
        id: 'kasir',
        label: 'Kasir',
        icon: 'wallet',
        children: [
            { id: 'kasir-rekap', label: 'Rekap Excel', icon: 'download', to: '/kasir/rekap' },
            { id: 'kasir-mendadak', label: 'Pemeriksaan Mendadak', icon: 'fileCheck', to: '/kasir/pemeriksaan-mendadak' },
            { id: 'kasir-penutupan', label: 'Penutupan Kas', icon: 'filePlus', to: '/kasir/penutupan-kas' }
        ]
    }
]
