
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

export function domToStruct(dom, n=0)
{
    let ret = {_attr: {}};
    for (const a of dom.attributes) {
        ret._attr[a.name] = a.value;
    }
    if (n > 0) {
        for (const c of dom.childNodes) {
            let k = c.tagName;
            if (!ret[k]) {
                ret[k] = [];
            }
            ret[k].push(domToStruct(c, n - 1));
        }
    }
    return ret;
}

