import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev:          npm run dev           -> :5173 with HMR, /api proxied to Spring Boot on :8080
// Build:        npm run build         -> ./dist  (this is what Vercel publishes)
// Build+Spring: npm run build:spring  -> also copies ./dist into Spring's static dir,
//                                        so `./mvnw spring-boot:run` still serves the app at :8080
//
// The output has to live INSIDE this folder for Vercel, which builds with
// frontend/ as its root and cannot publish a directory above it.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      // In dev everything is same-origin, so no CORS and no VITE_API_BASE needed.
      // In production the deployed frontend calls the backend directly, which is
      // what VITE_API_BASE and the backend's CorsConfig are for.
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
})
