const fs = require('fs');
const path = require('path');
const Client = require('ssh2').Client;
const conn = new Client();

class sshUploadPlugin {
    constructor(options) {
        this.options = options;
    }

    apply(compiler) {
        compiler.hooks.done.tap('sshUploadPlugin', (stats) => {
            const outputPath = stats.compilation.outputOptions.path;
            this.connect(outputPath);
        });
    }

    // 创建SSH连接
    connect(outputPath){
        const privateKey = {}
        if (this.options.privateKeyPath) {
            privateKey = {
                privateKey: fs.readFileSync(this.options.privateKeyPath)
            }
        }
        // 监听ready事件
        conn.on('ready', () => {
            console.log('SSH连接成功');
            this.listDir(outputPath)
        }).connect({
            timeout: this.options.config.timeout || 10000, // 10s 
            host: this.options.config.host,
            port: this.options.config.port || 22,
            username: this.options.config.username,
            password: this.options.config.password,
            remotePath: this.options.config.remotePath,
            ...privateKey
        });
        // 监听error事件
        conn.on('error', (err) => {
            console.error('SSH连接失败', err);
        });
        // 结束SSH连接
        conn.on('end', () => {
            console.log('SSH连接已断开');
        });
    }

    // 遍历所有文件
    listDir(outputPath) {
        let dir = outputPath || this.options.outputPath
        console.log('正在上传文件...');
        fs.readdirSync(dir).forEach((filename) => {
            const fullPath = path.join(dir, filename);
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
                this.listDir(fullPath);
            } else {
                this.uploadFile(fullPath)
            }
        });
    }
    uploadFile(filePath) {
        return new Promise((resolve, reject) => {
            const remotePath = path.join(this.options.config.remotePath, path.relative(this.options.outputPath, filePath));
            const parent = path.dirname(remotePath);
            conn.sftp((err, sftp) => {
                mapDir(parent)
                function mapDir(parent,fn){
                    sftp.stat(parent,(err, stats) => {
                        if(err) {
                          // 路径不存在
                          const topParent = path.dirname(parent);
                          mapDir(topParent,callback)
                          async function callback(){
                            sftp.mkdir(parent);
                            if(fn){
                                await fn()
                            }
                            const readStream = fs.createReadStream(filePath);
                            readStream.on('error', err => reject(err));
                    
                            const writeStream = sftp.createWriteStream(remotePath);
                            writeStream.on('finish', () => resolve());
                            writeStream.on('error', err => reject(err));
                            readStream.pipe(writeStream);
                          }
                        } else {  
                            // 路径存在
                            if (fn) {
                                fn()
                            }
                            const readStream = fs.createReadStream(filePath);
                            readStream.on('error', err => reject(err));
                    
                            const writeStream = sftp.createWriteStream(remotePath);
                            writeStream.on('finish', () => resolve());
                            writeStream.on('error', err => reject(err));
                            readStream.pipe(writeStream);
                        }
                    });
                }
            })
        })
      }
}

module.exports = sshUploadPlugin;
