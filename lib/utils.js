import './proto.js';

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
    let ret = {};
    for (const a of dom.attributes) {
        ret['@' + a.name.toLowerCase()] = a.value;
    }

    ret['*'] = dom.childNodes[0] && dom.childNodes[0].nodeType == 3 ?
        dom.childNodes[0].nodeValue.trim() : '';

    if (n > 0) {
        for (const c of dom.childNodes) {
            if (c.nodeType != 1) {
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

var identLevel = 0;
/**
 * Create a XML string from a object.
 * 
 * @see domToStruct()
 * @param {object} obj Source
 * @param {string} tagName Element's source
 * @returns string
 */
export function objToXml(obj, tagName)
{
    let ident  = '  '.repeat(identLevel);
    let xml    = `${ident}<${tagName}`;
    let text   = '';
    let childs = '';
    let node   = (typeof obj) == 'object';

    if (node) {
        for (const p in obj) {
            identLevel++;
            if (p.charAt(0) == '@') {
                let v = String(obj[p]).entitiesEncode();
                xml += ` ${p.substring(1)}="${v}"`;
            }
            else if (p == '*') {
                text = String(obj[p])
            }
            else if (obj[p] instanceof Array) {
                for (const c of obj[p]) {
                    childs += objToXml(c, p);
                }
            }
            else {
                childs += objToXml(obj[p], p);
            }
            identLevel--;
        }
    }
    else {
        text = String(obj);
    }
    if (childs) {
        xml += ">\n" + text.entitiesEncode() + childs + `${ident}</${tagName}>`;
    }
    else if (text) {
        xml += ">" + text.entitiesEncode() + `</${tagName}>`;
    }
    else {
        xml += " />";
    }
    xml += "\n";
    return xml;
}
