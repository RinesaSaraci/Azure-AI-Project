async function translateText(){

    const text =
        document.getElementById('text').value;

    const language =
        document.getElementById('language').value;

    const response = await fetch('/translate', {

        method:'POST',

        headers:{
            'Content-Type':'application/json'
        },

        body:JSON.stringify({
            text:text,
            language:language
        })
    });

    const data = await response.json();

    document.getElementById('result')
        .innerText = data.translatedText;
}