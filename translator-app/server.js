require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const {
    saveTranslation,
    getTranslationHistory
} = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());

app.use(express.static('public'));

function getAzureConfig() {
    return {
        endpoint: process.env.AZURE_ENDPOINT?.replace(/\/$/, ''),
        key: process.env.AZURE_KEY,
        region: process.env.AZURE_REGION
    };
}

function isAzureConfigValid(config) {
    return Boolean(
        config.endpoint &&
        config.key &&
        config.region &&
        config.endpoint.startsWith('https://')
    );
}

app.post('/translate', async (req, res) => {

    try {

        const text = req.body.text?.trim();

        const sourceLanguage =
            req.body.sourceLanguage || 'auto';

        const targetLanguage =
            req.body.targetLanguage || req.body.language;

        if (!text || !targetLanguage) {
            return res.status(400).json({
                success: false,
                error: 'Text and target language are required'
            });
        }

        const azureConfig = getAzureConfig();

        console.log('Azure Translator config check:', {
            endpoint: azureConfig.endpoint,
            hasKey: Boolean(azureConfig.key),
            region: azureConfig.region
        });

        if (!isAzureConfigValid(azureConfig)) {
            return res.status(500).json({
                success: false,
                error: 'Azure Translator environment variables are missing'
            });
        }

        const params = {
            'api-version': '3.0',
            'to': targetLanguage
        };

        if (sourceLanguage !== 'auto') {
            params.from = sourceLanguage;
        }

        const response = await axios({

            baseURL: azureConfig.endpoint,

            url: '/translate',

            method: 'post',

            params,

            headers: {

                'Ocp-Apim-Subscription-Key':
                    azureConfig.key,

                'Ocp-Apim-Subscription-Region':
                    azureConfig.region,

                'Content-Type': 'application/json'
            },

            data: [
                {
                    Text: text
                }
            ]
        });

        console.log('Azure Translator response status:', response.status);

        const translatedText =
            response.data[0]
            .translations[0]
            .text;

        const detectedLanguage =
            response.data[0].detectedLanguage?.language ||
            sourceLanguage;

        await saveTranslation({
            originalText: text,
            translatedText,
            sourceLanguage: detectedLanguage,
            targetLanguage
        });

        res.json({
            success: true,
            translatedText,
            sourceLanguage: detectedLanguage,
            targetLanguage
        });

    } catch (error) {

        const statusCode = error.response?.status || 500;
        const azureError =
            error.response?.data?.error?.message ||
            error.response?.data?.message ||
            error.message ||
            'Translation failed';

        console.log('Azure Translator error status:', statusCode);
        console.log('Azure Translator error message:', azureError);

        res.status(statusCode).json({
            success: false,
            error: 'Translation failed',
            details: azureError
        });
    }
});

app.get('/history', async (req, res) => {

    try {

        const history = await getTranslationHistory();

        res.json({
            success: true,
            history
        });

    } catch (error) {

        console.log(error.message);

        res.status(500).json({
            success: false,
            error: 'Could not load translation history'
        });
    }
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return res.status(400).json({
            success: false,
            error: 'Invalid JSON request body'
        });
    }

    next(error);
});

const server = app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});

server.on('error', (error) => {
    console.error('Server failed to start:', error.message);
    process.exit(1);
});

server.on('close', () => {
    console.log('Server closed');
});