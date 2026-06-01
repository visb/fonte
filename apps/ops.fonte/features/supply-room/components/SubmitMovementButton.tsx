import { TouchableOpacity, Text, ActivityIndicator } from "react-native";
import { MovementType } from "@fonte/types";

type Props = {
  type: MovementType;
  isPending: boolean;
  onPress: () => void;
};

export function SubmitMovementButton({ type, isPending, onPress }: Props) {
  const isEntry = type === MovementType.IN;
  return (
    <TouchableOpacity
      className={`rounded-lg py-3.5 items-center mt-2 ${isEntry ? "bg-green-600" : "bg-red-600"}`}
      onPress={onPress}
      disabled={isPending}
    >
      {isPending ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-white font-semibold text-base">
          Registrar {isEntry ? "entrada" : "saída"}
        </Text>
      )}
    </TouchableOpacity>
  );
}
