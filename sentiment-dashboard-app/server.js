require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const csv = require('csv-parser');
const {
    AzureKeyCredential,
    TextAnalyticsClient
} = require('@azure/ai-text-analytics');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data', 'reviews.csv');
const MAX_DOCUMENTS_PER_REQUEST = 10;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/sample-reviews', async (req, res) => {
    try {
        const reviews = await loadReviews();

        res.json({
            success: true,
            reviews
        });
    } catch (error) {
        console.log('Sample reviews error:', error.message);

        res.status(500).json({
            success: false,
            error: 'Could not load sample reviews'
        });
    }
});

app.post('/analyze-sentiment', async (req, res) => {
    try {
        const documents = getDocumentsFromRequest(req);
        const client = getLanguageClient();
        const results = await runInBatches(
            documents,
            (batch) => client.analyzeSentiment(batch)
        );

        res.json({
            success: true,
            sentimentCounts: getSentimentCounts(results),
            results: results.map((result) => ({
                id: result.id,
                text: documents.find((document) => document.id === result.id).text,
                sentiment: formatSentiment(result.sentiment),
                confidenceScores: result.confidenceScores
            }))
        });
    } catch (error) {
        sendError(res, error, 'Sentiment analysis failed');
    }
});

app.post('/extract-keyphrases', async (req, res) => {
    try {
        const documents = getDocumentsFromRequest(req);
        const client = getLanguageClient();
        const results = await runInBatches(
            documents,
            (batch) => client.extractKeyPhrases(batch)
        );

        const keyPhrases = results.flatMap((result) => result.keyPhrases || []);

        res.json({
            success: true,
            keyPhrases,
            phraseCounts: countValues(keyPhrases)
        });
    } catch (error) {
        sendError(res, error, 'Key phrase extraction failed');
    }
});

app.post('/extract-entities', async (req, res) => {
    try {
        const documents = getDocumentsFromRequest(req);
        const client = getLanguageClient();
        const results = await runInBatches(
            documents,
            (batch) => client.recognizeEntities(batch)
        );

        const entities = results.flatMap((result) =>
            (result.entities || []).map((entity) => ({
                text: entity.text,
                category: entity.category,
                subCategory: entity.subCategory,
                confidenceScore: entity.confidenceScore
            }))
        );

        res.json({
            success: true,
            entities,
            entityCounts: countValues(entities.map((entity) => entity.text))
        });
    } catch (error) {
        sendError(res, error, 'Entity extraction failed');
    }
});

function loadReviews() {
    return new Promise((resolve, reject) => {
        const reviews = [];

        fs.createReadStream(DATA_FILE)
            .pipe(csv())
            .on('data', (row) => {
                reviews.push({
                    text: row.review_text,
                    sentiment: normalizeSentiment(row.sentiment)
                });
            })
            .on('end', () => resolve(reviews))
            .on('error', reject);
    });
}

function getLanguageClient() {
    const endpoint = process.env.LANGUAGE_ENDPOINT?.replace(/\/$/, '');
    const key = process.env.LANGUAGE_KEY;

    if (!endpoint || !key) {
        const error = new Error('LANGUAGE_ENDPOINT and LANGUAGE_KEY are required');
        error.statusCode = 500;
        throw error;
    }

    return new TextAnalyticsClient(
        endpoint,
        new AzureKeyCredential(key)
    );
}

function getDocumentsFromRequest(req) {
    const inputTexts = Array.isArray(req.body.texts)
        ? req.body.texts
        : String(req.body.text || '')
            .split(/\r?\n/)
            .map((line) => line.trim());

    const documents = inputTexts
        .filter(Boolean)
        .map((text, index) => ({
            id: String(index + 1),
            language: 'en',
            text
        }));

    if (!documents.length) {
        const error = new Error('Please provide at least one review or text value');
        error.statusCode = 400;
        throw error;
    }

    return documents;
}

async function runInBatches(documents, azureCall) {
    const allResults = [];

    for (let index = 0; index < documents.length; index += MAX_DOCUMENTS_PER_REQUEST) {
        const batch = documents.slice(index, index + MAX_DOCUMENTS_PER_REQUEST);
        const results = await azureCall(batch);
        allResults.push(...results);
    }

    const failedResult = allResults.find((result) => result.error);

    if (failedResult) {
        const error = new Error(failedResult.error.message);
        error.statusCode = 400;
        throw error;
    }

    return allResults;
}

function getSentimentCounts(results) {
    const counts = {
        Positive: 0,
        Negative: 0,
        Neutral: 0,
        Mixed: 0
    };

    results.forEach((result) => {
        counts[formatSentiment(result.sentiment)] += 1;
    });

    return counts;
}

function countValues(values) {
    const counts = {};

    values.forEach((value) => {
        counts[value] = (counts[value] || 0) + 1;
    });

    return Object.entries(counts)
        .sort((first, second) => second[1] - first[1])
        .slice(0, 12)
        .map(([name, count]) => ({
            name,
            count
        }));
}

function formatSentiment(sentiment) {
    return sentiment.charAt(0).toUpperCase() + sentiment.slice(1);
}

function normalizeSentiment(sentiment) {
    const value = sentiment?.trim().toLowerCase();

    if (value === 'positive') {
        return 'Positive';
    }

    if (value === 'negative') {
        return 'Negative';
    }

    return 'Neutral';
}

function sendError(res, error, fallbackMessage) {
    console.log(`${fallbackMessage}:`, error.message);

    res.status(error.statusCode || 500).json({
        success: false,
        error: fallbackMessage,
        details: error.message
    });
}

const server = app.listen(PORT, () => {
    console.log(`Sentiment dashboard running on port ${PORT}`);
});

server.on('error', (error) => {
    console.error('Server failed to start:', error.message);
    process.exit(1);
});
