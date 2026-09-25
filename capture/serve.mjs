import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

/**
 * 启动一个静态文件服务器
 * @param {string} rootDir - 要 serve 的根目录
 * @param {number} port - 端口，0 表示随机分配
 * @returns {Promise<http.Server>}
 */
export function startServer(rootDir, port = 0) {
  return new Promise((resolve, reject) => {
    const resolvedRoot = path.resolve(rootDir);
    const server = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(resolvedRoot, urlPath);

      // 防止路径遍历
      if (!filePath.startsWith(resolvedRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

// 独立运行：node serve.mjs <dir> [port]
if (process.argv[1] && process.argv[1].endsWith('serve.mjs')) {
  const dir = process.argv[2] || '.';
  const port = parseInt(process.argv[3]) || 8080;
  startServer(dir, port).then((server) => {
    console.log(`Serving ${path.resolve(dir)} at http://127.0.0.1:${server.address().port}`);
  });
}
