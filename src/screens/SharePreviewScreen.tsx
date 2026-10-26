import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { RootStackParamList, DiaryEntry } from '../types';
import { getDiaryById } from '../services/database';
import { StyledDialog } from '../components/StyledDialog';
import { getOrderedMedia } from '../utils/media';
import { colors, typography, alpha } from '../theme';
import {
  captureShareImage,
  saveImageToLibrary,
  shareImage,
  cleanupShareImage,
  cleanupStaleShareImages,
  relocateViewShotFile,
} from '../services/share';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SharePreview'>;
type SharePreviewRouteProp = RouteProp<RootStackParamList, 'SharePreview'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 长图卡片宽度：留出两侧边距，预览与成图共用同一宽度
const CARD_WIDTH = SCREEN_WIDTH - 48;
// 截断规则（Story 5.2）：控制长图最大高度，缓解截图内存压力
const MAX_CONTENT_LINES = 40;
const MAX_IMAGES = 6;
const IMAGE_HEIGHT = CARD_WIDTH * 0.75;

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const formatShareDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`;
};

type DialogState = {
  visible: boolean;
  title: string;
  message: string;
  showSettingsButton: boolean;
};

const CLOSED_DIALOG: DialogState = {
  visible: false,
  title: '',
  message: '',
  showSettingsButton: false,
};

export const SharePreviewScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SharePreviewRouteProp>();
  const { diaryId } = route.params;

  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const [dialog, setDialog] = useState<DialogState>(CLOSED_DIALOG);

  // 截图目标：预览卡片本身即被 captureRef 截取，保证「所见即所得」
  const cardRef = useRef<View>(null);
  // 已生成未清理的临时长图，页面卸载时兜底删除
  const pendingImageUri = useRef<string | null>(null);
  // 在途离开保护：截图异步 resolve 时检查页面是否已卸载
  const mountedRef = useRef(true);

  useEffect(() => {
    cleanupStaleShareImages();
    getDiaryById(diaryId)
      .then(setDiary)
      .catch((error) => {
        console.error('Failed to load diary for share:', error);
        setDiary(null);
      })
      .finally(() => setLoading(false));
  }, [diaryId]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pendingImageUri.current) {
        cleanupShareImage(pendingImageUri.current);
        pendingImageUri.current = null;
      }
    };
  }, []);

  const closeDialog = useCallback(() => setDialog(CLOSED_DIALOG), []);

  // 截图并登记临时文件；失败时弹提示并返回 null
  const captureCard = async (): Promise<string | null> => {
    if (!cardRef.current) {
      return null;
    }
    try {
      const rawUri = await captureShareImage(cardRef);

      // 在途离开保护：组件已卸载时立即删除临时文件
      if (!mountedRef.current) {
        cleanupShareImage(rawUri);
        return null;
      }

      // 统一迁入 cacheDirectory（iOS 上 view-shot 写入 NSTemporaryDirectory/ReactNative），
      // 使 cleanupStaleShareImages 兜底清理在两平台真实生效
      const uri = await relocateViewShotFile(rawUri);

      if (pendingImageUri.current && pendingImageUri.current !== uri) {
        cleanupShareImage(pendingImageUri.current);
      }
      pendingImageUri.current = uri;
      return uri;
    } catch (error) {
      console.error('Failed to capture share image:', error);
      setDialog({
        visible: true,
        title: '生成失败',
        message: '长图生成失败，请重试。若日记内容过长，可先减少图片数量。',
        showSettingsButton: false,
      });
      return null;
    }
  };

  const handleSaveToAlbum = async () => {
    if (busy) return;
    setBusy('save');
    try {
      const uri = await captureCard();
      if (!uri) return;
      const result = await saveImageToLibrary(uri);
      if (result.status === 'saved') {
        // 已入相册，临时文件使命完成
        cleanupShareImage(uri);
        if (pendingImageUri.current === uri) {
          pendingImageUri.current = null;
        }
        setDialog({
          visible: true,
          title: '已保存',
          message: '长图已保存到系统相册。',
          showSettingsButton: false,
        });
      } else {
        setDialog({
          visible: true,
          title: '无法保存',
          message: result.canAskAgain
            ? 'Vivido 没有相册写入权限，请在弹出的系统请求中允许访问。'
            : '相册权限已被拒绝。请到系统设置中为 Vivido 开启相册权限后重试。',
          showSettingsButton: !result.canAskAgain,
        });
      }
    } catch (error) {
      console.error('Failed to save share image:', error);
      setDialog({
        visible: true,
        title: '保存失败',
        message: '保存到相册时出错，请重试。',
        showSettingsButton: false,
      });
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (busy) return;
    setBusy('share');
    try {
      const uri = await captureCard();
      if (!uri) return;
      const shared = await shareImage(uri);

      // 分享完成后清理临时文件（与保存路径遵循相同约定）
      cleanupShareImage(uri);
      if (pendingImageUri.current === uri) {
        pendingImageUri.current = null;
      }

      if (!shared) {
        setDialog({
          visible: true,
          title: '无法分享',
          message: '当前设备不支持系统分享面板。',
          showSettingsButton: false,
        });
      }
    } catch (error) {
      console.error('Failed to share image:', error);
      setDialog({
        visible: true,
        title: '分享失败',
        message: '打开分享面板时出错，请重试。',
        showSettingsButton: false,
      });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!diary) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>这篇日记不存在或已被删除</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>返回</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const orderedImages = getOrderedMedia(diary.media)
    .filter((m) => m.type === 'image')
    .slice(0, MAX_IMAGES);
  const totalImages = getOrderedMedia(diary.media).filter((m) => m.type === 'image').length;
  const imagesTruncated = totalImages > MAX_IMAGES;
  const nonImageMedia = getOrderedMedia(diary.media).filter((m) => m.type !== 'image');
  const hasNonImageMedia = nonImageMedia.length > 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.flex} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>← 返回</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>分享长图</Text>
          <View style={styles.headerButton} />
        </View>

        {/* 长图预览：卡片本身即截图目标 */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View ref={cardRef} collapsable={false} style={styles.card}>
            {/* 标题 */}
            <Text style={styles.cardTitle}>{diary.title || '无标题'}</Text>

            {/* 正文（超长截断） */}
            {diary.content ? (
              <Text style={styles.cardContent} numberOfLines={MAX_CONTENT_LINES}>
                {diary.content}
              </Text>
            ) : null}

            {/* 正文截断提示（在卡片内，随截图进入成图） */}
            {diary.content && diary.content.split('\n').length > MAX_CONTENT_LINES && (
              <Text style={styles.truncateHint}>……（正文较长，长图中已省略）</Text>
            )}

            {/* 图片（仅图片类型，最多 MAX_IMAGES 张） */}
            {orderedImages.length > 0 && (
              <View style={styles.cardImages}>
                {orderedImages.map((item) => (
                  <Image
                    key={item.id}
                    source={{ uri: item.uri }}
                    style={styles.cardImage}
                    contentFit="cover"
                  />
                ))}
              </View>
            )}

            {/* 图片截断/媒体缺失提示 */}
            {(imagesTruncated || hasNonImageMedia) && (
              <View style={styles.cardTruncationWarnings}>
                {imagesTruncated && (
                  <Text style={styles.truncateHint}>
                    +{totalImages - MAX_IMAGES} 张图片未展示
                  </Text>
                )}
                {hasNonImageMedia && (
                  <Text style={styles.truncateHint}>
                    含 {nonImageMedia.length} 个{nonImageMedia.some(m => m.type === 'video') ? '视频' : ''}
                    {nonImageMedia.some(m => m.type === 'video') && nonImageMedia.some(m => m.type === 'audio') ? '、' : ''}
                    {nonImageMedia.some(m => m.type === 'audio') ? '语音' : ''}，未包含在长图中
                  </Text>
                )}
              </View>
            )}

            {/* 标签 */}
            {diary.tags.length > 0 && (
              <View style={styles.cardTags}>
                {diary.tags.map((tag) => (
                  <View key={tag.id} style={styles.tagPill}>
                    <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    <Text style={styles.tagText}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 日期（AC 要求：卡片底部始终包含日期与品牌水印） */}
            <Text style={styles.cardDate}>{formatShareDate(diary.createdAt)}</Text>

            {/* 品牌水印 */}
            <View style={styles.cardFooter}>
              <View style={styles.footerDivider} />
              <Text style={styles.watermark}>Vivido</Text>
            </View>
          </View>

          <Text style={styles.hint}>实际长图与预览一致 · 仅图片会进入长图</Text>
        </ScrollView>

        {/* 底部操作栏 */}
        <SafeAreaView edges={['bottom']} style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.actionButton, styles.saveButton, busy !== null && styles.actionDisabled]}
            onPress={handleSaveToAlbum}
            disabled={busy !== null}
            activeOpacity={0.85}
          >
            {busy === 'save' ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>保存到相册</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton, busy !== null && styles.actionDisabled]}
            onPress={handleShare}
            disabled={busy !== null}
            activeOpacity={0.85}
          >
            {busy === 'share' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={styles.shareButtonText}>分享</Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </SafeAreaView>

      <StyledDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        buttons={
          dialog.showSettingsButton
            ? [
                { text: '取消', style: 'cancel', onPress: closeDialog },
                {
                  text: '去设置',
                  style: 'default',
                  onPress: () => {
                    closeDialog();
                    Linking.openSettings();
                  },
                },
              ]
            : [{ text: '好的', style: 'default', onPress: closeDialog }]
        }
        onDismiss={closeDialog}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.text,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    minWidth: 60,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#f5f0e6',
    borderRadius: 4,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 24,
  },
  cardDate: {
    fontSize: 13,
    color: colors.textTertiary,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 10,
    ...typography.body,
  },
  cardTruncationWarnings: {
    marginTop: 14,
    gap: 6,
  },
  truncateHint: {
    fontSize: 12,
    color: colors.textTertiary,
    lineHeight: 20,
    fontStyle: 'italic',
    ...typography.body,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 34,
    letterSpacing: 1,
    marginBottom: 18,
    ...typography.body,
  },
  cardContent: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 30,
    letterSpacing: 0.3,
    marginBottom: 8,
    ...typography.body,
  },
  cardImages: {
    marginTop: 12,
    gap: 10,
  },
  cardImage: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    backgroundColor: alpha(colors.textTertiary, 0.12),
  },
  cardTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: alpha(colors.primary, 0.08),
  },
  tagDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    color: colors.textSecondary,
    ...typography.body,
  },
  cardFooter: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerDivider: {
    width: 40,
    height: 1,
    backgroundColor: alpha(colors.primary, 0.3),
    marginBottom: 12,
  },
  watermark: {
    fontSize: 15,
    color: alpha(colors.primary, 0.45),
    letterSpacing: 3,
    ...typography.appName,
  },
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 14,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionDisabled: {
    opacity: 0.6,
  },
  saveButton: {
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  shareButton: {
    backgroundColor: alpha(colors.primary, 0.1),
  },
  shareButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
