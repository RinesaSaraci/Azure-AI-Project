const languageNames = {
    auto: 'Detected automatically',
    en: 'English',
    fr: 'French',
    de: 'German',
    es: 'Spanish',
    it: 'Italian',
    sq: 'Albanian'
};

const textInput = document.getElementById('text');
const sourceLanguageSelect = document.getElementById('sourceLanguage');
const targetLanguageSelect = document.getElementById('targetLanguage');
const translateButton = document.getElementById('translateButton');
const resultText = document.getElementById('result');
const statusMessage = document.getElementById('statusMessage');
const historyList = document.getElementById('historyList');
const apiBaseUrl = getApiBaseUrl();

translateButton.addEventListener('click', translateText);

loadHistory();

async function translateText() {

    const text = textInput.value.trim();
    const sourceLanguage = sourceLanguageSelect.value;
    const targetLanguage = targetLanguageSelect.value;

    if (!text) {
        showStatus('Please enter text before translating.', 'error');
        return;
    }

    setLoading(true);
    showStatus('Translating with Azure Translator...', 'info');

    try {

        const response = await fetch(getApiUrl('/translate'), {

            method: 'POST',

            headers: {
                'Content-Type': 'application/json'
            },

            body: JSON.stringify({
                text,
                sourceLanguage,
                targetLanguage
            })
        });

        const data = await readJsonResponse(response);

        if (!response.ok || data.success === false) {
            throw new Error(data.details || data.error || 'Translation failed');
        }

        resultText.innerText = data.translatedText;

        showStatus('Translation completed and saved to history.', 'success');

        await loadHistory();

    } catch (error) {

        resultText.innerText = 'Your translation will appear here.';
        showStatus(error.message, 'error');

    } finally {

        setLoading(false);
    }
}

async function loadHistory() {

    try {

        const response = await fetch(getApiUrl('/history'));
        const data = await readJsonResponse(response);

        if (!response.ok || data.success === false) {
            throw new Error(data.error || 'Could not load translation history');
        }

        const history = Array.isArray(data) ? data : data.history;

        renderHistory(history);

    } catch (error) {

        historyList.innerHTML = `
            <p class="empty-state">
                Translation history is not available right now.
            </p>
        `;
    }
}

function getApiBaseUrl() {

    const isServedByBackend =
        window.location.hostname === 'localhost' &&
        window.location.port === '3000';

    if (isServedByBackend) {
        return '';
    }

    // This keeps the app working if index.html is opened from a preview server.
    return 'http://localhost:3000';
}

function getApiUrl(path) {

    return `${apiBaseUrl}${path}`;
}

async function readJsonResponse(response) {

    const text = await response.text();

    if (!text) {
        return {};
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Server returned an invalid JSON response');
    }
}

function renderHistory(history) {

    if (!history || !history.length) {
        historyList.innerHTML =
            '<p class="empty-state">No translations saved yet.</p>';
        return;
    }

    historyList.innerHTML = history.map((item) => {
        const sourceName =
            languageNames[item.source_language] || item.source_language;

        const targetName =
            languageNames[item.target_language] || item.target_language;

        return `
            <article class="history-item">
                <div>
                    <p class="history-languages">
                        ${sourceName} to ${targetName}
                    </p>
                    <p class="history-original">${escapeHtml(item.original_text)}</p>
                    <p class="history-translated">${escapeHtml(item.translated_text)}</p>
                </div>
                <time>${formatDate(item.created_at)}</time>
            </article>
        `;
    }).join('');
}

function setLoading(isLoading) {

    translateButton.disabled = isLoading;
    translateButton.innerText = isLoading ? 'Translating...' : 'Translate';
}

function showStatus(message, type) {

    statusMessage.innerText = message;
    statusMessage.className = `status-message ${type}`;
}

function formatDate(dateValue) {

    return new Date(dateValue).toLocaleString();
}

// History entries come from user input, so escape them before inserting HTML.
function escapeHtml(value) {

    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}