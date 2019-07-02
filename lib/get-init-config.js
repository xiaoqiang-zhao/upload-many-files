/**
 * 获取设置
 */

const fsPromises = require('fs-extra');
const chalk = require('chalk');

const log = require('./log');
const uploadConfig = require('./upload-config');

module.exports = {

    /**
     * 获取设置
     *
     * @param {Object} program 命令行参数对象
     * @param {boolean} isDirect 是否直连
     */
    async pipe(program, isDirect) {
        if (program.getInitConfig || isDirect){
            let configContent = await fsPromises.readFile(uploadConfig.dataConfigPath);
            console.log(chalk.green(configContent));
            log.trace('获取配置');
        }
    }
}
