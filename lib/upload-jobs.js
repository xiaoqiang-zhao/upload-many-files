/**
 * @file 初始化上传任务: 扫描文件夹获取需要上传的文件，写入 jobs-n.json 文件
 */

const fsPromises = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;

const log = require('./log');
const uploadConfig = require('./upload-config');

const jobsMainPath = uploadConfig.jobsMainPath;
const spinner = new Spinner('%s 任务准备中...');

module.exports = {

    data: {
        initConfig: null,
        jobsMain: null,
        extnames: []
    },

    /**
     * 初始化上传任务
     *
     */
    async init() {
        // 读取主任务文件，判断当前状态
        const jobsMainContent = await fsPromises.readFile(jobsMainPath);
        this.data.jobsMain = JSON.parse(jobsMainContent);
        const initConfigContent = await fsPromises.readFile(uploadConfig.initConfigPath);
        this.data.initConfig = JSON.parse(initConfigContent);

        // 任务未准备好，读取需要上传的文件写入任务文件(status: 0 未开始，1 上传中，2 已完成)
        if (this.data.jobsMain.status === 0) {
            this.initExtnames();
            spinner.setSpinnerTitle('扫描到需要上传文件总数: 0');
            spinner.start();
            await this.getWillBeUploadFiles(this.data.initConfig.folderPath, true);
            spinner.stop(true);
        }

        return this.data.jobsMain;
    },

    /**
     * 初始化上传文件扩展名数组
     */
    initExtnames() {
        const extnames = this.data.initConfig.extname.split(',');
        extnames.forEach(element => {
            element = element.trim();
            element = (element.charAt(0) === '.' ? '' : '.') + element;
            this.data.extnames.push(element.toLowerCase());
        });
    },

    /**
     * 初始化任务文件，方便断点续传和任务统计
     *
     * @param {string} folderPath 文件夹路径
     * @param {boolean} isTopFolder 是否是需要扫描的顶层文件夹
     */
    async getWillBeUploadFiles(folderPath, isTopFolder) {
        const files = await fsPromises.readdir(folderPath);

        for (let index = 0; index < files.length; index++) {
            let filename = files[index];
            const filedir = path.join(folderPath, filename);
            const stats = await fsPromises.stat(filedir);
            // 文件夹
            if (stats.isDirectory()) {
                await this.getWillBeUploadFiles(filedir, false);
            }
            // 文件
            else {
                await this.pushJobItem(filedir);
            }
        }
        if (isTopFolder) {
            if (this.data.jobsMain.jobsTotal % uploadConfig.capacity > 0) {
                const groupNum =  Number.parseInt(this.data.jobsMain.jobsTotal / uploadConfig.capacity) + 1;
                await this.writeJobsFile(groupNum);
            }
            // 写主任务文件
            this.data.jobsMain.currentJobsList = [];
            this.data.jobsMain.status = 1;
            const content = JSON.stringify(this.data.jobsMain, null, 2);
            await fsPromises.writeFile(uploadConfig.jobsMainPath, content, {
                encoding: 'utf-8'
            }).then(() => {
                console.log(chalk.green('\n ------ 扫描完成 ------ \n'));
            }, error => {
                const text = '上传任务准备失败';
                console.log(chalk.red(text, error));
                log.trace(text);
            });
        }
    },


    /**
     * 子任务写入文件
     *
     * @param {number} groupIndex 任务组序号，从 1 开始
     */
    async writeJobsFile(groupIndex) {
        const content = JSON.stringify(this.data.jobsMain.currentJobsList, null, 2);
        try {
            groupIndex = String(groupIndex);
            const jobFilePath = uploadConfig.getJobGroupFilePath(groupIndex);
            await fsPromises.writeFile(jobFilePath, content, {
                encoding: 'utf-8'
            }).then(() => {
                this.data.jobsMain.currentJobsList = [];
            }, error => {
                console.log(chalk.red('上传任务准备失败', error));
            });
        }
        catch(error) {
            console.log(chalk.red('上传任务准备失败', error));
        }
    },

    /**
     * 压入一个任务到任务队列
     *
     * @param {string} filedir 文件路径
     */
    async pushJobItem(filedir) {
        const extnames = this.data.extnames;
        const extname = path.extname(filedir).toLowerCase();
        this.data.jobsMain.filesTotal++;

        // 临时方案 - 带下划线的是缩略图
        if (extnames.includes(extname) && filedir.indexOf('_.') === -1) {
            this.data.jobsMain.currentJobsList.push({
                index: this.data.jobsMain.jobsTotal++,
                path: filedir,
                isUploaded: false
            });

            if (this.data.jobsMain.jobsTotal % uploadConfig.capacity === 0) {
                // 写子任务文件
                const groupNum =  Number.parseInt(this.data.jobsMain.jobsTotal / uploadConfig.capacity);
                await this.writeJobsFile(groupNum);
            }
        }

        spinner.setSpinnerTitle(
            '扫描到需要上传文件总数: ' + chalk.green(this.data.jobsMain.jobsTotal)
            + ', 扫描文件总数: ' + chalk.green(this.data.jobsMain.filesTotal)
        );
    }
};
