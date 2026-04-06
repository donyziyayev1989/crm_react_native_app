module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === "production";
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: isProd ? ["babel-plugin-transform-remove-console"] : [],
  };
};
