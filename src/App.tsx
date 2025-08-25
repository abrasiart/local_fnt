// src/App.tsx
import './App.css';
import './overrides.css';
import React, { useEffect, useState } from "react";
import MapComponent from "./MapComponent";
import { API_BASE } from "./config";

/** Tipos */
type Product = {
  id: string;
  nome: string;
  volume: string;
  em_destaque: boolean;
  imagem_url: string;
  produto_url?: string | null;
};

type PointOfSale = {
  id: string;
  nome: string;
  cep: string;
  endereco: string;
  latitude: number;
  longitude: number;
  distancia_km: number;
};

export default function App() {
  const BACKEND_URL = API_BASE;

  /** Localização / Modal */
  const [showLocationModal, setShowLocationModal] = useState<boolean>(true);
  const [userLocationCoords, setUserLocationCoords] = useState<[number, number] | null>(null); // [lon, lat]
  const [userLocationAddress, setUserLocationAddress] = useState<string | null>(null);
  const [cep, setCep] = useState<string>("");

  /** Produtos */
  const [highlightProducts, setHighlightProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  /** Busca de produtos */
  const [productSearchTerm, setProductSearchTerm] = useState<string>("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [loadingProductSearch, setLoadingProductSearch] = useState<boolean>(false);

  /** Produto selecionado */
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  /** PDVs */
  const [pdvResults, setPdvResults] = useState<PointOfSale[]>([]);
  const [loadingPdvs, setLoadingPdvs] = useState<boolean>(false);

  /** Erros */
  const [error, setError] = useState<string | null>(null);

  /** Mapa */
  const [mapCenter, setMapCenter] = useState<[number, number]>([-48.847, -26.304]);
  const [mapZoom, setMapZoom] = useState<number>(11);

  /** Destaques ao montar */
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${BACKEND_URL}/produtos/destaque`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data: Product[] = await resp.json();
        setHighlightProducts(data);
      } catch (e: any) {
        console.error("Erro ao buscar destaques:", e);
        setError("Não foi possível carregar os produtos em destaque.");
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [BACKEND_URL]);

  /** Buscar PDVs por CEP ou Lat/Lon */
  const searchPdvsByLocation = async (params: { cep?: string; lat?: number; lon?: number }) => {
    setLoadingPdvs(true);
    setError(null);
    setPdvResults([]);
    setShowLocationModal(false);

    let addressFromApi: string | null = null;
    let coordsFromApi: [number, number] | null = null;

    try {
      if (params.cep) {
        const cleanCep = params.cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) {
          setError("CEP inválido. Deve conter 8 dígitos.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
        // backend já geocodifica e retorna PDVs próximos
        const resp = await fetch(`${BACKEND_URL}/pdvs/proximos?cep=${cleanCep}`);
        const data = await resp.json();
        if (!resp.ok || !Array.isArray(data) || data.length === 0) {
          setError((data && data.erro) || "Não foi possível validar o CEP. Tente novamente.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
        const first = data[0];
        if (first?.latitude && first?.longitude) {
          coordsFromApi = [parseFloat(first.longitude), parseFloat(first.latitude)];
          addressFromApi = first.endereco;
        } else {
          setError("CEP válido, mas sem coordenadas para exibir no mapa. Tente outro CEP.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
      } else if (params.lat && params.lon) {
        // usar localização atual do navegador
        coordsFromApi = [params.lon, params.lat];

        try {
          const r = await fetch(
            `${BACKEND_URL}/geocode/reverse?lat=${encodeURIComponent(
              params.lat
            )}&lon=${encodeURIComponent(params.lon)}`
          );
          const j = await r.json();
          addressFromApi = j?.formatted ?? `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
        } catch {
          addressFromApi = `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
        }
      } else {
        setError("Nenhum CEP ou localização fornecida para busca.");
        setLoadingPdvs(false);
        setShowLocationModal(true);
        return;
      }

      setUserLocationCoords(coordsFromApi);
      setUserLocationAddress(addressFromApi);
      setLoadingPdvs(false);
      setSelectedProduct(null);
    } catch (e: any) {
      console.error("ERRO em searchPdvsByLocation:", e);
      setError(`Erro ao obter sua localização: ${e.message}. Tente novamente.`);
      setLoadingPdvs(false);
      setShowLocationModal(true);
    }
  };

  const handleSearchByCepClick = () => searchPdvsByLocation({ cep });

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocalização não é suportada pelo seu navegador.");
      setShowLocationModal(true);
      return;
    }
    setShowLocationModal(false);
    setLoadingPdvs(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        await searchPdvsByLocation({ lat: latitude, lon: longitude });
      },
      (geoError) => {
        setError(`Erro ao obter sua localização: ${geoError.message}. Por favor, digite seu CEP.`);
        setLoadingPdvs(false);
        setShowLocationModal(true);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleProductSearch = async () => {
    if (!productSearchTerm.trim()) {
      setFoundProducts([]);
      return;
    }
    setLoadingProductSearch(true);
    setError(null);
    setFoundProducts([]);
    try {
      const resp = await fetch(
        `${BACKEND_URL}/produtos/buscar?q=${encodeURIComponent(productSearchTerm)}`
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(`Erro ao buscar produtos: ${errData.erro || resp.statusText}`);
      }
      const data: Product[] = await resp.json();
      setFoundProducts(data);
    } catch (e: any) {
      setError(`Erro ao buscar produtos: ${e.message}.`);
    } finally {
      setLoadingProductSearch(false);
    }
  };

  const handleSelectProductAndSearchPdvs = async (product: Product) => {
    if (!userLocationCoords) {
      setShowLocationModal(true);
      setError("Por favor, informe sua localização primeiro para encontrar lojas.");
      return;
    }
    setSelectedProduct(product);
    setLoadingPdvs(true);
    setError(null);
    setPdvResults([]);
    try {
      const [lon, lat] = userLocationCoords;
      const url = `${BACKEND_URL}/pdvs/proximos/produto?productId=${product.id}&lat=${lat}&lon=${lon}`;
      const resp = await fetch(url);
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(`Erro ao buscar PDVs para o produto: ${errData.erro || resp.statusText}`);
      }
      const data: PointOfSale[] = await resp.json();
      setPdvResults(data);
      if (data.length > 0) {
        const first = data[0];
        setMapCenter([first.longitude, first.latitude]);
        setMapZoom(13);
      } else {
        setMapZoom(11);
      }
    } catch (e: any) {
      setError(`Erro ao buscar locais para o produto: ${e.message}.`);
    } finally {
      setLoadingPdvs(false);
    }
  };

  /** Render helper para lista de cards (destaques e busca) */
  const renderProductList = (list: Product[]) => (
    <>
      {(list || []).map((p) => (
        <div key={p.id} className="product-list-card">
          {p.em_destaque && <span className="tag-new">NOVO</span>}

          <img className="product-thumb" src={p.imagem_url} alt={p.nome} loading="lazy" />

          <div className="product-info">
            <h4 className="product-name">{p.nome}</h4>
            <p className="product-volume">{p.volume}</p>
          </div>

          <button
            className="btn-find"
            onClick={() => handleSelectProductAndSearchPdvs(p)}
            aria-label={`Encontrar ${p.nome} perto de mim`}
          >
            Encontrar
          </button>
        </div>
      ))}
    </>
  );

  return (
    <div className="App">
      {/* Cabeçalho simples – mantenha/ajuste conforme seu tema */}
      <header>
        <div className="container">
          <h1>Paviloche</h1>
          <nav>
            <a href="#">Produtos</a>
            <a href="#">Institucional</a>
            <a href="#" onClick={() => setShowLocationModal(true)}>
              Seu local: {userLocationAddress || "Informe seu local"}
            </a>
            <a href="https://paviloche.com.br/seja-um-revendedor/" target="_blank" rel="noreferrer">
              Seja um revendedor
            </a>
            <a href="#">Contato</a>
          </nav>
        </div>
      </header>

      <main className="main-content-layout">
        {/* Sidebar esquerda */}
        <aside className="sidebar-left">
          {/* Busca */}
          <div className="search-section">
            <label htmlFor="product-search" className="search-label">
              Qual produto você quer encontrar?
            </label>

            <div className="search-bar pill">
              <input
                type="text"
                id="product-search"
                className="search-input"
                placeholder="Digite o nome do produto"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
              />
              <button className="search-btn" onClick={handleProductSearch}>
                Pesquisar
              </button>
            </div>
          </div>

          {/* Lista de produtos */}
          {productSearchTerm.trim() !== "" ? (
            <section className="product-search-results">
              <h3>Resultados da busca</h3>
              {loadingProductSearch ? (
                <p>Buscando produtos...</p>
              ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
              ) : foundProducts.length === 0 ? (
                <p>Nenhum produto encontrado para "{productSearchTerm}".</p>
              ) : (
                renderProductList(foundProducts)
              )}
            </section>
          ) : (
            <section className="product-highlights">
              <h3>Produtos em destaque</h3>
              {loadingProducts ? (
                <p>Carregando produtos...</p>
              ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
              ) : highlightProducts.length === 0 ? (
                <p>Nenhum produto em destaque encontrado.</p>
              ) : (
                renderProductList(highlightProducts)
              )}
            </section>
          )}
        </aside>

        {/* Mapa + resultados */}
        <section className="main-map-area">
          <div className="map-wrap">
            <div className="map-area">
              <MapComponent
                center={mapCenter}
                zoom={mapZoom}
                points={pdvResults}
                isBlurred={showLocationModal || !userLocationCoords}
              />
            </div>

            {/* Botão flutuante sobre o mapa */}
            <a
              className="cta-reseller"
              href="https://paviloche.com.br/seja-um-revendedor/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Quero revender
            </a>
          </div>

          {/* Detalhes do produto selecionado (inclui "Saiba mais" somente quando há produto selecionado) */}
          {selectedProduct && (
            <div className="selected-product-details" style={{ marginTop: 16 }}>
              <h3 className="product-title">{selectedProduct.nome}</h3>
              <p className="product-description">
                {selectedProduct.volume} - {selectedProduct.nome}
              </p>
              <div className="product-card compact">
                <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} />
                {selectedProduct.em_destaque && <span className="highlight-tag">NOVO</span>}
              </div>
              {selectedProduct.produto_url && (
                <a
                  href={selectedProduct.produto_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="saba-mais-link"
                >
                  SAIBA MAIS &gt;
                </a>
              )}
            </div>
          )}

          {/* Lista de PDVs */}
          {selectedProduct ? (
            <>
              <h2 className="locals-count" style={{ marginTop: 24 }}>
                {pdvResults.length} locais mais próximos
              </h2>

              <div id="pdv-results" className="pdv-list">
                {loadingPdvs ? (
                  <p>Buscando pontos de venda...</p>
                ) : error ? (
                  <p style={{ color: "red" }}>{error}</p>
                ) : pdvResults.length === 0 ? (
                  <p>Nenhum ponto de venda encontrado para este produto na sua localização.</p>
                ) : (
                  pdvResults.map((pdv) => (
                    <div key={pdv.id} className="pdv-item">
                      <h4>{pdv.nome}</h4>
                      <p>
                        Endereço: {pdv.endereco}, {pdv.cep}
                      </p>
                      <p>Distância: {pdv.distancia_km} km</p>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="message-overlay-above-map" style={{ marginTop: 24 }}>
              <h2>Escolha primeiro um produto para encontrar em lojas próximas</h2>
            </div>
          )}
        </section>
      </main>

      {/* Modal de localização */}
      {showLocationModal && (
        <div className="modal">
          <div className="modal-content">
            <span className="close-button" onClick={() => setShowLocationModal(false)}>
              &times;
            </span>
            <h2>Onde você quer encontrar nossos produtos?</h2>
            <div className="location-input-group">
              <input
                type="text"
                id="cep-input"
                placeholder="Informe sua localização (CEP)"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
              <button onClick={handleSearchByCepClick}>Buscar</button>
            </div>
            <p className="or-divider">OU</p>
            <button className="use-my-location-button" onClick={handleUseMyLocation}>
              Usar minha localização
            </button>
            <p className="cep-hint">
              <small>Após informar seu local, escolha um produto na lateral.</small>
            </p>
            <div className="powered-by">Desenvolvido por Paviloche</div>
          </div>
        </div>
      )}
    </div>
  );
}
