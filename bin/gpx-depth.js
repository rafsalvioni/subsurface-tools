import { GpxReader, GpxWriter } from '../lib/gpx.js';
import { loadFile, app, download } from './app.js';

var gpx;

function fixGpxAlt()
{
    let diveLog = app.getDiveLog();
    let ret     = new GpxWriter();

    for (const t of gpx) {
        let s = diveLog.getDataAt(t.time);
        if (s) {
            t.point.alt -= s.sample.depth;
        }
        ret.addPos(t.point, t.time, t.track);
    }
    for (const p of gpx.eachPoi()) {
        ret.addWayPoint(p);
    }
    return ret;
}

function process(e)
{
    let name = e.target.files[0].name;
    loadFile(e.target.files[0], (e) => {
        try {
            gpx = new GpxReader(e.target.result);
            let ret = fixGpxAlt();
            download(ret.end(), name);
        }
        catch (e) {
            gpx = null;
            app.error(e);
        }
    });
}

document.getElementById('op-gpx-depth').addEventListener('change', process);
