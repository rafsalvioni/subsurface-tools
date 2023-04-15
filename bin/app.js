import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';
import './ssrf-compact.js';
import './timezone.js';
import './fix-serial.js';
import './fix-salinity.js';
import './gpx-merge-ssrf.js';
import './sites-gpx.js';
import './dives-gpx.js';
import './date-detail.js';

/**
 * Emulates a file download.
 * 
 * @param {string} content 
 * @param {string} fileName 
 * @param {string} contentType 
 */
function download(content, fileName, contentType='text/xml')
{
    if (/^text\//i.test(contentType)) {
        content = unescape(encodeURIComponent(content));
        contentType += ';charset=utf-8';
    }
    const url = `data:${contentType};base64,` + btoa(content);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = fileName;
    a.click();
}

function loadFile(file, fLoad)
{
    const fr = new FileReader();
    fr.addEventListener('load', fLoad);
    fr.readAsText(file);
}

class App
{
    #diveLog;
    #file;

    constructor()
    {
        const ssrfFile = document.getElementById('ssrf');
        var me = this;
        ssrfFile.addEventListener('change', (e) => {
            me.#file = ssrfFile.files[0];
            me.#loadSsrf(me.#file);
        });
        document.getElementById('download').addEventListener('click', (e) => {
            me.download();
        });
    }

    getDiveLog()
    {
        return this.#diveLog;
    }

    get fileName()
    {
        return this.#file ? this.#file.name : null;
    }

    download()
    {
        if (this.#diveLog) {
            let name = this.fileName;
            download(this.#diveLog.toString(), name, 'text/xml');
            this.#diveLog = null;
            this.#file = null;
            this.#showOperations(false);
        }
        else {
            this.error('No SSRF loaded');
        }
    }

    error(m)
    {
        alert(`ERROR: ${m}`);
    }

    #loadSsrf(file)
    {
        loadFile(file, (e) => {
            try {
                this.#diveLog = new DiveLog(e.target.result);
                this.#showOperations(true);
            } catch (e) {
                this.error(e);
                this.#showOperations(false);
            }
        });
    }

    #showOperations(set)
    {
        let ops = document.querySelectorAll('.ssrf-operation');
        for (const op of ops) {
            if (set) {
                op.classList.remove('hidden');
            }
            else {
                op.classList.add('hidden');
            }
        }
    }
}

const app = new App();
export {app, loadFile, download};