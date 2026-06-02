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
  Circle,
  Rect,
  G,
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
import {
  WeatherPdfSection,
  type PdfWeatherMessages,
} from "@/components/pdf/WeatherPdfSection";
import { withPoiStats } from "@/lib/gpx/poi-intervals";
import { detectClimbs } from "@/lib/pdf/elevation-chart";
import {
  buildLandscapeProfilePages,
  climbsInDistanceRange,
  endpointMarkersForChunk,
  formatProfileChunkLabel,
  landscapeStripHeightForPage,
  poisInDistanceRange,
} from "@/lib/pdf/profile-segments";
import type { MapOverlayData } from "@/lib/pdf/map-overlay";
import type { RouteWeatherSnapshot } from "@/lib/weather/types";
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
  /** When defined, renders the weather section (null → “not loaded” note). */
  weatherSnapshot?: RouteWeatherSnapshot | null;
  weatherMessages?: PdfWeatherMessages;
}

const PAGE_PADDING = 40;
const CONTENT_WIDTH = 595.28 - PAGE_PADDING * 2;
const LANDSCAPE_CONTENT_WIDTH = 841.89 - PAGE_PADDING * 2;
const CHART_INNER_PADDING = 16;
const PORTRAIT_PROFILE_HEIGHT = 168;
const PORTRAIT_PROFILE_TOP_PADDING = 34;
const PORTRAIT_PROFILE_MAX_POINTS = 1200;
const LANDSCAPE_PROFILE_MAX_POINTS = 5000;
const CHART_PADDING = 12;

/** Map slot inside the PDF chart box (full inner width, landscape ratio). */
export const PDF_MAP_WIDTH = CONTENT_WIDTH - CHART_INNER_PADDING;
export const PDF_MAP_HEIGHT = 240;

/** Thinner strokes than the web map — same layering (outline + grade colors). */
const PDF_TRACK_OUTLINE_WIDTH = 3;
const PDF_TRACK_SEGMENT_WIDTH = 2;
const PDF_ENDPOINT_RADIUS = 6;
const PDF_FINISH_MARKER_SIZE = 12;

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
  profileStripBlock: { marginBottom: 8, width: "100%" },
  profileStripLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#52525b",
    marginBottom: 3,
  },
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
  distanceDomain?: [number, number];
  endpointFilter?: { showStart: boolean; showFinish: boolean };
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
  distanceDomain,
  endpointFilter,
}: ProfileLayoutInput) {
  const profilePois = elevationPoiPoints(
    track,
    pois,
    chartWidth,
    profileHeight,
    CHART_PADDING,
    topPadding,
    distanceDomain,
  );
  const profileMarkers = elevationMarkerPoints(
    track,
    chartWidth,
    profileHeight,
    CHART_PADDING,
    topPadding,
    distanceDomain,
    endpointFilter,
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
    distanceDomain,
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
  weatherSnapshot,
  weatherMessages,
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

  const totalDistanceKm = (track[track.length - 1]?.distanceM ?? 0) / 1000;
  const profileChunkPages = buildLandscapeProfilePages(totalDistanceKm);

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
                    {mapOverlay.trackOutlinePath ? (
                      <Path
                        d={mapOverlay.trackOutlinePath}
                        stroke="#ffffff"
                        strokeWidth={PDF_TRACK_OUTLINE_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.88}
                      />
                    ) : null}
                    {mapOverlay.trackSegments.map((segment, index) => (
                      <Path
                        key={`${segment.color}-${index}`}
                        d={segment.d}
                        stroke={segment.color}
                        strokeWidth={PDF_TRACK_SEGMENT_WIDTH}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
                    {mapOverlay.markers.map((marker) => {
                      if (marker.kind === "start") {
                        return (
                          <Circle
                            key={marker.kind}
                            cx={marker.x}
                            cy={marker.y}
                            r={PDF_ENDPOINT_RADIUS}
                            fill="#22c55e"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      }

                      const half = PDF_FINISH_MARKER_SIZE / 2;
                      const cell = PDF_FINISH_MARKER_SIZE / 2;
                      return (
                        <G key={marker.kind}>
                          <Rect
                            x={marker.x - half}
                            y={marker.y - half}
                            width={PDF_FINISH_MARKER_SIZE}
                            height={PDF_FINISH_MARKER_SIZE}
                            fill="#ffffff"
                            stroke="#18181b"
                            strokeWidth={1.5}
                          />
                          <Rect
                            x={marker.x - half}
                            y={marker.y - half}
                            width={cell}
                            height={cell}
                            fill="#18181b"
                          />
                          <Rect
                            x={marker.x}
                            y={marker.y}
                            width={cell}
                            height={cell}
                            fill="#18181b"
                          />
                        </G>
                      );
                    })}
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
        <Page size="A4" style={styles.page} wrap>
          <Text style={styles.sectionTitle}>{messages.poiSection}</Text>
          <View>
            <View style={styles.tableHeader} wrap={false}>
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
              <View key={poi.id} style={styles.tableRow} wrap={false}>
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

      {weatherMessages !== undefined ? (
        <Page size="A4" style={styles.page} wrap>
          <WeatherPdfSection
            snapshot={weatherSnapshot}
            locale={locale}
            kmUnit={messages.km}
            messages={weatherMessages}
          />
        </Page>
      ) : null}

      {climbs.length > 0 ? (
        <Page size="A4" style={styles.page} wrap>
          <Text style={styles.sectionTitle}>{messages.climbsSection}</Text>
          <View>
            <View style={styles.tableHeader} wrap={false}>
              <Text style={[styles.th, styles.colClimbNum]}>{messages.climbColumns.number}</Text>
              <Text style={[styles.th, styles.colClimbStart]}>{messages.climbColumns.start}</Text>
              <Text style={[styles.th, styles.colClimbGain]}>{messages.climbColumns.gain}</Text>
              <Text style={[styles.th, styles.colClimbLen]}>{messages.climbColumns.length}</Text>
              <Text style={[styles.th, styles.colClimbGrade]}>{messages.climbColumns.grade}</Text>
            </View>
            {climbs.map((climb) => (
              <View key={climb.id} style={styles.tableRow} wrap={false}>
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

      {profileChunkPages.map((pageChunks, pageIndex) => {
        const stripHeight = landscapeStripHeightForPage(pageChunks.length);
        const stripTopPadding = 8;

        return (
          <Page
            key={`profile-detail-${pageIndex}`}
            size="A4"
            orientation="landscape"
            style={styles.page}
            wrap
          >
            <View style={styles.landscapeHeader} wrap={false}>
              <Text style={styles.title}>{roadbook.name}</Text>
              <Text style={styles.sectionTitle}>{messages.profileDetailSection}</Text>
            </View>
            <View style={styles.chartBox}>
              {pageChunks.map((chunk) => {
                const distanceDomain: [number, number] = [chunk.startKm, chunk.endKm];
                const segmentPois = poisInDistanceRange(pois, chunk.startKm, chunk.endKm);
                const segmentClimbs = climbsInDistanceRange(
                  climbs,
                  chunk.startKm,
                  chunk.endKm,
                );
                const endpointFilter = endpointMarkersForChunk(
                  track,
                  chunk.startKm,
                  chunk.endKm,
                );
                const stripLabels = buildProfileLabelLayout({
                  track,
                  pois: segmentPois,
                  chartWidth: landscapeChartWidth,
                  profileHeight: stripHeight,
                  topPadding: stripTopPadding,
                  locale,
                  messages,
                  poiGainById,
                  distanceDomain,
                  endpointFilter,
                });

                return (
                  <View key={chunk.index} style={styles.profileStripBlock} wrap={false}>
                    <Text style={styles.profileStripLabel}>
                      {formatProfileChunkLabel(chunk.startKm, chunk.endKm, locale)}
                    </Text>
                    <ElevationProfileChart
                      track={track}
                      width={landscapeChartWidth}
                      height={stripHeight}
                      locale={locale}
                      labels={stripLabels}
                      kmUnit={messages.km}
                      seaLevelLabel={messages.seaLevel}
                      climbs={segmentClimbs}
                      segmentClimbs={segmentClimbs}
                      maxProfilePoints={LANDSCAPE_PROFILE_MAX_POINTS}
                      variant="strip"
                      distanceDomain={distanceDomain}
                    />
                  </View>
                );
              })}
            </View>
          </Page>
        );
      })}
    </Document>
  );
}
