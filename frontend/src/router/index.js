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
    },
    {
        path: '/test-foundation',
        name: 'test-foundation',
        component: () => import('../views/FoundationTest.vue')
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
