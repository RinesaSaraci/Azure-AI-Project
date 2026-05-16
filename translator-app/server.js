require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static('public'));

app.post('/translate', async (req, res) => {

    try {

        const text = req.body.text;

        const language = req.body.language;

        const response = await axios({

            baseURL: process.env.AZURE_ENDPOINT,

            url: '/translate',

            method: 'post',

            params: {
                'api-version': '3.0',
                'to': language
            },

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

        res.json({
            translatedText
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

app.listen(3000, () => {

    console.log(
        'Server running on port 3000'
    );
});