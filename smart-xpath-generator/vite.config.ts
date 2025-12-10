
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY || ''),
      'process.env.CUSTOM_API_KEY': JSON.stringify(env.CUSTOM_API_KEY || ''),
      'process.env.CUSTOM_BASE_URL': JSON.stringify(env.CUSTOM_BASE_URL || '')
    }
  }
})
