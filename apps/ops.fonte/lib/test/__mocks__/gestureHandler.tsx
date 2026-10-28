import React, { forwardRef, type ReactElement, type ReactNode } from 'react';
import { ScrollView as RNScrollView, View } from 'react-native';

/**
 * Fake do `react-native-gesture-handler` para o jest (story 225). O módulo
 * real depende de nativo; aqui os builders só GUARDAM os callbacks e a config,
 * e o `GestureDetector` expõe o gesto num `View` com testID
 * `gesture-<testID do filho>` — o teste pega `props.gesture` e dispara os
 * handlers como o nativo faria.
 */
export interface FakeGesture {
  kind: string;
  handlers: Record<string, (...args: unknown[]) => void>;
  config: Record<string, unknown>;
  gestures?: FakeGesture[];
}

const METHODS = [
  'runOnJS', 'enabled', 'activateAfterLongPress', 'minDuration', 'maxDuration', 'shouldCancelWhenOutside',
];
const HANDLERS = ['onBegin', 'onStart', 'onUpdate', 'onChange', 'onEnd', 'onFinalize', 'onTouchesDown'];

function builder(kind: string): FakeGesture & Record<string, (arg: unknown) => unknown> {
  const gesture = { kind, handlers: {}, config: {} } as FakeGesture & Record<string, (arg: unknown) => unknown>;
  for (const m of METHODS) {
    gesture[m] = (value: unknown) => {
      gesture.config[m] = value;
      return gesture;
    };
  }
  for (const h of HANDLERS) {
    gesture[h] = (fn: unknown) => {
      gesture.handlers[h] = fn as (...args: unknown[]) => void;
      return gesture;
    };
  }
  return gesture;
}

export const Gesture = {
  Pan: () => builder('pan'),
  Tap: () => builder('tap'),
  LongPress: () => builder('longPress'),
  Exclusive: (...gestures: FakeGesture[]) => ({ kind: 'exclusive', handlers: {}, config: {}, gestures }),
  Simultaneous: (...gestures: FakeGesture[]) => ({ kind: 'simultaneous', handlers: {}, config: {}, gestures }),
  Race: (...gestures: FakeGesture[]) => ({ kind: 'race', handlers: {}, config: {}, gestures }),
};

export function GestureDetector({ gesture, children }: { gesture: FakeGesture; children: ReactElement }) {
  const childId = (children?.props as { testID?: string } | undefined)?.testID ?? 'child';
  return React.createElement(View, { testID: `gesture-${childId}`, gesture } as never, children);
}

export function GestureHandlerRootView({ children, style }: { children: ReactNode; style?: unknown }) {
  return React.createElement(View, { style } as never, children);
}

export const ScrollView = forwardRef<RNScrollView, React.ComponentProps<typeof RNScrollView>>((props, ref) =>
  React.createElement(RNScrollView, { ...props, ref }),
);
ScrollView.displayName = 'GestureScrollView';
