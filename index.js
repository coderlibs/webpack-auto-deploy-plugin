const fs = require('fs');
const path = require('path');
const Client = require('ssh2').Client;
const archiver = require('archiver');
const conn = new Client();

class sshUploadPlugin {
    constructor(options) {
        this.options = options;
        this.fileName;
        this.remotePath;
        this.outputFirPath;
    }

    apply(compiler) {
        compiler.hooks.done.tap('sshUploadPlugin', async (stats) => {
            const outputPath = stats.compilation.outputOptions.path || this.options.outputPath;
            this.fileName = path.basename(outputPath);
            await this.buildZip(outputPath);
            this.connect(outputPath);
        });
    }

    // 项目打成tar包
    buildZip = async (outputPath) => {
        await new Promise((resolve, reject) => {
            console.log(`打包 ${outputPath} Tar.gz`)
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: {
                    level: 1
                }
            }).on('error', (e) => {
                console.error(e)
            })

            const output = fs
                .createWriteStream(`${outputPath}.tar.gz`)
                .on('close', (e) => {
                    if (e) {
                        console.error(`打包tar.gz出错: ${e}`)
                        reject(e)
                        process.exit(1)
                    } else {
                        console.log(`${outputPath}.tar.gz打包成功`)
                        resolve()
                    }
                })
            archive.pipe(output)
            archive.directory(outputPath, `${this.fileName}`)
            archive.finalize()
        })
    }

    // 创建SSH连接
    connect(outputPath) {
        const privateKeyPath = this.options.config.privateKeyPath;

        // 监听ready事件
        conn.on('ready', () => {
            console.log('SSH连接成功');
            this.remoteFirPath = `${this.options.config.remotePath}/${this.fileName}.tar.gz`;
            this.outputFirPath = `${outputPath}.tar.gz`;
            conn.sftp((err, sftp) => {
                if (err) throw err;

                const readStream = fs.createReadStream(this.outputFirPath);
                readStream.on('error', err => {
                    console.log('error');
                });
                const writeStream = sftp.createWriteStream(this.remoteFirPath);
                writeStream.on('close', () => {
                    console.log(this.remoteFirPath, '文件上传完成');
                    // 判断是否要先删除远程文件夹，默认清除远程文件夹
                    if (this.options.clearRemoteDir !== false) {
                        this.clearRemoteDir()
                    } else {
                        this.tarRemoteFile();
                    }
                });
                writeStream.on('error', err => {
                    console.log('error');
                });
                readStream.pipe(writeStream);
            });
        }).connect({
            timeout: this.options.config.timeout || 10000, // 10s 
            host: this.options.config.host,
            port: this.options.config.port || 22,
            username: this.options.config.username,
            password: this.options.config.password,
            remotePath: this.options.config.remotePath,
            privateKey: privateKeyPath?fs.readFileSync(privateKeyPath):null
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

    // 清理远程目录
    clearRemoteDir() {
        const command = `rm -rf ${this.options.config.remotePath}/${this.fileName}`;
        conn.exec(command, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log(`Remote command exited with code ${code}.`);
                this.tarRemoteFile()
            }).on('data', (data) => {
                console.log(`STDOUT: ${data}`);
            }).stderr.on('data', (data) => {
                console.log(`STDERR: ${data}`);
            });
        });
    }

    // 解压缩项目
    tarRemoteFile() {
        const command = `tar -xzf ${this.remoteFirPath} -C ${this.options.config.remotePath} && rm -rf ${this.remoteFirPath}`;
        conn.exec(command, (err, stream) => {
            if (err) throw err;
            stream.on('close', (code, signal) => {
                console.log(`Remote command exited with code ${code}.`);
                this.removeLocalFile()
            }).on('data', (data) => {
                console.log(`STDOUT: ${data}`);
            }).stderr.on('data', (data) => {
                console.log(`STDERR: ${data}`);
            });
        });
    }
    // 删除本地打包文件
    removeLocalFile = () => {
        const localPath = `${this.outputFirPath}`
        console.log('删除本地压缩包...');
        // 删除本地文件
        fs.unlink(localPath, (err) => {
            if (err) throw err;
            console.log(`Local file ${localPath} deleted.`);
            conn.end();
        });
    }
}

module.exports = sshUploadPlugin;
