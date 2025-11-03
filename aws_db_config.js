 // AWS RDS 数据库连接配置文件
// 此文件提供了连接到 AWS 免费 RDS 数据库的配置选项
// 使用说明：将此文件中的配置应用到 server.js 中替换现有的 MySQL 连接配置

/**
 * AWS RDS 数据库配置对象
 * 根据您在 AWS 上创建的 RDS 实例信息进行修改
 */
const awsRdsConfig = {
  // 数据库名称
  database: 'music_library_db', 
  
  // AWS RDS 用户名
  username: 'your_rds_username', 
  
  // AWS RDS 密码
  password: 'your_rds_password', 
  
  // AWS RDS 终端节点（Endpoint）
  // 格式通常为：your-db-instance.xxxxxxxxxxxx.region.rds.amazonaws.com
  host: 'your-rds-endpoint', 
  
  // 数据库端口（MySQL 默认为 3306）
  port: 3306,
  
  // 连接池配置（可选，用于优化性能）
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  
  // SSL 配置（如果您的 RDS 实例需要 SSL 连接）
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // 仅在开发环境使用，生产环境应设为 true 并提供证书
    }
  }
};

/**
 * 创建 Sequelize 实例的辅助函数
 * @param {Object} config - 数据库配置对象
 * @returns {Object} 包含配置信息的对象
 */
function createSequelizeConfig(config) {
  return {
    database: config.database,
    username: config.username,
    password: config.password,
    host: config.host,
    port: config.port,
    dialect: 'mysql',
    define: {
      timestamps: false
    },
    logging: false, // 如需查看 SQL 日志，请改为 console.log
    pool: config.pool,
    dialectOptions: config.dialectOptions
  };
}

/**
 * 获取完整的 Sequelize 配置
 * @returns {Object} 完整的 Sequelize 配置对象
 */
exports.getAwsRdsSequelizeConfig = function() {
  return createSequelizeConfig(awsRdsConfig);
};

/**
 * 直接导出 AWS RDS 配置
 */
exports.awsRdsConfig = awsRdsConfig;

/**
 * AWS RDS 免费套餐说明
 * 
 * AWS 提供了 12 个月的免费 RDS 数据库套餐，包含：
 * - 750 小时的 db.t2.micro、db.t3.micro 或 db.t4g.micro 实例使用时间
 * - 20GB 通用型 (SSD) 存储
 * - 20GB 备份存储
 * 
 * 注意事项：
 * 1. 免费套餐仅适用于新 AWS 账户的前 12 个月
 * 2. 超过免费额度后将产生费用
 * 3. 建议定期监控您的 AWS 账单
 */
exports.freeTierInfo = {
  eligiblePeriod: '12个月',
  instanceType: 'db.t2.micro / db.t3.micro / db.t4g.micro',
  storage: '20GB 通用型 (SSD)',
  backupStorage: '20GB',
  monitoringTip: '定期检查 AWS 管理控制台中的账单和使用情况'
};

/**
 * 连接到 AWS RDS 的步骤摘要
 */
exports.connectionSteps = [
  '1. 在 AWS 管理控制台创建 RDS 实例（选择免费套餐）',
  '2. 配置安全组，开放数据库端口（通常是 3306）',
  '3. 记录 RDS 实例的终端节点、用户名和密码',
  '4. 修改此文件中的配置信息',
  '5. 在 server.js 中使用此配置替换现有的 MySQL 连接配置',
  '6. 确保您的 EC2 实例或应用服务器可以访问 RDS 实例的 VPC'
];

/**
 * 故障排除指南
 */
exports.troubleshooting = {
  cannotConnect: [
    '检查 RDS 实例的安全组是否允许您的 IP 或 EC2 安全组访问',
    '确认 RDS 实例的终端节点、用户名和密码是否正确',
    '验证 RDS 实例是否处于可用状态（不在维护期）',
    '检查 VPC 网络配置，确保路由表和网络 ACL 允许流量',
    '如果使用 SSL，确保 SSL 配置正确'
  ],
  slowConnection: [
    '考虑使用连接池优化连接性能',
    '检查 RDS 实例的 CPU 和内存使用率',
    '可能需要升级到更高规格的实例类型（超出免费套餐范围）'
  ]
};

// 导出默认配置
exports.default = awsRdsConfig;