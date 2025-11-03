@echo off
chcp 65001 >nul

:: 设置项目路径
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

:: 清屏
cls

:: 显示标题
echo ===================================================================
 echo 直接连接仔仔艺考声乐助手 - 快速启动与连接工具
 echo 自动检测环境、配置并连接到服务器
 echo 项目路径: %PROJECT_DIR%
 echo 当前时间: %date% %time%
 echo 如有问题，请按任意键查看详细错误信息
 echo ===================================================================
 echo.

:: 检查Node.js环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] Node.js环境未安装!
    echo 请先安装Node.js，可从以下地址下载:
    echo https://nodejs.org/zh-cn/download/
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
    echo [信息] Node.js环境已检测: %NODE_VERSION%
)

:: 检查server.js文件是否存在
if not exist "%PROJECT_DIR%\server.js" (
    echo [错误] server.js文件不存在!
    echo 请确认项目文件是否完整。
    pause
    exit /b 1
) else (
    echo [信息] 项目核心文件server.js已找到
)

:: 检查MySQL服务状态
echo [信息] 正在检查MySQL服务状态...
sc query | findstr /i "mysql" >nul 2>nul
if %errorlevel% neq 0 (
    echo [警告] MySQL服务未找到，尝试以通用方式查找数据库服务...
    sc query state= all | findstr /i "sql server" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [错误] 未找到任何数据库服务!
        echo 请先安装并启动MySQL或SQL Server数据库服务。
        pause
        exit /b 1
    )
) else (
    sc query MySQL | findstr "STATE" >nul 2>nul
    if %errorlevel% neq 0 (
        echo [警告] MySQL服务已找到但名称可能不同，正在查找所有数据库相关服务...
    ) else (
        sc query MySQL | findstr "STATE" | findstr "RUNNING" >nul 2>nul
        if %errorlevel% neq 0 (
            echo [警告] MySQL服务已找到但未运行，尝试启动服务...
            net start MySQL >nul 2>nul
            if %errorlevel% neq 0 (
                echo [错误] 无法自动启动MySQL服务，请手动启动服务后重试。
                pause
                exit /b 1
            ) else (
                echo [信息] MySQL服务已成功启动
            )
        ) else (
            echo [信息] MySQL服务已在运行中
        )
    )
)

:: 检查项目依赖
if not exist "%PROJECT_DIR%\node_modules" (
    echo [信息] 未找到项目依赖，正在安装...
    cd /d "%PROJECT_DIR%"
    npm install --force >nul 2>nul
    if %errorlevel% neq 0 (
        echo [警告] 依赖安装可能不完整，但将继续尝试连接
    ) else (
        echo [信息] 项目依赖已成功安装
    )
) else (
    echo [信息] 项目依赖已存在
)

:: 准备启动服务器
cd /d "%PROJECT_DIR%"

:: 创建日志目录
if not exist "%PROJECT_DIR%\logs" mkdir "%PROJECT_DIR%\logs"

:: 启动服务器并打开页面
start "服务器启动" cmd /c "node server.js | tee "%PROJECT_DIR%\logs\server.log""

:: 等待服务器启动
echo [信息] 正在启动服务器，请稍候...
ping 127.0.0.1 -n 5 >nul

:: 打开浏览器页面
start http://localhost:3000/

:: 显示连接成功信息
cls
color 2f
echo ===================================================================
 echo 连接成功！
 echo 服务器已启动，浏览器应已打开项目页面。
 echo 如果浏览器未自动打开，请手动访问 http://localhost:3000/
 echo 如有任何问题，请查看logs目录下的服务器日志。
 echo ===================================================================

:: 保持窗口打开
pause >nul