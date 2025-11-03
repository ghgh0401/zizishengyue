@echo off
chcp 65001 >nul

SET "PROJECT_DIR=%~dp0"
SET "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

SET "LOG_DIR=%PROJECT_DIR%\logs"
IF NOT EXIST "%LOG_DIR%" MKDIR "%LOG_DIR%"

SET "SERVER_LOG=%LOG_DIR%\server.log"
SET "MONITOR_LOG=%LOG_DIR%\monitor.log"

ECHO ===================================================================
ECHO 仔仔艺考助手 - 服务器监控系统
ECHO 项目目录: %PROJECT_DIR%
ECHO 服务器日志: %SERVER_LOG%
ECHO 监控日志: %MONITOR_LOG%
ECHO 启动时间: %DATE% %TIME%
ECHO 注意: 关闭此窗口将停止服务器监控
===================================================================
ECHO.

:: 检查Node.js
WHERE node >nul 2>nul
IF %ERRORLEVEL% NEQ 0 (
    ECHO [错误] 未找到Node.js环境
    ECHO 请安装Node.js后再试
    PAUSE
    EXIT /B 1
)

:: 检查server.js文件
IF NOT EXIST "%PROJECT_DIR%\server.js" (
    ECHO [错误] 未找到server.js文件
    PAUSE
    EXIT /B 1
)

:: 切换到项目目录
CD /D "%PROJECT_DIR%"

:: 记录启动信息
ECHO. >> "%MONITOR_LOG%"
ECHO [启动时间] %DATE% %TIME% >> "%MONITOR_LOG%"
ECHO =================================================================== >> "%MONITOR_LOG%"

:: 启动监控循环
:MONITOR
    ECHO [信息] 正在启动服务器...
    ECHO [信息] 服务器启动于 %TIME% >> "%MONITOR_LOG%"
    
    :: 启动服务器并捕获进程ID
    START "服务器" /MIN CMD /C "node server.js > "%SERVER_LOG%" 2>&1"
    
    :: 等待服务器启动
    TIMEOUT /T 3 /NOBREAK >nul
    
    :: 检查是否是第一次启动，如果是则打开浏览器
    IF NOT DEFINED FIRST_RUN (
        SET FIRST_RUN=true
        ECHO [信息] 正在打开浏览器...
        START http://localhost:3004/song-library.html
    )
    
    :: 监控服务器进程
    :CHECK
        TASKLIST | FINDSTR /I "node.exe" >nul 2>nul
        IF %ERRORLEVEL% NEQ 0 (
            ECHO [错误] 服务器已停止，准备重启...
            ECHO [错误] 服务器停止于 %TIME%，准备重启... >> "%MONITOR_LOG%"
            GOTO MONITOR
        )
        
        :: 每秒检查一次
        TIMEOUT /T 1 /NOBREAK >nul
        GOTO CHECK

:EXIT
ECHO [信息] 监控系统已停止
ECHO [停止时间] %DATE% %TIME% >> "%MONITOR_LOG%"
PAUSE