import { Stack } from "expo-router";
import { strings } from "../constants/strings";

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#1e1e1e" },
        headerTintColor: "#dcdcdc",
      }}
    >
      <Stack.Screen name="index" options={{ title: strings.screens.home }} />
      <Stack.Screen name="free-play" options={{ title: "Free Play" }} />
      <Stack.Screen name="scenarios" options={{ headerShown: false }} />
      <Stack.Screen name="debug-scenarios" options={{ headerShown: false }} />
    </Stack>
  );
}
