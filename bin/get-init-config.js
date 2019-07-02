#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const getConfig = require('../lib/get-init-config');

program
  .version(require('../package').version, '-v, --version')

  .parse(process.argv);

// 获取设置
getConfig.pipe(program, true);
