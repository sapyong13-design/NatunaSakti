import { createApp } from 'vue'
import './assets/styles/design-tokens.css'
import './assets/styles/design-bookman.css'
import './assets/styles/design-responsive.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')

// Add ARIA landmarks to body after mount
document.body.setAttribute('role', 'application')
document.body.setAttribute('aria-label', 'Natuna Sakti - Sistem Akurasi Kepaniteraan PN Natuna')

// Announce to screen reader when app is ready
setTimeout(() => {
    const announcement = document.createElement('div')
    announcement.setAttribute('role', 'status')
    announcement.setAttribute('aria-live', 'polite')
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = 'Aplikasi Natuna Sakti siap digunakan'
    document.body.appendChild(announcement)

    setTimeout(() => announcement.remove(), 1000)
}, 100)
