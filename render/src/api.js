const API_BASE = 'http://localhost:3001';

export const getProducts = async () => {
  const response = await fetch(`${API_BASE}/api/products`);
  return response.json();
};

export const createProduct = async (product) => {
  const response = await fetch(`${API_BASE}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(product),
  });
  return response.json();
};

export const createSale = async (sale) => {
  const response = await fetch(`${API_BASE}/api/sales`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sale),
  });
  return response.json();
};