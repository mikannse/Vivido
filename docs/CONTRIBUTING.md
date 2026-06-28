# 开发规范与贡献指南

## 分支策略

- `main`：主分支，保持稳定可构建
- 功能开发：从 `main` 切出 `feat/xxx` 分支
- Bug 修复：从 `main` 切出 `fix/xxx` 分支
- 完成后通过 Pull Request 合并

## 提交规范

使用语义化提交前缀：

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 添加日记搜索功能` |
| `fix:` | Bug 修复 | `fix: 修复媒体排序不生效问题` |
| `docs:` | 文档更新 | `docs: 更新 API 文档` |
| `style:` | 代码格式 | `style: 统一引号为单引号` |
| `refactor:` | 重构 | `refactor: 提取搜索逻辑到 Hook` |
| `chore:` | 构建/配置 | `chore: 升级 expo-dev-client` |
| `test:` | 测试相关 | `test: 添加数据库迁移测试` |

## 代码规范

### TypeScript

- `strict: true` 已启用，不允许隐式 `any`
- 所有函数参数和返回值必须标注类型
- 优先使用接口（`interface`）而非类型别名（`type`）定义数据结构
- 组件 props 定义在文件顶部

### 组件编写

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  onPress?: () => void;
}

export const MyComponent: React.FC<Props> = ({ title, onPress }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#f8f6f3',
  },
  text: {
    fontSize: 16,
    color: '#3d2c1e',
  },
});
```

### 服务层规范

- 所有数据库操作函数必须以 `if (!db) throw new Error('Database not initialized')` 开头
- 写操作必须使用 `withTransactionAsync` 保证原子性
- 错误处理：原生调用失败时记录 `console.warn` 或 `console.error`

### 性能注意事项

1. **列表分页**：`HomeScreen` 使用 `FlatList` + `onEndReached`，每页 20 条
2. **媒体限制**：列表页每篇日记最多取 3 张媒体（`getDiariesPaginated` 的 `mediaLimitPerDiary`）
3. **搜索防抖**：`useDiscovery` 中搜索词 debounce 300ms
4. **图片缓存**：使用 `expo-image` 自带缓存，无需额外处理
5. **避免 N+1**：批量查询标签使用 `getTagsForDiaries(diaryIds)`

### 安全注意事项

- 所有用户输入（日记标题、内容、标签名）在存入数据库前无需额外转义（SQLite 参数化查询已处理）
- 备份导入时校验 `schemaVersion` 和 `appVersion`，防止不兼容数据覆盖
- 导入失败时清理已提取的媒体文件，避免残留垃圾

## 目录模块规范

每个目录必须提供 `index.ts` 统一导出：

```typescript
// src/components/index.ts
export { TimelineCard } from './TimelineCard';
export { MediaPicker } from './MediaPicker';
// ...
```

外部导入时统一从目录导入：

```typescript
import { TimelineCard, MediaPicker } from '../components';
```

## 新增原生模块流程

1. 安装模块：`npm install react-native-xxx`
2. 若模块需要原生代码，在 `app.json` 的 `plugins` 中注册
3. 运行 `npx expo prebuild` 重新生成原生项目
4. 对于 iOS，检查 podspec 的 `deploymentTarget` 是否高于当前配置
5. 测试构建：`npm run android` / `npm run ios`

## 代码审查清单

提交 PR 前自检：

- [ ] `npx tsc --noEmit` 通过
- [ ] 新功能已在真机/模拟器验证
- [ ] 数据库变更包含迁移逻辑（更新 `SCHEMA_VERSION` 和 `MIGRATIONS`）
- [ ] 新组件包含必要的 `key` prop（列表场景）
- [ ] 无 `console.log` 调试代码残留（保留 `console.warn`/`console.error` 用于错误上报）
- [ ] 中文用户界面文案通顺、无错别字
