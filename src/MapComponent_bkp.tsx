import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L, { LatLngExpression, Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

// Sub-componente para forçar o redimensionamento do mapa
const MapRefresher = () => {
    const map = useMap();
    useEffect(() => {
        map.invalidateSize();
    }, [map]);
    return null;
};

// Corrigindo o problema do ícone padrão do Leaflet
L.Icon.Default.mergeOptions({
    iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const customIcon = new Icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [38, 38],
});

const MapComponent: React.FC<MapComponentProps> = ({ center, zoom, points, isBlurred }) => {
    return (
        <div className={`map-container ${isBlurred ? 'blurred' : ''}`}>
            <MapContainer
                key={JSON.stringify(center)}
                center={center}
                zoom={zoom}
                scrollWheelZoom={true}
                className="leaflet-map"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapRefresher />
                {points.map(point => (
                    <Marker
                        key={point.id}
                        position={[point.latitude, point.longitude]}
                        icon={customIcon}
                    >
                        <Popup>
                            <strong>{point.nome}</strong><br />
                            {point.endereco}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default MapComponent;