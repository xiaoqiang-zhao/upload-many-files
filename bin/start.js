#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const startUpload = require('../lib/start');

program
  .version(require('../package').version, '-v, --version')
  .option('upload-params, --upload-params <>', '上传额外参数，示例: upload-many-files-start --upload-params a=b,c=d')

  .parse(process.argv);

// 开始上传
startUpload.pipe(program, true);
