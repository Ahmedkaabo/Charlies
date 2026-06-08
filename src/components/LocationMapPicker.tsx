import "leaflet/dist/leaflet.css"
import L from "leaflet"
import markerIconUrl from "leaflet/dist/images/marker-icon.png"
import markerIcon2xUrl from "leaflet/dist/images/marker-icon-2x.png"
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png"
import { useEffect } from "react"
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
  useMap,
} from "react-leaflet"
import { MapPin } from "lucide-react"

// Vite breaks Leaflet's default icon URL resolution — fix it once at module load.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl:       markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl:     markerShadowUrl,
})

// Default map center: Cairo
const DEFAULT_CENTER: [number, number] = [30.0444, 31.2357]

// ── Sub-components (must live inside MapContainer) ────────────────────────────

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function RecenterMap({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.5,
    })
  }, [lat, lng, map])
  return null
}

// ── Public component ──────────────────────────────────────────────────────────

interface LocationMapPickerProps {
  lat: number | null
  lng: number | null
  radiusMeters: number
  onPick: (lat: number, lng: number) => void
  onClear: () => void
}

export function LocationMapPicker({
  lat,
  lng,
  radiusMeters,
  onPick,
  onClear,
}: LocationMapPickerProps) {
  const hasPin = lat !== null && lng !== null
  const position: [number, number] | null = hasPin ? [lat, lng] : null

  return (
    <div className="overflow-hidden rounded-lg border">
      <MapContainer
        center={position ?? DEFAULT_CENTER}
        zoom={hasPin ? 16 : 12}
        scrollWheelZoom
        style={{ height: 280, width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onPick={onPick} />

        {hasPin && <RecenterMap lat={lat} lng={lng} />}

        {position && (
          <>
            <Marker
              position={position}
              draggable
              eventHandlers={{
                dragend(e) {
                  const ll = (e.target as L.Marker).getLatLng()
                  onPick(ll.lat, ll.lng)
                },
              }}
            />
            <Circle
              center={position}
              radius={radiusMeters}
              pathOptions={{
                color: "#3b82f6",
                weight: 1.5,
                fillColor: "#3b82f6",
                fillOpacity: 0.12,
              }}
            />
          </>
        )}
      </MapContainer>

      {/* Footer strip */}
      <div className="flex items-center justify-between gap-3 border-t bg-muted/40 px-3 py-2 text-xs">
        {hasPin ? (
          <>
            <span className="font-mono text-foreground tabular-nums">
              {lat.toFixed(6)},&nbsp;{lng.toFixed(6)}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground transition-colors hover:text-destructive"
            >
              Clear pin
            </button>
          </>
        ) : (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            Tap the map to drop a pin, or use the button above
          </span>
        )}
      </div>
    </div>
  )
}
