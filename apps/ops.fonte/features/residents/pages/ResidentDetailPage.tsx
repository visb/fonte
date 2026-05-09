import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useResidentById,
  useResidentRelatives,
  useResidentAttachments,
} from '../hooks/useResidents';
import { ChangeMinistryModal } from '../components/ChangeMinistryModal';
import { resolveAssetUrl } from '@/lib/api';

const TABS = ['Visão Geral', 'Acompanhamento', 'Familiares', 'Anexos'] as const;
type Tab = (typeof TABS)[number];

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <View className="py-2.5 border-b border-gray-100 flex-row">
      <Text className="text-sm text-gray-500 w-36">{label}</Text>
      <Text className="text-sm text-gray-900 flex-1">{value || '—'}</Text>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-1">
      {children}
    </Text>
  );
}

function fmt(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

export function ResidentDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<Tab>('Visão Geral');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ministryModalOpen, setMinistryModalOpen] = useState(false);

  const { data: resident, isLoading, refetch } = useResidentById(id);

  const { data: relatives = [], isLoading: loadingRelatives } =
    useResidentRelatives(id, { enabled: activeTab === 'Familiares' });

  const { data: attachments = [], isLoading: loadingAttachments } =
    useResidentAttachments(id, { enabled: activeTab === 'Anexos' });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!resident) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-gray-500">Filho não encontrado.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: resident.name }} />

      <View className="flex-1 bg-white">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="border-b border-gray-200 flex-grow-0"
          contentContainerClassName="px-4"
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`py-3 px-3 mr-1 border-b-2 ${
                activeTab === tab
                  ? 'border-blue-600'
                  : 'border-transparent'
              }`}
            >
              <Text
                className={`text-sm font-medium ${
                  activeTab === tab ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
        >
          {activeTab === 'Visão Geral' && (
            <View className="px-4 py-4">
              <SectionLabel>Ministério</SectionLabel>
              <View className="py-2.5 border-b border-gray-100 flex-row items-center">
                <Text className="text-sm text-gray-500 w-36">Atual</Text>
                <Text className="text-sm text-gray-900 flex-1">
                  {resident.ministry?.name ?? '—'}
                </Text>
                <TouchableOpacity
                  onPress={() => setMinistryModalOpen(true)}
                  className="ml-2"
                >
                  <Text className="text-sm text-blue-600 font-medium">
                    Alterar
                  </Text>
                </TouchableOpacity>
              </View>

              <SectionLabel>Identificação</SectionLabel>
              <Row label="Nome" value={resident.name} />
              <Row label="CPF" value={resident.cpf} />
              <Row label="Data de nasc." value={fmt(resident.birthDate)} />
              <Row
                label="Gênero"
                value={
                  resident.gender === 'MALE'
                    ? 'Masculino'
                    : resident.gender === 'FEMALE'
                      ? 'Feminino'
                      : null
                }
              />

              <SectionLabel>Internamento</SectionLabel>
              <Row label="Casa" value={resident.house?.name} />
              <Row label="Entrada" value={fmt(resident.entryDate)} />
              <Row label="Telefone" value={resident.contactPhone} />

              <SectionLabel>Saúde</SectionLabel>
              <Row label="Problemas de saúde" value={resident.healthIssues} />
              <Row
                label="Medicação contínua"
                value={resident.continuousMedication}
              />
            </View>
          )}

          {activeTab === 'Acompanhamento' && (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <Ionicons
                name="time-outline"
                size={40}
                color="#d1d5db"
              />
              <Text className="text-base font-medium text-gray-400 mt-4">
                Em desenvolvimento
              </Text>
              <Text className="text-sm text-gray-400 mt-1 text-center">
                Esta seção registrará ocorrências e mudanças de status
                durante o internamento.
              </Text>
            </View>
          )}

          {activeTab === 'Familiares' && (
            <View className="px-4 py-4">
              {loadingRelatives ? (
                <ActivityIndicator color="#2563eb" className="py-8" />
              ) : relatives.length === 0 ? (
                <Text className="text-sm text-gray-500 text-center py-12">
                  Nenhum familiar cadastrado.
                </Text>
              ) : (
                <View className="gap-2">
                  {relatives.map((relative) => (
                    <View
                      key={relative.id}
                      className="border border-gray-100 rounded-xl px-4 py-3 bg-white"
                    >
                      <Text className="text-sm font-semibold text-gray-900">
                        {relative.name}
                      </Text>
                      {relative.relationship && (
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {relative.relationship}
                        </Text>
                      )}
                      {relative.phone && (
                        <TouchableOpacity
                          onPress={() =>
                            Linking.openURL(`tel:${relative.phone}`)
                          }
                          className="flex-row items-center mt-1.5 gap-1"
                        >
                          <Ionicons
                            name="call-outline"
                            size={13}
                            color="#2563eb"
                          />
                          <Text className="text-xs text-blue-600">
                            {relative.phone}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {activeTab === 'Anexos' && (
            <View className="px-4 py-4">
              {loadingAttachments ? (
                <ActivityIndicator color="#2563eb" className="py-8" />
              ) : attachments.length === 0 ? (
                <Text className="text-sm text-gray-500 text-center py-12">
                  Nenhum anexo adicionado.
                </Text>
              ) : (
                <View className="gap-2">
                  {attachments.map((attachment) => (
                    <TouchableOpacity
                      key={attachment.id}
                      onPress={() => {
                        const url = resolveAssetUrl(attachment.fileUrl);
                        if (url) Linking.openURL(url);
                      }}
                      className="border border-gray-100 rounded-xl px-4 py-3 bg-white flex-row items-center"
                    >
                      <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center mr-3">
                        <Ionicons
                          name="document-outline"
                          size={18}
                          color="#6b7280"
                        />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text
                          className="text-sm font-medium text-gray-900"
                          numberOfLines={1}
                        >
                          {attachment.filename}
                        </Text>
                        <Text className="text-xs text-gray-400 mt-0.5">
                          {new Date(attachment.createdAt).toLocaleDateString(
                            'pt-BR',
                          )}
                        </Text>
                      </View>
                      <Ionicons
                        name="open-outline"
                        size={16}
                        color="#9ca3af"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {resident.houseId && (
        <ChangeMinistryModal
          visible={ministryModalOpen}
          onClose={() => setMinistryModalOpen(false)}
          residentId={id!}
          houseId={resident.houseId}
          currentMinistryId={resident.ministryId}
        />
      )}
    </>
  );
}
