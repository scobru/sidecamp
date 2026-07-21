import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'audio-engine': path.resolve(__dirname, '../../packages/audio-engine/src/index.ts'),
      'graph-ui': path.resolve(__dirname, '../../packages/graph-ui/src/index.ts')
    }
  },
  optimizeDeps: {
    exclude: ['audio-engine', 'graph-ui'],
  },
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
                'andrade-soulseek-downloader/dist/index.js',
                'slsk-client',
                'fs-extra',
                'axios',
                'form-data',
                'ws',
                'socket.io-client',
                'electron',
                'node-id3',
                '@ffmpeg-installer/ffmpeg',
              ],
            },
            rolldownOptions: {
              external: [
                'node-datachannel',
                'webtorrent',
                'music-metadata',
                'andrade-soulseek-downloader',
                'andrade-soulseek-downloader/dist/index.js',
                'slsk-client',
                'fs-extra',
                'axios',
                'form-data',
                'ws',
                'socket.io-client',
                'electron',
                'node-id3',
                '@ffmpeg-installer/ffmpeg',
              ],
            },
          },
        },
      },
      preload: {
        input: 'electron/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: {
                format: 'cjs',
                entryFileNames: '[name].cjs',
              },
            },
          },
        },
      },
      renderer: {}
    })
  ],
})
