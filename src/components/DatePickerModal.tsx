import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  BackHandler,
} from 'react-native';

const ITEM_HEIGHT = 36;
const VISIBLE_ITEMS = 5;
const PADDING_COUNT = Math.floor(VISIBLE_ITEMS / 2);

interface DatePickerModalProps {
  visible: boolean;
  date: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const getYearRange = (): number[] => {
  const currentYear = new Date().getFullYear();
  const start = currentYear - 50;
  const end = currentYear + 50;
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};
const YEAR_RANGE = getYearRange();
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month, 0).getDate();
};

const YEAR_FORMAT = (v: number) => `${v}年`;
const MONTH_FORMAT = (v: number) => `${v}月`;
const DAY_FORMAT = (v: number) => `${v}日`;

const WheelColumn: React.FC<{
  data: number[];
  selectedValue: number;
  onChange: (value: number) => void;
  format?: (v: number) => string;
}> = React.memo(({ data, selectedValue, onChange, format }) => {
  const scrollRef = useRef<ScrollView>(null);
  const isDragging = useRef(false);

  const selectedIndex = data.indexOf(selectedValue);

  useEffect(() => {
    if (isDragging.current) return;
    if (scrollRef.current && selectedIndex >= 0) {
      scrollRef.current.scrollTo({
        y: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
  }, [selectedIndex]);

  const handleSnap = (y: number) => {
    const index = Math.round(y / ITEM_HEIGHT);
    const clamped = Math.max(0, Math.min(index, data.length - 1));
    const value = data[clamped];
    if (value !== undefined) {
      onChange(value);
    }
  };

  const handleScrollEnd = (e: any) => {
    isDragging.current = false;
    const y = e.nativeEvent?.contentOffset?.y ?? 0;
    handleSnap(y);
  };

  const handlePressItem = (value: number, index: number) => {
    onChange(value);
    scrollRef.current?.scrollTo({
      y: index * ITEM_HEIGHT,
      animated: true,
    });
  };

  return (
    <View style={styles.column}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        overScrollMode="never"
        onScrollBeginDrag={() => { isDragging.current = true; }}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((value, index) => {
          const isSelected = value === selectedValue;
          return (
            <TouchableOpacity
              key={value}
              style={styles.item}
              onPress={() => handlePressItem(value, index)}
              activeOpacity={0.7}
            >
              <Text style={[styles.itemText, isSelected && styles.selectedItemText]}>
                {format ? format(value) : value}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.maskTop} pointerEvents="none" />
      <View style={styles.indicator} pointerEvents="none" />
      <View style={styles.maskBottom} pointerEvents="none" />
    </View>
  );
});

export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  date,
  onConfirm,
  onCancel,
}) => {
  const [year, setYear] = useState(date.getFullYear());
  const [month, setMonth] = useState(date.getMonth() + 1);
  const [day, setDay] = useState(date.getDate());

  useEffect(() => {
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
    setDay(date.getDate());
  }, [date]);

  const validDays = React.useMemo(() => {
    const days = getDaysInMonth(year, month);
    return Array.from({ length: days }, (_, i) => i + 1);
  }, [year, month]);

  useEffect(() => {
    if (day > validDays.length) {
      setDay(validDays.length);
    }
  }, [year, month, day, validDays.length]);

  const handleConfirm = () => {
    onConfirm(new Date(year, month - 1, day));
  };

  const handleCancel = () => {
    setYear(date.getFullYear());
    setMonth(date.getMonth() + 1);
    setDay(date.getDate());
    onCancel();
  };

  useEffect(() => {
    if (!visible) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleCancel();
      return true;
    });
    return () => subscription.remove();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable style={styles.overlay} onPress={handleCancel} />
      <View style={styles.container} onTouchStart={(e) => e.stopPropagation()}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.title}>选择日期</Text>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.7}>
            <Text style={styles.confirmText}>确定</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pickerRow}>
          <WheelColumn
            data={YEAR_RANGE}
            selectedValue={year}
            onChange={setYear}
            format={YEAR_FORMAT}
          />
          <WheelColumn
            data={MONTHS}
            selectedValue={month}
            onChange={setMonth}
            format={MONTH_FORMAT}
          />
          <WheelColumn
            data={validDays}
            selectedValue={day}
            onChange={setDay}
            format={DAY_FORMAT}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(61, 44, 30, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f0e6',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(196, 112, 48, 0.15)',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#3d2c1e',
    fontFamily: 'LXGWWenKaiLite',
  },
  cancelText: {
    fontSize: 16,
    color: '#7a6250',
    fontFamily: 'LXGWWenKaiLite',
  },
  confirmText: {
    fontSize: 16,
    color: '#c47030',
    fontWeight: '600',
    fontFamily: 'LXGWWenKaiLite',
  },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  column: {
    flex: 1,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    position: 'relative',
  },
  scrollView: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  scrollContent: {
    paddingVertical: PADDING_COUNT * ITEM_HEIGHT,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 16,
    color: '#a48a74',
    fontFamily: 'LXGWWenKaiLite',
  },
  selectedItemText: {
    color: '#3d2c1e',
    fontWeight: '600',
    fontSize: 17,
  },
  maskTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PADDING_COUNT * ITEM_HEIGHT,
    backgroundColor: '#f5f0e6',
    opacity: 0.92,
  },
  maskBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PADDING_COUNT * ITEM_HEIGHT,
    backgroundColor: '#f5f0e6',
    opacity: 0.92,
  },
  indicator: {
    position: 'absolute',
    top: PADDING_COUNT * ITEM_HEIGHT,
    left: 8,
    right: 8,
    height: ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(196, 112, 48, 0.2)',
  },
});
