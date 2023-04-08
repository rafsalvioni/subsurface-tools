
/**
 * Emulates a file download.
 * 
 * @param {string} content 
 * @param {string} fileName 
 * @param {string} contentType 
 */
export function download(content, fileName, contentType='text/xml')
{
    if (/^ERR/.test(content)) {
        alert('Invalid contents to download...');
        return;
    }
    const url = `data:${contentType};base64,` + btoa(content);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
}

/**
 * Checks if a values is a numeric value.
 * 
 * Numeric values are numbers, boolean and numeric strings.
 * 
 * @param {mixed} n 
 * @returns bool
 */
export function isNumeric(n)
{
    switch (typeof n) {
        case 'number':
        case 'boolean':
        case 'bigint':
            return true;
        case 'string':
            return !isNaN(Number(n));
        default:
            return false;
    }
}

/**
 * Creates a struct using a DOMElement
 * 
 * Example: <tag attr1='value1'>content<tag2/></tag>
 * Would be: {'@attr1':'value1', '*':'content', tag2:[{'*':null}]}
 * 
 * n defines how much tree depth the function should consider
 * 
 * @param {DOMElement} dom 
 * @param {int} n Depth
 * @returns object
 */
export function domToStruct(dom, n=0)
{
    let ret = {'*': null};
    for (const a of dom.attributes) {
        ret['@' + a.name.toLowerCase()] = a.value;
    }
    ret['*'] = dom.textContent;

    if (n > 0) {
        for (const c of dom.childNodes) {
            if (!c.tagName) {
                continue;
            }
            let k = c.tagName.toLowerCase();
            if (!ret[k]) {
                ret[k] = [];
            }
            ret[k].push(domToStruct(c, n - 1));
        }
    }
    return ret;
}

