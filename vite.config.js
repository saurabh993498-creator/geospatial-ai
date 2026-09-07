import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/geospatial-ai/',
  plugins: [react()],
});
