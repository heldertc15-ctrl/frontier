import { createServer } from 'vite';
const server = await createServer({
  server: { port: 5174, strictPort: true, proxy: { '/api': 'http://localhost:3101' } },
});
await server.listen();
server.printUrls();
