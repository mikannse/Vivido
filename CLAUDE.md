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
- **Language**: TypeScript with strict mode enabled

## Common Commands

```bash
# Development
npm start                    # Start Expo development server (default)
npm run start:lan            # Force LAN mode (use when auto-detection picks wrong IP)
npm run start:tunnel         # Public URL via ngrok (works across any network)

# TypeScript check
npx tsc --noEmit             # Check for type errors without emitting

# Android build (local)
npx expo prebuild --platform android   # Generate native Android project (after app.json changes)
cd android && ./gradlew assembleRelease              # Full Android APK (all architectures)
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a  # Only arm64 APK

# Android build (cloud - recommended)
eas build --platform android --profile preview  # Preview build

# iOS build (cloud - recommended, requires Apple Developer account)
eas build --platform ios --profile production    # Production build
```

## Building Android APK

Local builds require Android SDK and can fail due to native compilation issues. For reliable results:

1. **Cloud build (recommended)**: `eas build --platform android --profile preview`
2. **Local build**: Run `npx expo prebuild --platform android` first, then `./gradlew assembleRelease` in android/

## Build Cache

After modifying source files (especially SQL queries, asset loading, or native module interactions), cached build artifacts can cause stale behavior. Recommended cleanup:

```bash
# Metro / Expo bundler cache (most common culprit)
npx expo start -c

# Prebuild cache (local builds only)
npx expo prebuild --platform android --clean

# Gradle build artifacts (local builds only, in android/)
cd android && ./gradlew clean

# EAS cloud build (force fresh build)
npx eas build --platform android --profile preview --clear-cache
```

Metro cache (`npx expo start -c`) is the highest-value reset — it clears JS bundle caching without requiring a full rebuild. Use `--clear-cache` on EAS builds only if you observe functional issues after deployment.

## Building iOS

iOS builds require macOS with Xcode. Cloud build is recommended: `eas build --platform ios --profile production`

## Fonts Configuration

Custom fonts are loaded in `App.tsx` via expo-font:
- **PlayfairDisplay** - App title (Vivido on home screen)
- **LXGWWenKaiLite** - Diary content/body text
- **SmileySans** - Diary titles

## Architecture

### Navigation Structure
- **Home** (`HomeScreen`) - Lists all diary entries with pull-to-refresh
- **Editor** (`EditorScreen`) - Create/edit diary with media picker (modal presentation)
- **Detail** (`DetailScreen`) - View single diary entry
- **Settings** (`SettingsScreen`) - App settings
- **Discovery** (`DiscoveryScreen`) - 回顾岛: search, filters, heatmap, word cloud

### App Entry & Error Handling (`App.tsx`)
- On mount, loads 3 custom fonts via `expo-font`, then calls `initDatabase()` from `database.ts`
- Both font loading and DB init must complete before the main UI renders (loading screen shown)
- If `initDatabase()` fails, an error screen with a "重新尝试" retry button is shown
- An `ErrorBoundary` class component wraps the entire navigation tree to catch render errors gracefully
- Web platform shows a "Web 版本暂不可用" screen instead of the app

### Data Flow
1. `App.tsx` initializes database on mount, then renders navigation
2. All database operations go through `src/services/database.ts`
3. Media files are copied to `FileSystem.documentDirectory + 'media/'` via `src/services/storage.ts`
4. Backup export uses `src/services/backup.ts` to create JSON and share via `expo-sharing`

### Database Schema
- **diaries**: id, title, content, createdAt, updatedAt (FKs cascade-delete media/tags)
- **media**: id, diaryId (FK), type ('image'|'video'|'audio'), uri, thumbnail, position
- **tags**: id, name (UNIQUE), color, createdAt
- **diary_tags**: diaryId (FK), tagId (FK) - many-to-many relationship
- **drafts**: id, diaryId (FK nullable), title, content, date, media (JSON string), tags (JSON string), updatedAt — auto-save in-progress entries
- **schema_version**: version, description, appliedAt - tracks DB migrations
- `SCHEMA_VERSION = 3` in `database.ts`; `initDatabase()` runs `ensureSchemaVersion()` after creating base tables
- Media entries cascade-deleted when parent diary is deleted; `cleanupUnusedTags()` removes orphaned tags
- `drafts` table stores in-progress diary entries with JSON-serialized media/tags arrays
- Separate `expo-sqlite/kv-store` (not diary.db) stores UI preferences; avoids backup pollution and schema migration coupling

## Preferences System
UI preferences live in a separate `expo-sqlite/kv-store` (independent from the business diary.db):
- `src/services/preferences.ts` — `getPreferenceSync()` (synchronous first-frame read to avoid layout jank) and `setPreference()` (async write)
- `src/hooks/usePreference.ts` — generic typed hook `usePreference<T>(key, fallback)` with synchronous init
- Keys follow `pref.<domain>.<item>` convention; defined in `PREF_KEYS` constant

### Theme System
Typography and colors are centralized in `src/theme/index.ts`:
- `typography.title` - SmileySans for diary titles
- `typography.body` - LXGWWenKaiLite for diary content
- `typography.appName` - PlayfairDisplay for app name
- `colors` - Warm vintage palette (cream background, brown text, orange primary)

### Media Handling
1. User picks image/video via `expo-image-picker`
2. File is copied to `FileSystem.documentDirectory + 'media/'` using `storage.saveMedia()`
3. URI stored in SQLite; thumbnail generated for videos
4. `media.position` controls display order; `getOrderedMedia()` sorts by position with index fallback
5. On diary deletion, `storage.deleteDiaryMedia()` removes all associated files
6. **Note**: `storage.ts` and `backup.ts` import from `expo-file-system/legacy` (not the modern API)

### Backup Format
Backup export produces a ZIP file containing:
- `backup-manifest.json` (version 3, backward-compatible with v1/v2) - diary metadata + tag list + media file paths
- `media/` folder - base64-encoded image/video files
- Import validates schema version and app version (`src/constants.ts` exports `APP_VERSION`) before restoring
- `replaceAllData()` performs atomic DB replacement; imported files are cleaned up on error

### Discovery Screen Architecture
- Data fetching is orchestrated in `src/hooks/useDiscovery.ts`; word frequency filtering (verb/particle/noun heuristics) lives in `src/utils/wordcloud.ts`
- Combines search query (debounced), tag filters, time filters, date/month filters
- Fetches diaries, tags, and word frequency in parallel
- WordCloud levels (1-5) are computed from relative raw-frequency ratios
- Word frequency always uses the last 30 days of data, independent of the user's time filter (decision 2026-07-08)

### Key Files
- [src/types/index.ts](src/types/index.ts) - `DiaryEntry`, `MediaItem` interfaces and `RootStackParamList`
- [src/services/database.ts](src/services/database.ts) - SQLite CRUD operations
- [src/services/storage.ts](src/services/storage.ts) - Media file management (save/delete)
- [src/services/backup.ts](src/services/backup.ts) - JSON backup creation and sharing
- [src/theme/index.ts](src/theme/index.ts) - Typography and color tokens
- [src/utils/](src/utils/) - UUID generation, date formatting, media utilities

### Components
- **AudioRecorder** / **AudioPlayer** — Record voice memos (via `expo-audio`) and play them back inline
- **MediaPicker** — Multi-select gallery/camera picker with position-based drag-reordering
- **TagEditor** / **TagChip** — Inline tag creation, color picker, assignment/removal
- **DiaryCard** / **CarouselCard** / **TimelineCard** — Three home-screen layout variants (switched via preference)
- **WordCloud** — 5-level heatmap of frequent words from the last 30 days
- **FullScreenGallery** — Swipeable full-screen media viewer with pinch-to-zoom
- **Branding** — Renders "Vivido" text with PlayfairDisplay font
- **DatePickerModal** / **FilterChips** / **StyledDialog** — Reusable UI primitives

### Editor Screen Behavior
The `Editor` screen accepts an optional `diaryId` parameter:
- `undefined` → Create new diary
- `string` → Edit existing diary (pre-populates form)
- Supports media multi-select with position-based ordering via `MediaPicker`
- Tags are edited inline through `TagEditor`; existing tags are fetched from DB and new ones are created on save

### Development Notes

**Expo LAN Connection on Phone Hotspot**
When the PC connects to a phone hotspot, `npm start` may generate a QR code with the wrong LAN IP (from another active network interface). If scanning fails, open Expo Go and manually enter:
```
exp://<PC_HOTSPOT_IP>:8081
```
Use `npm run start:lan` to force LAN mode, or `npm run start:tunnel` for a public URL that works across any network.

**Android TextInput Behavior**
On Android, TextInput components have internal scrolling. To prevent unwanted scrolling:
- Use `multiline={false}` for single-line inputs
- Use `scrollEnabled={false}` to disable internal scrolling
- Use `numberOfLines={1}` for explicit single line
- Consider using fixed `height` instead of `minHeight`

**patch-package**
The `postinstall` script runs `patch-package`. Any manual fixes to `node_modules` should be persisted as patches via `npx patch-package <package-name>` so they survive `npm install`.

