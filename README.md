# webpack-auto-deploy-plugin
基于webpack开发的打包自动部署插件

### 1.安装
安装 webpack-auto-deploy-plugin

```js
npm install webpack-auto-deploy-plugin
```

### 2.配置
```js
// webpack.config.js
const sshUploadPlugin = require('webpack-auto-deploy-plugin')
const privateKeyPath = 'C:/Users/administrator/.ssh/id_rsa'
module.exports = function (env, argv) {
    return {
        entry: './src/main.js',
        output: {
            path: path.resolve(__dirname, './app'),
            filename: 'assets/js/[name]-[contenthash:8].js',
            chunkFilename: 'assets/js/[name]-[contenthash:8].chunk.js',
        },
        plugins: [
            new sshUploadPlugin(
                {
                    config: {
                        timeout: 30000, // 非必传，连接延迟时间，内置默认10秒
                        host: '255.255.255.0', // ssh服务器地址
                        port: 22, // ssh服务器端口
                        username: 'root', // ssh用户名
                        password: '123456', // 服务器登录密码，密码和密钥二选一
                        remotePath: '/www/wwwroot/web' // 要上传的服务器文件目录
                        privateKeyPath  // 服务器登录密钥，密码和密钥二选一,更推荐使用密钥的形式，更安全
                    },
                    outputPath: path.resolve(__dirname, './app'), // 非必填 dist目录路径，默认会取output.path
                    clearRemoteDir: false  // 非必填 默认在部署的时候先删除远程文件夹，false为不删除，将会进行文件替换
                }
            )
        ],
    };
}
