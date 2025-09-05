import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken =
  "pk.eyJ1IjoiYWJyYXNpbGFydCIsImEiOiJjbWQzaWd1MWYwNTZ2Mm1xNGpmaDRidGdkIn0.0fOq0GcKZhlP2ZZrjPR08w";

interface PDVData {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  endereco: string;
  distancia_km: number;
}

interface MapComponentProps {
  center: [number, number];
  zoom: number;
  points: PDVData[];
  isBlurred?: boolean;
}

const MapComponent: React.FC<MapComponentProps> = ({ center, zoom, points, isBlurred }) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  const [lng, setLng] = useState<number>(center[0]);
  const [lat, setLat] = useState<number>(center[1]);
  const [mapZoom, setMapZoom] = useState<number>(zoom);

  const updateMarkers = (currentPoints: PDVData[]) => {
    if (!map.current || !map.current.isStyleLoaded()) {
      if (map.current) {
        map.current.once("style.load", () => updateMarkers(currentPoints));
      }
      return;
    }

    const existingMarkers = document.getElementsByClassName("mapboxgl-marker");
    while (existingMarkers.length > 0) {
      existingMarkers[0].remove();
    }

    currentPoints.forEach((point) => {
      const popupContent = `
        <h3>${point.nome}</h3>
        <p>${point.endereco}</p>
        <p>Distância: ${point.distancia_km} km</p>
      `;

      new mapboxgl.Marker()
        .setLngLat([point.longitude, point.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map.current!);
    });
  };

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // cria o mapa
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center,
      zoom,
    });

    map.current.on("load", () => {
      updateMarkers(points);
      map.current && map.current.resize();
      setTimeout(() => map.current && map.current.resize(), 200);
    });

    map.current.on("move", () => {
      if (!map.current) return;
      setLng(parseFloat(map.current.getCenter().lng.toFixed(4)));
      setLat(parseFloat(map.current.getCenter().lat.toFixed(4)));
      setMapZoom(parseFloat(map.current.getZoom().toFixed(2)));
    });

    // Recalcula quando a janela muda de tamanho
    const onResize = () => map.current && map.current.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (map.current) {
      map.current.flyTo({ center, zoom });
    }
  }, [center, zoom]);

  useEffect(() => {
    updateMarkers(points);
  }, [points]);

  useEffect(() => {
    if (map.current && !isBlurred) {
      map.current.resize();
    }
  }, [isBlurred]);

  return <div ref={mapContainer} className={`map-container ${isBlurred ? "blurred" : ""}`} />;
};

export default MapComponent;
