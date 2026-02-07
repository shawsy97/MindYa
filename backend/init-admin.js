require('dotenv').config(); // 加载环境变量
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const Admin = require('./models/Admin');

// 默认管理员账户信息
const defaultAdmin = {
  username: 'admin',
  password: 'admin123', // 实际部署时应使用强密码
  role: 'admin',
  permissions: ['read_users', 'read_scales', 'read_tasks', 'manage_risks'],
  school: '华东师范大学',
  department: '心理健康中心'
};

async function createAdmin() {
  try {
    // 连接数据库
    await connectDB();
    
    // 检查管理员是否已存在
    const existingAdmin = await Admin.findOne({ username: defaultAdmin.username });
    
    if (existingAdmin) {
      console.log(`管理员账户 "${defaultAdmin.username}" 已存在`);
      console.log('如需重置密码，请手动删除数据库中的管理员记录后重新运行此脚本');
      process.exit(0);
    }
    
    // 加密密码
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(defaultAdmin.password, saltRounds);
    
    // 创建管理员账户
    const admin = new Admin({
      ...defaultAdmin,
      password: hashedPassword
    });
    
    await admin.save();
    
    console.log(`管理员账户 "${defaultAdmin.username}" 创建成功！`);
    console.log('用户名:', defaultAdmin.username);
    console.log('密码:', defaultAdmin.password);
    console.log('角色:', defaultAdmin.role);
    
    process.exit(0);
  } catch (error) {
    console.error('创建管理员账户时发生错误:', error);
    process.exit(1);
  }
}

// 运行脚本
if (require.main === module) {
  createAdmin();
}

module.exports = createAdmin;