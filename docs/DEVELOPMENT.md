# 开发指南

## 环境要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 18 | 推荐 LTS 版本 |
| npm | >= 9 | 随 Node.js 自带 |
| Android Studio | 最新 | Android 本地构建需要 |
| Xcode | 14+ | iOS 本地构建需要（仅 macOS） |
| Java/JDK | 17 | Android Gradle 要求，可使用 Android Studio 内置 JDK |

## 安装步骤

```bash
# 克隆仓库
git clone <repo-url>
cd Vivido

# 安装依赖
npm install

# 生成原生项目（首次或 app.json 变更后）
npx expo prebuild
```

## 开发命令

```bash
# 启动 Expo 开发服务器（默认 dev-client 模式）
npm start

# 强制 LAN 模式（手机热点等场景）
npm run start:lan

# 使用隧道（跨网络访问）
npm run start:tunnel

# Android 本地构建（需模拟器或真机连接）
npm run android

# iOS 本地构建（仅 macOS）
npm run ios

# TypeScript 类型检查
npx tsc --noEmit
```

## Android 开发构建配置

本地 Android 构建需要正确配置 Gradle 环境：

1. **JDK 路径**：`android/gradle.properties` 中已配置：
   ```properties
   org.gradle.java.home=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
   ```

2. **Gradle 版本**：`android/gradle/wrapper/gradle-wrapper.properties`
   ```properties
   distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
   ```

3. **SDK 路径**：`android/local.properties`
   ```properties
   sdk.dir=/Users/<username>/Library/Android/sdk
   ```

4. **环境变量**（备用方案）：
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools
   ```

## 调试技巧

### Expo LAN 连接问题

当 PC 连接手机热点时，`npm start` 可能生成错误的 LAN IP。解决方案：
- 使用 `npm run start:lan` 强制 LAN 模式
- 或在 Expo Go 中手动输入 `exp://<PC_HOTSPOT_IP>:8081`
- 跨网络时使用 `npm run start:tunnel`

### Android TextInput 滚动问题

Android 的 `TextInput` 有内部滚动，可能导致嵌套滚动冲突。解决方案：
- 单行输入：`multiline={false}` + `numberOfLines={1}`
- 禁用内部滚动：`scrollEnabled={false}`
- 使用固定 `height` 替代 `minHeight`

### 数据库调试

SQLite 数据库文件位于设备沙盒：`/data/data/com.vivido.diary/files/SQLite/diary.db`

可通过 Android Studio 的 Device File Explorer 导出查看。

### 日志查看

```bash
# Android 日志
adb logcat -s ReactNative:V ReactNativeJS:V

# iOS 日志（ Simulator ）
xcrun simctl spawn booted log stream --level debug --predicate 'eventMessage contains "Vivido"'
```

## 项目结构约定

```
src/
├── screens/       # 页面级组件，对应导航路由
├── components/    # 可复用 UI 组件
├── services/      # 业务服务，直接操作原生能力
├── hooks/         # 自定义 React Hooks
├── theme/         # 设计 Token（颜色、字体）
├── utils/         # 纯函数工具
└── types/         # TypeScript 类型定义
```

### 文件命名

- 屏幕：`XxxScreen.tsx`
- 组件：`XxxComponent.tsx`（如 `TimelineCard.tsx`）
- 服务：`xxx.ts`（小写，如 `database.ts`）
- 工具：`xxx.ts`（小写，如 `uuid.ts`）
- 每个目录下的 `index.ts` 统一导出该目录模块

### 代码风格

- 使用单引号字符串
- 使用 2 空格缩进
- 组件使用 `React.FC` 显式标注
- 所有函数参数和返回值标注类型
- 优先使用 `const` 和箭头函数
- 避免在 JSX 中内联复杂逻辑，提取为 `useMemo` 或辅助函数
