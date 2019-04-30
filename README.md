# upload-many-files

> 多文件上传，适合大规模上传文件，包含动态配置、多层文件夹扫描、网络嗅探、断点续传、进度显示、上传统计等特性。设计容量标准为总量 1T 以下，单个文件 1M - 1G 之间。

## 使用相关

安装
```shell
$ npm install -g upload-many-files
```

配置初始化
```shell
upload-many-files init --server-url http://xx.xx.xx --folder-path /home/user/xxx --extname .jpeg,.png
```
- server-url，接收上传的服务。
- folder-path，本地文件存储的文件夹，将对文件夹中的全部文件进行扫描。
- extname，要上传文件的后缀。

开始上传
```shell
upload-many-files start
```
上传的逻辑是先扫面全部需要上传的文件，将每个需要上传的文件生成一条上传任务，写入 data/jobs.json 

查看配置
```shell
upload-many-files get-config
```

查看上传报告
```shell
upload-many-files report
```

将设置回归到安装初始化状态
```shell
upload-many-files reset
```

由于使用了 chalk 和 cli-spinner，在 Windows 的 cmd 下部分日志无法输出，建议使用自带的 PowerShell。

## 辅助源码阅读 与 二次开发相关

采用了管道模型来做控制，将判断逻辑放在了子模块中，便于加工和处理，

```js
// index.js
// 配置初始化
setConfig.pipe(program);
// 开始上传
startUpload.pipe(program);
```

每次上传一个文件，每一个上传任务定义为一个 job，每 1000 个 job 定义为一个 jobsGroup，jobsGroup 对应的文件为 jobs-n.json。

上传的流程大体是:

- 1. 根据初始化设置的文件夹路径和后缀名，扫描要上传的文件；
- 2. 每 1000 个文件生成一个 jobsGroup 文件，记录文件路径和上传情况，内容结构如下:

```json
{
  "isAllUploaded": false,
  "jobs": [
    {
      "path": "/Users/zhaoxiaoqiang/Desktop/test/t1/timg 2 copy 10.jpeg",
      "isUploaded": false
    }
    ...
  ]
}
```

- 3. 扫描完成后，上传任务还会生成一个主文件，内容结构如下:

```json
{
  "status": 1,
  "uploadedJobsTotal": 0,
  "jobsTotal": 288,
  "currentJobsList": []
}
```

- 4. 开始上传，内存中最多常驻 10 个异步任务，每成功一个任务从总任务中提取一个加入，直到全部上传完成。
- 5. 在 jobsGroup 中记录文件上传的成功与失败，方便中断后续传。

在二次开发中，你可能需要按自己的业务逻辑来定义上传成功和失败的逻辑，这个逻辑在 lib/start.js 的 postFile 方法中指定，例如:

```js
async function postFile(index, end) {
    ...
    request.post({
        url: config.serverUrl,
        formData
    }, async (error, res, body) => {
        // 如果有一些自定义的业务定义，可以在这里处理，比如下面就是自定义失败的处理
        let isSuccess = false;
        if (res.statusCode === 200 && body[0] === '{') {
            body = JSON.parse(body);
            isSuccess = body.data && body.data.success;
        }
        if (!error && res.statusCode === 200 && isSuccess) {
            ...
        }
    });
}
```

## 还存在的问题

一批完全结束后才会开始下一批，效率上有提高的空间。一个优化是额外加一个失败重试队列，要包括重试文件的路径和所属上传批次，这样才能上传完成后更新记录的文件。重试次数不限量，如果接口修复后不需手动干预就可以继续上传。

上传额外参数当前是硬编码，用参数的形式来指定: upload-many-files start --params a=b,c=d
