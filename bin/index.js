#!/usr/bin/env node

/**
 * 入口文件
 */

const program = require('commander');

const setConfig = require('../lib/set-config');
const startUpload = require('../lib/start');
const reset = require('../lib/reset');
const getConfig = require('../lib/get-config');

program
  .version(require('../package').version, '-v, --version')
  // 配置相关参数
  .option('init, --init', '批量配置初始化参数，示例: upload-many-files init --server-url http://xx.xx.xx --folder-path /home/user/xxx --extname jpeg,png')
  .option('-su, --server-url <>', '上传路径配置，示例: upload-many-files --server-url http://xx.xx.xx')
  .option('-fp, --folder-path <>', '本地文件夹路径配置，示例: upload-many-files --folder-path /home/user/xxx')
  .option('-s, --extname <>', '上传路径配置，示例: upload-many-files --extname jpeg,png')

  // start 开始上传指令
  .option('start, --start', '开始上传，示例: upload-many-files start')

  // 将设置回归到安装初始化状态
  .option('reset, --reset', '开始上传，示例: upload-many-files reset')

  // 获取设置
  .option('get-config, --get-config', '获取初始化配置，示例: upload-many-files get-config')

  .parse(process.argv);

// 配置初始化
setConfig.pipe(program);
// 开始上传
startUpload.pipe(program);
// 重置到处是状态
reset.pipe(program);
// 获取设置
getConfig.pipe(program);
