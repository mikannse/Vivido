import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../types';
import { BackupCancelledError, exportBackup, importBackup } from '../services/backup';
import { getAllDiaries } from '../services/database';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const handleExport = async () => {
    try {
      const diaries = await getAllDiaries();
      if (diaries.length === 0) {
        Alert.alert('提示', '没有日记可导出');
        return;
      }

      setExporting(true);
      const result = await exportBackup();
      Alert.alert(
        '导出完成',
        `已导出 ${result.diaryCount} 篇日记和 ${result.mediaCount} 个媒体文件。\n\n请选择你刚保存的备份文件夹，在另一台设备上通过“导入备份”恢复。`
      );
    } catch (error) {
      if (error instanceof BackupCancelledError) {
        return;
      }

      console.error('Export failed:', error);
      Alert.alert('错误', '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const runImport = async () => {
    try {
      setRestoring(true);
      const result = await importBackup();
      Alert.alert(
        '导入完成',
        `已恢复 ${result.diaryCount} 篇日记和 ${result.mediaCount} 个媒体文件。`
      );
    } catch (error) {
      if (error instanceof BackupCancelledError) {
        return;
      }

      console.error('Import failed:', error);
      Alert.alert('错误', '导入失败');
    } finally {
      setRestoring(false);
    }
  };

  const handleImport = () => {
    Alert.alert(
      '导入备份',
      '导入会覆盖当前设备上的全部日记和媒体，是否继续？',
      [
        { text: '取消', style: 'cancel' },
        { text: '继续', style: 'destructive', onPress: runImport },
      ]
    );
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
                导出为JSON文件，可用于数据备份
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
                选择导出的备份文件夹，恢复日记和全部媒体文件
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
