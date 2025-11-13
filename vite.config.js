import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  define: {
    // Expose OPENWEATHER_API_KEY to client-side code
    'import.meta.env.OPENWEATHER_API_KEY': JSON.stringify(process.env.OPENWEATHER_API_KEY)
  }
})
