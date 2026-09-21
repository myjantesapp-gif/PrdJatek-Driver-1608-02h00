const appJson = require('./app.json');

const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
const baseExpoConfig = appJson.expo;
const isEasNativeBuild = process.env.EAS_BUILD === 'true';

if (isEasNativeBuild && !mapsApiKey) {
  throw new Error('GOOGLE_MAPS_API_KEY is required for native EAS builds.');
}

module.exports = {
  ...baseExpoConfig,
  android: {
    ...baseExpoConfig.android,
    ...(mapsApiKey
      ? {
          config: {
            ...baseExpoConfig.android?.config,
            googleMaps: { apiKey: mapsApiKey },
          },
        }
      : {}),
  },
  plugins: [
    ...(baseExpoConfig.plugins || []).map((plugin) => (
      Array.isArray(plugin) && plugin[0] === 'expo-location'
        ? [
            'expo-location',
            {
              ...plugin[1],
              locationWhenInUsePermission:
                'Jatek Driver utilise votre position pendant les livraisons et la navigation.',
              locationAlwaysAndWhenInUsePermission:
                'Jatek Driver utilise votre position pendant les livraisons.',
              isIosBackgroundLocationEnabled: false,
              isAndroidBackgroundLocationEnabled: false,
            },
          ]
        : plugin
    )),
    ...(mapsApiKey
      ? [
          [
            'react-native-maps',
            {
              androidGoogleMapsApiKey: mapsApiKey,
            },
          ],
        ]
      : []),
  ],
};