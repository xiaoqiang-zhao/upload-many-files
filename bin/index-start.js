#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const startUpload = require('../lib/start');

program
  .version(require('../package').version, '-v, --version')

  // start 开始上传指令
  .option('start, --start', '开始上传，示例: upload-many-files start')

  .parse(process.argv);

// 开始上传
startUpload.pipe(program);
