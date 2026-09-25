import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startServer } from './serve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'output', 'screenshots');

// 视口尺寸（截图分辨率）
const VIEWPORT = { width: 1280, height: 720 };

// 各阶段等待时间（毫秒）
const TIMING = {
  afterLoad: 3000,    // 开局截图前等待
  keyHold: 10000,     // 按住按键时长（运行中截图前）
  afterKeyRelease: 20000, // 松开按键后到长运行截图的等待
};

// 要模拟按住的按键（覆盖常见游戏控制：方向键 + WASD + 空格）
const SIM_KEYS = ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  const versionDir = process.argv[2];
  const versionName = process.argv[3] || path.basename(versionDir);

  if (!versionDir) {
    console.error('用法: node watch.mjs <版本目录> [版本名]');
    console.error('示例: node watch.mjs versions/v1 v1');
    process.exit(1);
  }

  const rootDir = path.resolve(versionDir);
  const indexPath = path.join(rootDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`错误: 找不到 ${indexPath}`);
    process.exit(1);
  }

  // 启动静态服务器（随机端口）
  const server = await startServer(rootDir, 0);
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  console.log(`[serve] ${rootDir} -> ${url}`);

  // 启动浏览器（使用系统 Chrome，无需下载 Playwright 自带 Chromium）
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // 收集 console 错误和页面错误（手动观察用，不写入文件）
  const consoleIssues = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleIssues.push(`[pageerror] ${err.message}`);
  });

  try {
    // 导航并等待加载
    console.log('[nav] 加载页面...');
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    // 截图 1：开局
    await page.waitForTimeout(TIMING.afterLoad);
    const startPath = path.join(OUTPUT_DIR, `${versionName}_start.png`);
    await page.screenshot({ path: startPath });
    console.log(`[shot] 开局 -> ${path.basename(startPath)}`);

    // 模拟按键：按住一组常见游戏键
    console.log('[keys] 按住按键运行...');
    for (const key of SIM_KEYS) {
      await page.keyboard.down(key).catch(() => {});
    }
    await page.waitForTimeout(TIMING.keyHold);

    // 截图 2：运行中
    const runningPath = path.join(OUTPUT_DIR, `${versionName}_running.png`);
    await page.screenshot({ path: runningPath });
    console.log(`[shot] 运行中 -> ${path.basename(runningPath)}`);

    // 松开按键
    for (const key of SIM_KEYS) {
      await page.keyboard.up(key).catch(() => {});
    }

    // 截图 3：长时间运行
    await page.waitForTimeout(TIMING.afterKeyRelease);
    const longPath = path.join(OUTPUT_DIR, `${versionName}_long.png`);
    await page.screenshot({ path: longPath });
    console.log(`[shot] 长运行 -> ${path.basename(longPath)}`);

    // 输出 console 问题摘要
    if (consoleIssues.length > 0) {
      console.log(`\n[console] 发现 ${consoleIssues.length} 条 error/warning:`);
      consoleIssues.slice(0, 20).forEach((e) => console.log(`  ${e}`));
      if (consoleIssues.length > 20) {
        console.log(`  ... 还有 ${consoleIssues.length - 20} 条已省略`);
      }
    } else {
      console.log('\n[console] 无 error/warning');
    }

    console.log(`\n完成！截图保存在: ${OUTPUT_DIR}`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('致命错误:', err);
  process.exit(1);
});
