import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken =
  'pk.eyJ1IjoiYWJyYXNpbGFydCIsImEiOiJjbWQzaWd1MWYwNTZ2Mm1xNGpmaDRidGdkIn0.0fOq0GcKZhlP2ZZrjPR08w';

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

const MapComponent: React.FC<MapComponentProps> = ({
  center,
  zoom,
  points,
  isBlurred,
}) => {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // só para debug/DevTools
  const [lng, setLng] = useState<number>(center[0]);
  const [lat, setLat] = useState<number>(center[1]);
  const [mapZoom, setMapZoom] = useState<number>(zoom);

  /** Remove todos os marcadores atuais */
  const clearMarkers = () => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  };

  /** Adiciona marcadores com base em `points` */
  const updateMarkers = (currentPoints: PDVData[]) => {
    if (!map.current) return;

    // Se o estilo ainda não terminou de carregar, espera um ciclo
    if (!map.current.isStyleLoaded()) {
      map.current.once('style.load', () => updateMarkers(currentPoints));
      return;
    }

    clearMarkers();

    currentPoints.forEach((p) => {
      const popupHtml = `
        <h3 style="margin:0 0 4px 0">${p.nome}</h3>
        <p style="margin:0">${p.endereco}</p>
        <p style="margin:4px 0 0 0">Distância: ${p.distancia_km} km</p>
      `;

      const marker = new mapboxgl.Marker()
        .setLngLat([p.longitude, p.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml))
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  };

  /** Inicializa o mapa quando o container tem dimensões válidas */
  const initMap = () => {
    if (map.current || !mapContainer.current) return;

    // Evita criar caso o container ainda não tenha altura/largura
    const { clientWidth, clientHeight } = mapContainer.current;
    if (clientWidth === 0 || clientHeight === 0) {
      // tenta no próximo frame
      requestAnimationFrame(initMap);
      return;
    }

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center,
      zoom,
    });

    map.current.on('load', () => {
      // Controles
      map.current?.addControl(new mapboxgl.NavigationControl(), 'top-left');

      // Ajuste fino: espere um frame para o layout estabilizar
      requestAnimationFrame(() => {
        map.current?.resize();
        updateMarkers(points);
      });
    });

    map.current.on('move', () => {
      if (!map.current) return;
      setLng(parseFloat(map.current.getCenter().lng.toFixed(4)));
      setLat(parseFloat(map.current.getCenter().lat.toFixed(4)));
      setMapZoom(parseFloat(map.current.getZoom().toFixed(2)));
    });

    // Redimensionamentos
    const onWindowResize = () => map.current?.resize();
    window.addEventListener('resize', onWindowResize);

    // Observa o container para reagir a mudanças de tamanho
    resizeObsRef.current = new ResizeObserver(() => {
      map.current?.resize();
    });
    resizeObsRef.current.observe(mapContainer.current);

    // Cleanup local do init
    const cleanupInit = () => {
      window.removeEventListener('resize', onWindowResize);
      if (resizeObsRef.current && mapContainer.current) {
        try {
          resizeObsRef.current.unobserve(mapContainer.current);
        } catch {}
      }
      resizeObsRef.current = null;
    };

    // Armazena cleanup dentro do ref do mapa para ser acionado no unmount
    // (técnica rápida; também poderíamos usar um outro ref ou state)
    (map.current as any).__cleanupInit = cleanupInit;
  };

  // Inicializa o mapa uma única vez
  useEffect(() => {
    initMap();

    return () => {
      if (map.current) {
        clearMarkers();
        const cleanupInit = (map.current as any).__cleanupInit as
          | (() => void)
          | undefined;
        if (cleanupInit) cleanupInit();
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atualiza centro/zoom
  useEffect(() => {
    if (map.current) {
      map.current.flyTo({ center, zoom });
    }
  }, [center, zoom]);

  // Atualiza marcadores quando os pontos mudam
  useEffect(() => {
    if (map.current) updateMarkers(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  // Quando o efeito de blur sai, força um resize
  useEffect(() => {
    if (map.current && !isBlurred) {
      requestAnimationFrame(() => map.current?.resize());
    }
  }, [isBlurred]);

  return (
    <div className={isBlurred ? 'blurred' : undefined}>
      {/* O CSS do projeto deve garantir que .map-container tenha width/height do layout */}
      <div ref={mapContainer} className="map-container" />
    </div>
  );
};

export default MapComponent;
