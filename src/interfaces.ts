export interface Product {
    id: string;
    nome: string;
    volume: string;
    em_destaque: boolean;
    imagem_url: string;
}

export interface PointOfSale {
    id: string;
    nome: string;
    cep: string;
    endereco: string;
    latitude: number;
    longitude: number;
    distancia_km?: number;
    products: string[];
}