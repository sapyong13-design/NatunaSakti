<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeMenu = ref('/bulanan')

const handleSelect = (key) => {
    activeMenu.value = key
    router.push(key)
}
</script>

<template>
    <el-container class="app-container">
        <el-header class="app-header">
            <div class="header-content">
                <h1 class="app-title">Akurasi Kepaniteraan</h1>
                <span class="app-subtitle">Pengadilan Negeri Natuna Kelas IB</span>
            </div>
        </el-header>

        <el-container>
            <el-aside width="200px" class="app-sidebar">
                <el-menu
                    :default-active="activeMenu"
                    class="el-menu-vertical"
                    @select="handleSelect"
                >
                    <el-menu-item index="/bulanan">
                        <el-icon><Calendar /></el-icon>
                        <span>Laporan Bulanan</span>
                    </el-menu-item>
                    <el-menu-item index="/mingguan">
                        <el-icon><Timer /></el-icon>
                        <span>Laporan Mingguan</span>
                    </el-menu-item>
                    <el-menu-item index="/input">
                        <el-icon><Edit /></el-icon>
                        <span>Input Perkara</span>
                    </el-menu-item>
                    <el-menu-item index="/data">
                        <el-icon><Document /></el-icon>
                        <span>Data Perkara</span>
                    </el-menu-item>
                </el-menu>
            </el-aside>

            <el-main class="app-main">
                <router-view />
            </el-main>
        </el-container>
    </el-container>
</template>

<script>
import { Calendar, Timer, Edit, Document } from '@element-plus/icons-vue'

export default {
    components: {
        Calendar, Timer, Edit, Document
    }
}
</script>

<style scoped>
.app-container {
    height: 100vh;
}

.app-header {
    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
}

.header-content {
    text-align: center;
}

.app-title {
    font-size: 24px;
    font-weight: bold;
    margin: 0;
}

.app-subtitle {
    font-size: 14px;
    opacity: 0.9;
}

.app-sidebar {
    background: #f5f7fa;
    border-right: 1px solid #e4e7ed;
}

.app-main {
    background: #f0f2f5;
    padding: 20px;
}

.el-menu-vertical {
    border-right: none;
}
</style>
