/** WMO weather interpretation codes (Open-Meteo `weather_code`). */
export type WeatherCodeGroup =
  | "clear"
  | "mainlyClear"
  | "partlyCloudy"
  | "overcast"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "unknown";

const WEATHER_CODE_GROUPS: Record<WeatherCodeGroup, number[]> = {
  clear: [0],
  mainlyClear: [1],
  partlyCloudy: [2],
  overcast: [3],
  fog: [45, 48],
  drizzle: [51, 53, 55, 56, 57],
  rain: [61, 63, 65, 66, 67, 80, 81, 82],
  snow: [71, 73, 75, 77, 85, 86],
  thunderstorm: [95, 96, 99],
  unknown: [],
};

const WEATHER_EMOJI: Record<WeatherCodeGroup, string> = {
  clear: "☀️",
  mainlyClear: "🌤️",
  partlyCloudy: "⛅",
  overcast: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  snow: "🌨️",
  thunderstorm: "⛈️",
  unknown: "🌡️",
};

export function weatherCodeGroup(code: number): WeatherCodeGroup {
  for (const [group, codes] of Object.entries(WEATHER_CODE_GROUPS) as [WeatherCodeGroup, number[]][]) {
    if (group === "unknown") continue;
    if (codes.includes(code)) return group;
  }
  return "unknown";
}

export function weatherEmoji(code: number): string {
  return WEATHER_EMOJI[weatherCodeGroup(code)];
}
