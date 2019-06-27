/**
 * 重置到初始化状态
 */

const fsPromises = require('fs-extra');
const chalk = require('chalk');

const log = require('./log');
const configPath = __dirname + '/../data/config.json';
const jobsPath = __dirname + '/../data/';

module.exports = {

    /**
     * 重置到初始化状态
     *
     * @param {Object} program 命令行参数对象
     * @param {boolean} isDirect 是否直连
     */
    async pipe(program, isDirect) {
        if (program.reset || isDirect){
            // 配置重置
            const configContent = JSON.stringify({
                isInited: false
            }, null, 2);

            await fsPromises.writeFile(configPath, configContent, {
                encoding: 'utf-8'
            });
            let text = '配置重置成功';
            console.log(chalk.green(text));
            log.trace(text);

            // 任务关键数据重置
            const jobsContent = JSON.stringify({
                status: 0,
                // 已完成的上传组编号，初始化时定义为 0，方便统一处理
                uploadedGroupIndex: 0,
                jobsTotal: 0,
                currentJobsList: []
            }, null, 2);
            await fsPromises.writeFile(jobsPath + 'jobs-main.json', jobsContent, {
                encoding: 'utf-8'
            });
            text = '上传任务重置成功';
            console.log(chalk.green(text));
            log.trace(text);

            // 移除 data 下的 jobs-00n.json
            const files = await fsPromises.readdir(jobsPath);
            files.forEach(item => {
                if (/^jobs-\d+/.test(item)) {
                    fsPromises.unlink(jobsPath + item);
                }
            });
        }
    }
}
