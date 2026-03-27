#!/usr/bin/env node
/**
 * 最小化端到端测试 - 验证 per-agent model 配置
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = '/Users/zhaiyang/.openclaw/workspace/skills/openagents-novel';

const testInput = `# 测试输入

## 前文
这是测试章节的前文内容。

## 目标
写一段简短的测试剧情。

## 要求
请写一段 200 字左右的测试剧情。
`;

console.log('🚀 启动端到端测试...\n');

const child = spawn('npx', ['tsx', 'src/cli/index.ts', 'run', 'novel_chapter_writing_v2', '--input', testInput], {
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
  env: { ...process.env, OPENAGENTS_LANG: 'zh' }
});

child.on('close', (code) => {
  console.log(`\n进程退出，code: ${code}`);
  process.exit(code);
});
