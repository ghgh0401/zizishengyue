// 性能监控中间件
const performanceMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalJson = res.json;
  
  // 重写res.json方法以添加性能信息
  res.json = function(data) {
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    // 记录API调用性能
    console.log(`[PERFORMANCE] ${req.path} - 耗时: ${executionTime}ms, 参数:`, req.query);
    
    // 如果执行时间超过500ms，记录警告
    if (executionTime > 500) {
      console.warn(`[PERFORMANCE WARNING] ${req.path} - 执行时间过长: ${executionTime}ms`);
    }
    
    // 调用原始的res.json方法
    return originalJson.call(this, data);
  };
  
  next();
};

// API请求超时处理函数
exports.withTimeout = async (promise, timeout = 5000) => {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`操作超时，已超过${timeout}ms`));
    }, timeout);
  });
  
  try {
    // 使用Promise.race来实现超时控制
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId); // 清除超时定时器
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// 简单的内存缓存实现
class SimpleCache {
  constructor(defaultTtl = 60000) {
    this.cache = new Map();
    this.defaultTtl = defaultTtl; // 默认缓存时间1分钟
  }
  
  set(key, value, ttl = this.defaultTtl) {
    const expiry = Date.now() + ttl;
    this.cache.set(key, { value, expiry });
    
    // 清理过期缓存（可选）
    this.cleanup();
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // 检查是否过期
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  delete(key) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // 清理过期缓存
  cleanup() {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// 导出中间件和工具函数
exports.performanceMiddleware = performanceMiddleware;
exports.SimpleCache = SimpleCache;