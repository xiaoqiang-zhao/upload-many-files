/**
 * 日志模块
 */

const log4js = require('log4js');

log4js.configure({
    appenders: {
        'app-trace': {
            // 直接写文件，适合日质量比较大的情况，日志文件超过某个数值就拆分新文件
            type: 'file',
            maxLogSize: 200000, // 200k
            backups: 500, // 最多留几个
            filename: __dirname + '/../logs/log'
            // 当前存储在 app-trace-log 文件中，
            // 当文件大小超出限制时将原来的文件数字依次递增，如果文件总数超过设置那么移除文件号最大的文件 
            // 然后 app-trace-log 命名为 app-trace-log.1
            // 最后建文件 app-trace-log 继续记录
        },
        'app-request': {
            // 直接写文件，适合日质量比较大的情况，日志文件超过某个数值就拆分新文件
            type: 'file',
            maxLogSize: 200000, // 200k
            backups: 500, // 最多留几个
            filename: __dirname + '/../logs/request-log'
        }
    },
    categories: {
        default: {
            appenders: ['app-trace'],
            level: 'trace'
        },
        request: {
            appenders: ['app-request'],
            level: 'trace'
        }
    }
});

const loggerTrace = log4js.getLogger();

module.exports = {
    trace(str) {
        loggerTrace.trace(str);
    },
    request(str) {
        loggerTrace.request(str);
    }
};
