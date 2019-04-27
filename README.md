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

暂停上传
```shell
upload-many-files stop
```

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

## 源码阅读 与 二次开发相关

采用了管道模型来做控制，将判断逻辑放在了子模块中，便于加工和处理，

```js
// index.js
// 配置初始化
setConfig.pipe(program);
// 开始上传
startUpload.pipe(program);
```
