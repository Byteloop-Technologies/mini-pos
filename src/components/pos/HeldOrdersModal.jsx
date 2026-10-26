import React from 'react';
import { useSettings } from '../../context/SettingsContext';

export default function HeldOrdersModal({ heldOrders, onRecall, onDelete, onClose }) {
  const { formatCurrency } = useSettings();

  return (
    <div className="modal-overlay active" role="dialog" aria-modal="true" aria-labelledby="heldOrdersTitle">
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3 id="heldOrdersTitle">Parked Orders ({heldOrders.length})</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {heldOrders.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
              No held orders currently parked.
            </p>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Ref / Label</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                  <th>Parked At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {heldOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.reference}</strong>
                    </td>
                    <td>{order.customer_name || 'Walk-in'}</td>
                    <td>
                      {order.items?.length ?? 0} item(s) (
                      {order.items?.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
                      )
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-data)' }}>
                      {formatCurrency(order.total)}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onRecall(order)}
                        >
                          Recall
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => onDelete(order.id)}
                        >
                          Discard
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
