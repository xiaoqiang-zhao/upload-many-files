#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const setConfig = require('../lib/set-config');

program
  .version(require('../package').version, '-v, --version')
  // 配置相关参数
  .option('-su, --server-url <>', '上传路径配置，示例: upload-many-files-init --server-url http://xx.xx.xx')
  .option('-fp, --folder-path <>', '本地文件夹路径配置，示例: upload-many-files-init --folder-path /home/user/xxx')
  .option('-s, --extname <>', '上传路径配置，示例: upload-many-files-init --extname .jpeg,.png')

  .parse(process.argv);

// 配置初始化
setConfig.pipe(program, true);
