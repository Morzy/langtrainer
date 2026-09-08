# LanTrainer

每日外语练习工具，帮助语言学习者通过**限时朗读**和**逐行跟打**两种模式提升口语与打字能力。系统根据用户设置的练习场景每天推送一篇定制对话文章，练习后自动评分。

---

## 功能

### 口语练习
- 对话式场景文章，扮演其中一个角色
- 浏览器麦克风实时转录（Web Speech API）
- 评分指标：完成率 / 流利度（WPM）/ 准确率 / 综合分

### 打字练习
- 逐行跟打全文，当前行完全正确才自动跳到下一行
- 实时逐字高亮对比（正确绿 / 错误红）
- 低难度模式：自动显示非英文字符的键盘输入方式（法语、西班牙语、德语等）

### 每日文章
- 每用户每天生成一篇，幂等（重复访问不重复生成）
- 根据用户设置的场景、难度、目标语言定制内容
- 由 DeepSeek（阿里云）生成，Zod 校验结构

### 个性化设置
- 练习场景：程序员办公室 / 商务会议 / 日常购物 / 旅行 / 医疗 / 学术
- 难度：初级 / 中级 / 高级
- 每日目标时长：5 / 10 / 15 分钟
- 目标外语：英语（MVP，可扩展）

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 15 (App Router) |
| 样式 | Tailwind CSS + shadcn/ui |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | NextAuth.js v5 |
| 语音识别 | Web Speech API |
| 文章生成 | DeepSeek via 阿里云 MaaS |
| 部署 | Vercel + Supabase |

---

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL

### 安装

```bash
pnpm install
```

### 环境变量

复制并填写：

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lantrainer
NEXTAUTH_SECRET=your-secret
NEXTAUTH_URL=http://localhost:3000
ALIYUN_API_KEY=your-aliyun-api-key
```

### 数据库初始化

```bash
npx prisma migrate dev
```

### 启动开发服务器

```bash
pnpm dev
```

访问 [http://localhost:3000](http://localhost:3000)

---

## 项目结构

```
app/
├── (app)/
│   ├── practice/
│   │   ├── page.tsx                  # 练习主页（口语 / 打字模式切换）
│   │   ├── components/
│   │   │   ├── TypingPractice.tsx    # 打字练习组件
│   │   │   └── PhoneticHints.tsx     # 键位辅助提示组件
│   │   └── result/                   # 评分结果页
│   ├── settings/                     # 个人设置页
│   └── history/                      # 练习历史页
├── api/
│   ├── daily-article/
│   │   ├── route.ts                  # GET（只读）/ POST（生成）
│   │   └── lib/article-generator.ts # DeepSeek 文章生成逻辑
│   └── practice/
│       ├── start/route.ts            # 创建练习会话
│       └── submit/route.ts           # 提交并评分
prisma/
└── schema.prisma                     # 数据库模型
```

---

## 验证流程

1. `npx prisma migrate dev` — 确认数据库 schema 无误
2. 访问 `/settings` 配置场景和难度
3. 访问 `/practice` — 页面自动检查今日文章，若无则显示「生成今日文章」按钮
4. 切换「打字练习」Tab，完成一次逐行跟打并提交评分
5. 在 Chrome 中完成一次完整口语练习（录音 → 提交 → 结果页）
6. 访问 `/history` 确认打卡记录正常显示
