import { Stack } from "expo-router";
import { strings } from "../../constants/strings";

export default function ScenariosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1e1e1e" },
        headerTintColor: "#dcdcdc",
      }}
    >
      <Stack.Screen name="index" options={{ title: strings.screens.scenarios }} />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
