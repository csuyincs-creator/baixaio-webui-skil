import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({
  build: {
    rollupOptions: {
      input: { home: resolve('index.html'), notes: resolve('field-notes.html') }
    }
  },
  server: { host: '127.0.0.1', port: 5173 }
});
