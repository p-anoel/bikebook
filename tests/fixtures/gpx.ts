const SAMPLE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="bikebook-test">
  <metadata><name>Test Ride</name></metadata>
  <trk>
    <name>Alpine Loop</name>
    <trkseg>
      <trkpt lat="45.0000" lon="6.0000"><ele>1000</ele></trkpt>
      <trkpt lat="45.0100" lon="6.0100"><ele>1100</ele></trkpt>
      <trkpt lat="45.0200" lon="6.0200"><ele>1050</ele></trkpt>
      <trkpt lat="45.0300" lon="6.0300"><ele>1200</ele></trkpt>
    </trkseg>
  </trk>
  <wpt lat="45.0050" lon="6.0050">
    <name>Refuge</name>
    <desc>Lunch stop</desc>
    <ele>1050</ele>
  </wpt>
</gpx>`;

const SINGLE_POINT_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk><trkseg><trkpt lat="45.0" lon="6.0"><ele>100</ele></trkpt></trkseg></trk>
</gpx>`;

const NO_TRACK_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"><metadata><name>Empty</name></metadata></gpx>`;

const ROUTE_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <rte>
    <name>Route only</name>
    <rtept lat="45.0" lon="6.0"><ele>100</ele></rtept>
    <rtept lat="45.01" lon="6.01"><ele>200</ele></rtept>
  </rte>
</gpx>`;

export { SAMPLE_GPX, SINGLE_POINT_GPX, NO_TRACK_GPX, ROUTE_GPX };
