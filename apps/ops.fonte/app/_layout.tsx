import "../global.css";
import { useEffect } from "react";
import { Platform } from "react-native";
import { Stack } from "expo-router";
import Head from "expo-router/head";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import * as SplashScreen from "expo-splash-screen";
import * as Sentry from "@sentry/react-native";
import { AuthProvider } from "@/lib/auth";
import { initSentry } from "@/lib/sentry";
import { queryClient } from "@/lib/queryClient";
import { PERSIST_BUSTER, PERSIST_MAX_AGE } from "@/lib/offline/constants";
import { dehydrateOptions, queryCachePersister } from "@/lib/offline/persister";
import { startFocusWatcher, startNetworkWatcher } from "@/lib/offline/network";

initSentry();

if (Platform.OS !== "web") {
  SplashScreen.preventAutoHideAsync().catch(() => {});
}

const persistOptions = {
  persister: queryCachePersister,
  maxAge: PERSIST_MAX_AGE,
  buster: PERSIST_BUSTER,
  dehydrateOptions,
};

function RootLayout() {
  useEffect(() => {
    if (Platform.OS !== "web") SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Estado de rede (onlineManager) e foreground/background (focusManager):
  // o app precisa saber que está offline para pausar em vez de errar.
  useEffect(() => {
    const stopNetworkWatcher = startNetworkWatcher();
    const stopFocusWatcher = startFocusWatcher();
    return () => {
      stopNetworkWatcher();
      stopFocusWatcher();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
    >
      <Head>
        <title>Fonte de Misericórdia</title>
      </Head>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default Sentry.wrap(RootLayout);
