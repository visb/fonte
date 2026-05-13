import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WishlistStatus } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import {
  useAddWishlistItem,
  usePendingWishlistItems,
  useApproveWishlistItem,
  useRejectWishlistItem,
  useRemoveWishlistItem,
  useWishlistItems,
} from '../hooks/useWishlist';
import type { WishlistItem, WishlistPendingItem } from '@fonte/api-client';

type ResidentTab = 'Aprovados' | 'Pendentes' | 'Recusados';
const RESIDENT_TABS: ResidentTab[] = ['Aprovados', 'Pendentes', 'Recusados'];

function ResidentWishlistPage({ residentId }: { residentId: string }) {
  const [activeTab, setActiveTab] = useState<ResidentTab>('Aprovados');
  const [addOpen, setAddOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [refreshing, setRefreshing] = useState(false);

  const { data: items = [], refetch } = useWishlistItems(residentId);
  const addMutation = useAddWishlistItem(residentId);
  const removeMutation = useRemoveWishlistItem(residentId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleAdd = () => {
    if (!description.trim()) return;
    addMutation.mutate(
      { description: description.trim(), quantity: parseInt(quantity) || 1 },
      {
        onSuccess: () => {
          setAddOpen(false);
          setDescription('');
          setQuantity('1');
        },
      },
    );
  };

  const approved = items.filter(
    (i) => i.status === WishlistStatus.APPROVED && !i.isRemovalRequested,
  );
  const pending = items.filter(
    (i) =>
      i.status === WishlistStatus.PENDING_APPROVAL || i.isRemovalRequested,
  );
  const rejected = items.filter((i) => i.status === WishlistStatus.REJECTED);

  const tabData: Record<ResidentTab, WishlistItem[]> = {
    Aprovados: approved,
    Pendentes: pending,
    Recusados: rejected,
  };

  const counts: Record<ResidentTab, number> = {
    Aprovados: approved.length,
    Pendentes: pending.length,
    Recusados: rejected.length,
  };

  const visibleItems = tabData[activeTab];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Tab bar */}
      <View className="flex-row bg-white border-b border-gray-200">
        {RESIDENT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === tab ? 'border-blue-600' : 'border-transparent'
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                activeTab === tab ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {tab}
              {counts[tab] > 0 ? ` (${counts[tab]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerClassName="pb-4"
        renderItem={({ item }) => (
          <View className="bg-white border-b border-gray-100 px-4 py-3">
            <View className="flex-row items-center">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-900">{item.description}</Text>
                <Text className="text-xs text-gray-400 mt-0.5">
                  {item.isRemovalRequested
                    ? 'Remoção aguardando aprovação'
                    : `Qtd: ${item.quantity}`}
                </Text>
              </View>
              {item.status === WishlistStatus.APPROVED && !item.isRemovalRequested && (
                <TouchableOpacity
                  onPress={() => removeMutation.mutate(item.id)}
                  disabled={removeMutation.isPending}
                  className="p-2"
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
            {item.status === WishlistStatus.REJECTED && item.rejectionReason && (
              <View className="mt-1.5 bg-red-50 rounded-lg px-3 py-2">
                <Text className="text-xs text-red-600">{item.rejectionReason}</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons
              name={
                activeTab === 'Aprovados'
                  ? 'gift-outline'
                  : activeTab === 'Pendentes'
                    ? 'time-outline'
                    : 'close-circle-outline'
              }
              size={40}
              color="#d1d5db"
            />
            <Text className="text-base font-medium text-gray-400 mt-4">
              {activeTab === 'Aprovados'
                ? 'Nenhum item aprovado'
                : activeTab === 'Pendentes'
                  ? 'Nenhum item pendente'
                  : 'Nenhum item recusado'}
            </Text>
            {activeTab === 'Aprovados' && (
              <Text className="text-sm text-gray-400 mt-1 text-center px-8">
                Adicione itens que gostaria que a família trouxesse na visita
              </Text>
            )}
          </View>
        }
      />

      <TouchableOpacity
        onPress={() => setAddOpen(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#272950] items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <Modal visible={addOpen} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-base font-semibold text-gray-900 mb-4">Adicionar item</Text>
            <Text className="text-sm text-gray-500 mb-1">Descrição</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3"
              value={description}
              onChangeText={setDescription}
              placeholder="Ex: Bermuda azul tamanho M"
            />
            <Text className="text-sm text-gray-500 mb-1">Quantidade</Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 w-24"
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="1"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                className="flex-1 border border-gray-200 rounded-lg py-3 items-center"
              >
                <Text className="text-sm text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!description.trim() || addMutation.isPending}
                className="flex-1 bg-[#272950] rounded-lg py-3 items-center"
              >
                <Text className="text-sm text-white font-medium">
                  {addMutation.isPending ? 'Adicionando...' : 'Adicionar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StaffWishlistPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: pending = [], refetch } = usePendingWishlistItems();
  const approveMutation = useApproveWishlistItem();
  const rejectMutation = useRejectWishlistItem();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const openReject = (itemId: string) => {
    setRejectTarget(itemId);
    setRejectReason('');
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    rejectMutation.mutate(
      { itemId: rejectTarget, data: rejectReason.trim() ? { reason: rejectReason.trim() } : undefined },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setRejectReason('');
        },
      },
    );
  };

  return (
    <>
      <FlatList
        data={pending as WishlistPendingItem[]}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }) => {
          const isPending = approveMutation.isPending || rejectMutation.isPending;
          return (
            <View className="bg-white border-b border-gray-100 px-4 py-3">
              <Text className="text-xs text-gray-400 mb-1">{item.residentName}</Text>
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-medium text-gray-900">{item.description}</Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Qtd: {item.quantity}
                    {item.isRemovalRequested ? ' · Solicitando remoção' : ''}
                  </Text>
                </View>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => approveMutation.mutate(item.id)}
                    disabled={isPending}
                    className="bg-green-50 border border-green-200 rounded-lg px-3 py-1.5"
                  >
                    <Ionicons name="checkmark" size={16} color="#16a34a" />
                  </Pressable>
                  <Pressable
                    onPress={() => openReject(item.id)}
                    disabled={isPending}
                    className="bg-red-50 border border-red-200 rounded-lg px-3 py-1.5"
                  >
                    <Ionicons name="close" size={16} color="#dc2626" />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
            <Text className="text-base font-medium text-gray-400 mt-4">
              Nenhum pedido pendente
            </Text>
          </View>
        }
      />

      <Modal visible={!!rejectTarget} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6">
            <Text className="text-base font-semibold text-gray-900 mb-1">Recusar item</Text>
            <Text className="text-sm text-gray-500 mb-4">
              Motivo (opcional) — será exibido ao filho
            </Text>
            <TextInput
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Ex: Não permitido na fase atual"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setRejectTarget(null)}
                className="flex-1 border border-gray-200 rounded-lg py-3 items-center"
              >
                <Text className="text-sm text-gray-600">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleReject}
                disabled={rejectMutation.isPending}
                className="flex-1 bg-red-600 rounded-lg py-3 items-center"
              >
                <Text className="text-sm text-white font-medium">
                  {rejectMutation.isPending ? 'Recusando...' : 'Recusar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

export function WishlistPage() {
  const { isResident, resident } = useAuth();

  if (isResident && resident) {
    return <ResidentWishlistPage residentId={resident.id} />;
  }

  return <StaffWishlistPage />;
}
