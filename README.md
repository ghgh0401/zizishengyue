# 仔仔艺考助手项目部署指南

## 项目概述

仔仔艺考助手是一个为艺术考生提供歌曲库、策略指导等功能的Web应用程序。本指南将帮助您将项目部署到AWS服务器环境。

## 项目结构

### 核心文件（必须保留）
- **server.js** - 项目核心服务器代码
- **package.json** 和 **package-lock.json** - 项目依赖配置文件
- **admin.html**, **index.html**, **login.html**, **song-detail.html**, **song-library.html**, **strategy.html**, **user-center.html** - 主要前端页面文件
- **HTML/**, **images/**, **sheet-music/** - 前端资源文件夹，包含图片、音频等资源
- **performance-middleware.js**, **performance-optimization.js** - 性能优化相关代码
- **开机自启和数据库连接指南.txt** - 使用指南文档
- **aws_db_config.js** - AWS数据库连接配置文件

### 保留的工具文件
- **direct_connect.bat** - 连接服务器的主要工具
- **fix_bat_file_opening.bat** - 修复批处理文件打不开的问题
- **服务器监控与自动重启.bat** - 服务器监控和自动重启功能
- **server_monitor.js** - 服务器监控系统

## AWS服务器部署步骤

1. **准备AWS环境**
   - 创建一个EC2实例（推荐使用Amazon Linux 2或Ubuntu）
   - 配置安全组，开放80、443（如果使用HTTPS）和3001端口
   - 连接到您的EC2实例

2. **安装必要的软件**
   ```bash
   # 更新系统包
   sudo yum update -y  # 对于Amazon Linux
   # 或
   sudo apt update && sudo apt upgrade -y  # 对于Ubuntu
   
   # 安装Node.js
   # Amazon Linux 2
   curl -sL https://rpm.nodesource.com/setup_20.x | sudo bash -
   sudo yum install -y nodejs
   
   # 或Ubuntu
   curl -sL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # 安装Git（如果需要）
   sudo yum install git -y  # Amazon Linux
   # 或
   sudo apt install git -y  # Ubuntu
   ```

3. **上传项目文件**
   - 使用SCP或SFTP将项目文件上传到EC2实例
   ```bash
   scp -r /本地路径/艺考助手 ec2-user@<EC2实例IP>:/home/ec2-user/
   ```

4. **安装依赖并启动服务器**
   ```bash
   # 进入项目目录
   cd /home/ec2-user/艺考助手
   
   # 安装依赖
   npm install
   
   # 启动服务器（使用nohup确保后台运行）
   nohup node server.js > server.log 2>&1 &
   ```

5. **配置服务器监控**（可选）
   - 如果需要使用服务器监控功能，可以运行：
   ```bash
   nohup node server_monitor.js > monitor.log 2>&1 &
   ```

## 连接AWS免费数据库

AWS提供了12个月的免费RDS数据库服务，包含750小时的db.t2.micro、db.t3.micro或db.t4g.micro实例使用时间，20GB通用型(SSD)存储和20GB备份存储。

### 1. 创建AWS RDS数据库实例

1. 登录AWS管理控制台，打开RDS服务页面：https://console.aws.amazon.com/rds/
2. 点击"创建数据库"按钮
3. 选择"标准创建"，然后选择数据库引擎为"MySQL"
4. 在"模板"部分选择"免费套餐"
5. 配置数据库实例标识符、主用户名和密码
6. 保持默认的DB实例类（db.t2.micro或类似）
7. 存储类型选择"通用型SSD (gp2)"，存储大小设为20GB（免费额度）
8. 在"连接"部分，选择与您的EC2实例相同的VPC
9. 在"VPC安全组"中，选择"创建新的VPC安全组"
10. 其他选项保持默认，点击"创建数据库"

### 2. 配置安全组

1. 数据库创建完成后，找到并点击您的RDS实例
2. 在"连接与安全"标签页中，找到"VPC安全组"并点击链接
3. 在EC2安全组页面，点击"编辑入站规则"
4. 添加一条规则：
   - 类型：MySQL/Aurora
   - 协议：TCP
   - 端口范围：3306
   - 源：选择您的EC2实例的安全组，或指定允许访问的IP范围
5. 点击"保存规则"

### 3. 修改项目数据库配置

1. 在项目中找到并编辑`aws_db_config.js`文件
2. 更新以下配置项：
   ```javascript
   const awsRdsConfig = {
     database: 'music_library_db',  // 数据库名称
     username: 'your_rds_username', // 您在RDS创建时设置的用户名
     password: 'your_rds_password', // 您在RDS创建时设置的密码
     host: 'your-rds-endpoint',     // RDS实例的终端节点
     port: 3306                     // 保持默认
   };
   ```
3. 打开`server.js`文件，找到MySQL数据库配置部分
4. 替换现有的数据库配置为AWS RDS配置：
   ```javascript
   // 引入AWS数据库配置
   const { getAwsRdsSequelizeConfig } = require('./aws_db_config');
   
   // 创建Sequelize实例，连接AWS RDS数据库
   const sequelize = new Sequelize(getAwsRdsSequelizeConfig());
   ```

### 4. 重启服务器应用新配置

```bash
# 查找并终止现有的Node.js进程
ps aux | grep node
kill <进程ID>

# 重启服务器应用新配置
nohup node server.js > server.log 2>&1 &
```

## 注意事项

- AWS服务器上不需要Windows特定的启动脚本和快捷方式创建脚本
- 部署前请确保数据库连接配置正确（如果项目需要数据库）
- 建议使用PM2或其他进程管理器来管理Node.js进程，以确保服务稳定运行
- 生产环境中建议配置反向代理（如Nginx）来处理HTTP请求并启用HTTPS
- AWS RDS免费套餐仅适用于新AWS账户的前12个月，超过免费额度后将产生费用
- 定期检查AWS管理控制台中的账单和使用情况，避免意外费用

## 日志文件

服务器运行时会自动创建日志文件：
- `server.log` - 服务器运行日志
- `monitor.log` - 监控系统日志

## 常见问题排查

### 数据库连接问题
- 检查RDS实例的安全组是否允许您的EC2实例或IP地址访问
- 确认RDS实例的终端节点、用户名和密码是否正确
- 验证RDS实例是否处于可用状态（不在维护期）
- 检查VPC网络配置，确保路由表和网络ACL允许流量

### 服务器问题
- 如果服务器无法启动，请检查Node.js版本兼容性
- 确保安全组配置正确，允许访问所需端口
- 检查依赖是否正确安装
- 查看日志文件以获取详细错误信息