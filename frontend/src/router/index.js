import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        redirect: '/data'
    },
    {
        path: '/bulanan',
        redirect: '/bulanan/pidana'
    },
    {
        path: '/bulanan/:jenis',
        name: 'Bulanan',
        component: () => import('../views/BulananView.vue')
    },
    {
        path: '/mingguan',
        redirect: '/mingguan/pidana'
    },
    {
        path: '/mingguan/:jenis',
        name: 'Mingguan',
        component: () => import('../views/MingguanView.vue')
    },
    {
        path: '/data',
        name: 'Data',
        component: () => import('../views/DataView.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
