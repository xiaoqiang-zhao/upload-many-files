#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const reset = require('../lib/reset');

program
  .version(require('../package').version, '-v, --version')

  // 将设置回归到安装初始化状态
  .option('reset, --reset', '开始上传，示例: upload-many-files reset')

  .parse(process.argv);

// 重置到处是状态
reset.pipe(program);
