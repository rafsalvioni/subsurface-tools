import { GpxReader } from '../lib/gpx.js';
import { loadFile, app } from './app.js';

var gpx;

function gpxToSsrf()
{
    let diveLog = app.getDiveLog();
    let ndives = 0;
    let npois  = 0;
    for (const dive of diveLog) {
        if (dive.isLocalized()) {
            continue;
        }
        let diveStart = dive.getStart();
        let pos = gpx.getPositionAt(diveStart);
        if (pos) {
            ndives++;
            dive.setSpot(pos);
        }
    }
    for (const poi of gpx.eachPoi()) {
        npois++;
        diveLog.getSites().getByPosition(poi, true);
    }
    return [ndives, npois];
}

function process(e)
{
    loadFile(e.target.files[0], (e) => {
        try {
            gpx = new GpxReader(e.target.result);
            let ret = gpxToSsrf();
            alert(`${ret[0]} dives updated!\n${ret[1]} POIs processed!`);
        }
        catch (e) {
            gpx = null;
            app.error(e);
        }
    });
}

document.getElementById('op-merge-gpx').addEventListener('change', process);
