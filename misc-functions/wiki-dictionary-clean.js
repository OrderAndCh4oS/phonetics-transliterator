const fs = require('fs');
function loadFile(file) {
    try {
        let response = fs.readFileSync(`./${file}`, 'UTF-8');
        return response ||  null;
    } catch(e) {
        return null
    }
}

function writeFileAsync(fileName, dataStr) {
    return new Promise((resolve, reject) => {
        fs.writeFile(fileName, dataStr, (err) => {
            if(err) reject(err);
            resolve()
        });
    })

}

async function combineIpaAndWikiDictionaries() {
    const wiki = [
        // 'ita_phonetic.tsv',
        // 'rus_phonetic.tsv',
        // 'cze_phonetic.tsv',
        'lat_clas_phonetic.tsv',
        // 'por_po_phonetic.tsv',
        // 'dan_phonetic.tsv',
        // 'hun_phonetic.tsv',
        // 'yid_phonetic.tsv',
        // 'gre_phonetic.tsv',
    ];

    for (let i = 0; i < wiki.length; i++) {
        const [currentFileName] = wiki[i].split('.');
        const languageCode = currentFileName.replace(/_phonetic/, '');
        console.log('~~ ' + languageCode + ' ~~')
        const wResponse = loadFile('../found-data/wikipron-tsv/' + wiki[i]) || '';
        const wLines = wResponse.split(/\r?\n/).reduce((arr, line) => {
            let [word, translation] = line.split(/\t/);
            if(!word || !translation) return arr;
            arr.push([word, `/${translation.replace(/\s/g, '')}/`, 'wiki']);
            return arr;
        }, []);
        console.log(wLines.length)
        let dataStr = '';
        for(const wLine of wLines) {
            dataStr += wLine.join('\t') + '\n';
        }
        const fileName = `../combined-dictionaries/${languageCode}.txt`;
        await writeFileAsync(fileName, dataStr);
        console.log(`~~ fin ${languageCode} ~~`)
    }
}

combineIpaAndWikiDictionaries().then()

// Note: all langs required
// "de" = "German",
// "en" = "English UK",
// "en" = "English US",
// "it" = "Italian",
// "ru" = "Russian",
// "es" = "Spanish",
// "cz" = "Czech",
// "lt" = "Latin",
// "fr" = "French",
// "pt" = "Portuguese",
// "sv" = "Swedish",
// "cn" = "Chinese",
// "da" = "Danish",
// "hu" = "Hungarian",
// "no" = "Norwegian",
// "pl" = "Polish",
// "et" = "Estonian",
// "is" = "Icelandic",
// "fi" = "Finnish",
// "yi" = "Yiddish",
// "el" = "Greek"

// Todo: Find Missing Dicts
// "cn" = "Chinese",
// "no" = "Norwegian",
// "pl" = "Polish",
// "lt" = "Latin",
// "et" = "Estonian",

