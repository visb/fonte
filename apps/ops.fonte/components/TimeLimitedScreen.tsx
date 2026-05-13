import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUsageTimerContext } from '@/lib/UsageTimerContext';

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

interface Props {
  children: React.ReactNode;
}

export function TimeLimitedScreen({ children }: Props) {
  const { secondsRemaining, isBlocked, isLoading, startTracking, stopTracking } =
    useUsageTimerContext();

  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, [startTracking, stopTracking]); // both are stable — effect runs once

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (isBlocked) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Ionicons name="time-outline" size={48} color="#d1d5db" />
        <Text className="text-lg font-semibold text-gray-700 mt-4 text-center">
          Tempo esgotado
        </Text>
        <Text className="text-sm text-gray-500 mt-2 text-center">
          Você atingiu o limite diário de 20 minutos. O acesso será liberado novamente amanhã.
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="bg-[#272950] px-4 py-2 flex-row items-center justify-between">
        <Ionicons name="time-outline" size={16} color="#d1d5db" />
        <Text className="text-xs text-gray-300 ml-2 flex-1">Tempo restante hoje</Text>
        <Text
          className={`text-sm font-bold ${secondsRemaining < 120 ? 'text-red-400' : 'text-white'}`}
        >
          {formatTime(secondsRemaining)}
        </Text>
      </View>
      {children}
    </View>
  );
}
