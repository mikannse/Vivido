import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { BackupCancelledError, exportBackup, importBackup } from '../services/backup';
import { getAllDiaries } from '../services/database';
import { StyledDialog } from '../components/StyledDialog';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Dialog states
  const [noDiariesDialogVisible, setNoDiariesDialogVisible] = useState(false);
  const [exportSuccessDialogVisible, setExportSuccessDialogVisible] = useState(false);
  const [exportErrorDialogVisible, setExportErrorDialogVisible] = useState(false);
  const [importSuccessDialogVisible, setImportSuccessDialogVisible] = useState(false);
  const [importErrorDialogVisible, setImportErrorDialogVisible] = useState(false);
  const [importConfirmDialogVisible, setImportConfirmDialogVisible] = useState(false);
  const [lastExportResult, setLastExportResult] = useState({ diaryCount: 0, mediaCount: 0 });
  const [lastImportResult, setLastImportResult] = useState({ diaryCount: 0, mediaCount: 0 });

  const handleExport = async () => {
    try {
      const diaries = await getAllDiaries();
      if (diaries.length === 0) {
        setNoDiariesDialogVisible(true);
        return;
      }

      setExporting(true);
      const result = await exportBackup();
      setLastExportResult(result);
      setExportSuccessDialogVisible(true);
    } catch (error) {
      if (error instanceof BackupCancelledError) {
        setExporting(false);
        return;
      }

      console.error('Export failed:', error);
      setExportErrorDialogVisible(true);
    } finally {
      setExporting(false);
    }
  };

  const runImport = async () => {
    setImportConfirmDialogVisible(false);
    try {
      setRestoring(true);
      const result = await importBackup();
      setLastImportResult(result);
      setImportSuccessDialogVisible(true);
    } catch (error) {
      if (error instanceof BackupCancelledError) {
        setRestoring(false);
        return;
      }

      console.error('Import failed:', error);
      setImportErrorDialogVisible(true);
    } finally {
      setRestoring(false);
    }
  };

  const handleImport = () => {
    setImportConfirmDialogVisible(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>数据备份</Text>
          <TouchableOpacity
            style={styles.item}
            onPress={handleExport}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <Text style={styles.itemText}>导出日记备份</Text>
              <Text style={styles.itemDescription}>
                导出为 ZIP 文件，包含 JSON 和所有媒体文件
              </Text>
            </View>
            {exporting ? (
              <ActivityIndicator size="small" color="#c47030" />
            ) : (
              <Text style={styles.arrow}>{'>'}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.item, styles.lastItem]}
            onPress={handleImport}
            disabled={restoring}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <Text style={styles.itemText}>导入完整备份</Text>
              <Text style={styles.itemDescription}>
                选择导出的 .zip 备份文件，恢复日记和全部媒体文件
              </Text>
            </View>
            {restoring ? (
              <ActivityIndicator size="small" color="#c47030" />
            ) : (
              <Text style={styles.arrow}>{'>'}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <View style={styles.item}>
            <Text style={styles.itemText}>版本</Text>
            <Text style={styles.itemValue}>1.0.0</Text>
          </View>
          <View style={[styles.item, styles.lastItem]}>
            <Text style={styles.itemText}>应用名称</Text>
            <Text style={styles.itemValue}>Vivido</Text>
          </View>
        </View>
      </View>

      {/* No diaries to export dialog */}
      <StyledDialog
        visible={noDiariesDialogVisible}
        title="提示"
        message="没有日记可导出"
        buttons={[{ text: '确定', style: 'default', onPress: () => setNoDiariesDialogVisible(false) }]}
        onDismiss={() => setNoDiariesDialogVisible(false)}
      />

      {/* Export success dialog */}
      <StyledDialog
        visible={exportSuccessDialogVisible}
        title="导出完成"
        message={`已导出 ${lastExportResult.diaryCount} 篇日记和 ${lastExportResult.mediaCount} 个媒体文件。\n\n请选择你刚保存的备份文件夹，在另一台设备上通过"导入备份"恢复。`}
        buttons={[{ text: '确定', style: 'default', onPress: () => setExportSuccessDialogVisible(false) }]}
        onDismiss={() => setExportSuccessDialogVisible(false)}
      />

      {/* Export error dialog */}
      <StyledDialog
        visible={exportErrorDialogVisible}
        title="错误"
        message="导出失败"
        buttons={[{ text: '确定', style: 'default', onPress: () => setExportErrorDialogVisible(false) }]}
        onDismiss={() => setExportErrorDialogVisible(false)}
      />

      {/* Import success dialog */}
      <StyledDialog
        visible={importSuccessDialogVisible}
        title="导入完成"
        message={`已恢复 ${lastImportResult.diaryCount} 篇日记和 ${lastImportResult.mediaCount} 个媒体文件。`}
        buttons={[{ text: '确定', style: 'default', onPress: () => setImportSuccessDialogVisible(false) }]}
        onDismiss={() => setImportSuccessDialogVisible(false)}
      />

      {/* Import error dialog */}
      <StyledDialog
        visible={importErrorDialogVisible}
        title="错误"
        message="导入失败"
        buttons={[{ text: '确定', style: 'default', onPress: () => setImportErrorDialogVisible(false) }]}
        onDismiss={() => setImportErrorDialogVisible(false)}
      />

      {/* Import confirm dialog */}
      <StyledDialog
        visible={importConfirmDialogVisible}
        title="导入备份（覆盖）"
        message="导入将删除当前所有日记和媒体文件，替换为备份内容。此操作不可逆，建议先导出当前数据。"
        buttons={[
          { text: '取消', style: 'cancel', onPress: () => setImportConfirmDialogVisible(false) },
          { text: '确认导入', style: 'destructive', onPress: runImport },
        ]}
        onDismiss={() => setImportConfirmDialogVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f6f3',
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
  backText: {
    fontSize: 16,
    color: '#c47030',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3d2c1e',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#827066',
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    backgroundColor: '#fdfcfb',
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(210, 195, 175, 0.4)',
  },
  lastItem: {
    marginTop: 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  itemLeft: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    color: '#3d2c1e',
  },
  itemDescription: {
    fontSize: 12,
    color: '#827066',
    marginTop: 4,
  },
  itemValue: {
    fontSize: 16,
    color: '#827066',
  },
  arrow: {
    fontSize: 18,
    color: '#c4b8ae',
    fontWeight: '300',
  },
});
