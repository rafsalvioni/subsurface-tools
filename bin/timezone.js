import { DiveLog } from '../lib/ssrf.js';
import { download } from '../lib/utils.js';

function fixTimeZone(input, tz, replace)
{
    let divelog = new DiveLog(input);
    let sites   = divelog.getSites();
    for (const site of sites) {
        sites.setTimeZone(site.uuid, tz, replace);
    }
    for (const dive of divelog) {
        dive.setTimeZone(tz, replace);
    }
    return divelog.toString();
}

function process()
{
	let input = document.getElementById('input').value;
	let output;
	try {
        let tz      = prompt('Whats TZ do you wanna use?', Date.SYSTEM_TZ);
        if (!tz) {
            throw 'TZ is required';
        }
        let replace = confirm('Do you want to replace existant TZs?');
		output      = fixTimeZone(input, tz, !!replace);
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
	download(contents, 'dives-compact.ssrf');
});
