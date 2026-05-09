import React, { useState, useEffect, useRef } from 'react';
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
import { DatePickerModal } from '../components/DatePickerModal';
import { RootStackParamList, DiaryEntry, MediaItem, Tag } from '../types';
import { getDiaryById, createDiary, updateDiary, saveDraft, getDraft, deleteDraft, Draft } from '../services/database';
import { saveMedia, deleteMedia, deleteDiaryMedia, MEDIA_DIR_PATH } from '../services/storage';
import { generateId } from '../utils/uuid';
import { MediaPicker } from '../components/MediaPicker';
import { TagEditor } from '../components/TagEditor';
import { StyledDialog } from '../components/StyledDialog';
import { assignMediaPositions, getMediaFileExtension, getOrderedMedia } from '../utils/media';
import { formatDateInputValue, getWeekDayLabel, parseDateInputValue } from '../utils/date';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Editor'>;
type EditorRouteProp = RouteProp<RootStackParamList, 'Editor'>;

const PAPER_BG = '#f5f0e6';
const TEXT_PRIMARY = '#3d2c1e';
const TEXT_SECONDARY = '#7a6250';
const TEXT_MUTED = '#a48a74';
const BRAND_GOLD = '#c47030';

const getDraftId = (diaryId?: string): string => diaryId || 'new';

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
  const [draftDialogVisible, setDraftDialogVisible] = useState(false);

  // Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const draftSaveTimer = useRef<NodeJS.Timeout | null>(null);

  // Store initial values for change detection
  const [initialTitle, setInitialTitle] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [initialDate, setInitialDate] = useState('');
  const [initialTags, setInitialTags] = useState<Tag[]>([]);

  // Draft data for restore dialog
  const [draftData, setDraftData] = useState<Draft | null>(null);

  useEffect(() => {
    if (isEditing && diaryId) {
      loadDiary(diaryId);
    } else {
      checkDraft();
    }
  }, [diaryId]);

  // Auto-save draft with debounce
  useEffect(() => {
    if (isSaving) return;

    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
    }

    const hasContent = !!(title.trim() || content.trim() || media.length > 0);
    if (hasContent) {
      draftSaveTimer.current = setTimeout(() => {
        autoSaveDraft();
      }, 2000);
    }

    return () => {
      if (draftSaveTimer.current) {
        clearTimeout(draftSaveTimer.current);
      }
    };
  }, [title, content, date, media, tags]);

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
      const hasContent = !!(title.trim() || content.trim() || media.length > 0);
      setHasUnsavedChanges(hasContent);
    }
  }, [title, content, date, media, tags, originalMedia, initialTitle, initialContent, initialDate, initialTags, isEditing]);

  // Listen for navigation events to detect back gesture/button
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isSaving || !hasUnsavedChanges) {
        return;
      }

      e.preventDefault();

      setPendingNavigation(() => () => {
        navigation.dispatch(e.data.action);
      });

      setUnsavedDialogVisible(true);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges, isSaving]);

  const checkDraft = async (compareWith?: { title: string; content: string; date: string; media: MediaItem[]; tags: Tag[] }) => {
    try {
      const draftId = getDraftId(diaryId);
      const draft = await getDraft(draftId);
      if (!draft) return;

      if (compareWith) {
        const isIdentical =
          draft.title === compareWith.title &&
          draft.content === compareWith.content &&
          draft.date === compareWith.date &&
          JSON.stringify(draft.media) === JSON.stringify(compareWith.media) &&
          JSON.stringify(draft.tags) === JSON.stringify(compareWith.tags);

        if (isIdentical) {
          await deleteDraft(draftId);
          return;
        }
      }

      setDraftData(draft);
      setDraftDialogVisible(true);
    } catch (error) {
      console.error('Failed to check draft:', error);
    }
  };

  const autoSaveDraft = async () => {
    try {
      const draftId = getDraftId(diaryId);

      const hasChanges = isEditing
        ? title !== initialTitle ||
          content !== initialContent ||
          date !== initialDate ||
          JSON.stringify(media) !== JSON.stringify(originalMedia) ||
          JSON.stringify(tags) !== JSON.stringify(initialTags)
        : !!(title.trim() || content.trim() || media.length > 0);

      if (!hasChanges) return;

      await saveDraft({
        id: draftId,
        diaryId: diaryId || null,
        title,
        content,
        date,
        media,
        tags,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error('Failed to auto-save draft:', error);
    }
  };

  const restoreDraft = () => {
    if (!draftData) return;
    setTitle(draftData.title);
    setContent(draftData.content);
    setDate(draftData.date);
    setMedia(draftData.media);
    setTags(draftData.tags);
    setDraftDialogVisible(false);
  };

  const discardDraft = async () => {
    try {
      const draftId = getDraftId(diaryId);
      await deleteDraft(draftId);
    } catch (error) {
      console.error('Failed to delete draft:', error);
    }
    setDraftDialogVisible(false);
  };

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
        setInitialTitle(diary.title);
        setInitialContent(diary.content);
        setInitialDate(formatDateInputValue(diary.createdAt));
        setInitialTags(diary.tags);

        await checkDraft({
          title: diary.title,
          content: diary.content,
          date: formatDateInputValue(diary.createdAt),
          media: orderedMedia,
          tags: diary.tags,
        });
      } else {
        setNotFoundDialogVisible(true);
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

  const handleSave = async (skipNavigation?: boolean) => {
    if (!title.trim() && !content.trim() && media.length === 0) {
      setEmptyContentDialogVisible(true);
      return false;
    }

    // Clear draft auto-save timer to prevent race after manual save
    if (draftSaveTimer.current) {
      clearTimeout(draftSaveTimer.current);
      draftSaveTimer.current = null;
    }

    setLoading(true);
    setIsSaving(true);
    const newlySavedUris: string[] = [];
    try {
      const parsedCreatedAt = parseDateInputValue(
        date,
        isEditing ? initialCreatedAt : Date.now()
      );

      if (parsedCreatedAt === null) {
        setInvalidDateDialogVisible(true);
        setLoading(false);
        setIsSaving(false);
        return false;
      }

      const savedMedia: MediaItem[] = [];
      for (const item of assignMediaPositions(media)) {
        const isInOurStorage = item.uri.startsWith(MEDIA_DIR_PATH);
        const isOriginal = originalMedia.some((m) => m.id === item.id);

        if (isInOurStorage) {
          savedMedia.push(item);
        } else if (isOriginal) {
          savedMedia.push(item);
        } else {
          const fileName = `${generateId()}.${getMediaFileExtension(item)}`;
          const savedUri = await saveMedia(item.uri, fileName);
          savedMedia.push({ ...item, uri: savedUri });
          newlySavedUris.push(savedUri);
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
        await updateDiary(entry);
        await deleteDiaryMedia(removedMedia);
      } else {
        await createDiary(entry);
      }

      // Delete draft after successful save
      const draftId = getDraftId(diaryId);
      await deleteDraft(draftId);

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

      if (!skipNavigation) {
        navigation.goBack();
      }
      return true;
    } catch (error) {
      console.error('Failed to save diary:', error);
      // Clean up newly saved media files on failure to prevent orphans
      for (const uri of newlySavedUris) {
        try {
          await deleteMedia(uri);
        } catch {
          // Ignore cleanup errors
        }
      }
      setSaveErrorDialogVisible(true);
      return false;
    } finally {
      setLoading(false);
      setIsSaving(false);
    }
  };

  const handleDateConfirm = (selectedDate: Date) => {
    setDate(formatDateInputValue(selectedDate.getTime()));
    setShowDatePicker(false);
  };

  const dateObj = parseDateInputValue(date)
    ? new Date(parseDateInputValue(date)!)
    : new Date();

  return (
    <SafeAreaView style={styles.mainContainer} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              onPress={() => handleSave()}
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
            {/* Date selector */}
            <View style={styles.dateRow}>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.dateText}>
                  {date} {getWeekDayLabel(date)}
                </Text>
              </TouchableOpacity>
              <Text style={styles.charCount}>{content.length} 字</Text>
            </View>

            {/* Title & Content area */}
            <View style={styles.editorArea}>
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

            {/* Media section */}
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

      {/* Draft restore dialog */}
      <StyledDialog
        visible={draftDialogVisible}
        title="发现草稿"
        message="检测到未保存的草稿，是否恢复？"
        buttons={[
          {
            text: '丢弃',
            style: 'destructive',
            onPress: discardDraft,
          },
          {
            text: '恢复',
            style: 'default',
            onPress: restoreDraft,
          },
        ]}
        onDismiss={() => setDraftDialogVisible(false)}
      />

      {/* Not found dialog */}
      <StyledDialog
        visible={notFoundDialogVisible}
        title="提示"
        message="这篇日记不存在或已被删除"
        buttons={[{ text: '确定', style: 'default', onPress: () => {
          setNotFoundDialogVisible(false);
          navigation.goBack();
        } }]}
        onDismiss={() => {
          setNotFoundDialogVisible(false);
          navigation.goBack();
        }}
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
          { text: '不保存', style: 'destructive', onPress: async () => {
            setUnsavedDialogVisible(false);
            try {
              const draftId = getDraftId(diaryId);
              await deleteDraft(draftId);
            } catch (error) {
              console.error('Failed to delete draft on discard:', error);
            }
            if (pendingNavigation) {
              pendingNavigation();
              setPendingNavigation(null);
            }
          }},
          { text: '保存', style: 'default', onPress: async () => {
            setUnsavedDialogVisible(false);
            const success = await handleSave(true);
            if (success && pendingNavigation) {
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

      <DatePickerModal
        visible={showDatePicker}
        date={dateObj}
        onConfirm={handleDateConfirm}
        onCancel={() => setShowDatePicker(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: PAPER_BG,
  },
  contentContainer: {
    flex: 1,
  },
  mediaScroll: {
    flex: 1,
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
    backgroundColor: PAPER_BG,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 112, 48, 0.1)',
  },
  headerButton: {
    minWidth: 50,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    fontFamily: 'LXGWWenKaiLite',
  },
  cancelText: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontFamily: 'LXGWWenKaiLite',
  },
  saveButton: {
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 16,
    color: BRAND_GOLD,
    fontWeight: '600',
    fontFamily: 'LXGWWenKaiLite',
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: PAPER_BG,
    marginTop: 8,
  },
  dateText: {
    fontSize: 15,
    color: BRAND_GOLD,
    fontWeight: '500',
    fontFamily: 'LXGWWenKaiLite',
  },
  charCount: {
    fontSize: 12,
    color: TEXT_MUTED,
    fontFamily: 'LXGWWenKaiLite',
  },
  editorArea: {
    marginHorizontal: 16,
    padding: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(196, 112, 48, 0.12)',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    paddingVertical: 0,
    paddingHorizontal: 4,
    borderWidth: 0,
    backgroundColor: 'transparent',
    height: 40,
    fontFamily: 'LXGWWenKaiLite',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(196, 112, 48, 0.15)',
    marginVertical: 12,
  },
  contentInput: {
    fontSize: 17,
    color: TEXT_PRIMARY,
    lineHeight: 30,
    paddingVertical: 8,
    paddingHorizontal: 4,
    minHeight: 220,
    borderWidth: 0,
    backgroundColor: 'transparent',
    fontFamily: 'LXGWWenKaiLite',
    letterSpacing: 0.3,
  },
  mediaSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: BRAND_GOLD,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(196, 112, 48, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(196, 112, 48, 0.15)',
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: 'LXGWWenKaiLite',
  },
  bottomPadding: {
    height: 40,
  },
});
