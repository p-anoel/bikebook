import { Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  buildPdfWeatherRows,
  formatPdfDateTime,
  type PdfWeatherRow,
} from "@/lib/pdf/weather-display";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";

export interface PdfWeatherMessages {
  section: string;
  notLoaded: string;
  ridePlanTitle: string;
  summaryTitle: string;
  departure: string;
  arrival: string;
  plannedSpeed: string;
  pause: string;
  dominant: string;
  avgWind: string;
  temp: string;
  precip: string;
  windSpeed: (speed: number) => string;
  windComponent: (value: number) => string;
  temperature: (value: number) => string;
  precipitation: (value: number) => string;
  tempRange: (min: number, max: number) => string;
  pauseSummary: (minutes: number) => string;
  windRelative: Record<"headwind" | "tailwind" | "crosswind", string>;
  weatherCode: Record<string, string>;
  columns: {
    number: string;
    km: string;
    passage: string;
    wind: string;
    speed: string;
    component: string;
    temp: string;
    precip: string;
    sky: string;
  };
}

interface WeatherPdfSectionProps {
  snapshot: RouteWeatherSnapshot | null | undefined;
  locale: string;
  kmUnit: string;
  messages: PdfWeatherMessages;
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  subsectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#52525b",
    marginBottom: 4,
    marginTop: 2,
  },
  notLoaded: {
    fontSize: 9,
    color: "#71717a",
    fontStyle: "italic",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    maxWidth: "48%",
  },
  badgeLabel: { fontSize: 7, color: "#71717a", marginBottom: 1 },
  badgeValue: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
    paddingHorizontal: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    minHeight: 12,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6,
    color: "#71717a",
    lineHeight: 1.15,
  },
  td: { fontSize: 7, lineHeight: 1.15 },
  colNum: { width: "5%" },
  colKm: { width: "10%" },
  colPassage: { width: "11%" },
  colWind: { width: "12%" },
  colSpeed: { width: "12%" },
  colComponent: { width: "14%" },
  colTemp: { width: "10%" },
  colPrecip: { width: "10%" },
  colSky: { width: "16%" },
});

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.badge} wrap={false}>
      <Text style={styles.badgeLabel}>{label}</Text>
      <Text style={styles.badgeValue}>{value}</Text>
    </View>
  );
}

function WeatherTable({ rows, messages }: { rows: PdfWeatherRow[]; messages: PdfWeatherMessages }) {
  return (
    <View>
      <View style={styles.tableHeader} wrap={false}>
        <Text style={[styles.th, styles.colNum]}>{messages.columns.number}</Text>
        <Text style={[styles.th, styles.colKm]}>{messages.columns.km}</Text>
        <Text style={[styles.th, styles.colPassage]}>{messages.columns.passage}</Text>
        <Text style={[styles.th, styles.colWind]}>{messages.columns.wind}</Text>
        <Text style={[styles.th, styles.colSpeed]}>{messages.columns.speed}</Text>
        <Text style={[styles.th, styles.colComponent]}>{messages.columns.component}</Text>
        <Text style={[styles.th, styles.colTemp]}>{messages.columns.temp}</Text>
        <Text style={[styles.th, styles.colPrecip]}>{messages.columns.precip}</Text>
        <Text style={[styles.th, styles.colSky]}>{messages.columns.sky}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.id} style={styles.tableRow} wrap={false}>
          <Text style={[styles.td, styles.colNum, { fontFamily: "Helvetica-Bold" }]}>{row.id}</Text>
          <Text style={[styles.td, styles.colKm]}>{row.km}</Text>
          <Text style={[styles.td, styles.colPassage]}>{row.passage}</Text>
          <Text style={[styles.td, styles.colWind]}>{row.windRelative}</Text>
          <Text style={[styles.td, styles.colSpeed]}>{row.windSpeed}</Text>
          <Text style={[styles.td, styles.colComponent]}>{row.windComponent}</Text>
          <Text style={[styles.td, styles.colTemp]}>{row.temperature}</Text>
          <Text style={[styles.td, styles.colPrecip]}>{row.precipitation}</Text>
          <Text style={[styles.td, styles.colSky]}>{row.sky}</Text>
        </View>
      ))}
    </View>
  );
}

export function WeatherPdfSection({
  snapshot,
  locale,
  kmUnit,
  messages,
}: WeatherPdfSectionProps) {
  if (!snapshot) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{messages.section}</Text>
        <Text style={styles.notLoaded}>{messages.notLoaded}</Text>
      </View>
    );
  }

  const { ridePlan, summary, segments } = snapshot;

  const rows = buildPdfWeatherRows(segments, locale, {
    kmUnit,
    windSpeed: messages.windSpeed,
    windComponent: messages.windComponent,
    temperature: messages.temperature,
    precipitation: messages.precipitation,
    windRelative: messages.windRelative,
    weatherCode: messages.weatherCode,
  });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{messages.section}</Text>

      <View wrap={false}>
        <Text style={styles.subsectionTitle}>{messages.ridePlanTitle}</Text>
        <View style={styles.badgeRow}>
          <Badge label={messages.departure} value={formatPdfDateTime(ridePlan.departureAt, locale)} />
          <Badge label={messages.arrival} value={formatPdfDateTime(ridePlan.arrivalAt, locale)} />
          <Badge label={messages.plannedSpeed} value={messages.windSpeed(ridePlan.avgSpeedKmh)} />
          {ridePlan.pauseMinutes > 0 ? (
            <Badge
              label={messages.pause}
              value={messages.pauseSummary(ridePlan.pauseMinutes)}
            />
          ) : null}
        </View>
      </View>

      <View wrap={false}>
        <Text style={styles.subsectionTitle}>{messages.summaryTitle}</Text>
        <View style={styles.badgeRow}>
        <Badge
          label={messages.dominant}
          value={messages.windRelative[summary.dominantWindRelative]}
        />
        <Badge label={messages.avgWind} value={messages.windSpeed(summary.avgWindSpeedKmh)} />
        <Badge
          label={messages.temp}
          value={messages.tempRange(summary.minTempC, summary.maxTempC)}
        />
        {summary.totalPrecipitationMm > 0 ? (
          <Badge
            label={messages.precip}
            value={messages.precipitation(summary.totalPrecipitationMm)}
          />
        ) : null}
        </View>
      </View>

      {rows.length > 0 ? <WeatherTable rows={rows} messages={messages} /> : null}
    </View>
  );
}
