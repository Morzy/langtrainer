# LanTrainer — 每日外语口语练习工具 项目文档

## Context

用户需要构建一个每日外语口语练习工具，帮助语言学习者通过限时朗读文章来提升口语能力。系统根据用户设置的练习方向（如"程序员办公英语"）每天推送一篇适合的文章，用户限时朗读后系统自动打分。

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 15 (App Router) |
| 样式 | Tailwind CSS + shadcn/ui |
| 数据库 | PostgreSQL |
| ORM | Prisma |
| 认证 | NextAuth.js v5 |
| 语音识别 | Web Speech API（浏览器原生）+ Whisper API（服务端备用） |
| 文章生成 | Claude API（基于用户场景动态生成） |
| 评分引擎 | 服务端：文本相似度 + 完成率计算 |
| 部署 | Vercel + Supabase PostgreSQL |

---

## 核心功能模块

### 1. 每日文章系统
- 每天为每个用户生成一篇对话文章（按用户练习方向定制）
- 文章长度可配置（初级 50词 / 中级 100词 / 高级 200词）
- 假设一个场景，需要五个人对话， 别的对话全部显示英语，只有自己的部分显示中文，然后用户点击旁边的对话案件，开始翻译自己的部分。
- 同一天多次访问返回同一篇（幂等）
- 文章语言：英语（MVP），后续可扩展

### 2. 限时口语练习
- 页面加载后显示文章，用户点击"开始"后计时器启动
- 浏览器调用麦克风，使用 Web Speech API 实时转录
- 计时结束自动提交，或用户手动结束
- 练习过程中显示已识别文字（实时反馈）

### 3. 评分系统
- 指标：
  - **完成率**（Word Coverage）：朗读的词汇覆盖原文百分比
  - **流利度**（Fluency）：单位时间词数 WPM
  - **准确率**（Accuracy）：识别文本 vs 原文的相似度（Levenshtein）
  - **综合分**：三项加权平均（0-100分）
- 评分结果附带高亮对比视图（正确词绿色 / 遗漏词红色）

### 4. 个性化设置
用户可在设置页配置：
- **练习场景**（多选，如："程序员办公室对话" / "商务会议" / "日常购物" / "旅行场景" / 自定义）
- **难度级别**（初级 / 中级 / 高级）
- **每日目标时长**（5 / 10 / 15 分钟）
- **目标外语**（英语 / 日语 / 法语 等）

### 5. 历史记录 & 进度
- 日历视图（打卡连续天数）
- 历史分数折线图
- 每日练习回顾（原文 + 识别文本对比）

---

## 数据库模型（PostgreSQL via Prisma）

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  name         String?
  password     String
  avatarUrl    String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  settings     UserSettings?
  assignments  DailyAssignment[]
  sessions     PracticeSession[]
}

model UserSettings {
  id                 String   @id @default(cuid())
  userId             String   @unique
  user               User     @relation(fields: [userId], references: [id])
  targetLanguage     String   @default("en")
  difficultyLevel    String   @default("intermediate")
  practiceScenarios  String[] // e.g. ["programmer-office", "business-meeting"]
  dailyGoalMinutes   Int      @default(10)
}

model Article {
  id          String   @id @default(cuid())
  title       String
  content     String
  language    String
  difficulty  String
  scenario    String
  wordCount   Int
  generatedAt DateTime @default(now())
  assignments DailyAssignment[]
  sessions    PracticeSession[]
}

model DailyAssignment {
  id           String   @id @default(cuid())
  userId       String
  articleId    String
  assignedDate DateTime @db.Date
  user         User     @relation(fields: [userId], references: [id])
  article      Article  @relation(fields: [articleId], references: [id])

  @@unique([userId, assignedDate])
}

model PracticeSession {
  id              String   @id @default(cuid())
  userId          String
  articleId       String
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  durationSeconds Int?
  transcribedText String?
  status          String   @default("in_progress") // in_progress | completed | abandoned
  user            User     @relation(fields: [userId], references: [id])
  article         Article  @relation(fields: [articleId], references: [id])
  score           Score?
}

model Score {
  id           String          @id @default(cuid())
  sessionId    String          @unique
  session      PracticeSession @relation(fields: [sessionId], references: [id])
  wordCoverage Float
  fluencyWpm   Int
  accuracy     Float
  totalScore   Int
  highlightData Json
}
```

---

## 页面结构（Next.js App Router）

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (app)/
│   ├── layout.tsx          -- 登录保护 + 导航栏
│   ├── page.tsx            -- 首页/今日练习入口
│   ├── practice/
│   │   ├── page.tsx        -- 今日文章 + 倒计时 + 录音
│   │   └── result/page.tsx -- 评分结果页
│   ├── history/
│   │   └── page.tsx        -- 练习历史 + 日历打卡
│   └── settings/
│       └── page.tsx        -- 个性化设置
└── api/
    ├── auth/[...nextauth]/route.ts
    ├── daily-article/route.ts      -- GET: 获取/生成今日文章
    ├── practice/
    │   ├── start/route.ts          -- POST: 开始练习会话
    │   └── submit/route.ts         -- POST: 提交识别文本 + 评分
    └── settings/route.ts           -- GET/PUT: 用户设置
```

---

## 关键流程

### 今日文章生成流程
```
GET /api/daily-article
  1. 查询 DailyAssignment WHERE userId + date=today
  2. 已存在 → 直接返回对应 Article
  3. 不存在 →
     a. 读取 UserSettings（scenario, difficulty, language）
     b. 调用 Claude API，prompt 包含场景和难度要求
     c. 存储 Article 记录
     d. 创建 DailyAssignment 记录
     e. 返回文章
```

### 口语提交 & 评分流程
```
POST /api/practice/submit { sessionId, transcribedText }
  1. 拉取 PracticeSession + 关联 Article
  2. 计算 wordCoverage（集合交集 / 原文词数）
  3. 计算 accuracy（normalized Levenshtein similarity）
  4. 计算 fluencyWpm（transcribed词数 / 用时分钟）
  5. totalScore = coverage*0.4 + accuracy*0.4 + fluency_normalized*0.2
  6. 生成 highlightData（逐词对比 JSON）
  7. 存储 Score 记录，更新 Session status='completed'
  8. 返回评分数据
```

---

## 项目目录结构

```
LanTrainer/
├── app/                    -- Next.js App Router
├── components/
│   ├── ui/                 -- shadcn/ui 基础组件
│   ├── practice/           -- 录音器、计时器、高亮对比
│   └── history/            -- 日历、折线图
├── lib/
│   ├── db.ts               -- Prisma client 单例
│   ├── scoring.ts          -- 评分算法
│   ├── article-generator.ts -- Claude API 调用
│   └── speech.ts           -- Web Speech API 封装
├── prisma/
│   └── schema.prisma
├── docs/
│   └── project.md          -- 本文档
├── public/
├── .env.local              -- DATABASE_URL, NEXTAUTH_SECRET, ANTHROPIC_API_KEY
├── package.json
└── next.config.ts
```

---

## 环境变量

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lantrainer
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```

---

## MVP 范围（第一阶段）

- [ ] 用户注册/登录（邮箱+密码）
- [ ] 个人设置（场景、难度选择）
- [ ] 每日文章生成（Claude API）
- [ ] 浏览器录音 + 实时转录（Web Speech API）
- [ ] 评分 + 结果页
- [ ] 练习历史列表

## 后续迭代

- 移动端适配 + PWA
- 支持更多语言（日/法/德）
- Whisper 服务端转录（Safari/Firefox 兼容）
- 发音细节反馈（音素级对比）
- 社交功能（排行榜、好友挑战）

---

## 验证方案

1. `npx prisma migrate dev` 验证数据库 schema 建立无误
2. 访问 `/settings` 配置场景后，访问 `/practice` 验证文章按场景生成
3. 在 Chrome 中完成一次完整练习流程（开始 → 朗读 → 提交 → 查看分数）
4. 访问 `/history` 验证打卡记录正常显示
5. 同一天再次访问 `/practice` 验证返回同一篇文章（幂等性）
