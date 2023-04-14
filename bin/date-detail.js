import { GpxReader } from '../lib/gpx.js';
import { download } from '../lib/utils.js';
import { app, loadFile } from './app.js';

var first;
var gpx;
var dates;

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
    if (divelog && (tmp = divelog.getDataAt(date))) {
        delete(tmp.sample['time']);
        tmp.sample['depth'] = Math.rounds(tmp.sample['depth'], 2);
        Object.assign(fus, tmp.sample);
        if (!pos && tmp.dive.isLocalized()) {
            Object.assign(fus, tmp.dive.getSpot());
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
        let v = objLine[k] ? String(objLine[k]) :'';;
        if (v.indexOf(delim) >= 0) {
            v = '"' + v.replace('"', '""') + '"';
        }
        line.push(v);
    }
    return line.join(delim) + "\n";
}

function process()
{
    let output  = '';
    let divelog = app.getDiveLog();
	try {
        first = true;
        for (const dt of dates) {
            let dateTime = Date.create(dt);
            output += dateFusion(dateTime, gpx, divelog);
            first = false;
        }
        download(output, 'date-detail.csv', 'text/csv');
	}
	catch (e) {
		app.error(e);
	}
}

function loadFiles(e)
{
    var loaded = 0;
    var n      = e.target.files.length;
    var gpx    = dates = null;

    for (const f of e.target.files) {
        loadFile(f, (e) => {
            let ext = f.name.replace(/.+?\.(.+)$/, '$1');
            if (ext == 'gpx') {
                gpx = new GpxReader(e.target.result);
            }
            else {
                dates = e.target.result.trim().split(/\r?\n/);
            }
            loaded++;
            if (loaded == n) {
                process();
            }
        });
    }
}

document.getElementById('op-date-detail').addEventListener('change', loadFiles);
