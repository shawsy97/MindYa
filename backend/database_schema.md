# Mindya 后台管理系统数据库设计

## 数据库选择：MongoDB

选用MongoDB的原因：
- 灵活的数据结构，便于存储心理测评结果等复杂数据
- 高效的查询性能
- 易于扩展
- 适合心理健康数据分析

## 数据表设计

### 1. Users 表（普通用户表）
```javascript
{
  _id: ObjectId,
  username: String,           // 用户名
  password: String,           // 加密后的密码
  role: String,               // 用户角色 ('student', 'teacher', 'admin')
  createdAt: Date,            // 创建时间
  lastLoginAt: Date,          // 最后登录时间
  isActive: Boolean           // 是否激活
}
```

### 2. Profiles 表（用户档案表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 关联用户ID
  username: String,           // 用户名
  gender: String,             // 性别
  age: String,                // 年龄
  grade: String,              // 年级
  scaleResult: String,        // 量表结果
  modelResult: String,        // AI模型结果
  gameResult: String,         // 游戏结果
  createdAt: Date,            // 创建时间
  updatedAt: Date             // 更新时间
}
```

### 3. Scales 表（量表结果表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 用户ID
  username: String,           // 用户名
  scaleId: String,            // 量表ID
  scaleName: String,          // 量表名称
  answers: Array,             // 作答结果数组
  totalScore: Number,         // 总分
  resultAnalysis: String,     // 结果分析
  submittedAt: Date,          // 提交时间
  riskLevel: String           // 风险等级 ('low', 'medium', 'high')
}
```

### 4. Conversations 表（对话记录表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 用户ID
  username: String,           // 用户名
  sessionId: String,          // 会话ID
  messages: Array,            // 消息数组
  preview: String,            // 对话预览
  updatedAt: Date,            // 更新时间
}
```

### 5. Tasks 表（任务记录表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 用户ID
  username: String,           // 用户名
  taskId: String,             // 任务ID
  taskName: String,           // 任务名称
  completionTime: Number,     // 完成时间（秒）
  performance: Object,        // 表现详情
  completedAt: Date           // 完成时间
}
```

### 6. Admins 表（管理员表）
```javascript
{
  _id: ObjectId,
  username: String,           // 管理员用户名
  password: String,           // 加密后的密码
  role: String,               // 角色 ('teacher', 'admin', 'super_admin')
  permissions: Array,         // 权限列表
  school: String,             // 所属学校
  department: String,         // 所属部门
  createdAt: Date,            // 创建时间
  lastLoginAt: Date           // 最后登录时间
}
```

### 7. Analytics 表（分析数据表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 用户ID
  username: String,           // 用户名
  dataType: String,           // 数据类型 ('scale', 'conversation', 'task')
  analysisData: Object,       // 分析数据
  createdAt: Date,            // 创建时间
  riskFlag: Boolean           // 风险标识
}
```

### 8. Logs 表（系统日志表）
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // 用户ID（如果是普通用户操作）
  adminId: ObjectId,          // 管理员ID（如果是管理员操作）
  action: String,             // 操作类型
  detail: Object,             // 操作详情
  ip: String,                 // IP地址
  userAgent: String,          // 用户代理
  createdAt: Date             // 创建时间
}
```