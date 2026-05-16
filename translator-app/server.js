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

app.post('/translate', async (req, res) => {

    try {

        const text = req.body.text?.trim();

        const sourceLanguage =
            req.body.sourceLanguage || 'auto';

        const targetLanguage =
            req.body.targetLanguage || req.body.language;

        if (!text || !targetLanguage) {
            return res.status(400).json({
                error: 'Text and target language are required'
            });
        }

        if (
            !process.env.AZURE_ENDPOINT ||
            !process.env.AZURE_KEY ||
            !process.env.AZURE_REGION
        ) {
            return res.status(500).json({
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

            baseURL: process.env.AZURE_ENDPOINT.replace(/\/$/, ''),

            url: '/translate',

            method: 'post',

            params,

            headers: {

                'Ocp-Apim-Subscription-Key':
                    process.env.AZURE_KEY,

                'Ocp-Apim-Subscription-Region':
                    process.env.AZURE_REGION,

                'Content-Type': 'application/json'
            },

            data: [
                {
                    text: text
                }
            ]
        });

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
            translatedText,
            sourceLanguage: detectedLanguage,
            targetLanguage
        });

    } catch (error) {

        console.log(
            error.response?.data || error.message
        );

        res.status(500).json({
            error: 'Translation failed'
        });
    }
});

app.get('/history', async (req, res) => {

    try {

        const history = await getTranslationHistory();

        res.json(history);

    } catch (error) {

        console.log(error.message);

        res.status(500).json({
            error: 'Could not load translation history'
        });
    }
});

app.listen(PORT, () => {

    console.log(
        `Server running on port ${PORT}`
    );
});