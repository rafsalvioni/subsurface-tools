import { GpxWriter } from '../lib/gpx.js';
import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function divesToGpx(input, sample)
{
	let divelog = new DiveLog(input);
	let gpx = new GpxWriter();
	gpx.create();

    for (const dive of divelog) {
        let num = dive.getNum();
        if (!dive.isLocalized()) {
            console.log(`Dive: ${num} without localization`);
            continue;
        }

        let dur  = dive.getDuration();
        let n    = Math.ceil(dur / sample);
        sample   = Math.ceil(dur / n);
        console.log(dur, n, sample);
        let dt   = dive.getStart();
        let grp  = `Dive #${num}`;
        let spot = dive.getSpot();
        gpx.addWayPoint(spot);

        while (n-- >= 0) {
            let dc    = dive.getSampleAt(dt); // Real depth at moment
            let depth = dc ? Math.rounds(dc.depth, 2) : dive.getDepth().mean;
            gpx.addPos(Object.assign({}, spot, {alt: spot.alt - depth}), dt, grp);
            dt.setTime(dt.getTime() + sample * 1000);
            dur -= sample;
        }
    }

    return gpx.end();
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
