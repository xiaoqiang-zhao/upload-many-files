/**
 * 获取设置
 */

const fsPromises = require('fs-extra');
const chalk = require('chalk');

const log = require('./log');
const configPath = __dirname + '/../data/config.json';

module.exports = {

    /**
     * 获取设置
     *
     * @param {Object} program 命令行参数对象
     */
    async pipe(program) {
        if (program.getConfig){
            let configContent = await fsPromises.readFile(configPath);
            // const config = JSON.parse(configContent);
            // text = '上传任务重置成功';
            console.log(chalk.green(configContent));
            log.trace('获取配置');
        }
    }
}
