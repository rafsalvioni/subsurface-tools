import { GpxWriter } from '../lib/gpx.js';
import { download } from '../lib/utils.js';
import { app } from './app.js';

function divesToGpx(sample)
{
    let divelog = app.getDiveLog();
    let gpx = new GpxWriter();

    for (const dive of divelog) {
        let num = dive.getNum();
        if (!dive.isLocalized()) {
            console.log(`Dive: ${num} without localization`);
            continue;
        }

        let dur   = dive.getDuration();
        let n     = Math.ceil(dur / sample); // How many tracks need?
        sample    = Math.ceil(dur / n); // Adjust sample to better distribution
        let site  = dive.getSpot();
        let dt    = dive.getStart();
        let grp   = `Dive #${num}`;
        let depth = dive.getDepth();
        gpx.addWayPoint(site);

        gpx.addPos(site, dt, grp); // Adds entry point
        while (dur > 0) {
            let t    = Math.min(sample, dur); // Time to add
            console.log(grp, n--, dur, t);
            dt       = new Date(dt.getTime() + t * 1000); // New instant
            let dc   = dive.getSampleAt(dt); // Try to get DC's sample at instant
            let d    = dc ? Math.rounds(dc.depth, 2) : depth.mean; // Depth at instant
            let spot = Object.assign({}, site, {alt: site.alt - d}); // Clone site using depth
            gpx.addPos(spot, dt, grp); // Adds a track point
            dur     -= t;
        }
    }
    if (gpx.hasContents()) {
        return gpx;
    }
    throw 'No localized dives found';
}

function process()
{
    try {
        let gpx = divesToGpx(900);
        download(gpx.end(), 'dives.gpx', 'text/xml');
    }
    catch (e) {
        app.error(e);
    }
}

document.getElementById('op-dives-gpx').addEventListener('click', process);
