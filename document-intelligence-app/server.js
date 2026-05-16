require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');

const {
    connectDatabase,
    createTable,
    saveDocument,
    getDocumentHistory
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({ dest: 'uploads/' });

function getAzureConfig() {
    return {
        endpoint: process.env.AZURE_ENDPOINT?.replace(/\/$/, ''),
        key: process.env.AZURE_KEY
    };
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// MODEL SELECTOR
function getModel(type) {
    if (type === 'receipt') return 'prebuilt-receipt';
    if (type === 'id') return 'prebuilt-idDocument';
    return 'prebuilt-invoice';
}

app.post('/analyze', upload.single('document'), async (req, res) => {

    try {

        const type = req.body.type || 'invoice';
        const model = getModel(type);

        const azure = getAzureConfig();

        const file = fs.readFileSync(req.file.path);

        const response = await axios({
            method: 'post',
            url: `${azure.endpoint}/formrecognizer/documentModels/${model}:analyze?api-version=2023-07-31`,
            headers: {
                'Ocp-Apim-Subscription-Key': azure.key,
                'Content-Type': 'application/octet-stream'
            },
            data: file
        });

        const operationLocation = response.headers['operation-location'];

        let result;

        while (true) {

            await sleep(3000);

            const poll = await axios.get(operationLocation, {
                headers: {
                    'Ocp-Apim-Subscription-Key': azure.key
                }
            });

            result = poll.data;

            if (result.status === 'succeeded') break;
            if (result.status === 'failed') throw new Error('Analysis failed');
        }

        const fields = result.analyzeResult?.documents?.[0]?.fields || {};

        let documentData = {
            type,
            vendor: 'N/A',
            total: 'N/A',
            invoiceDate: 'N/A'
        };

        if (type === 'invoice') {
            documentData.vendor = fields.VendorName?.content || 'N/A';
            documentData.total = fields.InvoiceTotal?.content || 'N/A';
            documentData.invoiceDate = fields.InvoiceDate?.content || 'N/A';
        }

        if (type === 'receipt') {
            documentData.vendor = fields.MerchantName?.content || 'N/A';
            documentData.total = fields.Total?.content || 'N/A';
            documentData.invoiceDate = fields.TransactionDate?.content || 'N/A';
        }

        if (type === 'id') {
            documentData.vendor =
                (fields.FirstName?.content || '') +
                ' ' +
                (fields.LastName?.content || '');
            documentData.invoiceDate = fields.DateOfBirth?.content || 'N/A';
        }

        await saveDocument(documentData);

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            document: documentData
        });

    } catch (err) {

        console.log(err.response?.data || err.message);

        res.status(500).json({
            success: false,
            error: err.message || 'Analysis failed'
        });
    }
});

app.get('/history', async (req, res) => {
    const history = await getDocumentHistory();
    res.json({ success: true, history });
});

async function start() {
    await connectDatabase();
    await createTable();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

start();