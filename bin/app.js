import { DiveLog } from '../lib/ssrf.js';
import './ssrf-compact.js';
import './timezone.js';
import './fix-serial.js';
import './fix-salinity.js';
import './gpx-merge-ssrf.js';
import './sites-gpx.js';
import './dives-gpx.js';
import { download } from '../lib/utils.js';

function loadFile(file, fLoad)
{
    const fr = new FileReader();
    fr.addEventListener('load', fLoad);
    fr.readAsText(file);
}

class App
{
    #diveLog;

    constructor()
    {
        const ssrfFile = document.getElementById('ssrf');
        var me = this;
        ssrfFile.addEventListener('change', (e) => {
            me.#loadSsrf(ssrfFile.files[0]);
        });
        document.getElementById('download').addEventListener('click', (e) => {
            me.download();
        });
    }

    getDiveLog()
    {
        return this.#diveLog;
    }

    download()
    {
        if (this.#diveLog) {
            let name = document.getElementById('ssrf').files[0].name;
            download(this.#diveLog.toString(), name, 'text/xml');
            this.#diveLog = null;
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
export {app, loadFile};