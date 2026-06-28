# Vivido

一款温暖、私密的本地日记应用，支持图文混排、标签管理、数据备份与回顾分析。

## 功能特性

- **日记编辑**：支持标题、正文、日期选择，图文混排编辑器
- **媒体附件**：支持多张图片和视频，长按排序，自动保存草稿
- **标签系统**：可为日记添加多个标签，支持标签颜色区分
- **时间轴浏览**：主页以时间轴展示日记卡片，支持分页加载
- **回顾岛 (Discovery)**：搜索、标签筛选、活动热力图、词云分析
- **数据备份**：导出 ZIP 格式备份（含完整日记与媒体文件），支持导入恢复
- **本地存储**：所有数据存储在设备本地 SQLite，无需网络
- **温暖复古 UI**：暖色调配色 + 三款中文字体，营造书写氛围

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Expo SDK 55 + React Native 0.83 |
| 导航 | React Navigation 7 (Native Stack) |
| 数据库 | expo-sqlite (SQLite) |
| 媒体 | expo-image-picker, expo-image, expo-video, expo-audio |
| 文件系统 | expo-file-system |
| 语言 | TypeScript (Strict Mode) |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（需 expo-dev-client 或 Expo Go）
npm start

# 强制 LAN 模式
npm run start:lan

# 启动 Android 开发构建
npm run android

# 启动 iOS 开发构建
npm run ios
```

## 项目结构

```
Vivido/
├── App.tsx                  # 根组件：字体加载、数据库初始化、导航
├── src/
│   ├── screens/             # 页面组件
│   │   ├── HomeScreen.tsx
│   │   ├── EditorScreen.tsx
│   │   ├── DetailScreen.tsx
│   │   ├── DiscoveryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── components/          # 可复用组件
│   │   ├── TimelineCard.tsx       # 时间轴日记卡片
│   │   ├── DiaryContent.tsx       # 正文渲染（中文段落缩进）
│   │   ├── MediaPicker.tsx        # 媒体选择条（支持排序）
│   │   ├── MediaViewer.tsx        # 详情页媒体网格
│   │   ├── FullScreenGallery.tsx  # 全屏媒体浏览（分页）
│   │   ├── VideoPoster.tsx        # 视频缩略图（按需生成）
│   │   ├── TagEditor.tsx          # 标签编辑/选择
│   │   ├── TagChip.tsx            # 标签胶囊
│   │   ├── FilterChips.tsx        # 时间筛选标签
│   │   ├── ActivityHeatmap.tsx    # 活动热力图
│   │   ├── WordCloud.tsx          # 词云组件
│   │   ├── DatePickerModal.tsx    # 滚轮日期选择器
│   │   ├── StyledDialog.tsx       # 统一对话框
│   │   └── Branding.tsx           # 品牌水印/光效
│   ├── services/            # 业务服务层
│   │   ├── database.ts      # SQLite 操作
│   │   ├── storage.ts       # 媒体文件管理
│   │   └── backup.ts        # 备份导出/导入
│   ├── hooks/               # 自定义 Hooks
│   ├── theme/               # 主题（字体、颜色）
│   ├── utils/               # 工具函数
│   └── types/               # TypeScript 类型定义
├── assets/                  # 字体、图标、启动图
├── android/                 # Android 原生项目（prebuild 生成）
├── ios/                     # iOS 原生项目（prebuild 生成）
├── app.json                 # Expo 配置
├── package.json
└── tsconfig.json
```

## 文档索引

- [ARCHITECTURE.md](ARCHITECTURE.md) - 系统架构与数据流
- [DEVELOPMENT.md](DEVELOPMENT.md) - 开发环境配置与调试指南
- [API.md](API.md) - 服务层 API 文档
- [DEPLOYMENT.md](DEPLOYMENT.md) - 构建与发布指南
- [CONTRIBUTING.md](CONTRIBUTING.md) - 开发规范与贡献指南

