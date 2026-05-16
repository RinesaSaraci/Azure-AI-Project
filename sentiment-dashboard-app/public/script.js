const totalReviews = document.getElementById('totalReviews');
const positiveCount = document.getElementById('positiveCount');
const negativeCount = document.getElementById('negativeCount');
const neutralCount = document.getElementById('neutralCount');
const entityList = document.getElementById('entityList');
const reviewsTable = document.getElementById('reviewsTable');
const searchInput = document.getElementById('searchInput');
const reviewInput = document.getElementById('reviewInput');
const analyzeButton = document.getElementById('analyzeButton');
const statusMessage = document.getElementById('statusMessage');

let allReviews = [];
let sentimentChart;
let phraseChart;

analyzeButton.addEventListener('click', analyzeReviews);

searchInput.addEventListener('input', () => {
    renderReviews(allReviews);
});

loadSampleReviews();

async function loadSampleReviews() {
    try {
        const response = await fetch('/api/sample-reviews');
        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.error || 'Sample reviews failed to load');
        }

        allReviews = data.reviews.map((review) => ({
            text: review.text,
            sentiment: review.sentiment
        }));

        reviewInput.value = allReviews
            .map((review) => review.text)
            .join('\n');

        renderSummary({
            totalReviews: allReviews.length,
            sentimentCounts: countLocalSentiments(allReviews)
        });
        renderReviews(allReviews);

        showStatus('Sample CSV reviews loaded. Click Analyze to call Azure.', 'info');
    } catch (error) {
        showStatus(error.message, 'error');
    }
}

async function analyzeReviews() {
    const texts = reviewInput.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (!texts.length) {
        showStatus('Please enter at least one review.', 'error');
        return;
    }

    setLoading(true);
    showStatus('Calling Azure AI Language...', 'info');

    try {
        const [sentimentData, keyPhraseData, entityData] = await Promise.all([
            postJson('/analyze-sentiment', { texts }),
            postJson('/extract-keyphrases', { texts }),
            postJson('/extract-entities', { texts })
        ]);

        allReviews = sentimentData.results.map((result) => ({
            text: result.text,
            sentiment: result.sentiment
        }));

        renderSummary({
            totalReviews: allReviews.length,
            sentimentCounts: sentimentData.sentimentCounts
        });
        renderSentimentChart(sentimentData.sentimentCounts);
        renderPhraseChart(keyPhraseData.phraseCounts);
        renderEntities(entityData.entityCounts);
        renderReviews(allReviews);

        showStatus('Azure analysis completed successfully.', 'success');
    } catch (error) {
        showStatus(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

async function postJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(data.details || data.error || 'Azure request failed');
    }

    return data;
}

function renderSummary(data) {
    totalReviews.innerText = data.totalReviews;
    positiveCount.innerText = data.sentimentCounts.Positive || 0;
    negativeCount.innerText = data.sentimentCounts.Negative || 0;
    neutralCount.innerText = data.sentimentCounts.Neutral || 0;
}

function renderSentimentChart(sentimentCounts) {
    const chartContext = document.getElementById('sentimentChart');

    if (sentimentChart) {
        sentimentChart.destroy();
    }

    sentimentChart = new Chart(chartContext, {
        type: 'doughnut',
        data: {
            labels: ['Positive', 'Negative', 'Neutral'],
            datasets: [
                {
                    data: [
                        sentimentCounts.Positive || 0,
                        sentimentCounts.Negative || 0,
                        sentimentCounts.Neutral || 0
                    ],
                    backgroundColor: ['#22c55e', '#ef4444', '#f59e0b']
                }
            ]
        }
    });
}

function renderPhraseChart(keyPhrases) {
    const chartContext = document.getElementById('phraseChart');

    if (phraseChart) {
        phraseChart.destroy();
    }

    phraseChart = new Chart(chartContext, {
        type: 'bar',
        data: {
            labels: keyPhrases.map((item) => item.name),
            datasets: [
                {
                    label: 'Frequency',
                    data: keyPhrases.map((item) => item.count),
                    backgroundColor: '#4f46e5'
                }
            ]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

function renderEntities(namedEntities) {
    if (!namedEntities.length) {
        entityList.innerHTML = '<p>No named entities found.</p>';
        return;
    }

    entityList.innerHTML = namedEntities.map((entity) => `
        <div class="entity-pill">
            <span>${entity.name}</span>
            <strong>${entity.count}</strong>
        </div>
    `).join('');
}

function countLocalSentiments(reviews) {
    const counts = {
        Positive: 0,
        Negative: 0,
        Neutral: 0
    };

    reviews.forEach((review) => {
        counts[review.sentiment] += 1;
    });

    return counts;
}

function setLoading(isLoading) {
    analyzeButton.disabled = isLoading;
    analyzeButton.innerText = isLoading
        ? 'Analyzing...'
        : 'Analyze with Azure AI Language';
}

function showStatus(message, type) {
    statusMessage.innerText = message;
    statusMessage.className = `status-message ${type}`;
}

function renderReviews(reviews) {
    const searchText = searchInput.value.toLowerCase();

    const filteredReviews = reviews.filter((review) =>
        review.text.toLowerCase().includes(searchText) ||
        review.sentiment.toLowerCase().includes(searchText)
    );

    reviewsTable.innerHTML = filteredReviews.map((review) => `
        <tr>
            <td>${review.text}</td>
            <td>
                <span class="sentiment ${review.sentiment.toLowerCase()}">
                    ${review.sentiment}
                </span>
            </td>
        </tr>
    `).join('');
}
