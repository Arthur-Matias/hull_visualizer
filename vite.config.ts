import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'HullVisualizer',
      fileName: (format) => `hull-visualizer.${format}.js`
    },
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE'
        }
      }
    },
    assetsInlineLimit: 0,
    copyPublicDir: false
  },
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  assetsInclude: ['**/*.jpg', '**/*.png', '**/*.jpeg']
})