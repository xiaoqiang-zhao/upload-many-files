# upload-many-files

> 多文件上传，适合大规模上传文件，包含动态配置、多层文件夹扫描、中断续传、进度显示、上传统计等特性。设计容量标准为总量 1T 以下，单个文件 1M - 1G 之间。

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
- folder-path，本地文件存储的文件夹，将对文件夹中的全部文件进行扫描，如果你是 Windows 记得加上盘符 D:\testqun。
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

每次上传一个文件，每一个上传任务定义为一个 job，每 1000 个上传任务定义为一个上传组(最后剩余不足 1000 的组成一组)，上传组对应的文件为 jobs-n.json。

上传的流程大体是:

- 1. 根据初始化设置的文件夹路径和后缀名，扫描要上传的文件；
- 2. 每 1000 个文件生成一个上传组文件，记录文件路径和上传情况，内容结构如下:

```json
[
  {
    "path": "/home/user/xxx/t1/1.jpeg",
    "isUploaded": false
  }
  ...
]
```

- 3. 扫描完成后，上传任务还会生成一个主文件，内容结构如下:

```json
{
  "status": 1,
  // 上传已完成的上传组编号，从 0 开始
  "uploadedGroupIndex": 0,
  "jobsTotal": 288,
  "currentJobsList": []
}
```

- 4. 开始上传，内存中最多常驻 10 个异步任务，每成功一个任务从总任务中提取一个加入，直到全部上传完成。
- 5. 在 jobs-n.json 中记录文件上传的成功与失败，方便中断后续传。

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

上传额外参数当前是硬编码，用参数的形式来指定: upload-many-files start --params a=b,c=d

## 编外

还有另一个思路，就是先直接上传，失败的放在另一个地方存储，等全部上传一遍之后再上传之前失败的文件。这种思路和当前实现互有优劣，这种思路的优点有两个:

一、不需要等一个任务组结束后再开始下一个，理论上会快一些；

二、不会因为一个文件多次重试上传失败而影响后面的上传。

那为什么没有采用这种思路呢？

原因有点俗套 -- 得不偿失。针对第一条速度而言，每个任务组有 1000 条任务 10 个异步进程，两个任务组之间的“阻塞衔接” 和 “非阻塞衔接”在速度上只相差千分之几，但代价是需要更复杂的数据结构来区分两个任务组，如果考虑有些任务横跨 3 个以上任务组，那需要考虑的逻辑就更多了，在工程上将问题“扼杀在摇篮中”是比“遗祸后人”更好的一种实现，代码是给人读的只是偶尔让计算机执行一下。对于第二条多次上传失败的情况，在实际操作中多数是网络抖动或者后端不堪重负才失败的，前面大规模失败如果无节制的继续发送请求会引发更大规模的失败，相反将重试和请求控制在一个小范围内是成功率更高的一种方案。
