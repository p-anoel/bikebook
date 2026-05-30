import { describe, expect, it } from "vitest";
import { weatherCodeGroup, weatherEmoji } from "@/lib/weather/weather-emoji";

describe("weatherEmoji", () => {
  it("maps common WMO codes to emojis", () => {
    expect(weatherEmoji(0)).toBe("☀️");
    expect(weatherEmoji(2)).toBe("⛅");
    expect(weatherEmoji(3)).toBe("☁️");
    expect(weatherEmoji(61)).toBe("🌧️");
    expect(weatherEmoji(95)).toBe("⛈️");
  });

  it("groups unknown codes safely", () => {
    expect(weatherCodeGroup(999)).toBe("unknown");
    expect(weatherEmoji(999)).toBe("🌡️");
  });
});
