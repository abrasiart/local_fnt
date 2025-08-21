import React from 'react';
import { Product } from './interfaces';

interface ProductListProps {
    products: Product[];
    onFindProduct: (productId: string) => void;
}

const ProductList: React.FC<ProductListProps> = ({ products, onFindProduct }) => {
    return (
        <div className="product-list-wrapper">
            {products.map(product => (
                <div key={product.id} className="product-item">
                    <img src={product.imagem_url} alt={product.nome} className="product-image" />
                    <div className="product-details">
                        <h4>{product.nome}</h4>
                        <p>{product.volume}</p>
                    </div>
                    <button className="find-button" onClick={() => onFindProduct(product.id)}>
                        Encontrar
                    </button>
                </div>
            ))}
        </div>
    );
};

export default ProductList;