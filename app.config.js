const appJson = require('./app.json');

const mapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
const baseExpoConfig = appJson.expo;

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
    ...(baseExpoConfig.plugins || []),
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