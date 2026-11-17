import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'pdf-vendor': ['pdfjs-dist'],
        },
      },
    },
  },
  server: {
    watch: {
      ignored: [
        "**/.app2-guard/**",
        "**/*-backup-*/**",
        "**/*-before-*/**",
        "**/data-recovery-backups/**",
        "**/diagnostics/**",
        "**/dist/**",
        "**/uploads/**",
        "**/*.log",
      ],
    },
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  },
})
