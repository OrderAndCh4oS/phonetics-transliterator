const fs = require('fs');

function loadFile(file) {
    try {
        let response = fs.readFileSync(`./${file}`, 'UTF-8');
        return response ||  null;
    } catch(e) {
        return null
    }
}

function makeIsoJson() {
    const response = loadFile('iso/iso-639-2-language-codes.tsv');
    if(!response) throw new Error('Not found response')
    const lines = response.split(/\r?\n/);
    const isoTwoLookup = {}
    const isoOneLookup = {}
    lines.shift()
    for(const line of lines) {
        const [isoTwo, isoOne, english, french, german] = line.split(/\t/);
        if(!isoTwo) continue
        if(isoTwo.includes('#')) {
            let [isoTwoA, isoTwoB] = isoTwo.split('#')
            isoTwoLookup[isoTwoA] = {'iso-639-2': isoTwoA, 'iso-639-1': isoOne || null, english, french, german}
            isoTwoLookup[isoTwoB] = {'iso-639-2': isoTwoB, 'iso-639-1': isoOne || null, english, french, german}
            if(isoOne) isoOneLookup[isoOne] = {'iso-639-2': [isoTwoA, isoTwoB], 'iso-639-1': isoOne, english, french, german}
        } else {
            isoTwoLookup[isoTwo] = {'iso-639-2': isoTwo, 'iso-639-1': isoOne || null, english, french, german}
            if(isoOne) isoOneLookup[isoOne] = {'iso-639-2': [isoTwo], 'iso-639-1': isoOne, english, french, german}
        }
    }
    fs.writeFile('./iso/iso-639-2-lookup.json', JSON.stringify(isoTwoLookup), () => {})
    fs.writeFile('./iso/iso-639-1-lookup.json', JSON.stringify(isoOneLookup), () => {})
}

makeIsoJson();

/**
 * "de" = "German",
 * "en" = "English",
 * "it" = "Italian",
 * "ru" = "Russian",
 * "es" = "Spanish",
 * "cz" = "Czech",
 * "lt" = "Latin",
 * "fr" = "French",
 * "pt" = "Portuguese",
 * "sv" = "Swedish",
 * "cn" = "Chinese",
 * "da" = "Danish",
 * "hu" = "Hungarian",
 * "no" = "Norwegian",
 * "pl" = "Polish",
 * "et" = "Estonian",
 * "is" = "Icelandic",
 * "fi" = "Finnish",
 * "yi" = "Yiddish",
 * "el" = "Greek"
 */
