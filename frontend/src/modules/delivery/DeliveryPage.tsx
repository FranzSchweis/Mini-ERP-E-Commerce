import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import './delivery.css';

type ShipmentStatus = 'ready_to_pack' | 'packing' | 'ready_to_dispatch' | 'in_transit' | 'delivered' | 'delivery_failed' | 'cancelled';
type ShipmentItem = { id: number; product_reference: string; product_name: string; quantity: number };
type ShipmentEvent = { id: number; status: ShipmentStatus; status_label: string; note: string; occurred_at: string };
type Shipment = {
  id: number;
  order_reference: string;
  recipient_name: string;
  delivery_address: string;
  carrier: string;
  tracking_number: string;
  status: ShipmentStatus;
  status_label: string;
  items: ShipmentItem[];
  events: ShipmentEvent[];
  created_at: string;
  updated_at: string;
};
type ItemRow = { key: number };
type StatusDraft = { shipmentId: number; next: ShipmentStatus };

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const STATUS_LABELS: Record<ShipmentStatus, string> = {
  ready_to_pack: 'Ready to pack', packing: 'Packing', ready_to_dispatch: 'Ready to dispatch',
  in_transit: 'In transit', delivered: 'Delivered', delivery_failed: 'Delivery failed', cancelled: 'Cancelled',
};
const NEXT_STATUS: Record<ShipmentStatus, ShipmentStatus[]> = {
  ready_to_pack: ['packing', 'cancelled'],
  packing: ['ready_to_dispatch', 'cancelled'],
  ready_to_dispatch: ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'delivery_failed'],
  delivery_failed: ['in_transit', 'cancelled'],
  delivered: [], cancelled: [],
};

function displayDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function apiMessage(body: unknown) {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    return Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ');
  }
  return 'The request could not be completed.';
}

export default function DeliveryPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ key: 0 }]);
  const [nextItemKey, setNextItemKey] = useState(1);
  const [statusDraft, setStatusDraft] = useState<StatusDraft | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [editingLogisticsId, setEditingLogisticsId] = useState<number | null>(null);

  async function loadShipments() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API}/shipments/?page_size=100`);
      if (!response.ok) throw new Error(`Shipment API returned ${response.status}.`);
      const body = await response.json();
      setShipments(Array.isArray(body) ? body : body.results ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reach Django. Start the backend, then refresh.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadShipments(); }, []);

  const visibleShipments = useMemo(() => shipments.filter((shipment) => {
    const text = `${shipment.order_reference} ${shipment.recipient_name} ${shipment.tracking_number} ${shipment.carrier}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || shipment.status === filter);
  }), [shipments, query, filter]);

  function addItemRow() {
    setItemRows((rows) => [...rows, { key: nextItemKey }]);
    setNextItemKey((key) => key + 1);
  }

  function removeItemRow(key: number) {
    setItemRows((rows) => rows.length > 1 ? rows.filter((row) => row.key !== key) : rows);
  }

  async function createShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const names = values.getAll('product_name');
    const references = values.getAll('product_reference');
    const quantities = values.getAll('quantity');
    const payload = {
      order_reference: String(values.get('order_reference') ?? '').trim(),
      recipient_name: String(values.get('recipient_name') ?? '').trim(),
      delivery_address: String(values.get('delivery_address') ?? '').trim(),
      carrier: String(values.get('carrier') ?? '').trim(),
      tracking_number: String(values.get('tracking_number') ?? '').trim(),
      items: names.map((name, index) => ({
        product_reference: String(references[index] ?? '').trim(),
        product_name: String(name).trim(),
        quantity: Number(quantities[index] ?? 1),
      })),
    };
    try {
      const response = await fetch(`${API}/shipments/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      form.reset();
      setItemRows([{ key: nextItemKey }]);
      setNextItemKey((key) => key + 1);
      setShowForm(false);
      setNotice(`Shipment for ${body.order_reference} created with ${body.items.length} item line(s).`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not create shipment.');
    }
  }

  function openStatusForm(shipment: Shipment, next: ShipmentStatus) {
    setExpanded(shipment.id);
    setStatusDraft({ shipmentId: shipment.id, next });
    setStatusNote('');
    setNotice('');
  }

  async function changeStatus(shipment: Shipment, next: ShipmentStatus, note: string) {
    setNotice('');
    try {
      const response = await fetch(`${API}/shipments/${shipment.id}/status/`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next, note: note.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      setStatusDraft(null);
      setStatusNote('');
      setNotice(`${shipment.order_reference} updated to ${STATUS_LABELS[next]}.`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not update shipment status.');
    }
  }

  async function updateLogistics(event: FormEvent<HTMLFormElement>, shipment: Shipment) {
    event.preventDefault();
    setNotice('');
    const values = new FormData(event.currentTarget);
    const payload = {
      carrier: String(values.get('carrier') ?? '').trim(),
      tracking_number: String(values.get('tracking_number') ?? '').trim(),
    };
    try {
      const response = await fetch(`${API}/shipments/${shipment.id}/logistics/`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      setEditingLogisticsId(null);
      setNotice(`Courier details for ${shipment.order_reference} saved.`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not save courier details.');
    }
  }

  const activeCount = shipments.filter((shipment) => !['delivered', 'cancelled'].includes(shipment.status)).length;
  const inTransitCount = shipments.filter((shipment) => shipment.status === 'in_transit').length;
  const deliveredCount = shipments.filter((shipment) => shipment.status === 'delivered').length;
  const failedCount = shipments.filter((shipment) => shipment.status === 'delivery_failed').length;

  return <section className="content delivery-page">
    <div className="page-heading">
      <div><div className="eyebrow">SYSTEM 5 · FULFILLMENT OWNER</div><h1>Delivery &amp; Shipments</h1><p>Prepare packages, record dispatch, and follow delivery outcomes.</p></div>
      <div className="heading-actions"><button className="secondary" type="button" onClick={() => void loadShipments()}>Refresh</button><button className="primary" type="button" onClick={() => { setShowForm((open) => !open); setNotice(''); }}>＋ Create shipment</button></div>
    </div>

    {error && <div className="alert"><strong>Shipment API unavailable</strong><span>{error} The module can be reviewed once the Django backend and migrations are running.</span></div>}
    {notice && <div className="delivery-notice" role="status">{notice}</div>}

    <div className="stats delivery-stats">
      <article><span>Active shipments</span><strong>{activeCount}</strong><small>Not yet delivered or cancelled</small></article>
      <article><span>In transit</span><strong>{inTransitCount}</strong><small>Handed to a carrier</small></article>
      <article><span>Delivered</span><strong>{deliveredCount}</strong><small>Delivery confirmed</small></article>
      <article><span>Needs attention</span><strong>{failedCount}</strong><small>Delivery exceptions</small></article>
    </div>

    {showForm && <section className="panel delivery-form-panel">
      <div className="panel-head"><div><h2>Create a shipment</h2><p>Enter an order reference supplied by the Sales team. One shipment per order is supported in this demo.</p></div><button className="icon-button" type="button" aria-label="Close shipment form" onClick={() => setShowForm(false)}>×</button></div>
      <form className="delivery-form" onSubmit={createShipment}>
        <label>Order reference<input name="order_reference" required maxLength={64} placeholder="e.g. ORD-1001" /></label>
        <label>Recipient name<input name="recipient_name" required maxLength={180} placeholder="Recipient" /></label>
        <label className="delivery-wide">Delivery address<textarea name="delivery_address" required rows={2} placeholder="Address snapshot for this shipment" /></label>
        <label>Carrier<input name="carrier" maxLength={120} placeholder="e.g. Campus Courier" /></label>
        <label>Tracking number<input name="tracking_number" maxLength={120} placeholder="Optional before dispatch" /></label>
        <div className="delivery-items">
          <div className="delivery-items-head"><div><strong>Shipment items</strong><span>Add each product and quantity included in this package.</span></div><button className="secondary" type="button" onClick={addItemRow}>＋ Add item</button></div>
          {itemRows.map((row, index) => <div className="delivery-item-row" key={row.key}>
            <label>Product reference<input name="product_reference" maxLength={64} placeholder="Optional SKU or ID" /></label>
            <label>Item description<input name="product_name" required maxLength={180} placeholder={`Item ${index + 1}`} /></label>
            <label>Quantity<input name="quantity" type="number" min="1" step="1" defaultValue="1" required /></label>
            <button className="action-button delivery-remove" type="button" aria-label={`Remove item ${index + 1}`} title="Remove item" disabled={itemRows.length === 1} onClick={() => removeItemRow(row.key)}>×</button>
          </div>)}
        </div>
        <div className="delivery-form-submit"><span role="status">{notice}</span><button className="primary" type="submit">Create shipment</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><h2>Shipment register</h2><p>Search by order, recipient, courier, or tracking number.</p></div></div>
      <div className="toolbar delivery-toolbar"><input aria-label="Search shipments" placeholder="⌕  Search shipments…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter shipments by status" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <div className="table-wrap"><table className="delivery-table"><thead><tr><th>ORDER / SHIPMENT</th><th>RECIPIENT</th><th>COURIER / TRACKING</th><th>ITEMS</th><th>STATUS</th><th>LAST UPDATED</th><th>ACTIONS</th></tr></thead><tbody>
        {busy ? <tr><td colSpan={7} className="empty">Loading shipments…</td></tr> : visibleShipments.length ? visibleShipments.map((shipment) => <Fragment key={shipment.id}>
          <tr>
            <td><div className="delivery-order"><strong>{shipment.order_reference}</strong><small>SHIP-{String(shipment.id).padStart(4, '0')}</small></div></td>
            <td>{shipment.recipient_name}</td>
            <td><div className="delivery-order"><strong>{shipment.carrier || 'Carrier not assigned'}</strong><small>{shipment.tracking_number || 'No tracking number yet'}</small></div></td>
            <td>{shipment.items.length} line(s) · {shipment.items.reduce((sum, item) => sum + item.quantity, 0)} unit(s)</td>
            <td><span className={`badge delivery-status ${shipment.status}`}>{shipment.status_label}</span></td>
            <td>{displayDate(shipment.updated_at)}</td>
            <td><div className="delivery-actions"><button className="action-button" type="button" onClick={() => setExpanded(expanded === shipment.id ? null : shipment.id)}>{expanded === shipment.id ? 'Hide' : 'Details'}</button><button className="action-button delivery-next" type="button" onClick={() => { setExpanded(shipment.id); setEditingLogisticsId(editingLogisticsId === shipment.id ? null : shipment.id); }}>Edit logistics</button>{NEXT_STATUS[shipment.status].map((next) => <button key={next} className="action-button delivery-next" type="button" onClick={() => openStatusForm(shipment, next)}>{STATUS_LABELS[next]}</button>)}</div></td>
          </tr>
          {expanded === shipment.id && <tr><td colSpan={7} className="delivery-expanded"><div className="delivery-detail-grid">
            <div><h3>Delivery details</h3><p><strong>Address:</strong> {shipment.delivery_address}</p><p><strong>Shipment created:</strong> {displayDate(shipment.created_at)}</p><ul>{shipment.items.map((item) => <li key={item.id}>{item.product_name} · {item.product_reference || 'No product ID'} · Qty {item.quantity}</li>)}</ul></div>
            <div><h3>Status history</h3>{shipment.events.length ? <ol>{shipment.events.map((entry) => <li key={entry.id}><strong>{entry.status_label}</strong><span>{displayDate(entry.occurred_at)}{entry.note ? ` · ${entry.note}` : ''}</span></li>)}</ol> : <p>No status events yet.</p>}</div>
          </div>
          {editingLogisticsId === shipment.id && <form className="status-note-form logistics-form" onSubmit={(event) => void updateLogistics(event, shipment)}>
            <div><h3>Edit carrier details</h3><p>Update the courier or tracking number without changing the order or shipment status.</p></div>
            <div className="logistics-fields"><label>Carrier<input name="carrier" maxLength={120} defaultValue={shipment.carrier} placeholder="e.g. Campus Courier" /></label><label>Tracking number<input name="tracking_number" maxLength={120} defaultValue={shipment.tracking_number} placeholder="e.g. TRK-1001" /></label></div>
            <div className="status-note-actions"><button className="secondary" type="button" onClick={() => setEditingLogisticsId(null)}>Cancel</button><button className="primary" type="submit">Save courier details</button></div>
          </form>}
          {statusDraft?.shipmentId === shipment.id && <form className="status-note-form" onSubmit={(event) => { event.preventDefault(); void changeStatus(shipment, statusDraft.next, statusNote); }}>
            <div><h3>Change status to {STATUS_LABELS[statusDraft.next]}</h3><p>{statusDraft.next === 'delivery_failed' ? 'A reason is required and will be saved in the shipment history.' : 'Add an optional note to the shipment history.'}</p></div>
            <label>Status note<textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} maxLength={240} required={statusDraft.next === 'delivery_failed'} rows={2} placeholder={statusDraft.next === 'delivery_failed' ? 'e.g. Recipient unavailable at delivery address' : 'Optional handling or delivery note'} /></label>
            <div className="status-note-actions"><button className="secondary" type="button" onClick={() => { setStatusDraft(null); setStatusNote(''); }}>Cancel</button><button className="primary" type="submit">Save status update</button></div>
          </form>}
          </td></tr>}
        </Fragment>) : <tr><td colSpan={7} className="empty">{error ? 'Start Django, apply migrations, then refresh.' : 'No shipments yet. Create one to begin the fulfillment workflow.'}</td></tr>}
      </tbody></table></div>
      <div className="table-foot">Showing {visibleShipments.length} of {shipments.length} shipments <span>Order references remain owned by the Sales &amp; Orders system</span></div>
    </section>
    <footer>Mini ERP · System 5: Delivery &amp; Shipments <span>API: {API}/shipments/</span></footer>
  </section>;
}
