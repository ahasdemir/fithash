import React, { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  LayoutChangeEvent,
  Platform,
  ViewStyle,
  GestureResponderHandlers,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, useTheme, subscribeTheme } from '../theme';
import { moveArrayItem, computeTargetIndex } from '../utils/dragReorder';

export { moveArrayItem, computeTargetIndex };

export interface DraggableListRenderProps<T> {
  item: T;
  index: number;
  isDragging: boolean;
  /** Spread onto the grip handle View to enable vertical drag-to-reorder */
  dragHandleProps: GestureResponderHandlers;
}

interface DraggableListProps<T> {
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  onReorder: (nextItems: T[], fromIndex: number, toIndex: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  renderItem: (info: DraggableListRenderProps<T>) => React.ReactNode;
  gap?: number;
  style?: ViewStyle;
  disabled?: boolean;
}

interface DraggableRowProps<T> {
  item: T;
  index: number;
  isActive: boolean;
  anyDragging: boolean;
  disabled: boolean;
  shiftOffset: number;
  dragY: Animated.Value;
  onMeasureHeight: (index: number, height: number) => void;
  onDragStart: (index: number) => void;
  onDragMove: (dy: number) => void;
  onDragEnd: () => void;
  renderItem: (info: DraggableListRenderProps<T>) => React.ReactNode;
}

function DraggableRow<T>({
  item,
  index,
  isActive,
  anyDragging,
  disabled,
  shiftOffset,
  dragY,
  onMeasureHeight,
  onDragStart,
  onDragMove,
  onDragEnd,
  renderItem,
}: DraggableRowProps<T>) {
  const indexRef = useRef(index);
  indexRef.current = index;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd };

  const shiftAnim = useRef(new Animated.Value(0)).current;

  useLayoutEffect(() => {
    if (!anyDragging) {
      shiftAnim.setValue(0);
      return;
    }
    if (isActive) {
      shiftAnim.setValue(0);
      return;
    }
    Animated.timing(shiftAnim, {
      toValue: shiftOffset,
      duration: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [shiftOffset, anyDragging, isActive, shiftAnim]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: (_, gs) =>
        !disabledRef.current && Math.abs(gs.dy) > 2,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        callbacksRef.current.onDragStart(indexRef.current);
      },
      onPanResponderMove: (_, gestureState) => {
        callbacksRef.current.onDragMove(gestureState.dy);
      },
      onPanResponderRelease: () => {
        callbacksRef.current.onDragEnd();
      },
      onPanResponderTerminate: () => {
        callbacksRef.current.onDragEnd();
      },
    })
  ).current;

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      if (h > 0) {
        onMeasureHeight(indexRef.current, h);
      }
    },
    [onMeasureHeight]
  );

  const animatedStyle = isActive
    ? {
        zIndex: 50,
        elevation: 6,
        opacity: 0.96,
        transform: [{ translateY: dragY }, { scale: 1.01 }],
      }
    : {
        zIndex: 1,
        transform: [{ translateY: shiftAnim }],
      };

  return (
    <Animated.View style={[animatedStyle]} onLayout={handleLayout}>
      {renderItem({
        item,
        index,
        isDragging: isActive,
        dragHandleProps: disabled ? {} : panResponder.panHandlers,
      })}
    </Animated.View>
  );
}

/**
 * Reusable grip handle atom styled for FitHash's minimalist UI.
 */
export const DragGripHandle: React.FC<{
  dragHandleProps: GestureResponderHandlers;
  isDragging?: boolean;
  compact?: boolean;
}> = ({ dragHandleProps, isDragging = false, compact = false }) => {
  useTheme();
  return (
    <View
      {...dragHandleProps}
      accessibilityLabel="Sürükleyerek sırala"
      style={[
        gripStyles.handle,
        compact && gripStyles.handleCompact,
        isDragging && gripStyles.handleActive,
        Platform.OS === 'web'
          ? ({
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'none',
            } as any)
          : null,
      ]}
    >
      <Ionicons
        name="reorder-three-outline"
        size={compact ? 16 : 18}
        color={isDragging ? COLORS.primaryText : COLORS.textMuted}
      />
    </View>
  );
};

export function DraggableList<T>({
  items,
  keyExtractor,
  onReorder,
  onDragStateChange,
  renderItem,
  gap = 10,
  style,
  disabled = false,
}: DraggableListProps<T>) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const heightsRef = useRef<number[]>([]);
  const draggingIndexRef = useRef<number | null>(null);
  const targetIndexRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const onDragStateChangeRef = useRef(onDragStateChange);
  onDragStateChangeRef.current = onDragStateChange;

  useEffect(() => {
    if (heightsRef.current.length !== items.length) {
      const next = new Array(items.length).fill(0);
      for (let i = 0; i < Math.min(items.length, heightsRef.current.length); i++) {
        next[i] = heightsRef.current[i];
      }
      heightsRef.current = next;
    }
  }, [items.length]);

  useEffect(() => {
    return () => {
      if (draggingIndexRef.current !== null) {
        onDragStateChangeRef.current?.(false);
      }
    };
  }, []);

  const handleMeasureHeight = useCallback((index: number, height: number) => {
    heightsRef.current[index] = height;
  }, []);

  const handleDragStart = useCallback(
    (index: number) => {
      if (disabled || itemsRef.current.length <= 1) return;
      draggingIndexRef.current = index;
      targetIndexRef.current = index;
      dragY.setValue(0);
      setDraggingIndex(index);
      setTargetIndex(index);
      onDragStateChangeRef.current?.(true);
    },
    [disabled, dragY]
  );

  const handleDragMove = useCallback(
    (dy: number) => {
      const from = draggingIndexRef.current;
      if (from === null) return;
      dragY.setValue(dy);
      const nextTarget = computeTargetIndex(from, dy, heightsRef.current, gap);
      if (nextTarget !== targetIndexRef.current) {
        targetIndexRef.current = nextTarget;
        setTargetIndex(nextTarget);
      }
    },
    [dragY, gap]
  );

  const handleDragEnd = useCallback(() => {
    const from = draggingIndexRef.current;
    const to = targetIndexRef.current;

    draggingIndexRef.current = null;
    targetIndexRef.current = null;
    dragY.setValue(0);
    setDraggingIndex(null);
    setTargetIndex(null);
    onDragStateChangeRef.current?.(false);

    if (from !== null && to !== null && from !== to) {
      const reordered = moveArrayItem(itemsRef.current, from, to);
      onReorderRef.current(reordered, from, to);
    }
  }, [dragY]);

  const activeHeight =
    draggingIndex !== null ? (heightsRef.current[draggingIndex] || 80) + gap : 0;

  return (
    <View style={[{ gap }, style]}>
      {items.map((item, index) => {
        let shiftOffset = 0;
        if (draggingIndex !== null && targetIndex !== null && index !== draggingIndex) {
          if (draggingIndex < targetIndex && index > draggingIndex && index <= targetIndex) {
            shiftOffset = -activeHeight;
          } else if (draggingIndex > targetIndex && index >= targetIndex && index < draggingIndex) {
            shiftOffset = activeHeight;
          }
        }

        return (
          <DraggableRow
            key={keyExtractor(item, index)}
            item={item}
            index={index}
            isActive={draggingIndex === index}
            anyDragging={draggingIndex !== null}
            disabled={disabled || items.length <= 1}
            shiftOffset={shiftOffset}
            dragY={dragY}
            onMeasureHeight={handleMeasureHeight}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            renderItem={renderItem}
          />
        );
      })}
    </View>
  );
}

const createGripStyles = () =>
  StyleSheet.create({
    handle: {
      width: 28,
      height: 32,
      borderRadius: 6,
      backgroundColor: COLORS.surfaceSubtle,
      borderWidth: 1,
      borderColor: COLORS.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    handleCompact: {
      width: 26,
      height: 28,
      borderRadius: 6,
    },
    handleActive: {
      backgroundColor: COLORS.primary,
      borderColor: COLORS.primary,
    },
  });

let gripStyles = createGripStyles();
subscribeTheme(() => {
  gripStyles = createGripStyles();
});
