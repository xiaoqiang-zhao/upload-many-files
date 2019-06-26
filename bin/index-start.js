#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const startUpload = require('../lib/start');

program
  .version(require('../package').version, '-v, --version')

  .parse(process.argv);

// 开始上传
startUpload.pipe(program, true);
