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
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import { startOutboxReplay } from "@/lib/offline/outbox";
import { hydrateResidentQueries } from "@/lib/offline/store/hydrate";
import { attachResidentStoreWriteThrough } from "@/lib/offline/store/writeThrough";

initSentry();

// Antes de qualquer reidratação: mutation pausada volta do disco sem a
// `mutationFn` (função não é serializável) e só é retomável se o default da sua
// `mutationKey` já estiver registrado (story 169).
registerMutationDefaults(queryClient);

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
    // Replay da outbox na volta da rede (o outro gatilho é a reidratação).
    const stopOutboxReplay = startOutboxReplay(queryClient);
    // Store local dos filhos (story 175): o que já está no aparelho vai para o
    // cache antes de qualquer rede, e toda query do domínio que voltar da rede
    // é gravada de volta no store.
    const stopWriteThrough = attachResidentStoreWriteThrough(queryClient);
    void hydrateResidentQueries(queryClient);
    return () => {
      stopNetworkWatcher();
      stopFocusWatcher();
      stopOutboxReplay();
      stopWriteThrough();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        // Cache reidratado: os lançamentos que ficaram pausados no disco voltam
        // para a fila e são enviados em ordem de entrada (FIFO).
        void queryClient.resumePausedMutations();
      }}
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
