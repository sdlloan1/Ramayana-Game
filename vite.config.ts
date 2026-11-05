import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Preview-host allowlist.
 *
 * The Base44 preview proxy reaches the dev server as
 * `<port>-<sandbox id>.$BASE44_SANDBOX_HOST_DOMAIN`, and the sandbox id changes
 * whenever the environment is recreated. Vite blocks unknown Host headers, so
 * in preview mode (BASE44_PREVIEW_MODE === "1") we extend the allowlist with the
 * current sandbox wildcard. Outside preview mode nothing is added, preserving
 * the default behaviour.
 */
const allowedHosts: string[] = [];
const sandboxDomain = process.env.BASE44_SANDBOX_HOST_DOMAIN;
if (process.env.BASE44_PREVIEW_MODE === '1' && sandboxDomain) {
  allowedHosts.push(`.${sandboxDomain}`);
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts,
    watch: {
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      interval: 250,
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
});
