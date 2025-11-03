const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { performanceMiddleware, SimpleCache, withTimeout } = require('./performance-middleware');

const app = express();

// 确保HTML文件夹存在
const htmlFolder = path.join(__dirname, 'HTML');
if (!fs.existsSync(htmlFolder)) {
  try {
    fs.mkdirSync(htmlFolder, { recursive: true });
    console.log('✅ HTML文件夹已创建:', htmlFolder);
  } catch (mkdirError) {
    console.error('❌ 创建HTML文件夹失败:', mkdirError);
  }
} else {
  console.log('✅ HTML文件夹已存在:', htmlFolder);
  // 检查文件夹权限
  try {
    const testFilePath = path.join(htmlFolder, '.test-permission');
    fs.writeFileSync(testFilePath, 'test');
    fs.unlinkSync(testFilePath);
    console.log('✅ HTML文件夹写入权限检查通过');
  } catch (permError) {
    console.error('❌ HTML文件夹写入权限检查失败:', permError);
  }
}

// 确保images文件夹存在
const imagesFolder = path.join(__dirname, 'images');
if (!fs.existsSync(imagesFolder)) {
  try {
    fs.mkdirSync(imagesFolder, { recursive: true });
    console.log('✅ images文件夹已创建:', imagesFolder);
  } catch (mkdirError) {
    console.error('❌ 创建images文件夹失败:', mkdirError);
  }
} else {
  console.log('✅ images文件夹已存在:', imagesFolder);
}

// 确保乐谱文件夹存在
const sheetMusicFolder = path.join(__dirname, 'sheet-music');
if (!fs.existsSync(sheetMusicFolder)) {
  try {
    fs.mkdirSync(sheetMusicFolder, { recursive: true });
    console.log('✅ 乐谱文件夹已创建:', sheetMusicFolder);
  } catch (mkdirError) {
    console.error('❌ 创建乐谱文件夹失败:', mkdirError);
  }
} else {
  console.log('✅ 乐谱文件夹已存在:', sheetMusicFolder);
}

// 配置multer - HTML文件
const htmlStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('准备保存HTML文件到目录:', htmlFolder);
    cb(null, htmlFolder);
  },
  filename: function (req, file, cb) {
    // 保留原始文件名，但确保HTML文件扩展名
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext);
    // 使用时间戳确保唯一性，并为了避免Windows系统中的编码问题
    const timestamp = Date.now();
    const safeFileName = `${timestamp}_${Buffer.from(baseName).toString('base64').replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    console.log('保存HTML文件: 原始文件名=', file.originalname, '处理后文件名=', safeFileName);
    cb(null, safeFileName);
  }
});

// 配置multer - 图片文件
const imageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('准备保存图片文件到目录:', imagesFolder);
    cb(null, imagesFolder);
  },
  filename: function (req, file, cb) {
    // 生成唯一的文件名，避免覆盖
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext);
    // 使用时间戳确保唯一性
    const timestamp = Date.now();
    const fileName = `${baseName}_${timestamp}${ext}`;
    console.log('保存图片文件: 原始文件名=', file.originalname, '处理后文件名=', fileName);
    cb(null, fileName);
  }
});

// HTML文件过滤器
const htmlFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  console.log('检查HTML文件类型:', file.originalname, '扩展名:', ext);
  if (ext === '.html' || ext === '.htm') {
    cb(null, true);
  } else {
    console.error('HTML文件类型不允许:', file.originalname);
    cb(new Error('只允许上传HTML文件'), false);
  }
};

// 图片文件过滤器
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  console.log('检查图片文件类型:', file.originalname, '扩展名:', ext);
  if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.gif') {
    cb(null, true);
  } else {
    console.error('图片文件类型不允许:', file.originalname);
    cb(new Error('只允许上传图片文件'), false);
  }
};

// 创建两个upload实例
const htmlUpload = multer({
  storage: htmlStorage,
  fileFilter: htmlFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 增加HTML文件大小限制到10MB
  onError: function(err, next) {
    console.error('HTML文件上传错误:', err);
    next(err);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 增加图片文件大小限制到50MB
  onError: function(err, next) {
    console.error('图片文件上传错误:', err);
    next(err);
  }
});

// 创建一个能够处理多个文件的multer实例
const multiFileUpload = multer({
  // 使用内存存储以便同时处理多个文件
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 增加到50MB 限制
  }
});

// 组合两个上传中间件的处理函数
function handleFileUpload(req, res, next) {
  console.log('进入handleFileUpload中间件');
  
  // 使用fields()方法同时处理多个文件字段
  multiFileUpload.fields([
    { name: 'htmlFile', maxCount: 1 },
    { name: 'image', maxCount: 1 },
    { name: 'sheetMusic', maxCount: 1 },
    { name: 'sheetMusicPreview', maxCount: 1 }
  ])(req, res, function(err) {
    if (err) {
      console.error('文件上传错误:', err);
      return res.status(400).json({ success: false, message: '文件上传失败: ' + err.message });
    }
    
    try {
      console.log('文件上传成功，req.files:', req.files);
      
      // 处理HTML文件
      if (req.files && req.files.htmlFile && req.files.htmlFile[0]) {
        const htmlFile = req.files.htmlFile[0];
        console.log('处理HTML文件:', htmlFile.originalname);
        
        // 检查文件类型
        const ext = path.extname(htmlFile.originalname).toLowerCase();
        if (ext !== '.html' && ext !== '.htm') {
          console.error('HTML文件类型不允许:', htmlFile.originalname, '扩展名:', ext);
          return res.status(400).json({ success: false, message: '只允许上传HTML文件' });
        }
        
        // 生成唯一的文件名，简化处理避免Windows路径问题
        const timestamp = Date.now();
        // 使用更简单的文件名生成方式，避免base64编码导致的路径过长问题
        const safeFileName = `html_${timestamp}${ext}`;
        const filePath = path.join(htmlFolder, safeFileName);
        
        // 确保HTML文件夹存在
        if (!fs.existsSync(htmlFolder)) {
          try {
            fs.mkdirSync(htmlFolder, { recursive: true });
            console.log('HTML文件夹不存在，已创建:', htmlFolder);
          } catch (mkdirError) {
            console.error('创建HTML文件夹失败:', mkdirError);
            return res.status(500).json({ success: false, message: '创建HTML文件夹失败: ' + mkdirError.message });
          }
        }
        
        console.log('准备保存HTML文件到:', filePath);
        
        // 使用binary模式写入文件，确保文件内容正确保存
        fs.writeFileSync(filePath, htmlFile.buffer, { encoding: 'binary' });
        
        // 验证文件是否成功保存
        if (fs.existsSync(filePath)) {
          console.log('HTML文件保存成功，大小:', fs.statSync(filePath).size, '字节');
          // 安全获取原始文件名，避免baseName未定义错误
          const baseName = htmlFile.originalname ? path.basename(htmlFile.originalname, ext) : 'unknown';
          req.file = { 
            originalname: htmlFile.originalname, 
            filename: safeFileName,
            displayName: baseName // 保存原始文件名用于显示
          };
        } else {
          console.error('错误: HTML文件保存后检查失败，文件不存在:', filePath);
          return res.status(500).json({ success: false, message: 'HTML文件保存失败' });
        }
      } else {
        console.log('没有接收到HTML文件');
      }
      
      // 处理图片文件或URL
      if (req.files && req.files.image && req.files.image[0]) {
        // 处理文件上传的情况
        const imageFile = req.files.image[0];
        console.log('处理图片文件:', imageFile.originalname);
        
        // 检查文件类型
        const ext = path.extname(imageFile.originalname).toLowerCase();
        if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png' && ext !== '.gif') {
          console.error('图片文件类型不允许:', imageFile.originalname);
          return res.status(400).json({ success: false, message: '只允许上传JPG、PNG或GIF图片' });
        }
        
        // 生成唯一文件名，简化处理避免Windows路径问题
        const timestamp = Date.now();
        // 使用更简单的文件名生成方式，避免base64编码导致的路径过长问题
        const safeFileName = `image_${timestamp}${ext}`;
        const filePath = path.join(imagesFolder, safeFileName);
        
        // 确保images文件夹存在
        if (!fs.existsSync(imagesFolder)) {
          try {
            fs.mkdirSync(imagesFolder, { recursive: true });
            console.log('images文件夹不存在，已创建:', imagesFolder);
          } catch (mkdirError) {
            console.error('创建images文件夹失败:', mkdirError);
            return res.status(500).json({ success: false, message: '创建图片文件夹失败: ' + mkdirError.message });
          }
        }
        
        console.log('准备保存图片文件到:', filePath);
        
        // 写入文件
        fs.writeFileSync(filePath, imageFile.buffer);
        
        // 验证图片是否成功保存
        if (fs.existsSync(filePath)) {
          console.log('图片文件保存成功，大小:', fs.statSync(filePath).size, '字节');
          // 安全获取原始文件名，避免baseName未定义错误
          const baseName = imageFile.originalname ? path.basename(imageFile.originalname, ext) : 'unknown';
          req.imageFile = {
            originalname: imageFile.originalname,
            filename: safeFileName,
            displayName: baseName // 保存原始文件名用于显示
          };
        } else {
          console.error('错误: 图片文件保存后检查失败，文件不存在:', filePath);
          return res.status(500).json({ success: false, message: '图片文件保存失败' });
        }
      } else if (req.body.image && typeof req.body.image === 'string' && req.body.image.trim() !== '') {
        // 处理图片URL的情况
        const imageUrl = req.body.image.trim();
        console.log('处理图片URL:', imageUrl);
        
        // 简单验证URL格式
        try {
          new URL(imageUrl);
          req.imageUrl = imageUrl;
          console.log('图片URL验证通过，已设置到req.imageUrl');
        } catch (urlError) {
          console.error('图片URL格式错误:', imageUrl);
          // 这里不抛出错误，因为可能是相对路径或者其他格式
          // 我们将它作为普通字符串保存
          req.imageUrl = imageUrl;
          console.log('图片URL格式可能不是完整URL，作为普通字符串保存');
        }
      } else {
        console.log('没有接收到图片文件或URL');
      }
      
      // 处理乐谱文件
      if (req.files && req.files.sheetMusic && req.files.sheetMusic[0]) {
        const sheetMusicFile = req.files.sheetMusic[0];
        console.log('处理乐谱文件:', sheetMusicFile.originalname);
        
        // 检查文件类型
        const ext = path.extname(sheetMusicFile.originalname).toLowerCase();
        const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
        if (!allowedExtensions.includes(ext)) {
          console.error('乐谱文件类型不允许:', sheetMusicFile.originalname, '扩展名:', ext);
          return res.status(400).json({ success: false, message: '只允许上传PDF、JPG、JPEG或PNG格式的乐谱文件' });
        }
        
        // 生成唯一文件名
        const timestamp = Date.now();
        const safeFileName = `sheet_music_${timestamp}${ext}`;
        const filePath = path.join(sheetMusicFolder, safeFileName);
        
        // 确保乐谱文件夹存在
        if (!fs.existsSync(sheetMusicFolder)) {
          try {
            fs.mkdirSync(sheetMusicFolder, { recursive: true });
            console.log('乐谱文件夹不存在，已创建:', sheetMusicFolder);
          } catch (mkdirError) {
            console.error('创建乐谱文件夹失败:', mkdirError);
            return res.status(500).json({ success: false, message: '创建乐谱文件夹失败: ' + mkdirError.message });
          }
        }
        
        console.log('准备保存乐谱文件到:', filePath);
        
        // 写入文件
        fs.writeFileSync(filePath, sheetMusicFile.buffer);
        
        // 验证文件是否成功保存
        if (fs.existsSync(filePath)) {
          console.log('乐谱文件保存成功，大小:', fs.statSync(filePath).size, '字节');
          // 安全获取原始文件名，避免baseName未定义错误
          const baseName = sheetMusicFile.originalname ? path.basename(sheetMusicFile.originalname, ext) : 'unknown';
          req.sheetMusicFile = { 
            originalname: sheetMusicFile.originalname, 
            filename: safeFileName,
            displayName: baseName // 保存原始文件名用于显示
          };
        } else {
          console.error('错误: 乐谱文件保存后检查失败，文件不存在:', filePath);
          return res.status(500).json({ success: false, message: '乐谱文件保存失败' });
        }
      } else {
        console.log('没有接收到乐谱文件');
      }
      
      // 处理乐谱预览图文件
      if (req.files && req.files.sheetMusicPreview && req.files.sheetMusicPreview[0]) {
        const previewFile = req.files.sheetMusicPreview[0];
        console.log('处理乐谱预览图文件:', previewFile.originalname);
        
        // 检查文件类型
        const ext = path.extname(previewFile.originalname).toLowerCase();
        if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
          console.error('乐谱预览图文件类型不允许:', previewFile.originalname);
          return res.status(400).json({ success: false, message: '只允许上传JPG、JPEG或PNG格式的预览图' });
        }
        
        // 生成唯一文件名
        const timestamp = Date.now();
        const safeFileName = `sheet_music_preview_${timestamp}${ext}`;
        const filePath = path.join(sheetMusicFolder, safeFileName);
        
        // 确保乐谱文件夹存在
        if (!fs.existsSync(sheetMusicFolder)) {
          try {
            fs.mkdirSync(sheetMusicFolder, { recursive: true });
            console.log('乐谱文件夹不存在，已创建:', sheetMusicFolder);
          } catch (mkdirError) {
            console.error('创建乐谱文件夹失败:', mkdirError);
            return res.status(500).json({ success: false, message: '创建乐谱文件夹失败: ' + mkdirError.message });
          }
        }
        
        console.log('准备保存乐谱预览图文件到:', filePath);
        
        // 写入文件
        fs.writeFileSync(filePath, previewFile.buffer);
        
        // 验证文件是否成功保存
        if (fs.existsSync(filePath)) {
          console.log('乐谱预览图文件保存成功，大小:', fs.statSync(filePath).size, '字节');
          // 安全获取原始文件名，避免baseName未定义错误
          const baseName = previewFile.originalname ? path.basename(previewFile.originalname, ext) : 'unknown';
          req.sheetMusicPreviewFile = { 
            originalname: previewFile.originalname, 
            filename: safeFileName,
            displayName: baseName // 保存原始文件名用于显示
          };
        } else {
          console.error('错误: 乐谱预览图文件保存后检查失败，文件不存在:', filePath);
          return res.status(500).json({ success: false, message: '乐谱预览图文件保存失败' });
        }
      } else {
        console.log('没有接收到乐谱预览图文件');
      }
      
      // 所有文件处理完成，继续下一个中间件
      next();
    } catch (fileSaveError) {
      console.error('保存文件时发生错误:', fileSaveError);
      console.error('错误堆栈:', fileSaveError.stack);
      return res.status(500).json({ success: false, message: '保存文件失败: ' + fileSaveError.message });
    }
  });
}

// 中间件 - 配置CORS以支持credentials
app.use(cors({
  origin: function(origin, callback) {
    // 允许null（file://协议）、任何localhost请求或开发环境的请求
    if (!origin || origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // 允许携带凭证
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// 增加Express的请求体大小限制，与multer图片大小限制匹配
app.use(express.json({ limit: '50mb' }));
// 增加urlencoded中间件的请求体大小限制
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 应用性能监控中间件
app.use(performanceMiddleware);

// 确保API路由优先于静态文件路由
// 所有API路由都应该在静态文件处理之前定义
// 注意：在实际项目中，所有API路由应该在这里定义或通过路由模块导入

// 静态文件服务 - 放在API路由之后，这样API路由会优先匹配
app.use(express.static(__dirname));
console.log('静态文件服务路径:', __dirname);

// 配置
const PORT = process.env.PORT || 3004; // 更换端口避免冲突
const JWT_SECRET = 'your_jwt_secret_key'; // 实际应用中应使用环境变量

// 创建缓存实例用于API请求缓存
const songsCache = new SimpleCache(30000); // 缓存30秒

// ======================
// MySQL数据库配置
// 请根据您的MySQL实际配置修改以下参数
// ======================
const mysqlConfig = {
  database: 'music_library_db',  // 数据库名称
  username: 'root',         // MySQL用户名
  password: '6562989gh',             // MySQL密码（如果没有密码，请保持为空字符串）
  host: 'localhost',        // MySQL主机地址
  port: 3306                // MySQL端口号
};



// 创建Sequelize实例，连接MySQL数据库
const sequelize = new Sequelize(mysqlConfig.database, mysqlConfig.username, mysqlConfig.password, {
  host: mysqlConfig.host,
  dialect: 'mysql',
  port: mysqlConfig.port,
  define: {
    timestamps: false
  },
  logging: false // 如需查看SQL日志，请改为console.log
});

// 测试数据库连接和初始化
let databaseAvailable = false;

async function initializeDatabase() {
  try {
    // 测试连接
    await sequelize.authenticate();
    console.log('✅ MySQL数据库连接成功');
    
    // 连接成功后立即设置数据库可用
    databaseAvailable = true;
    
    // 同步模型到数据库 - 使用更保守的策略避免表结构修改错误
    await sequelize.sync({
      force: false, // 不强制重建表
      alter: false, // 不自动更新表结构
      logging: console.log // 添加详细的SQL日志，帮助诊断问题
    });
    console.log('✅ 数据库模型同步成功');
    
    // 创建默认管理员账户
    await createDefaultAdmin();
    
    // 创建默认用户
    await createDefaultUser();
    
    // 创建默认曲目数据
    await createDefaultSongs();
    
    console.log('✅ 数据库初始化完成');
    
    return true;
  } catch (err) {
    console.error('❌ 数据库连接失败:', err);
    console.error('❌ 错误名称:', err.name);
    console.error('❌ 错误消息:', err.message);
    console.error('❌ 错误堆栈:', err.stack);
    console.error('❌ 请确保MySQL服务已启动，并且以下配置正确:');
    console.error(`❌ 数据库: ${mysqlConfig.database}`);
    console.error(`❌ 用户名: ${mysqlConfig.username}`);
    console.error(`❌ 密码: ${mysqlConfig.password ? '******' : '空密码'}`);
    console.error(`❌ 主机: ${mysqlConfig.host}`);
    console.error(`❌ 端口: ${mysqlConfig.port}`);
    console.error('❌ 请修改server.js文件中的mysqlConfig对象以匹配您的MySQL配置');
    console.error('❌ 服务器将在数据库不可用的状态下继续运行');
    
    // 只在真正的连接错误时才将databaseAvailable设置为false
    // 如果是连接成功后的其他错误（如表结构同步、数据初始化等），保持databaseAvailable为true
    if (err.name === 'SequelizeConnectionError' || err.name === 'SequelizeAccessDeniedError' || err.name === 'SequelizeHostNotFoundError' || err.name === 'SequelizeHostNotReachableError') {
      databaseAvailable = false;
    }
    
    return true; // 返回true让服务器继续运行
  }
}

// 定义曲目模型
const Song = sequelize.define('Song', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    defaultValue: '未知类型'
  },
  composer: {
    type: DataTypes.STRING,
    defaultValue: '未知作曲家'
  },
  // 添加多标签支持
  tags: {
    type: DataTypes.STRING,
    get() {
      const data = this.getDataValue('tags');
      return data ? JSON.parse(data) : [];
    },
    set(value) {
      this.setDataValue('tags', JSON.stringify(value));
    }
  },
  type2: {
    type: DataTypes.STRING
  },
  type3: {
    type: DataTypes.STRING
  },
  difficulty: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 5
    }
  },
  imageUrl: {
    type: DataTypes.STRING,
    defaultValue: 'https://via.placeholder.com/300x300?text=音乐'
  },
  createTime: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  // 添加HTML文件路径字段
  htmlFilePath: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  // 添加乐谱文件路径字段
  sheetMusicPath: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  // 添加乐谱预览图路径字段
  sheetMusicPreviewPath: {
    type: DataTypes.STRING,
    defaultValue: ''
  }
});

// 定义用户模型
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: function() {
      return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  avatar: {
    type: DataTypes.STRING,
    defaultValue: 'https://randomuser.me/api/portraits/men/32.jpg'
  },
  location: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  role: {
    type: DataTypes.STRING,
    defaultValue: '学生'
  },
  bio: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  phone: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  email: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  favoritesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  strategiesCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  learningDays: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  // 学习统计数据（缓存）
  weeklyHours: {
    type: DataTypes.FLOAT,
    defaultValue: 0
  },
  weeklySongs: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  weeklyPractices: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  weeklyCompletion: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
});

// 定义用户收藏模型
const UserFavorite = sequelize.define('UserFavorite', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  songId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Songs',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: '计划学习'
  },
  progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// 定义学习记录模型
const LearningRecord = sequelize.define('LearningRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  songId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Songs',
      key: 'id'
    }
  },
  contentId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  contentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contentType: {
    type: DataTypes.STRING,
    defaultValue: '曲目'
  },
  duration: {
    type: DataTypes.STRING,
    defaultValue: '0分钟'
  },
  progressChange: {
    type: DataTypes.STRING,
    defaultValue: '+0%'
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// 定义浏览历史模型
const BrowsingHistory = sequelize.define('BrowsingHistory', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  contentId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  contentName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contentType: {
    type: DataTypes.STRING,
    defaultValue: '曲目'
  },
  viewedAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// 定义笔记模型
const Note = sequelize.define('Note', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  relatedTo: {
    type: DataTypes.STRING,
    defaultValue: ''
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: Sequelize.NOW
  }
});

// 定义通知设置模型
const NotificationSetting = sequelize.define('NotificationSetting', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  pushEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  emailEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  practiceReminder: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  newContentAlert: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  examInfo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  frequency: {
    type: DataTypes.STRING,
    defaultValue: 'daily'
  }
});

// 定义管理员模型
const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
    // 移除unique约束以避免"Too many keys specified"错误
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// 创建默认管理员账户（如果不存在）
async function createDefaultAdmin() {
  try {
    const adminExists = await Admin.findOne({ where: { username: 'admin' } });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await Admin.create({
        username: 'admin',
        password: hashedPassword
      });
      console.log('默认管理员账户已创建: 用户名=admin, 密码=admin123');
    }
  } catch (error) {
    console.log('创建默认管理员失败:', error);
  }
}

// 创建默认曲目数据（如果不存在）
async function createDefaultSongs() {
  try {
    // 检查是否已有曲目数据
    const songCount = await Song.count();
    if (songCount === 0) {
      // 创建示例曲目数据
      const sampleSongs = [
        {
          title: '美丽的草原我的家',
          type: '女中音',
          type2: '蒙古族民歌',
          type3: '中文歌曲',
          composer: '阿拉腾奥勒',
          tags: ['经典', '民歌', '抒情'],
          difficulty: 3,
          imageUrl: 'https://picsum.photos/id/1025/300/300',
          description: '著名蒙古族作曲家阿拉腾奥勒创作的经典歌曲，德德玛的代表作之一。'
        },
        {
          title: '我和我的祖国',
          type: '女高音',
          type2: '爱国歌曲',
          type3: '中文歌曲',
          composer: '秦咏诚',
          tags: ['经典', '爱国', '抒情'],
          difficulty: 4,
          imageUrl: 'https://picsum.photos/id/1039/300/300',
          description: '由张藜作词、秦咏诚作曲、李谷一原唱的经典爱国歌曲，表达了对祖国的热爱之情。'
        },
        {
          title: '在那遥远的地方',
          type: '男高音',
          type2: '哈萨克族民歌',
          type3: '中文歌曲',
          composer: '王洛宾',
          tags: ['经典', '民歌', '爱情'],
          difficulty: 2,
          imageUrl: 'https://picsum.photos/id/1040/300/300',
          description: '王洛宾整理改编的哈萨克族民歌，被称为"中国的小夜曲"。'
        },
        {
          title: '我爱你中国',
          type: '女高音',
          type2: '爱国歌曲',
          type3: '中文歌曲',
          composer: '郑秋枫',
          tags: ['经典', '爱国', '深情'],
          difficulty: 5,
          imageUrl: 'https://picsum.photos/id/1041/300/300',
          description: '电影《海外赤子》的插曲，由叶佩英首唱，表达了海外游子对祖国的热爱。'
        },
        {
          title: '茉莉花',
          type: '女声独唱',
          type2: '江苏民歌',
          type3: '中文歌曲',
          composer: '佚名',
          tags: ['传统', '民歌', '优美'],
          difficulty: 2,
          imageUrl: 'https://picsum.photos/id/1053/300/300',
          description: '中国传统民歌，以委婉动听的旋律和优美的歌词著称，是中国文化的代表曲目之一。'
        },
        {
          title: '草原上升起不落的太阳',
          type: '男高音',
          type2: '蒙古族民歌',
          type3: '中文歌曲',
          composer: '美丽其格',
          tags: ['经典', '民歌', '草原'],
          difficulty: 3,
          imageUrl: 'https://picsum.photos/id/1059/300/300',
          description: '蒙古族作曲家美丽其格创作的经典歌曲，表达了草原人民对美好生活的向往。'
        },
        {
          title: '歌唱祖国',
          type: '混声合唱',
          type2: '爱国歌曲',
          type3: '中文歌曲',
          composer: '王莘',
          tags: ['经典', '爱国', '合唱'],
          difficulty: 4,
          imageUrl: 'https://picsum.photos/id/1060/300/300',
          description: '由王莘作词作曲的经典爱国歌曲，被称为"第二国歌"。'
        },
        {
          title: '长江之歌',
          type: '女中音',
          type2: '抒情歌曲',
          type3: '中文歌曲',
          composer: '王世光',
          tags: ['经典', '抒情', '大气'],
          difficulty: 3,
          imageUrl: 'https://picsum.photos/id/1063/300/300',
          description: '电视纪录片《话说长江》的主题歌，气势恢宏，旋律优美。'
        }
      ];

      // 批量创建曲目
      const createdSongs = await Song.bulkCreate(sampleSongs);
      console.log(`✅ 创建了${createdSongs.length}条默认曲目数据`);

      // 为默认用户创建一些收藏记录
      const userId = 1; // 假设默认用户ID为1
      const favoriteSongs = [
        { userId, songId: createdSongs[0].id, status: '学习中', progress: 85 },
        { userId, songId: createdSongs[1].id, status: '计划学习', progress: 0 },
        { userId, songId: createdSongs[3].id, status: '已完成', progress: 100 }
      ];

      await UserFavorite.bulkCreate(favoriteSongs);
      console.log(`✅ 为默认用户创建了${favoriteSongs.length}条收藏记录`);
    }
  } catch (error) {
    console.error('❌ 创建默认曲目数据失败:', error);
  }
}

// 创建默认用户（如果不存在）
async function createDefaultUser() {
  try {
    const userExists = await User.findOne({ where: { name: '张小艺' } });
    if (!userExists) {
      // 对密码进行加密
      const hashedPassword = await bcrypt.hash('user123', 10);
      
      // 创建默认用户
      const user = await User.create({
        username: 'zhangxiaoyi',
        password: hashedPassword,
        name: '张小艺',
        avatar: 'https://randomuser.me/api/portraits/women/68.jpg',
        location: '北京市',
        role: '高三学生',
        bio: '热爱声乐的艺考生，希望能考上理想的音乐院校',
        phone: '13812345678',
        email: 'zhangxiaoyi@example.com',
        favoritesCount: 128,
        strategiesCount: 36,
        learningDays: 12,
        weeklyHours: 12.5,
        weeklySongs: 18,
        weeklyPractices: 32,
        weeklyCompletion: 68
      });
      console.log('默认用户已创建: 用户ID=', user.id, '用户名=', user.username);
      
      // 创建默认通知设置
      await NotificationSetting.create({
        userId: user.id,
        pushEnabled: true,
        emailEnabled: true,
        practiceReminder: true,
        newContentAlert: true,
        examInfo: true,
        frequency: 'daily'
      });
      
      // 创建一些学习记录示例
      const learningRecords = [
        {
          userId: user.id,
          songId: 1,
          contentName: '《美丽的草原我的家》',
          contentType: '曲目',
          duration: '30分钟',
          progressChange: '+5%'
        },
        {
          userId: user.id,
          songId: 2,
          contentName: '《我和我的祖国》',
          contentType: '曲目',
          duration: '20分钟',
          progressChange: '+10%'
        },
        {
          userId: user.id,
          contentId: 1,
          contentName: '女中音声区转换技巧详解与训练方法',
          contentType: '教程',
          duration: '45分钟'
        }
      ];
      
      for (const record of learningRecords) {
        await LearningRecord.create(record);
      }
      
      // 创建一些浏览历史示例
      const browsingHistory = [
        {
          userId: user.id,
          contentId: 1,
          contentName: '《我和我的祖国》演唱处理与情感表达指南',
          contentType: '曲目分析'
        },
        {
          userId: user.id,
          contentId: 2,
          contentName: '女中音声区转换技巧详解与训练方法',
          contentType: '技巧教学'
        },
        {
          userId: user.id,
          songId: 1,
          contentName: '《美丽的草原我的家》',
          contentType: '曲目'
        }
      ];
      
      for (const history of browsingHistory) {
        await BrowsingHistory.create(history);
      }
      
      // 创建一些笔记示例
      const notes = [
        {
          userId: user.id,
          title: '女中音声区转换要点',
          content: '1. 中低音区要保持喉咙放松，气息下沉\n2. 换声点附近要注意共鸣位置的转换\n3. 高音区要保持面罩共鸣，避免挤压声带',
          relatedTo: '《女中音声区转换技巧详解与训练方法》'
        },
        {
          userId: user.id,
          title: '《我和我的祖国》情感处理',
          content: '1. 开头部分要轻柔深情\n2. 副歌部分要充满激情\n3. 结尾处要渐弱，表达不舍之情',
          relatedTo: '《我和我的祖国》'
        }
      ];
      
      for (const note of notes) {
        await Note.create(note);
      }
    }
  } catch (error) {
    console.log('创建默认用户失败:', error);
  }
}

// 生成JWT令牌
const generateToken = (adminId) => {
  return jwt.sign({ id: adminId }, JWT_SECRET, { expiresIn: '1h' });
};

// 验证JWT中间件
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '无效的认证令牌' });
  }
};

// 用户JWT认证中间件
const userAuthMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, message: '未提供认证令牌' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // 检查是否为普通用户角色
    if (decoded.role !== 'user') {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: '无效的认证令牌' });
  }
};

// 管理员登录API
app.post('/api/admin/login', async (req, res) => {
  try {
    console.log('收到登录请求:', req.body); // 添加详细的请求日志
    console.log('请求头信息:', req.headers); // 记录请求头
    
    const { username, password } = req.body;
    
    if (!username || !password) {
      console.log('登录失败: 用户名或密码为空');
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    const admin = await Admin.findOne({ where: { username } });
    if (!admin) {
      console.log(`登录失败: 未找到用户 ${username}`);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      console.log(`登录失败: 用户 ${username} 密码错误`);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    const token = generateToken(admin.id);
    console.log(`登录成功: 用户 ${username} 已登录`);
    res.json({ success: true, token });
  } catch (error) {
    console.error('登录错误:', error);
    console.error('错误堆栈:', error.stack); // 记录完整错误堆栈
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 获取曲目列表API（普通用户）
app.get('/api/songs', async (req, res) => {
  try {
    console.log('收到/api/songs请求:', req.query); // 添加日志记录
    // 获取分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    
    // 检查数据库是否可用
    if (!databaseAvailable) {
      console.log('数据库不可用，返回空数据列表');
      return res.json({
        success: true,
        data: {
          items: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          pageSize: pageSize
        }
      });
    }
    
    const offset = (page - 1) * pageSize;
    
    // 构建缓存键
    const cacheKey = JSON.stringify({
      page,
      pageSize,
      search: req.query.search,
      voicePart: req.query.voicePart,
      language: req.query.language,
      genre: req.query.genre,
      difficulty: req.query.difficulty,
      sort: req.query.sort
    });
    
    // 检查缓存
    const cachedData = songsCache.get(cacheKey);
    if (cachedData) {
      console.log('使用缓存数据，避免数据库查询');
      return res.json(cachedData);
    }
    
    // 构建查询条件
    const where = {};
    const search = req.query.search;
    
    // 搜索功能
    if (search) {
      where[Sequelize.Op.or] = [
        {
          title: {
            [Sequelize.Op.like]: `%${search}%`
          }
        },
        {
          composer: {
            [Sequelize.Op.like]: `%${search}%`
          }
        }
      ];
    }
    
    // 筛选功能 - 支持多类型筛选
    // 声部筛选
    if (req.query.voicePart && req.query.voicePart !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.voicePart },
        { type2: req.query.voicePart },
        { type3: req.query.voicePart }
      );
    }
    
    // 语言筛选
    if (req.query.language && req.query.language !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.language },
        { type2: req.query.language },
        { type3: req.query.language }
      );
    }
    
    // 体裁筛选
    if (req.query.genre && req.query.genre !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.genre },
        { type2: req.query.genre },
        { type3: req.query.genre }
      );
    }
    
    // 难度筛选
    if (req.query.difficulty) {
      where.difficulty = req.query.difficulty;
    }
    
    // 排序功能
    let order = [['createTime', 'DESC']];
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'newest':
          order = [['createTime', 'DESC']];
          break;
        case 'oldest':
          order = [['createTime', 'ASC']];
          break;
        case 'title_asc':
          order = [['title', 'ASC']];
          break;
        case 'title_desc':
          order = [['title', 'DESC']];
          break;
      }
    }
    
    console.log('执行数据库查询:', { where, offset, pageSize, order });
    
    // 执行分页查询，添加超时处理
    const { count, rows } = await withTimeout(
      Song.findAndCountAll({
        where,
        offset,
        limit: pageSize,
        order,
        // 只选择需要的字段，减少数据传输
        attributes: ['id', 'title', 'type', 'composer', 'tags', 'type2', 'type3', 'difficulty', 'imageUrl', 'views', 'description']
      }),
      3000 // 3秒超时
    );
    
    console.log('查询完成，找到', count, '条记录');
    
    // 计算总页数
    const totalPages = Math.ceil(count / pageSize);
    
    // 构建响应数据
    const responseData = {
      success: true,
      data: {
        items: rows,
        totalItems: count,
        totalPages,
        currentPage: page,
        pageSize
      }
    };
    
    // 缓存结果
    songsCache.set(cacheKey, responseData);
    
    // 返回分页数据
    res.json(responseData);
  } catch (error) {
    console.error('获取曲目列表错误:', error);
    
    // 根据错误类型返回不同的错误信息
    if (error.message.includes('超时')) {
      res.status(504).json({ 
        success: false, 
        message: '查询超时，请稍后再试',
        data: {
          items: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 10
        }
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: '获取曲目失败: ' + error.message,
        data: {
          items: [],
          totalItems: 0,
          totalPages: 0,
          currentPage: 1,
          pageSize: 10
        }
      });
    }
  }
});

// 获取曲目列表API（管理员）
app.get('/api/admin/songs', authMiddleware, async (req, res) => {
  try {
    console.log('管理员曲目列表API调用，请求参数:', req.query);
    // 其他代码保持不变
    // 获取分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    
    // 构建查询条件
    const where = {};
    const search = req.query.search;
    
    console.log('解析后的参数:', { page, pageSize, search, sort: req.query.sort, voicePart: req.query.voicePart, language: req.query.language, genre: req.query.genre, difficulty: req.query.difficulty });
    
    // 搜索功能
    if (search) {
      where[Sequelize.Op.or] = [
        {
          title: {
            [Sequelize.Op.like]: `%${search}%`
          }
        },
        {
          composer: {
            [Sequelize.Op.like]: `%${search}%`
          }
        }
      ];
    }
    
    // 筛选功能 - 支持多类型筛选
    // 声部筛选
    if (req.query.voicePart && req.query.voicePart !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.voicePart },
        { type2: req.query.voicePart },
        { type3: req.query.voicePart }
      );
    }
    
    // 语言筛选
    if (req.query.language && req.query.language !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.language },
        { type2: req.query.language },
        { type3: req.query.language }
      );
    }
    
    // 体裁筛选
    if (req.query.genre && req.query.genre !== 'all') {
      where[Sequelize.Op.or] = where[Sequelize.Op.or] || [];
      where[Sequelize.Op.or].push(
        { type: req.query.genre },
        { type2: req.query.genre },
        { type3: req.query.genre }
      );
    }
    
    // 难度筛选
    if (req.query.difficulty) {
      where.difficulty = req.query.difficulty;
    }
    
    console.log('构建的查询条件:', where);
    
    // 排序功能
    let order = [['createTime', 'DESC']];
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'newest':
          order = [['createTime', 'DESC']];
          break;
        case 'oldest':
          order = [['createTime', 'ASC']];
          break;
        case 'title_asc':
          order = [['title', 'ASC']];
          break;
        case 'title_desc':
          order = [['title', 'DESC']];
          break;
      }
    }
    
    console.log('构建的排序条件:', order);
    
    // 执行分页查询
    console.log('开始查询数据库...');
    const { count, rows } = await Song.findAndCountAll({
      where,
      offset,
      limit: pageSize,
      order
    });
    
    console.log('查询到总记录数:', count);
    console.log('查询到的曲目数量:', rows.length);
    
    // 计算总页数
    const totalPages = Math.ceil(count / pageSize);
    
    // 返回分页数据
    const responseData = {
      success: true,
      data: {
        items: rows,
        totalItems: count,
        totalPages,
        currentPage: page,
        pageSize
      }
    };
    
    console.log('准备返回结果:', { success: responseData.success, totalItems: responseData.data.totalItems, itemsCount: responseData.data.items.length });
    
    res.json(responseData);
  } catch (error) {
    console.error('获取曲目列表错误:', error);
    res.status(500).json({ success: false, message: '获取曲目失败: ' + error.message });
  }
});

// 获取单个曲目API（管理员）
app.get('/api/admin/songs/:id', authMiddleware, async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: '曲目不存在' });
    }
    res.json({ success: true, data: song });
  } catch (error) {
    console.error('获取曲目详情错误:', error);
    res.status(500).json({ success: false, message: '获取曲目失败' });
  }
});

// 添加曲目API（管理员）- 支持HTML文件上传
app.post('/api/admin/songs', authMiddleware, handleFileUpload, async (req, res) => {
  try {
    console.log('开始添加曲目...');
    console.log('请求包含HTML文件:', req.file ? req.file.originalname : '无HTML文件');
    console.log('请求包含图片文件:', req.imageFile ? req.imageFile.originalname : '无图片文件');
    console.log('请求体数据:', req.body);
    
    // 解析请求体中的数据，与更新API保持一致的处理逻辑
    let songData = {};
    if (req.body.data) {
      try {
        songData = JSON.parse(req.body.data);
        console.log('解析后的data字段:', songData);
      } catch (e) {
        console.error('解析data字段失败，使用原始请求体:', e);
        songData = req.body;
      }
    } else {
      songData = req.body;
    }
    console.log('最终使用的曲目数据:', songData);
    
    // 处理tags字段，确保是有效的JSON格式
    if (songData.tags && typeof songData.tags === 'string') {
      try {
        songData.tags = JSON.parse(songData.tags);
        console.log('解析后的tags:', songData.tags);
      } catch (e) {
        console.error('解析tags失败，使用空数组:', e);
        songData.tags = [];
      }
    }
    
    console.log('解析后的曲目数据（删除id前）:', songData);
    
    // 修复：删除songData中的id字段，因为id应该由数据库自动生成
    if (songData.id !== undefined) {
      console.log('发现并删除id字段，值为:', songData.id);
      delete songData.id;
      console.log('删除id字段后的曲目数据:', songData);
    } else {
      console.log('没有找到id字段，无需删除');
    }
    
    // 如果上传了HTML文件，设置htmlFilePath
    if (req.file) {
      const filePath = `HTML/${req.file.filename}`;
      console.log('设置HTML文件路径:', filePath);
      songData.htmlFilePath = filePath;
      
      // 验证文件是否成功保存
      const fullFilePath = path.join(__dirname, filePath);
      if (fs.existsSync(fullFilePath)) {
        console.log('文件成功保存到:', fullFilePath);
        console.log('文件大小:', fs.statSync(fullFilePath).size, '字节');
      } else {
        console.error('警告: 文件保存后检查失败，文件不存在:', fullFilePath);
        // 即使文件保存失败，我们仍然设置htmlFilePath，因为这是前端需要的信息
      }
    } else {
      console.log('没有接收到有效的HTML文件');
    }
    
    // 如果上传了图片文件，设置imageUrl
    if (req.imageFile) {
      const imagePath = `images/${req.imageFile.filename}`;
      console.log('设置图片文件路径:', imagePath);
      songData.imageUrl = imagePath;
      
      // 验证图片是否成功保存
      const fullImagePath = path.join(__dirname, imagePath);
      if (fs.existsSync(fullImagePath)) {
        console.log('图片成功保存到:', fullImagePath);
        console.log('图片大小:', fs.statSync(fullImagePath).size, '字节');
      } else {
        console.error('警告: 图片保存后检查失败，文件不存在:', fullImagePath);
      }
    } else if (req.imageUrl) {
      // 处理图片URL的情况
      console.log('设置图片URL:', req.imageUrl);
      songData.imageUrl = req.imageUrl;
    }
    
    // 如果上传了乐谱文件，设置sheetMusicPath
    if (req.sheetMusicFile) {
      const sheetMusicPath = `sheet-music/${req.sheetMusicFile.filename}`;
      console.log('设置乐谱文件路径:', sheetMusicPath);
      songData.sheetMusicPath = sheetMusicPath;
      
      // 验证乐谱文件是否成功保存
      const fullSheetMusicPath = path.join(__dirname, sheetMusicPath);
      if (fs.existsSync(fullSheetMusicPath)) {
        console.log('乐谱文件成功保存到:', fullSheetMusicPath);
        console.log('乐谱文件大小:', fs.statSync(fullSheetMusicPath).size, '字节');
      } else {
        console.error('警告: 乐谱文件保存后检查失败，文件不存在:', fullSheetMusicPath);
      }
    }
    
    // 如果上传了乐谱预览图文件，设置sheetMusicPreviewPath
    if (req.sheetMusicPreviewFile) {
      const previewPath = `sheet-music/${req.sheetMusicPreviewFile.filename}`;
      console.log('设置乐谱预览图路径:', previewPath);
      songData.sheetMusicPreviewPath = previewPath;
      
      // 验证乐谱预览图文件是否成功保存
      const fullPreviewPath = path.join(__dirname, previewPath);
      if (fs.existsSync(fullPreviewPath)) {
        console.log('乐谱预览图文件成功保存到:', fullPreviewPath);
        console.log('乐谱预览图文件大小:', fs.statSync(fullPreviewPath).size, '字节');
      } else {
        console.error('警告: 乐谱预览图文件保存后检查失败，文件不存在:', fullPreviewPath);
      }
    }
    
    // 创建曲目
    console.log('准备创建曲目记录...');
    const song = await Song.create(songData);
    console.log('曲目创建成功，ID:', song.id);
    
    res.json({ success: true, data: song });
  } catch (error) {
    console.error('添加曲目错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '添加曲目失败', error: error.message });
  }
});

// 更新曲目API（管理员）- 支持HTML文件上传
app.put('/api/admin/songs/:id', authMiddleware, handleFileUpload, async (req, res) => {
  try {
    console.log('开始更新曲目，ID:', req.params.id);
    console.log('请求包含HTML文件:', req.file ? req.file.originalname : '无HTML文件');
    console.log('请求包含图片文件:', req.imageFile ? req.imageFile.originalname : '无图片文件');
    
    const song = await Song.findByPk(req.params.id);
    if (!song) {
      console.error('曲目不存在，ID:', req.params.id);
      return res.status(404).json({ success: false, message: '曲目不存在' });
    }
    
    // 解析请求体中的JSON数据
    let updateData = {};
    if (req.body.data) {
      updateData = JSON.parse(req.body.data);
    } else {
      updateData = req.body;
    }
    
    console.log('更新数据:', updateData);
    
    // 如果上传了HTML文件，更新htmlFilePath
    if (req.file) {
      // 如果之前有HTML文件，可以选择删除它
      if (song.htmlFilePath) {
        const oldFilePath = path.join(__dirname, song.htmlFilePath);
        if (fs.existsSync(oldFilePath)) {
          try {
            fs.unlinkSync(oldFilePath);
            console.log('旧HTML文件已删除:', oldFilePath);
          } catch (deleteError) {
            console.error('删除旧HTML文件时发生错误:', deleteError);
            // 即使删除失败，也继续处理，因为我们可以上传新文件
          }
        } else {
          console.warn('旧HTML文件不存在，无需删除:', oldFilePath);
        }
      }
      
      const filePath = `HTML/${req.file.filename}`;
      console.log('设置新的HTML文件路径:', filePath);
      updateData.htmlFilePath = filePath;
      
      // 验证文件是否成功保存
      const fullFilePath = path.join(__dirname, filePath);
      if (fs.existsSync(fullFilePath)) {
        console.log('文件成功保存到:', fullFilePath);
        console.log('文件大小:', fs.statSync(fullFilePath).size, '字节');
      } else {
        console.error('警告: 文件保存后检查失败，文件不存在:', fullFilePath);
        // 即使文件保存失败，我们仍然设置htmlFilePath，因为这是前端需要的信息
      }
    } else {
      console.log('没有接收到有效的HTML文件');
    }
    
    // 如果上传了图片文件，更新imageUrl
    if (req.imageFile) {
      // 如果之前有图片文件，可以选择删除它
      if (song.imageUrl && song.imageUrl !== 'https://via.placeholder.com/300x300?text=音乐') {
        const oldImagePath = path.join(__dirname, song.imageUrl);
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
            console.log('旧图片文件已删除:', oldImagePath);
          } catch (err) {
            console.error('删除旧图片文件失败:', err);
          }
        } else {
          console.warn('旧图片文件不存在，无需删除:', oldImagePath);
        }
      }
      
      const imagePath = `images/${req.imageFile.filename}`;
      console.log('设置新的图片文件路径:', imagePath);
      updateData.imageUrl = imagePath;
      
      // 验证图片是否成功保存
      const fullImagePath = path.join(__dirname, imagePath);
      if (fs.existsSync(fullImagePath)) {
        console.log('图片成功保存到:', fullImagePath);
        console.log('图片大小:', fs.statSync(fullImagePath).size, '字节');
      } else {
        console.error('警告: 图片保存后检查失败，文件不存在:', fullImagePath);
      }
    } else if (req.imageUrl) {
      // 处理图片URL的情况
      console.log('设置图片URL:', req.imageUrl);
      updateData.imageUrl = req.imageUrl;
    }
    
    // 如果上传了乐谱文件，更新sheetMusicPath
    if (req.sheetMusicFile) {
      // 如果之前有乐谱文件，删除它
      if (song.sheetMusicPath) {
        const oldSheetMusicPath = path.join(__dirname, song.sheetMusicPath);
        if (fs.existsSync(oldSheetMusicPath)) {
          try {
            fs.unlinkSync(oldSheetMusicPath);
            console.log('旧乐谱文件已删除:', oldSheetMusicPath);
          } catch (err) {
            console.error('删除旧乐谱文件失败:', err);
          }
        } else {
          console.warn('旧乐谱文件不存在，无需删除:', oldSheetMusicPath);
        }
      }
      
      const sheetMusicPath = `sheet-music/${req.sheetMusicFile.filename}`;
      console.log('设置新的乐谱文件路径:', sheetMusicPath);
      updateData.sheetMusicPath = sheetMusicPath;
      
      // 验证乐谱文件是否成功保存
      const fullSheetMusicPath = path.join(__dirname, sheetMusicPath);
      if (fs.existsSync(fullSheetMusicPath)) {
        console.log('乐谱文件成功保存到:', fullSheetMusicPath);
        console.log('乐谱文件大小:', fs.statSync(fullSheetMusicPath).size, '字节');
      } else {
        console.error('警告: 乐谱文件保存后检查失败，文件不存在:', fullSheetMusicPath);
      }
    }
    
    // 如果上传了乐谱预览图文件，更新sheetMusicPreviewPath
    if (req.sheetMusicPreviewFile) {
      // 如果之前有乐谱预览图文件，删除它
      if (song.sheetMusicPreviewPath) {
        const oldPreviewPath = path.join(__dirname, song.sheetMusicPreviewPath);
        if (fs.existsSync(oldPreviewPath)) {
          try {
            fs.unlinkSync(oldPreviewPath);
            console.log('旧乐谱预览图文件已删除:', oldPreviewPath);
          } catch (err) {
            console.error('删除旧乐谱预览图文件失败:', err);
          }
        } else {
          console.warn('旧乐谱预览图文件不存在，无需删除:', oldPreviewPath);
        }
      }
      
      const previewPath = `sheet-music/${req.sheetMusicPreviewFile.filename}`;
      console.log('设置新的乐谱预览图路径:', previewPath);
      updateData.sheetMusicPreviewPath = previewPath;
      
      // 验证乐谱预览图文件是否成功保存
      const fullPreviewPath = path.join(__dirname, previewPath);
      if (fs.existsSync(fullPreviewPath)) {
        console.log('乐谱预览图文件成功保存到:', fullPreviewPath);
        console.log('乐谱预览图文件大小:', fs.statSync(fullPreviewPath).size, '字节');
      } else {
        console.error('警告: 乐谱预览图文件保存后检查失败，文件不存在:', fullPreviewPath);
      }
    }
    
    // 更新曲目信息
    console.log('准备更新曲目记录...');
    await song.update(updateData);
    console.log('曲目更新成功，ID:', song.id);
    
    res.json({ success: true, data: song });
  } catch (error) {
    console.error('更新曲目错误:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ success: false, message: '更新曲目失败', error: error.message });
  }
});

// 删除曲目API（管理员）
app.delete('/api/admin/songs/:id', authMiddleware, async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: '曲目不存在' });
    }
    
    // 删除相关文件：HTML文件、图片文件、乐谱文件、乐谱预览图文件
    const filesToDelete = [
      song.htmlFilePath, 
      song.imageUrl, 
      song.sheetMusicPath, 
      song.sheetMusicPreviewPath
    ];
    
    // 遍历并删除所有文件
    for (const filePath of filesToDelete) {
      if (filePath && filePath !== 'https://via.placeholder.com/300x300?text=音乐') {
        const fullFilePath = path.join(__dirname, filePath);
        if (fs.existsSync(fullFilePath)) {
          try {
            fs.unlinkSync(fullFilePath);
            console.log('文件已删除:', fullFilePath);
          } catch (err) {
            console.error('删除文件失败:', fullFilePath, '错误:', err);
            // 即使删除文件失败，也继续删除曲目记录
          }
        } else {
          console.warn('文件不存在，无需删除:', fullFilePath);
        }
      }
    }
    
    await song.destroy();
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除曲目错误:', error);
    res.status(500).json({ success: false, message: '删除曲目失败' });
  }
});

// 获取单个曲目API（普通用户）
app.get('/api/songs/:id', async (req, res) => {
  try {
    const song = await Song.findByPk(req.params.id);
    if (!song) {
      return res.status(404).json({ success: false, message: '曲目不存在' });
    }
    
    // 增加浏览次数
    song.views += 1;
    await song.save();
    
    res.json({ success: true, data: song });
  } catch (error) {
    console.error('获取曲目详情错误:', error);
    res.status(500).json({ success: false, message: '获取曲目失败' });
  }
});

// 个人中心相关API

// 用户注册API
app.post('/api/user/register', async (req, res) => {
  try {
    console.log('收到用户注册请求:', req.body);
    
    const { username, password, name } = req.body;
    
    // 验证必填字段
    if (!username || !password || !name) {
      console.log('注册失败: 用户名、密码和姓名不能为空');
      return res.status(400).json({ success: false, message: '用户名、密码和姓名不能为空' });
    }
    
    // 验证用户名长度
    if (username.length < 3 || username.length > 20) {
      console.log('注册失败: 用户名长度必须在3-20个字符之间');
      return res.status(400).json({ success: false, message: '用户名长度必须在3-20个字符之间' });
    }
    
    // 验证密码强度
    if (password.length < 6) {
      console.log('注册失败: 密码长度不能少于6个字符');
      return res.status(400).json({ success: false, message: '密码长度不能少于6个字符' });
    }
    
    // 检查用户名是否已存在
    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      console.log(`注册失败: 用户名 ${username} 已被使用`);
      return res.status(400).json({ success: false, message: '用户名已被使用' });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 创建新用户
    const newUser = await User.create({
      username,
      password: hashedPassword,
      name,
      // 其他字段使用默认值
    });
    
    console.log(`用户注册成功: 用户ID=${newUser.id}, 用户名=${newUser.username}`);
    
    // 为新用户创建通知设置
    await NotificationSetting.create({
      userId: newUser.id,
      pushEnabled: true,
      emailEnabled: true,
      practiceReminder: true,
      newContentAlert: true,
      examInfo: true,
      frequency: 'daily'
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        avatar: newUser.avatar
      }
    });
  } catch (error) {
    console.error('用户注册错误:', error);
    res.status(500).json({ success: false, message: '注册失败', error: error.message });
  }
});

// 用户登录API
app.post('/api/user/login', async (req, res) => {
  try {
    console.log('收到用户登录请求:', req.body);
    
    const { username, password } = req.body;
    
    // 验证必填字段
    if (!username || !password) {
      console.log('登录失败: 用户名或密码不能为空');
      return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
    }
    
    // 检查用户是否存在
    const user = await User.findOne({ where: { username } });
    if (!user) {
      console.log(`登录失败: 未找到用户 ${username}`);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log(`登录失败: 用户 ${username} 密码错误`);
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }
    
    // 生成JWT令牌
    const token = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '24h' });
    
    console.log(`登录成功: 用户 ${username} 已登录`);
    
    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        role: user.role
      }
    });
  } catch (error) {
    console.error('用户登录错误:', error);
    res.status(500).json({ success: false, message: '登录失败', error: error.message });
  }
});

// 用户退出登录API
app.post('/api/user/logout', userAuthMiddleware, async (req, res) => {
  try {
    console.log('收到用户退出登录请求，用户ID:', req.userId);
    // 在实际应用中，这里可以实现token黑名单等功能
    // 由于JWT是无状态的，前端删除token即可实现退出效果
    res.json({
      success: true,
      message: '退出登录成功'
    });
  } catch (error) {
    console.error('用户退出登录错误:', error);
    res.status(500).json({ success: false, message: '退出登录失败', error: error.message });
  }
});

// 获取用户信息
app.get('/api/user/profile', userAuthMiddleware, async (req, res) => {
  try {
    // 使用认证中间件提供的用户ID
    const userId = req.userId;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: '用户未找到' });
    }
    res.json(user);
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新用户信息
app.put('/api/user/profile', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: '用户未找到' });
    }
    
    await user.update(req.body);
    res.json(user);
  } catch (error) {
    console.error('更新用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取学习统计
app.get('/api/user/learning-stats', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: '用户未找到' });
    }
    
    // 获取时间范围参数，默认为周
    const timeRange = req.query.timeRange || 'week';
    
    // 根据时间范围生成不同的模拟数据
    let trendData = [];
    let totalHours = 0;
    let totalSongs = 0;
    let totalPractices = 0;
    let totalCompletion = 0;
    let averageCompletion = 0;
    
    if (timeRange === 'day') {
      // 日统计
      trendData = [
        { date: '08:00', hours: 0.5, songs: 1, completion: 90 },
        { date: '10:00', hours: 0.3, songs: 1, completion: 75 },
        { date: '14:00', hours: 0.7, songs: 2, completion: 85 },
        { date: '18:00', hours: 0.5, songs: 1, completion: 80 },
        { date: '20:00', hours: 1.0, songs: 2, completion: 95 }
      ];
      totalHours = 3.0;
      totalSongs = 7;
      totalPractices = 5;
      totalCompletion = 425;
      averageCompletion = Math.round(totalCompletion / trendData.length);
    } else if (timeRange === 'week') {
      // 周统计
      trendData = [
        { date: '周一', hours: 1.5, songs: 3, completion: 80 },
        { date: '周二', hours: 2.0, songs: 4, completion: 75 },
        { date: '周三', hours: 1.0, songs: 2, completion: 60 },
        { date: '周四', hours: 2.5, songs: 5, completion: 90 },
        { date: '周五', hours: 3.0, songs: 6, completion: 95 },
        { date: '周六', hours: 1.5, songs: 3, completion: 85 },
        { date: '周日', hours: 0.5, songs: 1, completion: 40 }
      ];
      totalHours = 12.0;
      totalSongs = 24;
      totalPractices = 32;
      totalCompletion = 525;
      averageCompletion = Math.round(totalCompletion / trendData.length);
    } else if (timeRange === 'month') {
      // 月统计
      trendData = [
        { date: '第1周', hours: 10.5, songs: 20, completion: 75 },
        { date: '第2周', hours: 12.0, songs: 22, completion: 78 },
        { date: '第3周', hours: 8.5, songs: 18, completion: 70 },
        { date: '第4周', hours: 15.0, songs: 26, completion: 82 }
      ];
      totalHours = 46.0;
      totalSongs = 86;
      totalPractices = 112;
      totalCompletion = 305;
      averageCompletion = Math.round(totalCompletion / trendData.length);
    } else if (timeRange === 'semester') {
      // 学期统计
      trendData = [
        { date: '1月', hours: 45, songs: 85, completion: 68 },
        { date: '2月', hours: 52, songs: 92, completion: 72 },
        { date: '3月', hours: 48, songs: 88, completion: 70 },
        { date: '4月', hours: 60, songs: 105, completion: 75 },
        { date: '5月', hours: 55, songs: 98, completion: 73 },
        { date: '6月', hours: 58, songs: 102, completion: 76 }
      ];
      totalHours = 318;
      totalSongs = 570;
      totalPractices = 685;
      totalCompletion = 434;
      averageCompletion = Math.round(totalCompletion / trendData.length);
    }
    
    res.json({
      totalHours,
      totalSongs,
      totalPractices,
      averageCompletion,
      trendData
    });
  } catch (error) {
    console.error('获取学习统计失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取最近学习记录
app.get('/api/user/recent-learning', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    // 模拟学习记录数据
    const records = [
      {
        id: 1,
        title: '美丽的草原我的家',
        artist: '德德玛',
        description: '女中音经典曲目',
        coverImage: 'https://picsum.photos/id/1025/80/80',
        duration: 30,
        progress: 85,
        status: 'learning',
        date: new Date().toISOString()
      },
      {
        id: 2,
        title: '我和我的祖国',
        artist: '李谷一',
        description: '经典爱国歌曲',
        coverImage: 'https://picsum.photos/id/1039/80/80',
        duration: 20,
        progress: 45,
        status: 'learning',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 3,
        title: '在那遥远的地方',
        artist: '王洛宾',
        description: '民歌经典',
        coverImage: 'https://picsum.photos/id/1040/80/80',
        duration: 0,
        progress: 0,
        status: 'planned',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 4,
        title: '我爱你中国',
        artist: '叶佩英',
        description: '经典爱国歌曲',
        coverImage: 'https://picsum.photos/id/1041/80/80',
        duration: 45,
        progress: 100,
        status: 'completed',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // 如果数据库中有真实记录，优先使用真实记录
    try {
      const dbRecords = await LearningRecord.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit: 10
      });
      
      if (dbRecords.length > 0) {
        res.json(dbRecords);
        return;
      }
    } catch (dbError) {
      console.warn('数据库查询失败，使用模拟数据:', dbError.message);
    }
    
    // 返回模拟数据
    res.json(records);
  } catch (error) {
    console.error('获取学习记录失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取浏览历史
app.get('/api/user/browsing-history', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const history = await BrowsingHistory.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 20
    });
    res.json(history);
  } catch (error) {
    console.error('获取浏览历史失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户收藏
app.get('/api/user/favorites', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    console.log(`获取用户收藏: userId=${userId}`);
    
    // 移除 Song 关联查询，因为 UserFavorite 和 Song 模型没有建立关联
    const favorites = await UserFavorite.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
      // 移除: include: [{ model: Song }]
    });
    
    console.log(`查询到的收藏数量: ${favorites.length}`);
    res.json(favorites);
  } catch (error) {
    console.error('获取收藏失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加/移除收藏 - 增强版带详细日志
app.post('/api/user/favorite', userAuthMiddleware, async (req, res) => {
  try {
    // 添加详细的请求日志
    console.log('====================================');
    console.log('收到收藏操作请求:');
    console.log('请求方法:', req.method);
    console.log('请求路径:', req.path);
    console.log('请求参数:', req.body);
    console.log('请求头:', req.headers);
    
    const userId = req.userId;
    const { songId, isFavorite } = req.body;
    
    console.log(`用户ID: ${userId}, 歌曲ID: ${songId}, 操作类型: ${isFavorite ? '添加收藏' : '取消收藏'}`);
    
    if (!songId) {
      console.error('缺少歌曲ID');
      return res.status(400).json({ message: '缺少歌曲ID' });
    }
    
    // 检查歌曲是否存在
    console.log(`检查歌曲是否存在: songId=${songId}`);
    const song = await Song.findByPk(songId);
    if (!song) {
      console.error(`歌曲不存在: songId=${songId}`);
      return res.status(404).json({ message: '歌曲不存在' });
    }
    console.log(`歌曲存在: songId=${songId}, 歌曲名称: ${song.name || '未知'}`);
    
    // 检查是否已收藏
    console.log(`检查是否已收藏: userId=${userId}, songId=${songId}`);
    const existingFavorite = await UserFavorite.findOne({
      where: { userId, songId }
    });
    console.log(`当前收藏状态: ${!!existingFavorite}`);
    
    if (isFavorite) {
      // 添加收藏
      if (!existingFavorite) {
        console.log(`添加收藏: userId=${userId}, songId=${songId}`);
        await UserFavorite.create({
          userId,
          songId,
          status: '计划学习',
          progress: 0
        });
        console.log(`收藏成功: userId=${userId}, songId=${songId}`);
      } else {
        console.log(`歌曲已收藏，无需重复添加: userId=${userId}, songId=${songId}`);
      }
      res.json({ success: true, message: '收藏成功' });
    } else {
      // 取消收藏
      if (existingFavorite) {
        console.log(`取消收藏: userId=${userId}, songId=${songId}`);
        await existingFavorite.destroy();
        console.log(`取消收藏成功: userId=${userId}, songId=${songId}`);
      } else {
        console.log(`歌曲未收藏，无需取消: userId=${userId}, songId=${songId}`);
      }
      res.json({ success: true, message: '取消收藏成功' });
    }
  } catch (error) {
    console.error('处理收藏失败:', error);
    console.error('错误堆栈:', error.stack);
    res.status(500).json({ message: '服务器错误' });
  } finally {
    console.log('收藏操作请求处理完成');
    console.log('====================================');
  }
});

// 检查歌曲是否已收藏
app.get('/api/user/favorite/:songId', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const songId = req.params.songId;
    
    console.log(`检查歌曲是否已收藏: userId=${userId}, songId=${songId}`);
    
    const favorite = await UserFavorite.findOne({
      where: { userId, songId }
    });
    
    const isFavorite = !!favorite;
    console.log(`收藏状态检查结果: isFavorite=${isFavorite}`);
    
    res.json({ isFavorite });
  } catch (error) {
    console.error('检查收藏状态失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户笔记
app.get('/api/user/notes', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const notes = await Note.findAll({
      where: { userId },
      order: [['updatedAt', 'DESC']]
    });
    res.json(notes);
  } catch (error) {
    console.error('获取笔记失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 添加笔记
app.post('/api/user/notes', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const note = await Note.create({
      userId,
      ...req.body
    });
    res.status(201).json(note);
  } catch (error) {
    console.error('添加笔记失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取通知设置
app.get('/api/user/notification-settings', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const settings = await NotificationSetting.findOne({
      where: { userId }
    });
    res.json(settings);
  } catch (error) {
    console.error('获取通知设置失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新通知设置
app.put('/api/user/notification-settings', userAuthMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    let settings = await NotificationSetting.findOne({
      where: { userId }
    });
    
    if (!settings) {
      settings = await NotificationSetting.create({
        userId,
        ...req.body
      });
    } else {
      await settings.update(req.body);
    }
    
    res.json(settings);
  } catch (error) {
    console.error('更新通知设置失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 启动服务器
async function startServer() {
  // 初始化数据库
  const dbInitialized = await initializeDatabase();
  
  // 无论数据库是否初始化成功，都启动服务器
  app.listen(PORT, () => {
    if (databaseAvailable) {
      console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
      console.log(`✅ 管理员登录信息: 用户名=admin, 密码=admin123`);
      console.log(`✅ 请使用浏览器打开前端.html文件开始使用系统`);
    } else {
      console.log(`⚠️  服务器运行在 http://localhost:${PORT}（数据库不可用）`);
      console.log(`⚠️  请检查并修复MySQL连接配置以使用完整功能`);
    }
  });
}

// 启动服务器
startServer();