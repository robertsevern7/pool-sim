import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import TableView, { getScenarioTitle } from "../../components/TableView";

export default function DebugScenarioTable() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({ title: getScenarioTitle(id) });
  }, [navigation, id]);

  return <TableView scenarioId={id} />;
}
