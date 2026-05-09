import { useEffect, useRef } from 'react';
import { Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';

export function SuccessBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    translateY.value = withTiming(0, { duration: 250 });
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(
        3500,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(dismissRef.current)();
        }),
      ),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  function handleDismiss() {
    opacity.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) runOnJS(dismissRef.current)();
    });
  }

  return (
    <Animated.View
      style={[
        style,
        {
          backgroundColor: '#16a34a',
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 12,
          marginBottom: 4,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
      ]}
    >
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text
        style={{
          flex: 1,
          color: '#fff',
          fontSize: 14,
          fontWeight: '500',
          marginLeft: 8,
        }}
      >
        {message}
      </Text>
      <Pressable onPress={handleDismiss} hitSlop={8}>
        <Ionicons name="close" size={18} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}
