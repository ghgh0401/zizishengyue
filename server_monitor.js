const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 设置项目路径
const PROJECT_DIR = process.cwd();
const LOG_DIR = path.join(PROJECT_DIR, 'logs');
const SERVER_LOG = path.join(LOG_DIR, 'server.log');
const MONITOR_LOG = path.join(LOG_DIR, 'monitor.log');

let serverProcess = null;
let browserOpened = false;

// 创建日志目录
function ensureLogDirectory() {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR);
        log('监控日志目录已创建: ' + LOG_DIR);
    }
}

// 日志函数
function log(message) {
    const timestamp = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    try {
        fs.appendFileSync(MONITOR_LOG, logMessage + '\n');
    } catch (err) {
        console.error('无法写入日志文件:', err.message);
    }
}

// 检查Node.js环境
function checkNodeEnvironment() {
    return new Promise((resolve, reject) => {
        exec('node -v', (error, stdout) => {
            if (error) {
                reject(new Error('未找到Node.js环境，请先安装Node.js'));
            } else {
                const version = stdout.trim();
                log('Node.js环境已检测: ' + version);
                resolve();
            }
        });
    });
}

// 检查server.js文件
function checkServerFile() {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(path.join(PROJECT_DIR, 'server.js'))) {
            reject(new Error('未找到server.js文件，请确认项目文件是否完整'));
        } else {
            log('项目核心文件server.js已找到');
            resolve();
        }
    });
}

// 启动服务器
function startServer() {
    if (serverProcess) {
        try {
            process.kill(serverProcess.pid);
            log('已终止之前的服务器进程');
        } catch (err) {
            log('终止服务器进程失败: ' + err.message);
        }
    }
    
    log('正在启动服务器...');
    
    // 创建服务器日志文件
    try {
        fs.writeFileSync(SERVER_LOG, '');
    } catch (err) {
        log('创建服务器日志文件失败: ' + err.message);
    }
    
    // 创建服务器日志文件
    try {
        fs.writeFileSync(SERVER_LOG, '');
        log('服务器日志文件已创建');
    } catch (err) {
        log('创建服务器日志文件失败: ' + err.message);
    }
    
    // 启动服务器进程（设置为真正的后台进程）
    serverProcess = spawn('node', ['server.js'], {
        cwd: PROJECT_DIR,
        detached: true,
        stdio: ['ignore', 'ignore', 'ignore'], // 完全分离标准输入输出
        windowsHide: true
    });
    
    // 让服务器进程在父进程退出后继续运行
    serverProcess.unref();
    
    // 由于stdio已设置为ignore，无法直接捕获输出流
    log('服务器已启动（后台运行模式）');
    
    // 监听服务器进程退出事件
    serverProcess.on('exit', (code, signal) => {
        log(`服务器进程已退出 (代码: ${code}, 信号: ${signal})`);
        serverProcess = null;
        // 延迟重启，避免频繁重启
        setTimeout(() => {
            log('准备重新启动服务器...');
            startServer();
        }, 1000);
    });
    
    serverProcess.on('error', (err) => {
        log('启动服务器失败: ' + err.message);
        serverProcess = null;
    });
    
    // 第一次启动时打开浏览器
    if (!browserOpened) {
        browserOpened = true;
        setTimeout(() => {
            log('正在打开浏览器，访问歌曲库页面...');
            try {
                // 在Windows上使用start命令打开浏览器
                exec('start http://localhost:3004/song-library.html');
            } catch (err) {
                log('打开浏览器失败: ' + err.message);
            }
        }, 3000);
    }
}

// 处理退出信号
function setupExitHandlers() {
    process.on('SIGINT', () => {
        log('接收到终止信号，正在停止监控...');
        if (serverProcess) {
            try {
                process.kill(serverProcess.pid);
                log('已停止服务器进程');
            } catch (err) {
                log('停止服务器进程失败: ' + err.message);
            }
        }
        log('监控系统已停止');
        process.exit(0);
    });
}

// 主函数
async function main() {
    try {
        console.log('===================================================================');
        console.log('仔仔艺考助手 - 服务器监控系统');
        console.log('项目目录: ' + PROJECT_DIR);
        console.log('服务器日志: ' + SERVER_LOG);
        console.log('监控日志: ' + MONITOR_LOG);
        console.log('启动时间: ' + new Date().toLocaleString());
        console.log('注意: 按Ctrl+C可以停止监控');
        console.log('===================================================================');
        console.log('');
        
        ensureLogDirectory();
        setupExitHandlers();
        
        await checkNodeEnvironment();
        await checkServerFile();
        
        // 启动服务器
        startServer();
        
        log('服务器监控已启动');
        
        // 保持进程运行
        setInterval(() => {}, 1000);
        
    } catch (error) {
        console.error('错误:', error.message);
        log('启动失败: ' + error.message);
        process.exit(1);
    }
}

// 启动监控
main();