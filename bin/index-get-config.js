#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const getConfig = require('../lib/get-config');

program
  .version(require('../package').version, '-v, --version')

  // 获取设置
  .option('get-config, --get-config', '获取初始化配置，示例: upload-many-files get-config')

  .parse(process.argv);

// 获取设置
getConfig.pipe(program);
