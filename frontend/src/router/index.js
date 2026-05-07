import { createRouter, createWebHistory } from 'vue-router'

const routes = [
    {
        path: '/',
        name: 'Home',
        redirect: '/data'
    },
    {
        path: '/bulanan',
        name: 'Bulanan',
        component: () => import('../views/BulananView.vue')
    },
    {
        path: '/mingguan',
        name: 'Mingguan',
        component: () => import('../views/MingguanView.vue')
    },
    {
        path: '/input',
        name: 'Input',
        component: () => import('../views/InputView.vue')
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
