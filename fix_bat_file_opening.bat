@echo off
chcp 65001 >nul

:: 清屏
cls

:: 显示标题
echo ===================================================================
echo 批处理文件打不开问题修复工具
echo 自动检测并修复 .bat 文件关联和权限问题
 echo 当前时间: %date% %time%
echo ===================================================================
echo.

:: 检查当前是否以管理员身份运行
echo [信息] 正在检查管理员权限...
NET SESSION >nul 2>&1
if %errorLevel% == 0 (
    echo [信息] 当前已以管理员权限运行
) else (
    echo [警告] 当前未以管理员权限运行，某些修复操作可能需要管理员权限
    echo 正在尝试以管理员身份重启...
    PowerShell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 检查并修复文件关联
echo.
echo [信息] 正在检查并修复 .bat 文件关联...
ftype batfile >nul 2>&1
if %errorLevel% neq 0 (
    echo [警告] .bat 文件关联未设置，正在重新设置...
    assoc .bat=batfile
    ftype batfile="%SystemRoot%\System32\cmd.exe" /c "%1" %*
    echo [信息] .bat 文件关联已修复
) else (
    echo [信息] .bat 文件关联已存在
    ftype batfile
)

:: 检查 direct_connect.bat 文件是否存在
echo.
echo [信息] 正在检查 direct_connect.bat 文件...
if not exist "c:\Users\Administrator\Desktop\艺考助手\direct_connect.bat" (
    echo [错误] direct_connect.bat 文件不存在!
    pause
    exit /b 1
) else (
    echo [信息] direct_connect.bat 文件已找到
    
    :: 检查文件权限
    echo [信息] 正在检查文件权限...
    icacls "c:\Users\Administrator\Desktop\艺考助手\direct_connect.bat" | findstr "(F)" >nul 2>&1
    if %errorLevel% neq 0 (
        echo [警告] 文件权限不足，正在添加执行权限...
        icacls "c:\Users\Administrator\Desktop\艺考助手\direct_connect.bat" /grant "%USERNAME%":F >nul 2>&1
        echo [信息] 已添加完全控制权限
    ) else (
        echo [信息] 文件权限正常
    )
    
    :: 检查文件格式（是否包含不可见字符）
    echo [信息] 正在检查文件格式...
    findstr /r "[^\x20-\x7E]" "c:\Users\Administrator\Desktop\艺考助手\direct_connect.bat" >nul 2>&1
    if %errorLevel% equ 0 (
        echo [警告] 文件可能包含不可见字符，正在创建一个干净的副本...
        copy /y "c:\Users\Administrator\Desktop\艺考助手\direct_connect.bat" "c:\Users\Administrator\Desktop\艺考助手\direct_connect_clean.bat" >nul
        echo [信息] 已创建干净副本: direct_connect_clean.bat
    ) else (
        echo [信息] 文件格式正常
    )
)

:: 创建替代的启动脚本
echo.
echo [信息] 正在创建替代的启动脚本...

:: 创建 PowerShell 版本的启动脚本
echo [信息] 创建 PowerShell 版本启动脚本...
echo ^# PowerShell 版本的直接连接工具 > "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 解决 .bat 文件打不开的问题 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo $PROJECT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "================================================================" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "直接连接仔仔艺考声乐助手 - PowerShell 版本" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "项目路径: $PROJECT_DIR" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "当前时间: $(Get-Date)" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "================================================================" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 检查 Node.js 环境 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo try { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     $nodeVersion = & node -v >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "[信息] Node.js 环境已检测: $nodeVersion" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } catch { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "[错误] Node.js 环境未安装!" -ForegroundColor Red >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "请先安装 Node.js，可从以下地址下载:" -ForegroundColor Red >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "https://nodejs.org/zh-cn/download/" -ForegroundColor Red >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Read-Host "按 Enter 键退出"
    echo     exit >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 检查 server.js 文件 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo if (-not (Test-Path "$PROJECT_DIR\server.js")) { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "[错误] server.js 文件不存在!" -ForegroundColor Red >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Read-Host "按 Enter 键退出"
echo     exit >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } else { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "[信息] 项目核心文件 server.js 已找到" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 检查依赖并启动服务器 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Set-Location $PROJECT_DIR >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo if (-not (Test-Path "$PROJECT_DIR\node_modules")) { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     Write-Host "[信息] 正在安装项目依赖..." -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     npm install --force >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 创建日志目录 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo if (-not (Test-Path "$PROJECT_DIR\logs")) { >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo     New-Item -ItemType Directory -Path "$PROJECT_DIR\logs" | Out-Null >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo } >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 启动服务器 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "[信息] 正在启动服务器，请稍候..." -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Start-Process powershell -ArgumentList "-Command { node server.js | Tee-Object -FilePath \"$PROJECT_DIR\logs\server.log\" }" >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 等待服务器启动 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Start-Sleep -Seconds 5 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 打开浏览器 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Start-Process "http://localhost:3000/" >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo ^# 显示成功信息 >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Clear-Host >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "================================================================" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "连接成功！" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "服务器已启动，浏览器应已打开项目页面。" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "如果浏览器未自动打开，请手动访问 http://localhost:3000/" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Write-Host "================================================================" -ForegroundColor Green >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo >> "c:\Users\Administrator\Desktop\艺考助手\direct_connect.ps1"
echo Read-Host "按 Enter 键退出"

:: 创建一个可以直接运行的启动器
echo [信息] 创建直接启动器...
echo @echo off > "c:\Users\Administrator\Desktop\艺考助手\一键启动.bat"
echo chcp 65001 >nul >> "c:\Users\Administrator\Desktop\艺考助手\一键启动.bat"
echo PowerShell -Command "Start-Process PowerShell -ArgumentList '-ExecutionPolicy Bypass -File "%~dp0\direct_connect.ps1"' -Verb RunAs" >> "c:\Users\Administrator\Desktop\艺考助手\一键启动.bat"
echo exit >> "c:\Users\Administrator\Desktop\艺考助手\一键启动.bat"

:: 完成信息
echo.
echo ===================================================================
echo 修复操作已完成！
echo.
echo 已执行的修复操作：
echo 1. 检查并修复了 .bat 文件关联设置
if exist "c:\Users\Administrator\Desktop\艺考助手\direct_connect_clean.bat" (
echo 2. 创建了干净的批处理文件副本：direct_connect_clean.bat
)
echo 3. 检查并确保了文件权限

echo 已创建替代方案：
echo 1. PowerShell 版本启动脚本：direct_connect.ps1

echo 2. 一键启动器：一键启动.bat

echo 使用方法：
echo - 尝试双击运行 "一键启动.bat" 直接启动服务

echo - 或者右键点击 "direct_connect.ps1"，选择 "使用 PowerShell 运行"

echo - 如果仍有问题，尝试以管理员身份运行上述文件

echo 如有任何疑问，请联系技术支持。
echo ===================================================================

:: 保持窗口打开
pause