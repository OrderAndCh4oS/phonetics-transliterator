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
    const translations = [
        'de.txt',
        'en_UK.txt',
        'en_US.txt',
        'es_ES.txt',
        'fr_FR.txt',
        'sv.txt',
        'is.txt',
        'fi.txt'
    ];

    const wiki = [
        'ger_phonetic.tsv',
        'eng_uk_phonetic.tsv',
        'eng_us_phonetic.tsv',
        'spa_ca_phonetic.tsv',
        'fre_phonetic.tsv',
        'swe_phonetic.tsv',
        'ice_phonetic.tsv',
        'fin_phonetic.tsv'
    ];

    for (let i = 0; i < translations.length; i++) {
        const [languageCode] = translations[i].split('.');
        console.log('~~ ' + languageCode + ' ~~')
        const tResponse = loadFile('../found-data/translations/' + translations[i]) || '';
        const wResponse = loadFile('../found-data/wikipron-tsv/' + wiki[i]) || '';
        if(!tResponse) throw new Error('Not found response');
        const tLines = tResponse.split(/\r?\n/).map(line => {
            const [word, translation] = line.split(/\t/)
            return [word, translation, 'ipa'];
        });
        const wLines = wResponse.split(/\r?\n/).reduce((arr, line) => {
            let [word, translation] = line.split(/\t/)
            if(!translation) return arr;
            translation = `/${translation.replace(/\s/g, '')}/`;
            arr.push([word, translation, 'wiki']);
            return arr;
        }, []);
        console.log(tLines.length, wLines.length)
        const wLinesToAdd = [];
        for(const [word, ...rest] of wLines) {
            if(tLines.find(t => t[0] === word)) continue;
            wLinesToAdd.push([word, ...rest])
        }
        let dataStr = '';
        for(const tLine of tLines) {
            dataStr += tLine.join('\t') + '\n';
        }
        for(const wLine of wLinesToAdd) {
            dataStr += wLine.join('\t') + '\n';
        }
        const fileName = `../combined-dictionaries/${languageCode}.txt`;
        await writeFileAsync(fileName, dataStr);
        console.log(`~~ fin ${languageCode} ~~`)
    }
}

combineIpaAndWikiDictionaries().then()

// Note: all
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
// "it" = "Italian",
// "ru" = "Russian",
// "cz" = "Czech",
// "lt" = "Latin",
// "fr" = "French",
// "pt" = "Portuguese",
// "cn" = "Chinese",
// "da" = "Danish",
// "hu" = "Hungarian",
// "no" = "Norwegian",
// "pl" = "Polish",
// "et" = "Estonian",
// "yi" = "Yiddish",
// "el" = "Greek"
