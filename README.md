# 智能排班系统 v2

医院IT硬件外包服务团队智能排班管理系统。

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS v4
- **后端**: Next.js App Router API Routes
- **数据库**: PostgreSQL（远程）
- **认证**: JWT（jose）+ bcrypt 密码加密
- **查询**: 原生 SQL（pg 驱动，无 ORM）

## 功能特性

### 🔐 用户认证与权限
- JWT Token 认证，Cookie 自动管理
- 角色权限控制：管理员（admin）/ 普通用户（viewer）
- 仅管理员可生成排班、管理请假

### 📅 排班日历
- 月度日历视图，直观显示每天排班
- 支持月份切换
- 周末/假日/当天高亮标记
- 点击日期查看详情弹窗

### 🤖 智能排班算法
- **Leader 错开**: 邓高明（主管）和陈能隆（组长）不同一天上班
- **白班覆盖**: 工作日白班 ≥ 3 人，其中至少 1 名 leader
- **午间备班**: 从白班人员中选 1 人连续值班（08:00-15:00）
- **周末三班倒**: 每班 1 人，覆盖 24 小时
- **月工时上限**: 210 小时（标准 174h + 加班 36h）
- **公平分配**: 按总工时排序，自动均衡工作量
- **连续工作限制**: 最多连续 5 天，夜班后强制休息 1 天

### 🏥 请假管理
- 管理员可添加/删除请假记录
- 排班算法自动跳过请假人员
- 日历上标记请假信息

### 👥 用户管理
- 管理员可查看所有用户
- 管理员可重置用户密码

## 班次时间

### 工作日（周一至周五）
| 班次 | 时间 | 工时 |
|---|---|---|
| 白班 | 08:00-12:00 + 15:00-18:00 | 7h |
| 午间备班 | 08:00-15:00（连续） | 7h |
| 晚班 | 18:00-01:00 | 7h |
| 夜班 | 01:00-08:00 | 7h |

### 周末/节假日
| 班次 | 时间 | 工时 |
|---|---|---|
| 白班 | 08:00-16:00 | 8h |
| 晚班 | 16:00-00:00 | 8h |
| 夜班 | 00:00-08:00 | 8h |

## 快速开始

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量
复制 `.env.local` 并配置数据库连接：
```env
POSTGRES_HOST=your_host
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DATABASE=scheduling-system
JWT_SECRET=your_jwt_secret
```

### 3. 初始化数据库
```bash
npm run db:init
```

### 4. 启动开发服务器
```bash
npm run dev
```

访问 http://localhost:3000

### 5. 构建生产版本
```bash
npm run build
npm start
```

## 默认账号

| 用户名 | 密码 | 姓名 | 角色 |
|---|---|---|---|
| dgm | 123456 | 邓高明 | 管理员 |
| cnl | 123456 | 陈能隆 | 普通用户 |
| pht | 123456 | 庞涵天 | 普通用户 |
| zyf | 123456 | 张永芳 | 普通用户 |
| nbs | 123456 | 农帮善 | 普通用户 |
| wgn | 123456 | 王国楠 | 普通用户 |
| nyj | 123456 | 乃业隽 | 普通用户 |

> ⚠️ 生产环境请立即修改默认密码！

## 项目结构

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts    # 登录接口
│   │   │   └── me/route.ts       # 获取当前用户
│   │   ├── schedule/route.ts     # 排班 CRUD
│   │   ├── leave/route.ts        # 请假管理
│   │   └── users/route.ts        # 用户管理
│   ├── login/page.tsx            # 登录页面
│   ├── layout.tsx                # 根布局
│   ├── page.tsx                  # 主页面
│   └── globals.css               # 全局样式
├── components/
│   ├── Calendar.tsx              # 排班日历
│   ├── Header.tsx                # 顶部导航
│   ├── GenerateButton.tsx        # 生成排班按钮
│   └── LeaveModal.tsx            # 请假弹窗
└── lib/
    ├── auth.ts                   # JWT + bcrypt 工具
    ├── db.ts                     # 数据库连接池
    ├── db-init.ts                # 数据库初始化脚本
    └── staff.ts                  # 团队成员 & 班次定义
```

## API 接口

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | /api/auth/login | 用户登录 | 公开 |
| GET | /api/auth/me | 获取当前用户 | 登录 |
| GET | /api/schedule?year=&month= | 查询排班 | 登录 |
| POST | /api/schedule | 生成排班 | 管理员 |
| GET | /api/leave?year=&month= | 查询请假 | 登录 |
| POST | /api/leave | 添加请假 | 管理员 |
| DELETE | /api/leave | 删除请假 | 管理员 |
| GET | /api/users | 用户列表 | 管理员 |
| PUT | /api/users | 修改密码 | 管理员 |

## License

MIT
