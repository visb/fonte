import { Text, View } from 'react-native';
import type { HouseProductContributionView } from '@fonte/types';
import { ContributionSummary } from './ContributionSummary';

export function ContributionResidentRow({ contribution }: { contribution: HouseProductContributionView }) {
  return (
    <View testID={`contribution-${contribution.residentId}`} className="bg-white rounded-lg p-4 mb-3">
      <Text className="font-semibold text-gray-900 mb-1">{contribution.residentName}</Text>
      <ContributionSummary lines={contribution.lines} />
    </View>
  );
}
