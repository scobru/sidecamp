import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'

const isMobile = process.env.BUILD_TARGET === 'mobile';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    ...(!isMobile ? [
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
      })
    ] : [])
  ],
})
