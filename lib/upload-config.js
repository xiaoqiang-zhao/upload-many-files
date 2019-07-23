/**
 * @file 上传配置文件
 */

const dataFolderPath = __dirname + '/../data/';

module.exports = {
    dataFolderPath,
    initConfigPath: dataFolderPath + 'config.json',
    jobsMainPath: dataFolderPath + 'jobs-main.json',
    // 一个任务文件的任务容量
    capacity: 1000,
    // 内存中驻留的最大上传进程数
    maxJobs: 10,
    // 定时重试时间: 10分钟
    retryTime: 10 *60 * 1000,

    /**
     * 生成任务组描述文件路径(一种规则的配置，写入和读取共用)
     *
     * @param {number} groupIndex 
     */
    getJobGroupFilePath(groupIndex) {
        const groupIndexStr = String(groupIndex);
        return `${dataFolderPath}jobs-${groupIndexStr.padStart(3, '0')}.json`;
    }
};
