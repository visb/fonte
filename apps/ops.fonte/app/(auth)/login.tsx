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
import { router } from "expo-router";
import { useAuth, MustChangePasswordError } from "@/lib/auth";

export default function LoginScreen() {
  const { login, token } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) router.replace("/(app)");
  }, [token]);

  async function handleLogin() {
    if (!email || !password) {
      setError("Preencha e-mail e senha.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof MustChangePasswordError) {
        router.replace("/(auth)/change-password");
      } else {
        setError("E-mail ou senha incorretos.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-3xl font-bold text-gray-900 mb-1">ops.fonte</Text>
        <Text className="text-base text-gray-500 mb-10">
          Plataforma operacional
        </Text>

        <View className="space-y-4">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              E-mail
            </Text>
            <TextInput
              accessibilityLabel="input-email"
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1.5">
              Senha
            </Text>
            <TextInput
              accessibilityLabel="input-senha"
              className="border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-gray-50"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={handleLogin}
            />
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}

          <TouchableOpacity
            className="bg-blue-600 rounded-lg py-3.5 items-center mt-2"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
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
