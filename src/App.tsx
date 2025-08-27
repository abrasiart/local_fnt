import React, { useEffect, useState } from "react";
import MapComponent from "./MapComponent";
import { API_BASE } from "./config";

// Tipos
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

const App: React.FC = () => {
  const BACKEND_URL = API_BASE;

  // Localização / Modal
  const [showLocationModal, setShowLocationModal] = useState<boolean>(true);
  const [userLocationCoords, setUserLocationCoords] =
    useState<[number, number] | null>(null); // [lon, lat]
  const [userLocationAddress, setUserLocationAddress] = useState<string | null>(
    null
  );
  const [cep, setCep] = useState<string>("");

  // Produtos
  const [highlightProducts, setHighlightProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);

  // Busca de produtos
  const [productSearchTerm, setProductSearchTerm] = useState<string>("");
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [loadingProductSearch, setLoadingProductSearch] =
    useState<boolean>(false);

  // Produto selecionado
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // PDVs
  const [pdvResults, setPdvResults] = useState<PointOfSale[]>([]);
  const [loadingPdvs, setLoadingPdvs] = useState<boolean>(false);

  // Erros
  const [error, setError] = useState<string | null>(null);

  // Mapa
  const [mapCenter, setMapCenter] = useState<[number, number]>([
    -48.847, -26.304,
  ]);
  const [mapZoom, setMapZoom] = useState<number>(11);

  // Destaques ao montar (carrega e limita a 5 no render)
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

  // Buscar PDVs por CEP ou Lat/Lon
  const searchPdvsByLocation = async (params: {
    cep?: string;
    lat?: number;
    lon?: number;
  }) => {
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
          setError(
            (data && data.erro) ||
              "Não foi possível validar o CEP. Tente novamente."
          );
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
        const first = data[0];
        if (first?.latitude && first?.longitude) {
          coordsFromApi = [
            parseFloat(first.longitude),
            parseFloat(first.latitude),
          ];
          addressFromApi = first.endereco;
        } else {
          setError(
            "CEP válido, mas sem coordenadas para exibir no mapa. Tente outro CEP."
          );
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
      } else if (params.lat && params.lon) {
        // usar localização atual
        coordsFromApi = [params.lon, params.lat];
        try {
          const KEY = "0b4186d795a547769c0272db912585c3";
          const r = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${params.lat}+${params.lon}&key=${KEY}&pretty=0&no_annotations=1`
          );
          const j = await r.json();
          addressFromApi =
            j?.results?.[0]?.formatted ??
            `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
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
        setError(
          `Erro ao obter sua localização: ${geoError.message}. Por favor, digite seu CEP.`
        );
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
        `${BACKEND_URL}/produtos/buscar?q=${encodeURIComponent(
          productSearchTerm
        )}`
      );
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(
          `Erro ao buscar produtos: ${errData.erro || resp.statusText}`
        );
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
        throw new Error(
          `Erro ao buscar PDVs para o produto: ${errData.erro || resp.statusText}`
        );
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

  // --- UI helpers -----------------------------------------------------------

  const renderProductCard = (product: Product) => {
    return (
      <div
        key={product.id}
        className="product-card"
         style={{
    width: "100%",            // <- força ocupar toda a largura disponível
    border: "1px solid #eee",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    position: "relative",
        }}
      >
        {product.em_destaque && (
          <span
            className="highlight-tag"
            style={{
              position: "absolute",
              top: 8,
              left: 12,
              background: "#F0D63D",
              color: "#4B3F00",
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 12,
            }}
          >
            NOVO
          </span>
        )}

        <div
          className="product-content"
          style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 100 }}
        >
          <img
            src={product.imagem_url}
            alt={product.nome}
            style={{ width: 90, height: 90, objectFit: "contain" }}
          />

          <div className="product-info" style={{ flex: "1 1 auto" }}>
            <h4 style={{ margin: 0 }}>{product.nome}</h4>
            <p className="volume" style={{ margin: "6px 0 0 0", color: "#666" }}>
              {product.volume}
            </p>
          </div>

          <div className="cta" style={{ marginLeft: "auto" }}>
            <button
              className="btn-primary"
              onClick={() => handleSelectProductAndSearchPdvs(product)}
              style={{
                padding: "10px 16px",
                borderRadius: 20,
                background: "#5B42D8",
                color: "#fff",
                border: 0,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Encontrar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- RENDER ---------------------------------------------------------------
  return (
    <div className="App">
      <main className="main-content-layout" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 20 }}>
        {/* Sidebar esquerda */}
        <div className="sidebar-left" style={{ position: "relative" }}>
          {/* Busca */}
          <section className="search-section" style={{ marginBottom: 20 }}>
            <label
              htmlFor="product-search"
              style={{
                display: "block",
                fontWeight: 700,
                marginBottom: 8,
                color: "#4B3F90",
                fontSize: 16,
              }}
            >
              Qual produto você quer encontrar?
            </label>
            <div
              className="search-bar"
              style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
              <input
                type="text"
                id="product-search"
                placeholder="Digite o nome do produto"
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleProductSearch()}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  padding: "0 12px",
                }}
              />
              <button
                onClick={handleProductSearch}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: 0,
                  background: "#5B42D8",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Buscar
              </button>
            </div>
          </section>

          {/* Resultados da busca */}
          {productSearchTerm.trim() !== "" && (
            <section className="product-search-results" style={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#4B3F90" }}>
                Resultados da Busca
              </h3>

              {loadingProductSearch ? (
                <p>Buscando produtos...</p>
              ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
              ) : foundProducts.length === 0 ? (
                <p>
                  Nenhum produto encontrado para "{productSearchTerm}".
                </p>
              ) : (
                foundProducts.map((p) => renderProductCard(p))
              )}
            </section>
          )}

          {/* Produtos em destaque (até 5) */}
          {productSearchTerm.trim() === "" && (
            <section className="product-highlights" style={{ marginTop: 10 }}>
              <h3 style={{ margin: "0 0 12px 0", color: "#4B3F90" }}>
                Produtos em destaque
              </h3>

              {loadingProducts ? (
                <p>Carregando produtos...</p>
              ) : error ? (
                <p style={{ color: "red" }}>{error}</p>
              ) : highlightProducts.length === 0 ? (
                <p>Nenhum produto em destaque encontrado.</p>
              ) : (
                highlightProducts.slice(0, 5).map((p) => renderProductCard(p))
              )}
            </section>
          )}
        </div>

        {/* Mapa + resultados */}
        <div className="main-map-area" style={{ position: "relative" }}>
          {/* botão flutuante "Quero revender" */}
          <a
            href="https://paviloche.com.br/seja-um-revendedor/"
            target="_blank"
            rel="noreferrer"
            style={{
              position: "absolute",
              right: 16,
              bottom: 16,
              zIndex: 10,
              background: "#5B42D8",
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 18,
              fontWeight: 700,
              textDecoration: "none",
              boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
            }}
          >
            Quero revender
          </a>

          <section className="results-section">
            <div className="map-area" style={{ height: 600 }}>
              <MapComponent
                center={mapCenter}
                zoom={mapZoom}
                points={pdvResults}
                isBlurred={showLocationModal || !userLocationCoords}
              />
            </div>

            {selectedProduct ? (
              <>
                <h2 className="locals-count" style={{ marginTop: 12 }}>
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
                      <div
                        key={pdv.id}
                        className="pdv-item"
                        style={{
                          padding: "10px 0",
                          borderBottom: "1px solid #eee",
                        }}
                      >
                        <h4 style={{ margin: "0 0 4px 0" }}>{pdv.nome}</h4>
                        <p style={{ margin: 0, color: "#555" }}>
                          Endereço: {pdv.endereco}, {pdv.cep}
                        </p>
                        <p style={{ margin: 0, color: "#555" }}>
                          Distância: {pdv.distancia_km} km
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div
                className="message-overlay-above-map"
                style={{
                  textAlign: "center",
                  marginTop: 18,
                  color: "#4B3F90",
                  fontWeight: 700,
                  fontSize: 28,
                  lineHeight: 1.2,
                }}
              >
                Escolha primeiro um produto para encontrar em lojas próximas
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal de localização */}
      {showLocationModal && (
        <div
          className="modal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            className="modal-content"
            style={{
              width: 520,
              maxWidth: "90vw",
              background: "#fff",
              borderRadius: 10,
              padding: 20,
              position: "relative",
            }}
          >
            <span
              className="close-button"
              onClick={() => setShowLocationModal(false)}
              style={{
                position: "absolute",
                right: 14,
                top: 6,
                fontSize: 26,
                cursor: "pointer",
              }}
            >
              &times;
            </span>
            <h2 style={{ marginTop: 0 }}>
              Onde você quer encontrar nossos produtos?
            </h2>
            <div
              className="location-input-group"
              style={{ display: "flex", gap: 10 }}
            >
              <input
                type="text"
                id="cep-input"
                placeholder="Informe sua localização (CEP)"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  padding: "0 12px",
                }}
              />
              <button
                onClick={handleSearchByCepClick}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: 0,
                  background: "#5B42D8",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Buscar
              </button>
            </div>
            <p className="or-divider" style={{ textAlign: "center" }}>
              OU
            </p>
            <button
              className="use-my-location-button"
              onClick={handleUseMyLocation}
              style={{
                width: "100%",
                height: 44,
                borderRadius: 8,
                border: 0,
                background: "#5B42D8",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Usar minha localização
            </button>
            <p className="cep-hint" style={{ marginTop: 8 }}>
              <small>
                Após informar seu local, escolha um produto na lateral.
              </small>
            </p>
            <div
              className="powered-by"
              style={{ textAlign: "center", color: "#777", marginTop: 10 }}
            >
              Desenvolvido por Paviloche
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
