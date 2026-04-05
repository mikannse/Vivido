# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Vivido** is a Expo (React Native) diary application with local SQLite storage. The app allows users to create, edit, and view diary entries with image/video media attachments.

## Tech Stack

- **Framework**: Expo SDK 55 with React Native 0.83
- **Navigation**: React Navigation 7 (native-stack)
- **Database**: expo-sqlite for local SQLite storage
- **Media**: expo-image-picker, expo-image, expo-video, expo-audio
- **Storage**: expo-file-system for media file management
- **Language**: TypeScript with strict mode

## Common Commands

```bash
npm start        # Start Expo development server
npm run android  # Build and run on Android
npm run ios      # Build and run on iOS
npm run web      # Start web build
```

## Fonts Configuration

Custom fonts are loaded in `App.tsx` via expo-font:
- **PlayfairDisplay** - App title (Vivido on home screen)
- **LXGWWenKai** - Diary content/body text
- **SmileySans** - Diary titles

## Architecture

### Navigation Structure
- **Home** (`HomeScreen`) - Lists all diary entries with pull-to-refresh
- **Editor** (`EditorScreen`) - Create/edit diary with media picker (modal presentation)
- **Detail** (`DetailScreen`) - View single diary entry
- **Settings** (`SettingsScreen`) - App settings

### Data Flow
1. `App.tsx` initializes database on mount, then renders navigation
2. All database operations go through `src/services/database.ts`
3. Media files are copied to `FileSystem.documentDirectory + 'media/'` via `src/services/storage.ts`
4. Backup export uses `src/services/backup.ts` to create JSON and share via `expo-sharing`

### Database Schema
- **diaries**: id, title, content, createdAt, updatedAt
- **media**: id, diaryId (FK), type ('image'|'video'), uri, thumbnail, position
- Media entries are cascade-deleted when parent diary is deleted

### Theme System
Typography and colors are centralized in `src/theme/index.ts`:
- `typography.title` - SmileySans for diary titles
- `typography.body` - LXGWWenKai for diary content
- `typography.appName` - PlayfairDisplay for app name
- `colors` - Warm vintage palette (cream background, brown text, orange primary)

### Media Handling
1. User picks image/video via `expo-image-picker`
2. File is copied to `FileSystem.documentDirectory + 'media/'` using `storage.saveMedia()`
3. URI stored in SQLite; thumbnail generated for videos
4. On diary deletion, `storage.deleteDiaryMedia()` removes all associated files

### Key Files
- [src/types/index.ts](src/types/index.ts) - `DiaryEntry`, `MediaItem` interfaces and `RootStackParamList`
- [src/services/database.ts](src/services/database.ts) - SQLite CRUD operations
- [src/services/storage.ts](src/services/storage.ts) - Media file management (save/delete)
- [src/services/backup.ts](src/services/backup.ts) - JSON backup creation and sharing
- [src/theme/index.ts](src/theme/index.ts) - Typography and color tokens
- [src/utils/](src/utils/) - UUID generation, date formatting, media utilities

### Editor Screen Behavior
The `Editor` screen accepts an optional `diaryId` parameter:
- `undefined` → Create new diary
- `string` → Edit existing diary (pre-populates form)

### Android TextInput Behavior

On Android, TextInput components have internal scrolling. To prevent unwanted scrolling:
- Use `multiline={false}` for single-line inputs
- Use `scrollEnabled={false}` to disable internal scrolling
- Use `numberOfLines={1}` for explicit single line
- Consider using fixed `height` instead of `minHeight`

## Current Date
2026-04-05
