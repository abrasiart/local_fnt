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
  produto_url?: string | null; // opcional, vindo do CSV
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
  const [userLocationCoords, setUserLocationCoords] =
    useState<[number, number] | null>(null); // [lon, lat]
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

  /** Helper: URL do produto (usa produto_url ou fallback de busca) */
  const getProductUrl = (p: Product) => {
    const url = (p.produto_url || "").trim();
    return url || `https://paviloche.com.br/?s=${encodeURIComponent(p.nome)}`;
  };

  /** Carregar destaques ao montar */
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
        coordsFromApi = [params.lon, params.lat];
        try {
          // se já preferir, migre para uma rota backend /geocode/reverse para esconder a KEY
          const KEY = "0b4186d795a547769c0272db912585c3";
          const r = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${params.lat}+${params.lon}&key=${KEY}&pretty=0&no_annotations=1`
          );
          const j = await r.json();
          addressFromApi = j?.results?.[0]?.formatted ?? `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
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

  return (
    <div className="App">
      <header>
        <div className="container">
          <h1>Paviloche</h1>
          <nav>
            <a href="#">Produtos</a>
            <a href="#">Institucional</a>
            <a href="#" onClick={() => setShowLocationModal(true)}>
              Seu local: {userLocationAddress || "Informe seu local"}
            </a>
            <a href="#">Seja um revendedor</a>
            <a href="#">Contato</a>
          </nav>
        </div>
      </header>

      <main className="main-content-layout">
        {/* Sidebar esquerda */}
        <div className="sidebar-left">
          <h2 className="slogan-title">Sempre tem um ponto de venda Paviloche pertinho de você!</h2>

          <section className="search-section">
            <div className="search-bar">
              <input
                type="text"
                id="product-search"
                placeholder="O que você quer encontrar?"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
              />
              <button onClick={handleProductSearch}>Pesquisar</button>
            </div>

            {/* Detalhes do produto selecionado */}
            {selectedProduct && (
              <div className="selected-product-details">
                <h3 className="product-title">{selectedProduct.nome}</h3>
                <p className="product-description">
                  {selectedProduct.volume} - {selectedProduct.nome}
                </p>
                <div className="product-card compact">
                  <img src={selectedProduct.imagem_url} alt={selectedProduct.nome} />
                  {selectedProduct.em_destaque && (
                    <span className="highlight-tag">NOVO</span>
                  )}
                </div>

                {/* SAIBA MAIS */}
                <a
                  className="saiba-mais-link"
                  href={getProductUrl(selectedProduct)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  SAIBA MAIS &gt;
                </a>
              </div>
            )}

            {/* Resultados da busca */}
            {productSearchTerm.trim() !== "" && (
              <div className="product-search-results">
                <h3>Resultados da Busca</h3>
                <div className="product-grid">
                  {loadingProductSearch ? (
                    <p>Buscando produtos...</p>
                  ) : error ? (
                    <p style={{ color: "red" }}>{error}</p>
                  ) : foundProducts.length === 0 ? (
                    <p>Nenhum produto encontrado para "{productSearchTerm}".</p>
                  ) : (
                    foundProducts.map((p) => (
                      <div key={p.id} className="product-card">
                        <img src={p.imagem_url} alt={p.nome} />
                        <h4>{p.nome}</h4>
                        <p>{p.volume}</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleSelectProductAndSearchPdvs(p)}>
                            Encontrar
                          </button>
                          <a
                            className="saiba-mais-link inline"
                            href={getProductUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Saiba mais
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Destaques */}
            {productSearchTerm.trim() === "" && !selectedProduct && (
              <div className="product-highlights">
                <h3>Produtos em destaque</h3>
                <div id="highlight-products-list" className="product-grid">
                  {loadingProducts ? (
                    <p>Carregando produtos...</p>
                  ) : error ? (
                    <p style={{ color: "red" }}>{error}</p>
                  ) : highlightProducts.length === 0 ? (
                    <p>Nenhum produto em destaque encontrado.</p>
                  ) : (
                    highlightProducts.map((p) => (
                      <div key={p.id} className="product-card">
                        {p.em_destaque && <span className="highlight-tag">NOVO</span>}
                        <img src={p.imagem_url} alt={p.nome} />
                        <h4>{p.nome}</h4>
                        <p>{p.volume}</p>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => handleSelectProductAndSearchPdvs(p)}>
                            Encontrar
                          </button>
                          <a
                            className="saiba-mais-link inline"
                            href={getProductUrl(p)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Saiba mais
                          </a>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Mapa + resultados */}
        <div className="main-map-area">
          <section className="results-section">
            <div className="map-area" style={{ height: "600px" }}>
              <MapComponent
                center={mapCenter}
                zoom={mapZoom}
                points={pdvResults}
                isBlurred={showLocationModal || !userLocationCoords}
              />
            </div>

            {selectedProduct ? (
              <>
                <h2 className="locals-count">
                  {pdvResults.length} locais mais próximos
                </h2>

                <div id="pdv-results" className="pdv-list">
                  {loadingPdvs ? (
                    <p>Buscando pontos de venda...</p>
                  ) : error ? (
                    <p style={{ color: "red" }}>{error}</p>
                  ) : pdvResults.length === 0 ? (
                    <p>
                      Nenhum ponto de venda encontrado para este produto na sua
                      localização.
                    </p>
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
              <div className="message-overlay-above-map">
                <h2>Escolha primeiro um produto para encontrar em lojas próximas</h2>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal de localização */}
      {showLocationModal && (
        <div className="modal">
          <div className="modal-content">
            <span
              className="close-button"
              onClick={() => setShowLocationModal(false)}
            >
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
