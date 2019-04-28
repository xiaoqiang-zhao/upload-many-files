/**
 * 启动上传
 */

const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const request = require('request');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;

const log = require('./log');
const configPath = __dirname + '/../data/config.json';
const jobsPath = __dirname + '/../data/jobs.json';

const spinner = new Spinner('%s 正在上传...');

module.exports = {

    /**
     * 上传文件
     *
     * @param {Object} program 命令行参数对象
     */
    async pipe(program) {
        if (program.start) {
            // 读取配置文件
            let configContent = await fsPromises.readFile(configPath);
            const config = JSON.parse(configContent);
            if (config.isInited) {
                await this.initUploadJobs(config);
            }
            else {
                const text = '未完成初始化';
                console.log(chalk.red(text));
                log.trace(text);
            }
        }
    },
    
    /**
     * 初始化上传任务
     *
     * @param {Object} config 配置对象
     */
    async initUploadJobs(config) {
        // 是否有中断的任务
        let jobsContent = await fsPromises.readFile(jobsPath);
        const jobs = JSON.parse(jobsContent);

        // status: 0 未开始，1 上传中，2 已完成
        if (jobs.status === 0) {
            jobs.jobList = [];
            await this.initJobsData(config.folderPath, jobs, config);
            // 写文件
            await this.writeJobsFile(jobs, 1);
        }

        spinner.start();
        this.startUploadFiles(config, jobs);
    },

    /**
     * 初始化任务文件，方便断点续传和任务统计
     */
    async initJobsData(filePath, jobs, config) {
        await fsPromises.readdir(filePath).then(async files => {
            for (let index = 0; index < files.length; index++) {
                let filename = files[index];
                const filedir = path.join(filePath, filename);
                await fsPromises.stat(filedir).then(async stats => {
                    // 文件夹
                    if (stats.isDirectory()) {
                        await this.initJobsData(filedir, jobs, config);
                    }
                    // 文件
                    else {
                        this.pushJobItem(jobs, filedir, config);
                    }
                });
            }
        });
    },

    /**
     * 
     * @param {Object} jobs 
     * @param {string} filedir 
     */
    pushJobItem(jobs, filedir, config) {
        const extnames = config.extname.split(',');
        const extname = path.extname(filedir);

        if (extnames.includes(extname)) {
            jobs.jobList.push({
                path: filedir,
                isUploaded: false
            });
        }
    },

    async writeJobsFile(jobs, status) {
        const beforeStatus = jobs.status;
        jobs.status = status;
        const content = JSON.stringify(jobs, null, 2);
        return fsPromises.writeFile(jobsPath, content, {
            encoding: 'utf-8'
        }).then(() => {
            if (beforeStatus === 0 && status === 1) {
                console.log(chalk.green('上传任务准备成功'));
            }
        }, error => {
            if (beforeStatus === 0 && status === 1) {
                console.log(chalk.red('上传任务准备失败', error));
            }
        });
    },

    /**
     * 开始上传文件
     *
     * @param {Object} config 配置对象
     */
    async startUploadFiles(config, jobs, index = 0) {
        const me = this;
        // 每次上传多少
        const part = 10;
        let end = index + part < jobs.jobList.length ? index + part : jobs.jobList.length;
        // 本批上传总量
        let total = end - index;
        
        while (index < end) {
            if (jobs.jobList[index].isUploaded === false) {
                postFile(index, end);
            }
            else {
                checkEnd(index, end);
            }
            index++;
        }

        async function checkEnd(index, end) {
            total--;
            if (total === 0) {
                await me.writeJobsFile(jobs, 1);
                spinner.setSpinnerTitle(`正在上传: ${jobs.uploadedTotal}/${jobs.jobList.length}`);

                if (end === jobs.jobList.length) {
                    await me.writeJobsFile(jobs, 2);
                    spinner.stop(true);
                    console.log(chalk.green(`全部上传完成: ${jobs.jobList.length}/${jobs.jobList.length}`));
                }
                else {
                    me.startUploadFiles(config, jobs, index);
                }
            }
        }

        function postFile(index, end) {
            const path = jobs.jobList[index].path;
            let formData = {
                file: fs.createReadStream(path),
                // todo 开发可配置多余参数
                source: 'hz', // 来源 
                batch: 'hz-bq-8', // 批次 
                diseasesType: 'fundus' // 疾病类型、fundus眼底/其他数据类型/
            };
            log.trace(`开始上传 path: ${path}`);
            request.post({
                url: config.serverUrl,
                formData
            }, (error, res, body) => {
                if (!error && res.statusCode === 200) {
                    jobs.jobList[index].isUploaded = true;
                    jobs.uploadedTotal++;
                    spinner.setSpinnerTitle(`正在上传: ${jobs.uploadedTotal}/${jobs.jobList.length}`);
                    log.trace(`上传成功 path: ${path}`);
                    checkEnd(index, end);
                }
                else {
                    log.trace(`上传失败 path: ${path}`);
                }
            });
        }
    }
};
