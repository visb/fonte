import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, type Socket } from 'socket.io-client';
import { apiOrigin } from '@/lib/api';

/**
 * Fábrica única dos canais socket.io do app (notificações, daily — story 225).
 * O token vem do AsyncStorage (o mais recente) com fallback no da sessão; a
 * URL é a origem da API + o namespace.
 */
export async function readSocketToken(fallback: string | null): Promise<string | null> {
  return (await AsyncStorage.getItem('token')) ?? fallback;
}

export function createRealtimeSocket(namespace: string, token: string | null): Socket {
  return io(`${apiOrigin}${namespace}`, {
    transports: ['websocket'],
    auth: { token },
    reconnection: true,
  });
}
