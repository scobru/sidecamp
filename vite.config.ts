import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'node-datachannel',
                'webtorrent',
                'music-metadata',
                'andrade-soulseek-downloader',
                'slsk-client',
                'fs-extra',
                'axios',
                'form-data',
                'ws',
                'socket.io-client',
                'electron',
              ],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
      },
      renderer: {}
    })
  ],
})
