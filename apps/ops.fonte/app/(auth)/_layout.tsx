import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function AuthLayout() {
  return (
    <>
      {/* Telas de auth são bg-white: sem isto herdariam o style="light" do
          grupo (app) na volta da navegação e os ícones sumiriam no branco. */}
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
