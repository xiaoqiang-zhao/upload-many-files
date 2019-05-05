/**
 * 启动上传
 */

const fsPromises = require('fs-extra');
const path = require('path');
const request = require('request');
const chalk = require('chalk');
const Spinner = require('cli-spinner').Spinner;

const log = require('./log');

const dataFolderPath = __dirname + '/../data/';
const configPath = dataFolderPath + 'config.json';
const jobsMainPath = dataFolderPath + 'jobs-main.json';

// 一个任务文件的任务容量
const capacity = 1000;
const spinner = new Spinner('%s 任务准备中...');

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
        let jobsMainContent = await fsPromises.readFile(jobsMainPath);
        const jobsMain = JSON.parse(jobsMainContent);

        // 准备任务
        // status: 0 未开始，1 上传中，2 已完成
        if (jobsMain.status === 0) {
            spinner.setSpinnerTitle('扫描到需要上传文件总数: 0');
            spinner.start();
            await this.initJobs(config.folderPath, jobsMain, config, true);
        }

        // 开始上传
        spinner.start();
        this.startUploadFiles(config, jobsMain);
    },

    /**
     * 初始化任务文件，方便断点续传和任务统计
     *
     * @param {string} folderPath 文件夹路径
     * @param {Object} jobsMain 任务主对象
     * @param {Object} config 配置对象
     * @param {boolean} isTopFolder 是否是需要扫描的顶层文件夹
     */
    async initJobs(folderPath, jobsMain, config, isTopFolder) {
        const files = await fsPromises.readdir(folderPath);

        for (let index = 0; index < files.length; index++) {
            let filename = files[index];
            const filedir = path.join(folderPath, filename);
            const stats = await fsPromises.stat(filedir);
            // 文件夹
            if (stats.isDirectory()) {
                await this.initJobs(filedir, jobsMain, config);
            }
            // 文件
            else {
                await this.pushJobItem(filedir, jobsMain, config);
            }
        }
        if (isTopFolder) {
            if (jobsMain.jobsTotal % capacity > 0) {
                const groupNum =  Number.parseInt(jobsMain.jobsTotal / capacity) + 1;
                await this.writeJobsFile(jobsMain, groupNum);
            }
            // 写主任务文件
            jobsMain.currentJobsList = [];
            jobsMain.status = 1;
            const content = JSON.stringify(jobsMain, null, 2);
            await fsPromises.writeFile(jobsMainPath, content, {
                encoding: 'utf-8'
            }).then(() => {
                spinner.stop(true);
                console.log(`共扫描到 ${chalk.green(jobsMain.jobsTotal)} 个文件需要上传`);
            }, error => {
                const text = '上传任务准备失败';
                console.log(chalk.red(text, error));
                log.trace(text);
            });
        }
    },

    /**
     * 压入一个任务到任务队列
     *
     * @param {string} filedir 文件路径
     * @param {Object} jobsMain 任务主对象
     * @param {Object} config 配置对象
     */
    async pushJobItem(filedir, jobsMain, config) {
        const extnames = config.extname.split(',');
        const extname = path.extname(filedir);

        // 临时方案 - 带下划线的是缩略图
        if (extnames.includes(extname) && filedir.indexOf('_') === -1) {
            jobsMain.currentJobsList.push({
                path: filedir,
                isUploaded: false
            });
            jobsMain.jobsTotal++;
            if (jobsMain.jobsTotal % capacity === 0) {
                // 写子任务文件
                const groupNum =  Number.parseInt(jobsMain.jobsTotal / capacity);
                await this.writeJobsFile(jobsMain, groupNum);
            }
            
            spinner.setSpinnerTitle('扫描到需要上传文件总数: ' + chalk.green(jobsMain.jobsTotal));
        }
    },

    /**
     * 子任务写入文件
     *
     * @param {Object} jobsMain 任务主对象
     * @param {number} groupIndex 任务组序号，从 1 开始
     */
    async writeJobsFile(jobsMain, groupIndex) {
        const content = JSON.stringify(jobsMain.currentJobsList, null, 2);
        await fsPromises.writeFile(`${dataFolderPath}jobs-${groupIndex}.json`, content, {
            encoding: 'utf-8'
        }).then(() => {
            jobsMain.currentJobsList = [];
        }, error => {
            console.log(chalk.red('上传任务准备失败', error));
        });
    },

    /**
     * 开始上传文件
     *
     * @param {Object} config 配置对象
     * @param {Object} jobsMain 任务对象
     */
    async startUploadFiles(config, jobsMain) {
        // 内存中驻留的最大上传进程数
        const maxJobs = 10;
        // 当前有几个上传任务在进行中
        let currentUploadingJobsCount = 0;
        // 最后一个上传文件在当前上传组中的顺序号，从 0 开始
        let lastUploadingIndex = 0;
        // 已上传文件数
        let uploadedJobsTotal;
        // const R = [];
        // setInterval(() => {
        //     if (currentUploadingJobsCount < 3 && R.length < 3) {
        //         setTimeout(() => {
        //             if (currentUploadingJobsCount < 3 && R.length < 3) {

        //                 const str = JSON.stringify(
        //                     R,
        //                     null,
        //                     2
        //                 );
        //                 console.log(chalk.red('>>>>> 补丁 <<<<<<'));

        //                 R.forEach(item => {
        //                     postFile(item.index);
        //                 });

        //                 console.log(str);
        //                 console.log(chalk.red('>>>>> 补丁 <<<<<<'));
        //             }
        //         }, 30000);
        //     }
        // }, 50000);
        
        updateJobsUpload();

        /**
         * 
         */
        async function updateJobsUpload() {
            // 放入新一批数据
            if (currentUploadingJobsCount === 0) {
                uploadedJobsTotal = jobsMain.uploadedGroupIndex * capacity;
                lastUploadingIndex = 0;
                jobsMain.currentJobsPath = `${dataFolderPath}jobs-${jobsMain.uploadedGroupIndex + 1}.json`;
                const jobsContent = await fsPromises.readFile(jobsMain.currentJobsPath);
                const jobs = JSON.parse(jobsContent);
                jobsMain.currentJobsList = jobs;
            }

            while (currentUploadingJobsCount < maxJobs && lastUploadingIndex < jobsMain.currentJobsList.length) {
                const job = jobsMain.currentJobsList[lastUploadingIndex];
                if (!job.isUploaded) {
                    currentUploadingJobsCount++;
                    postFile(lastUploadingIndex);
                }
                else {
                    uploadedJobsTotal++;
                }
                lastUploadingIndex++;
            }
        }

        /**
         * 
         * @param {number} index 上传的任务序号
         */
        async function postFile(index) {
            const path = jobsMain.currentJobsList[index].path;

            // R.push({
            //     index,
            //     path,
            //     currentUploadingJobsCount
            // });
            let formData = {
                file: fsPromises.createReadStream(path),
                // todo 开发可配置多余参数
                source: 'hz', // 来源 
                batch: 'hz-bq-8-2', // 批次 hz-bq-8 / test
                diseasesType: 'fundus' // 疾病类型、fundus眼底/其他数据类型/
            };
            log.trace(`开始上传 path: ${path}`);
            request.post({
                url: config.serverUrl,
                formData
            }, async (error, res, body) => {
                // 如果有一些自定义的业务定义，可以在这里处理，比如下面就是自定义失败的处理
                // let isSuccess = false;
                // if (res.statusCode === 200 && body[0] === '{') {
                //     body = JSON.parse(body);
                //     isSuccess = body.data && body.data.success;
                // }
                // if (!error && res.statusCode === 200 && isSuccess) {

                if (!error && res.statusCode === 200) {
                    jobsMain.currentJobsList[index].isUploaded = true;
                    uploadedJobsTotal++;

                    log.trace(`上传成功 path: ${path}`);
                    log.trace('body:', body);
                    if (uploadedJobsTotal % 100 === 0) {
                        // 保存文件
                        let content = JSON.stringify({
                            status: jobsMain.status,
                            uploadedGroupIndex: jobsMain.uploadedGroupIndex,
                            jobsTotal: jobsMain.jobsTotal,
                            currentJobsList: []
                        }, null, 2);
                        // 主任务文件
                        await fsPromises.writeFile(jobsMainPath, content, {
                            encoding: 'utf-8'
                        });
                        // 子任务文件
                        content = JSON.stringify(jobsMain.currentJobsList, null, 2);
                        await fsPromises.writeFile(jobsMain.currentJobsPath, content, {
                            encoding: 'utf-8'
                        });
                    }
                    currentUploadingJobsCount--;
                    if (uploadedJobsTotal % capacity === 0) {
                        jobsMain.uploadedGroupIndex++;
                        console.log('\n uploadedJobsTotal: ', uploadedJobsTotal);
                        console.log('\n jobsMain.uploadedGroupIndex: ', jobsMain.uploadedGroupIndex);
                    }
                    // R.some((item, index) => {
                    //     if (item.path === path) {
                    //         R.splice(index, 1);
                    //         return true;
                    //     }
                    // });
                    
                    spinner.setSpinnerTitle(`正在上传: ${uploadedJobsTotal}/${jobsMain.jobsTotal}`);
                    if (uploadedJobsTotal < jobsMain.jobsTotal) {
                        updateJobsUpload();
                    }
                    else {
                        console.log('----');
                        spinner.stop(true);
                        console.log(chalk.green(`全部上传完成，共上传 ${jobsMain.jobsTotal} 个文件`));
                    }
                    // if (currentUploadingJobsCount < 3) {
                    //     console.log('\n success:', 'currentUploadingJobsCount:', currentUploadingJobsCount, 'path:', path);
                    // }
                }
                else {
                    const text = `上传失败 path: ${path}`;
                    // console.log('\n', chalk.red(text), '已发起重试');
                    log.trace(text, 'error:', error, 'body:', body);
                    // 重试上传
                    postFile(index);
                }
            });
        }
    }
};
