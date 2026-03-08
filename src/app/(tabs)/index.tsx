import { Link } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import db, { where } from "../../services/database";


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
