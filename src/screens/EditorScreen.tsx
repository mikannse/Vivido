import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList, DiaryEntry, MediaItem, Tag } from '../types';
import { getDiaryById, createDiary, updateDiary } from '../services/database';
import { saveMedia, deleteDiaryMedia, MEDIA_DIR_PATH } from '../services/storage';
import { generateId } from '../utils/uuid';
import { MediaPicker } from '../components/MediaPicker';
import { TagEditor } from '../components/TagEditor';
import { StyledDialog } from '../components/StyledDialog';
import { assignMediaPositions, getMediaFileExtension, getOrderedMedia } from '../utils/media';
import { formatDateInputValue, getWeekDayLabel, parseDateInputValue } from '../utils/date';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Editor'>;
type EditorRouteProp = RouteProp<RootStackParamList, 'Editor'>;

export const EditorScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditorRouteProp>();
  const diaryId = route.params?.diaryId;
  const isEditing = !!diaryId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(formatDateInputValue(Date.now()));
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalMedia, setOriginalMedia] = useState<MediaItem[]>([]);
  const [initialCreatedAt, setInitialCreatedAt] = useState(Date.now());

  // Dialog states
  const [notFoundDialogVisible, setNotFoundDialogVisible] = useState(false);
  const [loadErrorDialogVisible, setLoadErrorDialogVisible] = useState(false);
  const [emptyContentDialogVisible, setEmptyContentDialogVisible] = useState(false);
  const [invalidDateDialogVisible, setInvalidDateDialogVisible] = useState(false);
  const [saveErrorDialogVisible, setSaveErrorDialogVisible] = useState(false);
  const [libraryPermissionDialogVisible, setLibraryPermissionDialogVisible] = useState(false);
  const [unsavedDialogVisible, setUnsavedDialogVisible] = useState(false);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  // Store initial values for change detection
  const [initialTitle, setInitialTitle] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [initialDate, setInitialDate] = useState('');
  const [initialTags, setInitialTags] = useState<Tag[]>([]);

  useEffect(() => {
    if (isEditing && diaryId) {
      loadDiary(diaryId);
    }
  }, [diaryId]);

  // Track unsaved changes
  useEffect(() => {
    if (isEditing) {
      const hasChanges =
        title !== initialTitle ||
        content !== initialContent ||
        date !== initialDate ||
        JSON.stringify(media) !== JSON.stringify(originalMedia) ||
        JSON.stringify(tags) !== JSON.stringify(initialTags);
      setHasUnsavedChanges(hasChanges);
    } else {
      // For new diary, check if there's any content
      const hasContent = !!(title.trim() || content.trim() || media.length > 0);
      setHasUnsavedChanges(hasContent);
    }
  }, [title, content, date, media, tags, originalMedia, initialTitle, initialContent, initialDate, initialTags, isEditing]);

  // Listen for navigation events to detect back gesture/button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Don't show dialog if we're currently saving
      if (isSaving || !hasUnsavedChanges) {
        return;
      }

      // Prevent default navigation
      e.preventDefault();

      // Store the pending navigation action
      setPendingNavigation(() => () => {
        navigation.dispatch(e.data.action);
      });

      // Show unsaved changes dialog
      setUnsavedDialogVisible(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, isSaving]);

  const loadDiary = async (id: string) => {
    try {
      const diary = await getDiaryById(id);
      if (diary) {
        setTitle(diary.title);
        setContent(diary.content);
        setDate(formatDateInputValue(diary.createdAt));
        setInitialCreatedAt(diary.createdAt);
        const orderedMedia = assignMediaPositions(getOrderedMedia(diary.media));
        setMedia(orderedMedia);
        setOriginalMedia(orderedMedia);
        setTags(diary.tags);
        // Set initial values for change detection
        setInitialTitle(diary.title);
        setInitialContent(diary.content);
        setInitialDate(formatDateInputValue(diary.createdAt));
        setInitialTags(diary.tags);
      } else {
        setNotFoundDialogVisible(true);
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load diary:', error);
      setLoadErrorDialogVisible(true);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setLibraryPermissionDialogVisible(true);
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        orderedSelection: true,
        quality: 1,
      });

      if (!result.canceled) {
        const newMedia: MediaItem[] = result.assets.map((asset) => ({
          id: generateId(),
          type: asset.type === 'video' ? 'video' : 'image',
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        }));
        setMedia(assignMediaPositions([...media, ...newMedia]));
      }
    } catch (error) {
      console.error('Failed to pick image:', error);
    }
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && media.length === 0) {
      setEmptyContentDialogVisible(true);
      return;
    }

    setLoading(true);
    setIsSaving(true);
    try {
      const parsedCreatedAt = parseDateInputValue(
        date,
        isEditing ? initialCreatedAt : Date.now()
      );

      if (parsedCreatedAt === null) {
        setInvalidDateDialogVisible(true);
        setLoading(false);
        setIsSaving(false);
        return;
      }

      const savedMedia: MediaItem[] = [];
      for (const item of assignMediaPositions(media)) {
        // Check if media is already in our storage directory
        const isInOurStorage = item.uri.startsWith(MEDIA_DIR_PATH);
        const isOriginal = originalMedia.some((m) => m.id === item.id);

        if (isInOurStorage) {
          // Already in our storage - keep as is
          savedMedia.push(item);
        } else if (isOriginal) {
          // Original media that was removed from this edit session
          savedMedia.push(item);
        } else {
          // New media - need to save to our storage
          const fileName = `${generateId()}.${getMediaFileExtension(item)}`;
          const savedUri = await saveMedia(item.uri, fileName);
          savedMedia.push({ ...item, uri: savedUri });
        }
      }

      const now = Date.now();
      const entry: DiaryEntry = {
        id: diaryId || generateId(),
        title: title.trim(),
        content: content.trim(),
        media: savedMedia,
        tags: tags,
        createdAt: parsedCreatedAt,
        updatedAt: now,
      };

      if (isEditing) {
        const removedMedia = originalMedia.filter(
          (om) => !savedMedia.some((sm) => sm.id === om.id)
        );
        await deleteDiaryMedia(removedMedia);
        await updateDiary(entry);
      } else {
        await createDiary(entry);
      }

      // Reset change tracking after successful save
      setHasUnsavedChanges(false);
      setIsSaving(false);
      if (isEditing) {
        setInitialTitle(title.trim());
        setInitialContent(content.trim());
        setInitialDate(date);
        setInitialTags(tags);
        setOriginalMedia(savedMedia);
        setInitialCreatedAt(parsedCreatedAt);
      }

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save diary:', error);
      setSaveErrorDialogVisible(true);
    } finally {
      setLoading(false);
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.mainContainer} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
        enabled
      >
        <View style={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? '编辑日记' : '写日记'}
          </Text>
          <TouchableOpacity
            style={[styles.headerButton, styles.saveButton]}
            onPress={handleSave}
            disabled={loading}
          >
            <Text style={[styles.saveText, loading && styles.disabledText]}>
              {loading ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.mediaScroll}
          contentContainerStyle={styles.scrollContentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.dateRow}>
          <TextInput
            style={styles.dateInput}
            value={date}
            onChangeText={setDate}
            placeholder="选择日期"
            placeholderTextColor="#c4b8ae"
            scrollEnabled={false}
            autoCorrect={false}
            autoCapitalize="none"
            importantForAutofill="no"
          />
          <Text style={styles.weekDay}>{getWeekDayLabel(date)}</Text>
          <Text style={styles.charCount}>{content.length} 字</Text>
        </View>

        <View style={styles.cardContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="标题（选填）"
            placeholderTextColor="#c4b8ae"
            value={title}
            onChangeText={setTitle}
            maxLength={100}
            scrollEnabled={false}
            autoCorrect={false}
            autoCapitalize="none"
            importantForAutofill="no"
            multiline={false}
            numberOfLines={1}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.contentInput}
            placeholder="写下今天的故事..."
            placeholderTextColor="#c4b8ae"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            scrollEnabled={false}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.mediaSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.7}>
            <Text style={styles.mediaLabel}>添加媒体</Text>
          </TouchableOpacity>
          <MediaPicker media={media} onMediaChange={setMedia} />
        </View>

        <TagEditor
          selectedTags={tags}
          onTagsChange={setTags}
        />

        <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
      </KeyboardAvoidingView>

      {/* Not found dialog */}
      <StyledDialog
        visible={notFoundDialogVisible}
        title="提示"
        message="这篇日记不存在或已被删除"
        buttons={[{ text: '确定', style: 'default', onPress: () => setNotFoundDialogVisible(false) }]}
        onDismiss={() => setNotFoundDialogVisible(false)}
      />

      {/* Load error dialog */}
      <StyledDialog
        visible={loadErrorDialogVisible}
        title="错误"
        message="无法加载日记"
        buttons={[{ text: '确定', style: 'default', onPress: () => setLoadErrorDialogVisible(false) }]}
        onDismiss={() => setLoadErrorDialogVisible(false)}
      />

      {/* Empty content dialog */}
      <StyledDialog
        visible={emptyContentDialogVisible}
        title="提示"
        message="请填写日记内容"
        buttons={[{ text: '确定', style: 'default', onPress: () => setEmptyContentDialogVisible(false) }]}
        onDismiss={() => setEmptyContentDialogVisible(false)}
      />

      {/* Invalid date dialog */}
      <StyledDialog
        visible={invalidDateDialogVisible}
        title="提示"
        message="请输入有效日期，格式为 YYYY-MM-DD"
        buttons={[{ text: '确定', style: 'default', onPress: () => setInvalidDateDialogVisible(false) }]}
        onDismiss={() => setInvalidDateDialogVisible(false)}
      />

      {/* Save error dialog */}
      <StyledDialog
        visible={saveErrorDialogVisible}
        title="错误"
        message="保存失败"
        buttons={[{ text: '确定', style: 'default', onPress: () => setSaveErrorDialogVisible(false) }]}
        onDismiss={() => setSaveErrorDialogVisible(false)}
      />

      {/* Library permission dialog */}
      <StyledDialog
        visible={libraryPermissionDialogVisible}
        title="权限不足"
        message="需要访问相册权限才能选择图片"
        buttons={[{ text: '确定', style: 'default', onPress: () => setLibraryPermissionDialogVisible(false) }]}
        onDismiss={() => setLibraryPermissionDialogVisible(false)}
      />

      {/* Unsaved changes dialog */}
      <StyledDialog
        visible={unsavedDialogVisible}
        title="有未保存的更改"
        message="确定要退出吗？退出后将丢失未保存的内容。"
        buttons={[
          { text: '取消', style: 'cancel', onPress: () => {
            setUnsavedDialogVisible(false);
            setPendingNavigation(null);
          }},
          { text: '不保存', style: 'destructive', onPress: () => {
            setUnsavedDialogVisible(false);
            if (pendingNavigation) {
              pendingNavigation();
              setPendingNavigation(null);
            }
          }},
          { text: '保存', style: 'default', onPress: async () => {
            setUnsavedDialogVisible(false);
            // Save first, then navigate
            await handleSave();
            if (pendingNavigation) {
              pendingNavigation();
              setPendingNavigation(null);
            }
          }},
        ]}
        onDismiss={() => {
          setUnsavedDialogVisible(false);
          setPendingNavigation(null);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: '#f8f6f3',
  },
  contentContainer: {
    flex: 1,
  },
  mediaScroll: {
    flex: 1,
  },
  fixedContent: {
    overflow: 'hidden',
  },
  contentWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  fixedTop: {
    overflow: 'hidden',
  },
  keyboardView: {
    flex: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f6f3',
    borderBottomWidth: 1,
    borderBottomColor: '#e2ddd8',
  },
  headerButton: {
    minWidth: 50,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3d2c1e',
  },
  cancelText: {
    fontSize: 16,
    color: '#827066',
  },
  saveButton: {
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 16,
    color: '#c47030',
    fontWeight: '600',
  },
  disabledText: {
    color: '#c4b8ae',
  },
  scrollContentContainer: {
    paddingBottom: 32,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#f8f6f3',
    marginTop: 8,
  },
  dateInput: {
    fontSize: 14,
    color: '#c47030',
    fontWeight: '500',
    backgroundColor: 'transparent',
    padding: 0,
    borderWidth: 0,
    minWidth: 100,
    height: 30,
  },
  weekDay: {
    fontSize: 14,
    color: '#827066',
    marginLeft: 12,
  },
  charCount: {
    fontSize: 12,
    color: '#a48a74',
    marginLeft: 'auto',
  },
  cardContainer: {
    backgroundColor: '#fdfcfb',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.4)',
    shadowColor: '#3d2c1e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    color: '#3d2c1e',
    paddingVertical: 0,
    paddingHorizontal: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    height: 40,
    fontFamily: 'SmileySans',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2ddd8',
    marginVertical: 12,
  },
  contentInput: {
    fontSize: 16,
    color: '#3d2c1e',
    lineHeight: 26,
    paddingVertical: 16,
    paddingHorizontal: 4,
    minHeight: 220,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: 'LXGWWenKaiLite',
  },
  mediaSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#c47030',
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ebe7e3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2ddd8',
    overflow: 'hidden',
    textAlign: 'center',
  },
  bottomPadding: {
    height: 40,
  },
});
