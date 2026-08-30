/**
 * Kredit - Customer Credit & Payment Ledger
 * Robust LocalStorage-backed Credit Management with Audit Trail
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. DATA STORAGE & INITIALIZATION
  // =========================================================================
  const STORAGE_KEYS = {
    CUSTOMERS: 'kredit_customers_v1',
    TRANSACTIONS: 'kredit_transactions_v1',
    AUDIT_LOGS: 'kredit_audit_logs_v1',
    APP_SETTINGS: 'kredit_settings_v1'
  };

  const Storage = {
    get(key, defaultValue = []) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (err) {
        console.error(`Error reading from localStorage key: ${key}`, err);
        return defaultValue;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.error(`Error saving to localStorage key: ${key}`, err);
        UI.showToast('Storage full or error saving data!', 'error');
      }
    },
    clearAll() {
      localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
      localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    }
  };

  // State
  let state = {
    customers: [],
    transactions: [],
    auditLogs: [],
    activeCustomerId: null,
    customerFilter: 'all',
    customerSearchQuery: '',
    globalLedgerFilter: 'all',
    globalLedgerSearch: '',
    auditFilter: 'all',
    auditSearch: '',
    transactionSearchQuery: ''
  };

  // =========================================================================
  // 2. AUDIT TRAIL SERVICE
  // =========================================================================
  const AuditService = {
    log(action, entityType, entityId, title, details = null, reason = '') {
      const entry = {
        id: 'aud_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        action, // 'CREATED' | 'EDITED' | 'DELETED'
        entityType, // 'transaction' | 'customer'
        entityId,
        title,
        details, // e.g. { old: {...}, new: {...} } or changes list
        reason,
        timestamp: new Date().toISOString()
      };

      state.auditLogs.unshift(entry);
      Storage.set(STORAGE_KEYS.AUDIT_LOGS, state.auditLogs);
      return entry;
    }
  };

  // =========================================================================
  // 3. CALCULATION & BUSINESS LOGIC
  // =========================================================================
  const LedgerService = {
    // Get active transactions for a customer
    getCustomerTransactions(customerId) {
      return state.transactions
        .filter(tx => tx.customerId === customerId && !tx.isDeleted)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    // Calculate specific customer balance
    // Positive balance = customer owes store (Debtor)
    // Negative balance = store owes customer / customer in advance (Advance)
    // Zero = settled
    getCustomerBalance(customerId) {
      const txs = this.getCustomerTransactions(customerId);
      let balance = 0;
      txs.forEach(tx => {
        const amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'credit') {
          balance += amount; // You gave credit (debt increases)
        } else if (tx.type === 'payment') {
          balance -= amount; // Customer paid (debt decreases)
        }
      });
      return Math.round(balance * 100) / 100;
    },

    // Calculate customer balance breakdown (total credit given, total payment received)
    getCustomerTotals(customerId) {
      const txs = this.getCustomerTransactions(customerId);
      let totalCredit = 0;
      let totalPayment = 0;
      txs.forEach(tx => {
        const amount = parseFloat(tx.amount) || 0;
        if (tx.type === 'credit') totalCredit += amount;
        if (tx.type === 'payment') totalPayment += amount;
      });
      return {
        totalCredit: Math.round(totalCredit * 100) / 100,
        totalPayment: Math.round(totalPayment * 100) / 100,
        balance: Math.round((totalCredit - totalPayment) * 100) / 100,
        txCount: txs.length
      };
    },

    // Global dashboard metrics
    getDashboardMetrics() {
      let totalOwed = 0; // Sum of positive customer balances
      let debtorCount = 0;
      let settledCount = 0;
      let totalReceived = 0;
      let totalGiven = 0;
      let creditTxCount = 0;
      let paymentTxCount = 0;

      state.customers.forEach(cust => {
        const bal = this.getCustomerBalance(cust.id);
        if (bal > 0) {
          totalOwed += bal;
          debtorCount++;
        } else if (bal === 0) {
          settledCount++;
        }
      });

      state.transactions.forEach(tx => {
        if (!tx.isDeleted) {
          const amount = parseFloat(tx.amount) || 0;
          if (tx.type === 'credit') {
            totalGiven += amount;
            creditTxCount++;
          } else if (tx.type === 'payment') {
            totalReceived += amount;
            paymentTxCount++;
          }
        }
      });

      return {
        totalOwed: Math.round(totalOwed * 100) / 100,
        debtorCount,
        settledCount,
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalGiven: Math.round(totalGiven * 100) / 100,
        creditTxCount,
        paymentTxCount,
        totalCustomers: state.customers.length
      };
    }
  };

  // =========================================================================
  // 4. UI RENDERER & INTERACTION CONTROLLER
  // =========================================================================
  const UI = {
    formatCurrency(num) {
      return (parseFloat(num) || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    },

    formatDateTime(isoString) {
      if (!isoString) return 'N/A';
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    formatDateOnly(dateString) {
      if (!dateString) return 'N/A';
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    },

    showToast(message, type = 'info') {
      const container = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    },

    openModal(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.style.display = 'flex';
      }
    },

    closeModal(modalElementOrId) {
      const modal = typeof modalElementOrId === 'string'
        ? document.getElementById(modalElementOrId)
        : modalElementOrId;
      if (modal) {
        modal.style.display = 'none';
      }
    },

    // Render Metrics Dashboard
    renderMetrics() {
      const metrics = LedgerService.getDashboardMetrics();
      document.getElementById('stat-total-owed').textContent = this.formatCurrency(metrics.totalOwed);
      document.getElementById('stat-debtor-count').textContent = metrics.debtorCount;
      document.getElementById('stat-total-received').textContent = this.formatCurrency(metrics.totalReceived);
      document.getElementById('stat-total-payments-count').textContent = metrics.paymentTxCount;
      document.getElementById('stat-total-given').textContent = this.formatCurrency(metrics.totalGiven);
      document.getElementById('stat-total-credit-count').textContent = metrics.creditTxCount;
      document.getElementById('stat-total-customers').textContent = metrics.totalCustomers;
      document.getElementById('stat-settled-count').textContent = metrics.settledCount;
    },

    // Render Left Customer Directory
    renderCustomerList() {
      const container = document.getElementById('customer-cards-list');
      const query = state.customerSearchQuery.trim().toLowerCase();
      const filter = state.customerFilter;

      let filtered = state.customers.filter(c => {
        const matchesQuery = c.name.toLowerCase().includes(query) || (c.phone && c.phone.toLowerCase().includes(query));
        if (!matchesQuery) return false;

        const bal = LedgerService.getCustomerBalance(c.id);
        if (filter === 'owed') return bal > 0;
        if (filter === 'settled') return bal === 0;
        if (filter === 'advance') return bal < 0;
        return true;
      });

      // Sort by highest debt first, then name
      filtered.sort((a, b) => {
        const balA = LedgerService.getCustomerBalance(a.id);
        const balB = LedgerService.getCustomerBalance(b.id);
        return balB - balA || a.name.localeCompare(b.name);
      });

      // Update Filter counts
      let owedCount = 0, settledCount = 0, advanceCount = 0;
      state.customers.forEach(c => {
        const bal = LedgerService.getCustomerBalance(c.id);
        if (bal > 0) owedCount++;
        else if (bal === 0) settledCount++;
        else advanceCount++;
      });
      document.getElementById('filter-count-all').textContent = state.customers.length;
      document.getElementById('filter-count-owed').textContent = owedCount;
      document.getElementById('filter-count-settled').textContent = settledCount;
      document.getElementById('filter-count-advance').textContent = advanceCount;

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="empty-table-state" style="padding: 24px 12px;">
            <p>${state.customers.length === 0 ? 'No customers added yet.' : 'No customers match your filter.'}</p>
          </div>
        `;
        return;
      }

      container.innerHTML = filtered.map(c => {
        const bal = LedgerService.getCustomerBalance(c.id);
        const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'C';
        const isSelected = c.id === state.activeCustomerId;

        let balClass = 'balance-settled';
        let balLabel = 'Settled';
        let balText = '$0.00';

        if (bal > 0) {
          balClass = 'balance-owed';
          balLabel = 'Owes You';
          balText = '$' + this.formatCurrency(bal);
        } else if (bal < 0) {
          balClass = 'balance-advance';
          balLabel = 'In Advance';
          balText = '$' + this.formatCurrency(Math.abs(bal));
        }

        return `
          <div class="customer-card-item ${isSelected ? 'selected' : ''}" data-customer-id="${c.id}">
            <div class="card-item-left">
              <div class="card-avatar">${initials}</div>
              <div class="card-item-details">
                <span class="card-cust-name">${c.name}</span>
                <span class="card-cust-phone">${c.phone || 'No phone'}</span>
              </div>
            </div>
            <div class="card-item-right">
              <span class="card-balance-amount ${balClass}">${balText}</span>
              <span class="card-balance-label ${balClass}">${balLabel}</span>
            </div>
          </div>
        `;
      }).join('');
    },

    // Render Active Customer Detail Pane
    renderActiveCustomer() {
      const emptyState = document.getElementById('customer-empty-state');
      const activeView = document.getElementById('customer-active-view');

      if (!state.activeCustomerId) {
        emptyState.style.display = 'flex';
        activeView.style.display = 'none';
        return;
      }

      const customer = state.customers.find(c => c.id === state.activeCustomerId);
      if (!customer) {
        state.activeCustomerId = null;
        emptyState.style.display = 'flex';
        activeView.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      activeView.style.display = 'flex';

      // Customer Info
      const initials = customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'C';
      document.getElementById('active-cust-avatar').textContent = initials;
      document.getElementById('active-cust-name').textContent = customer.name;
      document.getElementById('active-cust-phone').textContent = customer.phone || 'No phone provided';
      document.getElementById('active-cust-address').textContent = customer.address || 'No address specified';

      const bal = LedgerService.getCustomerBalance(customer.id);
      const statusChip = document.getElementById('active-cust-status');

      if (bal > 0) {
        statusChip.className = 'status-chip chip-owed';
        statusChip.textContent = `Owes $${this.formatCurrency(bal)}`;
      } else if (bal === 0) {
        statusChip.className = 'status-chip chip-settled';
        statusChip.textContent = 'Account Settled ($0.00)';
      } else {
        statusChip.className = 'status-chip chip-advance';
        statusChip.textContent = `Advance Credit $${this.formatCurrency(Math.abs(bal))}`;
      }

      // Ledger Table
      const txs = LedgerService.getCustomerTransactions(customer.id);
      document.getElementById('active-cust-tx-count').textContent = `${txs.length} ${txs.length === 1 ? 'record' : 'records'}`;

      const tbody = document.getElementById('customer-ledger-body');
      const noTxEl = document.getElementById('customer-no-tx');
      const tableWrapper = tbody.closest('.ledger-table-wrapper');

      const searchQuery = (document.getElementById('cust-tx-search-input').value || '').trim().toLowerCase();

      let filteredTxs = txs;
      if (searchQuery) {
        filteredTxs = txs.filter(tx => 
          (tx.notes && tx.notes.toLowerCase().includes(searchQuery)) ||
          (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(searchQuery)) ||
          tx.amount.toString().includes(searchQuery)
        );
      }

      if (filteredTxs.length === 0) {
        tableWrapper.style.display = 'none';
        noTxEl.style.display = 'block';
        if (searchQuery) {
          noTxEl.innerHTML = `<p>No transactions match "${searchQuery}".</p>`;
        } else {
          noTxEl.innerHTML = `<p>No transactions yet for ${customer.name}. Use the buttons above to record credit given or payment received.</p>`;
        }
      } else {
        tableWrapper.style.display = 'block';
        noTxEl.style.display = 'none';

        // Calculate running balances
        let runningBal = 0;
        const txRows = filteredTxs.map(tx => {
          const amt = parseFloat(tx.amount) || 0;
          if (tx.type === 'credit') {
            runningBal += amt;
          } else {
            runningBal -= amt;
          }

          const isCredit = tx.type === 'credit';
          const pillClass = isCredit ? 'tx-pill-credit' : 'tx-pill-payment';
          const pillText = isCredit ? 'Credit Given' : 'Payment In';

          return `
            <tr data-tx-id="${tx.id}">
              <td class="tx-date-cell">
                <div>${this.formatDateOnly(tx.date)}</div>
                <span class="tx-date-time">${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </td>
              <td>
                <span class="tx-pill ${pillClass}">
                  ${isCredit ? '▲' : '▼'} ${pillText}
                </span>
              </td>
              <td>
                <div class="tx-notes-text">${tx.notes || '<span style="color:#64748b; font-style:italic;">No description</span>'}</div>
                ${tx.dueDate ? `<span class="tx-due-pill">Due: ${this.formatDateOnly(tx.dueDate)}</span>` : ''}
              </td>
              <td>
                <span class="tx-method-badge">${tx.paymentMethod || 'Cash'}</span>
              </td>
              <td style="text-align: right;">
                ${isCredit ? `<span class="tx-amount-credit">+$${this.formatCurrency(amt)}</span>` : '<span style="color:#475569;">—</span>'}
              </td>
              <td style="text-align: right;">
                ${!isCredit ? `<span class="tx-amount-payment">-$${this.formatCurrency(amt)}</span>` : '<span style="color:#475569;">—</span>'}
              </td>
              <td style="text-align: right;">
                <span class="tx-running-balance ${runningBal > 0 ? 'balance-owed' : (runningBal === 0 ? 'balance-settled' : 'balance-advance')}">
                  $${this.formatCurrency(Math.abs(runningBal))}
                  ${runningBal > 0 ? ' Dr' : (runningBal < 0 ? ' Cr' : '')}
                </span>
              </td>
              <td>
                <div class="tx-actions-cell">
                  <button class="btn-icon-table btn-edit-tx" data-tx-id="${tx.id}" title="Edit Transaction">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button class="btn-icon-table btn-icon-danger btn-delete-tx" data-tx-id="${tx.id}" title="Delete Transaction">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');

        tbody.innerHTML = txRows;
      }
    },

    // Render Global Ledger View
    renderGlobalLedger() {
      const tbody = document.getElementById('global-ledger-body');
      const emptyState = document.getElementById('global-ledger-empty');
      const tableWrapper = tbody.closest('.ledger-table-wrapper');

      const filterType = state.globalLedgerFilter;
      const search = state.globalLedgerSearch.trim().toLowerCase();

      let txs = state.transactions.filter(tx => !tx.isDeleted);

      if (filterType !== 'all') {
        txs = txs.filter(tx => tx.type === filterType);
      }

      if (search) {
        txs = txs.filter(tx => {
          const cust = state.customers.find(c => c.id === tx.customerId);
          const custName = cust ? cust.name.toLowerCase() : '';
          const notes = (tx.notes || '').toLowerCase();
          const amount = (tx.amount || '').toString();
          return custName.includes(search) || notes.includes(search) || amount.includes(search);
        });
      }

      // Sort newest first
      txs.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (txs.length === 0) {
        tableWrapper.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      tableWrapper.style.display = 'block';
      emptyState.style.display = 'none';

      tbody.innerHTML = txs.map(tx => {
        const cust = state.customers.find(c => c.id === tx.customerId);
        const custName = cust ? cust.name : 'Unknown Customer';
        const isCredit = tx.type === 'credit';
        const pillClass = isCredit ? 'tx-pill-credit' : 'tx-pill-payment';
        const pillText = isCredit ? 'Credit Given' : 'Payment In';
        const amt = parseFloat(tx.amount) || 0;

        return `
          <tr>
            <td class="tx-date-cell">
              <div>${this.formatDateOnly(tx.date)}</div>
              <span class="tx-date-time">${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </td>
            <td>
              <strong style="color: #ffffff; cursor: pointer;" class="link-to-cust" data-cust-id="${tx.customerId}">${custName}</strong>
            </td>
            <td>
              <span class="tx-pill ${pillClass}">
                ${isCredit ? '▲' : '▼'} ${pillText}
              </span>
            </td>
            <td>
              <div class="tx-notes-text">${tx.notes || '<span style="color:#64748b; font-style:italic;">No description</span>'}</div>
            </td>
            <td>
              <span class="tx-method-badge">${tx.paymentMethod || 'Cash'}</span>
            </td>
            <td style="text-align: right;">
              <span class="${isCredit ? 'tx-amount-credit' : 'tx-amount-payment'}">
                ${isCredit ? '+' : '-'}$${this.formatCurrency(amt)}
              </span>
            </td>
            <td style="text-align: center;">
              <button class="btn btn-outline btn-sm link-to-cust" data-cust-id="${tx.customerId}" style="padding: 4px 8px; font-size: 11px;">
                View
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    // Render Audit Trail
    renderAuditTrail() {
      const container = document.getElementById('audit-timeline-list');
      const emptyState = document.getElementById('audit-empty');
      const filterAction = state.auditFilter;
      const search = state.auditSearch.trim().toLowerCase();

      let logs = state.auditLogs;

      if (filterAction !== 'all') {
        logs = logs.filter(l => l.action === filterAction);
      }

      if (search) {
        logs = logs.filter(l => 
          l.title.toLowerCase().includes(search) ||
          (l.reason && l.reason.toLowerCase().includes(search)) ||
          JSON.stringify(l.details || {}).toLowerCase().includes(search)
        );
      }

      if (logs.length === 0) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
      }

      container.style.display = 'flex';
      emptyState.style.display = 'none';

      container.innerHTML = logs.map(log => {
        let diffHtml = '';
        if (log.details && log.details.changes) {
          diffHtml = `
            <div class="audit-diff-box">
              ${log.details.changes.map(ch => `
                <div class="audit-diff-item">
                  <span class="diff-field">${ch.field}:</span>
                  <span class="diff-old">${ch.oldVal || 'None'}</span>
                  <span>&rarr;</span>
                  <span class="diff-new">${ch.newVal || 'None'}</span>
                </div>
              `).join('')}
            </div>
          `;
        } else if (log.details && log.details.summary) {
          diffHtml = `
            <div class="audit-diff-box">
              <span>${log.details.summary}</span>
            </div>
          `;
        }

        return `
          <div class="audit-entry-card audit-action-${log.action}">
            <div class="audit-card-top">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="audit-action-tag audit-tag-${log.action}">${log.action}</span>
                <span class="audit-title-text">${log.title}</span>
              </div>
              <span class="audit-timestamp">${this.formatDateTime(log.timestamp)}</span>
            </div>

            ${diffHtml}

            ${log.reason ? `<div class="audit-reason-text"><strong>Reason / Log Note:</strong> "${log.reason}"</div>` : ''}
          </div>
        `;
      }).join('');
    },

    // Refresh all views
    refreshAll() {
      this.renderMetrics();
      this.renderCustomerList();
      this.renderActiveCustomer();
      this.renderGlobalLedger();
      this.renderAuditTrail();
    }
  };

  // =========================================================================
  // 5. EVENT HANDLERS & MODAL BINDINGS
  // =========================================================================
  function initEventBindings() {
    // Navigation Tabs
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));

        btn.classList.add('active');
        const viewId = btn.getAttribute('data-view');
        const targetView = document.getElementById(viewId);
        if (targetView) {
          targetView.classList.add('active');
        }

        // View specific refresh
        if (viewId === 'ledger-view') UI.renderGlobalLedger();
        if (viewId === 'audit-view') UI.renderAuditTrail();
      });
    });

    // Close Modals via Close Button or Backdrop Click
    document.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-modal]') || e.target.classList.contains('modal-backdrop')) {
        const modal = e.target.closest('.modal-backdrop');
        if (modal) UI.closeModal(modal);
      }
    });

    // Quick Add Customer Buttons
    const openCustomerModal = (customerToEdit = null) => {
      const form = document.getElementById('form-customer');
      form.reset();
      const title = document.getElementById('modal-customer-title');
      const idInput = document.getElementById('cust-form-id');

      if (customerToEdit) {
        title.textContent = 'Edit Customer Details';
        idInput.value = customerToEdit.id;
        document.getElementById('cust-form-name').value = customerToEdit.name;
        document.getElementById('cust-form-phone').value = customerToEdit.phone || '';
        document.getElementById('cust-form-email').value = customerToEdit.email || '';
        document.getElementById('cust-form-address').value = customerToEdit.address || '';
        document.getElementById('cust-form-notes').value = customerToEdit.notes || '';
      } else {
        title.textContent = 'Add New Customer';
        idInput.value = '';
      }

      UI.openModal('modal-customer');
    };

    document.getElementById('btn-quick-new-customer').addEventListener('click', () => openCustomerModal());
    document.getElementById('btn-empty-state-add').addEventListener('click', () => openCustomerModal());
    document.getElementById('btn-edit-active-cust').addEventListener('click', () => {
      const cust = state.customers.find(c => c.id === state.activeCustomerId);
      if (cust) openCustomerModal(cust);
    });

    // Customer Form Submit
    document.getElementById('form-customer').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('cust-form-id').value;
      const name = document.getElementById('cust-form-name').value.trim();
      const phone = document.getElementById('cust-form-phone').value.trim();
      const email = document.getElementById('cust-form-email').value.trim();
      const address = document.getElementById('cust-form-address').value.trim();
      const notes = document.getElementById('cust-form-notes').value.trim();

      if (!name || !phone) {
        UI.showToast('Please enter customer name and phone number.', 'error');
        return;
      }

      if (id) {
        // Edit Customer
        const index = state.customers.findIndex(c => c.id === id);
        if (index !== -1) {
          const oldCust = { ...state.customers[index] };
          state.customers[index] = {
            ...oldCust,
            name, phone, email, address, notes,
            updatedAt: new Date().toISOString()
          };

          AuditService.log(
            'EDITED',
            'customer',
            id,
            `Customer profile updated for ${name}`,
            { summary: `Updated contact info or notes for customer.` }
          );

          UI.showToast(`Updated customer: ${name}`, 'success');
        }
      } else {
        // Create Customer
        const newCust = {
          id: 'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name, phone, email, address, notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        state.customers.push(newCust);
        state.activeCustomerId = newCust.id;

        AuditService.log(
          'CREATED',
          'customer',
          newCust.id,
          `New customer added: ${name}`,
          { summary: `Phone: ${phone}, Address: ${address || 'None'}` }
        );

        UI.showToast(`Customer added: ${name}`, 'success');
      }

      Storage.set(STORAGE_KEYS.CUSTOMERS, state.customers);
      UI.closeModal('modal-customer');
      UI.refreshAll();
    });

    // Customer Selection from Left List
    document.getElementById('customer-cards-list').addEventListener('click', (e) => {
      const card = e.target.closest('.customer-card-item');
      if (card) {
        const custId = card.getAttribute('data-customer-id');
        state.activeCustomerId = custId;
        UI.renderCustomerList();
        UI.renderActiveCustomer();
      }
    });

    // Search & Filter Customers
    const searchInput = document.getElementById('customer-search-input');
    const clearBtn = document.getElementById('btn-clear-customer-search');

    searchInput.addEventListener('input', (e) => {
      state.customerSearchQuery = e.target.value;
      clearBtn.style.display = e.target.value ? 'block' : 'none';
      UI.renderCustomerList();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      state.customerSearchQuery = '';
      clearBtn.style.display = 'none';
      UI.renderCustomerList();
    });

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.customerFilter = pill.getAttribute('data-filter');
        UI.renderCustomerList();
      });
    });

    // Transaction Entry Modal (Give Credit / Receive Payment)
    const openTransactionModal = (type) => {
      if (!state.activeCustomerId) {
        UI.showToast('Please select a customer first.', 'error');
        return;
      }

      const customer = state.customers.find(c => c.id === state.activeCustomerId);
      if (!customer) return;

      const form = document.getElementById('form-transaction');
      form.reset();

      document.getElementById('tx-form-type').value = type;
      document.getElementById('tx-form-customer-id').value = customer.id;
      document.getElementById('tx-form-customer-name').textContent = customer.name;

      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      document.getElementById('tx-form-date').value = now.toISOString().slice(0, 16);

      const title = document.getElementById('modal-tx-title');
      const category = document.getElementById('modal-tx-category');
      const submitBtn = document.getElementById('btn-submit-tx');
      const dueDateGroup = document.getElementById('tx-due-date-group');
      const amountLabel = document.getElementById('tx-amount-label');

      if (type === 'credit') {
        category.textContent = 'Credit Given ("You Gave")';
        title.textContent = 'How much credit did you give?';
        amountLabel.textContent = 'Credit Amount ($) *';
        submitBtn.className = 'btn btn-give-credit';
        submitBtn.innerHTML = '<span>Record Credit Given</span>';
        dueDateGroup.style.display = 'block';
      } else {
        category.textContent = 'Payment Received ("Him Pay")';
        title.textContent = 'How much payment did you receive?';
        amountLabel.textContent = 'Payment Amount ($) *';
        submitBtn.className = 'btn btn-receive-payment';
        submitBtn.innerHTML = '<span>Record Payment Received</span>';
        dueDateGroup.style.display = 'none';
      }

      UI.openModal('modal-transaction');
    };

    document.getElementById('btn-action-give-credit').addEventListener('click', () => openTransactionModal('credit'));
    document.getElementById('btn-action-receive-payment').addEventListener('click', () => openTransactionModal('payment'));

    // Submit Transaction
    document.getElementById('form-transaction').addEventListener('submit', (e) => {
      e.preventDefault();
      const customerId = document.getElementById('tx-form-customer-id').value;
      const type = document.getElementById('tx-form-type').value; // 'credit' | 'payment'
      const amount = parseFloat(document.getElementById('tx-form-amount').value);
      const date = document.getElementById('tx-form-date').value;
      const paymentMethod = document.getElementById('tx-form-method').value;
      const notes = document.getElementById('tx-form-notes').value.trim();
      const dueDate = document.getElementById('tx-form-due-date').value || null;

      if (isNaN(amount) || amount <= 0) {
        UI.showToast('Please enter a valid amount greater than zero.', 'error');
        return;
      }

      const customer = state.customers.find(c => c.id === customerId);
      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        customerId,
        type,
        amount,
        date: new Date(date).toISOString(),
        paymentMethod,
        notes,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isDeleted: false
      };

      state.transactions.push(newTx);
      Storage.set(STORAGE_KEYS.TRANSACTIONS, state.transactions);

      // Audit Log
      AuditService.log(
        'CREATED',
        'transaction',
        newTx.id,
        type === 'credit'
          ? `Gave $${UI.formatCurrency(amount)} credit to ${customer ? customer.name : 'customer'}`
          : `Received $${UI.formatCurrency(amount)} payment from ${customer ? customer.name : 'customer'}`,
        {
          summary: `${type.toUpperCase()}: $${UI.formatCurrency(amount)} via ${paymentMethod}. Note: ${notes || 'None'}`
        }
      );

      UI.closeModal('modal-transaction');
      UI.showToast(type === 'credit' ? `Credit recorded: $${UI.formatCurrency(amount)}` : `Payment recorded: $${UI.formatCurrency(amount)}`, 'success');
      UI.refreshAll();
    });

    // Customer Transaction Inline Search
    document.getElementById('cust-tx-search-input').addEventListener('input', () => {
      UI.renderActiveCustomer();
    });

    // Edit Transaction Handler
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('.btn-edit-tx');
      if (editBtn) {
        const txId = editBtn.getAttribute('data-tx-id');
        const tx = state.transactions.find(t => t.id === txId);
        if (!tx) return;

        document.getElementById('edit-tx-id').value = tx.id;
        document.getElementById('edit-tx-type').value = tx.type;
        document.getElementById('edit-tx-amount').value = tx.amount;
        
        const localDate = new Date(tx.date);
        localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset());
        document.getElementById('edit-tx-date').value = localDate.toISOString().slice(0, 16);
        
        document.getElementById('edit-tx-method').value = tx.paymentMethod || 'Cash';
        document.getElementById('edit-tx-notes').value = tx.notes || '';
        document.getElementById('edit-tx-reason').value = '';

        UI.openModal('modal-edit-transaction');
      }
    });

    // Submit Edit Transaction Form with Audit Trail
    document.getElementById('form-edit-transaction').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-tx-id').value;
      const type = document.getElementById('edit-tx-type').value;
      const amount = parseFloat(document.getElementById('edit-tx-amount').value);
      const date = document.getElementById('edit-tx-date').value;
      const paymentMethod = document.getElementById('edit-tx-method').value;
      const notes = document.getElementById('edit-tx-notes').value.trim();
      const reason = document.getElementById('edit-tx-reason').value.trim();

      if (isNaN(amount) || amount <= 0) {
        UI.showToast('Please enter a valid positive amount.', 'error');
        return;
      }

      if (!reason) {
        UI.showToast('Please provide a reason for the modification for the audit trail.', 'error');
        return;
      }

      const index = state.transactions.findIndex(t => t.id === id);
      if (index === -1) return;

      const oldTx = { ...state.transactions[index] };
      const customer = state.customers.find(c => c.id === oldTx.customerId);

      // Track individual field changes for audit
      const changes = [];
      if (oldTx.type !== type) {
        changes.push({ field: 'Type', oldVal: oldTx.type, newVal: type });
      }
      if (parseFloat(oldTx.amount) !== amount) {
        changes.push({ field: 'Amount', oldVal: `$${UI.formatCurrency(oldTx.amount)}`, newVal: `$${UI.formatCurrency(amount)}` });
      }
      if (new Date(oldTx.date).getTime() !== new Date(date).getTime()) {
        changes.push({ field: 'Date', oldVal: UI.formatDateTime(oldTx.date), newVal: UI.formatDateTime(date) });
      }
      if (oldTx.paymentMethod !== paymentMethod) {
        changes.push({ field: 'Method', oldVal: oldTx.paymentMethod, newVal: paymentMethod });
      }
      if (oldTx.notes !== notes) {
        changes.push({ field: 'Notes', oldVal: oldTx.notes || 'Empty', newVal: notes || 'Empty' });
      }

      // Update in state
      state.transactions[index] = {
        ...oldTx,
        type,
        amount,
        date: new Date(date).toISOString(),
        paymentMethod,
        notes,
        updatedAt: new Date().toISOString()
      };

      Storage.set(STORAGE_KEYS.TRANSACTIONS, state.transactions);

      // Record Audit Entry
      AuditService.log(
        'EDITED',
        'transaction',
        id,
        `Edited transaction for ${customer ? customer.name : 'customer'}`,
        { changes },
        reason
      );

      UI.closeModal('modal-edit-transaction');
      UI.showToast('Transaction updated & audit log saved.', 'success');
      UI.refreshAll();
    });

    // Delete Transaction Handler
    document.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.btn-delete-tx');
      if (delBtn) {
        const txId = delBtn.getAttribute('data-tx-id');
        const tx = state.transactions.find(t => t.id === txId);
        if (!tx) return;

        const customer = state.customers.find(c => c.id === tx.customerId);
        document.getElementById('delete-tx-id').value = tx.id;
        document.getElementById('delete-tx-reason').value = '';

        document.getElementById('delete-tx-summary').innerHTML = `
          <strong>${tx.type === 'credit' ? 'Credit Given' : 'Payment Received'}:</strong> $${UI.formatCurrency(tx.amount)}<br>
          <strong>Customer:</strong> ${customer ? customer.name : 'Unknown'}<br>
          <strong>Date:</strong> ${UI.formatDateTime(tx.date)}<br>
          <strong>Note:</strong> ${tx.notes || 'None'}
        `;

        UI.openModal('modal-delete-transaction');
      }
    });

    // Confirm Delete Transaction with Audit Trail
    document.getElementById('form-delete-transaction').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('delete-tx-id').value;
      const reason = document.getElementById('delete-tx-reason').value.trim();

      if (!reason) {
        UI.showToast('Please state a reason for deleting this record.', 'error');
        return;
      }

      const index = state.transactions.findIndex(t => t.id === id);
      if (index === -1) return;

      const tx = state.transactions[index];
      const customer = state.customers.find(c => c.id === tx.customerId);

      // Soft delete to keep immutable history
      tx.isDeleted = true;
      tx.deletedAt = new Date().toISOString();
      tx.deleteReason = reason;

      Storage.set(STORAGE_KEYS.TRANSACTIONS, state.transactions);

      AuditService.log(
        'DELETED',
        'transaction',
        id,
        `Deleted ${tx.type === 'credit' ? 'Credit' : 'Payment'} record of $${UI.formatCurrency(tx.amount)} for ${customer ? customer.name : 'customer'}`,
        { summary: `Amount: $${UI.formatCurrency(tx.amount)}, Date: ${UI.formatDateTime(tx.date)}, Notes: ${tx.notes || 'None'}` },
        reason
      );

      UI.closeModal('modal-delete-transaction');
      UI.showToast('Transaction removed & deletion logged.', 'success');
      UI.refreshAll();
    });

    // Reminder Modal & Message Formatter
    document.getElementById('btn-share-reminder').addEventListener('click', () => {
      const customer = state.customers.find(c => c.id === state.activeCustomerId);
      if (!customer) return;

      const bal = LedgerService.getCustomerBalance(customer.id);
      let text = '';

      if (bal > 0) {
        text = `Hello ${customer.name},\nThis is a friendly reminder that your outstanding balance with us is $${UI.formatCurrency(bal)}.\nPlease let us know when you can arrange payment. Thank you!`;
      } else if (bal < 0) {
        text = `Hello ${customer.name},\nYou currently have an advance balance credit of $${UI.formatCurrency(Math.abs(bal))} in your account with us. Thank you!`;
      } else {
        text = `Hello ${customer.name},\nYour account balance with us is fully settled ($0.00). Thank you for your patronage!`;
      }

      document.getElementById('reminder-text-content').value = text;

      // WhatsApp link
      const cleanPhone = (customer.phone || '').replace(/[^0-9]/g, '');
      const encodedMsg = encodeURIComponent(text);
      const waLink = document.getElementById('reminder-whatsapp-link');

      if (cleanPhone) {
        waLink.href = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;
        waLink.style.display = 'inline-flex';
      } else {
        waLink.href = `https://api.whatsapp.com/send?text=${encodedMsg}`;
        waLink.style.display = 'inline-flex';
      }

      document.getElementById('copy-reminder-label').textContent = 'Copy Text';
      UI.openModal('modal-reminder');
    });

    // Copy Reminder Text Button
    document.getElementById('btn-copy-reminder').addEventListener('click', () => {
      const text = document.getElementById('reminder-text-content').value;
      navigator.clipboard.writeText(text).then(() => {
        document.getElementById('copy-reminder-label').textContent = 'Copied!';
        UI.showToast('Reminder message copied to clipboard.', 'info');
        setTimeout(() => {
          document.getElementById('copy-reminder-label').textContent = 'Copy Text';
        }, 2000);
      });
    });

    // Statement Modal & Print
    document.getElementById('btn-print-statement').addEventListener('click', () => {
      const customer = state.customers.find(c => c.id === state.activeCustomerId);
      if (!customer) return;

      const txs = LedgerService.getCustomerTransactions(customer.id);
      const totals = LedgerService.getCustomerTotals(customer.id);

      const printArea = document.getElementById('statement-print-area');
      let running = 0;

      printArea.innerHTML = `
        <div class="statement-paper">
          <div class="statement-top-bar">
            <div>
              <h1 class="statement-brand-h1">Kredit Statement</h1>
              <div class="statement-doc-type">Customer Account Ledger & Credit History</div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 700; font-size: 13px;">Date: ${UI.formatDateOnly(new Date())}</div>
              <div style="font-size: 11px; color: #64748b;">Generated from Kredit Ledger</div>
            </div>
          </div>

          <div class="statement-meta-grid">
            <div class="statement-meta-box">
              <div class="statement-meta-title">Customer Information</div>
              <div class="statement-meta-val">${customer.name}</div>
              <div style="font-size: 12px; color: #475569; margin-top: 2px;">Phone: ${customer.phone || 'N/A'}</div>
              <div style="font-size: 12px; color: #475569;">Address: ${customer.address || 'N/A'}</div>
            </div>
            <div class="statement-meta-box" style="text-align: right;">
              <div class="statement-meta-title">Current Net Balance</div>
              <div class="statement-meta-val" style="font-size: 20px; color: ${totals.balance > 0 ? '#b91c1c' : '#047857'};">
                $${UI.formatCurrency(Math.abs(totals.balance))} ${totals.balance > 0 ? '(Owed / Dr)' : (totals.balance < 0 ? '(Advance / Cr)' : '(Settled)')}
              </div>
              <div style="font-size: 11px; color: #64748b;">Total Records: ${totals.txCount}</div>
            </div>
          </div>

          <table class="statement-table">
            <thead>
              <tr>
                <th style="width: 90px;">Date</th>
                <th style="width: 100px;">Type</th>
                <th>Details & Notes</th>
                <th style="width: 80px;">Method</th>
                <th style="width: 100px; text-align: right;">Credit Given</th>
                <th style="width: 100px; text-align: right;">Paid In</th>
                <th style="width: 100px; text-align: right;">Balance</th>
              </tr>
            </thead>
            <tbody>
              ${txs.map(t => {
                const amt = parseFloat(t.amount) || 0;
                if (t.type === 'credit') running += amt;
                else running -= amt;

                return `
                  <tr>
                    <td>${UI.formatDateOnly(t.date)}</td>
                    <td style="font-weight: 600; color: ${t.type === 'credit' ? '#b91c1c' : '#047857'}">
                      ${t.type === 'credit' ? 'Credit Given' : 'Payment'}
                    </td>
                    <td>${t.notes || '—'}</td>
                    <td>${t.paymentMethod || 'Cash'}</td>
                    <td style="text-align: right;">${t.type === 'credit' ? '$' + UI.formatCurrency(amt) : '—'}</td>
                    <td style="text-align: right;">${t.type === 'payment' ? '$' + UI.formatCurrency(amt) : '—'}</td>
                    <td style="text-align: right; font-weight: 700;">$${UI.formatCurrency(Math.abs(running))}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="statement-summary-box">
            <div class="statement-sum-row">
              <span>Total Credit Extended:</span>
              <strong>$${UI.formatCurrency(totals.totalCredit)}</strong>
            </div>
            <div class="statement-sum-row">
              <span>Total Payments Received:</span>
              <strong>$${UI.formatCurrency(totals.totalPayment)}</strong>
            </div>
            <div class="statement-sum-row statement-sum-total">
              <span>Net Balance Due:</span>
              <strong style="color: ${totals.balance > 0 ? '#b91c1c' : '#047857'};">
                $${UI.formatCurrency(Math.abs(totals.balance))}
              </strong>
            </div>
          </div>
        </div>
      `;

      UI.openModal('modal-statement');
    });

    document.getElementById('btn-trigger-print').addEventListener('click', () => {
      window.print();
    });

    // Global Ledger Links to Customer View
    document.addEventListener('click', (e) => {
      const link = e.target.closest('.link-to-cust');
      if (link) {
        const custId = link.getAttribute('data-cust-id');
        if (custId) {
          state.activeCustomerId = custId;
          document.getElementById('tab-btn-customers').click();
          UI.renderCustomerList();
          UI.renderActiveCustomer();
        }
      }
    });

    // Global Ledger Filters
    document.getElementById('global-ledger-filter-type').addEventListener('change', (e) => {
      state.globalLedgerFilter = e.target.value;
      UI.renderGlobalLedger();
    });

    document.getElementById('global-ledger-search').addEventListener('input', (e) => {
      state.globalLedgerSearch = e.target.value;
      UI.renderGlobalLedger();
    });

    // Audit Trail Filters
    document.getElementById('audit-filter-action').addEventListener('change', (e) => {
      state.auditFilter = e.target.value;
      UI.renderAuditTrail();
    });

    document.getElementById('audit-search-input').addEventListener('input', (e) => {
      state.auditSearch = e.target.value;
      UI.renderAuditTrail();
    });

    // Backup & Export JSON
    document.getElementById('btn-export-json').addEventListener('click', () => {
      const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        customers: state.customers,
        transactions: state.transactions,
        auditLogs: state.auditLogs
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `kredit_backup_${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      UI.showToast('Backup downloaded successfully.', 'success');
    });

    // Import Backup JSON
    document.getElementById('import-json-file').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (!parsed.customers || !parsed.transactions) {
            throw new Error('Invalid file structure. Missing customers or transactions list.');
          }

          state.customers = parsed.customers || [];
          state.transactions = parsed.transactions || [];
          state.auditLogs = parsed.auditLogs || [];

          Storage.set(STORAGE_KEYS.CUSTOMERS, state.customers);
          Storage.set(STORAGE_KEYS.TRANSACTIONS, state.transactions);
          Storage.set(STORAGE_KEYS.AUDIT_LOGS, state.auditLogs);

          AuditService.log(
            'CREATED',
            'system',
            'backup_restore',
            'Data restored from JSON backup file',
            { summary: `Restored ${state.customers.length} customers and ${state.transactions.length} transactions.` }
          );

          if (state.customers.length > 0) {
            state.activeCustomerId = state.customers[0].id;
          }

          UI.showToast('Backup restored successfully!', 'success');
          UI.refreshAll();
        } catch (err) {
          console.error('Import error:', err);
          UI.showToast('Failed to import backup: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset input
    });

    // Load Sample Demo Data
    document.getElementById('btn-load-sample-data').addEventListener('click', () => {
      if (confirm('Load realistic sample demo records? This will populate customers, credit records, and payments.')) {
        loadDemoData();
      }
    });

    // Reset All Data
    document.getElementById('btn-reset-all-data').addEventListener('click', () => {
      if (confirm('WARNING: Are you sure you want to erase all customers, transactions, and audit records? This cannot be undone unless you have a backup.')) {
        Storage.clearAll();
        state.customers = [];
        state.transactions = [];
        state.auditLogs = [];
        state.activeCustomerId = null;
        UI.showToast('All local storage data has been cleared.', 'info');
        UI.refreshAll();
      }
    });
  }

  // =========================================================================
  // 6. SAMPLE DEMO DATA SEEDER
  // =========================================================================
  function loadDemoData() {
    const now = Date.now();
    const oneDay = 86400000;

    const sampleCustomers = [
      {
        id: 'cust_sample_1',
        name: 'Maria Santos (Bakery)',
        phone: '+1 (555) 234-5678',
        email: 'maria.santos@example.com',
        address: '142 Market Square, Shop #3',
        notes: 'Buys flour and baking supplies weekly. High volume customer.',
        createdAt: new Date(now - 14 * oneDay).toISOString(),
        updatedAt: new Date(now - 14 * oneDay).toISOString()
      },
      {
        id: 'cust_sample_2',
        name: 'David Adeleke',
        phone: '+1 (555) 876-5432',
        email: 'david.ade@example.com',
        address: 'Plot 12, Commercial Avenue',
        notes: 'Regular credit purchaser for construction materials.',
        createdAt: new Date(now - 20 * oneDay).toISOString(),
        updatedAt: new Date(now - 20 * oneDay).toISOString()
      },
      {
        id: 'cust_sample_3',
        name: 'Elena Rostova',
        phone: '+1 (555) 345-6789',
        email: 'elena.r@example.com',
        address: 'Suite 401, Metro Tower',
        notes: 'Wholesale textile and fabrics buyer.',
        createdAt: new Date(now - 30 * oneDay).toISOString(),
        updatedAt: new Date(now - 30 * oneDay).toISOString()
      },
      {
        id: 'cust_sample_4',
        name: 'Tunde Bakare',
        phone: '+1 (555) 456-7890',
        email: 'tunde@example.com',
        address: 'Corner Shop 5, East Gate',
        notes: 'Electronics and accessories retail distributor.',
        createdAt: new Date(now - 10 * oneDay).toISOString(),
        updatedAt: new Date(now - 10 * oneDay).toISOString()
      }
    ];

    const sampleTransactions = [
      // Maria Santos
      {
        id: 'tx_s1',
        customerId: 'cust_sample_1',
        type: 'credit',
        amount: 350.00,
        date: new Date(now - 10 * oneDay).toISOString(),
        paymentMethod: 'Goods/Services',
        notes: '10 Bags of Premium Wheat Flour (Invoice #204)',
        dueDate: new Date(now + 4 * oneDay).toISOString(),
        createdAt: new Date(now - 10 * oneDay).toISOString(),
        updatedAt: new Date(now - 10 * oneDay).toISOString(),
        isDeleted: false
      },
      {
        id: 'tx_s2',
        customerId: 'cust_sample_1',
        type: 'payment',
        amount: 200.00,
        date: new Date(now - 5 * oneDay).toISOString(),
        paymentMethod: 'Bank Transfer',
        notes: 'Partial payment via Bank Wire ref #TRX-9921',
        dueDate: null,
        createdAt: new Date(now - 5 * oneDay).toISOString(),
        updatedAt: new Date(now - 5 * oneDay).toISOString(),
        isDeleted: false
      },
      {
        id: 'tx_s3',
        customerId: 'cust_sample_1',
        type: 'credit',
        amount: 120.00,
        date: new Date(now - 2 * oneDay).toISOString(),
        paymentMethod: 'Goods/Services',
        notes: 'Yeast crates & Baking Butter supply',
        dueDate: new Date(now + 10 * oneDay).toISOString(),
        createdAt: new Date(now - 2 * oneDay).toISOString(),
        updatedAt: new Date(now - 2 * oneDay).toISOString(),
        isDeleted: false
      },

      // David Adeleke
      {
        id: 'tx_s4',
        customerId: 'cust_sample_2',
        type: 'credit',
        amount: 850.00,
        date: new Date(now - 15 * oneDay).toISOString(),
        paymentMethod: 'Goods/Services',
        notes: '50 Bags Portland Cement & Steel Rods',
        dueDate: new Date(now - 1 * oneDay).toISOString(),
        createdAt: new Date(now - 15 * oneDay).toISOString(),
        updatedAt: new Date(now - 15 * oneDay).toISOString(),
        isDeleted: false
      },
      {
        id: 'tx_s5',
        customerId: 'cust_sample_2',
        type: 'payment',
        amount: 850.00,
        date: new Date(now - 1 * oneDay).toISOString(),
        paymentMethod: 'Cash',
        notes: 'Full balance settled in cash with cashier',
        dueDate: null,
        createdAt: new Date(now - 1 * oneDay).toISOString(),
        updatedAt: new Date(now - 1 * oneDay).toISOString(),
        isDeleted: false
      },

      // Elena Rostova
      {
        id: 'tx_s6',
        customerId: 'cust_sample_3',
        type: 'credit',
        amount: 600.00,
        date: new Date(now - 8 * oneDay).toISOString(),
        paymentMethod: 'Goods/Services',
        notes: 'Silk and cotton fabric rolls order #842',
        dueDate: new Date(now + 7 * oneDay).toISOString(),
        createdAt: new Date(now - 8 * oneDay).toISOString(),
        updatedAt: new Date(now - 8 * oneDay).toISOString(),
        isDeleted: false
      },
      {
        id: 'tx_s7',
        customerId: 'cust_sample_3',
        type: 'payment',
        amount: 700.00,
        date: new Date(now - 1 * oneDay).toISOString(),
        paymentMethod: 'POS / Card',
        notes: 'Payment + advance deposit for next shipment',
        dueDate: null,
        createdAt: new Date(now - 1 * oneDay).toISOString(),
        updatedAt: new Date(now - 1 * oneDay).toISOString(),
        isDeleted: false
      },

      // Tunde Bakare
      {
        id: 'tx_s8',
        customerId: 'cust_sample_4',
        type: 'credit',
        amount: 450.00,
        date: new Date(now - 3 * oneDay).toISOString(),
        paymentMethod: 'Goods/Services',
        notes: '30 Smart chargers & Audio headsets',
        dueDate: new Date(now + 5 * oneDay).toISOString(),
        createdAt: new Date(now - 3 * oneDay).toISOString(),
        updatedAt: new Date(now - 3 * oneDay).toISOString(),
        isDeleted: false
      }
    ];

    const sampleAuditLogs = [
      {
        id: 'aud_demo_1',
        action: 'CREATED',
        entityType: 'transaction',
        entityId: 'tx_s8',
        title: 'Gave $450.00 credit to Tunde Bakare',
        details: { summary: 'CREDIT: $450.00 via Goods/Services. Note: 30 Smart chargers & Audio headsets' },
        reason: 'New credit recorded',
        timestamp: new Date(now - 3 * oneDay).toISOString()
      },
      {
        id: 'aud_demo_2',
        action: 'CREATED',
        entityType: 'transaction',
        entityId: 'tx_s5',
        title: 'Received $850.00 payment from David Adeleke',
        details: { summary: 'PAYMENT: $850.00 via Cash. Note: Full balance settled in cash' },
        reason: 'Payment received',
        timestamp: new Date(now - 1 * oneDay).toISOString()
      },
      {
        id: 'aud_demo_3',
        action: 'EDITED',
        entityType: 'transaction',
        entityId: 'tx_s1',
        title: 'Edited transaction for Maria Santos (Bakery)',
        details: {
          changes: [
            { field: 'Amount', oldVal: '$320.00', newVal: '$350.00' },
            { field: 'Notes', oldVal: '8 Bags Flour', newVal: '10 Bags of Premium Wheat Flour (Invoice #204)' }
          ]
        },
        reason: 'Adjusted invoice quantity from 8 to 10 bags upon delivery confirmation',
        timestamp: new Date(now - 9 * oneDay).toISOString()
      }
    ];

    state.customers = sampleCustomers;
    state.transactions = sampleTransactions;
    state.auditLogs = sampleAuditLogs;
    state.activeCustomerId = sampleCustomers[0].id;

    Storage.set(STORAGE_KEYS.CUSTOMERS, state.customers);
    Storage.set(STORAGE_KEYS.TRANSACTIONS, state.transactions);
    Storage.set(STORAGE_KEYS.AUDIT_LOGS, state.auditLogs);

    UI.showToast('Sample store demo data loaded!', 'success');
    UI.refreshAll();
  }

  // =========================================================================
  // 7. BOOTSTRAP APPLICATION
  // =========================================================================
  function initApp() {
    state.customers = Storage.get(STORAGE_KEYS.CUSTOMERS, []);
    state.transactions = Storage.get(STORAGE_KEYS.TRANSACTIONS, []);
    state.auditLogs = Storage.get(STORAGE_KEYS.AUDIT_LOGS, []);

    if (state.customers.length > 0) {
      state.activeCustomerId = state.customers[0].id;
    } else {
      // Auto-load sample data on first launch so the user is immediately greeted with an active interface
      loadDemoData();
    }

    initEventBindings();
    UI.refreshAll();
  }

  // DOM Content Loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
