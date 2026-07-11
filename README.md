# Vivido

> A warm, offline-first diary app built with Expo and React Native — featuring rich media support, voice memos, tag organization, and a Chinese-language discovery engine with word cloud visualization.

[![Expo SDK](https://img.shields.io/badge/Expo_SDK-55-blueviolet?logo=expo)](https://docs.expo.dev/)
[![React Native](https://img.shields.io/badge/React_Native-0.83-61DAFB?logo=react)](https://reactnative.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

## Features

- **📝 Rich diary entries** — Title, body content, and inline paragraph rendering
- **🖼️ Media attachments** — Images, videos, and voice recordings per entry
- **🏷️ Tag organization** — Create colored tags, assign and filter by tags
- **🎙️ Voice memos** — Record and play back audio directly in entries
- **🔍 Discovery engine** — Full-text search, tag and time-range filters, monthly heatmap
- **☁️ Word cloud** — Auto-generated 5-level word frequency visualization from recent entries
- **💾 Local-first & offline** — All data stored in SQLite; no internet required
- **📦 Backup & restore** — ZIP export with all media embedded; import with validation
- **🎨 Warm vintage theme** — Cream backgrounds, brown text, orange accents across 3 custom fonts
- **📱 Multiple layouts** — Timeline or carousel home view, customizable per preference
- **✏️ Auto-save drafts** — In-progress entries are saved automatically

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Expo SDK 55](https://docs.expo.dev/) |
| **UI** | [React Native 0.83](https://reactnative.dev/) |
| **Navigation** | [React Navigation 7](https://reactnavigation.org/) (native-stack) |
| **Language** | [TypeScript 5.9](https://www.typescriptlang.org/) (strict mode) |
| **Database** | [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (local SQLite) |
| **Media** | expo-image, expo-video, expo-audio, expo-image-picker |
| **Storage** | expo-file-system |
| **Backup** | jszip + react-native-zip-archive |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Expo Go](https://expo.dev/client) on your mobile device, or a development build
- For Android builds: Android SDK (see [Building](#building))
- For iOS builds: macOS with Xcode (or EAS cloud build)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/vivido.git
cd vivido

# Install dependencies
npm install

# Start the development server
npm start
```

Scan the QR code with Expo Go, or connect via [LAN mode](https://docs.expo.dev/guides/lan/):

```bash
npm run start:lan
```

If you're on a different network, use tunnel mode:

```bash
npm run start:tunnel
```

## Building

### Android

```bash
# Local build (requires Android SDK)
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease

# Cloud build (recommended)
eas build --platform android --profile preview
```

### iOS

Cloud build is recommended (requires an Apple Developer account):

```bash
eas build --platform ios --profile production
```

### Build Cache

If you encounter stale behavior after modifying source files, clear the Metro bundler cache:

```bash
npx expo start -c
```

For EAS cloud builds with cache issues:

```bash
eas build --platform android --profile preview --clear-cache
```

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── AudioRecorder / AudioPlayer  # Voice memo recording and playback
│   ├── MediaPicker / MediaViewer    # Image and video handling
│   ├── TagEditor / TagChip          # Tag creation and selection
│   ├── DiaryCard / CarouselCard / TimelineCard  # Home screen layouts
│   ├── WordCloud                     # 5-level word frequency visualization
│   ├── FullScreenGallery            # Swipeable media viewer with zoom
│   └── ...
├── hooks/          # Custom React hooks
│   ├── useDiscovery.ts      # Search/filter/wordcloud orchestration
│   └── usePreference.ts     # Typed preference hook with sync init
├── screens/        # 5 main screens
│   ├── HomeScreen.tsx       # Diary feed with multiple layouts
│   ├── EditorScreen.tsx     # Create/edit diary with auto-save drafts
│   ├── DetailScreen.tsx     # Diary detail view
│   ├── DiscoveryScreen.tsx  # Search, filters, word cloud
│   └── SettingsScreen.tsx   # Backup export/import
├── services/       # Business logic layer
│   ├── database.ts         # SQLite CRUD and schema migrations
│   ├── storage.ts          # Media file management
│   ├── backup.ts           # ZIP backup/restore
│   └── preferences.ts      # kv-store UI preferences
├── theme/          # Design tokens
│   └── index.ts            # Typography and color palette
├── types/          # TypeScript interfaces
├── utils/          # Helpers (UUID, dates, media, word cloud)
└── constants.ts    # App version
```

## Architecture Overview

### Data Flow

- **SQLite is the single source of truth** — No external state management (Redux, Zustand, etc.)
- Screens reload data via `useFocusEffect` from React Navigation, ensuring fresh reads
- UI preferences are stored in a separate `expo-sqlite/kv-store` to avoid backup pollution and schema migration coupling

### Database Schema

- **diaries** — Core entries with title, content, timestamps
- **media** — Image/video/audio attachments with position-based ordering
- **tags** — Colored labels with unique names
- **diary_tags** — Many-to-many relationship
- **drafts** — Auto-saved in-progress entries (JSON-serialized media/tags)
- **schema_version** — Migration tracking

### Media Pipeline

1. User picks media via `expo-image-picker`
2. File is copied to app's document directory (`media/` folder)
3. URI is stored in SQLite database
4. On diary deletion, all associated media files are cleaned up

### Backup Format

Backup exports produce a ZIP file containing:
- `backup-manifest.json` — Versioned metadata (schema v3, backward-compatible with v1/v2)
- `media/` folder — Base64-encoded image, video, and audio files
- Import validates schema version before restoring and cleans up on error

## Fonts

Vivido uses three custom fonts for a distinctive visual identity:

| Font | Usage |
|---|---|
| **PlayfairDisplay** | App name / branding headings |
| **LXGWWenKaiLite** | Diary body content |
| **SmileySans** | Diary titles |

## Development Notes

- TypeScript strict mode is enabled — run `npx tsc --noEmit` to check for type errors
- The `postinstall` script runs `patch-package` — manual `node_modules` fixes should be persisted via `npx patch-package <package-name>`
- Android `TextInput` components can exhibit internal scrolling behavior; use `scrollEnabled={false}` and `numberOfLines={1}` for single-line inputs
- For LAN connection troubleshooting on phone hotspots, Expo's auto-detection may pick the wrong network interface — use `npm run start:lan` to force LAN mode
