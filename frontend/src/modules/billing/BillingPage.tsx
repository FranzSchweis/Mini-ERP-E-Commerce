import { FormEvent, useEffect, useMemo, useState } from 'react';

type Payment = {
  id: number;
  invoice: number;
  invoice_number: string;
  payment_reference: string;
  amount: string;
  payment_date: string;
  method: 'bank_transfer' | 'card' | 'cash' | 'ewallet' | 'other';
  method_label: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  status_label: string;
};
type Invoice = {
  id: number;
  invoice_number: string;
  customer_name: string;
  customer_email: string;
  order_reference: string;
  issue_date: string;
  due_date: string;
  amount: string;
  status: 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  status_label: string;
  notes: string;
  paid_amount: string;
  balance_due: string;
  payment_count: number;
  payments: Payment[];
};
type Summary = { total_invoiced: string; total_collected: string; outstanding: string; overdue_count: number; invoice_count: number };

const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';
const money = (value: string | number) => `PHP ${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

export default function BillingPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_invoiced: '0', total_collected: '0', outstanding: '0', overdue_count: 0, invoice_count: 0 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  async function load() {
    setBusy(true); setError('');
    try {
      const [invoiceResponse, summaryResponse] = await Promise.all([
        fetch(`${API}/invoices/?page_size=100`),
        fetch(`${API}/invoices/summary/`),
      ]);
      if (!invoiceResponse.ok || !summaryResponse.ok) throw new Error('API request failed');
      const invoiceBody = await invoiceResponse.json();
      setInvoices(Array.isArray(invoiceBody) ? invoiceBody : invoiceBody.results ?? []);
      setSummary(await summaryResponse.json());
    } catch {
      setError('Could not reach Django. Start the backend at http://127.0.0.1:8000, then refresh.');
    } finally { setBusy(false); }
  }

  useEffect(() => { void load(); }, []);

  const visibleInvoices = useMemo(() => invoices.filter((invoice) => {
    const text = `${invoice.invoice_number} ${invoice.customer_name} ${invoice.order_reference}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!filter || invoice.status === filter);
  }), [invoices, query, filter]);

  function openPayment(invoice: Invoice) { setSelectedInvoice(invoice); setShowPaymentForm(true); setNotice(''); }
  function openInvoice(invoice: Invoice | null = null) { setSelectedInvoice(invoice); setShowInvoiceForm(true); setNotice(''); }

  async function saveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice('');
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(['invoice_number', 'customer_name', 'customer_email', 'order_reference', 'issue_date', 'due_date', 'amount', 'status', 'notes'].map((key) => [key, String(data.get(key) ?? '')]));
    payload.amount = String(Number(payload.amount));
    try {
      const response = await fetch(`${API}/invoices/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '));
      setShowInvoiceForm(false); setNotice(`Invoice ${body.invoice_number} created.`); await load();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Could not create invoice.'); }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedInvoice) return; setNotice('');
    const data = new FormData(event.currentTarget);
    const payload = { payment_reference: String(data.get('payment_reference') ?? ''), amount: Number(data.get('amount')), payment_date: String(data.get('payment_date') ?? ''), method: String(data.get('method') ?? 'bank_transfer'), status: String(data.get('status') ?? 'completed'), notes: String(data.get('notes') ?? '') };
    try {
      const response = await fetch(`${API}/invoices/${selectedInvoice.id}/record_payment/`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(Object.entries(body).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · '));
      setShowPaymentForm(false); setSelectedInvoice(null); setNotice(`Payment ${body.payment_reference} recorded.`); await load();
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Could not record payment.'); }
  }

  const openInvoiceDetail = (invoice: Invoice) => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice);

  return <section className="content">
    <div className="page-heading"><div><div className="eyebrow">SYSTEM 4 · FINANCE OWNER</div><h1>Billing & Payments</h1><p>Track invoices, collections, and payment status across customer orders.</p></div><div className="heading-actions"><button className="secondary" onClick={() => void load()}>Refresh</button><button className="primary" onClick={() => openInvoice()}>＋ Create invoice</button></div></div>
    {error && <div className="alert"><strong>API not connected yet</strong><span>{error}</span></div>}
    {notice && <div className="success-alert" role="status">{notice}</div>}
    <div className="stats"><article><span>Total invoiced</span><strong>{money(summary.total_invoiced)}</strong><small>{summary.invoice_count} invoice records</small></article><article><span>Collected</span><strong>{money(summary.total_collected)}</strong><small>Completed payments</small></article><article><span>Outstanding</span><strong>{money(summary.outstanding)}</strong><small>Awaiting collection</small></article><article><span>Overdue</span><strong>{summary.overdue_count}</strong><small>Invoices past due date</small></article></div>
    {showInvoiceForm && <section className="panel form-panel"><div className="panel-head"><div><h2>Create an invoice</h2><p>Use the order reference shared by the Sales system.</p></div><button className="icon-button" type="button" onClick={() => setShowInvoiceForm(false)}>×</button></div><form className="product-form" onSubmit={saveInvoice}><label>Invoice number<input required name="invoice_number" placeholder="e.g. INV-2026-001" /></label><label>Customer name<input required name="customer_name" placeholder="Customer or company" /></label><label>Customer email<input name="customer_email" type="email" placeholder="billing@example.com" /></label><label>Order reference<input name="order_reference" placeholder="e.g. ORD-10024" /></label><label>Issue date<input required name="issue_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Due date<input required name="due_date" type="date" /></label><label>Amount (PHP)<input required name="amount" type="number" min="0" step="0.01" placeholder="0.00" /></label><label>Status<select name="status"><option value="draft">Draft</option><option value="sent">Sent</option></select></label><label className="wide">Notes<textarea name="notes" rows={2} placeholder="Optional billing notes" /></label><div className="form-submit"><button className="secondary" type="button" onClick={() => setShowInvoiceForm(false)}>Cancel</button><button className="primary" type="submit">Create invoice</button></div></form></section>}
    <section className="panel"><div className="panel-head"><div><h2>Invoices</h2><p>Search by invoice, customer, or order reference.</p></div></div><div className="toolbar"><input aria-label="Search invoices" placeholder="⌕  Search invoices…" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter invoices" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="sent">Sent</option><option value="partially_paid">Partially paid</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></div><div className="table-wrap"><table><thead><tr><th>INVOICE</th><th>CUSTOMER</th><th>ISSUED / DUE</th><th>AMOUNT</th><th>BALANCE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{busy ? <tr><td colSpan={7} className="empty">Loading invoices…</td></tr> : visibleInvoices.length ? visibleInvoices.map((invoice) => <tr key={invoice.id}><td><div className="product-cell"><span className="product-icon">₱</span><div><strong>{invoice.invoice_number}</strong><small>{invoice.order_reference || 'No order reference'}</small></div></div></td><td><strong>{invoice.customer_name}</strong><small className="table-subtext">{invoice.customer_email || 'No email'}</small></td><td><span>{dateLabel(invoice.issue_date)}</span><small className="table-subtext">Due {dateLabel(invoice.due_date)}</small></td><td>{money(invoice.amount)}</td><td>{money(invoice.balance_due)}<small className="table-subtext">{money(invoice.paid_amount)} paid</small></td><td><span className={`badge ${invoice.status}`}>{invoice.status_label}</span></td><td><button className="action-button" onClick={() => invoice.balance_due !== '0.00' && Number(invoice.balance_due) > 0 ? openPayment(invoice) : openInvoiceDetail(invoice)}>{Number(invoice.balance_due) > 0 ? 'Record payment' : 'View details'}</button></td></tr>) : <tr><td colSpan={7} className="empty">{error ? 'Start Django and migrate the database, then refresh.' : 'No invoices yet. Create your first invoice above.'}</td></tr>}</tbody></table></div><div className="table-foot">Showing {visibleInvoices.length} of {invoices.length} invoices <span>Invoice balances update after completed payments</span></div></section>
    {selectedInvoice && !showPaymentForm && <section className="panel detail-panel"><div className="panel-head"><div><h2>{selectedInvoice.invoice_number} payment history</h2><p>{selectedInvoice.customer_name} · {money(selectedInvoice.amount)} total</p></div><button className="secondary" onClick={() => setSelectedInvoice(null)}>Close</button></div>{selectedInvoice.payments.length ? <div className="payment-list">{selectedInvoice.payments.map((payment) => <div className="payment-row" key={payment.id}><span className="payment-mark">✓</span><div><strong>{payment.payment_reference}</strong><small>{dateLabel(payment.payment_date)} · {payment.method_label}</small></div><strong>{money(payment.amount)}</strong><span className={`badge ${payment.status}`}>{payment.status_label}</span></div>)}</div> : <div className="empty">No payments recorded for this invoice.</div>}</section>}
    {showPaymentForm && selectedInvoice && <section className="panel form-panel"><div className="panel-head"><div><h2>Record payment for {selectedInvoice.invoice_number}</h2><p>Balance due: <strong>{money(selectedInvoice.balance_due)}</strong></p></div><button className="icon-button" type="button" onClick={() => setShowPaymentForm(false)}>×</button></div><form className="product-form" onSubmit={savePayment}><label>Payment reference<input required name="payment_reference" placeholder="e.g. PAY-2026-001" /></label><label>Amount (PHP)<input required name="amount" type="number" min="0.01" max={selectedInvoice.balance_due} step="0.01" defaultValue={selectedInvoice.balance_due} /></label><label>Payment date<input required name="payment_date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Method<select name="method"><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option><option value="ewallet">E-wallet</option><option value="other">Other</option></select></label><label>Status<select name="status"><option value="completed">Completed</option><option value="pending">Pending</option></select></label><label className="wide">Notes<textarea name="notes" rows={2} placeholder="Optional payment notes" /></label><div className="form-submit"><button className="secondary" type="button" onClick={() => setShowPaymentForm(false)}>Cancel</button><button className="primary" type="submit">Record payment</button></div></form></section>}
    <footer>Mini ERP · System 4: Billing & Payments <span>API: {API}</span></footer>
  </section>;
}
