import { GpxReader } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

var first;

function dateFusion(date, gpx, divelog)
{
    let fus = {
        'dateTime': date.toISOString(),
        'lat':   null, 'lon':  null, 'alt': null, 'name': null,
        'depth': null, 'temp': null
    };
    let tmp;
    let pos = false;
    if (gpx && (tmp = gpx.getPositionAt(date))) {
        Object.assign(fus, tmp);
        pos = true;
    }
    if (divelog && (tmp = divelog.getDiveAt(date))) {
        let s = tmp.getSampleAt(date);
        delete(s['time']);
        Object.assign(fus, s);
        if (!pos && tmp.isLocalized()) {
            Object.assign(fus, tmp.getSpot());
        }
    }
    if (first) {
        let keys = ['DateTime', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'SpotName', 'WaterDepth', 'Temperature'];
        return toCsv(keys, "\t") + toCsv(fus, "\t");
    }
    return toCsv(fus, "\t");
}

function toCsv(objLine, delim=",")
{
    let line = [];
    for (const k in objLine) {
        let v;
        switch (typeof objLine[k]) {
            case 'number':
                v = objLine[k].toLocaleString();
                break;
            default:
                v = objLine[k] ? String(objLine[k]) :'';
        }
        if (v.indexOf(delim) >= 0) {
            v = '"' + v.replace('"', '""') + '"';
        }
        line.push(v);
    }
    return line.join(delim) + "\n";
}

function process()
{
    let dates   = document.getElementById('dates').value;
    let ssrfXml = document.getElementById('ssrf').value ?? '<divelog/>';
    let gpxXml  = document.getElementById('gpx').value ?? '<gpx/>';
	let output  = '';
	try {
        let gpx, divelog;
        if (gpxXml) {
            gpx = new GpxReader(gpxXml);
        }
        if (ssrfXml) {
            divelog = new DiveLog(ssrfXml);
        }
        first = true;
        for (const dt of dates.trim().split(/\r?\n/)) {
            let dateTime = new Date(dt);
            output += dateFusion(dateTime, gpx, divelog);
            first = false;
        }
	}
	catch (e) {
		output = `ERROR: ${e}`;
	}
	document.getElementById('output').value = output;
}

document.getElementById('dates').addEventListener('change', process);
document.getElementById('ssrf').addEventListener('change', process);
document.getElementById('gpx').addEventListener('change', process);
document.getElementById('redo').addEventListener('click', process);
document.getElementById('download').addEventListener('click', () => {
	let contents = document.getElementById('output').value;
	download(contents, 'date-fusion.csv');
});
