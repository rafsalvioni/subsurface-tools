import { GpxReader } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function gpxToSsrf(gpx, divelog)
{
    for (const dive of divelog) {
        if (dive.isLocalized()) {
            continue;
        }
        let diveStart = dive.getStart();
        let pos = gpx.getPositionAt(diveStart);
        if (pos) {
            dive.setSpot(pos);
        }
    }
    for (const poi of gpx.eachPoi()) {
        divelog.getSites().getByPosition(poi, true);
    }
    return divelog.toString();
}

function process()
{
	let ssrfXml = document.getElementById('ssrf').value ?? '<divelog/>';
    let gpxXml  = document.getElementById('gpx').value ?? '<gpx/>';
	let output  = 'ERROR: GPX and SSRF required';
	try {
        if (gpxXml && ssrfXml) {
            output = gpxToSsrf(new GpxReader(gpxXml), new DiveLog(ssrfXml));
        }
	}
	catch (e) {
		output = `ERROR: ${e}`;
	}
	document.getElementById('output').value = output;
}

document.getElementById('ssrf').addEventListener('change', process);
document.getElementById('gpx').addEventListener('change', process);
document.getElementById('redo').addEventListener('click', process);
document.getElementById('download').addEventListener('click', () => {
	let contents = document.getElementById('output').value;
	download(contents, 'dives.ssrf');
});
