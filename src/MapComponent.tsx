import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = 'pk.eyJ1IjoiYWJyYXNpbGFydCIsImEiOiJjbWQzaWd1MWYwNTZ2Mm1xNGpmaDRidGdkIn0.0fOq0GcKZhlP2ZZrjPR08w'; // <<<< ATENÇÃO: COLOQUE SEU TOKEN REAL AQUI!

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
            console.log('MapComponent: Mapa ou estilo não carregado ainda para adicionar marcadores. Esperando...');
            if (map.current) {
                map.current.once('style.load', () => updateMarkers(currentPoints));
            }
            return;
        }
        console.log('MapComponent: Atualizando marcadores...');

        const existingMarkers = document.getElementsByClassName('mapboxgl-marker');
        while (existingMarkers.length > 0) {
            existingMarkers[0].remove();
        }

        currentPoints.forEach(point => {
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
        console.log(`MapComponent: ${currentPoints.length} marcadores adicionados.`);
    };

    useEffect(() => {
        console.log('MapComponent: useEffect de inicialização do mapa executado.');
        if (map.current) {
            console.log('MapComponent: Mapa já inicializado, pulando inicialização.');
            return;
        }

        if (!mapContainer.current) {
            console.error('MapComponent: mapContainer.current é null. O elemento DOM do mapa não está disponível. Re-tentando...');
            // Usar requestAnimationFrame para garantir que o contêiner esteja no DOM
            requestAnimationFrame(() => {
                console.warn('MapComponent: Re-tentando inicialização via requestAnimationFrame.');
                // Forçar um re-render dummy (ex: mudando um estado local) para re-executar este useEffect
                // Esta lógica não é ideal, a melhor é garantir que o pai tenha dimensões
            });
            return;
        }

        const containerWidth = mapContainer.current.clientWidth;
        const containerHeight = mapContainer.current.clientHeight;

        console.log(`MapComponent: Dimensões computadas do container: ${containerWidth}px x ${containerHeight}px`);

        if (containerWidth === 0 || containerHeight === 0) {
            console.warn('MapComponent: Contêiner do mapa tem dimensão zero. Aguardando dimensão...');
            // Aumentar o atraso para dar mais tempo ao DOM
            setTimeout(() => {
                if (mapContainer.current) {
                   const finalWidth = mapContainer.current.clientWidth;
                   const finalHeight = mapContainer.current.clientHeight;
                   if (finalWidth > 0 && finalHeight > 0) {
                     // Se tiver dimensão, tenta inicializar
                     console.warn('MapComponent: Altura encontrada no setTimeout. Inicializando...');
                     // Recriar o mapa aqui. Esta é a forma mais robusta de contornar.
                     map.current = new mapboxgl.Map({
                        container: mapContainer.current,
                        style: 'mapbox://styles/mapbox/streets-v11',
                        center: center,
                        zoom: zoom,
                     });
                     console.log('MapComponent: Instância criada no setTimeout!');
                     if (map.current) {
                       map.current.on('load', () => updateMarkers(points));
                       map.current.resize();
                     }
                   }
                }
            }, 250); // Atraso de 250ms
            return;
        }

        try {
            console.log('MapComponent: Tentando inicializar novo mapboxgl.Map...');
            map.current = new mapboxgl.Map({
                container: mapContainer.current,
                style: 'mapbox://styles/mapbox/streets-v11',
                center: center,
                zoom: zoom,
            });
            console.log('MapComponent: mapboxgl.Map instância CRIADA:', map.current);

            map.current.on('load', () => {
                console.log('MapComponent: Evento "load" do mapa disparado. Mapa e estilo carregados.');
                if (map.current) {
                    map.current.addControl(new mapboxgl.NavigationControl(), 'top-left');
                    updateMarkers(points);
                    map.current.resize();
                    console.log('MapComponent: map.resize() chamado após load.');

                    setTimeout(() => {
                        if (map.current) {
                            map.current.resize();
                            console.log('MapComponent: map.resize() chamado com atraso (fallback para renderização final).');
                        }
                    }, 250);
                }
            });

            map.current.on('move', () => {
                if (map.current) {
                    setLng(parseFloat(map.current.getCenter().lng.toFixed(4)));
                    setLat(parseFloat(map.current.getCenter().lat.toFixed(4)));
                    setMapZoom(parseFloat(map.current.getZoom().toFixed(2)));
                }
            });

        } catch (e: any) {
            console.error('MapComponent: ERRO FATAL ao inicializar Mapbox:', e);
            console.error('MapComponent: Mensagem:', e.message);
            console.error('MapComponent: Stack:', e.stack);
            console.error('Verifique seu token de acesso Mapbox (https://account.mapbox.com/), seu CSS (.map-container precisa de height/width) e se não há restrições de URL no token.');
        }

        return () => {
            console.log('MapComponent: Função de cleanup, removendo mapa.');
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    useEffect(() => {
        console.log('MapComponent: useEffect de atualização de centro/zoom. Center:', center, 'Zoom:', zoom);
        if (map.current) {
            map.current.flyTo({ center: center, zoom: zoom });
        }
    }, [center, zoom]);

    useEffect(() => {
        console.log('MapComponent: useEffect de atualização de pontos. Pontos:', points.length);
        updateMarkers(points);
    }, [points]);

    useEffect(() => {
        if (map.current && !isBlurred) {
            map.current.resize();
            console.log('MapComponent: map.resize() chamado após desborrar.');
        }
    }, [isBlurred, map.current]);

    return (
        <div>
            <div ref={mapContainer} className={`map-container ${isBlurred ? 'blurred' : ''}`} />
        </div>
    );
};

export default MapComponent;