async function analyzeDocument() {

    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    const type = document.getElementById('docType').value;

    if (!file) {
        alert('Please select a document');
        return;
    }

    document.getElementById('loading').style.display = 'block';

    const formData = new FormData();
    formData.append('document', file);
    formData.append('type', type);

    const response = await fetch('/analyze', {
        method: 'POST',
        body: formData
    });

    const data = await response.json();

    document.getElementById('loading').style.display = 'none';

    if (!data.success) {
        document.getElementById('result').innerHTML =
            `<p>${data.error}</p>`;
        return;
    }

    const doc = data.document;

    let html = `
        <div class="card">
            <h2>Analysis Result</h2>
    `;

    // ALWAYS show type
    html += `
        <h3>Type</h3>
        <p>${doc.type}</p>
    `;

    // show vendor/name if exists
    if (doc.vendor && doc.vendor !== 'N/A') {
        html += `
            <h3>Vendor / Name</h3>
            <p>${doc.vendor}</p>
        `;
    }

    // show total ONLY for invoice/receipt
    if (doc.type !== 'id' && doc.total && doc.total !== 'N/A') {
        html += `
            <h3>Total Amount</h3>
            <p>${doc.total}</p>
        `;
    }

    // show date if exists
    if (doc.invoiceDate && doc.invoiceDate !== 'N/A') {
        html += `
            <h3>Date</h3>
            <p>${doc.invoiceDate}</p>
        `;
    }

    html += `</div>`;

    document.getElementById('result').innerHTML = html;
}


// HISTORY (unchanged but safe)
async function loadHistory() {

    const response = await fetch('/history');
    const data = await response.json();

    let historyHTML = '<h2>Document History</h2>';

    data.history.forEach(item => {

        historyHTML += `
            <div class="history-card">

                <p><strong>Type:</strong> ${item.type}</p>

                <p><strong>Vendor:</strong> ${item.vendor}</p>

                <p><strong>Total:</strong> ${item.total}</p>

                <p><strong>Date:</strong> ${item.invoiceDate}</p>

            </div>
        `;
    });

    document.getElementById('history').innerHTML = historyHTML;
}