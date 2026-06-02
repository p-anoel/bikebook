export function downloadGpxFile(filename: string, gpxXml: string): void {
  const blob = new Blob([gpxXml], { type: "application/gpx+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
