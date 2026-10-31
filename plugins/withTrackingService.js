const { withAndroidManifest } = require('@expo/config-plugins');

const withTrackingService = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults.manifest;
    const application = androidManifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    const existingService = application.service.find(
      (s) => s.$ && s.$['android:name'] === 'expo.modules.location.services.LocationTaskService'
    );

    if (existingService) {
      existingService.$['android:stopWithTask'] = 'false';
      existingService.$['tools:replace'] = 'android:stopWithTask';
      existingService.$['android:foregroundServiceType'] = 'location';
    } else {
      application.service.push({
        $: {
          'android:name': 'expo.modules.location.services.LocationTaskService',
          'android:exported': 'false',
          'android:foregroundServiceType': 'location',
          'android:stopWithTask': 'false',
          'tools:replace': 'android:stopWithTask',
        },
      });
    }

    return config;
  });
};

module.exports = withTrackingService;
