/**
 * @file 启动上传
 */

const fsPromises = require('fs-extra');
const chalk = require('chalk');

const log = require('./log');
const uploadConfig = require('./upload-config');
const uploadJobs = require('./upload-jobs');
const filesUpload = require('./files-upload');

module.exports = {
    
    data: {
        jobsMain: null
    },

    /**
     * 上传文件
     *
     * @param {Object} program 命令行参数对象
     * @param {boolean} isDirect 是否直连
     */
    async pipe(program, isDirect) {
        if (program.start || isDirect) {
            // 读取配置文件
            let initConfigContent = await fsPromises.readFile(uploadConfig.initConfigPath);
            const initConfig = JSON.parse(initConfigContent);

            // 是否完成了初始化，完成了初始化才可以准备上传任务
            if (initConfig.isInited) {
                this.data.jobsMain = await uploadJobs.init();
                this.startUploadFiles(program);
            }
            else {
                const text = '未完成初始化，请先执行 upload-many-files-init';
                console.log(chalk.red(text));
                log.trace(text);
            }
        }
    },

    /**
     * 开始上传文件
     *
     * @param {Object} program 命令行对象
     */
    async startUploadFiles(program) {
        const uploadParamsObject = {};
        if (program.uploadParams) {
            try {
                const uploadParamsArr = program.uploadParams.split(',');
                
                uploadParamsArr.forEach(item => {
                    const kv = item.split('=');
                    uploadParamsObject[kv[0]] = kv[1];
                });
            }
            catch {
                throw Error('参数解析错误: ', uploadParams)
            }
        }

        filesUpload.startUploadFiles(this.data.jobsMain, uploadParamsObject);
    }
};
