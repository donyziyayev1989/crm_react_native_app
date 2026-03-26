export default ({ config }) => {
  // Replace the hardcoded Mapbox download token with the environment variable
  const plugins = config.plugins || [];

  const mapboxPlugin = plugins.find(
    (p) => Array.isArray(p) && p[0] === "@rnmapbox/maps",
  );

  if (mapboxPlugin && mapboxPlugin[1]) {
    mapboxPlugin[1].RNMAPBOX_MAPS_DOWNLOAD_TOKEN =
      process.env.RNMAPBOX_MAPS_DOWNLOAD_TOKEN;
  }

  return {
    ...config,
  };
};
