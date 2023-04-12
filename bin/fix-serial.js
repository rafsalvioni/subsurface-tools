import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function process()
{
	let input = document.getElementById('input').value;
	let output;
	try {
		let divelog = new DiveLog(input);
        let stats   = divelog.fixDCSerial();
		if (stats[0] == 0) {
			throw `No DCs match`;
		}
        output = divelog.toString();
        alert(`${stats[1]}/${stats[0]} DCs data updated!`);
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
	download(contents, 'dives-serial.ssrf');
});
