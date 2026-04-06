import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Tag } from '../types';
import { getAllTags, createTag, deleteTag } from '../services/database';

interface TagEditorProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
}

export const TagEditor: React.FC<TagEditorProps> = ({
  selectedTags,
  onTagsChange,
}) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Reload tags when screen comes into focus (e.g., after returning from deleting a tag)
  useFocusEffect(
    useCallback(() => {
      loadAllTags();
    }, [])
  );

  const loadAllTags = async () => {
    try {
      const tags = await getAllTags();
      setAllTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const handleAddTag = async (tag: Tag) => {
    if (selectedTags.some((t) => t.id === tag.id)) {
      return; // Already selected
    }
    onTagsChange([...selectedTags, tag]);
  };

  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    try {
      // Check if tag already exists
      const existing = allTags.find((t) => t.name === name);
      if (existing) {
        handleAddTag(existing);
      } else {
        const newTag = await createTag(name);
        setAllTags([...allTags, newTag]);
        handleAddTag(newTag);
      }
      setNewTagName('');
      setShowInput(false);
    } catch (error) {
      console.error('Failed to create tag:', error);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    try {
      await deleteTag(tagId);
      // Update allTags locally
      const newAllTags = allTags.filter((t) => t.id !== tagId);
      setAllTags(newAllTags);
      // Also update selectedTags locally before notifying parent
      const newSelectedTags = selectedTags.filter((t) => t.id !== tagId);
      onTagsChange(newSelectedTags);
    } catch (error) {
      console.error('Failed to delete tag:', error);
    }
  };

  const unselectedTags = allTags.filter(
    (tag) => !selectedTags.some((t) => t.id === tag.id)
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>标签</Text>
        <TouchableOpacity onPress={() => setShowInput(!showInput)}>
          <Text style={styles.addButton}>{showInput ? '取消' : '+ 添加'}</Text>
        </TouchableOpacity>
      </View>

      {showInput && (
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newTagName}
            onChangeText={setNewTagName}
            placeholder="输入标签名称"
            placeholderTextColor="#a89080"
            autoFocus
            multiline={false}
            numberOfLines={1}
            scrollEnabled={false}
            onSubmitEditing={handleCreateTag}
          />
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateTag}
            disabled={!newTagName.trim()}
          >
            <Text style={styles.createButtonText}>创建</Text>
          </TouchableOpacity>
        </View>
      )}

      {selectedTags.length > 0 && (
        <View style={styles.tagsContainer}>
          {selectedTags.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tag, { backgroundColor: tag.color + '20', borderColor: tag.color }]}
              onPress={() => handleDeleteTag(tag.id)}
            >
              <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
              <Text style={[styles.removeIcon, { color: tag.color }]}>×</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {unselectedTags.length > 0 && (
        <View style={styles.availableContainer}>
          <Text style={styles.availableLabel}>可选标签：</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {unselectedTags.map((tag) => (
              <TouchableOpacity
                key={tag.id}
                style={[styles.availableTag, { borderColor: tag.color }]}
                onPress={() => handleAddTag(tag)}
              >
                <Text style={[styles.availableTagText, { color: tag.color }]}>
                  + {tag.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#827066',
  },
  addButton: {
    fontSize: 14,
    color: '#c47030',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#fdfcfb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 0,
    height: 40,
    fontSize: 14,
    color: '#3d2c1e',
    borderWidth: 1,
    borderColor: '#e2ddd8',
  },
  createButton: {
    backgroundColor: '#c47030',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
  },
  removeIcon: {
    marginLeft: 4,
    fontSize: 16,
    fontWeight: '600',
  },
  availableContainer: {
    marginTop: 4,
  },
  availableLabel: {
    fontSize: 12,
    color: '#a89080',
    marginBottom: 8,
  },
  availableTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginRight: 8,
  },
  availableTagText: {
    fontSize: 13,
  },
});
