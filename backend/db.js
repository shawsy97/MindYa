const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // 从环境变量获取数据库连接字符串
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mindya';

    // 设置连接选项，解决超时问题
    const options = {
      serverSelectionTimeoutMS: 5000, // 服务器选择超时
      socketTimeoutMS: 45000, // 套接字超时
      maxPoolSize: 10,       // 维持最多10个连接
      minPoolSize: 2,        // 最少维持2个连接
      maxIdleTimeMS: 30000,  // 连接最大空闲时间
      connectTimeoutMS: 10000, // 连接超时时间
      heartbeatFrequencyMS: 10000, // 心跳频率
    };

    await mongoose.connect(mongoURI, options);
    
    console.log('MongoDB连接成功');
  } catch (err) {
    console.error('MongoDB连接失败:', err.message);
    
    // 输出提示信息，说明当前使用文件存储模式
    console.log('警告: 由于数据库连接失败，系统将以文件存储模式运行');
    console.log('这意味着数据将被存储在本地文件中，而非数据库');
    console.log('要使用数据库，请配置MONGODB_URI环境变量并确保MongoDB服务正在运行');
  }
};

module.exports = connectDB;