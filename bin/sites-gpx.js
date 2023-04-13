import { GpxWriter } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';
import { app } from './app.js';

function sitesToGpx()
{
    let divelog = app.getDiveLog();
    let gpx = new GpxWriter();
    
    for (const site of divelog.getSites()) {
        if (!site.isLocalized()) {
            continue;
        }
        gpx.addWayPoint(site.getPoint());
    }

    if (gpx.hasContents()) {
        return gpx;
    }
    throw 'No localized sites found';
}

function process()
{
    try {
        let gpx = sitesToGpx();
        download(gpx.end(), 'sites.gpx', 'text/xml');
    }
    catch (e) {
        app.error(e);
    }
}

document.getElementById('op-sites-gpx').addEventListener('click', process);
