import React, { useState, useEffect } from 'react';
import MapComponent from './MapComponent';
import { API_BASE } from './config'; // usa /api em produção via Vercel

// --- INTERFACES DE TIPAGEM ---
interface Product {
  id: string;
  nome: string;
  volume: string;
  em_destaque: boolean;
  imagem_url: string;
}

interface PointOfSale {
  id: string;
  nome: string;
  cep: string;
  endereco: string;
  latitude: number;
  longitude: number;
  distancia_km: number;
}
// --- FIM DAS INTERFACES ---

export default function App(): {
  const BACKEND_URL = API_BASE;

  // Estados de Localização do Usuário e Modal
  const [showLocationModal, setShowLocationModal] = useState<boolean>(true); // Mostrar modal na carga da página
  const [userLocationCoords, setUserLocationCoords] = useState<[number, number] | null>(null); // [longitude, latitude]
  const [userLocationAddress, setUserLocationAddress] = useState<string | null>(null); // Endereço legível para o header
  const [cep, setCep] = useState<string>(''); // Estado do Input de CEP no Modal

  // Log de debug para ver o estado em cada render
  console.log('App.tsx Render: userLocationCoords:', userLocationCoords);
  console.log('App.tsx Render: userLocationAddress:', userLocationAddress);

  // Estados para Produtos em Destaque e Busca de Produtos
  const [highlightProducts, setHighlightProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true); // Para produtos em destaque
  const [productSearchTerm, setProductSearchTerm] = useState<string>('');
  const [foundProducts, setFoundProducts] = useState<Product[]>([]);
  const [loadingProductSearch, setLoadingProductSearch] = useState<boolean>(false);

  // Estado para o Produto Selecionado
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Estados para Resultados de PDVs
  const [pdvResults, setPdvResults] = useState<PointOfSale[]>([]);
  const [loadingPdvs, setLoadingPdvs] = useState<boolean>(false);

  // Estado de Erro Genérico
  const [error, setError] = useState<string | null>(null);

  // Estados do Mapa (centralização e zoom)
  const [mapCenter, setMapCenter] = useState<[number, number]>([-48.847, -26.304]);
  const [mapZoom, setMapZoom] = useState<number>(11);

  // Carregar produtos em destaque ao montar o componente
  useEffect(() => {
    const fetchHighlightProducts = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/produtos/destaque`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: Product[] = await response.json();
        setHighlightProducts(data);
      } catch (err: any) {
        console.error('Erro ao buscar produtos em destaque:', err);
        setError('Não foi possível carregar os produtos em destaque.');
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchHighlightProducts();
  }, [BACKEND_URL]);

  // Função genérica para buscar PDVs por localização (CEP ou Lat/Lon)
  const searchPdvsByLocation = async (params: { cep?: string; lat?: number; lon?: number }) => {
    setLoadingPdvs(true);
    setError(null);
    setPdvResults([]);
    setShowLocationModal(false);

    let addressFromApi: string | null = null; // Endereço obtido da API (CEP ou reverso)
    let coordsFromApi: [number, number] | null = null; // Coordenadas obtidas da API (CEP ou reverso)

    console.log('[App.tsx Debug] searchPdvsByLocation chamada com params:', params);

    try {
      if (params.cep) {
        const cleanCep = params.cep.replace(/\D/g, '');
        if (cleanCep.length !== 8) {
          setError('CEP inválido. Deve conter 8 dígitos.');
          setLoadingPdvs(false);
          setShowLocationModal(true);
          console.log('[App.tsx Debug] CEP inválido, modal reaberto.');
          return;
        }

        // 1. Chamar backend para obter PDVs próximos ao CEP
        const awesomeApiUrl = `${BACKEND_URL}/pdvs/proximos?cep=${cleanCep}`;
        console.log('[App.tsx Debug] Buscando dados do CEP via backend:', awesomeApiUrl);
        const awesomeApiResponse = await fetch(awesomeApiUrl);
        const awesomeApiData = await awesomeApiResponse.json();

        if (!awesomeApiResponse.ok || (awesomeApiData && awesomeApiData.erro) || awesomeApiData.length === 0) {
          console.warn('[App.tsx Debug] Backend não retornou dados válidos para o CEP. Resposta:', awesomeApiData);
          setError((awesomeApiData && awesomeApiData.erro) || 'Não foi possível validar o CEP. Tente novamente.');
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }

        // Usar o primeiro PDV para obter coords e endereço (backend já geocodificou)
        const firstPdvForCoords = awesomeApiData[0];
        if (firstPdvForCoords && firstPdvForCoords.latitude && firstPdvForCoords.longitude) {
          coordsFromApi = [parseFloat(firstPdvForCoords.longitude), parseFloat(firstPdvForCoords.latitude)];
          addressFromApi = firstPdvForCoords.endereco;
          console.log('[App.tsx Debug] Coordenadas/endereço do CEP via backend:', coordsFromApi, addressFromApi);
        } else {
          console.warn('[App.tsx Debug] Backend retornou dados sem coords válidas:', awesomeApiData);
          setError('CEP válido, mas sem coordenadas para exibir no mapa. Tente outro CEP.');
          setLoadingPdvs(false);
          setShowLocationModal(true);
          return;
        }
      } else if (params.lat && params.lon) {
        // Caso de "Usar minha localização"
        coordsFromApi = [params.lon, params.lat];
        console.log('[App.tsx Debug] Coordenadas da localização atual:', coordsFromApi);
        try {
          const OPENCAGE_API_KEY_FRONTEND = '0b4186d795a547769c0272db912585c3'; // << Sua chave OpenCage
          const reverseGeoResponse = await fetch(
            `https://api.opencagedata.com/geocode/v1/json?q=${params.lat}+${params.lon}&key=${OPENCAGE_API_KEY_FRONTEND}&pretty=0&no_annotations=1`
          );
          const reverseGeoData = await reverseGeoResponse.json();
          if (reverseGeoData.results && reverseGeoData.results.length > 0) {
            addressFromApi = reverseGeoData.results[0].formatted;
          } else {
            addressFromApi = `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
          }
          console.log('[App.tsx Debug] Geocodificação reversa concluída. Endereço:', addressFromApi);
        } catch (revGeoError) {
          console.error('Erro ao geocodificar reverso:', revGeoError);
          addressFromApi = `${params.lat.toFixed(4)}, ${params.lon.toFixed(4)}`;
        }
      } else {
        setError('Nenhum CEP ou localização fornecida para busca.');
        setLoadingPdvs(false);
        setShowLocationModal(true);
        console.log('[App.tsx Debug] Nenhum parâmetro de localização, modal reaberto.');
        return;
      }

      // Define estados finais
      setUserLocationCoords(coordsFromApi);
      setUserLocationAddress(addressFromApi);
      console.log('[App.tsx Debug] userLocationCoords:', coordsFromApi);
      console.log('[App.tsx Debug] userLocationAddress:', addressFromApi);

      setLoadingPdvs(false);
      setSelectedProduct(null); // Zera produto selecionado para mostrar a mensagem "Escolha um produto"
    } catch (error: any) {
      console.error('[App.tsx Debug] ERRO FATAL em searchPdvsByLocation:', error);
      setError(`Erro ao obter sua localização: ${error.message}. Tente novamente.`);
      setLoadingPdvs(false);
      setShowLocationModal(true);
    }
  };

  // Função de clique para buscar por CEP (chamada no modal)
  const handleSearchByCepClick = () => {
    searchPdvsByLocation({ cep: cep });
  };

  // Função para usar a geolocalização do navegador (chamada no modal)
  const handleUseMyLocation = () => {
    if (navigator.geolocation) {
      setShowLocationModal(false);
      setLoadingPdvs(true);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log(`Localização obtida: Lat ${latitude}, Lng ${longitude}`);
          await searchPdvsByLocation({ lat: latitude, lon: longitude });
        },
        (geoError) => {
          console.error('Erro ao obter geolocalização:', geoError);
          setError(`Erro ao obter sua localização: ${geoError.message}. Por favor, digite seu CEP.`);
          setLoadingPdvs(false);
          setShowLocationModal(true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setError('Geolocalização não é suportada pelo seu navegador.');
      setShowLocationModal(true);
    }
  };

  // Buscar produtos por termo (na sidebar)
  const handleProductSearch = async () => {
    if (!productSearchTerm.trim()) {
      setFoundProducts([]);
      return;
    }

    setLoadingProductSearch(true);
    setError(null);
    setFoundProducts([]);

    try {
      const response = await fetch(`${BACKEND_URL}/produtos/buscar?q=${encodeURIComponent(productSearchTerm)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro ao buscar produtos: ${errorData.erro || response.statusText}`);
      }
      const data: Product[] = await response.json();
      setFoundProducts(data);
    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
      setError(`Erro ao buscar produtos: ${err.message}.`);
    } finally {
      setLoadingProductSearch(false);
    }
  };

  // Disparada ao clicar em "Encontrar" ao lado de um produto
  const handleSelectProductAndSearchPdvs = async (product: Product) => {
    console.log('[App.tsx Debug] handleSelectProductAndSearchPdvs chamada.');
    console.log('[App.tsx Debug] userLocationCoords no momento da chamada:', userLocationCoords);

    if (!userLocationCoords) {
      setShowLocationModal(true);
      setError('Por favor, informe sua localização primeiro para encontrar lojas.');
      console.warn('[App.tsx Debug] userLocationCoords é nulo ao selecionar produto, reabrindo modal.');
      return;
    }

    setSelectedProduct(product);
    setLoadingPdvs(true);
    setError(null);
    setPdvResults([]);

    try {
      const [lon, lat] = userLocationCoords;
      const apiUrl = `${BACKEND_URL}/pdvs/proximos/produto?productId=${product.id}&lat=${lat}&lon=${lon}`;

      const response = await fetch(apiUrl);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro ao buscar PDVs para o produto: ${errorData.erro || response.statusText}`);
      }
      const data: PointOfSale[] = await response.json();
      setPdvResults(data);

      if (data.length > 0) {
        const firstPdv = data[0];
        setMapCenter([firstPdv.longitude, firstPdv.latitude]);
        setMapZoom(13);
      } else {
        setMapZoom(11);
      }
    } catch (err: any) {
      console.error('Erro ao buscar PDVs para o produto:', err);
      setError(`Erro ao buscar locais para o produto: ${err.message}.`);
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
              Seu local: {userLocationAddress || 'Informe seu local'}
            </a>
            <a href="#">Seja um revendedor</a>
            <a href="#">Contato</a>
          </nav>
        </div>
      </header>

      <main className="main-content-layout">
        {/* Coluna da Esquerda (Sidebar) */}
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
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleProductSearch();
                  }
                }}
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
                  {selectedProduct.em_destaque && <span className="highlight-tag">NOVO</span>}
                </div>
                <a href="#" className="saba-mais-link">
                  SAIBA MAIS &gt;
                </a>
              </div>
            )}

            {/* Resultados da busca de produtos */}
            {productSearchTerm.trim() !== '' && (
              <div className="product-search-results">
                <h3>Resultados da Busca</h3>
                <div className="product-grid">
                  {loadingProductSearch ? (
                    <p>Buscando produtos...</p>
                  ) : error ? (
                    <p style={{ color: 'red' }}>{error}</p>
                  ) : foundProducts.length === 0 ? (
                    <p>Nenhum produto encontrado para "{productSearchTerm}".</p>
                  ) : (
                    foundProducts.map((product) => (
                      <div key={product.id} className="product-card">
                        <img src={product.imagem_url} alt={product.nome} />
                        <h4>{product.nome}</h4>
                        <p>{product.volume}</p>
                        <button onClick={() => handleSelectProductAndSearchPdvs(product)}>Encontrar</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Produtos em destaque (quando não há busca nem produto selecionado) */}
            {productSearchTerm.trim() === '' && !selectedProduct && (
              <div className="product-highlights">
                <h3>Produtos em destaque</h3>
                <div id="highlight-products-list" className="product-grid">
                  {loadingProducts ? (
                    <p>Carregando produtos...</p>
                  ) : error ? (
                    <p style={{ color: 'red' }}>{error}</p>
                  ) : highlightProducts.length === 0 ? (
                    <p>Nenhum produto em destaque encontrado.</p>
                  ) : (
                    highlightProducts.map((product) => (
                      <div key={product.id} className="product-card">
                        {product.em_destaque && <span className="highlight-tag">NOVO</span>}
                        <img src={product.imagem_url} alt={product.nome} />
                        <h4>{product.nome}</h4>
                        <p>{product.volume}</p>
                        <button onClick={() => handleSelectProductAndSearchPdvs(product)}>Encontrar</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Coluna da Direita (Mapa e Resultados) */}
        <div className="main-map-area">
          <section className="results-section">
            {/* Mapa sempre renderizado */}
            <div className="map-area" style={{ height: '600px' }}>
              <MapComponent
                center={mapCenter}
                zoom={mapZoom}
                points={pdvResults}
                isBlurred={showLocationModal || !userLocationCoords}
              />
            </div>

            {selectedProduct ? (
              <>
                <h2 className="locals-count">{pdvResults.length} locais mais próximos</h2>
                <a href="#" className="saba-mais-link">
                  SAIBA MAIS &gt;
                </a>

                <div id="pdv-results" className="pdv-list">
                  {loadingPdvs ? (
                    <p>Buscando pontos de venda...</p>
                  ) : error ? (
                    <p style={{ color: 'red' }}>{error}</p>
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
              // Se nenhum produto foi selecionado, mostra a mensagem sobre o mapa
              <div className="message-overlay-above-map">
                <h2>Escolha primeiro um produto para encontrar em lojas próximas</h2>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* MODAL DE LOCALIZAÇÃO */}
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
