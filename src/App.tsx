import React, { useEffect, useState } from "react";
import MapComponent from "./MapComponent";
import { API_BASE } from "./config";

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

  // Modal / localização do usuário
  const [showLocationModal, setShowLocationModal] = useState<boolean>(true);
  const [userLocationCoords, setUserLocationCoords] = useState<[number, number] | null>(null); // [lon, lat]
  const [userLocationAddress, setUserLocationAddress] = useState<string | null>(null);
  const [cep, setCep] = useState<string>("");

  // Produtos em destaque
  const [highlightProducts, setHighlightProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  // Busca por produto
  const [productSearchTerm, setProductSearchTerm] = useState<string>("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [loadingProductSearch, setLoadingProductSearch] = useState<boolean>(false);

  // Produto selecionado
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // PDVs
  const [pdvResults, setPdvResults] = useState<PointOfSale[]>([]);
  const [loadingPdvs, setLoadingPdvs] = useState<boolean>(false);

  // Mensagens
  const [error, setError] = useState<string | null>(null);

  // Mapa
  const [mapCenter, setMapCenter] = useState<[number, number]>([-48.847, -26.304]); // [lon, lat]
  const [mapZoom, setMapZoom] = useState<number>(11);

  // Carrega destaques
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

  /**
   * Define a localização do usuário (CEP ou lat/lon).
   * Para CEP, geocodifica diretamente na AwesomeAPI (sem depender dos PDVs).
   */
  const searchPdvsByLocation = async (params: { cep?: string; lat?: number; lon?: number }) => {
    setLoadingPdvs(true);
    setError(null);
    setPdvResults([]);
    setShowLocationModal(false);

    let addressFromApi: string | null = null;
    let coordsFromApi: [number, number] | null = null; // [lon, lat]

    try {
      if (params.cep) {
        const cleanCep = params.cep.replace(/\D/g, "");
        if (cleanCep.length !== 8) {
          setError("CEP inválido. Deve conter 8 dígitos.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }

        // Geocodificação do CEP diretamente (sem usar /pdvs/proximos)
        const r = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
        if (!r.ok) {
          setError("Não foi possível validar o CEP. Tente novamente.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
        const j = await r.json();
        if (!j.lat || !j.lng) {
          setError("CEP válido, mas sem coordenadas para exibir no mapa. Tente outro CEP.");
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }

        const lat = parseFloat(j.lat);
        const lon = parseFloat(j.lng);
        coordsFromApi = [lon, lat];
        addressFromApi = [j.address, j.district, j.city, j.state, j.cep].filter(Boolean).join(", ");
     } else if (params.lat && params.lon) {
  coordsFromApi = [params.lon, params.lat];
  // Sem chamada a serviços externos — só um texto simples
  addressFromApi = `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
}

      } else {
        setError("Nenhum CEP ou localização fornecida para busca.");
        setLoadingPdvs(false);
        setShowLocationModal(true);
        return;
      }

      // Aplica no estado e posiciona o mapa
      setUserLocationCoords(coordsFromApi);
      setUserLocationAddress(addressFromApi);
      setMapCenter(coordsFromApi!);
      setMapZoom(12);

      setLoadingPdvs(false);
      setSelectedProduct(null); // usuário ainda vai escolher o produto
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

  // Busca de produtos por nome
  const handleProductSearch = async () => {
    if (!productSearchTerm.trim()) {
      setFoundProducts([]);
      return;
    }
    setLoadingProductSearch(true);
    setError(null);
    setFoundProducts([]);
    try {
      const resp = await fetch(`${BACKEND_URL}/produtos/buscar?q=${encodeURIComponent(productSearchTerm)}`);
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

  // Ao selecionar um produto: busca PDVs próximos para esse produto
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
        setMapZoom(12);
      }
    } catch (e: any) {
      setError(`Erro ao buscar locais para o produto: ${e.message}.`);
    } finally {
      setLoadingPdvs(false);
    }
  };

  const renderProductCard = (p: Product) => (
    <div key={p.id} className="product-card">
      {p.em_destaque && <span className="highlight-tag">NOVO</span>}

      <div className="product-content">
        <img className="product-image" src={p.imagem_url} alt={p.nome} />
        <div className="product-info">
          <h4 className="product-title">{p.nome}</h4>
          {p.volume && <p className="product-volume">{p.volume}</p>}
        </div>
        <div className="product-actions">
          <button type="button" className="btn-primary" onClick={() => handleSelectProductAndSearchPdvs(p)}>
            Encontrar
          </button>
          {p.produto_url ? (
            <a className="know-more" href={p.produto_url} target="_blank" rel="noopener noreferrer">
              SAIBA MAIS &gt;
            </a>
          ) : (
            <a
              className="know-more"
              href={`https://paviloche.com.br/?s=${encodeURIComponent(p.nome)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              SAIBA MAIS &gt;
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="App">
      <main className="main-content-layout">
        {/* Lateral esquerda */}
        <div className="sidebar-left">
          <section className="search-section">
            <label className="search-label">Qual produto você quer encontrar?</label>
            <div className="search-bar">
              <input
                type="text"
                placeholder="Digite o nome do produto"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
              />
              <button type="button" onClick={handleProductSearch}>
                Buscar
              </button>
            </div>
          </section>

          {productSearchTerm.trim() !== "" ? (
            <section className="product-highlights">
              <h3>Resultados da busca</h3>
              {loadingProductSearch ? (
                <p>Buscando produtos...</p>
              ) : error ? (
                <p className="danger">{error}</p>
              ) : foundProducts.length === 0 ? (
                <p>Nenhum produto encontrado para "{productSearchTerm}".</p>
              ) : (
                foundProducts.map(renderProductCard)
              )}
            </section>
          ) : (
            <section className="product-highlights">
              <h3>Produtos em destaque</h3>
              {loadingProducts ? (
                <p>Carregando produtos...</p>
              ) : error ? (
                <p className="danger">{error}</p>
              ) : highlightProducts.length === 0 ? (
                <p>Nenhum produto em destaque encontrado.</p>
              ) : (
                highlightProducts.map(renderProductCard)
              )}
            </section>
          )}
        </div>

        {/* Área do mapa e resultados */}
        <div className="main-map-area">
          <section className="results-section">
            <div className="map-area">
              <MapComponent
                center={mapCenter}
                zoom={mapZoom}
                points={pdvResults}
                isBlurred={showLocationModal || !userLocationCoords}
              />
              <a
                className="map-cta"
                href="https://paviloche.com.br/seja-um-revendedor/"
                target="_blank"
                rel="noopener"
              >
                Quero revender
              </a>
            </div>

            {selectedProduct ? (
              <>
                <h2 className="locals-count">{pdvResults.length} locais mais próximos</h2>
                <div id="pdv-results" className="pdv-list">
                  {loadingPdvs ? (
                    <p>Buscando pontos de venda...</p>
                  ) : error ? (
                    <p className="danger">{error}</p>
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
            <span className="close-button" onClick={() => setShowLocationModal(false)}>
              &times;
            </span>
            <h2>Onde você quer encontrar nossos produtos?</h2>
            <div className="location-input-group">
              <input
                type="text"
                placeholder="Informe sua localização (CEP)"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
              />
              <button type="button" onClick={handleSearchByCepClick}>
                Buscar
              </button>
            </div>
            <p className="or-divider">OU</p>
            <button type="button" className="use-my-location-button" onClick={handleUseMyLocation}>
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
