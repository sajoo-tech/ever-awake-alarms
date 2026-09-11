import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.damlatakip.gozdamlasi",
  appName: "Damla Takip",
  webDir: "dist/client",
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#2563EB",
      sound: "alarm.wav",
    },
  },
};

export default config;
