
import { Link } from "expo-router";
import { Text, View } from "react-native";


export default function Index() {
  return (
    <View
      className="flex-1 justify-center items-center"
    >
      <Text className="text-2xl font-bold text-primary">Welcome</Text>
      <Link href="/customers/1">Customer 1</Link>
      
    </View>
  );
}
