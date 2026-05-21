import { useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WishlistStatus } from '@fonte/types';
import { useAuth } from '@/lib/auth';
import {
  useApproveWishlistItem,
  usePendingWishlistItems,
  useRemoveWishlistItem,
  useWishlistItems,
} from '../hooks/useWishlist';
import type { WishlistItem, WishlistPendingItem } from '@fonte/api-client';
import { WishlistItemRow } from '../components/WishlistItemRow';
import { AddWishlistItemModal } from '../components/AddWishlistItemModal';
import { PendingWishlistItemRow } from '../components/PendingWishlistItemRow';
import { RejectWishlistItemModal } from '../components/RejectWishlistItemModal';

type ResidentTab = 'Aprovados' | 'Pendentes' | 'Recusados';
const RESIDENT_TABS: ResidentTab[] = ['Aprovados', 'Pendentes', 'Recusados'];

const EMPTY_ICONS: Record<ResidentTab, string> = {
  Aprovados: 'gift-outline',
  Pendentes: 'time-outline',
  Recusados: 'close-circle-outline',
};

const EMPTY_LABELS: Record<ResidentTab, string> = {
  Aprovados: 'Nenhum item aprovado',
  Pendentes: 'Nenhum item pendente',
  Recusados: 'Nenhum item recusado',
};

function ResidentWishlistPage({ residentId }: { residentId: string }) {
  const [activeTab, setActiveTab] = useState<ResidentTab>('Aprovados');
  const [addOpen, setAddOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: items = [], refetch } = useWishlistItems(residentId);
  const removeMutation = useRemoveWishlistItem(residentId);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const approved = items.filter((i) => i.status === WishlistStatus.APPROVED && !i.isRemovalRequested);
  const pending = items.filter((i) => i.status === WishlistStatus.PENDING_APPROVAL || i.isRemovalRequested);
  const rejected = items.filter((i) => i.status === WishlistStatus.REJECTED);

  const tabData: Record<ResidentTab, WishlistItem[]> = { Aprovados: approved, Pendentes: pending, Recusados: rejected };
  const counts: Record<ResidentTab, number> = { Aprovados: approved.length, Pendentes: pending.length, Recusados: rejected.length };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="flex-row bg-white border-b border-gray-200">
        {RESIDENT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab ? 'border-blue-600' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium ${activeTab === tab ? 'text-blue-600' : 'text-gray-500'}`}>
              {tab}{counts[tab] > 0 ? ` (${counts[tab]})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tabData[activeTab]}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerClassName="pb-4"
        renderItem={({ item }: { item: WishlistItem }) => (
          <WishlistItemRow
            item={item}
            onRemove={(id) => removeMutation.mutate(id)}
            isRemoving={removeMutation.isPending}
          />
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name={EMPTY_ICONS[activeTab] as never} size={40} color="#d1d5db" />
            <Text className="text-base font-medium text-gray-400 mt-4">{EMPTY_LABELS[activeTab]}</Text>
            {activeTab === 'Aprovados' && (
              <Text className="text-sm text-gray-400 mt-1 text-center px-8">
                Adicione itens que gostaria que a família trouxesse na visita
              </Text>
            )}
          </View>
        }
      />

      <TouchableOpacity
        accessibilityLabel="Adicionar item"
        onPress={() => setAddOpen(true)}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-[#272950] items-center justify-center shadow-lg"
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <AddWishlistItemModal visible={addOpen} onClose={() => setAddOpen(false)} residentId={residentId} />
    </View>
  );
}

function StaffWishlistPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const { data: pending = [], refetch } = usePendingWishlistItems();
  const approveMutation = useApproveWishlistItem();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <>
      <FlatList
        data={pending as WishlistPendingItem[]}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        renderItem={({ item }: { item: WishlistPendingItem }) => (
          <PendingWishlistItemRow
            item={item}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(id) => setRejectTarget(id)}
            isPending={approveMutation.isPending}
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
            <Text className="text-base font-medium text-gray-400 mt-4">Nenhum pedido pendente</Text>
          </View>
        }
      />
      <RejectWishlistItemModal itemId={rejectTarget} onClose={() => setRejectTarget(null)} />
    </>
  );
}

export function WishlistPage() {
  const { isResident, resident } = useAuth();
  if (isResident && resident) return <ResidentWishlistPage residentId={resident.id} />;
  return <StaffWishlistPage />;
}
