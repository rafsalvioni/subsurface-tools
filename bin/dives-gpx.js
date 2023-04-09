import { GpxWriter } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function divesToGpx(input, sample)
{
    let divelog = new DiveLog(input);
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
        return gpx.end();
    }
    throw 'No localized dives found';
}

function process()
{
    let input = document.getElementById('input').value;
    let output;
    try {
        output = divesToGpx(input, 900, '-0300');
    }
    catch (e) {
        output = `ERROR: ${e}`;
    }
    document.getElementById('output').value = output;
}

document.getElementById('input').addEventListener('change', process);
document.getElementById('redo').addEventListener('click', process);
document.getElementById('download').addEventListener('click', () => {
    let contents = document.getElementById('output').value;
    download(contents, 'dives.gpx');
});
