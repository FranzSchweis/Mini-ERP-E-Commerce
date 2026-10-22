import { FormEvent, useEffect, useMemo, useState } from 'react';

type Product = {
  id: number;
  sku: string;
  name: string;
  category: number;
  category_name: string;
  description: string;
  unit_price: string;
  status: 'active' | 'draft' | 'archived';
};
type Category = { id: number; name: string };
const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryNotice, setCategoryNotice] = useState('');

  async function load() {
    setBusy(true);
    setError('');
    try {
      const [productsResponse, categoriesResponse] = await Promise.all([
        fetch(`${API}/products/?page_size=100`),
        fetch(`${API}/categories/`),
      ]);
      if (!productsResponse.ok || !categoriesResponse.ok) throw new Error('API request failed');
      const productsData = await productsResponse.json();
      const categoriesData = await categoriesResponse.json();
      setProducts(Array.isArray(productsData) ? productsData : productsData.results ?? []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData.results ?? []);
    } catch {
      setError('Could not reach Django. Start the backend at http://127.0.0.1:8000, then refresh.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const visibleProducts = useMemo(() => products.filter((product) => {
    const text = `${product.sku} ${product.name} ${product.category_name}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || product.status === filter);
  }), [products, query, filter]);

  function editProduct(product: Product) {
    setEditingProduct(product);
    setNotice('');
    document.getElementById('new-product')?.scrollIntoView({ behavior: 'smooth' });
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      sku: String(formData.get('sku') ?? ''),
      name: String(formData.get('name') ?? ''),
      category: Number(formData.get('category')),
      unit_price: Number(formData.get('unit_price')),
      description: String(formData.get('description') ?? ''),
      status: String(formData.get('status') ?? 'active'),
    };
    try {
      const url = editingProduct ? `${API}/products/${editingProduct.id}/` : `${API}/products/`;
      const response = await fetch(url, { method: editingProduct ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) {
        const message = Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
        throw new Error(message || 'Could not save product.');
      }
      form.reset();
      setNotice(editingProduct ? 'Product updated.' : 'Product created.');
      setEditingProduct(null);
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not save product.');
    }
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryNotice('');
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch(`${API}/categories/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: String(formData.get('name') ?? '').trim() }) });
      const body = await response.json();
      if (!response.ok) {
        const message = Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ');
        throw new Error(message || 'Could not create category.');
      }
      form.reset();
      setCategoryNotice(`Category “${body.name}” added.`);
      await load();
    } catch (reason) {
      setCategoryNotice(reason instanceof Error ? reason.message : 'Could not create category.');
    }
  }

  const activeCount = products.filter((product) => product.status === 'active').length;
  const draftCount = products.filter((product) => product.status === 'draft').length;

  return <section className="content">
    <div className="page-heading"><div><div className="eyebrow">SYSTEM 1 · CATALOGUE OWNER</div><h1>Product & Catalogue</h1><p>Create and maintain the shared product details used by the other ERP systems.</p></div><div className="heading-actions"><button className="secondary" onClick={() => { setShowCategoryForm((open) => !open); setCategoryNotice(''); }}>＋ Add category</button><button className="primary" onClick={() => document.getElementById('new-product')?.scrollIntoView({ behavior: 'smooth' })}>＋ Add product</button></div></div>
    {error && <div className="alert"><strong>API not connected yet</strong><span>{error}</span></div>}
    {showCategoryForm && <section className="panel category-panel"><div className="panel-head"><div><h2>Add a category</h2><p>New categories become available in the product form.</p></div><button className="icon-button" type="button" aria-label="Close category form" onClick={() => setShowCategoryForm(false)}>×</button></div><form className="category-form" onSubmit={addCategory}><label>Category name<input required name="name" maxLength={100} placeholder="e.g. Campus Supplies" /></label><div className="category-actions"><span role="status">{categoryNotice}</span><button className="primary" type="submit">Save category</button></div></form></section>}
    <div className="stats">
      <article><span>Products</span><strong>{products.length}</strong><small>Catalogue records</small></article>
      <article><span>Active</span><strong>{activeCount}</strong><small>Currently available in catalogue</small></article>
      <article><span>Draft</span><strong>{draftCount}</strong><small>Not yet active</small></article>
      <article><span>Categories</span><strong>{categories.length}</strong><small>Organize your catalogue</small></article>
    </div>
    <section className="panel">
      <div className="panel-head"><div><h2>Products</h2><p>Search by product name, SKU, or category.</p></div><button className="secondary" onClick={() => void load()}>Refresh</button></div>
      <div className="toolbar"><input aria-label="Search products" placeholder="⌕  Search products or SKU…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter by status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>PRODUCT</th><th>SKU (SHARED ID)</th><th>CATEGORY</th><th>UNIT PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>
        {busy ? <tr><td colSpan={6} className="empty">Loading products…</td></tr> : visibleProducts.length ? visibleProducts.map((product) => <tr key={product.id}><td><div className="product-cell"><span className="product-icon">□</span><div><strong>{product.name}</strong><small>{product.description || 'No description'}</small></div></div></td><td>{product.sku}</td><td>{product.category_name}</td><td>PHP {Number(product.unit_price).toFixed(2)}</td><td><span className={`badge ${product.status}`}>{product.status}</span></td><td><button className="action-button" onClick={() => editProduct(product)}>Edit</button></td></tr>) : <tr><td colSpan={6} className="empty">{error ? 'Start Django and migrate the database, then refresh.' : 'No products yet. Add your first catalogue item below.'}</td></tr>}
      </tbody></table></div>
      <div className="table-foot">Showing {visibleProducts.length} of {products.length} products <span>Product ID and SKU are shared with other systems</span></div>
    </section>
    <section className="panel form-panel" id="new-product">
      <div className="panel-head"><div><h2>{editingProduct ? `Edit ${editingProduct.name}` : 'Add a product'}</h2><p>Only catalogue details are managed here. Stock and orders belong to teammates’ systems.</p></div></div>
      <form key={editingProduct?.id ?? 'new-product'} onSubmit={saveProduct} className="product-form">
        <label>SKU<input required name="sku" placeholder="e.g. PRD-001" defaultValue={editingProduct?.sku ?? ''} /></label>
        <label>Product name<input required name="name" placeholder="e.g. Wireless headphones" defaultValue={editingProduct?.name ?? ''} /></label>
        <label>Category<select required name="category" defaultValue={editingProduct?.category ?? ''}><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Unit price (PHP)<input required name="unit_price" type="number" min="0" step="0.01" defaultValue={editingProduct?.unit_price ?? '0'} /></label>
        <label>Status<select name="status" defaultValue={editingProduct?.status ?? 'active'}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
        <label className="wide">Description<textarea name="description" rows={2} placeholder="Optional details that help identify this product" defaultValue={editingProduct?.description ?? ''} /></label>
        <div className="form-submit"><span role="status">{notice}</span>{editingProduct && <button className="secondary" type="button" onClick={() => { setEditingProduct(null); setNotice(''); }}>Cancel</button>}<button className="primary" type="submit" disabled={!categories.length}>{editingProduct ? 'Save changes' : 'Create product'}</button></div>
      </form>
    </section>
    <footer>Mini ERP · System 1: Product & Catalogue <span>API: {API}</span></footer>
  </section>;
}
