/**
 * @file 上传文件
 */

const fsPromises = require('fs-extra');
const requestPromise = require('request-promise');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;

const log = require('./log');
const uploadConfig = require('./upload-config');

const spinner = new Spinner('%s 任务准备中...');
// 排查发出请求没有返回的诡异bug-1
let temp = '\nstart:\n';

module.exports = {
    
    data: {
        initConfig: null,
        jobsMain: null,
        // 任务池
        jobsPool: [],
        // 上传时参数设置
        uploadParamsObject: null,
        // 上传总批数
        totalUploadGroup: 0,
        // 当前有几个上传任务在进行中
        currentUploadingJobsCount: 0,
        // 最后一个上传文件在当前上传组中的顺序号，从 0 开始
        lastUploadingIndex: 0,
        // 已上传文件数
        uploadedJobsTotal: 0
    },

     /**
     * 开始上传文件
     *
     * @param {Object} jobsMain 主任务对象
     * @param {Object} uploadParamsObject 上传参数
     */
    async startUploadFiles(jobsMain, uploadParamsObject) {
        console.log(chalk.green('\n -------------------- 开始上传 -------------------- \n'));
        spinner.start();

        const initConfigContent = await fsPromises.readFile(uploadConfig.initConfigPath);
        this.data.initConfig = JSON.parse(initConfigContent);
        this.data.jobsMain = jobsMain;
        this.data.uploadParamsObject = uploadParamsObject;

        let totalUploadGroup = Number.parseInt(this.data.jobsMain.jobsTotal / uploadConfig.capacity);
        totalUploadGroup += jobsMain.jobsTotal % uploadConfig.capacity === 0 ? 0 : 1;
        this.data.totalUploadGroup = totalUploadGroup;

        this.updateJobsUpload();
    },

    /**
     * 更新上传任务
     */
    async updateJobsUpload() {
        const jobsMain = this.data.jobsMain;
        if (jobsMain.uploadedGroupIndex >= this.data.totalUploadGroup) {
            this.finishedUploading();
            return;
        }
        // 放入新一批数据
        if (this.data.currentUploadingJobsCount === 0) {
            this.data.uploadedJobsTotal = jobsMain.uploadedGroupIndex * uploadConfig.capacity;
            this.data.lastUploadingIndex = 0;

            jobsMain.currentJobsPath = uploadConfig.getJobGroupFilePath(jobsMain.uploadedGroupIndex + 1);
            
            const jobsContent = await fsPromises.readFile(jobsMain.currentJobsPath);
            const jobs = JSON.parse(jobsContent);
            jobsMain.currentJobsList = jobs;
            this.jobsPool = new Array(jobs.length);
        }

        while (
            this.data.currentUploadingJobsCount < uploadConfig.maxJobs
            && this.data.lastUploadingIndex < jobsMain.currentJobsList.length
        ) {
            const job = jobsMain.currentJobsList[this.data.lastUploadingIndex];
            if (!job.isUploaded) {
                this.data.currentUploadingJobsCount++;
                this.postFile(this.data.lastUploadingIndex++, 0);
            }
            else {
                this.data.uploadedJobsTotal++;
                if (this.data.uploadedJobsTotal % uploadConfig.capacity === 0) {
                    this.data.jobsMain.uploadedGroupIndex++;
                    await this.updateJobsUpload();
                }
                else {
                    this.data.lastUploadingIndex++;

                    // 已经全部上传完后再执行上传会用到这段逻辑
                    if (this.data.uploadedJobsTotal === jobsMain.jobsTotal && this.data.currentUploadingJobsCount === 0) {
                        jobsMain.uploadedGroupIndex++;
                        this.updateJobsUpload();
                    }
                }
                spinner.setSpinnerTitle(`正在上传: ${this.data.uploadedJobsTotal}/${this.data.jobsMain.jobsTotal}`);
            }
        }
    },

    /**
     * 发送上传文件
     *
     * @param {number} index 上传的任务序号
     * @param {number} retryNumberOfTimes 重试次数，第一次上传重试次数值为 0
     */
    async postFile(index, retryNumberOfTimes) {
        const path = this.data.jobsMain.currentJobsList[index].path;
        log.trace(`开始上传 path: ${path}`);

        let formData = {
            file: fsPromises.createReadStream(path),
            ...this.data.uploadParamsObject
        };
        // 排查发出请求没有返回的诡异bug-2
        temp += path + '\n';

        this.insertJobToPoll(index);
        requestPromise.post({
            url: this.data.initConfig.serverUrl,
            formData
        }).then(async body => {
            // 排查发出请求没有返回的诡异bug-3
            log.trace(`then path: ${path}`);
            // 上传成功逻辑判断
            let isSuccess = false;
            if (body[0] === '{') {
                body = JSON.parse(body);
                isSuccess = body.data && body.data.success;
            }
            if (isSuccess) {
                this.postFileSuccess(index, retryNumberOfTimes);
            }
            else {
                this.postFileFail(index, retryNumberOfTimes);
            }
        }).catch(error => {
            // 排查发出请求没有返回的诡异bug-4
            log.trace(`catch path: ${path}`);
            this.postFileFail(index, retryNumberOfTimes);
        }).finally(() => {
            // 排查发出请求没有返回的诡异bug-5
            log.trace(`finally path: ${path}`);
        });
    },

    /**
     * 将任务计入任务池，方便做定时超时重试
     *
     * @param {number} index 任务序号，和 jobsMain 中的序号一致
     */
    insertJobToPoll(index) {
        if (this.jobsPool[index]) {
            clearTimeout(this.jobsPool[index].timmerId);
        }

        this.jobsPool[index] = {
            itemData: this.data.jobsMain.currentJobsList[index],
            // 定时重试
            timmerId: setTimeout(() => {
                const text = '超时重试: ' + this.data.jobsMain.currentJobsList[index].path;
                console.log(text);
                this.insertJobToPoll(index);
                this.postFile(index, 1000);
            }, uploadConfig.retyrTime)
        };
    },

    /**
     * 上传成功
     *
     * @param {number} index 上传的任务序号
     * @param {number} retryNumberOfTimes 重试次数，第一次上传重试次数值为 0
     */
    async postFileSuccess(index, retryNumberOfTimes) {
        clearTimeout(this.jobsPool[index].timmerId);

        const jobsMain = this.data.jobsMain;
        const path = this.data.jobsMain.currentJobsList[index].path;
        
        // 排查发出请求没有返回的诡异bug-6
        temp = temp.replace(new RegExp(path.replace('(', '\(').replace(')', '\)') + '\\n', 'gm'), '');
        if ((this.data.uploadedJobsTotal + uploadConfig.maxJobs) % uploadConfig.capacity < uploadConfig.maxJobs) {
            console.log(temp);
        }

        if (jobsMain.currentJobsList[index].isUploaded === false) {
            jobsMain.currentJobsList[index].isUploaded = true;
            this.data.uploadedJobsTotal++;
        }
        log.trace(`上传成功 path: ${path}`);
        // 重试上传成功
        if (retryNumberOfTimes > 0) {
            spinner.stop(true);
            console.log(chalk.green(` 重试成功 path: ${path}`));
            spinner.start();
        }

        await this.saveUploadingProcess();
        this.data.currentUploadingJobsCount--;
        if (this.data.uploadedJobsTotal % uploadConfig.capacity === 0) {
            jobsMain.uploadedGroupIndex++;
            const date = new Date();
            spinner.stop(true);
            console.log(`uploadedJobsTotal: ${this.data.uploadedJobsTotal}, date: ${date}`);
            spinner.start();
        }
        
        spinner.setSpinnerTitle(`正在上传: ${this.data.uploadedJobsTotal}/${jobsMain.jobsTotal}`);
        if (this.data.uploadedJobsTotal < jobsMain.jobsTotal) {
            await this.updateJobsUpload();
        }
        else {
            this.finishedUploading();
        }
    },

    /**
     * 上传失败
     *
     * @param {number} index 上传的任务序号
     * @param {number} retryNumberOfTimes 重试次数，第一次上传重试次数值为 0
     */
    async postFileFail(index, retryNumberOfTimes) {
        const path = this.data.jobsMain.currentJobsList[index].path;

        const text = ` 上传失败 path: ${path}`;
        log.trace(text);
        spinner.stop(true);
        console.log(chalk.red(`${text}，已发起第【${retryNumberOfTimes + 1}】次重试`));
        spinner.start();
        // 重试上传
        this.postFile(index, retryNumberOfTimes + 1);
    },

    /**
     * 保存上传进度，方便终端后续传
     */
    async saveUploadingProcess() {
        if (
            this.data.uploadedJobsTotal % 100 === 0
            || this.data.uploadedJobsTotal === this.data.jobsMain.jobsTotal
        ) {
            // 保存文件
            try {
                let content = JSON.stringify({
                    status: this.data.jobsMain.status,
                    uploadedGroupIndex: this.data.jobsMain.uploadedGroupIndex,
                    jobsTotal: this.data.jobsMain.jobsTotal,
                    filesTotal: this.data.jobsMain.filesTotal,
                    currentJobsList: []
                }, null, 2);
                // 主任务文件
                await fsPromises.writeFile(uploadConfig.jobsMainPath, content, {
                    encoding: 'utf-8'
                });
                // 子任务文件
                content = JSON.stringify(this.data.jobsMain.currentJobsList, null, 2);
                await fsPromises.writeFile(this.data.jobsMain.currentJobsPath, content, {
                    encoding: 'utf-8'
                });
            }
            catch(error) {
                console.log('>>>>>>>>>> 进度文件保存失败 <<<<<<<<<<')
            }
        }
    },

    /**
     * 完成上传，结束 spinner 并在控制台输出提示
     */
    finishedUploading() {
        spinner.stop(true);
        console.log(chalk.green(`\n -------------------- 上传完成  -------------------- `));
        console.log(` \n >>>>> 已全部上传完成, 共计: ${this.data.jobsMain.jobsTotal} <<<<<<`);
        const date = new Date();
        console.log(` \n >>>>> date: ${date} <<<<<< \n`);
    }
};
