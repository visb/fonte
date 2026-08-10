import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { router } from "expo-router";
import { useAuth, MustChangePasswordError } from "@/lib/auth";
import { PasswordInput } from "@/components/shared/PasswordInput";

// O operador entra com WhatsApp (identificador primário) ou e-mail.
const loginSchema = z.object({
  identifier: z.string().min(1, "Informe WhatsApp ou e-mail."),
  password: z.string().min(1, "Informe sua senha."),
});
type LoginForm = z.infer<typeof loginSchema>;

const INPUT_CLASS =
  "border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50";

export default function LoginScreen() {
  const { login, token, sessionExpired } = useAuth();
  const [expiredNoticeDismissed, setExpiredNoticeDismissed] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const showSessionExpired = sessionExpired && !expiredNoticeDismissed;

  useEffect(() => {
    if (token) router.replace("/(app)");
  }, [token]);

  async function onSubmit(data: LoginForm) {
    try {
      await login(data.identifier, data.password);
    } catch (err) {
      if (err instanceof MustChangePasswordError) {
        router.replace("/(auth)/change-password");
      } else {
        setError("root", { message: "WhatsApp/e-mail ou senha incorretos." });
      }
    }
  }

  // O aviso de sessão expirada some assim que o operador tenta entrar de novo,
  // mesmo que o submit seja barrado pela validação (regressão da story 165).
  const submit = () => {
    setExpiredNoticeDismissed(true);
    return handleSubmit(onSubmit)();
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-1">OPS Fonte</Text>
        <Text className="text-base text-gray-500 mb-10">
          Plataforma operacional
        </Text>

        {showSessionExpired ? (
          <View
            accessibilityLabel="aviso-sessao-expirada"
            className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4"
          >
            <Text className="text-sm text-amber-800">
              Sua sessão expirou. Entre novamente.
            </Text>
          </View>
        ) : null}

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              WhatsApp ou e-mail
            </Text>
            <Controller
              control={control}
              name="identifier"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  accessibilityLabel="input-email"
                  className={INPUT_CLASS}
                  placeholder="WhatsApp ou seu@email.com"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.identifier && (
              <Text className="text-sm text-red-600 mt-1">
                {errors.identifier.message}
              </Text>
            )}
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Senha
            </Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <PasswordInput
                  accessibilityLabel="input-senha"
                  className={INPUT_CLASS}
                  placeholder="••••••••"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  onSubmitEditing={submit}
                />
              )}
            />
            {errors.password && (
              <Text className="text-sm text-red-600 mt-1">
                {errors.password.message}
              </Text>
            )}
          </View>

          {errors.root && (
            <Text className="text-sm text-red-600">{errors.root.message}</Text>
          )}

          <TouchableOpacity
            className="bg-blue-600 rounded-lg py-3.5 items-center mt-2"
            onPress={submit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-semibold text-base">Entrar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
