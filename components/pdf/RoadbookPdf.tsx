import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Svg,
  Path,
  Line,
  Image,
} from "@react-pdf/renderer";
import {
  elevationMarkerPoints,
  elevationPoiPoints,
  elevationProfilePoints,
} from "@/lib/pdf/elevation-chart";
import { ElevationProfileChart } from "@/components/pdf/ElevationProfileChart";
import {
  buildEndpointLabelContent,
  buildPoiLabelContent,
} from "@/lib/pdf/chart-labels";
import { layoutLabels, type LabelAnchor } from "@/lib/pdf/label-layout";
import { SvgTooltipLabels } from "@/components/pdf/SvgTooltipLabel";
import { withPoiStats } from "@/lib/gpx/poi-intervals";
import { detectClimbs } from "@/lib/pdf/elevation-chart";
import type { MapOverlayData } from "@/lib/pdf/map-overlay";
import type { Roadbook } from "@/types/roadbook";

export interface PdfMessages {
  title: string;
  generatedAt: string;
  statsSection: string;
  poiSection: string;
  climbsSection: string;
  profileSection: string;
  profileDetailSection: string;
  mapSection: string;
  km: string;
  m: string;
  stats: {
    distance: string;
    elevationGain: string;
    elevationLoss: string;
    minElevation: string;
    maxElevation: string;
  };
  poiColumns: {
    number: string;
    name: string;
    kilometrage: string;
    interval: string;
    cumulativeGain: string;
    intervalGain: string;
    elevation: string;
    description: string;
  };
  climbColumns: {
    number: string;
    start: string;
    gain: string;
    length: string;
    grade: string;
  };
  markers: {
    start: string;
    finish: string;
  };
  seaLevel: string;
}

interface RoadbookPdfProps {
  roadbook: Roadbook;
  locale: string;
  messages: PdfMessages;
  mapImageSrc?: string;
  mapOverlay?: MapOverlayData;
}

const PAGE_PADDING = 40;
const CONTENT_WIDTH = 595.28 - PAGE_PADDING * 2;
const LANDSCAPE_CONTENT_WIDTH = 841.89 - PAGE_PADDING * 2;
const CHART_INNER_PADDING = 16;
const PORTRAIT_PROFILE_HEIGHT = 168;
const PORTRAIT_PROFILE_TOP_PADDING = 34;
const LANDSCAPE_PROFILE_HEIGHT = 220;
const LANDSCAPE_PROFILE_TOP_PADDING = 34;
const PORTRAIT_PROFILE_MAX_POINTS = 1200;
const LANDSCAPE_PROFILE_MAX_POINTS = 5000;
const CHART_PADDING = 12;

/** Map slot inside the PDF chart box (full inner width, landscape ratio). */
export const PDF_MAP_WIDTH = CONTENT_WIDTH - CHART_INNER_PADDING;
export const PDF_MAP_HEIGHT = 240;

const styles = StyleSheet.create({
  page: {
    padding: PAGE_PADDING,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#18181b",
  },
  header: { marginBottom: 20 },
  title: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  subtitle: { fontSize: 9, color: "#71717a" },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statBox: {
    width: "30%",
    padding: 8,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  statLabel: {
    fontSize: 8,
    color: "#71717a",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  statValue: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  chartBox: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#fafafa",
    alignItems: "center",
    width: "100%",
  },
  mapWrapper: {
    width: "100%",
  },
  mapContainer: {
    position: "relative",
    width: PDF_MAP_WIDTH,
    height: PDF_MAP_HEIGHT,
  },
  mapImage: {
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: 2,
  },
  mapOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  mapAttribution: {
    fontSize: 7,
    color: "#71717a",
    marginTop: 4,
    textAlign: "right",
    width: "100%",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f4f4f5",
    minHeight: 14,
  },
  colNumber: { width: "5%" },
  colName: { width: "15%" },
  colKm: { width: "9%" },
  colInterval: { width: "12%" },
  colIntervalGain: { width: "11%" },
  colCumulativeGain: { width: "11%" },
  colElevation: { width: "9%" },
  colDesc: { width: "31%" },
  colClimbNum: { width: "8%" },
  colClimbStart: { width: "22%" },
  colClimbGain: { width: "22%" },
  colClimbLen: { width: "24%" },
  colClimbGrade: { width: "24%" },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    color: "#71717a",
    lineHeight: 1.2,
  },
  td: { fontSize: 8, lineHeight: 1.2 },
  landscapeHeader: { marginBottom: 12 },
});

interface ProfileLayoutInput {
  track: Roadbook["track"];
  pois: ReturnType<typeof withPoiStats>;
  chartWidth: number;
  profileHeight: number;
  topPadding: number;
  locale: string;
  messages: PdfMessages;
  poiGainById: Map<string, number>;
}

function buildProfileLabelLayout({
  track,
  pois,
  chartWidth,
  profileHeight,
  topPadding,
  locale,
  messages,
  poiGainById,
}: ProfileLayoutInput) {
  const profilePois = elevationPoiPoints(
    track,
    pois,
    chartWidth,
    profileHeight,
    CHART_PADDING,
    topPadding,
  );
  const profileMarkers = elevationMarkerPoints(
    track,
    chartWidth,
    profileHeight,
    CHART_PADDING,
    topPadding,
  );

  const profileLabelAnchors: LabelAnchor[] = [
    ...profilePois.map((poi) => ({
      id: poi.id,
      anchorX: poi.x,
      anchorY: poi.y,
      sortKey: poi.distanceKm,
      markerKind: "poi" as const,
      markerNumber: poi.number,
      content: buildPoiLabelContent(
        poi.name,
        poi.distanceKm,
        poi.elevationM,
        messages.km,
        messages.m,
        locale,
        poiGainById.get(poi.id),
        poi.number,
      ),
    })),
    ...profileMarkers.map((marker) => ({
      id: marker.kind,
      anchorX: marker.x,
      anchorY: marker.y,
      sortKey: marker.distanceKm,
      markerKind: marker.kind,
      content: buildEndpointLabelContent(
        marker.kind === "start" ? messages.markers.start : messages.markers.finish,
        marker.distanceKm,
        marker.elevationM,
        messages.km,
        messages.m,
        locale,
      ),
    })),
  ];

  const profileTrackPoints = elevationProfilePoints(
    track,
    chartWidth,
    profileHeight,
    CHART_PADDING,
    topPadding,
  );

  return layoutLabels(
    profileLabelAnchors,
    {
      minX: CHART_PADDING,
      minY: 2,
      maxX: chartWidth - CHART_PADDING,
      maxY: profileHeight - CHART_PADDING,
    },
    { labelsAboveOnly: true, avoidPoints: profileTrackPoints },
  );
}

export function RoadbookPdf({
  roadbook,
  locale,
  messages,
  mapImageSrc,
  mapOverlay,
}: RoadbookPdfProps) {
  const { stats, track } = roadbook;
  const pois = withPoiStats(track, roadbook.pois);
  const climbs = detectClimbs(track);
  const poiGainById = new Map(pois.map((poi) => [poi.id, poi.cumulativeElevationGainM]));
  const portraitChartWidth = CONTENT_WIDTH - CHART_INNER_PADDING;
  const landscapeChartWidth = LANDSCAPE_CONTENT_WIDTH - CHART_INNER_PADDING;

  const formatNum = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);

  const portraitProfileLabels = buildProfileLabelLayout({
    track,
    pois,
    chartWidth: portraitChartWidth,
    profileHeight: PORTRAIT_PROFILE_HEIGHT,
    topPadding: PORTRAIT_PROFILE_TOP_PADDING,
    locale,
    messages,
    poiGainById,
  });

  const landscapeProfileLabels = buildProfileLabelLayout({
    track,
    pois,
    chartWidth: landscapeChartWidth,
    profileHeight: LANDSCAPE_PROFILE_HEIGHT,
    topPadding: LANDSCAPE_PROFILE_TOP_PADDING,
    locale,
    messages,
    poiGainById,
  });

  const MAP_LABEL_MARGIN = 18;

  const mapLabelAnchors: LabelAnchor[] = mapOverlay
    ? [
        ...mapOverlay.pois.map((poi) => ({
          id: poi.id,
          anchorX: poi.x,
          anchorY: poi.y,
          sortKey: poi.distanceKm,
          markerKind: "poi" as const,
          markerNumber: poi.number,
          content: buildPoiLabelContent(
            poi.name,
            poi.distanceKm,
            poi.elevationM,
            messages.km,
            messages.m,
            locale,
            poiGainById.get(poi.id),
            poi.number,
          ),
        })),
        ...mapOverlay.markers.map((marker) => ({
          id: marker.kind,
          anchorX: marker.x,
          anchorY: marker.y,
          sortKey: marker.distanceKm,
          markerKind: marker.kind,
          content: buildEndpointLabelContent(
            marker.kind === "start" ? messages.markers.start : messages.markers.finish,
            marker.distanceKm,
            marker.elevationM,
            messages.km,
            messages.m,
            locale,
          ),
        })),
      ]
    : [];

  const mapLabels = layoutLabels(
    mapLabelAnchors,
    {
      minX: MAP_LABEL_MARGIN,
      minY: MAP_LABEL_MARGIN,
      maxX: PDF_MAP_WIDTH - MAP_LABEL_MARGIN,
      maxY: PDF_MAP_HEIGHT - MAP_LABEL_MARGIN,
    },
    { avoidPoints: mapOverlay?.trackPoints, compact: true },
  );

  return (
    <Document title={`${roadbook.name} — BikeBook`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{roadbook.name}</Text>
          <Text style={styles.subtitle}>{messages.generatedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{messages.statsSection}</Text>
          <View style={styles.statsGrid}>
            {[
              { label: messages.stats.distance, value: `${stats.distanceKm} ${messages.km}` },
              { label: messages.stats.elevationGain, value: `${formatNum(stats.elevationGainM)} ${messages.m}` },
              { label: messages.stats.elevationLoss, value: `${formatNum(stats.elevationLossM)} ${messages.m}` },
              { label: messages.stats.minElevation, value: `${formatNum(stats.minElevationM)} ${messages.m}` },
              { label: messages.stats.maxElevation, value: `${formatNum(stats.maxElevationM)} ${messages.m}` },
            ].map(({ label, value }) => (
              <View key={label} style={styles.statBox}>
                <Text style={styles.statLabel}>{label}</Text>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{messages.mapSection}</Text>
          <View style={styles.chartBox}>
            <View style={styles.mapWrapper}>
              {mapImageSrc && mapOverlay ? (
                <View style={styles.mapContainer}>
                  <Image
                    src={mapImageSrc}
                    style={[
                      styles.mapImage,
                      { width: PDF_MAP_WIDTH, height: PDF_MAP_HEIGHT },
                    ]}
                  />
                  <Svg
                    width={PDF_MAP_WIDTH}
                    height={PDF_MAP_HEIGHT}
                    viewBox={`0 0 ${PDF_MAP_WIDTH} ${PDF_MAP_HEIGHT}`}
                    style={styles.mapOverlay}
                  >
                    <Path
                      d={mapOverlay.trackPath}
                      stroke="#18181b"
                      strokeWidth={3}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <SvgTooltipLabels labels={mapLabels} />
                  </Svg>
                </View>
              ) : null}
            </View>
            {mapImageSrc ? (
              <Text style={styles.mapAttribution}>© OpenStreetMap contributors</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{messages.profileSection}</Text>
          <View style={styles.chartBox}>
            <ElevationProfileChart
              track={track}
              width={portraitChartWidth}
              height={PORTRAIT_PROFILE_HEIGHT}
              locale={locale}
              labels={portraitProfileLabels}
              kmUnit={messages.km}
              seaLevelLabel={messages.seaLevel}
              climbs={climbs}
              maxProfilePoints={PORTRAIT_PROFILE_MAX_POINTS}
            />
          </View>
        </View>
      </Page>

      {pois.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{messages.poiSection}</Text>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colNumber]}>{messages.poiColumns.number}</Text>
              <Text style={[styles.th, styles.colName]}>{messages.poiColumns.name}</Text>
              <Text style={[styles.th, styles.colKm]}>{messages.poiColumns.kilometrage}</Text>
              <Text style={[styles.th, styles.colInterval]}>{messages.poiColumns.interval}</Text>
              <Text style={[styles.th, styles.colIntervalGain]}>{messages.poiColumns.intervalGain}</Text>
              <Text style={[styles.th, styles.colCumulativeGain]}>{messages.poiColumns.cumulativeGain}</Text>
              <Text style={[styles.th, styles.colElevation]}>{messages.poiColumns.elevation}</Text>
              <Text style={[styles.th, styles.colDesc]}>{messages.poiColumns.description}</Text>
            </View>
            {pois.map((poi) => (
              <View key={poi.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.colNumber, { color: "#1d4ed8", fontFamily: "Helvetica-Bold" }]}>
                  {poi.number}
                </Text>
                <Text style={[styles.td, styles.colName]}>{poi.name}</Text>
                <Text style={[styles.td, styles.colKm]}>
                  {(poi.distanceFromStartM / 1000).toFixed(1)} {messages.km}
                </Text>
                <Text style={[styles.td, styles.colInterval]}>
                  {poi.intervalFromPrevM === null
                    ? "—"
                    : `+${(poi.intervalFromPrevM / 1000).toFixed(1)} ${messages.km}`}
                </Text>
                <Text style={[styles.td, styles.colIntervalGain]}>
                  {poi.intervalElevationGainM === null
                    ? "—"
                    : `+${formatNum(poi.intervalElevationGainM)} ${messages.m}`}
                </Text>
                <Text style={[styles.td, styles.colCumulativeGain]}>
                  {formatNum(poi.cumulativeElevationGainM)} {messages.m}
                </Text>
                <Text style={[styles.td, styles.colElevation]}>
                  {poi.ele !== undefined ? `${formatNum(poi.ele)} ${messages.m}` : "—"}
                </Text>
                <Text style={[styles.td, styles.colDesc]}>{poi.description ?? "—"}</Text>
              </View>
            ))}
          </View>
        </Page>
      ) : null}

      {climbs.length > 0 ? (
        <Page size="A4" style={styles.page}>
          <Text style={styles.sectionTitle}>{messages.climbsSection}</Text>
          <View>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colClimbNum]}>{messages.climbColumns.number}</Text>
              <Text style={[styles.th, styles.colClimbStart]}>{messages.climbColumns.start}</Text>
              <Text style={[styles.th, styles.colClimbGain]}>{messages.climbColumns.gain}</Text>
              <Text style={[styles.th, styles.colClimbLen]}>{messages.climbColumns.length}</Text>
              <Text style={[styles.th, styles.colClimbGrade]}>{messages.climbColumns.grade}</Text>
            </View>
            {climbs.map((climb) => (
              <View key={climb.id} style={styles.tableRow}>
                <Text style={[styles.td, styles.colClimbNum, { color: "#b45309", fontFamily: "Helvetica-Bold" }]}>
                  {climb.id}
                </Text>
                <Text style={[styles.td, styles.colClimbStart]}>
                  {(climb.startDistanceM / 1000).toFixed(1)} {messages.km}
                </Text>
                <Text style={[styles.td, styles.colClimbGain]}>
                  +{formatNum(climb.gainM)} {messages.m}
                </Text>
                <Text style={[styles.td, styles.colClimbLen]}>
                  {(climb.lengthM / 1000).toFixed(1)} {messages.km}
                </Text>
                <Text style={[styles.td, styles.colClimbGrade]}>
                  {climb.avgGradePct.toFixed(1)} %
                </Text>
              </View>
            ))}
          </View>
        </Page>
      ) : null}

      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.landscapeHeader}>
          <Text style={styles.title}>{roadbook.name}</Text>
          <Text style={styles.sectionTitle}>{messages.profileDetailSection}</Text>
        </View>
        <View style={styles.chartBox}>
          <ElevationProfileChart
            track={track}
            width={landscapeChartWidth}
            height={LANDSCAPE_PROFILE_HEIGHT}
            locale={locale}
            labels={landscapeProfileLabels}
            kmUnit={messages.km}
            seaLevelLabel={messages.seaLevel}
            climbs={climbs}
            maxProfilePoints={LANDSCAPE_PROFILE_MAX_POINTS}
          />
        </View>
      </Page>
    </Document>
  );
}
