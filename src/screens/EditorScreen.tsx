import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList, DiaryEntry, MediaItem, Tag } from '../types';
import { getDiaryById, createDiary, updateDiary } from '../services/database';
import { saveMedia, deleteDiaryMedia } from '../services/storage';
import { generateId } from '../utils/uuid';
import { MediaPicker } from '../components/MediaPicker';
import { TagEditor } from '../components/TagEditor';
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
  const [originalMedia, setOriginalMedia] = useState<MediaItem[]>([]);
  const [initialCreatedAt, setInitialCreatedAt] = useState(Date.now());

  useEffect(() => {
    if (isEditing && diaryId) {
      loadDiary(diaryId);
    }
  }, [diaryId]);

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
      } else {
        Alert.alert('提示', '这篇日记不存在或已被删除');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Failed to load diary:', error);
      Alert.alert('错误', '无法加载日记');
    }
  };

  const handleSave = async () => {
    if (!title.trim() && !content.trim() && media.length === 0) {
      Alert.alert('提示', '请填写日记内容');
      return;
    }

    setLoading(true);
    try {
      const parsedCreatedAt = parseDateInputValue(
        date,
        isEditing ? initialCreatedAt : Date.now()
      );

      if (parsedCreatedAt === null) {
        Alert.alert('提示', '请输入有效日期，格式为 YYYY-MM-DD');
        setLoading(false);
        return;
      }

      const savedMedia: MediaItem[] = [];
      for (const item of assignMediaPositions(media)) {
        if (item.uri.startsWith('file://') || item.uri.startsWith('/')) {
          const isOriginal = originalMedia.some((m) => m.id === item.id);
          if (isOriginal) {
            savedMedia.push(item);
          } else {
            const fileName = `${generateId()}.${getMediaFileExtension(item)}`;
            const savedUri = await saveMedia(item.uri, fileName);
            savedMedia.push({ ...item, uri: savedUri });
          }
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

      navigation.goBack();
    } catch (error) {
      console.error('Failed to save diary:', error);
      Alert.alert('错误', '保存失败');
    } finally {
      setLoading(false);
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
          <Text style={styles.mediaLabel}>添加媒体</Text>
          <MediaPicker media={media} onMediaChange={setMedia} />
        </View>

        <TagEditor
          diaryId={diaryId}
          selectedTags={tags}
          onTagsChange={setTags}
        />

        <View style={styles.bottomPadding} />
        </ScrollView>
      </View>
      </KeyboardAvoidingView>
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
    fontFamily: 'LXGWWenKai',
  },
  mediaSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  mediaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#827066',
    marginBottom: 12,
  },
  bottomPadding: {
    height: 40,
  },
});
