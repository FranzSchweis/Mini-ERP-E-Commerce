import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';

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
type ItemRow = { key: number; productReference?: string; productName?: string; quantity?: number };
type SalesOrderItem = { source_line_id: number; product_reference: string; product_name: string; quantity: number };
type SalesOrderLookup = {
  source_order_id: number;
  order_reference: string;
  source_status: string;
  recipient_name: string;
  delivery_address: string;
  items: SalesOrderItem[];
};
type StatusDraft = { shipmentId: number; next: ShipmentStatus };
export type DeliveryView = 'overview' | 'shipments' | 'transit' | 'exceptions' | 'delivered';

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
const PAGE_META: Record<DeliveryView, { title: string; description: string; eyebrow: string }> = {
  overview: { title: 'Your delivery desk', description: 'A clear view of every package moving through your operation.', eyebrow: 'OPERATIONS OVERVIEW' },
  shipments: { title: 'All shipments', description: 'Create, search, and manage every shipment in one place.', eyebrow: 'SHIPMENT REGISTER' },
  transit: { title: 'In transit', description: 'Follow shipments that have been handed to a carrier.', eyebrow: 'ON THE MOVE' },
  exceptions: { title: 'Delivery exceptions', description: 'Review failed deliveries and coordinate the next attempt.', eyebrow: 'NEEDS ATTENTION' },
  delivered: { title: 'Delivered shipments', description: 'Completed deliveries and their fulfillment details.', eyebrow: 'COMPLETED' },
};

type Props = { view: DeliveryView; onNavigate: (view: DeliveryView) => void };

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function apiMessage(body: unknown) {
  if (typeof body === 'string') return body;
  if (body && typeof body === 'object') {
    return Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ');
  }
  return 'The request could not be completed.';
}

export default function DeliveryPage({ view, onNavigate }: Props) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showExceptionTip, setShowExceptionTip] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [salesOrderNumber, setSalesOrderNumber] = useState('');
  const [salesOrderBusy, setSalesOrderBusy] = useState(false);
  const [salesOrderMessage, setSalesOrderMessage] = useState('');
  const [loadedSalesOrder, setLoadedSalesOrder] = useState<SalesOrderLookup | null>(null);
  const [formRevision, setFormRevision] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [itemRows, setItemRows] = useState<ItemRow[]>([{ key: 0 }]);
  const [nextItemKey, setNextItemKey] = useState(1);
  const [statusDraft, setStatusDraft] = useState<StatusDraft | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [editingLogisticsId, setEditingLogisticsId] = useState<number | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadShipments() {
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('shipments/?page_size=100');
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      setShipments(Array.isArray(body) ? body : body.results ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reach the shipment service. Check that Django is running.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadShipments(); }, []);

  const scopeShipments = useMemo(() => {
    switch (view) {
      case 'transit': return shipments.filter((shipment) => shipment.status === 'in_transit');
      case 'exceptions': return shipments.filter((shipment) => shipment.status === 'delivery_failed');
      case 'delivered': return shipments.filter((shipment) => shipment.status === 'delivered');
      default: return shipments;
    }
  }, [shipments, view]);
  const visibleShipments = useMemo(() => scopeShipments.filter((shipment) => {
    const searchable = `${shipment.order_reference} ${shipment.recipient_name} ${shipment.tracking_number} ${shipment.carrier}`.toLowerCase();
    return (!query || searchable.includes(query.toLowerCase())) && (!statusFilter || shipment.status === statusFilter);
  }), [scopeShipments, query, statusFilter]);
  const orderedShipments = useMemo(() => [...visibleShipments].sort((a, b) => b.updated_at.localeCompare(a.updated_at)), [visibleShipments]);

  function addItemRow() {
    setItemRows((rows) => [...rows, { key: nextItemKey }]);
    setNextItemKey((key) => key + 1);
  }
  function removeItemRow(key: number) {
    setItemRows((rows) => rows.length > 1 ? rows.filter((row) => row.key !== key) : rows);
  }

  async function loadSalesOrder() {
    const orderNumber = salesOrderNumber.trim();
    setSalesOrderMessage('');
    if (!orderNumber) {
      setSalesOrderMessage('Enter a Sales order number to look it up.');
      return;
    }
    setSalesOrderBusy(true);
    try {
      const response = await apiFetch(`integrations/sales-orders/${encodeURIComponent(orderNumber)}/`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiMessage(body));
      if (!Array.isArray(body.items)) throw new Error('The Sales system returned an invalid order payload.');

      const firstKey = nextItemKey;
      const rows = (body.items as SalesOrderItem[]).map((item, index) => ({
        key: firstKey + index,
        productReference: item.product_reference,
        productName: item.product_name,
        quantity: item.quantity,
      }));
      setItemRows(rows.length ? rows : [{ key: firstKey }]);
      setNextItemKey(firstKey + Math.max(rows.length, 1));
      setLoadedSalesOrder(body as SalesOrderLookup);
      setFormRevision((revision) => revision + 1);
      setSalesOrderMessage(`Loaded ${body.order_reference} (${body.source_status}). Review the details before creating the shipment.`);
    } catch (reason) {
      setSalesOrderMessage(reason instanceof Error ? reason.message : 'Could not load that Sales order.');
    } finally {
      setSalesOrderBusy(false);
    }
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
      const response = await apiFetch('shipments/', { method: 'POST', body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      form.reset();
      setItemRows([{ key: nextItemKey }]);
      setNextItemKey((key) => key + 1);
      setLoadedSalesOrder(null);
      setSalesOrderNumber('');
      setSalesOrderMessage('');
      setFormRevision((revision) => revision + 1);
      setShowForm(false);
      setNotice(`Shipment ${body.order_reference} created with ${body.items.length} item line(s).`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not create the shipment.');
    }
  }

  function openStatusForm(shipment: Shipment, next: ShipmentStatus) {
    setExpanded(shipment.id);
    setEditingLogisticsId(null);
    setStatusDraft({ shipmentId: shipment.id, next });
    setStatusNote('');
    setNotice('');
  }

  async function changeStatus(shipment: Shipment, next: ShipmentStatus, note: string) {
    setNotice('');
    try {
      const response = await apiFetch(`shipments/${shipment.id}/status/`, {
        method: 'POST', body: JSON.stringify({ status: next, note: note.trim() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      setStatusDraft(null);
      setStatusNote('');
      setNotice(`${shipment.order_reference} moved to ${STATUS_LABELS[next]}.`);
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
      const response = await apiFetch(`shipments/${shipment.id}/logistics/`, { method: 'PATCH', body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(apiMessage(body));
      setEditingLogisticsId(null);
      setNotice(`Carrier details for ${shipment.order_reference} saved.`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not save carrier details.');
    }
  }

  async function deleteDeliveredShipment(shipment: Shipment) {
    const confirmed = window.confirm(`Delete delivered shipment ${shipment.order_reference}? Its item lines and status history will also be permanently deleted.`);
    if (!confirmed) return;
    setNotice('');
    try {
      const response = await apiFetch(`shipments/${shipment.id}/`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(apiMessage(body));
      }
      setExpanded(null);
      setEditingLogisticsId(null);
      setStatusDraft(null);
      setNotice(`Delivered shipment ${shipment.order_reference} deleted.`);
      await loadShipments();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Could not delete the shipment.');
    }
  }

  const activeCount = shipments.filter((shipment) => !['delivered', 'cancelled'].includes(shipment.status)).length;
  const transitCount = shipments.filter((shipment) => shipment.status === 'in_transit').length;
  const deliveredCount = shipments.filter((shipment) => shipment.status === 'delivered').length;
  const failedCount = shipments.filter((shipment) => shipment.status === 'delivery_failed').length;
  useEffect(() => {
    if (view !== 'exceptions' || failedCount === 0) {
      setShowExceptionTip(false);
      return;
    }
    setShowExceptionTip(true);
    const timeout = window.setTimeout(() => setShowExceptionTip(false), 5000);
    return () => window.clearTimeout(timeout);
  }, [view, failedCount]);
  const attentionShipments = shipments.filter((shipment) => shipment.status === 'delivery_failed').slice(0, 4);
  const recentShipments = [...shipments].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);
  const meta = PAGE_META[view];
  const statusOptions = Object.entries(STATUS_LABELS) as [ShipmentStatus, string][];

  return <div className="workspace-content">
    <div className="page-intro"><div><span className="eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p></div><div className="page-intro-actions"><button className="button-secondary" type="button" onClick={() => void loadShipments()}>↻ <span>Refresh</span></button>{(view === 'overview' || view === 'shipments') && <button className="button-primary" type="button" onClick={() => { setShowForm((current) => !current); setNotice(''); }}><span>＋</span> Create shipment</button>}</div></div>

    {error && <div className="alert-banner" role="alert"><span className="alert-mark">!</span><div><strong>Couldn’t load shipments</strong><p>{error}</p></div></div>}
    {notice && <div className="notice-banner" role="status"><span>✓</span>{notice}<i className="notice-timer" key={notice}/></div>}

    <section className="metric-grid" aria-label="Shipment summary">
      <article className="metric-card"><div className="metric-card-top"><span>Active shipments</span><span className="metric-icon metric-purple">▤</span></div><strong>{busy ? '—' : activeCount}</strong><small>In the fulfillment pipeline</small></article>
      <article className="metric-card"><div className="metric-card-top"><span>In transit</span><span className="metric-icon metric-blue">↗</span></div><strong>{busy ? '—' : transitCount}</strong><small>With a delivery carrier</small></article>
      <article className="metric-card"><div className="metric-card-top"><span>Delivered</span><span className="metric-icon metric-green">✓</span></div><strong>{busy ? '—' : deliveredCount}</strong><small>Successfully completed</small></article>
      <article className={`metric-card ${failedCount ? 'metric-attention' : ''}`}><div className="metric-card-top"><span>Needs attention</span><span className="metric-icon metric-amber">!</span></div><strong>{busy ? '—' : failedCount}</strong><small>Delivery exceptions to review</small></article>
    </section>

    {view === 'overview' && <div className="overview-grid">
      <section className="surface overview-panel"><div className="section-heading"><div><span className="eyebrow">RECENT ACTIVITY</span><h2>Recently updated</h2><p>Your latest shipment changes.</p></div><span className="section-counter">{shipments.length} total</span></div>
        {busy ? <div className="empty-state">Loading your shipment activity…</div> : recentShipments.length ? <ShipmentTable shipments={recentShipments} expanded={expanded} setExpanded={setExpanded} setEditingLogisticsId={setEditingLogisticsId} editingLogisticsId={editingLogisticsId} statusDraft={statusDraft} statusNote={statusNote} setStatusNote={setStatusNote} setStatusDraft={setStatusDraft} updateLogistics={updateLogistics} changeStatus={changeStatus} openStatusForm={openStatusForm} allowDelete={false} deleteShipment={deleteDeliveredShipment}/> : <EmptyShipments error={error}/>}
      </section>
      <aside className="surface attention-panel"><div className="section-heading"><div><span className="eyebrow">ACTION QUEUE</span><h2>Delivery exceptions</h2><p>Failed attempts that may need follow-up.</p></div><span className={`queue-badge ${failedCount ? 'queue-badge-active' : ''}`}>{failedCount}</span></div>
        {attentionShipments.length ? <div className="attention-list">{attentionShipments.map((shipment) => <button className="attention-item" key={shipment.id} type="button" onClick={() => onNavigate('exceptions')}><span className="attention-item-mark">!</span><span><strong>{shipment.order_reference}</strong><small>{shipment.recipient_name}</small></span><span className="attention-arrow">→</span></button>)}</div> : <div className="queue-clear"><span>✓</span><strong>All clear</strong><p>There are no failed delivery attempts to review.</p></div>}
      </aside>
    </div>}

    {view === 'exceptions' && failedCount > 0 && showExceptionTip && <div className="info-banner" role="status"><span>i</span>Check the event history for the recorded failure reason before scheduling a redelivery.<i className="notice-timer" key={`exception-${failedCount}`}/></div>}

    {showForm && (view === 'overview' || view === 'shipments') && <section className="surface form-surface">
      <div className="section-heading"><div><span className="eyebrow">NEW FULFILLMENT RECORD</span><h2>Create a shipment</h2><p>Load an order from Sales or enter fulfillment details manually.</p></div><button className="icon-close" type="button" aria-label="Close form" onClick={() => setShowForm(false)}>×</button></div>
      <div className="integration-lookup"><div className="integration-lookup-copy"><strong>Look up a Sales order</strong><small>Reads shared Sales data; shipment creation still requires your review and confirmation.</small></div><div className="integration-lookup-controls"><input aria-label="Sales order number" value={salesOrderNumber} onChange={(event) => setSalesOrderNumber(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void loadSalesOrder(); } }} placeholder="e.g. SO-1001"/><button className="button-secondary button-small" type="button" onClick={() => void loadSalesOrder()} disabled={salesOrderBusy}>{salesOrderBusy ? 'Loading…' : 'Load order'}</button></div>{salesOrderMessage && <p className="integration-lookup-message" role="status">{salesOrderMessage}</p>}</div>
      <form key={formRevision} className="shipment-form" onSubmit={createShipment}>
        <label>Order reference<input name="order_reference" required maxLength={64} defaultValue={loadedSalesOrder?.order_reference ?? ''} placeholder="ORD-1001"/></label>
        <label>Recipient name<input name="recipient_name" required maxLength={180} defaultValue={loadedSalesOrder?.recipient_name ?? ''} placeholder="Recipient name"/></label>
        <label className="field-span-2">Delivery address<textarea name="delivery_address" required rows={2} defaultValue={loadedSalesOrder?.delivery_address ?? ''} placeholder="Delivery address snapshot"/></label>
        <label>Carrier<input name="carrier" maxLength={120} placeholder="Assign later if unknown"/></label>
        <label>Tracking number<input name="tracking_number" maxLength={120} placeholder="Optional before dispatch"/></label>
        <div className="item-lines field-span-2"><div className="item-lines-heading"><div><strong>Shipment items</strong><span>Enter each item and its quantity.</span></div><button className="button-secondary button-small" type="button" onClick={addItemRow}>＋ Add item</button></div>
          {itemRows.map((row, index) => <div className="item-line" key={row.key}><label>Product reference<input name="product_reference" maxLength={64} defaultValue={row.productReference ?? ''} placeholder="Optional SKU"/></label><label>Item description<input name="product_name" required maxLength={180} defaultValue={row.productName ?? ''} placeholder={`Item ${index + 1}`}/></label><label>Qty<input name="quantity" type="number" min="1" step="1" defaultValue={row.quantity ?? 1} required/></label><button className="remove-item" type="button" disabled={itemRows.length === 1} title="Remove item" aria-label={`Remove item ${index + 1}`} onClick={() => removeItemRow(row.key)}>×</button></div>)}
        </div>
        <div className="form-actions field-span-2"><span role="status">{notice}</span><button className="button-primary" type="submit">Create shipment <span>→</span></button></div>
      </form>
    </section>}

    {view !== 'overview' && <section className="surface shipment-register"><div className="section-heading"><div><span className="eyebrow">{meta.eyebrow}</span><h2>{view === 'shipments' ? 'Shipment register' : meta.title}</h2><p>{view === 'shipments' ? 'Search order references, recipients, couriers, and tracking IDs.' : `${scopeShipments.length} shipment${scopeShipments.length === 1 ? '' : 's'} in this view.`}</p></div><span className="section-counter">{scopeShipments.length} records</span></div>
      <div className="list-toolbar"><label className="search-field"><span>⌕</span><input aria-label="Search shipments" placeholder="Search shipments…" value={query} onChange={(event) => setQuery(event.target.value)}/></label><select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {busy ? <div className="empty-state">Loading shipments…</div> : orderedShipments.length ? <ShipmentTable shipments={orderedShipments} expanded={expanded} setExpanded={setExpanded} setEditingLogisticsId={setEditingLogisticsId} editingLogisticsId={editingLogisticsId} statusDraft={statusDraft} statusNote={statusNote} setStatusNote={setStatusNote} setStatusDraft={setStatusDraft} updateLogistics={updateLogistics} changeStatus={changeStatus} openStatusForm={openStatusForm} allowDelete={view === 'delivered'} deleteShipment={deleteDeliveredShipment}/> : <EmptyShipments error={error}/>}
    </section>}
    <footer className="workspace-footer"><span>Del &amp; Ship <i>·</i> Fulfillment operations</span><span>Order records remain owned by the Sales system</span></footer>
  </div>;
}

type TableProps = {
  shipments: Shipment[];
  expanded: number | null;
  setExpanded: (id: number | null) => void;
  editingLogisticsId: number | null;
  setEditingLogisticsId: (id: number | null) => void;
  statusDraft: StatusDraft | null;
  statusNote: string;
  setStatusNote: (note: string) => void;
  setStatusDraft: (draft: StatusDraft | null) => void;
  updateLogistics: (event: FormEvent<HTMLFormElement>, shipment: Shipment) => void;
  changeStatus: (shipment: Shipment, next: ShipmentStatus, note: string) => void;
  openStatusForm: (shipment: Shipment, next: ShipmentStatus) => void;
  allowDelete: boolean;
  deleteShipment: (shipment: Shipment) => void;
};

function ShipmentTable(props: TableProps) {
  const { shipments, expanded, setExpanded, editingLogisticsId, setEditingLogisticsId, statusDraft, statusNote, setStatusNote, setStatusDraft, updateLogistics, changeStatus, openStatusForm, allowDelete, deleteShipment } = props;
  return <div className="shipment-list"><div className="shipment-list-head"><span>SHIPMENT</span><span>RECIPIENT</span><span>COURIER &amp; TRACKING</span><span>CONTENTS</span><span>STATUS</span><span>UPDATED</span><span/></div>
    {shipments.map((shipment) => <Fragment key={shipment.id}><div className="shipment-row">
      <div className="shipment-id-cell"><span className="shipment-package">▣</span><span><strong>{shipment.order_reference}</strong><small>SHIP-{String(shipment.id).padStart(4, '0')}</small></span></div>
      <div className="shipment-recipient"><strong>{shipment.recipient_name}</strong><small>{shipment.delivery_address}</small></div>
      <div className="shipment-carrier"><strong>{shipment.carrier || 'Not assigned'}</strong><small>{shipment.tracking_number || 'No tracking number'}</small></div>
      <div className="shipment-contents"><strong>{shipment.items.length} line{shipment.items.length === 1 ? '' : 's'}</strong><small>{shipment.items.reduce((sum, item) => sum + item.quantity, 0)} total units</small></div>
      <div><span className={`status-pill status-${shipment.status}`}>{shipment.status_label}</span></div>
      <div className="shipment-updated">{formatDate(shipment.updated_at)}</div>
      <div className="shipment-row-actions"><button className="details-button" type="button" aria-expanded={expanded === shipment.id} onClick={() => setExpanded(expanded === shipment.id ? null : shipment.id)}>{expanded === shipment.id ? 'Close' : 'Details'} <span>{expanded === shipment.id ? '−' : '+'}</span></button>{allowDelete && <button className="delete-button" type="button" aria-label={`Delete delivered shipment ${shipment.order_reference}`} onClick={() => deleteShipment(shipment)}>Delete</button>}</div>
    </div>
    {expanded === shipment.id && <div className="shipment-detail"><div className="detail-columns"><section><span className="eyebrow">DELIVERY DETAILS</span><h3>{shipment.recipient_name}</h3><p>{shipment.delivery_address}</p><div className="detail-items"><strong>Package contents</strong>{shipment.items.map((item) => <div key={item.id}><span>{item.product_name}<small>{item.product_reference || 'No item reference'}</small></span><b>× {item.quantity}</b></div>)}</div></section><section><span className="eyebrow">STATUS HISTORY</span><h3>Shipment activity</h3><ol className="event-list">{shipment.events.map((entry) => <li key={entry.id}><span className="event-dot"/><div><strong>{entry.status_label}</strong><small>{formatDate(entry.occurred_at)}{entry.note ? ` · ${entry.note}` : ''}</small></div></li>)}</ol></section></div>
      <div className="detail-toolbar"><div><span className="eyebrow">QUICK ACTIONS</span><div className="status-actions">{NEXT_STATUS[shipment.status].map((next) => <button className="button-secondary button-small" key={next} type="button" onClick={() => openStatusForm(shipment, next)}>{STATUS_LABELS[next]}</button>)}<button className="button-secondary button-small" type="button" onClick={() => { setStatusDraft(null); setEditingLogisticsId(editingLogisticsId === shipment.id ? null : shipment.id); }}>Edit carrier details</button></div></div><small>Created {formatDate(shipment.created_at)}</small></div>
      {editingLogisticsId === shipment.id && <form className="inline-editor" onSubmit={(event) => { event.preventDefault(); updateLogistics(event, shipment); }}><div className="editor-fields"><label>Carrier<input name="carrier" maxLength={120} defaultValue={shipment.carrier} placeholder="Carrier name"/></label><label>Tracking number<input name="tracking_number" maxLength={120} defaultValue={shipment.tracking_number} placeholder="Tracking ID"/></label></div><div className="editor-actions"><button className="button-secondary button-small" type="button" onClick={() => setEditingLogisticsId(null)}>Cancel</button><button className="button-primary button-small" type="submit">Save details</button></div></form>}
      {statusDraft?.shipmentId === shipment.id && <form className="inline-editor status-editor" onSubmit={(event) => { event.preventDefault(); changeStatus(shipment, statusDraft.next, statusNote); }}><div><strong>Move to {STATUS_LABELS[statusDraft.next]}</strong><p>{statusDraft.next === 'delivery_failed' ? 'A reason is required and will be added to the event history.' : 'Add an optional note to the event history.'}</p></div><label>Status note<textarea value={statusNote} onChange={(event) => setStatusNote(event.target.value)} maxLength={240} required={statusDraft.next === 'delivery_failed'} rows={2} placeholder={statusDraft.next === 'delivery_failed' ? 'e.g. Recipient unavailable' : 'Optional note'}/></label><div className="editor-actions"><button className="button-secondary button-small" type="button" onClick={() => { setStatusDraft(null); setStatusNote(''); }}>Cancel</button><button className="button-primary button-small" type="submit">Save status</button></div></form>}
    </div>}</Fragment>)}
  </div>;
}

function EmptyShipments({ error }: { error: string }) {
  return <div className="empty-state"><span>▤</span><strong>{error ? 'Shipment service unavailable' : 'Nothing here yet'}</strong><p>{error ? 'Check the backend and your connection, then refresh.' : 'When a shipment matches this view, it will appear here.'}</p></div>;
}
