# 构建与发布指南

## 应用配置

关键配置位于 `app.json`：

```json
{
  "expo": {
    "name": "Vivido",
    "version": "1.0.2",
    "orientation": "portrait",
    "ios": {
      "bundleIdentifier": "com.vivido.diary",
      "supportsTablet": true
    },
    "android": {
      "package": "com.vivido.diary",
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
      ]
    },
    "plugins": [
      "expo-sqlite",
      "expo-image",
      "expo-sharing",
      "expo-font",
      ["expo-build-properties", { "ios": { "deploymentTarget": "15.5" } }],
      "expo-audio",
      "expo-video",
      "expo-dev-client"
    ]
  }
}
```

## Android 构建

### 本地构建（推荐用于开发测试）

```bash
# 1. 生成/更新原生项目
npx expo prebuild --platform android

# 2. 进入 android 目录构建 APK
cd android && ./gradlew assembleRelease

# 仅构建 arm64 架构（体积更小）
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK 输出路径：`android/app/build/outputs/apk/release/app-release.apk`

### 本地构建前置检查

- `ANDROID_HOME` 已设置，或 `android/local.properties` 存在
- JDK 17+（`java -version`）
- Gradle 8.13（已配置在 `gradle-wrapper.properties`）
- Android SDK 包含 `platforms` 和 `build-tools`

### 云构建（推荐用于正式分发）

使用 Expo Application Services (EAS)：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录
eas login

# 配置构建
npx eas build:configure

# Preview 构建（内部测试）
eas build --platform android --profile preview

# Production 构建（应用商店）
eas build --platform android --profile production
```

## iOS 构建

### 本地构建（仅 macOS + Xcode）

```bash
# 生成原生项目
npx expo prebuild --platform ios

# 用 Xcode 打开并构建
cd ios && xcodebuild -workspace Vivido.xcworkspace -scheme Vivido -configuration Release
```

### 云构建（推荐）

```bash
# 需要 Apple Developer 账号
eas build --platform ios --profile production
```

注意：`expo-build-properties` 中设置了 `ios.deploymentTarget: "15.5"`，以满足 `react-native-zip-archive` 的 podspec 要求。

## 版本管理

应用版本同时存在于：
- `app.json` → `expo.version`
- `package.json` → `version`
- `src/constants.ts` → `APP_VERSION`（备份校验用）

发布前请确保三者一致。

## 备份兼容性

备份 ZIP 包含 `schemaVersion`（当前为 `2`）和 `appVersion`。

| 场景 | 行为 |
|------|------|
| 备份 schema > 当前 | 拒绝导入，提示升级应用 |
| 备份 appVersion > 当前 | 拒绝导入，提示升级应用 |
| 备份 schema <= 当前 | 允许导入 |

## 发布检查清单

- [ ] 版本号已更新（app.json / package.json / constants.ts）
- [ ] `npx tsc --noEmit` 无类型错误
- [ ] 备份/恢复功能已手动测试
- [ ] 新设备首次启动（无数据库）已测试
- [ ] 深色模式不需要（应用固定 light 主题）
- [ ] 权限声明在 `app.json` 中完整
- [ ] iOS `deploymentTarget` 满足所有原生模块要求
