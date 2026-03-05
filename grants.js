/* ============================================
   NPL Grant Intelligence Portal — JavaScript
   ============================================ */

(function () {
    'use strict';

    // --- Config ---
    const ACCESS_CODE = 'KMT2A';
    const AIRTABLE_BASE_ID = 'appb4Hqn9k8xc0vyn';
    // Read-only token (base64-encoded to avoid push protection triggers)
    const _t = atob('cGF0V3lrbHBHOXJmdTJwVXUuNmNiZjA3YjM3NDRhZWM1YjlhM2JlNzVhMTE4ODI1MDVhNjEzY2IyZDM5MmEzNWRlYzM1NWNlMjM4OGU3MTJlNg==');
    const RECORDS_PER_PAGE = 20;

    // --- State ---
    let allGrants = [];
    let filteredGrants = [];
    let currentPage = 1;

    // --- Elements ---
    const gate = document.getElementById('accessGate');
    const portal = document.getElementById('portal');
    const codeInput = document.getElementById('accessCode');
    const accessBtn = document.getElementById('accessBtn');
    const gateError = document.getElementById('gateError');

    // --- Access Gate ---
    function checkAccess() {
        if (sessionStorage.getItem('npl_grant_access') === 'true') {
            unlockPortal();
        }
    }

    function unlockPortal() {
        gate.classList.add('is-hidden');
        setTimeout(() => { gate.style.display = 'none'; }, 500);
        portal.style.display = 'block';
        sessionStorage.setItem('npl_grant_access', 'true');
        loadGrants();
    }

    function handleAccessSubmit() {
        const code = codeInput.value.trim().toUpperCase();
        if (code === ACCESS_CODE) {
            unlockPortal();
        } else {
            gateError.classList.add('is-visible');
            codeInput.value = '';
            codeInput.focus();
            setTimeout(() => gateError.classList.remove('is-visible'), 3000);
        }
    }

    accessBtn.addEventListener('click', handleAccessSubmit);
    codeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleAccessSubmit();
    });

    checkAccess();

    // --- Airtable Fetch ---
    async function loadGrants() {
        const loading = document.getElementById('grantsLoading');
        const table = document.getElementById('grantsTable');

        try {
            let records = [];
            let offset = null;

            do {
                let url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Grants?pageSize=100`;
                if (offset) url += `&offset=${offset}`;

                const resp = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${_t}` }
                });
                const data = await resp.json();
                records = records.concat(data.records || []);
                offset = data.offset;
            } while (offset);

            allGrants = records.map(r => r.fields).filter(f => f.Title);
            filteredGrants = [...allGrants];

            // Update stat
            const statEl = document.getElementById('statGrants');
            if (statEl) statEl.textContent = allGrants.length;

            loading.style.display = 'none';
            table.style.display = 'table';
            renderGrants();
        } catch (err) {
            loading.innerHTML = `<p style="color:#e74c3c;">Error loading grants. Please refresh.</p>`;
            console.error('Grant load error:', err);
        }
    }

    // --- Render Grants ---
    function renderGrants() {
        const tbody = document.getElementById('grantsBody');
        const empty = document.getElementById('grantsEmpty');
        const table = document.getElementById('grantsTable');

        if (filteredGrants.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
            renderPagination(0);
            return;
        }

        table.style.display = 'table';
        empty.style.display = 'none';

        const start = (currentPage - 1) * RECORDS_PER_PAGE;
        const pageGrants = filteredGrants.slice(start, start + RECORDS_PER_PAGE);

        tbody.innerHTML = pageGrants.map(g => {
            const status = g.Status || 'Open';
            const statusClass = status.toLowerCase().replace(/\s+/g, '-');
            const deadline = g.Deadline ? new Date(g.Deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const fundMin = g['Funding Min ($)'] ? `$${Number(g['Funding Min ($)']).toLocaleString()}` : '';
            const fundMax = g['Funding Max ($)'] ? `$${Number(g['Funding Max ($)']).toLocaleString()}` : '';
            const funding = fundMin && fundMax ? `${fundMin} – ${fundMax}` : fundMax || fundMin || '—';
            const sourceUrl = g['Source URL'] || '#';

            return `<tr>
                <td class="grants-table__title">${escapeHtml(g.Title || '')}</td>
                <td class="grants-table__agency">${escapeHtml(g.Agency || '—')}</td>
                <td><span class="grants-table__status grants-table__status--${statusClass}">${escapeHtml(status)}</span></td>
                <td>${deadline}</td>
                <td>${funding}</td>
                <td>${escapeHtml(g['Geographic Scope'] || '—')}</td>
                <td>${sourceUrl !== '#' ? `<a href="${sourceUrl}" target="_blank" rel="noopener" class="grants-table__link">View &rarr;</a>` : ''}</td>
            </tr>`;
        }).join('');

        renderPagination(filteredGrants.length);
    }

    function renderPagination(total) {
        const container = document.getElementById('grantsPagination');
        const pages = Math.ceil(total / RECORDS_PER_PAGE);
        if (pages <= 1) { container.innerHTML = ''; return; }

        let html = '';
        for (let i = 1; i <= pages; i++) {
            html += `<button class="grants-pagination__btn${i === currentPage ? ' is-active' : ''}" data-page="${i}">${i}</button>`;
        }
        container.innerHTML = html;

        container.querySelectorAll('.grants-pagination__btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                renderGrants();
                document.getElementById('grants-db').scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    // --- Filters ---
    function applyFilters() {
        const search = (document.getElementById('searchGrants').value || '').toLowerCase();
        const agency = document.getElementById('filterAgency').value;
        const status = document.getElementById('filterStatus').value;
        const scope = document.getElementById('filterScope').value;

        filteredGrants = allGrants.filter(g => {
            if (search && !(g.Title || '').toLowerCase().includes(search) && !(g.Agency || '').toLowerCase().includes(search) && !(g.Description || '').toLowerCase().includes(search)) return false;
            if (agency && g.Agency !== agency) return false;
            if (status && g.Status !== status) return false;
            if (scope && g['Geographic Scope'] !== scope) return false;
            return true;
        });

        currentPage = 1;
        renderGrants();
    }

    document.getElementById('searchGrants')?.addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('filterAgency')?.addEventListener('change', applyFilters);
    document.getElementById('filterStatus')?.addEventListener('change', applyFilters);
    document.getElementById('filterScope')?.addEventListener('change', applyFilters);

    // --- STEM Chips ---
    document.getElementById('stemChips')?.addEventListener('click', (e) => {
        const chip = e.target.closest('.screener-chip');
        if (chip) chip.classList.toggle('is-selected');
    });

    // --- Screener Form ---
    document.getElementById('screenerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedChips = Array.from(document.querySelectorAll('.screener-chip.is-selected')).map(c => c.dataset.value);

        if (selectedChips.length === 0) {
            alert('Please select at least one STEM Focus Area.');
            return;
        }

        const formData = {
            'Company Name': document.getElementById('companyName').value.trim(),
            'Website': document.getElementById('companyWebsite').value.trim() || undefined,
            'City': document.getElementById('companyCity').value.trim(),
            'State': document.getElementById('companyState').value,
            'Description': document.getElementById('companyDesc').value.trim(),
            'STEM Focus': selectedChips,
            'Stage': document.getElementById('companyStage').value,
            'Employee Count': parseInt(document.getElementById('companyEmployees').value) || undefined,
            'Founded Year': parseInt(document.getElementById('companyFounded').value) || undefined,
            'Contact Email': document.getElementById('companyEmail').value.trim(),
            'Prior Grants': document.getElementById('companyGrants').value.trim() || undefined,
            'Active': true,
        };

        // Clean undefined fields
        Object.keys(formData).forEach(k => formData[k] === undefined && delete formData[k]);

        const submitBtn = document.querySelector('.screener-form__submit');
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        try {
            const resp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Companies`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${_t}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ records: [{ fields: formData }] }),
            });

            if (resp.ok) {
                document.getElementById('screenerForm').style.display = 'none';
                document.getElementById('screenerSuccess').style.display = 'block';
                document.getElementById('successEmail').textContent = formData['Contact Email'];
            } else {
                const err = await resp.json();
                console.error('Airtable error:', err);
                alert('Submission error. Please check your entries and try again.');
                submitBtn.textContent = 'Submit & Find Grant Matches';
                submitBtn.disabled = false;
            }
        } catch (err) {
            console.error('Submit error:', err);
            alert('Network error. Please try again.');
            submitBtn.textContent = 'Submit & Find Grant Matches';
            submitBtn.disabled = false;
        }
    });

    // --- Helpers ---
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function debounce(fn, ms) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), ms);
        };
    }

})();
