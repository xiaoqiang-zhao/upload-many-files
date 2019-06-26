#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const reset = require('../lib/reset');

program
  .version(require('../package').version, '-v, --version')

  .parse(process.argv);

// 重置到处是状态
reset.pipe(program, true);
