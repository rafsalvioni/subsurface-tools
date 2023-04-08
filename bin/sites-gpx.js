import { GpxWriter } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function sitesToGpx(input)
{
    let divelog = new DiveLog(input);
    let gpx = new GpxWriter();
    
    for (const site of divelog.getSites()) {
        if (!site.point) {
            continue;
        }
        gpx.addWayPoint(site.point);
    }

    if (gpx.hasContents()) {
        return gpx.end();
    }
    throw 'No localized sites found';
}

function process()
{
    let input = document.getElementById('input').value;
    let output;
    try {
        output = sitesToGpx(input);
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
    download(contents, 'divesites.gpx');
});
