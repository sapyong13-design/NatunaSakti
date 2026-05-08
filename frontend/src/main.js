import { createApp } from 'vue'
import './assets/styles/design-tokens.css'
import './assets/styles/design-bookman.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
