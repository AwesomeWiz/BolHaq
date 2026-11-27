import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, isPreview }) => {
  const cert = process.env.BOLHAQ_DEV_TLS_CERT
  const key = process.env.BOLHAQ_DEV_TLS_KEY
  return {
    plugins: [react(), tailwindcss()],
    server: command === 'serve' && !isPreview && cert && key
      ? { https: { cert: readFileSync(cert), key: readFileSync(key) } }
      : undefined,
  }
})
